import type React from "react";
import type { SelectionActionsTypes } from "./selection-actions.types";
import styles from "./selection-actions.module.css";
import { Button } from "~/shared/ui/button";

export const SelectionActions: React.FC<SelectionActionsTypes.Props> = (
  props,
) => (
  <div id="selection-menu" className={styles["selection-menu"]}>
    <div
      className={styles["selection-actions"]}
      role="group"
      aria-label="Редактирование фрагмента"
    >
      <Button
        type="button"
        disabled={props.busy}
        onClick={() => props.command("all")}
      >
        Выделить всё
      </Button>
      <Button
        type="button"
        disabled={props.busy || !props.state.selected}
        onClick={() => props.command("copy")}
      >
        Копировать
      </Button>
      <Button
        type="button"
        disabled={props.busy || props.readOnly || !props.state.selected}
        onClick={() => props.command("cut")}
      >
        Вырезать
      </Button>
      <Button
        type="button"
        disabled={props.busy || props.readOnly || !props.state.clipboard}
        onClick={() => props.command("paste")}
      >
        Вставить
      </Button>
      <Button
        type="button"
        disabled={props.busy || props.readOnly || !props.state.selected}
        onClick={() => props.command("duplicate")}
      >
        Дублировать
      </Button>
      <Button
        type="button"
        disabled={props.busy || props.readOnly || !props.state.selected}
        onClick={() => props.command("delete")}
      >
        Удалить
      </Button>
      <Button
        type="button"
        disabled={props.busy || !props.state.selected}
        onClick={() => props.command("image")}
      >
        Копировать изображение
      </Button>
      {props.state.png && (
        <Button
          type="button"
          disabled={props.busy}
          onClick={() => props.command("download")}
        >
          Скачать PNG
        </Button>
      )}
      <Button
        type="button"
        disabled={props.blocked || (!props.state.selected && !props.state.busy)}
        onClick={() => props.command("clear")}
      >
        Снять выделение
      </Button>
    </div>
    <p className={styles["selection-help"]} role="status">
      {props.state.message ||
        "Обведите записи. Перетащите выделение или двигайте стрелками. Esc — отмена."}
    </p>
  </div>
);
