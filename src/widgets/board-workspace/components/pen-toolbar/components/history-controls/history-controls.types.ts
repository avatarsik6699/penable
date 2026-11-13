import type { PenToolbarTypes } from "../../pen-toolbar.types";

export namespace HistoryControlsTypes {
  export type Props = Pick<
    PenToolbarTypes.Props,
    "onUndo" | "readOnly" | "historyState" | "onRedo"
  >;
}
