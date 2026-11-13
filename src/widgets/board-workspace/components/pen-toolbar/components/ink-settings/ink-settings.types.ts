import type { PenToolbarTypes } from "../../pen-toolbar.types";

export namespace InkSettingsTypes {
  export type Props = Pick<
    PenToolbarTypes.Props,
    | "width"
    | "readOnly"
    | "onWidthChange"
    | "stabilization"
    | "onStabilizationChange"
  >;
}
