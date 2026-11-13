import type { StoragePanelTypes } from "../../storage-panel.types";

type ExtraProps = {};

export namespace StorageStatusTypes {
  export type Props = Pick<StoragePanelTypes.Props, "state"> & ExtraProps;
}
