import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { Button } from "~/shared/ui/button";
import { BoardCover, BoardCoverConfig } from "../board-cover";
import { useAppearanceEditor } from "./hooks/use-appearance-editor";
import type { AppearanceEditorTypes } from "./appearance-editor.types";
import styles from "./appearance-editor.module.css";

export const AppearanceEditor: React.FC<AppearanceEditorTypes.Props> = (
  props,
) => {
  const editor = useAppearanceEditor(props);

  return (
    <section
      className={styles.editor}
      aria-label={I18n.text(
        Messages.create("boardAppearanceValue", { p0: props.title }),
      )}
    >
      <h2>{I18n.t("boardAppearanceValue", { p0: props.title })}</h2>
      <div className={styles.sample}>
        <BoardCover appearance={editor.draft} />
        <span>{I18n.text(props.title)}</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void editor.save();
        }}
      >
        <fieldset disabled={props.disabled || editor.saving}>
          <legend>{I18n.t("coverColor")}</legend>
          <div className={styles.colors}>
            {BoardCoverConfig.colors.map((color) => (
              <label key={color.id} className={styles.option}>
                <input
                  autoFocus={editor.draft.color === color.id}
                  type="radio"
                  name="board-cover-color"
                  value={color.id}
                  aria-label={I18n.text(color.label)}
                  checked={editor.draft.color === color.id}
                  onChange={() =>
                    editor.setDraft({ ...editor.draft, color: color.id })
                  }
                />
                <span className={styles.choice}>
                  <BoardCover
                    appearance={{ color: color.id, icon: editor.draft.icon }}
                  />
                  <span className={styles.marker} aria-hidden="true">
                    <EditorIcon name="check" />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={props.disabled || editor.saving}>
          <legend>{I18n.t("coverIcon")}</legend>
          <div className={styles.icons}>
            {BoardCoverConfig.symbols.map((symbol) => (
              <label key={symbol.id} className={styles.option}>
                <input
                  type="radio"
                  name="board-cover-icon"
                  value={symbol.id}
                  aria-label={I18n.text(symbol.label)}
                  checked={editor.draft.icon === symbol.id}
                  onChange={() =>
                    editor.setDraft({ ...editor.draft, icon: symbol.id })
                  }
                />
                <span className={styles.choice}>
                  <BoardCover
                    appearance={{ color: editor.draft.color, icon: symbol.id }}
                  />
                  <span className={styles.marker} aria-hidden="true">
                    <EditorIcon name="check" />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {editor.error && (
          <p role="alert" className={styles.error}>
            {I18n.text(editor.error)}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" disabled={props.disabled || editor.saving}>
            {I18n.t("saveAppearance")}
          </Button>
          <Button disabled={editor.saving} onClick={props.onReturn}>
            {I18n.t("cancel")}
          </Button>
        </div>
      </form>
    </section>
  );
};
