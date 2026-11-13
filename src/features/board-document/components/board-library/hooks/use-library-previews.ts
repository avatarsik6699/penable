import { useEffect, useRef } from "react";
import {
  PreviewVisibility,
  type PreviewVisibilityTypes,
} from "../../../adapters/preview-visibility";
import type { BoardLibraryTypes } from "../board-library.types";

export function useLibraryPreviews(
  props: BoardLibraryTypes.Props,
  key: string,
) {
  const open = props.open,
    onVisible = props.onPreviewVisible,
    onClose = props.onPreviewClose;

  const root = useRef<PreviewVisibilityTypes.Root | null>(null);

  useEffect(
    function visiblePreviewsFx() {
      if (!open || !root.current) return;

      const stop = PreviewVisibility.observe(root.current, (ids) =>
        onVisible(ids),
      );

      return () => {
        stop();
        onClose();
      };
    },
    [open, onVisible, onClose, key],
  );

  return root;
}
