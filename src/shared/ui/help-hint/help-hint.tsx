import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { useId, useState } from "react";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { HelpHintTypes } from "./help-hint.types";
import styles from "./help-hint.module.css";

export const HelpHint: React.FC<HelpHintTypes.Props> = (props) => {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={styles.anchor}
      data-open={visible || undefined}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => {
        if (!pinned) setVisible(false);
      }}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={I18n.text(props.label)}
        aria-describedby={id}
        onFocus={() => setVisible(true)}
        onBlur={() => {
          setVisible(false);
          setPinned(false);
        }}
        onClick={() => {
          setPinned(!pinned);
          setVisible(!pinned);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && visible) {
            event.stopPropagation();
            setPinned(false);
            setVisible(false);
          }
        }}
      >
        <EditorIcon name="help" />
      </button>
      <span id={id} role="tooltip" className={styles.hint}>
        {I18n.text(props.text)}
      </span>
    </span>
  );
};
