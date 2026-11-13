import { useState } from "react";
import { TransformControls } from "../transform-controls";
import type React from "react";
import type { SelectionActionsTypes } from "./selection-actions.types";
import styles from "./selection-actions.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const SelectionActions: React.FC<SelectionActionsTypes.Props> = (
  props,
) => {
  const [transformOpen, setTransformOpen] = useState(false);

  return (
    <div
      ref={(node) => props.bindPanel(node)}
      id="selection-menu"
      className={styles.menu}
      role="dialog"
      aria-label="Действия с выделением"
    >
      <div className={styles.heading}>Выделенная область</div>
      <div
        className={styles.actions}
        role="group"
        aria-label="Редактирование фрагмента"
      >
        <Button
          className={styles["action"]}
          disabled={props.busy}
          onClick={() => props.command("all")}
        >
          <EditorIcon name="selection" />
          <span>Выделить всё</span>
          <kbd aria-hidden="true">Ctrl+A</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || !props.state.selected}
          onClick={() => props.command("copy")}
        >
          <EditorIcon name="copy" />
          <span>Копировать</span>
          <kbd aria-hidden="true">Ctrl+C</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || props.readOnly || !props.state.selected}
          onClick={() => props.command("cut")}
        >
          <EditorIcon name="cut" />
          <span>Вырезать</span>
          <kbd aria-hidden="true">Ctrl+X</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || props.readOnly || !props.state.clipboard}
          onClick={() => props.command("paste")}
        >
          <EditorIcon name="paste" />
          <span>Вставить</span>
          <kbd aria-hidden="true">Ctrl+V</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || props.readOnly || !props.state.selected}
          onClick={() => props.command("duplicate")}
        >
          <EditorIcon name="duplicate" />
          <span>Дублировать</span>
          <kbd aria-hidden="true">Ctrl+D</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || !props.state.selected}
          onClick={() => props.command("image")}
        >
          <EditorIcon name="image" />
          <span>Копировать изображение</span>
          <kbd aria-hidden="true"></kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={props.busy || !props.state.png}
          onClick={() => props.command("download")}
        >
          <EditorIcon name="download" />
          <span>Скачать PNG</span>
          <kbd aria-hidden="true"></kbd>
        </Button>
        <Button
          className={styles.action}
          disabled={props.busy || props.readOnly || !props.state.selected}
          aria-expanded={transformOpen}
          onClick={() => setTransformOpen(!transformOpen)}
        >
          <EditorIcon name="fit" />
          <span>Преобразовать</span>
        </Button>
        {transformOpen && (
          <TransformControls
            disabled={props.busy || props.readOnly || !props.state.selected}
            onApply={props.onTransform}
          />
        )}
        <Button
          className={styles.action}
          disabled={props.busy || props.readOnly || !props.state.images}
          onClick={() => props.command("crop")}
        >
          <EditorIcon name="image" />
          <span>Обрезать изображения</span>
        </Button>
        <Button
          className={styles.action}
          disabled={props.busy || props.readOnly}
          onClick={() => props.command("paste-image")}
        >
          <EditorIcon name="paste" />
          <span>Изображение из буфера</span>
        </Button>
        <Button
          className={styles["destructive"]}
          disabled={props.busy || props.readOnly || !props.state.selected}
          onClick={() => props.command("delete")}
        >
          <EditorIcon name="trash" />
          <span>Удалить</span>
          <kbd aria-hidden="true">Del</kbd>
        </Button>
        <Button
          className={styles["action"]}
          disabled={
            props.blocked || (!props.state.selected && !props.state.busy)
          }
          onClick={() => props.command("clear")}
        >
          <EditorIcon name="close" />
          <span>Снять выделение</span>
          <kbd aria-hidden="true">Esc</kbd>
        </Button>
      </div>
      <p className={styles.help} role="status">
        {props.state.message ||
          "Обведите записи. Перетащите выделение или двигайте стрелками. Esc — отмена."}
      </p>
    </div>
  );
};
