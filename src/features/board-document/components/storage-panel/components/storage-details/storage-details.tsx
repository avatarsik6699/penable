import type React from "react";
import type { StorageDetailsTypes } from "./storage-details.types";
import styles from "./storage-details.module.css";
import { Button } from "~/shared/ui/button";

export const StorageDetails: React.FC<StorageDetailsTypes.Props> = (props) => (
  <div
    ref={(node) => {
      props.details.bindPopover(node);
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
        onClick={props.details.closePopover}
        aria-label="Закрыть сведения о хранении"
      >
        Закрыть
      </Button>
    </div>
    {props.state.message && (
      <p
        className={
          props.state.phase === "error" ? styles["storage-error"] : undefined
        }
      >
        {props.state.message}
      </p>
    )}
    {props.details.notice && <p role="status">{props.details.notice}</p>}
    <div className={styles["storage-recovery"]}>
      {props.state.hasUpgradeCopy && (
        <Button
          type="button"
          onClick={() => props.details.feedback(props.onUpgrade())}
        >
          Копия до обновления
        </Button>
      )}
      {props.state.hasPrevious && (
        <Button
          type="button"
          title="Скачать JSON-копию до последней замены доски"
          onClick={() => props.details.feedback(props.onPrevious())}
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
      Незавершённый штрих в неё не входит. Скачивание передаёт файл браузеру;
      проверьте его в загрузках.
    </p>
  </div>
);
