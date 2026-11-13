export namespace PanelDismissTypes {
  export type Options = {
    open: boolean;
    onClose: () => void;
    onEscape?: () => void;
    dismissOutside?: boolean;
  };
}
