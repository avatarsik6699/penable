import type React from "react";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { LibraryPanel } from "./components/library-panel";
import type { BoardLibraryTypes } from "./board-library.types";
import styles from "./board-library.module.css";

export const BoardLibrary: React.FC<BoardLibraryTypes.Props> = (props) => {
  const panel = usePanelDismiss({
    open: props.open,
    onClose: () => props.onOpenChange(false),
  });

  const active = props.state.boards.find(
    (board) => board.id === props.state.activeId,
  );

  return (
    <div className={styles.owner} ref={(node) => panel.bindRoot(node)}>
      <Button
        ref={(node) => panel.bindTrigger(node)}
        aria-label="Доски"
        title={active?.title ?? "Доски"}
        aria-expanded={props.open}
        aria-controls="board-library"
        disabled={props.blocked || props.state.busy}
        onClick={() => props.onOpenChange(!props.open)}
        className={styles.trigger}
      >
        <span className={styles.label}>Доски</span>
        <span className={styles.current} data-testid="active-board-title">
          {active?.title ?? "Моя доска"}
        </span>
        <EditorIcon name="chevron-down" />
      </Button>
      {props.open && (
        <LibraryPanel
          {...props}
          bindPanel={panel.bindPanel}
          closeAndFocus={panel.closeAndFocus}
          focusTrigger={panel.focusTrigger}
        />
      )}
    </div>
  );
};
