import styles from "./board-workspace.module.css";
import type React from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DocumentBindings, StoragePanel } from "~/features/board-document";
import { WorkspacePlatform } from "../native/workspace-platform";
import { PenToolbar } from "./pen-toolbar";
import { SelectionToolbar } from "./selection-toolbar";
import { WritingSurface } from "./writing-surface";
import type { BoardWorkspaceTypes } from "./board-workspace.types";

export const BoardWorkspace: React.FC<BoardWorkspaceTypes.Props> = () => {
  const [model] = useState(WorkspacePlatform.create);
  const ui = useSyncExternalStore(model.subscribe, model.getSnapshot);

  useEffect(
    function documentSessionFx() {
      const stop = model.start();
      const unbind = DocumentBindings.bind(model);

      return () => {
        unbind();
        stop();
      };
    },
    [model],
  );

  return (
    <main className={styles["app"]}>
      <PenToolbar
        tool={ui.tool}
        onToolChange={model.changeTool}
        width={ui.width}
        onWidthChange={model.changeWidth}
        diagnostics={ui.diagnostics}
        stabilization={ui.stabilization}
        onStabilizationChange={model.changeStabilization}
        background={ui.background}
        onBackgroundChange={model.changeBackground}
        historyState={ui.history}
        readOnly={
          !ui.storage.writable ||
          ui.dialogOpen ||
          !ui.hasBoard ||
          Boolean(ui.unavailable)
        }
        onUndo={() => model.controls.current?.undo()}
        onRedo={() => model.controls.current?.redo()}
        onZoomIn={() => model.controls.current?.zoomIn()}
        onZoomOut={() => model.controls.current?.zoomOut()}
        onResetView={() => model.controls.current?.reset()}
        onFitAll={() => model.controls.current?.fitAll()}
        selectionDisabled={
          ui.dialogOpen || !ui.hasBoard || Boolean(ui.unavailable)
        }
      />
      <StoragePanel
        state={ui.storage}
        hasDocument={Boolean(ui.hasBoard)}
        busy={ui.history.busy}
        onExport={model.exportCurrent}
        onUpgrade={model.exportUpgrade}
        onOverlayChange={model.overlayChanged}
        onPrevious={model.exportPrevious}
        onRetry={model.retry}
        onBeginImport={model.beginImport}
        onEndImport={model.endImport}
        onConfirm={model.confirmImport}
      />
      <div className={styles["board-stage"]}>
        {ui.tool === "selection" && ui.hasBoard && !ui.unavailable && (
          <SelectionToolbar
            state={ui.selection}
            shape={ui.selectionShape}
            onOverlayChange={model.overlayChanged}
            onCancelActiveInput={model.cancelActiveInput}
            readOnly={!ui.storage.writable}
            blocked={ui.dialogOpen || (ui.history.busy && !ui.selection.busy)}
            onShape={model.changeShape}
            onCommand={(command) => model.controls.current?.selection(command)}
          />
        )}
        {!ui.hasBoard ? (
          <div className={styles["load-state"]} role="status">
            {ui.storage.phase === "loading"
              ? "Загрузка доски…"
              : "Доска не загружена. Повторите подключение или восстановите её из копии."}
          </div>
        ) : ui.unavailable ? (
          <div className={styles["capability-error"]} role="alert">
            <h2>Не удалось открыть лист</h2>
            <p>
              {ui.unavailable} Откройте страницу в актуальной версии Chrome или
              Edge.
            </p>
          </div>
        ) : (
          <WritingSurface
            key={ui.generation}
            initialDocument={model.readInitialBoard()}
            clipboard={model.clipboard}
            onSelectionState={model.selectionChanged}
            onActivateSelection={model.activateSelection}
            tool={ui.tool}
            getTool={model.getTool}
            width={ui.width}
            stabilization={ui.stabilization}
            background={ui.background}
            canWrite={model.canWrite}
            modalOpen={ui.dialogOpen}
            uiRevision={ui.uiRevision}
            interactionsBlocked={model.interactionsBlocked}
            onDocumentChange={model.documentChanged}
            onHistoryState={model.historyChanged}
            controlsRef={model.controls}
            onDiagnostics={model.diagnosticsChanged}
            onUnavailable={model.unavailable}
          />
        )}
      </div>
    </main>
  );
};
