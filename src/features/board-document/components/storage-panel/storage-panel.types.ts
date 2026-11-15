import type { MessageTypes } from "~/shared/lib/messages";
import type { BoardDocument, StorageState } from "../../board-document.types";

export namespace StoragePanelTypes {
  export type Props = {
    languageSettings?: import("react").ReactNode;
    openPanel: "board" | "save" | null;
    onPanelChange: (panel: "board" | "save" | null) => void;
    backgroundControl: import("react").ReactNode;
    state: StorageState;
    hasDocument: boolean;
    busy: boolean;
    onExport: () => MessageTypes.Value;
    onUpgrade: () => MessageTypes.Value;
    onPrevious: () => MessageTypes.Value;
    onSchema3: () => MessageTypes.Value;
    onSchema4: () => MessageTypes.Value;
    onSchema5?: () => MessageTypes.Value;
    onLibrary: () => MessageTypes.Value;
    onRaw: () => MessageTypes.Value;
    onRetry: () => void;
    onBeginImport: () => MessageTypes.Value;
    onEndImport: () => void;
    onConfirm: (document: BoardDocument) => Promise<void>;
    onOverlayChange: () => void;
  };
}
