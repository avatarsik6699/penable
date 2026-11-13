import type { BackgroundMode } from "~/entities/board";

export namespace BackgroundControlTypes {
  export type Props = {
    background: BackgroundMode;
    settings: import("~/entities/board").BackgroundSettings;
    onSettingsChange: (
      settings: import("~/entities/board").BackgroundSettings,
    ) => void;
    readOnly: boolean;
    onBackgroundChange: (value: BackgroundMode) => void;
  };
}
