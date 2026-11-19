import type { LibraryState } from "../../../../modules/library";

export namespace RecoveryBrowserTypes {
  export type Props = {
    library: LibraryState;
    onPreview: (id: string) => void;
    onClosePreview: () => void;
  };
}
