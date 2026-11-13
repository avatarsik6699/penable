import type { LibraryState } from "../../modules/library";

export namespace BoardLibraryTypes {
  export type Props = {
    state: LibraryState;
    onPreviewVisible: (ids: readonly string[]) => void;
    onPreviewClose: () => void;
    readOnly: boolean;
    blocked: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (title: string) => Promise<void>;
    onRename: (id: string, title: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSwitch: (id: string) => Promise<void>;
    onModalChange: (open: boolean) => void;
  };
}
