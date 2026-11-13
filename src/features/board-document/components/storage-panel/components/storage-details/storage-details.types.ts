import type { StoragePanelTypes } from "../../storage-panel.types";

export namespace StorageDetailsTypes {
  export type Props = Pick<
    StoragePanelTypes.Props,
    | "state"
    | "hasDocument"
    | "busy"
    | "onExport"
    | "onPrevious"
    | "onUpgrade"
    | "onSchema3"
    | "onRetry"
  > & {
    notice: string;
    onFeedback: (notice: string) => void;
    onImport: () => void;
  };
}
