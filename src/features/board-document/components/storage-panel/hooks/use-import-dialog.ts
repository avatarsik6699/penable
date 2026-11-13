import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import {
  StorageFiles,
  type DocumentFile,
} from "../../../adapters/storage-files";
import { DocumentCodec } from "../../../modules/codec";
import { DocumentErrors } from "../../../modules/session";
import type { BoardDocument } from "../../../board-document.types";
import type { StoragePanelTypes } from "../storage-panel.types";

export function useImportDialog(
  props: StoragePanelTypes.Props,
  feedback: (message: string) => void,
  beforeOpen: () => void,
  imported: () => void,
) {
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<BoardDocument | null>(null);
  const [reading, setReading] = useState(false);
  const [confirming, setConfirming] = useState(false);
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

    beforeOpen();
    setError("");
    setCandidate(null);
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
      imported();
    } catch (error) {
      if (lifetime.current.mounted) setError(DocumentErrors.messageOf(error));
    } finally {
      if (lifetime.current.mounted) setConfirming(false);
    }
  };

  const fileChanged: React.ChangeEventHandler<
    import("../../../adapters/storage-files").StorageInput
  > = (event) => {
    const file = StorageFiles.fromInput(event);

    if (file) void readFile(file);
  };

  const bindDialog = useCallback((node: OverlayElements.Dialog | null) => {
    dialogRef.current = node;
  }, []);

  return {
    open,
    candidate,
    reading,
    confirming,
    error,
    begin,
    close,
    confirm,
    fileChanged,
    bindDialog,
  };
}
