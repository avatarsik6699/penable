import type { StoragePanelTypes } from "../../storage-panel.types";

export namespace StorageStatusTypes {
  export type Props = Pick<StoragePanelTypes.Props, "state"> & {
    recovering?: boolean;
  };
}
