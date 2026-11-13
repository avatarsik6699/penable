import type { SurfaceElements } from "../../native";
import type { OverlayElements } from "~/shared/lib/overlay";

export namespace MinimapViewTypes {
  export type Props = {
    onClose: () => void;
    bindRoot: (node: OverlayElements.Container | null) => void;
    bindMapCanvas: (node: SurfaceElements["mapCanvas"]) => void;
    bindMapFrame: (node: SurfaceElements["mapFrame"]) => void;
    bindMapMarker: (node: SurfaceElements["mapMarker"]) => void;
    bindMapStatus: (node: SurfaceElements["mapStatus"]) => void;
    bindMapOutside: (node: SurfaceElements["mapOutside"]) => void;
    bindMapArea: (node: SurfaceElements["mapArea"]) => void;
    bindMapFit: (node: SurfaceElements["mapFit"]) => void;
  };
}
