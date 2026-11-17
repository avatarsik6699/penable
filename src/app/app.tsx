import type React from "react";
import { useEffect, useSyncExternalStore } from "react";
import { AppAvailability } from "~/features/app-availability";
import { BoardWorkspace } from "~/widgets/board-workspace";
import { useI18n } from "~/shared/lib/i18n";
import { ThemeSettings } from "./components/theme-settings";
import { LanguageSettings } from "./components/language-settings";
import type { AppTypes } from "./app.types";

export const App: React.FC<AppTypes.Props> = (props) => {
  useI18n();

  const snapshot = useSyncExternalStore(
    props.locale.subscribe,
    props.locale.getSnapshot,
  );

  const theme = useSyncExternalStore(
    props.theme.subscribe,
    props.theme.getSnapshot,
  );

  useEffect(
    function themePreferencesFx() {
      return props.theme.start();
    },
    [props.theme],
  );

  useEffect(
    function localePreferencesFx() {
      return props.locale.start();
    },
    [props.locale],
  );

  return (
    <>
      <BoardWorkspace
        theme={theme.theme}
        themeSettings={
          <ThemeSettings snapshot={theme} onChange={props.theme.change} />
        }
        languageSettings={
          <LanguageSettings
            snapshot={snapshot}
            onChange={props.locale.change}
          />
        }
      />
      <AppAvailability />
    </>
  );
};
