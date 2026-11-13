import { useEffect, useRef, useState } from "react";
import type { LibraryPanelTypes } from "../library-panel.types";

export function useLibraryDelete(
  props: Pick<LibraryPanelTypes.Props, "onModalChange" | "focusTrigger">,
) {
  const [board, setBoard] = useState<{ id: string; title: string } | null>(
    null,
  );

  const release = useRef<(() => void) | null>(null);

  useEffect(function libraryDeleteOwnershipFx() {
    return () => {
      const finish = release.current;

      release.current = null;
      finish?.();
    };
  }, []);

  const begin = (board: { id: string; title: string }) => {
    release.current = () => props.onModalChange(false);
    props.onModalChange(true);
    setBoard(board);
  };

  const cancel = () => {
    const finish = release.current;

    release.current = null;
    finish?.();
    setBoard(null);
    props.focusTrigger();
  };

  return { board, begin, cancel };
}
