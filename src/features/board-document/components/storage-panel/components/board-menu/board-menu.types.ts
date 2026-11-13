import type { StoragePanelTypes } from "../../storage-panel.types";
import type { OverlayElements } from "~/shared/lib/overlay";

export namespace BoardMenuTypes {
  export type Props = Pick<
    StoragePanelTypes.Props,
    "state" | "hasDocument" | "busy" | "backgroundControl"
  > & {
    onExport: () => void;
    onImport: () => void;
    onPrevious: () => void;
    onUpgrade: () => void;
    bindRoot: (node: OverlayElements.Container | null) => void;
    onClose: () => void;
  };
}
