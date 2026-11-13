import type { SelectionToolbarTypes } from "../../selection-toolbar.types";
import type { SelectionCommand } from "../../../../model/workspace-model.types";

type ExtraProps = { busy: boolean; command: (value: SelectionCommand) => void };

export namespace SelectionActionsTypes {
  export type Props = Pick<
    SelectionToolbarTypes.Props,
    "state" | "readOnly" | "blocked"
  > &
    ExtraProps;
}
