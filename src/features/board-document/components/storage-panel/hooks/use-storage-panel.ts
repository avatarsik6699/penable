import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { useState } from "react";
import { useImportDialog } from "./use-import-dialog";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import type { StoragePanelTypes } from "../storage-panel.types";

export function useStoragePanel(props: StoragePanelTypes.Props) {
  const [notice, setNotice] = useState<MessageTypes.Value>("");

  const board = usePanelDismiss({
    open: props.openPanel === "board",
    onClose: () => props.onPanelChange(null),
  });

  const save = usePanelDismiss({
    open: props.openPanel === "save",
    onClose: () => props.onPanelChange(null),
  });

  const feedback = (message: MessageTypes.Value) => {
    setNotice(message);
    props.onPanelChange("save");
  };

  const importDialog = useImportDialog(
    props,
    feedback,
    () => {
      setNotice("");
      props.onPanelChange(null);
    },
    () => {
      setNotice(Messages.create("boardReplacedThePreviousRecordIsRetained"));
      props.onPanelChange("save");
    },
    () => {
      if (props.openPanel === "save") save.focusTrigger();
      else board.focusTrigger();
    },
  );

  return { board, save, notice, feedback, importDialog };
}
