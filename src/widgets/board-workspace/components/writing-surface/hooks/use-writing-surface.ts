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
    cursor: null,
    focusBadge: null,
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
    [props.tool, props.modalOpen, props.uiRevision],
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

  const bindCursor = useCallback((node: SurfaceElements["cursor"]) => {
    elements.current.cursor = node;
  }, []);

  const bindFocusBadge = useCallback((node: SurfaceElements["focusBadge"]) => {
    elements.current.focusBadge = node;
  }, []);

  return {
    bindBackground,
    bindCompleted,
    bindCanvas,
    bindSelectionPath,
    bindCursor,
    bindFocusBadge,
  };
}
