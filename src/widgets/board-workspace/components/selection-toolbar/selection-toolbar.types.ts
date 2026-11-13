import type {
  SelectionCommand,
  SelectionState,
} from "../../model/workspace-model.types";
import type { SelectionShape } from "~/entities/board";

export namespace SelectionToolbarTypes {
  export type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    state: SelectionState;
    shape: SelectionShape;
    readOnly: boolean;
    blocked: boolean;
    onTransform: (width: number, height: number, angle: number) => void;
    onShape: (shape: SelectionShape) => void;
    onCommand: (command: SelectionCommand) => void;
    onCancelActiveInput: () => void;
    onOverlayChange: () => void;
  };
}
