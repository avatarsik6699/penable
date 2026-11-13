import type { StoragePanelTypes } from "../../storage-panel.types";
import type { useStoragePanel } from "../../hooks/use-storage-panel";

type ExtraProps = {
  details: Pick<
    ReturnType<typeof useStoragePanel>,
    "bindPopover" | "closePopover" | "notice" | "feedback"
  >;
};

export namespace StorageDetailsTypes {
  export type Props = Pick<
    StoragePanelTypes.Props,
    "state" | "onUpgrade" | "onPrevious" | "onRetry"
  > &
    ExtraProps;
}
