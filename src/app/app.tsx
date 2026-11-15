import type React from "react";
import { useEffect, useSyncExternalStore } from "react";
import { AppAvailability } from "~/features/app-availability";
import { BoardWorkspace } from "~/widgets/board-workspace";
import { useI18n } from "~/shared/lib/i18n";
import { LanguageSettings } from "./components/language-settings";
import type { AppTypes } from "./app.types";

export const App: React.FC<AppTypes.Props> = (props) => {
  useI18n();

  const snapshot = useSyncExternalStore(
    props.locale.subscribe,
    props.locale.getSnapshot,
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
