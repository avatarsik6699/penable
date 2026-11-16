import type { MessageTypes } from "~/shared/lib/messages";
import { useEffect, useRef, useState } from "react";
import { DocumentErrors } from "../../../../../modules/session";
import type { StorageDetailsTypes } from "../storage-details.types";

export function useExportCopy(props: StorageDetailsTypes.Props) {
  const [busy, setBusy] = useState(false);
  const lifetime = useRef({ mounted: false, pending: false });

  useEffect(function exportLifetimeFx() {
    const current = lifetime.current;

    current.mounted = true;

    return () => {
      current.mounted = false;
    };
  }, []);

  const download = async (
    action: () =>
      MessageTypes.Value | Promise<MessageTypes.Value> = props.onExport,
  ) => {
    const current = lifetime.current;

    if (current.pending) return;

    current.pending = true;
    setBusy(true);

    try {
      const message = await action();

      if (current.mounted) props.onFeedback(message);
    } catch (error) {
      if (current.mounted) props.onFeedback(DocumentErrors.messageOf(error));
    } finally {
      current.pending = false;

      if (current.mounted) setBusy(false);
    }
  };

  return { busy, download };
}
