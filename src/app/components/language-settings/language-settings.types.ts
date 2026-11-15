import type { I18nTypes } from "~/shared/lib/i18n";

export namespace LanguageSettingsTypes {
  export type Props = {
    snapshot: I18nTypes.Snapshot;
    onChange: (preference: I18nTypes.Preference) => void;
  };
}
