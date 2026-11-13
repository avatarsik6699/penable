import type {
  InputDiagnostics,
  SelectionState,
  SurfaceControls,
} from "./types";
import {
  type BoardSnapshot,
  type BackgroundMode,
  type DrawingTool,
  type HistoryState,
  type SelectionClipboard,
  type SelectionShape,
  BoardStabilization,
} from "~/entities/board";
import {
  DocumentSnapshots,
  DocumentSession,
  type BoardDocument,
  type StorageState,
  DocumentErrors,
  DocumentCodec,
} from "~/features/board-document";

type WorkspaceState = Readonly<{
  selectionShape: SelectionShape;
  selection: Readonly<SelectionState>;
  tool: DrawingTool;
  width: number;
  stabilization: number;
  background: BackgroundMode;
  history: Readonly<HistoryState>;
  storage: Readonly<StorageState>;
  diagnostics: Readonly<InputDiagnostics>;
  generation: number;
  hasBoard: boolean;
  unavailable: string;
  dialogOpen: boolean;
  uiRevision: number;
}>;

export type WorkspaceDependencies = {
  diagnostics: InputDiagnostics;
  session: (options: {
    snapshot: () => BoardSnapshot;
    onHydrate: (board: BoardSnapshot) => void;
    onState: (state: StorageState) => void;
  }) => DocumentSession;
  download: (json: string, name: string) => void;
};

// One tab owns the durable session, clipboard and coarse UI projection. Editor
// generations own their scene/renderer and may be replaced without releasing either.
export class WorkspaceModel {
  readonly controls = { current: null as SurfaceControls | null };
  readonly clipboard: SelectionClipboard = { strokes: [] };
  private initialBoard: BoardSnapshot | null = null;
  private session: DocumentSession | null = null;
  private listeners = new Set<() => void>();
  private priorDisposal: Promise<void> = Promise.resolve();
  private lifetime: {
    active: boolean;
    session: DocumentSession;
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
      unavailable: "",
      dialogOpen: false,
      uiRevision: 0,
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

      onHydrate: (board) => {
        if (!lifetime.active || this.session !== session) return;

        this.controls.current?.cancelInput();
        this.controls.current = null;
        this.initialBoard = board;

        this.patch({
          hasBoard: true,
          tool: "pen",
          selectionShape: "rectangle",
          width: board.tools.width,
          stabilization: BoardStabilization.normalizeStrength(
            board.tools.stabilization,
          ),
          background: board.background,
          unavailable: "",
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
