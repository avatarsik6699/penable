import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import { useState } from "react";
import { TransformControls } from "../transform-controls";
import type React from "react";
import type { SelectionActionsTypes } from "./selection-actions.types";
import styles from "./selection-actions.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const SelectionActions: React.FC<SelectionActionsTypes.Props> = (
  props,
) => {
  const [transformOpen, setTransformOpen] = useState(false);

  return (
    <div
      ref={(node) => props.bindPanel(node)}
      id="selection-menu"
      className={styles.menu}
      role="dialog"
      aria-label={I18n.t("selectionActions")}
    >
      <div className={styles.heading}>
        <span>{I18n.t("selectedArea")}</span>
        <Button
          className={styles.close}
          aria-label={I18n.t("closeSelectionActions")}
          onClick={props.onClose}
        >
          <EditorIcon name="close" />
        </Button>
      </div>
      <div
        className={styles.actions}
        role="group"
        aria-label={I18n.t("editFragment")}
      >
        <Button
          className={styles["action"]}
          disabled={props.busy}
          onClick={() => props.command("all")}
        >
          <EditorIcon name="selection" />
          <span>{I18n.t("selectAll")}</span>
          <kbd aria-hidden="true">Ctrl+A</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || !props.state.selected}
          onClick={() => props.command("copy")}
        >
          <EditorIcon name="copy" />
          <span>{I18n.t("copy")}</span>
          <kbd aria-hidden="true">Ctrl+C</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || props.readOnly || !props.state.selected}
          onClick={() => props.command("cut")}
        >
          <EditorIcon name="cut" />
          <span>{I18n.t("cut")}</span>
          <kbd aria-hidden="true">Ctrl+X</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || props.readOnly}
          onClick={() => props.command("paste")}
        >
          <EditorIcon name="paste" />
          <span>{I18n.t("paste")}</span>
          <kbd aria-hidden="true">Ctrl+V</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || props.readOnly || !props.state.selected}
          onClick={() => props.command("duplicate")}
        >
          <EditorIcon name="duplicate" />
          <span>{I18n.t("duplicate")}</span>
          <kbd aria-hidden="true">Ctrl+D</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || !props.state.selected}
          onClick={() => props.command("download")}
        >
          <EditorIcon name="download" />
          <span>{I18n.t("downloadPng")}</span>
          <kbd aria-hidden="true"></kbd>
        </Button>
        <Button
          className={styles.action}
          disabled={props.busy || props.readOnly || !props.state.selected}
          aria-expanded={transformOpen}
          onClick={() => setTransformOpen(!transformOpen)}
        >
          <EditorIcon name="fit" />
          <span>{I18n.t("transform")}</span>
        </Button>
        {transformOpen && (
          <TransformControls
            disabled={props.busy || props.readOnly || !props.state.selected}
            onApply={props.onTransform}
          />
        )}
        <Button
          className={styles.action}
          disabled={props.busy || props.readOnly || !props.state.images}
          onClick={() => props.command("crop")}
        >
          <EditorIcon name="image" />
          <span>{I18n.t("cropImages")}</span>
        </Button>
        <Button
          className={styles["destructive"]}
          disabled={props.busy || props.readOnly || !props.state.selected}
          onClick={() => props.command("delete")}
        >
          <EditorIcon name="trash" />
          <span>{I18n.t("delete")}</span>
          <kbd aria-hidden="true">Del</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={
            props.blocked || (!props.state.selected && !props.state.busy)
          }
          onClick={() => props.command("clear")}
        >
          <EditorIcon name="close" />
          <span>{I18n.t("deselect")}</span>
          <kbd aria-hidden="true">Esc</kbd>
        </Button>
      </div>
      <p className={styles.help} role="status">
        {I18n.text(
          props.state.message ||
            Messages.create("drawAroundNotesDragTheSelectionOr"),
        )}
      </p>
    </div>
  );
};
