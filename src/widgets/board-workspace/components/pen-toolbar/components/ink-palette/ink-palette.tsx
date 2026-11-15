import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { BoardWriting } from "~/entities/board";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { InkPaletteTypes } from "./ink-palette.types";
import styles from "./ink-palette.module.css";

export const InkPalette: React.FC<InkPaletteTypes.Props> = (props) => (
  <div
    className={styles.palette}
    data-compact={props.compact || undefined}
    role="group"
    aria-label={I18n.text(props.label ?? Messages.create("lineColor"))}
  >
    {BoardWriting.palette.map((entry) => (
      <button
        type="button"
        key={entry.color}
        className={styles.swatch}
        aria-label={I18n.text(
          Messages.create("valueValue", {
            p0: props.label ?? Messages.create("color"),
            p1: entry.label,
          }),
        )}
        aria-pressed={props.color === entry.color}
        title={I18n.text(entry.label)}
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
