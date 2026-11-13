import { Button } from "~/shared/ui/button";
import styles from "./selection-toolbar.module.css";
import type React from "react";
import type { SelectionToolbarTypes } from "./selection-toolbar.types";
import { useSelectionToolbar } from "../model/selection-toolbar-model";

export const SelectionToolbar: React.FC<SelectionToolbarTypes.Props> = (
  props,
) => {
  const toolbar = useSelectionToolbar(props);
  return (
    <div
      ref={(node) => {
        toolbar.bindRoot(node);
      }}
      className={styles["selection-toolbar"]}
      data-board-selection-toolbar=""
      role="region"
      aria-label="Действия выделения"
    >
      <div
        className={styles["selection-actions"]}
        role="group"
        aria-label="Способ выделения"
      >
        <Button
          type="button"
          aria-pressed={props.shape === "rectangle"}
          disabled={toolbar.busy}
          onClick={() => toolbar.changeShape("rectangle")}
        >
          Рамка
        </Button>
        <Button
          type="button"
          aria-pressed={props.shape === "lasso"}
          disabled={toolbar.busy}
          onClick={() => toolbar.changeShape("lasso")}
        >
          Лассо
        </Button>
        <Button
          ref={(node) => {
            toolbar.bindTrigger(node);
          }}
          type="button"
          aria-expanded={toolbar.open}
          aria-controls="selection-menu"
          disabled={props.blocked}
          onClick={() => toolbar.setOpen((value) => !value)}
        >
          Действия
        </Button>
      </div>
      {toolbar.open && (
        <div id="selection-menu" className={styles["selection-menu"]}>
          <div
            className={styles["selection-actions"]}
            role="group"
            aria-label="Редактирование фрагмента"
          >
            <Button
              type="button"
              disabled={toolbar.busy}
              onClick={() => toolbar.command("all")}
            >
              Выделить всё
            </Button>
            <Button
              type="button"
              disabled={toolbar.busy || !props.state.selected}
              onClick={() => toolbar.command("copy")}
            >
              Копировать
            </Button>
            <Button
              type="button"
              disabled={toolbar.busy || props.readOnly || !props.state.selected}
              onClick={() => toolbar.command("cut")}
            >
              Вырезать
            </Button>
            <Button
              type="button"
              disabled={
                toolbar.busy || props.readOnly || !props.state.clipboard
              }
              onClick={() => toolbar.command("paste")}
            >
              Вставить
            </Button>
            <Button
              type="button"
              disabled={toolbar.busy || props.readOnly || !props.state.selected}
              onClick={() => toolbar.command("duplicate")}
            >
              Дублировать
            </Button>
            <Button
              type="button"
              disabled={toolbar.busy || props.readOnly || !props.state.selected}
              onClick={() => toolbar.command("delete")}
            >
              Удалить
            </Button>
            <Button
              type="button"
              disabled={toolbar.busy || !props.state.selected}
              onClick={() => toolbar.command("image")}
            >
              Копировать изображение
            </Button>
            {props.state.png && (
              <Button
                type="button"
                disabled={toolbar.busy}
                onClick={() => toolbar.command("download")}
              >
                Скачать PNG
              </Button>
            )}
            <Button
              type="button"
              disabled={
                props.blocked || (!props.state.selected && !props.state.busy)
              }
              onClick={() => toolbar.command("clear")}
            >
              Снять выделение
            </Button>
          </div>
          <p className={styles["selection-help"]} role="status">
            {props.state.message ||
              "Обведите записи. Перетащите выделение или двигайте стрелками. Esc — отмена."}
          </p>
        </div>
      )}
      {!toolbar.open && props.state.message && (
        <p className={styles["selection-feedback"]} role="status">
          {props.state.message}
        </p>
      )}
    </div>
  );
};
