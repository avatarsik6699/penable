import type React from "react";
import { I18n } from "~/shared/lib/i18n";
import type { LanguageSettingsTypes } from "./language-settings.types";
import styles from "./language-settings.module.css";

export const LanguageSettings: React.FC<LanguageSettingsTypes.Props> = (
  props,
) => (
  <div className={styles.root}>
    <label htmlFor="interface-language">{I18n.t("language")}</label>
    <select
      id="interface-language"
      value={props.snapshot.preference}
      onChange={(event) => props.onChange(I18n.preference(event.target.value))}
      aria-describedby="language-hint"
    >
      <option value="auto">{I18n.t("languageAuto")}</option>
      <option value="en" lang="en">
        English
      </option>
      <option value="ru" lang="ru">
        Русский
      </option>
    </select>
    <p id="language-hint">{I18n.t("languageHint")}</p>
    {props.snapshot.persistenceUnavailable && (
      <p role="status">{I18n.t("languageStorageUnavailable")}</p>
    )}
  </div>
);
