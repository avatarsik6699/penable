import type { SelectionCommand } from "../../../model/workspace-model.types";
import type { SelectionToolbarTypes } from "../selection-toolbar.types";
import type { SelectionShape } from "~/entities/board";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";

export function useSelectionActions(props: SelectionToolbarTypes.Props) {
  const panel = usePanelDismiss({
    open: props.open,
    onEscape: props.onCancelActiveInput,
    onClose: () => props.onOpenChange(false),
  });

  const busy = props.state.busy || props.blocked;

  const command = (value: SelectionCommand) => {
    props.onCommand(value);
    props.onOpenChange(false);
    panel.focusTrigger();
  };

  const changeShape = (value: SelectionShape) => {
    props.onShape(value);
    props.onOpenChange(false);
  };

  return { ...panel, busy, command, changeShape };
}
