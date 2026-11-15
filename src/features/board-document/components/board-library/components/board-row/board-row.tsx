import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
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
    [error, setError] = useState<MessageTypes.Value>("");

  const save = async () => {
    try {
      await props.onRename(title);
      setEditing(false);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? Messages.from(error)
          : Messages.create("couldNotRenameTheBoard"),
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
            aria-label={I18n.t("boardName")}
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={props.disabled}
          />
          <Button type="submit" disabled={props.disabled || !title.trim()}>
            {I18n.t("saveName")}
          </Button>
          <Button disabled={props.disabled} onClick={() => setEditing(false)}>
            {I18n.t("cancel")}
          </Button>
        </form>
      ) : (
        <>
          <Button
            className={styles.title}
            aria-label={I18n.text(
              Messages.create("openBoardValue", { p0: props.title }),
            )}
            aria-current={props.active ? "page" : undefined}
            disabled={props.disabled || props.active}
            onClick={props.onSwitch}
          >
            <BoardCover appearance={props.appearance} />
            <span className={styles.name}>
              {I18n.text(props.title)}
              {props.active && <small>{I18n.t("open")}</small>}
            </span>
          </Button>
          <div className={styles.actions} ref={(node) => menu.bindRoot(node)}>
            <Button
              autoFocus={props.restoreFocus}
              ref={(node) => menu.bindTrigger(node)}
              aria-label={I18n.text(
                Messages.create("boardActionsValue", { p0: props.title }),
              )}
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
                aria-label={I18n.text(
                  Messages.create("boardActionsValue", { p0: props.title }),
                )}
              >
                <Button
                  role="menuitem"
                  aria-label={I18n.text(
                    Messages.create("boardAppearanceValue", {
                      p0: props.title,
                    }),
                  )}
                  onClick={() => {
                    if (props.disabled) return;

                    setMenuOpen(false);
                    props.onAppearance();
                  }}
                >
                  {I18n.t("appearance")}
                </Button>
                <Button
                  role="menuitem"
                  aria-label={I18n.text(
                    Messages.create("renameBoardValue", { p0: props.title }),
                  )}
                  onClick={() => {
                    setMenuOpen(false);
                    setTitle(props.title);
                    setEditing(true);
                  }}
                >
                  {I18n.t("rename")}
                </Button>
                <Button
                  role="menuitem"
                  aria-label={I18n.text(
                    Messages.create("deleteBoardValue", { p0: props.title }),
                  )}
                  disabled={props.last}
                  onClick={() => {
                    setMenuOpen(false);
                    props.onDelete();
                  }}
                >
                  {I18n.t("delete")}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {I18n.text(error)}
        </p>
      )}
    </li>
  );
};
