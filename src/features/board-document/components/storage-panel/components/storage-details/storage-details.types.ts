import type { StoragePanelTypes } from "../../storage-panel.types";
import type { OverlayElements } from "~/shared/lib/overlay";

export namespace StorageDetailsTypes {
  export type Props = Pick<
    StoragePanelTypes.Props,
    | "state"
    | "hasDocument"
    | "onExport"
    | "onUpgrade"
    | "onPrevious"
    | "onRetry"
  > & {
    bindRoot: (node: OverlayElements.Container | null) => void;
    onClose: () => void;
    notice: string;
    onFeedback: (message: string) => void;
  };
}
