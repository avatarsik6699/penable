import type { TemplateConfig } from "~/entities/board";
import type { OverlayElements } from "~/shared/lib/overlay";

export namespace TemplatePanelTypes {
  export type Props = {
    disabled: boolean;
    onPlace: (config: TemplateConfig, explicitSize?: boolean) => void;
    onClose: () => void;
    bindRoot: (node: OverlayElements.Container | null) => void;
  };
}
