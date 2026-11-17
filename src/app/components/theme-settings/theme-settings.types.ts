import type { ThemeTypes } from "~/shared/lib/theme";

export namespace ThemeSettingsTypes {
  export type Props = {
    snapshot: ThemeTypes.Snapshot;
    onChange: (preference: ThemeTypes.Preference) => void;
  };
}
