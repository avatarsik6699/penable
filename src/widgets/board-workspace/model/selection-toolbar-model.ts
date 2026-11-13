import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import type { SelectionCommand } from "../model/types";
import type { SelectionToolbarTypes } from "../ui/selection-toolbar.types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectionShape } from "~/entities/board";
export function useSelectionToolbar(props: SelectionToolbarTypes.Props) {
  const [open, setOpen] = useState(false);
  const toolbarRef = useRef<OverlayElements.Container>(null);
  const triggerRef = useRef<OverlayElements.Button>(null);
  const restoreFocus = useRef(false);
  const busy = props.state.busy || props.blocked;
  const blocked = props.blocked;
  const notifyOverlay = props.onOverlayChange;
  const cancelActive = props.onCancelActiveInput;
  useEffect(
    function selectionFocusFx() {
      if (!open && !blocked && restoreFocus.current) {
        restoreFocus.current = false;
        Overlay.focus(triggerRef.current);
      }
    },
    [open, blocked],
  );
  useEffect(
    function selectionOverlayFx() {
      notifyOverlay();
    },
    [open, notifyOverlay],
  );
  useEffect(
    function selectionDismissFx() {
      if (!open) return;
      return Overlay.bindDismiss({
        roots: [toolbarRef.current],
        onOutside: () => setOpen(false),
        onEscape: () => {
          cancelActive();
          restoreFocus.current = true;
          setOpen(false);
        },
      });
    },
    [open, cancelActive],
  );
  const command = (value: SelectionCommand) => {
    props.onCommand(value);
    setOpen(false);
    Overlay.focus(triggerRef.current);
  };
  const changeShape = (value: SelectionShape) => {
    props.onShape(value);
    setOpen(false);
  };
  const bindRoot = useCallback((node: OverlayElements.Container | null) => {
    toolbarRef.current = node;
  }, []);
  const bindTrigger = useCallback((node: OverlayElements.Button | null) => {
    triggerRef.current = node;
  }, []);
  return { bindRoot, busy, changeShape, bindTrigger, open, setOpen, command };
}
