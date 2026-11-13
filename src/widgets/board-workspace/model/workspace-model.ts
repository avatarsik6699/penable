import type {
  WorkspaceState,
  WorkspaceDependencies,
} from "./workspace-model.types";
import type {
  InputDiagnostics,
  SelectionState,
  SurfaceControls,
} from "./workspace-model.types";
import {
  type BoardSnapshot,
  type BackgroundSettings,
  type WritingView,
  type BackgroundMode,
  type DrawingTool,
  type HistoryState,
  type SelectionClipboard,
  type SelectionShape,
  BoardStabilization,
} from "~/entities/board";
import {
  DocumentSnapshots,
  LibraryCatalog,
  type DocumentSession,
  type BoardLibrarySession,
  type BoardDocument,
  type BoardAppearance,
  DocumentErrors,
  DocumentCodec,
} from "~/features/board-document";

// One tab owns the durable session, clipboard and coarse UI projection. Editor
// generations own their scene/renderer and may be replaced without releasing either.
export class WorkspaceModel {
  readonly controls = { current: null as SurfaceControls | null };
  readonly clipboard: SelectionClipboard = { strokes: [] };
  private initialBoard: BoardSnapshot | null = null;
  private session: DocumentSession | BoardLibrarySession | null = null;
  private listeners = new Set<() => void>();
  private priorDisposal: Promise<void> = Promise.resolve();
  private lifetime: {
    active: boolean;
    session: DocumentSession | BoardLibrarySession;
    starting: Promise<void>;
  } | null = null;
  private state: WorkspaceState;

  constructor(private readonly dependencies: WorkspaceDependencies) {
    this.state = Object.freeze({
      selectionShape: "rectangle",
      selection: Object.freeze({
        selected: false,
        clipboard: false,
        busy: false,
        message: "",
        png: false,
      }),
      tool: "pen",
      width: 3,
      stabilization: 65,
      background: "blank",
      backgroundSettings: Object.freeze({ contrast: 45, spacing: 24 }),
      lastWritingView: null,
      history: Object.freeze({ canUndo: false, canRedo: false, busy: false }),
      storage: Object.freeze({
        phase: "loading",
        loaded: false,
        writable: false,
        readOnly: true,
        canImport: false,
        importing: false,
        hasPrevious: false,
        canReconnect: false,
        message: "",
      }),
      diagnostics: Object.freeze(dependencies.diagnostics),
      generation: 0,
      hasBoard: false,
      hasInk: false,
      unavailable: "",
      dialogOpen: false,
      uiRevision: 0,
      navigationMessage: "",
      library: Object.freeze({
        activeId: "main",
        boards: Object.freeze(LibraryCatalog.initial().boards),
        busy: false,
        message: "",
      }),
    });
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): WorkspaceState => this.state;

  private patch(patch: Partial<WorkspaceState>) {
    if (
      Object.entries(patch).every(
        ([key, value]) => this.state[key as keyof WorkspaceState] === value,
      )
    )
      return;

    this.state = Object.freeze({ ...this.state, ...patch });

    for (const listener of this.listeners) listener();
  }

  readInitialBoard(): BoardSnapshot {
    if (!this.initialBoard) throw new Error("Доска ещё не загружена.");

    return this.initialBoard;
  }

  readonly readBoardSnapshot = (): BoardSnapshot => {
    const initial = this.readInitialBoard(),
      scene = this.controls.current?.snapshot();

    return {
      strokes: scene?.strokes ?? initial.strokes,
      viewport: { ...(scene?.viewport ?? initial.viewport) },
      background: this.state.background,
      backgroundSettings: { ...this.state.backgroundSettings },
      lastWritingView: this.state.lastWritingView
        ? {
            center: { ...this.state.lastWritingView.center },
            zoom: this.state.lastWritingView.zoom,
          }
        : null,
      tools: {
        width: this.state.width,
        stabilization: this.state.stabilization,
      },
    };
  };

  readonly canWrite = () =>
    Boolean(
      this.session?.canWrite && this.controls.current && !this.state.dialogOpen,
    );

  readonly getTool = () => this.state.tool;

  readonly interactionsBlocked = () => this.state.dialogOpen;

  readonly documentChanged = (urgent: boolean) => {
    this.session?.changed(urgent);
  };

  readonly activateSelection = () => this.patch({ tool: "selection" });

  readonly selectionChanged = (state: SelectionState) =>
    this.patch({ selection: Object.freeze({ ...state }) });

  readonly historyChanged = (state: HistoryState) =>
    this.patch({ history: Object.freeze({ ...state }) });

  readonly diagnosticsChanged = (state: InputDiagnostics) =>
    this.patch({ diagnostics: Object.freeze({ ...state }) });

  readonly unavailable = (unavailable: string) => this.patch({ unavailable });

  readonly overlayChanged = () =>
    this.patch({ uiRevision: this.state.uiRevision + 1 });

  readonly cancelActiveInput = () => {
    if (this.controls.current?.isBusy()) this.controls.current.cancelInput();
  };

  start(): () => void {
    const session = this.dependencies.session({
      snapshot: this.readBoardSnapshot,
      onLibrary: (library) => this.patch({ library }),

      onHydrate: (board) => {
        if (!lifetime.active || this.session !== session) return;

        this.controls.current?.cancelInput();
        this.controls.current = null;
        this.initialBoard = board;

        this.patch({
          hasBoard: true,
          hasInk: board.strokes.length > 0,
          tool: "pen",
          selectionShape: "rectangle",
          width: board.tools.width,
          stabilization: BoardStabilization.normalizeStrength(
            board.tools.stabilization,
          ),
          background: board.background,
          backgroundSettings: Object.freeze({
            ...(board.backgroundSettings ?? { contrast: 45, spacing: 24 }),
          }),
          lastWritingView: board.lastWritingView ?? null,
          unavailable: "",
          navigationMessage: "",
          history: Object.freeze({
            canUndo: false,
            canRedo: false,
            busy: false,
          }),
          generation: this.state.generation + 1,
        });
      },

      onState: (state) => {
        if (!lifetime.active || this.session !== session) return;

        if (!state.writable) this.controls.current?.cancelInput();

        this.patch({ storage: Object.freeze({ ...state }) });
      },
    });

    const lifetime = { active: true, session, starting: Promise.resolve() };

    this.lifetime = lifetime;
    this.session = session;

    lifetime.starting = this.priorDisposal.then(async () => {
      if (lifetime.active) await session.start();
    });

    return () => {
      this.stop();
    };
  }

  private stop(lifetime = this.lifetime) {
    if (!lifetime?.active) return;

    lifetime.active = false;

    this.priorDisposal = Promise.allSettled([
      lifetime.starting,
      lifetime.session.dispose(),
    ]).then(() => {});
  }

  readonly switchBoard = (id: string) =>
    this.libraryAction((session) => session.switchBoard(id));

  readonly createBoard = (title: string) =>
    this.libraryAction((session) => session.createBoard(title));

  readonly renameBoard = (id: string, title: string) =>
    this.libraryAction((session) => session.renameBoard(id, title));

  readonly setBoardAppearance = (id: string, appearance: BoardAppearance) =>
    this.libraryAction((session) => session.setBoardAppearance(id, appearance));

  readonly deleteBoard = (id: string) =>
    this.libraryAction((session) => session.deleteBoard(id), true);

  readonly libraryModalChanged = (dialogOpen: boolean) => {
    this.controls.current?.cancelInput();
    this.patch({ dialogOpen });
  };

  private async libraryAction(
    action: (session: BoardLibrarySession) => Promise<void>,
    allowModal = false,
  ) {
    if (
      !this.session ||
      !("switchBoard" in this.session) ||
      (this.state.dialogOpen && !allowModal) ||
      this.controls.current?.isBusy()
    )
      throw new Error("Завершите действие на доске.");

    this.controls.current?.cancelInput();
    await action(this.session);
  }

  readonly flush = () => this.session?.flush();

  readonly hasUnsaved = () => this.session?.hasUnsaved ?? false;

  readonly changeTool = (tool: DrawingTool) => {
    if (
      this.state.dialogOpen ||
      !this.state.hasBoard ||
      this.state.unavailable ||
      this.controls.current?.isBusy() ||
      (tool !== "selection" && !this.canWrite())
    )
      return;

    if (tool !== "selection") this.controls.current?.selection("clear");

    this.patch({ tool });
  };

  readonly changeWidth = (width: number) => {
    if (this.canWrite()) {
      this.patch({ width });
      this.documentChanged(false);
    }
  };

  readonly changeStabilization = (stabilization: number) => {
    if (this.canWrite()) {
      this.patch({ stabilization });
      this.documentChanged(false);
    }
  };

  readonly changeBackground = (background: BackgroundMode) => {
    if (this.canWrite()) {
      this.patch({ background });
      this.documentChanged(false);
    }
  };

  readonly changeBackgroundSettings = (
    backgroundSettings: BackgroundSettings,
  ) => {
    if (!this.canWrite() || this.controls.current?.isBusy()) return;

    if (
      !Number.isInteger(backgroundSettings.contrast) ||
      backgroundSettings.contrast < 0 ||
      backgroundSettings.contrast > 100 ||
      !Number.isInteger(backgroundSettings.spacing) ||
      backgroundSettings.spacing < 12 ||
      backgroundSettings.spacing > 64 ||
      backgroundSettings.spacing % 2 !== 0
    )
      return;

    this.patch({
      backgroundSettings: Object.freeze({ ...backgroundSettings }),
    });

    this.documentChanged(false);
  };

  readonly navigationNoticeChanged = (navigationMessage: string) =>
    this.patch({ navigationMessage });

  readonly scenePresenceChanged = (hasInk: boolean) => this.patch({ hasInk });

  readonly writingCommitted = (lastWritingView: WritingView) => {
    if (!this.canWrite()) return;

    this.patch({
      lastWritingView: {
        center: { ...lastWritingView.center },
        zoom: lastWritingView.zoom,
      },
    });
  };

  readonly changeShape = (selectionShape: SelectionShape) => {
    this.controls.current?.selectionShape(selectionShape);
    this.patch({ selectionShape });
  };

  readonly beginImport = () => {
    if (!this.session?.canImport || this.controls.current?.isBusy())
      return "Завершите письмо, стирание или перемещение перед импортом.";

    this.controls.current?.cancelInput();
    this.patch({ dialogOpen: true });

    return "";
  };

  readonly endImport = () => this.patch({ dialogOpen: false });

  readonly confirmImport = async (candidate: BoardDocument) => {
    if (!this.session) throw new Error("Хранилище ещё не открыто.");

    await this.session.replace(
      candidate,
      () => this.controls.current?.isBusy() ?? false,
    );
  };

  readonly exportCurrent = () => {
    try {
      const result = DocumentCodec.serializeDocument(
        DocumentSnapshots.fromSnapshot(this.readBoardSnapshot()),
      );

      this.dependencies.download(result.json, "penable-board.json");

      return (
        result.warning ||
        "Копия передана браузеру для скачивания. Проверьте файл в загрузках."
      );
    } catch (error) {
      return DocumentErrors.messageOf(error);
    }
  };

  private backup(upgrade: boolean): string {
    try {
      const record = upgrade
        ? this.session?.upgradeRecord
        : this.session?.previousRecord;

      if (!record?.exists)
        throw new Error(
          upgrade
            ? "Копии до обновления пока нет."
            : "Копии до замены пока нет.",
        );

      this.dependencies.download(
        DocumentCodec.serializeRawBackup(record.value),
        upgrade ? "penable-before-schema2.json" : "penable-before-import.json",
      );

      return upgrade
        ? "Копия до обновления передана браузеру. Проверьте файл в загрузках."
        : "Копия до замены передана браузеру. Повреждённая исходная запись может не поддерживать обратный импорт.";
    } catch (error) {
      return DocumentErrors.messageOf(error);
    }
  }

  readonly exportPrevious = () => this.backup(false);

  readonly exportUpgrade = () => this.backup(true);

  readonly exportSchema3 = () => {
    try {
      const record = this.session?.schema3Record;

      if (!record?.exists) throw new Error("Копии до обновления пока нет.");

      this.dependencies.download(
        DocumentCodec.serializeRawBackup(record.value),
        "penable-before-schema3.json",
      );

      return "Копия до обновления передана браузеру. Проверьте файл в загрузках.";
    } catch (error) {
      return DocumentErrors.messageOf(error);
    }
  };

  private exportRecord(
    record: import("~/features/board-document").StoredRecord | undefined,
    name: string,
  ): string {
    try {
      if (!record?.exists) throw new Error("Исходной копии пока нет.");

      this.dependencies.download(
        DocumentCodec.serializeRawBackup(record.value),
        name,
      );

      return "Копия передана браузеру. Проверьте файл в загрузках.";
    } catch (error) {
      return DocumentErrors.messageOf(error);
    }
  }

  readonly exportSchema4 = () =>
    this.exportRecord(
      this.session?.schema4Record,
      "penable-before-schema4.json",
    );

  readonly exportLibrary = () =>
    this.exportRecord(
      this.session?.libraryRecord,
      "penable-before-library.json",
    );

  readonly exportRaw = () =>
    this.exportRecord(this.session?.rawRecord, "penable-original-record.json");

  readonly retry = () => {
    if (this.session?.canWrite) {
      void this.session.retrySave();

      return;
    }

    if (!this.session?.hasUnsaved && this.session?.state.canReconnect) {
      this.stop();
      this.start();
    }
  };
}

export type { WorkspaceDependencies } from "./workspace-model.types";
