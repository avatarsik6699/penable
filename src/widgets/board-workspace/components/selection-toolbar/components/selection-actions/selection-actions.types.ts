import type { SelectionToolbarTypes } from "../../selection-toolbar.types";
import type { SelectionCommand } from "../../../../model/workspace-model.types";

type ExtraProps = {
  busy: boolean;
  onClose: () => void;
  editText: () => void;
  command: (value: SelectionCommand) => void;
  bindPanel: (
    node: import("~/shared/lib/overlay").OverlayElements.Container | null,
  ) => void;
};

export namespace SelectionActionsTypes {
  export type Props = Pick<
    SelectionToolbarTypes.Props,
    "state" | "readOnly" | "blocked" | "onTransform"
  > &
    ExtraProps;
}
