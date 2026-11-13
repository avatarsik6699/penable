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
      aria-label="Удалить доску?"
      onCancel={(event) => {
        event.preventDefault();

        if (!props.busy) props.onCancel();
      }}
    >
      <h2>Удалить доску?</h2>
      <p>
        «{props.title}» и её локальные копии будут удалены. Скачайте нужные
        записи перед удалением.
      </p>
      {props.error && (
        <p className={styles.error} role="alert">
          {props.error}
        </p>
      )}
      <div className={styles.actions}>
        <Button autoFocus disabled={props.busy} onClick={props.onCancel}>
          Отмена
        </Button>
        <Button
          className={styles.destructive}
          disabled={props.busy}
          onClick={props.onConfirm}
        >
          Удалить доску
        </Button>
      </div>
    </dialog>
  );
};
