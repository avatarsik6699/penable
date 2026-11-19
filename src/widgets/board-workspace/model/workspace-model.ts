import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type {
  WorkspaceState,
  WorkspaceDependencies,
} from "./workspace-model.types";
import type {
  InputDiagnostics,
  SelectionState,
  SurfaceControls,
  TextEditHandle,
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
  BoardWriting,
  type InkInstrument,
  type InstrumentSettings,
} from "~/entities/board";
import {
  DocumentSnapshots,
  LibraryCatalog,
  type DocumentSession,
  type BoardLibrarySession,
  type BoardDocument,
  type ImportCandidate,
  type BoardAppearance,
  DocumentErrors,
  DocumentCodec,
} from "~/features/board-document";

const loadingStorage: WorkspaceState["storage"] = Object.freeze({
  phase: "loading",
  loaded: false,
  writable: false,
  readOnly: true,
  canImport: false,
  importing: false,
  hasPrevious: false,
  canReconnect: false,
  message: "",
});

// One tab owns the durable session, clipboard and coarse UI projection. Editor
// generations own their scene/renderer and may be replaced without releasing either.
export class WorkspaceModel {
  readonly controls = { current: null as SurfaceControls | null };
  readonly clipboard: SelectionClipboard = { strokes: [] };
  private textEditor: TextEditHandle | null = null;
  private exportOperation: AbortController | null = null;
  private recoveryOperation: AbortController | null = null;
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
      fingerInput: false,
      writing: BoardWriting.defaults(),
      width: 3,
      stabilization: 65,
      background: "blank",
      backgroundSettings: Object.freeze({ contrast: 45, spacing: 24 }),
      lastWritingView: null,
      history: Object.freeze({ canUndo: false, canRedo: false, busy: false }),
      storage: loadingStorage,
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
        boards: Object.freeze(
          LibraryCatalog.initial(dependencies.defaultBoardTitle).boards,
        ),
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

  readonly getFingerInput = () => this.state.fingerInput;

  readonly changeFingerInput = (value: boolean) => {
    if (!this.canWrite() || this.controls.current?.isBusy()) return;

    this.patch({ fingerInput: value });
  };

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
    if (!this.initialBoard)
      throw Messages.error(Messages.create("boardIsNotLoadedYet"));

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
        width: this.state.writing.instruments.pen.width,
        stabilization: this.state.writing.instruments.pen.stabilization,
        writing: BoardWriting.clone(this.state.writing),
      },
    };
  };

  readonly canWrite = () =>
    Boolean(
      this.lifetime?.active &&
      this.session?.canWrite &&
      this.controls.current &&
      !this.state.dialogOpen,
    );

  readonly getTool = () => this.state.tool;

  readonly interactionsBlocked = () =>
    this.state.dialogOpen || this.textEditor !== null;

  readonly readTextEditor = () => this.textEditor;

  readonly beginTextEdit = () => {
    if (this.interactionsBlocked()) return;

    const edit = this.controls.current?.beginTextEdit?.();

    if (!edit) return;

    this.textEditor = edit;
    this.overlayChanged();
  };

  readonly endTextEdit = () => {
    if (!this.textEditor) return;

    this.textEditor = null;
    this.overlayChanged();
  };

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

  readonly unavailable = (unavailable: MessageTypes.Value) => {
    if (unavailable) this.textEditor = null;

    this.patch({ unavailable });
  };

  readonly overlayChanged = () =>
    this.patch({ uiRevision: this.state.uiRevision + 1 });

  readonly cancelActiveInput = () => {
    if (this.controls.current?.isBusy()) this.controls.current.cancelInput();
  };

  private hydrate(board: BoardSnapshot | null) {
    this.textEditor = null;
    this.exportOperation?.abort();
    this.controls.current?.cancelInput();
    this.controls.current = null;
    this.initialBoard = board;

    if (!board) {
      this.patch({
        hasBoard: false,
        hasInk: false,
        lastWritingView: null,
        unavailable: "",
        navigationMessage: "",
        history: Object.freeze({ canUndo: false, canRedo: false, busy: false }),
      });

      return;
    }

    const writing = BoardWriting.clone(
      board.tools.writing ??
        BoardWriting.defaults(board.tools.width, board.tools.stabilization),
    );

    const activeInstrument = writing.instruments[writing.instrument];

    this.patch({
      hasBoard: true,
      hasInk: board.strokes.length > 0,
      tool: "pen",
      selectionShape: "rectangle",
      writing,
      width: activeInstrument.width,
      stabilization: BoardStabilization.normalizeStrength(
        activeInstrument.stabilization,
      ),
      background: board.background,
      backgroundSettings: Object.freeze({
        ...(board.backgroundSettings ?? { contrast: 45, spacing: 24 }),
      }),
      lastWritingView: board.lastWritingView ?? null,
      unavailable: "",
      navigationMessage: "",
      history: Object.freeze({ canUndo: false, canRedo: false, busy: false }),
      generation: this.state.generation + 1,
    });
  }

  start(): () => void {
    const current = () => lifetime.active && this.session === session;

    const session = this.dependencies.session({
      snapshot: this.readBoardSnapshot,

      onLibrary: (library) => {
        if (current()) this.patch({ library });
      },

      onHydrate: (board) => {
        if (current()) this.hydrate(board);
      },

      onRecoveryPreview: (board) => {
        if (current()) this.hydrate(board);
      },

      onState: (state) => {
        if (!current()) return;

        if (!state.writable) {
          this.textEditor = null;
          this.controls.current?.cancelInput();
        }

        this.patch({ storage: Object.freeze({ ...state }) });
      },
    });

    const lifetime = { active: true, session, starting: Promise.resolve() };

    this.lifetime = lifetime;
    this.session = session;

    this.patch({
      storage: loadingStorage,
      library: Object.freeze({ ...this.state.library, recovery: undefined }),
    });

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
    this.exportOperation?.abort();
    this.recoveryOperation?.abort();

    this.priorDisposal = Promise.allSettled([
      lifetime.starting,
      lifetime.session.dispose(),
    ]).then(() => {});
  }

  readonly switchBoard = (id: string) =>
    this.libraryAction((session) => session.switchBoard(id));

  readonly previewBoard = (id: string) => {
    if (this.lifetime?.active && this.session && "previewBoard" in this.session)
      void this.session.previewBoard(id);
  };

  readonly closePreview = () => {
    if (this.session && "closePreview" in this.session)
      this.session.closePreview();
  };

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
      this.textEditor ||
      this.controls.current?.isBusy()
    )
      throw Messages.error(Messages.create("finishTheBoardAction"));

    this.controls.current?.cancelInput();
    await action(this.session);
  }

  readonly flush = () => this.session?.flush();

  readonly hasUnsaved = () => this.session?.hasUnsaved ?? false;

  readonly changeTool = (tool: DrawingTool) => {
    if (
      this.interactionsBlocked() ||
      !this.state.hasBoard ||
      this.state.unavailable ||
      this.controls.current?.isBusy() ||
      (tool !== "selection" && !this.canWrite())
    )
      return;

    this.controls.current?.cancelInput();

    if (tool !== "selection") this.controls.current?.selection("clear");

    this.patch({ tool });
  };

  readonly changeInstrument = (instrument: InkInstrument) => {
    if (
      !this.canWrite() ||
      this.controls.current?.isBusy() ||
      !BoardWriting.isInstrument(instrument)
    )
      return;

    this.controls.current?.cancelInput();
    this.controls.current?.selection("clear");

    const writing = { ...this.state.writing, instrument };
    const settings = writing.instruments[instrument];

    this.patch({
      writing,
      tool: "pen",
      width: settings.width,
      stabilization: settings.stabilization,
    });

    this.documentChanged(false);
  };

  readonly changeInkSettings = (patch: Partial<InstrumentSettings>) => {
    if (!this.canWrite()) return;

    const instrument = this.state.writing.instrument;

    const settings = {
      ...this.state.writing.instruments[instrument],
      ...patch,
    };

    if (!BoardWriting.validSettings(settings, instrument)) return;

    this.patch({
      writing: {
        ...this.state.writing,
        instruments: {
          ...this.state.writing.instruments,
          [instrument]: settings,
        },
      },
      width: settings.width,
      stabilization: settings.stabilization,
    });

    this.documentChanged(false);
  };

  readonly changeWidth = (width: number) => this.changeInkSettings({ width });

  readonly changeStabilization = (stabilization: number) =>
    this.changeInkSettings({ stabilization });

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

  readonly navigationNoticeChanged = (navigationMessage: MessageTypes.Value) =>
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
      return Messages.create("finishWritingErasingOrMovingContentBefore");

    this.controls.current?.cancelInput();
    this.patch({ dialogOpen: true });

    return "";
  };

  readonly endImport = () => this.patch({ dialogOpen: false });

  readonly confirmImport = async (
    candidate: BoardDocument | ImportCandidate,
  ) => {
    if (!this.session)
      throw Messages.error(Messages.create("storageIsNotOpenYet"));

    if ("summary" in candidate)
      await this.session.replaceCandidate(
        candidate,
        () => this.controls.current?.isBusy() ?? false,
      );
    else
      await this.session.replace(
        candidate,
        () => this.controls.current?.isBusy() ?? false,
      );
  };

  readonly exportCurrent = async () => {
    this.exportOperation?.abort();

    const operation = new AbortController();

    this.exportOperation = operation;

    try {
      const result = await this.dependencies.exportDocument(
        DocumentSnapshots.fromSnapshot(this.readBoardSnapshot()),
        operation.signal,
      );

      if (operation.signal.aborted) return Messages.create("actionCancelled");

      this.dependencies.download(result.contents, "penable-board.json");

      return (
        result.warning || Messages.create("copySentToTheBrowserForDownload")
      );
    } catch (error) {
      return DocumentErrors.messageOf(error);
    } finally {
      if (this.exportOperation === operation) this.exportOperation = null;
    }
  };

  private exportRecord(
    record: import("~/features/board-document").StoredRecord | undefined,
    name: string,
    success: MessageTypes.Value = Messages.create(
      "copySentToTheBrowserCheckThe",
    ),
  ): MessageTypes.Value | Promise<MessageTypes.Value> {
    try {
      if (!record?.exists)
        throw Messages.error(Messages.create("noOriginalCopyYet"));

      if (!this.dependencies.exportRecord) {
        this.dependencies.download(
          DocumentCodec.serializeRawBackup(record.value),
          name,
        );

        return success;
      }

      const generation = this.state.generation,
        session = this.session;

      this.recoveryOperation?.abort();

      const operation = new AbortController();

      this.recoveryOperation = operation;

      return this.dependencies
        .exportRecord(record.value, operation.signal)
        .then((contents) => {
          if (
            operation.signal.aborted ||
            this.state.generation !== generation ||
            this.session !== session ||
            !this.lifetime?.active
          )
            return Messages.create("actionCancelled");

          this.dependencies.download(contents, name);

          return success;
        })
        .catch(DocumentErrors.messageOf)
        .finally(() => {
          if (this.recoveryOperation === operation)
            this.recoveryOperation = null;
        });
    } catch (error) {
      return DocumentErrors.messageOf(error);
    }
  }

  readonly exportPrevious = () =>
    this.exportRecord(
      this.session?.previousRecord,
      "penable-before-import.json",
      Messages.create("copyBeforeReplacementSentToTheBrowser"),
    );

  readonly exportUpgrade = () =>
    this.exportRecord(
      this.session?.upgradeRecord,
      "penable-before-schema2.json",
      Messages.create("copyBeforeUpdateSentToTheBrowser"),
    );

  readonly exportSchema3 = () =>
    this.exportRecord(
      this.session?.schema3Record,
      "penable-before-schema3.json",
      Messages.create("copyBeforeUpdateSentToTheBrowser"),
    );

  readonly exportSchema6 = () =>
    this.exportRecord(
      this.session?.schema6Record,
      "penable-before-schema6.json",
      Messages.create("copyBeforeUpdateSentToTheBrowser"),
    );

  readonly exportSchema5 = () =>
    this.exportRecord(
      this.session?.schema5Record,
      "penable-before-schema5.json",
    );

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
    const session = this.session;

    if (!session) return;

    const state = session.state;

    if (state.writable) {
      void session.retrySave();

      return;
    }

    if (state.canReconnect) {
      this.closePreview();

      if (this.initialBoard) this.hydrate(null);

      this.stop();
      this.start();
    }
  };
}

export type { WorkspaceDependencies } from "./workspace-model.types";
