export namespace InkSettingsTypes {
  export type Props = {
    width: number;
    highlighter?: boolean;
    color?: string;
    onColor?: () => void;
    readOnly: boolean;
    onWidthChange: (value: number) => void;
  };
}
