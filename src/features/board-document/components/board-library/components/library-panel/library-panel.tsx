import type React from "react";
import { useState } from "react";
import { useLibraryDelete } from "./hooks/use-library-delete";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { AppearanceEditor } from "../appearance-editor";
import { BoardRow } from "../board-row";
import { DeleteBoardDialog } from "../delete-board-dialog";
import type { LibraryPanelTypes } from "./library-panel.types";
import styles from "./library-panel.module.css";

export const LibraryPanel: React.FC<LibraryPanelTypes.Props> = (props) => {
  const [search, setSearch] = useState(""),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [error, setError] = useState("");

  const deletion = useLibraryDelete(props);

  const boards = props.state.boards.filter((board) =>
    board.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  const [appearanceId, setAppearanceId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const appearanceBoard = props.state.boards.find(
    (board) => board.id === appearanceId,
  );

  const returnToList = () => {
    setRestoreId(appearanceId);
    setAppearanceId(null);
  };

  const beginCreate = () => {
    let suffix = 1,
      next = "Моя доска";

    while (props.state.boards.some((board) => board.title === next))
      next = `Моя доска ${++suffix}`;

    setTitle(next);
    setCreating(true);
  };

  const disabled = props.readOnly || props.blocked || props.state.busy;

  const run = async (action: () => Promise<void>, close = false) => {
    try {
      setError("");
      await action();

      if (close) {
        setCreating(false);
        props.onOpenChange(false);
        props.focusTrigger();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось изменить библиотеку досок.",
      );
    }
  };

  return (
    <>
      <div
        className={styles.panel}
        id="board-library"
        role="complementary"
        aria-label="Мои доски"
      >
        <div className={styles.heading}>
          {appearanceBoard ? <span>Оформление</span> : <h2>Мои доски</h2>}
          <Button
            aria-label="Закрыть список досок"
            onClick={props.closeAndFocus}
          >
            <EditorIcon name="close" />
          </Button>
        </div>
        {appearanceBoard ? (
          <AppearanceEditor
            key={appearanceBoard.id}
            {...appearanceBoard}
            disabled={disabled}
            onSave={props.onAppearance}
            onReturn={returnToList}
          />
        ) : (
          <>
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
            <ul className={styles.list}>
              {boards.map((board) => (
                <BoardRow
                  key={board.id}
                  {...board}
                  restoreFocus={restoreId === board.id}
                  onAppearance={() => {
                    setError("");
                    setAppearanceId(board.id);
                  }}
                  active={board.id === props.state.activeId}
                  disabled={disabled}
                  last={props.state.boards.length === 1}
                  onSwitch={() =>
                    void run(() => props.onSwitch(board.id), true)
                  }
                  onRename={(title) => props.onRename(board.id, title)}
                  onDelete={() => {
                    setError("");
                    deletion.begin(board);
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
          </>
        )}
        {!appearanceBoard && (error || props.state.message) && (
          <p className={styles.error} role="alert">
            {error || props.state.message}
          </p>
        )}
      </div>
      {deletion.board && (
        <DeleteBoardDialog
          title={deletion.board.title}
          busy={props.state.busy}
          error={error}
          onCancel={deletion.cancel}
          onConfirm={() =>
            void run(async () => {
              await props.onDelete(deletion.board!.id);
              deletion.cancel();
            }, true)
          }
        />
      )}
    </>
  );
};
