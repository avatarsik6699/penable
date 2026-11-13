import { useBoardWorkspace } from "./hooks/use-board-workspace";
import styles from "./board-workspace.module.css";
import type React from "react";
import { StoragePanel } from "~/features/board-document";
import { PenToolbar } from "./components/pen-toolbar";
import { SelectionToolbar } from "./components/selection-toolbar";
import { WritingSurface } from "./components/writing-surface";
import type { BoardWorkspaceTypes } from "./board-workspace.types";

export const BoardWorkspace: React.FC<BoardWorkspaceTypes.Props> = () => {
  const workspace = useBoardWorkspace();

  return (
    <main className={styles["app"]}>
      <PenToolbar
        tool={workspace.ui.tool}
        onToolChange={workspace.model.changeTool}
        width={workspace.ui.width}
        onWidthChange={workspace.model.changeWidth}
        diagnostics={workspace.ui.diagnostics}
        stabilization={workspace.ui.stabilization}
        onStabilizationChange={workspace.model.changeStabilization}
        background={workspace.ui.background}
        onBackgroundChange={workspace.model.changeBackground}
        historyState={workspace.ui.history}
        readOnly={
          !workspace.ui.storage.writable ||
          workspace.ui.dialogOpen ||
          !workspace.ui.hasBoard ||
          Boolean(workspace.ui.unavailable)
        }
        onUndo={() => workspace.model.controls.current?.undo()}
        onRedo={() => workspace.model.controls.current?.redo()}
        onZoomIn={() => workspace.model.controls.current?.zoomIn()}
        onZoomOut={() => workspace.model.controls.current?.zoomOut()}
        onResetView={() => workspace.model.controls.current?.reset()}
        onFitAll={() => workspace.model.controls.current?.fitAll()}
        selectionDisabled={
          workspace.ui.dialogOpen ||
          !workspace.ui.hasBoard ||
          Boolean(workspace.ui.unavailable)
        }
      />
      <StoragePanel
        state={workspace.ui.storage}
        hasDocument={Boolean(workspace.ui.hasBoard)}
        busy={workspace.ui.history.busy}
        onExport={workspace.model.exportCurrent}
        onUpgrade={workspace.model.exportUpgrade}
        onOverlayChange={workspace.model.overlayChanged}
        onPrevious={workspace.model.exportPrevious}
        onRetry={workspace.model.retry}
        onBeginImport={workspace.model.beginImport}
        onEndImport={workspace.model.endImport}
        onConfirm={workspace.model.confirmImport}
      />
      <div className={styles["board-stage"]}>
        {workspace.ui.tool === "selection" &&
          workspace.ui.hasBoard &&
          !workspace.ui.unavailable && (
            <SelectionToolbar
              state={workspace.ui.selection}
              shape={workspace.ui.selectionShape}
              onOverlayChange={workspace.model.overlayChanged}
              onCancelActiveInput={workspace.model.cancelActiveInput}
              readOnly={!workspace.ui.storage.writable}
              blocked={
                workspace.ui.dialogOpen ||
                (workspace.ui.history.busy && !workspace.ui.selection.busy)
              }
              onShape={workspace.model.changeShape}
              onCommand={(command) =>
                workspace.model.controls.current?.selection(command)
              }
            />
          )}
        {!workspace.ui.hasBoard ? (
          <div className={styles["load-state"]} role="status">
            {workspace.ui.storage.phase === "loading"
              ? "Загрузка доски…"
              : "Доска не загружена. Повторите подключение или восстановите её из копии."}
          </div>
        ) : workspace.ui.unavailable ? (
          <div className={styles["capability-error"]} role="alert">
            <h2>Не удалось открыть лист</h2>
            <p>
              {workspace.ui.unavailable} Откройте страницу в актуальной версии
              Chrome или Edge.
            </p>
          </div>
        ) : (
          <WritingSurface
            key={workspace.ui.generation}
            initialDocument={workspace.model.readInitialBoard()}
            clipboard={workspace.model.clipboard}
            onSelectionState={workspace.model.selectionChanged}
            onActivateSelection={workspace.model.activateSelection}
            tool={workspace.ui.tool}
            getTool={workspace.model.getTool}
            width={workspace.ui.width}
            stabilization={workspace.ui.stabilization}
            background={workspace.ui.background}
            canWrite={workspace.model.canWrite}
            modalOpen={workspace.ui.dialogOpen}
            uiRevision={workspace.ui.uiRevision}
            interactionsBlocked={workspace.model.interactionsBlocked}
            onDocumentChange={workspace.model.documentChanged}
            onHistoryState={workspace.model.historyChanged}
            controlsRef={workspace.model.controls}
            onDiagnostics={workspace.model.diagnosticsChanged}
            onUnavailable={workspace.model.unavailable}
          />
        )}
      </div>
    </main>
  );
};
