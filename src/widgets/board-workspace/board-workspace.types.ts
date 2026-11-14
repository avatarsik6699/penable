export namespace BoardWorkspaceTypes {
  export type Panel =
    | "pen"
    | "templates"
    | "selection"
    | "board"
    | "save"
    | "help"
    | "library"
    | null;

  export type Props = Record<string, never>;
}
