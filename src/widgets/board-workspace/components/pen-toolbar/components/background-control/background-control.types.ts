import type { PenToolbarTypes } from "../../pen-toolbar.types";

export namespace BackgroundControlTypes {
  export type Props = Pick<
    PenToolbarTypes.Props,
    "background" | "readOnly" | "onBackgroundChange"
  >;
}
