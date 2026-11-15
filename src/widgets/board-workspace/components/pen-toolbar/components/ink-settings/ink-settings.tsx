import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import type { InkSettingsTypes } from "./ink-settings.types";
import styles from "./ink-settings.module.css";
import { RangeInput } from "~/shared/ui/range-input";

export const InkSettings: React.FC<InkSettingsTypes.Props> = (props) => (
  <div className={styles.width}>
    <button
      className={styles.preview}
      type="button"
      aria-label={I18n.t("chooseColor")}
      title={I18n.t("colorAndSettings")}
      disabled={props.readOnly}
      onClick={props.onColor}
    >
      <span
        style={{
          width: Math.min(16, props.width),
          height: Math.min(16, props.width),
          background: props.color,
        }}
      />
    </button>
    <label className={styles.hidden} htmlFor="pen-width">
      {I18n.t("width")}
    </label>
    <RangeInput
      id="pen-width"
      min={props.highlighter ? "4" : "0.5"}
      max={props.highlighter ? "64" : "12"}
      step="0.1"
      value={props.width}
      disabled={props.readOnly}
      aria-valuetext={I18n.text(
        Messages.create("valuePixels", { p0: props.width.toFixed(1) }),
      )}
      onChange={(event) => props.onWidthChange(Number(event.target.value))}
    />
    <output htmlFor="pen-width">
      {I18n.text(props.width.toFixed(1))}
      <span>px</span>
    </output>
  </div>
);
