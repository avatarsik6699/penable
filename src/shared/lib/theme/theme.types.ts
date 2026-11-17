export namespace ThemeTypes {
  export type Effective = "light" | "dark";

  export type Preference = Effective | "system";

  export type Snapshot = Readonly<{
    preference: Preference;
    theme: Effective;
    persistenceUnavailable: boolean;
  }>;
}
