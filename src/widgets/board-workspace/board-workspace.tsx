import type React from "react";
import { useBoardWorkspace } from "./hooks/use-board-workspace";
import styles from "./board-workspace.module.css";
import { StoragePanel, BoardLibrary } from "~/features/board-document";
import { PenToolbar } from "./components/pen-toolbar";
import { SelectionToolbar } from "./components/selection-toolbar";
import { WritingSurface } from "./components/writing-surface";
import { BackgroundControl } from "./components/background-control";
import { ViewportControls } from "./components/viewport-controls";
import { HelpControls } from "./components/help-controls";
import type { BoardWorkspaceTypes } from "./board-workspace.types";

export const BoardWorkspace: React.FC<BoardWorkspaceTypes.Props> = () => {
  const workspace = useBoardWorkspace();

  const unavailable =
    workspace.ui.dialogOpen ||
    !workspace.ui.hasBoard ||
    Boolean(workspace.ui.unavailable);

  const readOnly = !workspace.ui.storage.writable || unavailable;

  return (
    <main className={styles.app} aria-label="Личная доска">
      <div className={styles.brand} aria-label="penable">
        penable
        <span className={styles.brandDot} />
      </div>
      <PenToolbar
        leadingControls={
          <BoardLibrary
            state={workspace.ui.library}
            readOnly={readOnly}
            blocked={unavailable || workspace.ui.history.busy}
            open={workspace.panel === "library"}
            onOpenChange={(open) =>
              workspace.changePanel(open ? "library" : null)
            }
            onCreate={workspace.model.createBoard}
            onRename={workspace.model.renameBoard}
            onDelete={workspace.model.deleteBoard}
            onSwitch={workspace.model.switchBoard}
            onModalChange={workspace.model.libraryModalChanged}
          />
        }
        onInsertImage={() => {
          workspace.changePanel(null);
          workspace.model.controls.current?.insertImage?.();
        }}
        tool={workspace.ui.tool}
        onToolChange={workspace.changeTool}
        width={workspace.ui.width}
        onWidthChange={workspace.model.changeWidth}
        stabilization={workspace.ui.stabilization}
        onStabilizationChange={workspace.model.changeStabilization}
        historyState={workspace.ui.history}
        readOnly={readOnly}
        onUndo={() => workspace.model.controls.current?.undo()}
        onRedo={() => workspace.model.controls.current?.redo()}
        selectionDisabled={unavailable}
        penOpen={workspace.panel === "pen"}
        onPenOpenChange={(open) => workspace.changePanel(open ? "pen" : null)}
        trailingControls={
          <StoragePanel
            state={workspace.ui.storage}
            hasDocument={workspace.ui.hasBoard}
            busy={workspace.ui.history.busy}
            onExport={workspace.model.exportCurrent}
            onUpgrade={workspace.model.exportUpgrade}
            onOverlayChange={workspace.model.overlayChanged}
            onPrevious={workspace.model.exportPrevious}
            onSchema3={workspace.model.exportSchema3}
            onSchema4={workspace.model.exportSchema4}
            onLibrary={workspace.model.exportLibrary}
            onRaw={workspace.model.exportRaw}
            onRetry={workspace.model.retry}
            onBeginImport={workspace.model.beginImport}
            onEndImport={workspace.model.endImport}
            onConfirm={workspace.model.confirmImport}
            openPanel={
              workspace.panel === "board" || workspace.panel === "save"
                ? workspace.panel
                : null
            }
            onPanelChange={workspace.changePanel}
            backgroundControl={
              <BackgroundControl
                background={workspace.ui.background}
                settings={workspace.ui.backgroundSettings}
                onSettingsChange={workspace.model.changeBackgroundSettings}
                readOnly={readOnly || workspace.ui.history.busy}
                onBackgroundChange={workspace.model.changeBackground}
              />
            }
          />
        }
        selectionControls={
          workspace.ui.tool === "selection" &&
          workspace.ui.hasBoard &&
          !workspace.ui.unavailable ? (
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
              onTransform={(width, height, angle) =>
                workspace.model.controls.current?.transform?.(
                  width,
                  height,
                  angle,
                )
              }
              onShape={workspace.model.changeShape}
              onCommand={(command) =>
                workspace.model.controls.current?.selection(command)
              }
              open={workspace.panel === "selection"}
              onOpenChange={(open) =>
                workspace.changePanel(open ? "selection" : null)
              }
            />
          ) : null
        }
      />
      <ViewportControls
        onZoomOut={() => workspace.model.controls.current?.zoomOut()}
        onZoomIn={() => workspace.model.controls.current?.zoomIn()}
        onResetView={() => workspace.model.controls.current?.reset()}
        onReturnWriting={() =>
          workspace.model.controls.current?.returnToWriting?.()
        }
        navigationMessage={workspace.ui.navigationMessage}
        canReturnWriting={
          Boolean(workspace.ui.lastWritingView) && workspace.ui.hasInk
        }
        minimapOpen={workspace.minimapOpen}
        onMinimapToggle={() => workspace.changeMinimap(!workspace.minimapOpen)}
        bindMinimapTrigger={workspace.minimapPanel.bindTrigger}
        historyState={workspace.ui.history}
        diagnostics={workspace.ui.diagnostics}
        selectionDisabled={unavailable}
      />
      <HelpControls
        open={workspace.panel === "help"}
        onOpenChange={(open) => workspace.changePanel(open ? "help" : null)}
        diagnostics={workspace.ui.diagnostics}
        diagnosticsOpen={workspace.diagnosticsOpen}
        onDiagnosticsChange={workspace.changeDiagnostics}
        onCancelActiveInput={workspace.model.cancelActiveInput}
      />
      <span className={styles.hidden} id="prototype-warning">
        Пишите пером или мышью. Ластик удаляет штрихи целиком.
      </span>
      <div className={styles["board-stage"]}>
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
            backgroundSettings={workspace.ui.backgroundSettings}
            lastWritingView={workspace.ui.lastWritingView}
            onWritingCommitted={workspace.model.writingCommitted}
            onNavigationNotice={workspace.model.navigationNoticeChanged}
            onScenePresence={workspace.model.scenePresenceChanged}
            minimapOpen={workspace.minimapOpen}
            onMinimapClose={workspace.minimapPanel.closeAndFocus}
            bindMinimapRoot={workspace.minimapPanel.bindRoot}
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
