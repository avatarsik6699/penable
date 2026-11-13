import type { PenToolbarTypes } from "../../pen-toolbar.types";
import type { OverlayElements } from "~/shared/lib/overlay";

export namespace ToolControlsTypes {
  export type Props = Pick<
    PenToolbarTypes.Props,
    | "tool"
    | "onToolChange"
    | "readOnly"
    | "historyState"
    | "selectionDisabled"
    | "penOpen"
  > & {
    onPenParameters: () => void;
    bindPenTrigger: (node: OverlayElements.Button | null) => void;
  };
}
