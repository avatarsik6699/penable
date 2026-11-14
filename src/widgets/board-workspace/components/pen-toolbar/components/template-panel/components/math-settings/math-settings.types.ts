import type { TemplateDraftTypes } from "../../modules/draft";

export namespace MathSettingsTypes {
  export type Props = {
    state: TemplateDraftTypes.State;
    disabled: boolean;
    onField: (field: TemplateDraftTypes.Field, value: string) => void;
    onAutomatic: (value: boolean) => void;
    onRecommendation: () => void;
    onNumbers: (value: boolean) => void;
    onGrid: (value: boolean) => void;
  };
}
