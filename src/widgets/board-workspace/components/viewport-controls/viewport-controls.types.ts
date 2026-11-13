import type { HistoryState } from "~/entities/board";
import type { InputDiagnostics } from "../../model/workspace-model.types";

export namespace ViewportControlsTypes {
  export type Props = {
    onZoomOut: () => void;
    onZoomIn: () => void;
    onResetView: () => void;
    onReturnWriting: () => void;
    navigationMessage: string;
    canReturnWriting: boolean;
    minimapOpen: boolean;
    onMinimapToggle: () => void;
    bindMinimapTrigger: (
      node: import("~/shared/lib/overlay").OverlayElements.Button | null,
    ) => void;
    historyState: HistoryState;
    diagnostics: InputDiagnostics;
    selectionDisabled: boolean;
  };
}
