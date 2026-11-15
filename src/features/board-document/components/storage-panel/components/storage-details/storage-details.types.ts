import type { MessageTypes } from "~/shared/lib/messages";
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
    | "onSchema4"
    | "onSchema5"
    | "onLibrary"
    | "onRaw"
    | "onRetry"
  > & {
    notice: MessageTypes.Value;
    onFeedback: (notice: MessageTypes.Value) => void;
    onImport: () => void;
  };
}
