import { useEffect, useState, useSyncExternalStore } from "react";
import { DocumentBindings } from "~/features/board-document";
import { WorkspacePlatform } from "../adapters/workspace-platform";

export function useBoardWorkspace() {
  const [model] = useState(WorkspacePlatform.create);
  const ui = useSyncExternalStore(model.subscribe, model.getSnapshot);

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

  return { model, ui };
}
