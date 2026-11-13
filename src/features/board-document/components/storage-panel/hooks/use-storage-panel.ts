import { useState } from "react";
import { useImportDialog } from "./use-import-dialog";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import type { StoragePanelTypes } from "../storage-panel.types";

export function useStoragePanel(props: StoragePanelTypes.Props) {
  const [notice, setNotice] = useState("");

  const board = usePanelDismiss({
    open: props.openPanel === "board",
    onClose: () => props.onPanelChange(null),
  });

  const save = usePanelDismiss({
    open: props.openPanel === "save",
    onClose: () => props.onPanelChange(null),
  });

  const feedback = (message: string) => {
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
      setNotice(
        "Доска заменена. Прежняя запись сохранена. Кнопка «Копия до замены» проверит возможность скачивания.",
      );

      props.onPanelChange("save");
    },
    () => {
      if (props.openPanel === "save") save.focusTrigger();
      else board.focusTrigger();
    },
  );

  return { board, save, notice, feedback, importDialog };
}
