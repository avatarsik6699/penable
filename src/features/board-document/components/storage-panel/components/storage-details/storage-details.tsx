import type React from "react";
import type { StorageDetailsTypes } from "./storage-details.types";
import styles from "./storage-details.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { StorageStatus } from "../storage-status";

export const StorageDetails: React.FC<StorageDetailsTypes.Props> = (props) => (
  <div className={styles.content}>
    <div className={styles.state}>
      <StorageStatus state={props.state} />
    </div>
    {props.state.message && (
      <p className={props.state.phase === "error" ? styles.error : undefined}>
        {props.state.message}
      </p>
    )}
    {props.notice && <p role="status">{props.notice}</p>}
    {props.state.phase === "error" && props.state.writable ? (
      <Button className={styles.primary} onClick={props.onRetry}>
        <EditorIcon name="retry" />
        Повторить сохранение
      </Button>
    ) : (
      props.state.canReconnect && (
        <Button className={styles.secondary} onClick={props.onRetry}>
          <EditorIcon name="retry" />
          Повторить подключение
        </Button>
      )
    )}
    <div className={styles.actions}>
      <Button
        disabled={!props.hasDocument}
        aria-label="Скачать копию"
        onClick={() => props.onFeedback(props.onExport())}
      >
        <EditorIcon name="download" />
        Скачать JSON-копию
      </Button>
      <Button
        disabled={!props.state.canImport || props.busy || props.state.importing}
        aria-label="Импорт"
        onClick={props.onImport}
      >
        <EditorIcon name="upload" />
        Импортировать копию
      </Button>
    </div>
    <div className={styles.recovery}>
      <h3>Восстановительные копии</h3>
      {props.state.hasRawCopy && (
        <Button onClick={() => props.onFeedback(props.onRaw())}>
          <EditorIcon name="history" />
          Исходная запись
        </Button>
      )}
      {props.state.hasSchema4Copy && (
        <Button onClick={() => props.onFeedback(props.onSchema4())}>
          <EditorIcon name="history" />
          Копия до обновления v4
        </Button>
      )}
      {props.state.hasLibraryCopy && (
        <Button onClick={() => props.onFeedback(props.onLibrary())}>
          <EditorIcon name="history" />
          Копия до библиотеки досок
        </Button>
      )}
      {props.state.hasPrevious && (
        <Button onClick={() => props.onFeedback(props.onPrevious())}>
          <EditorIcon name="history" />
          Копия до замены
        </Button>
      )}
      {props.state.hasSchema3Copy && (
        <Button onClick={() => props.onFeedback(props.onSchema3())}>
          <EditorIcon name="history" />
          Копия до обновления
        </Button>
      )}
      {props.state.hasUpgradeCopy && (
        <Button onClick={() => props.onFeedback(props.onUpgrade())}>
          <EditorIcon name="history" />
          {props.state.hasSchema3Copy
            ? "Более ранняя копия до обновления"
            : "Копия до обновления"}
        </Button>
      )}
      {!props.state.hasPrevious &&
        !props.state.hasSchema4Copy &&
        !props.state.hasLibraryCopy &&
        !props.state.hasRawCopy &&
        !props.state.hasSchema3Copy &&
        !props.state.hasUpgradeCopy && <p>Восстановительных копий пока нет.</p>}
    </div>
    <p className={styles.help}>
      Записи хранятся в этом профиле браузера. JSON-копия защищает от очистки
      данных сайта. Незавершённый штрих в неё не входит; проверьте скачанный
      файл в загрузках.
    </p>
  </div>
);
