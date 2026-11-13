import type { WritingSurfaceTypes } from "../../writing-surface.types";
import type { SurfaceElements } from "../../native";

type ExtraProps = {
  bindBackground: (node: SurfaceElements["background"]) => void;
  bindCompleted: (node: SurfaceElements["completed"]) => void;
  bindCanvas: (node: SurfaceElements["canvas"]) => void;
  bindSelectionPath: (node: SurfaceElements["selectionPath"]) => void;
};

export namespace SurfaceLayersTypes {
  export type Props = Pick<WritingSurfaceTypes.Props, "background" | "tool"> &
    ExtraProps;
}
