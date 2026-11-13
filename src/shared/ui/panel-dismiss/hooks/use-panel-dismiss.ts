import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import type { PanelDismissTypes } from "../panel-dismiss.types";

export function usePanelDismiss(props: PanelDismissTypes.Options) {
  const rootRef = useRef<OverlayElements.Container>(null);
  const panelRef = useRef<OverlayElements.Container>(null);
  const triggerRef = useRef<OverlayElements.Button>(null);
  const close = props.onClose;
  const escape = props.onEscape;

  useEffect(
    function panelDismissFx() {
      if (!props.open) return;

      return Overlay.bindDismiss({
        roots: [rootRef.current, triggerRef.current],
        onOutside: props.dismissOutside === false ? () => {} : close,

        onEscape: () => {
          escape?.();
          close();
          Overlay.focus(triggerRef.current);
        },
      });
    },
    [props.open, props.dismissOutside, close, escape],
  );

  useLayoutEffect(
    function panelViewportFx() {
      if (!props.open) return;

      return Overlay.bindViewport(panelRef.current);
    },
    [props.open],
  );

  const bindPanel = useCallback((node: OverlayElements.Container | null) => {
    panelRef.current = node;
  }, []);

  const bindRoot = useCallback((node: OverlayElements.Container | null) => {
    rootRef.current = node;
  }, []);

  const bindTrigger = useCallback((node: OverlayElements.Button | null) => {
    triggerRef.current = node;
  }, []);

  const closeAndFocus = () => {
    close();
    Overlay.focus(triggerRef.current);
  };

  return {
    bindRoot,
    bindPanel,
    bindTrigger,
    closeAndFocus,
    focusTrigger: () => Overlay.focus(triggerRef.current),
  };
}
