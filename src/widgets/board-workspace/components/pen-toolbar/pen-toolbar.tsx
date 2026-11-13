import type React from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { InkSettings } from "./components/ink-settings";
import { PenSettings } from "./components/pen-settings";
import { HistoryControls } from "./components/history-controls";
import { ToolControls } from "./components/tool-controls";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import styles from "./pen-toolbar.module.css";
import type { PenToolbarTypes } from "./pen-toolbar.types";

export const PenToolbar: React.FC<PenToolbarTypes.Props> = (props) => {
  const panel = usePanelDismiss({
    open: props.penOpen,
    onClose: () => props.onPenOpenChange(false),
  });

  return (
    <header
      className={styles.dock}
      role="group"
      aria-label="Инструменты доски"
      data-editor-chrome=""
    >
      <div className={styles.library}>{props.leadingControls}</div>
      <div className={styles.primary}>
        <Button
          className={styles.imageInsert}
          aria-label="Вставить изображение"
          title="Вставить изображение"
          disabled={props.readOnly || props.historyState.busy}
          onClick={props.onInsertImage}
        >
          <EditorIcon name="image" />
        </Button>
        <ToolControls
          tool={props.tool}
          onToolChange={props.onToolChange}
          readOnly={props.readOnly}
          historyState={props.historyState}
          selectionDisabled={props.selectionDisabled}
          penOpen={props.penOpen}
          onPenParameters={() => props.onPenOpenChange(!props.penOpen)}
          bindPenTrigger={panel.bindTrigger}
        />
        <span className={styles.divider} aria-hidden="true" />
        <HistoryControls
          onUndo={props.onUndo}
          onRedo={props.onRedo}
          readOnly={props.readOnly}
          historyState={props.historyState}
        />
      </div>
      <div className={styles.context}>
        {props.tool === "pen" ? (
          <InkSettings
            width={props.width}
            onWidthChange={props.onWidthChange}
            readOnly={props.readOnly}
          />
        ) : props.tool === "eraser" ? (
          <span className={styles.eraser}>Штрих целиком</span>
        ) : (
          props.selectionControls
        )}
      </div>
      <div className={styles.trailing}>{props.trailingControls}</div>
      {props.penOpen && (
        <PenSettings
          width={props.width}
          stabilization={props.stabilization}
          onStabilizationChange={props.onStabilizationChange}
          readOnly={props.readOnly}
          bindRoot={panel.bindRoot}
          onClose={panel.closeAndFocus}
        />
      )}
    </header>
  );
};
