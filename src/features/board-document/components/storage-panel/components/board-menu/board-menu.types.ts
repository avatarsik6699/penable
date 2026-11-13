import type { StoragePanelTypes } from "../../storage-panel.types";
import type { OverlayElements } from "~/shared/lib/overlay";

export namespace BoardMenuTypes {
  export type Props = {
    tab: "board" | "save";
    onTab: (tab: "board" | "save") => void;
    backgroundControl: StoragePanelTypes.Props["backgroundControl"];
    children: import("react").ReactNode;
    bindRoot: (node: OverlayElements.Container | null) => void;
    onClose: () => void;
  };
}
