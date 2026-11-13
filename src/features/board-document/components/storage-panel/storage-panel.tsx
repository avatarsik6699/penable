import type React from "react";
import { ImportDialog } from "./components/import-dialog";
import { StorageDetails } from "./components/storage-details";
import {
  StorageStatus,
  StorageStatusPresentation,
} from "./components/storage-status";
import { BoardMenu } from "./components/board-menu";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import styles from "./storage-panel.module.css";
import type { StoragePanelTypes } from "./storage-panel.types";
import { useStoragePanel } from "./hooks/use-storage-panel";

export const StoragePanel: React.FC<StoragePanelTypes.Props> = (props) => {
  const panel = useStoragePanel(props);

  const status =
    props.state.phase === "error"
      ? "error"
      : props.state.readOnly || props.state.phase === "loading"
        ? "idle"
        : props.state.phase === "saved"
          ? "saved"
          : "pending";

  return (
    <section className={styles.storage} aria-label="Настройки и сохранение">
      <div className={styles.controls}>
        {props.state.phase === "error" && (
          <span className={styles.errorText}>Не удалось сохранить</span>
        )}
        <Button
          ref={(node) => panel.save.bindTrigger(node)}
          className={styles.statusButton}
          aria-label="Состояние сохранения"
          aria-describedby="storage-summary"
          aria-haspopup="dialog"
          aria-expanded={props.openPanel === "save"}
          aria-controls="board-menu"
          onClick={() =>
            props.onPanelChange(props.openPanel === "save" ? null : "save")
          }
          title={StorageStatusPresentation.label(props.state)}
        >
          <span
            className={[styles.statusDot, styles[status]].join(" ")}
            aria-hidden="true"
          />
          {props.state.readOnly && props.state.loaded && (
            <EditorIcon name="lock" />
          )}
        </Button>
        <span className={styles.srOnly} id="storage-summary">
          <StorageStatus state={props.state} />
        </span>
        <Button
          ref={(node) => panel.board.bindTrigger(node)}
          className={styles.gear}
          aria-label="Настройки доски"
          title="Настройки доски"
          aria-haspopup="dialog"
          aria-expanded={props.openPanel === "board"}
          aria-controls="board-menu"
          onClick={() =>
            props.onPanelChange(props.openPanel === "board" ? null : "board")
          }
        >
          <EditorIcon name="settings" />
        </Button>
      </div>
      {props.openPanel && (
        <BoardMenu
          tab={props.openPanel}
          onTab={props.onPanelChange}
          backgroundControl={props.backgroundControl}
          bindRoot={(node) => {
            panel.board.bindRoot(node);
            panel.save.bindRoot(node);
          }}
          onClose={
            props.openPanel === "board"
              ? panel.board.closeAndFocus
              : panel.save.closeAndFocus
          }
        >
          <StorageDetails
            state={props.state}
            busy={props.busy}
            hasDocument={props.hasDocument}
            onExport={props.onExport}
            onPrevious={props.onPrevious}
            onUpgrade={props.onUpgrade}
            onSchema3={props.onSchema3}
            onSchema4={props.onSchema4}
            onLibrary={props.onLibrary}
            onRaw={props.onRaw}
            onRetry={props.onRetry}
            notice={panel.notice}
            onFeedback={panel.feedback}
            onImport={panel.importDialog.begin}
          />
        </BoardMenu>
      )}
      <ImportDialog state={props.state} dialog={panel.importDialog} />
    </section>
  );
};
