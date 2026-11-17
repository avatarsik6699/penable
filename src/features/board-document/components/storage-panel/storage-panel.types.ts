import type { MessageTypes } from "~/shared/lib/messages";
import type { ImportCandidate } from "../../modules/import-candidates";
import type { StorageState } from "../../board-document.types";

export namespace StoragePanelTypes {
  export type Props = {
    languageSettings?: import("react").ReactNode;
    themeSettings?: import("react").ReactNode;
    openPanel: "board" | "save" | null;
    onPanelChange: (panel: "board" | "save" | null) => void;
    backgroundControl: import("react").ReactNode;
    state: StorageState;
    hasDocument: boolean;
    busy: boolean;
    onExport: () => Promise<MessageTypes.Value>;
    onUpgrade: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onPrevious: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onSchema3: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onSchema4: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onSchema5?: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onLibrary: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onRaw: () => MessageTypes.Value | Promise<MessageTypes.Value>;
    onRetry: () => void;
    onBeginImport: () => MessageTypes.Value;
    onEndImport: () => void;
    onConfirm: (document: ImportCandidate) => Promise<void>;
    onOverlayChange: () => void;
  };
}
