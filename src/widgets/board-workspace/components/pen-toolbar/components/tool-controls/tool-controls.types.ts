import type { PenToolbarTypes } from "../../pen-toolbar.types";

export namespace ToolControlsTypes {
  export type Props = Pick<
    PenToolbarTypes.Props,
    "tool" | "onToolChange" | "readOnly" | "historyState" | "selectionDisabled"
  >;
}
