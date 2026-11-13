import type React from "react";
import { useState } from "react";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { BoardRow } from "./components/board-row";
import { DeleteBoardDialog } from "./components/delete-board-dialog";
import type { BoardLibraryTypes } from "./board-library.types";
import styles from "./board-library.module.css";

export const BoardLibrary: React.FC<BoardLibraryTypes.Props> = (props) => {
  const panel = usePanelDismiss({
    open: props.open,
    onClose: () => props.onOpenChange(false),
  });

  const [title, setTitle] = useState("Моя доска"),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState<{ id: string; title: string } | null>(
      null,
    );

  const active = props.state.boards.find(
    (board) => board.id === props.state.activeId,
  );

  const disabled = props.readOnly || props.blocked || props.state.busy;

  const run = async (action: () => Promise<void>, close = false) => {
    try {
      setError("");
      await action();

      if (close) {
        props.onOpenChange(false);
        panel.focusTrigger();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось изменить библиотеку досок.",
      );
    }
  };

  const cancelDelete = () => {
    setDeleting(null);
    props.onModalChange(false);
    panel.focusTrigger();
  };

  return (
    <div className={styles.owner}>
      <Button
        ref={(node) => panel.bindTrigger(node)}
        aria-label="Доски"
        title={active?.title ?? "Доски"}
        aria-expanded={props.open}
        aria-haspopup="dialog"
        disabled={props.blocked || props.state.busy}
        onClick={() => props.onOpenChange(!props.open)}
        className={styles.trigger}
      >
        <span>Доски</span>
        <span className={styles.current} data-testid="active-board-title">
          {active?.title ?? "Моя доска"}
        </span>
        <EditorIcon name="chevron-down" />
      </Button>
      {props.open && (
        <div
          ref={(node) => {
            panel.bindRoot(node);
            panel.bindPanel(node);
          }}
          className={styles.panel}
          role="dialog"
          aria-label="Мои доски"
        >
          <h2>Мои доски</h2>
          <ul className={styles.list}>
            {props.state.boards.map((board) => (
              <BoardRow
                key={board.id}
                {...board}
                active={board.id === props.state.activeId}
                disabled={disabled}
                last={props.state.boards.length === 1}
                onSwitch={() => void run(() => props.onSwitch(board.id), true)}
                onRename={(title) => props.onRename(board.id, title)}
                onDelete={() => {
                  setError("");
                  setDeleting(board);
                  props.onModalChange(true);
                }}
              />
            ))}
          </ul>
          <form
            className={styles.create}
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => props.onCreate(title), true);
            }}
          >
            <label>
              Новая доска
              <input
                aria-label="Название новой доски"
                value={title}
                maxLength={80}
                disabled={disabled || props.state.boards.length >= 100}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <Button
              className={styles.createButton}
              type="submit"
              disabled={
                disabled || !title.trim() || props.state.boards.length >= 100
              }
            >
              <EditorIcon name="plus" />
              Создать доску
            </Button>
          </form>
          {(error || props.state.message) && (
            <p className={styles.error} role="alert">
              {error || props.state.message}
            </p>
          )}
        </div>
      )}
      {deleting && (
        <DeleteBoardDialog
          title={deleting.title}
          busy={props.state.busy}
          error={error}
          onCancel={cancelDelete}
          onConfirm={() =>
            void run(async () => {
              await props.onDelete(deleting.id);
              cancelDelete();
            }, true)
          }
        />
      )}
    </div>
  );
};
