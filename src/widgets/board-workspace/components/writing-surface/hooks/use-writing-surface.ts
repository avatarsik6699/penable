import { useCallback, useEffect, useRef } from "react";
import { EditorRuntime, type EditorHandle } from "../native";
import type { SurfaceElements } from "../native";
import type { WritingSurfaceTypes } from "../writing-surface.types";

export function useWritingSurface(props: WritingSurfaceTypes.Props) {
  const elements = useRef<SurfaceElements>({
    canvas: null,
    completed: null,
    background: null,
    selectionPath: null,
    selectionHandles: null,
    cursor: null,
    focusBadge: null,
    mapHost: null,
    mapCanvas: null,
    mapFrame: null,
    mapMarker: null,
    mapStatus: null,
    mapOutside: null,
    mapArea: null,
    mapFit: null,
  });

  const settings = useRef(props);
  const runtime = useRef<EditorHandle | null>(null);

  useEffect(
    function settingsFx() {
      settings.current = props;
    },
    [props],
  );

  useEffect(function editorGenerationFx() {
    const editor = EditorRuntime.create(
      elements.current,
      () => settings.current,
    );

    runtime.current = editor;

    return () => {
      editor.dispose();
      runtime.current = null;
    };
  }, []);

  useEffect(
    function presentationFx() {
      if (props.modalOpen) runtime.current?.cancel();

      runtime.current?.refresh();
    },
    [
      props.tool,
      props.modalOpen,
      props.uiRevision,
      props.minimapOpen,
      props.backgroundSettings,
    ],
  );

  const bindBackground = useCallback((node: SurfaceElements["background"]) => {
    elements.current.background = node;
  }, []);

  const bindCompleted = useCallback((node: SurfaceElements["completed"]) => {
    elements.current.completed = node;
  }, []);

  const bindCanvas = useCallback((node: SurfaceElements["canvas"]) => {
    elements.current.canvas = node;
  }, []);

  const bindSelectionPath = useCallback(
    (node: SurfaceElements["selectionPath"]) => {
      elements.current.selectionPath = node;
    },
    [],
  );

  const bindSelectionHandles = useCallback(
    (node: SurfaceElements["selectionHandles"]) => {
      elements.current.selectionHandles = node;
    },
    [],
  );

  const bindCursor = useCallback((node: SurfaceElements["cursor"]) => {
    elements.current.cursor = node;
  }, []);

  const bindFocusBadge = useCallback((node: SurfaceElements["focusBadge"]) => {
    elements.current.focusBadge = node;
  }, []);

  const bindMapRoot = useCallback((node: SurfaceElements["mapHost"]) => {
    elements.current.mapHost = node;
    settings.current.bindMinimapRoot(node);
  }, []);

  const bindMapCanvas = useCallback((node: SurfaceElements["mapCanvas"]) => {
    elements.current.mapCanvas = node;
  }, []);

  const bindMapFrame = useCallback((node: SurfaceElements["mapFrame"]) => {
    elements.current.mapFrame = node;
  }, []);

  const bindMapMarker = useCallback((node: SurfaceElements["mapMarker"]) => {
    elements.current.mapMarker = node;
  }, []);

  const bindMapStatus = useCallback((node: SurfaceElements["mapStatus"]) => {
    elements.current.mapStatus = node;
  }, []);

  const bindMapOutside = useCallback((node: SurfaceElements["mapOutside"]) => {
    elements.current.mapOutside = node;
  }, []);

  const bindMapArea = useCallback((node: SurfaceElements["mapArea"]) => {
    elements.current.mapArea = node;
  }, []);

  const bindMapFit = useCallback((node: SurfaceElements["mapFit"]) => {
    elements.current.mapFit = node;
  }, []);

  return {
    bindMapRoot,
    bindMapCanvas,
    bindMapFrame,
    bindMapMarker,
    bindMapStatus,
    bindMapOutside,
    bindMapArea,
    bindMapFit,
    bindBackground,
    bindCompleted,
    bindCanvas,
    bindSelectionPath,
    bindSelectionHandles,
    bindCursor,
    bindFocusBadge,
  };
}
