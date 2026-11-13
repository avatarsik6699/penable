import type React from "react";
import { BoardCover } from "../board-cover";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import { useState } from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { BoardRowTypes } from "./board-row.types";
import styles from "./board-row.module.css";

export const BoardRow: React.FC<BoardRowTypes.Props> = (props) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const menu = usePanelDismiss({
    open: menuOpen,
    onClose: () => setMenuOpen(false),
  });

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
    <li className={styles.row} data-board-id={props.id}>
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
            <BoardCover appearance={props.appearance} />
            <span className={styles.name}>
              {props.title}
              {props.active && <small>Открыта</small>}
            </span>
          </Button>
          <div className={styles.actions} ref={(node) => menu.bindRoot(node)}>
            <Button
              autoFocus={props.restoreFocus}
              ref={(node) => menu.bindTrigger(node)}
              aria-label={`Действия доски: ${props.title}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={props.disabled}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <EditorIcon name="more" />
            </Button>
            {menuOpen && (
              <div
                className={styles.menu}
                role="menu"
                aria-label={`Действия доски: ${props.title}`}
              >
                <Button
                  role="menuitem"
                  aria-label={`Оформление доски: ${props.title}`}
                  onClick={() => {
                    if (props.disabled) return;

                    setMenuOpen(false);
                    props.onAppearance();
                  }}
                >
                  Оформление
                </Button>
                <Button
                  role="menuitem"
                  aria-label={`Переименовать доску: ${props.title}`}
                  onClick={() => {
                    setMenuOpen(false);
                    setTitle(props.title);
                    setEditing(true);
                  }}
                >
                  Переименовать
                </Button>
                <Button
                  role="menuitem"
                  aria-label={`Удалить доску: ${props.title}`}
                  disabled={props.last}
                  onClick={() => {
                    setMenuOpen(false);
                    props.onDelete();
                  }}
                >
                  Удалить
                </Button>
              </div>
            )}
          </div>
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
