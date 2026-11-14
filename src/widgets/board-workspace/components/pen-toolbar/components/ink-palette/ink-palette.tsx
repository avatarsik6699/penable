import type React from "react";
import { BoardWriting } from "~/entities/board";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { InkPaletteTypes } from "./ink-palette.types";
import styles from "./ink-palette.module.css";

export const InkPalette: React.FC<InkPaletteTypes.Props> = (props) => (
  <div
    className={styles.palette}
    role="group"
    aria-label={props.label ?? "Цвет линии"}
  >
    {BoardWriting.palette.map((entry) => (
      <button
        type="button"
        key={entry.color}
        className={styles.swatch}
        aria-label={`${props.label ?? "Цвет"}: ${entry.label}`}
        aria-pressed={props.color === entry.color}
        title={entry.label}
        disabled={props.disabled}
        onClick={() => props.onChange(entry.color)}
      >
        <span style={{ background: entry.color }} />
        {props.color === entry.color && (
          <span className={styles.selected} aria-hidden="true">
            <EditorIcon name="check" />
          </span>
        )}
      </button>
    ))}
  </div>
);
