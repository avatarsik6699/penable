import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import type { BoardMenuTypes } from "./board-menu.types";
import styles from "./board-menu.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { useBoardTabs } from "./hooks/use-board-tabs";

export const BoardMenu: React.FC<BoardMenuTypes.Props> = (props) => {
  const tabs = useBoardTabs(props);

  return (
    <div
      ref={(node) => props.bindRoot(node)}
      id="board-menu"
      className={styles.panel}
      role="dialog"
      aria-label={I18n.t("boardSettings")}
    >
      <div className={styles.heading}>
        <h2>{I18n.t("boardSettings")}</h2>
        <Button
          onClick={props.onClose}
          aria-label={I18n.t("closeBoardSettings")}
        >
          <EditorIcon name="close" />
        </Button>
      </div>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={I18n.t("settingsSection")}
        onKeyDown={tabs.keyDown}
      >
        <Button
          ref={(node) => tabs.bindBoard(node)}
          role="tab"
          id="board-view-tab"
          aria-selected={props.tab === "board"}
          aria-controls="board-view-panel"
          tabIndex={props.tab === "board" ? 0 : -1}
          onClick={() => props.onTab("board")}
        >
          {I18n.t("view")}
        </Button>
        <Button
          ref={(node) => tabs.bindSave(node)}
          role="tab"
          id="board-files-tab"
          aria-selected={props.tab === "save"}
          aria-controls="board-files-panel"
          tabIndex={props.tab === "save" ? 0 : -1}
          onClick={() => props.onTab("save")}
        >
          {I18n.t("filesAndCopies")}
        </Button>
      </div>
      {props.tab === "board" ? (
        <div
          role="tabpanel"
          id="board-view-panel"
          aria-labelledby="board-view-tab"
        >
          {props.backgroundControl}
          {props.languageSettings}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="board-files-panel"
          aria-labelledby="board-files-tab"
        >
          {props.children}
        </div>
      )}
    </div>
  );
};
