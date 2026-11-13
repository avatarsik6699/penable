import type { BoardDocument, StorageState } from "../model/types";

export namespace StoragePanelTypes {
  export type Props = {
    state: StorageState;
    hasDocument: boolean;
    busy: boolean;
    onExport: () => string;
    onUpgrade: () => string;
    onPrevious: () => string;
    onRetry: () => void;
    onBeginImport: () => string;
    onEndImport: () => void;
    onConfirm: (document: BoardDocument) => Promise<void>;
    onOverlayChange: () => void;
  };
}
