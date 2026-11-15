import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { useEffect, useRef } from "react";
import { Overlay } from "~/shared/lib/overlay";
import { Button } from "~/shared/ui/button";
import type { DeleteBoardDialogTypes } from "./delete-board-dialog.types";
import styles from "./delete-board-dialog.module.css";

export const DeleteBoardDialog: React.FC<DeleteBoardDialogTypes.Props> = (
  props,
) => {
  const dialog = useRef<
    import("~/shared/lib/overlay").OverlayElements.Dialog | null
  >(null);

  useEffect(function deleteDialogFx() {
    return Overlay.modal(dialog.current);
  }, []);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      role="alertdialog"
      aria-label={I18n.t("deleteBoard")}
      onCancel={(event) => {
        event.preventDefault();

        if (!props.busy) props.onCancel();
      }}
    >
      <h2>{I18n.t("deleteBoard")}</h2>
      <p>
        «{I18n.text(props.title)}
        {I18n.t("andItsLocalRecoveryCopiesWillBe")}
      </p>
      {props.error && (
        <p className={styles.error} role="alert">
          {I18n.text(props.error)}
        </p>
      )}
      <div className={styles.actions}>
        <Button autoFocus disabled={props.busy} onClick={props.onCancel}>
          {I18n.t("cancel")}
        </Button>
        <Button
          className={styles.destructive}
          disabled={props.busy}
          onClick={props.onConfirm}
        >
          {I18n.t("deleteBoard130")}
        </Button>
      </div>
    </dialog>
  );
};
