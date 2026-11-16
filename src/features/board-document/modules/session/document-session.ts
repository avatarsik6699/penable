import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type { SessionOptions } from "./document-session.types";
import { DocumentErrors, SessionUtils } from "./document-session.utils";
import { SessionConfig } from "./document-session.config";
import { TaskClock } from "~/shared/lib/task-clock";
import { ImportCandidates, type ImportCandidate } from "../import-candidates";
import { DocumentSnapshots, DocumentCodec } from "../codec";
import type {
  BoardDocument,
  DocumentRepository,
  SavePhase,
  StorageState,
  StoredRecord,
  WriterLease,
} from "../../board-document.types";

export class DocumentSession {
  private repository: DocumentRepository | null = null;
  private ownedLoad: import("../jobs").OwnedPreparedBoard | null = null;
  private lease: WriterLease | null = null;
  private startup: Promise<void> | null = null;
  private disposal: Promise<void> | null = null;
  private disposed = false;
  private readonly loadingAbort = new AbortController();
  private fatal = false;
  private paused = false;
  private loaded = false;
  private rawLoaded = false;
  private importing = false;
  private replacementAbort: AbortController | null = null;
  private writing = false;
  private phase: SavePhase = "loading";
  private message: MessageTypes.Value = "";
  private rawMain: StoredRecord = { exists: false, value: undefined };
  private upgrade: StoredRecord = { exists: false, value: undefined };
  private schema5: StoredRecord = { exists: false, value: undefined };
  private schema4: StoredRecord = { exists: false, value: undefined };
  private libraryCopy: StoredRecord = { exists: false, value: undefined };
  private schema3: StoredRecord = { exists: false, value: undefined };
  private previous: StoredRecord = { exists: false, value: undefined };
  private revision = 0;
  private savedRevision = 0;
  private tail: Promise<void> = Promise.resolve();
  private flushQueued = false;
  private timer: ReturnType<typeof TaskClock.schedule> | undefined;
  private maxTimer: ReturnType<typeof TaskClock.schedule> | undefined;
  private lastPublished: StorageState | null = null;

  private readonly options: SessionOptions;
  private initialLoad: import("../jobs").OwnedPreparedBoard | undefined;

  constructor(options: SessionOptions) {
    const { initialLoad, ...sessionOptions } = options;

    this.options = sessionOptions;
    this.initialLoad = initialLoad;
  }

  get canWrite(): boolean {
    return (
      !this.disposed &&
      this.loaded &&
      Boolean(this.lease?.acquired) &&
      !this.fatal &&
      !this.importing
    );
  }

  get canImport(): boolean {
    return (
      !this.disposed &&
      this.rawLoaded &&
      Boolean(this.repository && this.lease?.acquired) &&
      !this.fatal &&
      !this.importing
    );
  }

  get hasUnsaved(): boolean {
    return (
      (this.loaded && this.revision > this.savedRevision) ||
      this.writing ||
      this.importing
    );
  }

  get state(): StorageState {
    return {
      phase: this.phase,
      loaded: this.loaded,
      writable: this.canWrite,
      readOnly: !this.lease?.acquired || this.fatal,
      canImport: this.canImport,
      importing: this.importing,
      hasPrevious: this.previous.exists,
      hasUpgradeCopy: this.upgrade.exists,
      hasSchema3Copy: this.schema3.exists,
      hasSchema4Copy: this.schema4.exists,
      hasSchema5Copy: this.schema5.exists,
      hasLibraryCopy: this.libraryCopy.exists,
      hasRawCopy: this.rawMain.exists && !this.loaded && this.phase === "error",
      canReconnect:
        !this.canWrite &&
        this.phase !== "loading" &&
        !this.hasUnsaved &&
        !this.importing,
      message: this.message || this.lease?.message || "",
    };
  }

  get upgradeRecord(): StoredRecord {
    return this.upgrade;
  }

  get schema3Record(): StoredRecord {
    return this.schema3;
  }

  get rawRecord(): StoredRecord {
    return this.rawMain;
  }

  get schema5Record(): StoredRecord {
    return this.schema5;
  }

  get schema4Record(): StoredRecord {
    return this.schema4;
  }

  get libraryRecord(): StoredRecord {
    return this.libraryCopy;
  }

  async flushOrThrow(): Promise<void> {
    await this.flush();

    if (this.phase === "error" || this.hasUnsaved || this.paused)
      throw Messages.error(
        this.message || Messages.create("couldNotSaveTheCurrentBoard"),
      );
  }

  get previousRecord(): StoredRecord {
    return this.previous;
  }

  start(): Promise<void> {
    if (!this.startup) this.startup = this.boot();

    return this.startup;
  }

  private async boot() {
    if (this.disposed) return;

    this.publish();

    try {
      this.lease = await this.options.acquire();

      if (this.disposed) return;

      this.repository = await this.options.open((message) => {
        this.fatal = true;
        this.paused = true;
        this.clearTimers();
        this.phase = "error";

        this.message = Messages.concat(
          message,
          this.hasUnsaved
            ? Messages.create("downloadChangesFromMemoryThenReloadThe")
            : "",
        );

        this.publish();
      });

      if (this.disposed) return;

      const initial = this.initialLoad;

      this.initialLoad = undefined;

      const owned =
        initial ?? (await this.options.loadOwned?.(this.loadingAbort.signal));

      this.ownedLoad = owned ?? null;

      const records = owned?.records ?? (await this.repository.read());

      if (this.disposed || this.fatal) return;

      this.rawMain = records.main;
      this.previous = records.beforeImport;

      this.upgrade = records.beforeSchema2 ?? {
        exists: false,
        value: undefined,
      };

      this.schema3 = records.beforeSchema3 ?? {
        exists: false,
        value: undefined,
      };

      this.schema5 = records.beforeSchema5 ?? {
        exists: false,
        value: undefined,
      };

      this.schema4 = records.beforeSchema4 ?? {
        exists: false,
        value: undefined,
      };

      this.libraryCopy = records.beforeLibrary ?? {
        exists: false,
        value: undefined,
      };

      this.rawLoaded = true;

      if (owned?.error) throw Messages.error(owned.error);

      const document =
        owned?.document ??
        (records.main.exists
          ? this.options.decode
            ? await this.options.decode(
                records.main.value,
                this.loadingAbort.signal,
              )
            : DocumentCodec.decodeDocument(records.main.value)
          : DocumentCodec.emptyDocument());

      if (this.disposed || this.fatal) return;

      if (owned && !initial)
        await this.options.preflight?.(document, this.loadingAbort.signal);

      await owned?.close();
      this.ownedLoad = null;

      if (this.disposed || this.fatal) return;

      this.loaded = true;
      this.options.onHydrate(DocumentSnapshots.toSnapshot(document));
      this.phase = "saved";
      this.publish();
    } catch (error) {
      await this.ownedLoad?.close().catch(() => {});
      this.ownedLoad = null;
      this.phase = "error";
      this.message = DocumentErrors.messageOf(error);
      this.publish();
    }
  }

  changed(urgent = false) {
    if (!this.canWrite) return;

    this.revision++;

    if (this.paused) {
      this.publish();

      return;
    }

    this.phase = this.writing ? "saving" : "dirty";
    this.publish();
    TaskClock.cancel(this.timer);

    this.timer = TaskClock.schedule(
      () => {
        void this.flush();
      },
      urgent ? SessionConfig.urgentDelay : SessionConfig.saveDelay,
    );

    if (this.maxTimer === undefined)
      this.maxTimer = TaskClock.schedule(() => {
        void this.flush();
      }, SessionConfig.maxWait);
  }

  flush(): Promise<void> {
    this.clearTimers();

    if (
      !this.canWrite ||
      this.paused ||
      this.revision <= this.savedRevision ||
      this.flushQueued
    )
      return this.tail;

    this.flushQueued = true;

    this.tail = this.tail.then(async () => {
      this.flushQueued = false;

      if (
        !this.canWrite ||
        this.paused ||
        !this.repository ||
        this.revision <= this.savedRevision
      )
        return;

      const revision = this.revision;

      try {
        const live = DocumentSnapshots.fromSnapshot(this.options.snapshot());

        const snapshot = this.options.persistence
          ? {
              ...live,
              schemaVersion: 5 as const,
              strokes: [...live.strokes],
              viewport: { ...live.viewport },
              tools: { ...live.tools },
            }
          : {
              ...DocumentCodec.decodeDocument(
                DocumentCodec.encodeDocument(live),
              ),
              schemaVersion: 5 as const,
            };

        this.writing = true;
        this.phase = "saving";
        this.publish();

        if (this.options.persistence)
          await this.options.persistence.write(snapshot);
        else await this.repository.write(snapshot);

        this.writing = false;

        if (this.disposed || this.fatal) return;

        this.savedRevision = revision;

        if (
          !this.schema4.exists &&
          this.rawMain.exists &&
          SessionUtils.isPre4(this.rawMain.value)
        )
          this.schema4 = this.rawMain;

        if (
          !this.schema5.exists &&
          this.rawMain.exists &&
          this.rawMain.value &&
          typeof this.rawMain.value === "object" &&
          "schemaVersion" in this.rawMain.value &&
          [1, 2, 3, 4].includes(this.rawMain.value.schemaVersion as number)
        )
          this.schema5 = this.rawMain;

        this.rawMain = { exists: true, value: snapshot };
        this.phase = this.revision === revision ? "saved" : "dirty";
        this.message = "";
      } catch (error) {
        this.writing = false;
        this.paused = true;
        this.clearTimers();
        this.phase = "error";

        this.message = Messages.concat(
          DocumentErrors.messageOf(error),
          Messages.create("changesRemainInMemoryDownloadACopy"),
        );
      }

      this.publish();
    });

    return this.tail;
  }

  retrySave(): Promise<void> {
    if (!this.canWrite) return Promise.resolve();

    this.paused = false;
    this.message = "";
    this.phase = this.revision > this.savedRevision ? "dirty" : "saved";
    this.publish();

    return this.flush();
  }

  replace(candidate: BoardDocument, isBusy: () => boolean): Promise<void> {
    return this.replacePrepared(candidate, isBusy, false);
  }

  replaceCandidate(
    candidate: ImportCandidate,
    isBusy: () => boolean,
  ): Promise<void> {
    let document: BoardDocument;

    try {
      document = ImportCandidates.document(candidate);
    } catch (error) {
      return Promise.reject(error);
    }

    return this.replacePrepared(document, isBusy, true).then(() => {
      ImportCandidates.dispose(candidate);
    });
  }

  private replacePrepared(
    candidate: BoardDocument,
    isBusy: () => boolean,
    validated: boolean,
  ): Promise<void> {
    if (!this.canImport || isBusy())
      return Promise.reject(
        Messages.error(
          Messages.create("replacementIsUnavailableRightNowFinishWriting"),
        ),
      );

    const controller = new AbortController();
    let prepared: Promise<BoardDocument>;

    try {
      prepared = validated
        ? Promise.resolve(candidate)
        : this.options.prepare
          ? this.options.prepare(candidate, controller.signal)
          : Promise.resolve({
              ...DocumentCodec.decodeDocument(
                candidate.schemaVersion === 4 || candidate.schemaVersion === 5
                  ? DocumentCodec.encodeDocument(candidate)
                  : candidate,
              ),
              schemaVersion: 5,
            });
    } catch (error) {
      return Promise.reject(error);
    }

    // A preceding write may still be draining when asynchronous validation fails.
    void prepared.catch(() => {});
    this.importing = true;

    this.replacementAbort = controller;
    this.clearTimers();
    this.publish();

    const preceding = this.tail;

    let writeAttempted = false,
      validationFailed = false;

    let priorState = {
      phase: this.phase,
      paused: this.paused,
      message: this.message,
    };

    const replacement = (async () => {
      try {
        await preceding;

        if (this.disposed || this.fatal || !this.repository)
          throw Messages.error(
            Messages.create("storageConnectionChangedTheBoardWasNot"),
          );

        priorState = {
          phase: this.phase,
          paused: this.paused,
          message: this.message,
        };

        const document = { ...(await prepared), schemaVersion: 5 as const };

        if (this.disposed || this.fatal || controller.signal.aborted)
          throw Messages.error(
            Messages.create("replacementCancelledTheCurrentBoardIsRetained"),
          );

        await this.options.preflight?.(document, controller.signal);

        if (this.disposed || this.fatal || controller.signal.aborted)
          throw Messages.error(
            Messages.create("replacementCancelledTheCurrentBoardIsRetained"),
          );

        const durableReplace = this.options.persistence?.replace;

        const previous = this.loaded
          ? durableReplace
            ? DocumentSnapshots.fromSnapshot(this.options.snapshot())
            : DocumentCodec.cloneDocument(
                DocumentSnapshots.fromSnapshot(this.options.snapshot()),
              )
          : this.rawMain.value;

        writeAttempted = true;

        let recovery: StoredRecord | void = undefined;

        if (durableReplace)
          recovery = await durableReplace.call(
            this.options.persistence,
            this.loaded
              ? (previous as BoardDocument)
              : { kind: "stored-current" },
            document,
          );
        else await this.repository.replace(previous, document);

        if (this.disposed || this.fatal) return;

        if (
          !this.schema4.exists &&
          this.rawMain.exists &&
          SessionUtils.isPre4(this.rawMain.value)
        )
          this.schema4 = this.rawMain;

        if (
          !this.schema5.exists &&
          this.rawMain.exists &&
          this.rawMain.value &&
          typeof this.rawMain.value === "object" &&
          "schemaVersion" in this.rawMain.value &&
          [1, 2, 3, 4].includes(this.rawMain.value.schemaVersion as number)
        )
          this.schema5 = this.rawMain;

        this.previous = recovery ?? { exists: true, value: previous };
        this.rawMain = { exists: true, value: document };
        this.loaded = true;
        this.rawLoaded = true;
        this.revision = 0;
        this.savedRevision = 0;
        this.paused = false;
        this.message = "";
        this.phase = "saved";
        this.options.onHydrate(DocumentSnapshots.toSnapshot(document));
      } catch (error) {
        if (!writeAttempted && !this.disposed && !this.fatal) {
          this.phase = priorState.phase;
          this.paused = priorState.paused;
          this.message = priorState.message;
          validationFailed = true;
        } else {
          this.paused = true;
          this.phase = "error";

          this.message = Messages.concat(
            Messages.create("replacementFailed"),
            DocumentErrors.messageOf(error),
          );
        }

        throw error;
      } finally {
        this.replacementAbort = null;
        this.importing = false;

        if (
          validationFailed &&
          !this.paused &&
          !this.disposed &&
          !this.fatal &&
          this.revision > this.savedRevision
        )
          this.timer = TaskClock.schedule(() => {
            void this.flush();
          }, SessionConfig.saveDelay);

        this.publish();
      }
    })();

    this.tail = replacement.catch(() => {});

    return replacement;
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;

    this.disposed = true;
    this.loadingAbort.abort();
    this.replacementAbort?.abort();
    this.clearTimers();

    this.disposal = (async () => {
      await this.startup?.catch(() => {});
      await this.tail;

      await Promise.allSettled([
        this.options.persistence?.close(),
        this.repository?.close(),
      ]);

      await this.ownedLoad?.close();
      await this.initialLoad?.close();
      this.ownedLoad = null;
      this.initialLoad = undefined;
      await this.lease?.release();
    })();

    return this.disposal;
  }

  private clearTimers() {
    TaskClock.cancel(this.timer);
    TaskClock.cancel(this.maxTimer);
    this.timer = undefined;
    this.maxTimer = undefined;
  }

  private publish() {
    if (this.disposed) return;

    const state = this.state;
    const previous = this.lastPublished;

    if (SessionUtils.sameState(previous, state)) return;

    this.lastPublished = state;
    this.options.onState(state);
  }
}

export { DocumentErrors } from "./document-session.utils";
export type { SessionOptions } from "./document-session.types";
