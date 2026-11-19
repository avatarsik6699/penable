import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { SelectionActions } from "./components/selection-actions";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import styles from "./selection-toolbar.module.css";
import type { SelectionToolbarTypes } from "./selection-toolbar.types";
import { useSelectionActions } from "./hooks/use-selection-actions";

export const SelectionToolbar: React.FC<SelectionToolbarTypes.Props> = (
  props,
) => {
  const toolbar = useSelectionActions(props);

  return (
    <div
      ref={(node) => {
        toolbar.bindRoot(node);
      }}
      className={styles.toolbar}
      data-board-selection-toolbar=""
      role="region"
      aria-label={I18n.t("selectionCommands")}
    >
      <div
        className={styles.controls}
        role="group"
        aria-label={I18n.t("selectionMethod")}
      >
        <Button
          aria-pressed={props.shape === "rectangle"}
          disabled={toolbar.busy}
          onClick={() => toolbar.changeShape("rectangle")}
        >
          {I18n.t("rectangle408")}
        </Button>
        <Button
          aria-pressed={props.shape === "lasso"}
          disabled={toolbar.busy}
          onClick={() => toolbar.changeShape("lasso")}
        >
          {I18n.t("lasso")}
        </Button>
        <Button
          ref={(node) => {
            toolbar.bindTrigger(node);
          }}
          aria-label={I18n.t("actions")}
          title={I18n.t("selectionCommands")}
          aria-haspopup="dialog"
          aria-expanded={props.open}
          aria-controls="selection-menu"
          disabled={props.blocked}
          onClick={() => props.onOpenChange(!props.open)}
        >
          <EditorIcon name="more" />
        </Button>
      </div>
      {props.open && (
        <SelectionActions
          bindPanel={toolbar.bindPanel}
          onClose={toolbar.closeAndFocus}
          onTransform={props.onTransform}
          state={props.state}
          readOnly={props.readOnly}
          blocked={props.blocked}
          busy={toolbar.busy}
          command={toolbar.command}
          editText={toolbar.editText}
        />
      )}
    </div>
  );
};
