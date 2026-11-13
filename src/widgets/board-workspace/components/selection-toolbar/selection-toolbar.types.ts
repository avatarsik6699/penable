import type {
  SelectionCommand,
  SelectionState,
} from "../../model/workspace-model.types";
import type { SelectionShape } from "~/entities/board";

export namespace SelectionToolbarTypes {
  export type Props = {
    state: SelectionState;
    shape: SelectionShape;
    readOnly: boolean;
    blocked: boolean;
    onShape: (shape: SelectionShape) => void;
    onCommand: (command: SelectionCommand) => void;
    onCancelActiveInput: () => void;
    onOverlayChange: () => void;
  };
}
