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
      aria-label={`Оформление доски: ${props.title}`}
    >
      <h2>Оформление доски: {props.title}</h2>
      <div className={styles.sample}>
        <BoardCover appearance={editor.draft} />
        <span>{props.title}</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void editor.save();
        }}
      >
        <fieldset disabled={props.disabled || editor.saving}>
          <legend>Цвет обложки</legend>
          <div className={styles.colors}>
            {BoardCoverConfig.colors.map((color) => (
              <label key={color.id} className={styles.option}>
                <input
                  autoFocus={editor.draft.color === color.id}
                  type="radio"
                  name="board-cover-color"
                  value={color.id}
                  aria-label={color.label}
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
          <legend>Значок обложки</legend>
          <div className={styles.icons}>
            {BoardCoverConfig.symbols.map((symbol) => (
              <label key={symbol.id} className={styles.option}>
                <input
                  type="radio"
                  name="board-cover-icon"
                  value={symbol.id}
                  aria-label={symbol.label}
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
            {editor.error}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" disabled={props.disabled || editor.saving}>
            Сохранить оформление
          </Button>
          <Button disabled={editor.saving} onClick={props.onReturn}>
            Отмена
          </Button>
        </div>
      </form>
    </section>
  );
};
