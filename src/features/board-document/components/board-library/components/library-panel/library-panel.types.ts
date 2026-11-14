import type { BoardLibraryTypes } from "../../board-library.types";
import type { usePanelDismiss } from "~/shared/ui/panel-dismiss";

export namespace LibraryPanelTypes {
  export type Props = BoardLibraryTypes.Props &
    Pick<
      ReturnType<typeof usePanelDismiss>,
      "closeAndFocus" | "focusTrigger" | "bindPanel"
    >;
}
