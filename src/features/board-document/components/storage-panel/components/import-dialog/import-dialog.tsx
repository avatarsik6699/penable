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
    <h2 id="import-title">Импорт доски</h2>
    <p>
      Выберите JSON-копию. До подтверждения текущая доска останется прежней.
    </p>
    <label className={styles["import-file"]}>
      JSON-копия
      <input
        type="file"
        accept=".json,application/json"
        disabled={props.dialog.confirming || props.state.importing}
        onChange={props.dialog.fileChanged}
      />
    </label>
    {props.dialog.reading && <p role="status">Проверка файла…</p>}
    {props.dialog.candidate && (
      <p>
        В копии: {DocumentCodec.documentStats(props.dialog.candidate).strokes}{" "}
        штрихов, {DocumentCodec.documentStats(props.dialog.candidate).points}{" "}
        точек. Текущая доска будет заменена. Сохранится одна предыдущая запись;
        следующая замена перезапишет её. JSON-совместимую копию можно скачать,
        остальные данные останутся в хранилище.
      </p>
    )}
    {props.dialog.error && (
      <p className={styles["storage-error"]} role="alert">
        {props.dialog.error}
      </p>
    )}
    <div className={styles["import-actions"]}>
      <Button
        type="button"
        onClick={props.dialog.close}
        disabled={props.dialog.confirming || props.state.importing}
      >
        Отмена
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
        {props.dialog.confirming ? "Замена…" : "Заменить доску"}
      </Button>
    </div>
  </dialog>
);
