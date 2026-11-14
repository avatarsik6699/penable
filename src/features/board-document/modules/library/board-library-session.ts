import { DocumentCodec } from "../codec";
import { DocumentErrors } from "../session";
import type { DocumentSession } from "../session";
import type {
  BoardDocument,
  BoardAppearance,
  StorageState,
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

export class BoardLibrarySession {
  private lease: WriterLease | null = null;
  private repository: LibraryRepository | null = null;
  private active: DocumentSession | null = null;
  private catalog = LibraryCatalog.initial();
  private startup: Promise<void> | null = null;
  private closing: Promise<void> | null = null;
  private disposed = false;
  private busy = false;
  private fatal = "";
  private message = "";
  private readonly validationAbort = new AbortController();
  private raw: { exists: boolean; value: unknown } = {
    exists: false,
    value: undefined,
  };

  private operation: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: LibraryOptions) {}

  get canWrite() {
    return (
      !this.disposed &&
      !this.busy &&
      !this.fatal &&
      Boolean(this.active?.canWrite)
    );
  }

  get canImport() {
    return this.canWrite && Boolean(this.active?.canImport);
  }

  get hasUnsaved() {
    return this.active?.hasUnsaved ?? false;
  }

  get state(): StorageState {
    if (this.active) {
      const state = this.active.state;

      return {
        ...state,
        phase: this.fatal ? "error" : state.phase,
        writable: this.canWrite,
        canImport: this.canImport,
        readOnly: Boolean(this.fatal) || state.readOnly,
        canReconnect: !this.canWrite && !this.busy && !this.hasUnsaved,
        message: this.fatal || state.message,
      };
    }

    return {
      phase: this.startup ? "error" : "loading",
      loaded: false,
      writable: false,
      readOnly: true,
      canImport: false,
      importing: false,
      hasPrevious: false,
      canReconnect: true,
      message: this.fatal,
    };
  }

  get rawRecord() {
    return this.fatal && this.raw.exists ? this.raw : this.active?.rawRecord;
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
    const state: LibraryState = Object.freeze({
      activeId: this.catalog.activeId,
      boards: Object.freeze(
        this.catalog.boards.map((board) => Object.freeze({ ...board })),
      ),
      busy: this.busy,
      message: this.message || this.fatal,
    });

    this.options.onLibrary?.(state);

    if (this.active) {
      const storage = this.active.state;

      this.options.onState({
        ...storage,
        phase: this.fatal ? "error" : storage.phase,
        writable: this.canWrite,
        canImport: this.canImport,
        message: this.fatal || storage.message,
      });
    }
  }

  start() {
    this.startup ??= this.boot();

    return this.startup;
  }

  private async boot() {
    try {
      this.lease = await this.options.acquire();

      if (this.disposed) return;

      this.repository = await this.options.open((message) => {
        this.fatal = message;
        this.publish();
      });

      if (this.disposed) return;

      const records = await this.repository.read();

      if (this.disposed) return;

      this.raw = records.catalog.exists ? records.catalog : records.main;

      if (records.catalog.exists) {
        this.catalog = LibraryCatalog.decode(records.catalog.value);

        const selected = await this.repository.board(this.catalog.activeId);

        this.raw = selected.exists ? selected : records.catalog;

        if (!selected.exists)
          throw new Error(
            "Доска из каталога отсутствует в хранилище. Исходный каталог сохранён.",
          );

        const document = DocumentCodec.decodeDocument(selected.value);

        await this.options.preflight?.(document, this.validationAbort.signal);

        if (this.disposed) return;

        if (
          this.lease.acquired &&
          (records.catalog.value as { schemaVersion: number }).schemaVersion ===
            1
        )
          await this.repository.migrate(this.catalog, records.catalog);
      } else {
        const document = records.main.exists
          ? DocumentCodec.decodeDocument(records.main.value)
          : DocumentCodec.emptyDocument();

        if (this.lease.acquired)
          await this.repository.bootstrap(
            this.catalog,
            { ...document, schemaVersion: 5 },
            records.main,
          );
      }

      await this.activate(this.catalog.activeId);
      this.publish();
    } catch (error) {
      this.fatal = DocumentErrors.messageOf(error);

      this.options.onState({
        phase: "error",
        loaded: false,
        writable: false,
        readOnly: !this.lease?.acquired,
        canImport: false,
        importing: false,
        hasPrevious: false,
        canReconnect: true,
        hasRawCopy: this.raw.exists,
        message: this.fatal,
      });

      this.publish();
    }
  }

  private async activate(id: string) {
    if (!this.lease) throw new Error("Блокировка досок недоступна.");

    const session = this.options.session(
      id,
      {
        ...this.lease,

        release: async () => {},
      },
      {
        snapshot: this.options.snapshot,
        onHydrate: this.options.onHydrate,

        onState: (state) => {
          if (this.active === session && !this.disposed)
            this.options.onState({
              ...state,
              writable: !this.busy && !this.fatal && state.writable,
              canImport: !this.busy && !this.fatal && state.canImport,
            });
        },
      },
    );

    this.active = session;
    await session.start();

    if (!session.state.loaded)
      throw new Error(session.state.message || "Доска не загрузилась.");
  }

  private requireWritable() {
    if (!this.canWrite || !this.repository)
      throw new Error("Изменение списка досок сейчас недоступно.");
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

  private async load(id: string) {
    const record = await this.repository!.board(id);

    if (!record.exists)
      throw new Error(
        "Доска отсутствует в хранилище. Текущие записи сохранены.",
      );

    const document = DocumentCodec.decodeDocument(record.value);

    await this.options.preflight?.(document, this.validationAbort.signal);

    if (this.disposed) throw new Error("Переключение доски отменено.");

    return document;
  }

  private async transition(
    catalog: BoardCatalog,
    change?: Parameters<LibraryRepository["update"]>[1],
  ) {
    await this.active!.flushOrThrow();
    await this.load(catalog.activeId);
    await this.repository!.update(catalog, change);
    await this.active!.dispose();

    if (this.disposed) return;

    this.catalog = catalog;
    await this.activate(catalog.activeId);
  }

  async switchBoard(id: string) {
    if (id === this.catalog.activeId) return;

    if (!this.catalog.boards.some((b) => b.id === id))
      throw new Error("Доска не найдена.");

    await this.run(() => this.transition({ ...this.catalog, activeId: id }));
  }

  async createBoard(value: string) {
    const title = LibraryCatalog.title(value);

    if (this.catalog.boards.length >= 100)
      throw new Error("В библиотеке допускается не более 100 досок.");

    const id = this.options.id();

    await this.run(async () => {
      if (this.catalog.boards.some((b) => b.id === id))
        throw new Error("Не удалось создать уникальный идентификатор доски.");

      await this.active!.flushOrThrow();

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

      await this.active!.dispose();

      if (this.disposed) return;

      this.catalog = catalog;
      await this.activate(id);
    });
  }

  async renameBoard(id: string, value: string) {
    const title = LibraryCatalog.title(value);

    await this.run(async () => {
      if (!this.catalog.boards.some((b) => b.id === id))
        throw new Error("Доска не найдена.");

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
      throw new Error("Недопустимое оформление доски.");

    const captured = { color: appearance.color, icon: appearance.icon };

    await this.run(async () => {
      if (!this.catalog.boards.some((board) => board.id === id))
        throw new Error("Доска не найдена.");

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
      throw new Error("Последнюю доску удалить нельзя.");

    if (!this.catalog.boards.some((b) => b.id === id))
      throw new Error("Доска не найдена.");

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
      Promise.reject(new Error("Доска не загружена."))
    );
  }

  retrySave() {
    return this.active?.retrySave() ?? Promise.resolve();
  }

  replace(document: BoardDocument, isBusy: () => boolean) {
    if (!this.canImport)
      return Promise.reject(new Error("Замена доски недоступна."));

    return this.active!.replace(document, isBusy);
  }

  dispose() {
    if (this.closing) return this.closing;

    this.disposed = true;
    this.validationAbort.abort();

    this.closing = (async () => {
      await this.startup?.catch(() => {});
      await this.operation.catch(() => {});
      await this.active?.dispose();
      await this.repository?.close();
      await this.lease?.release();
    })();

    return this.closing;
  }
}
