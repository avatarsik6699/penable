import type { StoragePanelTypes } from "../../storage-panel.types";
import type { useImportDialog } from "../../hooks/use-import-dialog";

type ExtraProps = { dialog: ReturnType<typeof useImportDialog> };

export namespace ImportDialogTypes {
  export type Props = Pick<StoragePanelTypes.Props, "state"> & ExtraProps;
}
