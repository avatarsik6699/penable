import type { ThemePreferences } from "./adapters/theme-platform";
import type { LocalePreferences } from "./adapters/locale-platform";

export namespace AppTypes {
  export type Props = { locale: LocalePreferences; theme: ThemePreferences };
}
