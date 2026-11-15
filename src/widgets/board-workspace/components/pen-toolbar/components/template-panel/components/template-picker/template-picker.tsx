import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { BoardTemplates } from "~/entities/board";
import { Button } from "~/shared/ui/button";
import { ControlHint } from "~/shared/ui/control-hint";
import { TemplateIcon } from "./components/template-icon";
import type { TemplatePickerTypes } from "./template-picker.types";
import styles from "./template-picker.module.css";

export const TemplatePicker: React.FC<TemplatePickerTypes.Props> = (props) => (
  <div className={styles.picker}>
    <div className={styles.group} role="group" aria-label={I18n.t("shapes")}>
      {BoardTemplates.kinds.slice(0, 5).map((kind, index) => (
        <ControlHint
          key={kind}
          label={BoardTemplates.names[kind]}
          align={index === 0 ? "start" : undefined}
        >
          <Button
            aria-label={I18n.text(BoardTemplates.names[kind])}
            aria-pressed={props.value === kind}
            disabled={props.disabled}
            onClick={() => props.onChange(kind)}
          >
            <TemplateIcon kind={kind} />
          </Button>
        </ControlHint>
      ))}
    </div>
    <span className={styles.divider} aria-hidden="true" />
    <div className={styles.group} role="group" aria-label={I18n.t("math")}>
      {BoardTemplates.kinds.slice(5).map((kind) => (
        <ControlHint key={kind} label={BoardTemplates.names[kind]} align="end">
          <Button
            aria-label={I18n.text(BoardTemplates.names[kind])}
            aria-pressed={props.value === kind}
            disabled={props.disabled}
            onClick={() => props.onChange(kind)}
          >
            <TemplateIcon kind={kind} />
          </Button>
        </ControlHint>
      ))}
    </div>
    <span className={styles.current} aria-live="polite">
      {I18n.text(BoardTemplates.names[props.value])}
    </span>
  </div>
);
