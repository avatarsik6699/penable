import type { WritingSurfaceTypes } from "../../writing-surface.types";
import type { SurfaceElements } from "../../native";

type ExtraProps = {
  bindCursor: (node: SurfaceElements["cursor"]) => void;
  bindFocusBadge: (node: SurfaceElements["focusBadge"]) => void;
};

export namespace BoardCursorViewTypes {
  export type Props = Pick<WritingSurfaceTypes.Props, never> & ExtraProps;
}
