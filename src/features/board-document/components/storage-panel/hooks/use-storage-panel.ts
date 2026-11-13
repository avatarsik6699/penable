import { useImportDialog } from "./use-import-dialog";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import type { StoragePanelTypes } from "../storage-panel.types";
import { useCallback, useEffect, useRef, useState } from "react";

export function useStoragePanel(props: StoragePanelTypes.Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<OverlayElements.Container>(null);
  const triggerRef = useRef<OverlayElements.Button>(null);
  const [notice, setNotice] = useState("");
  const notifyOverlay = props.onOverlayChange;

  useEffect(
    function overlayChangedFx() {
      notifyOverlay();
    },
    [popoverOpen, notifyOverlay],
  );

  useEffect(
    function storageDismissFx() {
      if (!popoverOpen) return;

      return Overlay.bindDismiss({
        roots: [popoverRef.current, triggerRef.current],
        onOutside: () => setPopoverOpen(false),

        onEscape: () => {
          if (Overlay.hasFocus(popoverRef.current))
            Overlay.focus(triggerRef.current);

          setPopoverOpen(false);
        },
      });
    },
    [popoverOpen],
  );

  const feedback = (message: string) => {
    setNotice(message);
    setPopoverOpen(true);
  };

  const closePopover = () => {
    setPopoverOpen(false);
    Overlay.focus(triggerRef.current);
  };

  const bindTrigger = useCallback((node: OverlayElements.Button | null) => {
    triggerRef.current = node;
  }, []);

  const bindPopover = useCallback((node: OverlayElements.Container | null) => {
    popoverRef.current = node;
  }, []);

  const importDialog = useImportDialog(
    props,
    feedback,
    () => {
      setNotice("");
      setPopoverOpen(false);
    },
    () => {
      setPopoverOpen(true);

      setNotice(
        "Доска заменена. Прежняя запись сохранена. Кнопка «Копия до замены» проверит возможность скачивания.",
      );
    },
  );

  return {
    importDialog,
    closePopover,
    feedback,
    bindTrigger,
    popoverOpen,
    setPopoverOpen,
    bindPopover,
    notice,
  };
}
