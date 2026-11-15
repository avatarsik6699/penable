import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import type { ImportDialogTypes } from "./import-dialog.types";
import styles from "./import-dialog.module.css";
import { Button } from "~/shared/ui/button";
import { DocumentCodec } from "../../../../modules/codec";

export const ImportDialog: React.FC<ImportDialogTypes.Props> = (props) => (
  <dialog
    ref={(node) => {
      props.dialog.bindDialog(node);
    }}
    className={styles["storage-dialog"]}
    aria-labelledby="import-title"
    onCancel={(event) => {
      event.preventDefault();
      props.dialog.close();
    }}
  >
    <h2 id="import-title">{I18n.t("importBoard")}</h2>
    <p>{I18n.t("chooseAJsonBackupTheCurrentBoard")}</p>
    <label className={styles["import-file"]}>
      {I18n.t("jsonBackup")}
      <input
        type="file"
        accept=".json,application/json"
        disabled={props.dialog.confirming || props.state.importing}
        onChange={props.dialog.fileChanged}
      />
    </label>
    {props.dialog.reading && <p role="status">{I18n.t("checkingFile")}</p>}
    {props.dialog.candidate && (
      <p>
        {I18n.t("backupSummary", {
          strokes: DocumentCodec.documentStats(props.dialog.candidate).strokes,
          points: DocumentCodec.documentStats(props.dialog.candidate).points,
        })}
      </p>
    )}
    {props.dialog.error && (
      <p className={styles["storage-error"]} role="alert">
        {I18n.text(props.dialog.error)}
      </p>
    )}
    <div className={styles["import-actions"]}>
      <Button
        type="button"
        onClick={props.dialog.close}
        disabled={props.dialog.confirming || props.state.importing}
      >
        {I18n.t("cancel")}
      </Button>
      <Button
        type="button"
        onClick={() => {
          void props.dialog.confirm();
        }}
        disabled={
          !props.dialog.candidate ||
          props.dialog.reading ||
          props.dialog.confirming ||
          props.state.importing
        }
      >
        {I18n.text(
          props.dialog.confirming
            ? Messages.create("replacing")
            : Messages.create("replaceBoard"),
        )}
      </Button>
    </div>
  </dialog>
);
