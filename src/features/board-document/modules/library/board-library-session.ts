import type { ImportCandidate } from "../import-candidates";
import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { DocumentCodec, DocumentSchema, DocumentSnapshots } from "../codec";
import { DocumentErrors, SessionUtils } from "../session";
import type { DocumentSession } from "../session";
import type {
  BoardDocument,
  BoardAppearance,
  StorageState,
  StoredRecord,
  WriterLease,
} from "../../board-document.types";
import type {
  LibraryOptions,
  LibraryRepository,
  BoardCatalog,
  LibraryState,
} from "./library.types";
import { LibraryAppearance } from "./library-appearance";
import { LibraryCatalog } from "./library-catalog";
import { LibraryRecovery } from "./library-recovery";

export class BoardLibrarySession {
  private lease: WriterLease | null = null;
  private repository: LibraryRepository | null = null;
  private active: DocumentSession | null = null;
  private preparing: import("../jobs").OwnedPreparedBoard | null = null;
  private catalog: BoardCatalog;
  private startup: Promise<void> | null = null;
  private closing: Promise<void> | null = null;
  private disposed = false;
  private booting = true;
  private busy = false;
  private fatal: MessageTypes.Value = "";
  private invalidated: MessageTypes.Value = "";
  private message: MessageTypes.Value = "";
  private readonly validationAbort = new AbortController();
  private readonly recovery: LibraryRecovery;
  private recoveryAvailable = false;
  private publishedStorage: StorageState | null = null;
  private raw: StoredRecord = {
    exists: false,
    value: undefined,
  };
  private operation: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: LibraryOptions) {
    this.catalog = LibraryCatalog.initial(options.initialTitle);

    this.recovery = new LibraryRecovery(
      async (id, signal) => {
        const prepared = await this.prepareBoard(id, signal);

        try {
          return DocumentSnapshots.toSnapshot(prepared.document);
        } finally {
          await prepared.owned?.close().catch(() => {});
        }
      },
      (board) => {
        if (!this.disposed) this.options.onRecoveryPreview?.(board);
      },
      () => this.publish(),
    );
  }

  private get canUseActive() {
    return (
      !this.disposed &&
      !this.booting &&
      !this.busy &&
      !this.fatal &&
      !this.invalidated
    );
  }

  get canWrite() {
    return this.canUseActive && Boolean(this.active?.canWrite);
  }

  get canImport() {
    return this.canUseActive && Boolean(this.active?.canImport);
  }

  get hasUnsaved() {
    return this.active?.hasUnsaved ?? false;
  }

  get state(): StorageState {
    const active = this.active?.state;
    const error = this.invalidated || this.fatal;

    return {
      ...active,
      phase: error ? "error" : (active?.phase ?? "loading"),
      loaded: active?.loaded ?? false,
      writable: this.canWrite,
      readOnly: this.disposed || Boolean(error) || (active?.readOnly ?? true),
      canImport: this.canImport,
      importing: active?.importing ?? false,
      hasPrevious: active?.hasPrevious ?? false,
      hasRawCopy:
        error && !active?.loaded
          ? (this.rawRecord?.exists ?? false)
          : active?.hasRawCopy,
      canReconnect:
        !this.disposed &&
        !this.booting &&
        !this.busy &&
        !this.canWrite &&
        !this.hasUnsaved &&
        !active?.importing,
      message: this.invalidated || this.fatal || active?.message || "",
    };
  }

  get rawRecord() {
    const child = this.active?.rawRecord;

    if (child?.exists) return child;

    return (this.fatal || this.invalidated) &&
      !this.active?.state.loaded &&
      this.raw.exists
      ? this.raw
      : child;
  }

  get previousRecord() {
    return this.active?.previousRecord;
  }

  get upgradeRecord() {
    return this.active?.upgradeRecord;
  }

  get schema3Record() {
    return this.active?.schema3Record;
  }

  get schema6Record() {
    return this.active?.schema6Record ?? { exists: false, value: undefined };
  }

  get schema5Record() {
    return this.active?.schema5Record ?? { exists: false, value: undefined };
  }

  get schema4Record() {
    return this.active?.schema4Record;
  }

  get libraryRecord() {
    return this.active?.libraryRecord;
  }

  private publish() {
    if (this.disposed) return;

    this.publishStorage();

    const state: LibraryState = Object.freeze({
      activeId: this.catalog.activeId,
      boards: Object.freeze(
        this.catalog.boards.map((board) => Object.freeze({ ...board })),
      ),
      busy: this.busy,
      message: this.invalidated || this.fatal || this.message,
      ...(this.recoveryAvailable
        ? { recovery: Object.freeze(this.recovery.state) }
        : {}),
    });

    this.options.onLibrary?.(state);
  }

  private publishStorage() {
    if (this.disposed) return;

    const state = this.state;

    if (SessionUtils.sameState(this.publishedStorage, state)) return;

    this.publishedStorage = Object.freeze(state);
    this.options.onState(this.publishedStorage);
  }

  private invalidate(message: MessageTypes.Value) {
    if (this.disposed || this.invalidated) return;

    this.invalidated = Messages.concat(
      message,
      this.hasUnsaved
        ? Messages.create("downloadChangesFromMemoryThenReloadThe")
        : "",
    );

    this.validationAbort.abort(Messages.error(this.invalidated));
    this.active?.invalidate(message);
    this.recoveryAvailable = false;
    this.recovery.close();
  }

  start() {
    this.startup ??= this.boot();

    return this.startup;
  }

  private async boot() {
    if (this.disposed) return;

    this.publishStorage();

    const signal = this.validationAbort.signal;

    try {
      this.lease = await this.options.acquire();
      signal.throwIfAborted();

      this.repository = await this.options.open((message) =>
        this.invalidate(message),
      );

      signal.throwIfAborted();

      let records =
        this.options.prepareOwned && this.repository.readCatalog
          ? {
              catalog: await this.repository.readCatalog(),
              main: { exists: false, value: undefined as unknown },
            }
          : await this.repository.read();

      let initialLoad: import("../jobs").OwnedPreparedBoard | undefined;

      signal.throwIfAborted();
      this.raw = records.catalog.exists ? records.catalog : records.main;

      if (records.catalog.exists) {
        this.catalog = LibraryCatalog.decode(records.catalog.value);

        try {
          const prepared = await this.prepareBoard(
            this.catalog.activeId,
            signal,
            (record) => {
              if (record.exists) this.raw = record;
            },
          );

          this.preparing = prepared.owned ?? null;
          initialLoad = prepared.owned;
        } catch (error) {
          this.recoveryAvailable =
            !signal.aborted && this.catalog.boards.length > 1;

          throw error;
        }

        signal.throwIfAborted();

        if (
          this.lease.acquired &&
          (
            records.catalog.value as {
              schemaVersion: number;
            }
          ).schemaVersion === 1
        )
          await this.repository.migrate(this.catalog, records.catalog);
      } else {
        const owned = await this.options.prepareOwned?.("main", signal);

        if (owned) {
          this.preparing = owned;
          this.raw = owned.records.main;
        } else if (this.options.prepareOwned && this.repository.readCatalog) {
          records = await this.repository.read();
          this.raw = records.main;
        }

        signal.throwIfAborted();

        if (owned?.error) throw Messages.error(owned.error);

        const document =
          owned?.document ??
          (records.main.exists
            ? await this.decode(records.main.value, signal)
            : DocumentCodec.emptyDocument());

        await this.options.preflight?.(document, signal);
        signal.throwIfAborted();

        if (this.lease.acquired) {
          if (owned) await owned.bootstrap(this.catalog);
          else
            await this.repository.bootstrap(
              this.catalog,
              {
                ...document,
                schemaVersion: DocumentSchema.current(document.strokes),
              },
              records.main,
            );
        }

        initialLoad = owned ?? undefined;
      }

      signal.throwIfAborted();
      await this.activate(this.catalog.activeId, initialLoad);
    } catch (error) {
      await this.preparing?.close().catch(() => {});
      this.preparing = null;

      if (!signal.aborted) this.fatal = DocumentErrors.messageOf(error);
    } finally {
      this.booting = false;
      this.publish();
    }
  }

  private async activate(
    id: string,
    initialLoad?: import("../jobs").OwnedPreparedBoard,
  ) {
    this.validationAbort.signal.throwIfAborted();

    if (!this.lease)
      throw Messages.error(Messages.create("boardLockingIsUnavailable"));

    const session = this.options.session(
      id,
      {
        ...this.lease,

        release: async () => {},
      },
      {
        ...(initialLoad ? { initialLoad } : {}),
        snapshot: this.options.snapshot,

        onHydrate: (board) => {
          if (this.active === session && !this.validationAbort.signal.aborted)
            this.options.onHydrate(board);
        },

        onState: () => {
          if (this.active === session) this.publishStorage();
        },

        onInvalidated: (message) => {
          if (this.active === session) this.invalidate(message);
        },
      },
    );

    this.active = session;

    if (initialLoad === this.preparing) this.preparing = null;

    await session.start();

    this.validationAbort.signal.throwIfAborted();

    if (!session.state.loaded)
      throw Messages.error(
        session.state.message || Messages.create("theBoardDidNotLoad"),
      );
  }

  private requireWritable() {
    if (!this.canWrite || !this.repository)
      throw Messages.error(Messages.create("theBoardListCannotBeChangedRight"));
  }

  private async run(action: () => Promise<void>) {
    this.requireWritable();
    this.busy = true;
    this.message = "";
    this.publish();

    try {
      this.operation = action();
      await this.operation;
    } catch (error) {
      this.message = DocumentErrors.messageOf(error);

      throw error;
    } finally {
      this.busy = false;

      if (!this.disposed) this.publish();
    }
  }

  private decode(value: unknown, signal: AbortSignal) {
    return this.options.decode
      ? this.options.decode(value, signal)
      : Promise.resolve(DocumentCodec.decodeDocument(value));
  }

  private async prepareBoard(
    id: string,
    signal: AbortSignal,
    capture?: (record: StoredRecord) => void,
  ) {
    const owned = await this.options.prepareOwned?.(id, signal);

    try {
      signal.throwIfAborted();

      const record = owned?.records.main ?? (await this.repository!.board(id));

      capture?.(record);
      signal.throwIfAborted();

      if (!record.exists)
        throw Messages.error(
          Messages.create(
            capture
              ? "aCatalogBoardIsMissingFromStorage"
              : "boardIsMissingFromStorageCurrentNotes",
          ),
        );

      if (owned?.error) throw Messages.error(owned.error);

      const document =
        owned?.document ?? (await this.decode(record.value, signal));

      signal.throwIfAborted();
      await this.options.preflight?.(document, signal);
      signal.throwIfAborted();

      return { document, owned: owned ?? undefined };
    } catch (error) {
      await owned?.close().catch(() => {});

      throw error;
    }
  }

  previewBoard(id: string) {
    if (
      !this.recoveryAvailable ||
      this.disposed ||
      id === this.catalog.activeId
    )
      return Promise.resolve();

    const board = this.catalog.boards.find((entry) => entry.id === id);

    return board ? this.recovery.select(id, board.title) : Promise.resolve();
  }

  closePreview() {
    if (this.recoveryAvailable && !this.disposed) this.recovery.close();
  }

  private async transition(
    catalog: BoardCatalog,
    change?: Parameters<LibraryRepository["update"]>[1],
  ) {
    await this.active!.flushOrThrow();

    const signal = this.validationAbort.signal;

    signal.throwIfAborted();

    const prepared = await this.prepareBoard(catalog.activeId, signal);

    try {
      signal.throwIfAborted();
      await this.repository!.update(catalog, change);
      signal.throwIfAborted();
      await this.active!.dispose();

      signal.throwIfAborted();

      this.catalog = catalog;
      await this.activate(catalog.activeId, prepared.owned);
    } finally {
      await prepared.owned?.close().catch(() => {});
    }
  }

  async switchBoard(id: string) {
    if (id === this.catalog.activeId) return;

    if (!this.catalog.boards.some((b) => b.id === id))
      throw Messages.error(Messages.create("boardNotFound"));

    await this.run(() => this.transition({ ...this.catalog, activeId: id }));
  }

  async createBoard(value: string) {
    const title = LibraryCatalog.title(value);

    if (this.catalog.boards.length >= 100)
      throw Messages.error(Messages.create("theLibraryCanContainUpTo100"));

    const id = this.options.id();

    await this.run(async () => {
      if (this.catalog.boards.some((b) => b.id === id))
        throw Messages.error(
          Messages.create("couldNotCreateAUniqueBoardIdentifier"),
        );

      await this.active!.flushOrThrow();
      this.validationAbort.signal.throwIfAborted();

      const catalog = {
        ...this.catalog,
        activeId: id,
        boards: [
          ...this.catalog.boards,
          {
            id,
            title,
            appearance: LibraryAppearance.assign(
              id,
              new Set(
                this.catalog.boards.map((board) =>
                  LibraryAppearance.key(board.appearance),
                ),
              ),
            ),
          },
        ],
      };

      await this.repository!.update(catalog, {
        create: { id, document: DocumentCodec.emptyDocument() },
      });

      this.validationAbort.signal.throwIfAborted();

      await this.active!.dispose();

      this.validationAbort.signal.throwIfAborted();

      this.catalog = catalog;
      await this.activate(id);
    });
  }

  async renameBoard(id: string, value: string) {
    const title = LibraryCatalog.title(value);

    await this.run(async () => {
      if (!this.catalog.boards.some((b) => b.id === id))
        throw Messages.error(Messages.create("boardNotFound"));

      const catalog = {
        ...this.catalog,
        boards: this.catalog.boards.map((b) =>
          b.id === id ? { ...b, title } : b,
        ),
      };

      await this.repository!.update(catalog);
      this.catalog = catalog;
    });
  }

  async setBoardAppearance(id: string, appearance: BoardAppearance) {
    if (!LibraryAppearance.valid(appearance))
      throw Messages.error(Messages.create("invalidBoardAppearance"));

    const captured = { color: appearance.color, icon: appearance.icon };

    await this.run(async () => {
      if (!this.catalog.boards.some((board) => board.id === id))
        throw Messages.error(Messages.create("boardNotFound"));

      const catalog = {
        ...this.catalog,
        boards: this.catalog.boards.map((board) =>
          board.id === id ? { ...board, appearance: captured } : board,
        ),
      };

      await this.repository!.update(catalog);
      this.catalog = catalog;
    });
  }

  async deleteBoard(id: string) {
    if (this.catalog.boards.length <= 1)
      throw Messages.error(Messages.create("theLastBoardCannotBeDeleted"));

    if (!this.catalog.boards.some((b) => b.id === id))
      throw Messages.error(Messages.create("boardNotFound"));

    await this.run(async () => {
      const boards = this.catalog.boards.filter((b) => b.id !== id),
        activeId =
          this.catalog.activeId === id ? boards[0]!.id : this.catalog.activeId,
        catalog = { ...this.catalog, boards, activeId };

      if (id === this.catalog.activeId)
        await this.transition(catalog, { remove: id });
      else {
        await this.repository!.update(catalog, { remove: id });
        this.catalog = catalog;
      }
    });
  }

  changed(urgent = false) {
    if (this.canWrite) this.active?.changed(urgent);
  }

  flush() {
    return this.active?.flush() ?? Promise.resolve();
  }

  flushOrThrow() {
    return (
      this.active?.flushOrThrow() ??
      Promise.reject(Messages.error(Messages.create("boardIsNotLoaded")))
    );
  }

  retrySave() {
    return this.canWrite ? this.active!.retrySave() : Promise.resolve();
  }

  replace(document: BoardDocument, isBusy: () => boolean) {
    if (!this.canImport)
      return Promise.reject(
        Messages.error(Messages.create("boardReplacementIsUnavailable")),
      );

    return this.active!.replace(document, isBusy);
  }

  replaceCandidate(candidate: ImportCandidate, isBusy: () => boolean) {
    if (!this.canImport)
      return Promise.reject(
        Messages.error(Messages.create("boardReplacementIsUnavailable")),
      );

    return this.active!.replaceCandidate(candidate, isBusy);
  }

  dispose() {
    if (this.closing) return this.closing;

    this.disposed = true;

    this.validationAbort.abort(
      Messages.error(Messages.create("boardSwitchCancelled")),
    );

    this.recovery.close();

    const activeDisposal = this.active?.dispose();

    this.closing = (async () => {
      await Promise.all([
        this.startup?.catch(() => {}),
        this.operation.catch(() => {}),
        activeDisposal,
        this.recovery.drain(),
      ]);

      await this.preparing?.close();
      await this.repository?.close();
      await this.lease?.release();
    })();

    return this.closing;
  }
}
