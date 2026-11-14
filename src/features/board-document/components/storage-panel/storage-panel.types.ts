import type { BoardDocument, StorageState } from "../../board-document.types";

export namespace StoragePanelTypes {
  export type Props = {
    openPanel: "board" | "save" | null;
    onPanelChange: (panel: "board" | "save" | null) => void;
    backgroundControl: import("react").ReactNode;
    state: StorageState;
    hasDocument: boolean;
    busy: boolean;
    onExport: () => string;
    onUpgrade: () => string;
    onPrevious: () => string;
    onSchema3: () => string;
    onSchema4: () => string;
    onSchema5?: () => string;
    onLibrary: () => string;
    onRaw: () => string;
    onRetry: () => void;
    onBeginImport: () => string;
    onEndImport: () => void;
    onConfirm: (document: BoardDocument) => Promise<void>;
    onOverlayChange: () => void;
  };
}
