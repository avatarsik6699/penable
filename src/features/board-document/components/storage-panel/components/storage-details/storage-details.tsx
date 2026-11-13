import type React from "react";
import type { StorageDetailsTypes } from "./storage-details.types";
import styles from "./storage-details.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const StorageDetails: React.FC<StorageDetailsTypes.Props> = (props) => (
  <div
    ref={(node) => {
      props.bindRoot(node);
    }}
    id="storage-popover"
    className={styles.panel}
    role="dialog"
    aria-labelledby="storage-title"
  >
    <div className={styles.heading}>
      <h2 id="storage-title">
        {props.state.phase === "error"
          ? "Нужна резервная копия"
          : props.state.readOnly
            ? "Только просмотр"
            : "Хранение и копии"}
      </h2>
      <Button onClick={props.onClose} aria-label="Закрыть сведения о хранении">
        <EditorIcon name="close" />
      </Button>
    </div>
    {props.state.message && (
      <p className={props.state.phase === "error" ? styles.error : undefined}>
        {props.state.message}
      </p>
    )}
    {props.notice && <p role="status">{props.notice}</p>}
    {props.state.phase === "error" && props.state.writable && (
      <>
        <p>
          Не удалось записать последние изменения. Они остаются на полотне.
          Скачайте отдельную копию.
        </p>
        <Button className={styles.primary} onClick={props.onRetry}>
          <EditorIcon name="retry" />
          Повторить сохранение
        </Button>
      </>
    )}
    {props.state.canReconnect &&
      !(props.state.phase === "error" && props.state.writable) && (
        <Button className={styles.secondary} onClick={props.onRetry}>
          <EditorIcon name="retry" />
          Повторить подключение
        </Button>
      )}
    <Button
      className={styles.secondary}
      disabled={!props.hasDocument}
      onClick={() => props.onFeedback(props.onExport())}
    >
      <EditorIcon name="download" />
      Скачать копию
    </Button>
    {props.state.hasPrevious && (
      <Button
        className={styles.secondary}
        onClick={() => props.onFeedback(props.onPrevious())}
      >
        <EditorIcon name="history" />
        Копия до замены
      </Button>
    )}
    {props.state.hasUpgradeCopy && (
      <Button
        className={styles.secondary}
        onClick={() => props.onFeedback(props.onUpgrade())}
      >
        <EditorIcon name="history" />
        Копия до обновления
      </Button>
    )}
    <p className={styles.help}>
      Данные хранятся в этом профиле браузера, без облачной копии. Очистка
      данных сайта может удалить доску. Регулярно скачивайте JSON-копию.
      Незавершённый штрих в неё не входит. Скачивание передаёт файл браузеру;
      проверьте его в загрузках.
    </p>
  </div>
);
