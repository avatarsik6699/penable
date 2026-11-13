import type React from "react";
import { useLibraryPreviews } from "./hooks/use-library-previews";
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

  const [search, setSearch] = useState(""),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState<{ id: string; title: string } | null>(
      null,
    );

  const boards = props.state.boards.filter((board) =>
    board.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  const previewRoot = useLibraryPreviews(
    props,
    boards.map((board) => board.id).join(","),
  );

  const beginCreate = () => {
    let suffix = 1,
      next = "Моя доска";

    while (props.state.boards.some((board) => board.title === next))
      next = `Моя доска ${++suffix}`;

    setTitle(next);
    setCreating(true);
  };

  const active = props.state.boards.find(
    (board) => board.id === props.state.activeId,
  );

  const disabled = props.readOnly || props.blocked || props.state.busy;

  const run = async (action: () => Promise<void>, close = false) => {
    try {
      setError("");
      await action();

      if (close) {
        setCreating(false);
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
        aria-controls="board-library"
        disabled={props.blocked || props.state.busy}
        onClick={() => props.onOpenChange(!props.open)}
        className={styles.trigger}
      >
        <span className={styles.label}>Доски</span>
        <span className={styles.current} data-testid="active-board-title">
          {active?.title ?? "Моя доска"}
        </span>
        <EditorIcon name="chevron-down" />
      </Button>
      {props.open && (
        <div
          ref={(node) => panel.bindRoot(node)}
          className={styles.panel}
          id="board-library"
          role="complementary"
          aria-label="Мои доски"
        >
          <div className={styles.heading}>
            <h2>Мои доски</h2>
            <Button
              aria-label="Закрыть список досок"
              onClick={panel.closeAndFocus}
            >
              <EditorIcon name="close" />
            </Button>
          </div>
          <input
            className={styles.search}
            type="search"
            aria-label="Поиск досок"
            placeholder="Поиск по названию"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            className={styles.createButton}
            onClick={beginCreate}
            disabled={disabled || props.state.boards.length >= 100}
          >
            <EditorIcon name="plus" />
            Новая доска
          </Button>
          {creating && (
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
                  autoFocus
                  aria-label="Название новой доски"
                  value={title}
                  maxLength={80}
                  disabled={disabled}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className={styles.createActions}>
                <Button type="submit" disabled={disabled || !title.trim()}>
                  Создать доску
                </Button>
                <Button
                  onClick={() => setCreating(false)}
                  disabled={props.state.busy}
                >
                  Отмена
                </Button>
              </div>
            </form>
          )}
          <ul ref={previewRoot} className={styles.list}>
            {boards.map((board) => (
              <BoardRow
                key={board.id}
                {...board}
                preview={props.state.previews?.[board.id]}
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
          {!boards.length && (
            <p className={styles.empty} role="status">
              {props.state.boards.length
                ? "Доски не найдены"
                : "Загрузка досок…"}
            </p>
          )}
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
