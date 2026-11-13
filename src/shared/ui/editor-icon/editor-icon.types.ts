export namespace EditorIconTypes {
  export type Name =
    | "chevron-down"
    | "pen"
    | "eraser"
    | "selection"
    | "undo"
    | "redo"
    | "more"
    | "check"
    | "close"
    | "copy"
    | "cut"
    | "paste"
    | "duplicate"
    | "image"
    | "download"
    | "upload"
    | "trash"
    | "history"
    | "device"
    | "retry"
    | "minus"
    | "plus"
    | "fit"
    | "help"
    | "settings"
    | "map"
    | "writing-return"
    | "lock";

  export type Props = { name: Name; className?: string };
}
