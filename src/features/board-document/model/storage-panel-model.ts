import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import { StorageFiles, type DocumentFile } from "../adapters/storage-files";
import type { StoragePanelTypes } from "../ui/storage-panel.types";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentCodec } from "../model/codec";
import { DocumentErrors } from "../model/session";
import type { BoardDocument } from "../model/types";
export function useStoragePanel(props: StoragePanelTypes.Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<OverlayElements.Container>(null);
  const triggerRef = useRef<OverlayElements.Button>(null);
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<BoardDocument | null>(null);
  const [reading, setReading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<OverlayElements.Dialog>(null);
  const lifetime = useRef({ mounted: false, readGeneration: 0 });
  useEffect(function storageLifetimeFx() {
    const current = lifetime.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.readGeneration++;
    };
  }, []);
  useEffect(
    function importDialogFx() {
      if (!open) return;
      return Overlay.modal(dialogRef.current);
    },
    [open],
  );
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
  const close = () => {
    if (confirming || props.state.importing) return;
    lifetime.current.readGeneration++;
    setOpen(false);
    setCandidate(null);
    setReading(false);
    setError("");
    props.onEndImport();
  };
  const begin = () => {
    const reason = props.onBeginImport();
    if (reason) {
      feedback(reason);
      return;
    }
    setNotice("");
    setError("");
    setCandidate(null);
    setPopoverOpen(false);
    setOpen(true);
  };
  const readFile = async (file: DocumentFile) => {
    const generation = ++lifetime.current.readGeneration;
    setCandidate(null);
    setError("");
    if (file.size > DocumentCodec.DOCUMENT_LIMITS.bytes) {
      setReading(false);
      setError("Файл превышает 64 MiB.");
      return;
    }
    setReading(true);
    try {
      const document = DocumentCodec.parseDocumentJSON(await file.text());
      if (
        lifetime.current.mounted &&
        generation === lifetime.current.readGeneration
      )
        setCandidate(document);
    } catch (error) {
      if (
        lifetime.current.mounted &&
        generation === lifetime.current.readGeneration
      )
        setError(DocumentErrors.messageOf(error));
    } finally {
      if (
        lifetime.current.mounted &&
        generation === lifetime.current.readGeneration
      )
        setReading(false);
    }
  };
  const confirm = async () => {
    if (!candidate || confirming) return;
    setConfirming(true);
    setError("");
    try {
      await props.onConfirm(candidate);
      if (!lifetime.current.mounted) return;
      setOpen(false);
      setCandidate(null);
      props.onEndImport();
      setPopoverOpen(true);
      setNotice(
        "Доска заменена. Прежняя запись сохранена. Кнопка «Копия до замены» проверит возможность скачивания.",
      );
    } catch (error) {
      if (lifetime.current.mounted) setError(DocumentErrors.messageOf(error));
    } finally {
      if (lifetime.current.mounted) setConfirming(false);
    }
  };
  const fileChanged: React.ChangeEventHandler<
    import("../adapters/storage-files").StorageInput
  > = (event) => {
    const file = StorageFiles.fromInput(event);
    if (file) void readFile(file);
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
  const bindDialog = useCallback((node: OverlayElements.Dialog | null) => {
    dialogRef.current = node;
  }, []);
  return {
    fileChanged,
    closePopover,
    feedback,
    begin,
    bindTrigger,
    popoverOpen,
    setPopoverOpen,
    bindPopover,
    notice,
    bindDialog,
    close,
    confirming,
    readFile,
    reading,
    candidate,
    error,
    confirm,
  };
}
