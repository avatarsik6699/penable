import type React from "react";
import { I18n } from "~/shared/lib/i18n";
import { Theme } from "~/shared/lib/theme";
import type { ThemeSettingsTypes } from "./theme-settings.types";
import styles from "./theme-settings.module.css";

export const ThemeSettings: React.FC<ThemeSettingsTypes.Props> = (props) => (
  <div className={styles.root}>
    <label htmlFor="interface-theme">{I18n.t("theme")}</label>
    <select
      id="interface-theme"
      value={props.snapshot.preference}
      onChange={(event) => props.onChange(Theme.preference(event.target.value))}
      aria-describedby="theme-hint"
    >
      <option value="light">{I18n.t("themeLight")}</option>
      <option value="dark">{I18n.t("themeDark")}</option>
      <option value="system">{I18n.t("themeSystem")}</option>
    </select>
    <p id="theme-hint">{I18n.t("themeHint")}</p>
    {props.snapshot.persistenceUnavailable && (
      <p role="status">{I18n.t("themeStorageUnavailable")}</p>
    )}
  </div>
);
