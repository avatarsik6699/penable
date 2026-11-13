import type { PenToolbarTypes } from "../../pen-toolbar.types";

export namespace ViewportControlsTypes {
  export type Props = Pick<
    PenToolbarTypes.Props,
    | "onZoomOut"
    | "historyState"
    | "diagnostics"
    | "onResetView"
    | "onZoomIn"
    | "selectionDisabled"
    | "onFitAll"
  >;
}
