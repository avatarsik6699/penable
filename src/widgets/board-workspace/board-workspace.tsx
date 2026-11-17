import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
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

export const BoardWorkspace: React.FC<BoardWorkspaceTypes.Props> = (props) => {
  const workspace = useBoardWorkspace();

  const unavailable =
    workspace.ui.dialogOpen ||
    !workspace.ui.hasBoard ||
    Boolean(workspace.ui.unavailable);

  const readOnly = !workspace.ui.storage.writable || unavailable;

  return (
    <main className={styles.app} aria-label={I18n.t("personalBoard")}>
      <div className={styles.brand} aria-label="penable">
        penable
        <span className={styles.brandDot} />
      </div>
      <PenToolbar
        insertion={workspace.ui.selection.insertion}
        selectionMessage={workspace.ui.selection.message}
        selectionOpen={workspace.panel === "selection"}
        onDismissInsertion={() =>
          workspace.model.controls.current?.dismissInsertion?.()
        }
        leadingControls={
          <BoardLibrary
            state={workspace.ui.library}
            onAppearance={workspace.model.setBoardAppearance}
            readOnly={readOnly}
            blocked={unavailable}
            transientDisabled={workspace.ui.history.busy}
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
        fingerInput={workspace.ui.fingerInput}
        onFingerInputChange={workspace.model.changeFingerInput}
        writing={workspace.ui.writing}
        onInstrumentChange={workspace.model.changeInstrument}
        onInkSettingsChange={workspace.model.changeInkSettings}
        templatesOpen={workspace.panel === "templates"}
        onTemplatesOpenChange={(open) =>
          workspace.changePanel(open ? "templates" : null)
        }
        onInsertTemplate={(config, explicitSize) => {
          workspace.changePanel(null);

          workspace.model.controls.current?.insertTemplate?.(
            config,
            explicitSize,
          );
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
            languageSettings={props.languageSettings}
            themeSettings={props.themeSettings}
            state={workspace.ui.storage}
            hasDocument={workspace.ui.hasBoard}
            busy={workspace.ui.history.busy}
            onExport={workspace.model.exportCurrent}
            onUpgrade={workspace.model.exportUpgrade}
            onOverlayChange={workspace.model.overlayChanged}
            onPrevious={workspace.model.exportPrevious}
            onSchema3={workspace.model.exportSchema3}
            onSchema4={workspace.model.exportSchema4}
            onSchema5={workspace.model.exportSchema5}
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
        {I18n.t("writeWithAPenOrMouseThe")}
      </span>
      <div className={styles["board-stage"]}>
        {!workspace.ui.hasBoard ? (
          <div className={styles["load-state"]} role="status">
            {I18n.text(
              workspace.ui.storage.phase === "loading"
                ? Messages.create("loadingBoard")
                : Messages.create("boardIsNotLoadedReconnectOrRestore"),
            )}
          </div>
        ) : workspace.ui.unavailable ? (
          <div className={styles["capability-error"]} role="alert">
            <h2>{I18n.t("couldNotOpenTheBoard")}</h2>
            <p>
              {I18n.t("openThisPageInACurrentSafari", {
                p0: workspace.ui.unavailable,
              })}
            </p>
          </div>
        ) : (
          <WritingSurface
            theme={props.theme}
            key={workspace.ui.generation}
            initialDocument={workspace.model.readInitialBoard()}
            clipboard={workspace.model.clipboard}
            onSelectionState={workspace.model.selectionChanged}
            onActivateSelection={workspace.model.activateSelection}
            tool={workspace.ui.tool}
            getTool={workspace.model.getTool}
            getFingerInput={workspace.model.getFingerInput}
            width={workspace.ui.width}
            writing={workspace.ui.writing}
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
