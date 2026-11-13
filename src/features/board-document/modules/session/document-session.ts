import type { SessionOptions } from "./document-session.types";
import { DocumentErrors, SessionUtils } from "./document-session.utils";
import { SessionConfig } from "./document-session.config";
import { TaskClock } from "~/shared/lib/task-clock";
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
  private lease: WriterLease | null = null;
  private startup: Promise<void> | null = null;
  private disposal: Promise<void> | null = null;
  private disposed = false;
  private fatal = false;
  private paused = false;
  private loaded = false;
  private rawLoaded = false;
  private importing = false;
  private writing = false;
  private phase: SavePhase = "loading";
  private message = "";
  private rawMain: StoredRecord = { exists: false, value: undefined };
  private upgrade: StoredRecord = { exists: false, value: undefined };
  private schema3: StoredRecord = { exists: false, value: undefined };
  private previous: StoredRecord = { exists: false, value: undefined };
  private revision = 0;
  private savedRevision = 0;
  private tail: Promise<void> = Promise.resolve();
  private flushQueued = false;
  private timer: ReturnType<typeof TaskClock.schedule> | undefined;
  private maxTimer: ReturnType<typeof TaskClock.schedule> | undefined;
  private lastPublished: StorageState | null = null;

  constructor(private readonly options: SessionOptions) {}

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

        this.message =
          message +
          (this.hasUnsaved
            ? " Скачайте изменения из памяти и затем перезагрузите страницу."
            : "");

        this.publish();
      });

      if (this.disposed) return;

      const records = await this.repository.read();

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

      this.rawLoaded = true;

      const document = records.main.exists
        ? DocumentCodec.decodeDocument(records.main.value)
        : DocumentCodec.emptyDocument();

      this.loaded = true;
      this.options.onHydrate(DocumentSnapshots.toSnapshot(document));
      this.phase = "saved";
      this.publish();
    } catch (error) {
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
              schemaVersion: 3 as const,
              strokes: [...live.strokes],
              viewport: { ...live.viewport },
              tools: { ...live.tools },
            }
          : {
              ...DocumentCodec.decodeDocument(live),
              schemaVersion: 3 as const,
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
          !this.schema3.exists &&
          this.rawMain.exists &&
          SessionUtils.isLegacy(this.rawMain.value)
        )
          this.schema3 = this.rawMain;

        this.rawMain = { exists: true, value: snapshot };
        this.phase = this.revision === revision ? "saved" : "dirty";
        this.message = "";
      } catch (error) {
        this.writing = false;
        this.paused = true;
        this.clearTimers();
        this.phase = "error";

        this.message =
          DocumentErrors.messageOf(error) +
          " Изменения остаются в памяти; скачайте копию или повторите сохранение.";
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
    if (!this.canImport || isBusy())
      return Promise.reject(
        new Error(
          "Замена сейчас недоступна. Завершите письмо или перемещение.",
        ),
      );

    let document: BoardDocument;

    try {
      document = {
        ...DocumentCodec.decodeDocument(candidate),
        schemaVersion: 3,
      };
    } catch (error) {
      return Promise.reject(error);
    }

    this.importing = true;
    this.clearTimers();
    this.publish();

    const preceding = this.tail;

    const replacement = (async () => {
      try {
        await preceding;

        if (this.disposed || this.fatal || !this.repository)
          throw new Error(
            "Подключение к хранилищу изменилось. Замена не выполнена.",
          );

        const previous = this.loaded
          ? DocumentCodec.cloneDocument(
              DocumentSnapshots.fromSnapshot(this.options.snapshot()),
            )
          : this.rawMain.value;

        await this.repository.replace(previous, document);

        if (this.disposed || this.fatal) return;

        if (
          !this.schema3.exists &&
          this.rawMain.exists &&
          SessionUtils.isLegacy(this.rawMain.value)
        )
          this.schema3 = this.rawMain;

        this.previous = { exists: true, value: previous };
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
        this.paused = true;
        this.phase = "error";

        this.message =
          "Замена не выполнена. " + DocumentErrors.messageOf(error);

        throw error;
      } finally {
        this.importing = false;
        this.publish();
      }
    })();

    this.tail = replacement.catch(() => {});

    return replacement;
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;

    this.disposed = true;
    this.clearTimers();

    this.disposal = (async () => {
      await this.startup?.catch(() => {});
      await this.tail;

      await Promise.allSettled([
        this.options.persistence?.close(),
        this.repository?.close(),
      ]);

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
