export namespace I18nTypes {
  export type Language = "en" | "ru";

  export type Preference = "auto" | Language;

  export type Snapshot = Readonly<{
    preference: Preference;
    language: Language;
    persistenceUnavailable: boolean;
  }>;
}
