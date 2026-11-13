import type React from "react";
import { useState } from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { BoardRowTypes } from "./board-row.types";
import styles from "./board-row.module.css";

export const BoardRow: React.FC<BoardRowTypes.Props> = (props) => {
  const [editing, setEditing] = useState(false),
    [title, setTitle] = useState(props.title),
    [error, setError] = useState("");

  const save = async () => {
    try {
      await props.onRename(title);
      setEditing(false);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось изменить название.",
      );
    }
  };

  return (
    <li className={styles.row}>
      {editing ? (
        <form
          className={styles.rename}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            autoFocus
            aria-label="Название доски"
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={props.disabled}
          />
          <Button type="submit" disabled={props.disabled || !title.trim()}>
            Сохранить название
          </Button>
          <Button disabled={props.disabled} onClick={() => setEditing(false)}>
            Отмена
          </Button>
        </form>
      ) : (
        <>
          <Button
            className={styles.title}
            aria-label={`Открыть доску: ${props.title}`}
            aria-current={props.active ? "page" : undefined}
            disabled={props.disabled || props.active}
            onClick={props.onSwitch}
          >
            {props.active && <EditorIcon name="check" />}
            <span>{props.title}</span>
          </Button>
          <Button
            aria-label={`Переименовать доску: ${props.title}`}
            title="Переименовать"
            disabled={props.disabled}
            onClick={() => {
              setTitle(props.title);
              setEditing(true);
            }}
          >
            <EditorIcon name="pen" />
          </Button>
          <Button
            aria-label={`Удалить доску: ${props.title}`}
            title="Удалить доску"
            disabled={props.disabled || props.last}
            onClick={props.onDelete}
          >
            <EditorIcon name="trash" />
          </Button>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
};
