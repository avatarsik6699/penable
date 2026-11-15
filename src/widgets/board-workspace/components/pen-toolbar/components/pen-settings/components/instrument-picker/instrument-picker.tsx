import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { ControlHint } from "~/shared/ui/control-hint";
import { InstrumentPickerConfig } from "./instrument-picker.config";
import type { InstrumentPickerTypes } from "./instrument-picker.types";
import styles from "./instrument-picker.module.css";

export const InstrumentPicker: React.FC<InstrumentPickerTypes.Props> = (
  props,
) => (
  <div
    className={styles.picker}
    role="radiogroup"
    aria-label={I18n.t("writingInstrument")}
  >
    {InstrumentPickerConfig.entries.map((entry) => (
      <ControlHint key={entry.value} label={entry.label}>
        <label className={styles.option}>
          <input
            type="radio"
            name="ink-instrument"
            aria-label={I18n.text(entry.label)}
            checked={props.value === entry.value}
            disabled={props.disabled}
            onChange={() => props.onChange(entry.value)}
          />
          <span className={styles.icon}>
            <EditorIcon name={entry.icon} />
          </span>
        </label>
      </ControlHint>
    ))}
  </div>
);
