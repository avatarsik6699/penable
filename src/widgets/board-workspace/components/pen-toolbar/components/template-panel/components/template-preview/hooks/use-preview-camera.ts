import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TemplateConfig } from "~/entities/board";
import { PreviewCamera } from "../preview-camera";
import {
  PreviewInput,
  type PreviewInputElements,
} from "../native/preview-input";

export const usePreviewCamera = (config: TemplateConfig) => {
  const camera = useMemo(() => new PreviewCamera(config), [config]);
  const [snapshot, setSnapshot] = useState(() => camera.snapshot);
  const region = useRef<PreviewInputElements.Region>(null);
  const svg = useRef<PreviewInputElements.Graphic>(null);

  useEffect(
    function previewInputFx() {
      if (!region.current || !svg.current) return;

      return PreviewInput.bind(region.current, svg.current, camera, () =>
        setSnapshot(camera.snapshot),
      );
    },
    [camera],
  );

  const bindRegion = useCallback((node: PreviewInputElements.Region | null) => {
    region.current = node;
  }, []);

  const bindSvg = useCallback((node: PreviewInputElements.Graphic | null) => {
    svg.current = node;
  }, []);

  return {
    snapshot,
    bindRegion,
    bindSvg,

    choose: (mode: "close" | "whole") => {
      camera.choose(mode);
      setSnapshot(camera.snapshot);
    },
  };
};
