import { useLayoutEffect, useId, useRef, useState } from "react";
import type React from "react";
import { I18n } from "~/shared/lib/i18n";
import { Messages, type MessageTypes } from "~/shared/lib/messages";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import { Button } from "~/shared/ui/button";
import type { TextEditDialogTypes } from "./text-edit-dialog.types";
import styles from "./text-edit-dialog.module.css";

export const TextEditDialog: React.FC<TextEditDialogTypes.Props> = (props) => {
  const dialog = useRef<OverlayElements.Dialog | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [value, setValue] = useState(props.edit.text);
  const [error, setError] = useState<MessageTypes.Value>("");
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const errorId = useId();

  useLayoutEffect(function textEditDialogFx() {
    const close = Overlay.modal(dialog.current);

    return () => {
      pending.current?.abort();
      close();
    };
  }, []);

  const cancel = () => {
    pending.current?.abort();
    props.onClose();
  };

  const save = async () => {
    if (pending.current) return;

    const controller = new AbortController();

    pending.current = controller;
    setBusy(true);
    setError("");

    try {
      const result = await props.edit.save(value, controller.signal);

      if (controller.signal.aborted) return;

      if (result.status === "committed") props.onClose();
      else
        setError(
          result.status === "rejected"
            ? result.reason
            : Messages.create("actionCancelled"),
        );
    } catch (error) {
      if (!controller.signal.aborted) setError(Messages.from(error));
    } finally {
      pending.current = null;

      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2 id={headingId}>{I18n.t("editBoardText")}</h2>
      <textarea
        className={styles.editor}
        aria-label={I18n.t("boardTextField")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoFocus
        readOnly={busy}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          setError("");
        }}
      />
      {error && (
        <p className={styles.error} id={errorId} role="alert">
          {I18n.text(error)}
        </p>
      )}
      <div className={styles.actions}>
        <Button onClick={cancel}>{I18n.t("cancel")}</Button>
        <Button
          className={styles.save}
          onClick={() => void save()}
          disabled={busy}
        >
          {I18n.t("saveBoardText")}
        </Button>
      </div>
    </dialog>
  );
};
