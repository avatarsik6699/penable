import type React from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { TemplatePanel } from "./components/template-panel";
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

  const templatesPanel = usePanelDismiss({
    open: props.templatesOpen,
    onClose: () => props.onTemplatesOpenChange(false),
  });

  return (
    <header
      className={styles.dock}
      role="group"
      aria-label="Инструменты доски"
      data-editor-chrome=""
      data-editor-dock=""
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
        <Button
          ref={(node) => templatesPanel.bindTrigger(node)}
          className={styles.imageInsert}
          aria-label="Фигуры и заготовки"
          title="Фигуры и заготовки"
          aria-haspopup="dialog"
          aria-expanded={props.templatesOpen}
          disabled={props.readOnly || props.historyState.busy}
          onClick={() => props.onTemplatesOpenChange(!props.templatesOpen)}
        >
          <EditorIcon name="shapes" />
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
            highlighter={props.writing.instrument === "highlighter"}
            color={props.writing.instruments[props.writing.instrument].color}
            onColor={() => props.onPenOpenChange(!props.penOpen)}
            onWidthChange={props.onWidthChange}
            readOnly={props.readOnly}
          />
        ) : props.tool === "eraser" ? (
          <span className={styles.eraser}>Штрих целиком</span>
        ) : (
          props.selectionControls
        )}
      </div>
      {props.insertion?.message && (
        <div
          className={styles.insertionNotice}
          role={props.insertion.phase === "error" ? "alert" : "status"}
        >
          <span>{props.insertion.message}</span>
          {["error", "success", "placing"].includes(props.insertion.phase) && (
            <Button
              className={styles.dismissNotice}
              aria-label="Закрыть сообщение о вставке"
              onClick={props.onDismissInsertion}
            >
              <EditorIcon name="close" />
            </Button>
          )}
          {props.insertion.phase === "error" && (
            <Button onClick={props.onInsertImage} disabled={props.readOnly}>
              Повторить
            </Button>
          )}
        </div>
      )}
      {props.selectionMessage &&
        !props.selectionOpen &&
        props.selectionMessage !== props.insertion?.message && (
          <p className={styles.feedback} role="status">
            {props.selectionMessage}
          </p>
        )}
      <div className={styles.trailing}>{props.trailingControls}</div>
      {props.templatesOpen && (
        <TemplatePanel
          disabled={props.readOnly || props.historyState.busy}
          onPlace={props.onInsertTemplate}
          onClose={templatesPanel.closeAndFocus}
          bindRoot={templatesPanel.bindRoot}
        />
      )}
      {props.penOpen && (
        <PenSettings
          fingerInput={props.fingerInput}
          onFingerInputChange={props.onFingerInputChange}
          width={props.width}
          writing={props.writing}
          onInstrumentChange={props.onInstrumentChange}
          onInkSettingsChange={props.onInkSettingsChange}
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
