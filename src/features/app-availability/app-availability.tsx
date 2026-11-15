import type React from "react";
import { useState } from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import { useAppAvailability } from "./hooks/use-app-availability";
import type { AppAvailabilityTypes } from "./app-availability.types";
import styles from "./app-availability.module.css";

export const AppAvailability: React.FC<AppAvailabilityTypes.Props> = () => {
  const availability = useAppAvailability();
  const [open, setOpen] = useState(false);
  const panel = usePanelDismiss({ open, onClose: () => setOpen(false) });

  const labels = {
    preparing: "Подготовка к работе без интернета…",
    ready: "Готово к работе без интернета",
    unavailable: "Не удалось подготовить работу без интернета",
    development: "Офлайн-режим доступен в опубликованной версии",
  };

  return (
    <>
      <div className={styles.trigger} data-editor-chrome="">
        <Button
          ref={(node) => panel.bindTrigger(node)}
          aria-label="Приложение и офлайн"
          title="Приложение и офлайн"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="app-availability-panel"
          onClick={() => setOpen(!open)}
        >
          <EditorIcon name="device" />
        </Button>
      </div>
      {open && (
        <div
          ref={(node) => panel.bindRoot(node)}
          className={styles.panel}
          id="app-availability-panel"
          role="dialog"
          aria-label="Приложение и офлайн"
          data-editor-chrome=""
        >
          <div className={styles.heading}>
            <h2>Приложение и офлайн</h2>
            <Button
              aria-label="Закрыть приложение и офлайн"
              onClick={panel.closeAndFocus}
            >
              <EditorIcon name="close" />
            </Button>
          </div>
          <p role="status">{labels[availability.snapshot.offline]}</p>
          {availability.snapshot.offline === "unavailable" && (
            <Button className={styles.action} onClick={availability.retry}>
              Повторить подготовку
            </Button>
          )}
          {availability.snapshot.waiting && (
            <p>
              Обновление готово. Дождитесь сохранения, закройте все окна penable
              и откройте приложение снова.
            </p>
          )}
          {availability.snapshot.installable &&
            !availability.snapshot.installed && (
              <Button className={styles.action} onClick={availability.install}>
                Установить penable
              </Button>
            )}
          {availability.snapshot.installed && (
            <p>penable открыто как приложение.</p>
          )}
          {availability.snapshot.installError && (
            <p>
              Не удалось открыть установку. Попробуйте установить penable через
              меню браузера.
            </p>
          )}
          <p className={styles.hint}>
            В Chrome и Edge установка доступна через меню браузера. На iPad и
            iPhone: «Поделиться» → «На экран “Домой”».
          </p>
          <p className={styles.hint}>
            Для первой загрузки нужен интернет. После подготовки можно писать и
            открывать доски без сети, даже без установки.
          </p>
          <p className={styles.hint}>
            Записи хранятся в этом браузере. Установка не создаёт резервную
            копию: скачивайте JSON-копии важных досок.
          </p>
        </div>
      )}
    </>
  );
};
