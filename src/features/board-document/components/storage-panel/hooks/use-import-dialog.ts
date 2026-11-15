import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import {
  StorageFiles,
  type DocumentFile,
} from "../../../adapters/storage-files";
import { DocumentCodec } from "../../../modules/codec";
import { DocumentReader } from "../../../modules/jobs";
import { DocumentErrors } from "../../../modules/session";
import type { BoardDocument } from "../../../board-document.types";
import type { StoragePanelTypes } from "../storage-panel.types";

export function useImportDialog(
  props: StoragePanelTypes.Props,
  feedback: (message: MessageTypes.Value) => void,
  beforeOpen: () => void,
  imported: () => void,
  onClosed: () => void,
) {
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<BoardDocument | null>(null);
  const [reading, setReading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<MessageTypes.Value>("");
  const dialogRef = useRef<OverlayElements.Dialog>(null);
  const lifetime = useRef({ mounted: false, readGeneration: 0 });
  const wasOpen = useRef(false);
  const reader = useRef<AbortController | null>(null);

  useEffect(
    function importReturnFocusFx() {
      if (wasOpen.current && !open) onClosed();

      wasOpen.current = open;
    },
    [open, onClosed],
  );

  useEffect(function storageLifetimeFx() {
    const current = lifetime.current;

    current.mounted = true;

    return () => {
      current.mounted = false;
      current.readGeneration++;
      reader.current?.abort();
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
    reader.current?.abort();
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

    reader.current?.abort();

    const operation = new AbortController();

    reader.current = operation;

    setCandidate(null);
    setError("");

    if (file.size > DocumentCodec.DOCUMENT_LIMITS.bytes) {
      setReading(false);
      setError(Messages.create("fileExceeds64Mib"));

      return;
    }

    setReading(true);

    try {
      const document = await DocumentReader.read(file, operation.signal);

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
