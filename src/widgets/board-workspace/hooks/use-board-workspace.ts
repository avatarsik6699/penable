import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { DocumentBindings } from "~/features/board-document";
import { WorkspacePlatform } from "../adapters/workspace-platform";

import type { BoardWorkspaceTypes } from "../board-workspace.types";
import type { DrawingTool } from "~/entities/board";

export function useBoardWorkspace() {
  const [model] = useState(WorkspacePlatform.create);
  const ui = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const [panel, setPanel] = useState<BoardWorkspaceTypes.Panel>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const changePanel = useCallback(
    (next: BoardWorkspaceTypes.Panel) => {
      if (next !== null) {
        setDiagnosticsOpen(false);
      }

      setPanel(next);
      model.overlayChanged();
    },
    [model],
  );

  const changeDiagnostics = (open: boolean) => {
    setPanel(null);
    setDiagnosticsOpen(open);
    model.overlayChanged();
  };

  const changeTool = (tool: DrawingTool) => {
    changePanel(null);
    model.changeTool(tool);
  };

  useEffect(
    function documentSessionFx() {
      const stop = model.start();
      const unbind = DocumentBindings.bind(model);

      return () => {
        unbind();
        stop();
      };
    },
    [model],
  );

  return {
    model,
    ui,
    panel,
    changePanel,
    diagnosticsOpen,
    changeDiagnostics,
    changeTool,
  };
}
