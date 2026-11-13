import type { HistoryState } from "~/entities/board";
import type { InputDiagnostics } from "../../model/workspace-model.types";

export namespace ViewportControlsTypes {
  export type Props = {
    onZoomOut: () => void;
    onZoomIn: () => void;
    onResetView: () => void;
    onFitAll: () => void;
    historyState: HistoryState;
    diagnostics: InputDiagnostics;
    selectionDisabled: boolean;
  };
}
