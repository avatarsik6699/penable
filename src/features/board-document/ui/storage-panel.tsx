import { Button } from "~/shared/ui/button";
import styles from "./storage-panel.module.css";
import type React from "react";
import type { StoragePanelTypes } from "./storage-panel.types";
import { useStoragePanel } from "../model/storage-panel-model";
import { DocumentCodec } from "../model/codec";
const phaseLabels = {
  loading: "Загрузка",
  dirty: "Есть изменения",
  saving: "Сохранение",
  saved: "Сохранено",
  error: "Ошибка",
};
export const StoragePanel: React.FC<StoragePanelTypes.Props> = (props) => {
  const panel = useStoragePanel(props);
  return (
    <section
      className={styles["storage-panel"]}
      aria-label="Локальное сохранение и копии"
    >
      <div className={styles["storage-row"]}>
        <span
          className={[
            styles["storage-status"],
            props.state.phase === "error" ? styles["storage-status-error"] : "",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {props.state.phase === "error"
            ? phaseLabels.error
            : props.state.readOnly && props.state.loaded
              ? "Только просмотр"
              : phaseLabels[props.state.phase]}
        </span>
        <span className={styles["storage-local"]}>
          Локально в этом браузере
        </span>
        <div className={styles["storage-actions"]}>
          <Button
            type="button"
            disabled={!props.hasDocument}
            onClick={() => panel.feedback(props.onExport())}
          >
            Скачать копию
          </Button>
          <Button
            type="button"
            disabled={
              !props.state.canImport || props.busy || props.state.importing
            }
            onClick={panel.begin}
          >
            Импорт
          </Button>
          <Button
            ref={(node) => {
              panel.bindTrigger(node);
            }}
            type="button"
            aria-expanded={panel.popoverOpen}
            aria-controls="storage-popover"
            onClick={() => panel.setPopoverOpen((value) => !value)}
          >
            Хранение
          </Button>
        </div>
      </div>
      {panel.popoverOpen && (
        <div
          ref={(node) => {
            panel.bindPopover(node);
          }}
          id="storage-popover"
          className={styles["storage-popover"]}
          role="region"
          aria-labelledby="storage-title"
        >
          <div className={styles["storage-popover-heading"]}>
            <h2 id="storage-title">Хранение и копии</h2>
            <Button
              type="button"
              onClick={panel.closePopover}
              aria-label="Закрыть сведения о хранении"
            >
              Закрыть
            </Button>
          </div>
          {props.state.message && (
            <p
              className={
                props.state.phase === "error"
                  ? styles["storage-error"]
                  : undefined
              }
            >
              {props.state.message}
            </p>
          )}
          {panel.notice && <p role="status">{panel.notice}</p>}
          <div className={styles["storage-recovery"]}>
            {props.state.hasUpgradeCopy && (
              <Button
                type="button"
                onClick={() => panel.feedback(props.onUpgrade())}
              >
                Копия до обновления
              </Button>
            )}
            {props.state.hasPrevious && (
              <Button
                type="button"
                title="Скачать JSON-копию до последней замены доски"
                onClick={() => panel.feedback(props.onPrevious())}
              >
                Копия до замены
              </Button>
            )}
            {props.state.phase === "error" && props.state.writable ? (
              <Button type="button" onClick={props.onRetry}>
                Повторить сохранение
              </Button>
            ) : (
              props.state.canReconnect && (
                <Button type="button" onClick={props.onRetry}>
                  Повторить подключение
                </Button>
              )
            )}
          </div>
          <p className={styles["storage-help"]}>
            Данные хранятся в этом профиле браузера, без облачной копии. Очистка
            данных сайта может удалить доску. Регулярно скачивайте JSON-копию.
            Незавершённый штрих в неё не входит. Скачивание передаёт файл
            браузеру; проверьте его в загрузках.
          </p>
        </div>
      )}
      <dialog
        ref={(node) => {
          panel.bindDialog(node);
        }}
        className={styles["storage-dialog"]}
        aria-labelledby="import-title"
        onCancel={(event) => {
          event.preventDefault();
          panel.close();
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
            disabled={panel.confirming || props.state.importing}
            onChange={panel.fileChanged}
          />
        </label>
        {panel.reading && <p role="status">Проверка файла…</p>}
        {panel.candidate && (
          <p>
            В копии: {DocumentCodec.documentStats(panel.candidate).strokes}{" "}
            штрихов, {DocumentCodec.documentStats(panel.candidate).points}{" "}
            точек. Текущая доска будет заменена. Сохранится одна предыдущая
            запись; следующая замена перезапишет её. JSON-совместимую копию
            можно скачать, остальные данные останутся в хранилище.
          </p>
        )}
        {panel.error && (
          <p className={styles["storage-error"]} role="alert">
            {panel.error}
          </p>
        )}
        <div className={styles["import-actions"]}>
          <Button
            type="button"
            onClick={panel.close}
            disabled={panel.confirming || props.state.importing}
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => {
              void panel.confirm();
            }}
            disabled={
              !panel.candidate ||
              panel.reading ||
              panel.confirming ||
              props.state.importing
            }
          >
            {panel.confirming ? "Замена…" : "Заменить доску"}
          </Button>
        </div>
      </dialog>
    </section>
  );
};
