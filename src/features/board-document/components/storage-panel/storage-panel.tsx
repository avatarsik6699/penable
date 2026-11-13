import type React from "react";
import { ImportDialog } from "./components/import-dialog";
import { StorageDetails } from "./components/storage-details";
import { StorageStatus } from "./components/storage-status";
import { BoardMenu } from "./components/board-menu";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import styles from "./storage-panel.module.css";
import type { StoragePanelTypes } from "./storage-panel.types";
import { useStoragePanel } from "./hooks/use-storage-panel";

export const StoragePanel: React.FC<StoragePanelTypes.Props> = (props) => {
  const panel = useStoragePanel(props);

  return (
    <section
      className={styles.storage}
      aria-label="Локальное сохранение и копии"
    >
      <div className={styles.board} data-editor-chrome="">
        <Button
          ref={(node) => {
            panel.board.bindTrigger(node);
          }}
          className={styles.brandButton}
          aria-label="Меню доски"
          aria-haspopup="dialog"
          aria-expanded={props.openPanel === "board"}
          aria-controls="board-menu"
          onClick={() =>
            props.onPanelChange(props.openPanel === "board" ? null : "board")
          }
        >
          <span className={styles.brand}>
            penable
            <span className={styles.dot} />
          </span>
          <EditorIcon name="chevron-down" />
        </Button>
      </div>
      <div
        className={[
          styles.status,
          props.state.phase === "error" ? styles.error : "",
        ].join(" ")}
        data-editor-chrome=""
      >
        <Button
          ref={(node) => {
            panel.save.bindTrigger(node);
          }}
          className={styles.saveButton}
          aria-label="Хранение"
          aria-haspopup="dialog"
          aria-expanded={props.openPanel === "save"}
          aria-controls="storage-popover"
          onClick={() =>
            props.onPanelChange(props.openPanel === "save" ? null : "save")
          }
        >
          <EditorIcon
            name={
              props.state.phase === "error"
                ? "retry"
                : props.state.readOnly
                  ? "device"
                  : "check"
            }
          />
          <StorageStatus state={props.state} />
          <span className={styles.saveDot} aria-hidden="true" />
        </Button>
      </div>
      {props.openPanel === "board" && (
        <BoardMenu
          state={props.state}
          hasDocument={props.hasDocument}
          busy={props.busy}
          onExport={() => panel.feedback(props.onExport())}
          onImport={panel.importDialog.begin}
          onPrevious={() => panel.feedback(props.onPrevious())}
          onUpgrade={() => panel.feedback(props.onUpgrade())}
          backgroundControl={props.backgroundControl}
          bindRoot={panel.board.bindRoot}
          onClose={panel.board.closeAndFocus}
        />
      )}
      {props.openPanel === "save" && (
        <StorageDetails
          state={props.state}
          hasDocument={props.hasDocument}
          onExport={props.onExport}
          onUpgrade={props.onUpgrade}
          onPrevious={props.onPrevious}
          onRetry={props.onRetry}
          bindRoot={panel.save.bindRoot}
          onClose={panel.save.closeAndFocus}
          notice={panel.notice}
          onFeedback={panel.feedback}
        />
      )}
      <ImportDialog state={props.state} dialog={panel.importDialog} />
    </section>
  );
};
