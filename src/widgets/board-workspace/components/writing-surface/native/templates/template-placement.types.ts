import type { MessageTypes } from "~/shared/lib/messages";
import type { TemplateItem, Viewport } from "~/entities/board";

export type TemplatePlacementOptions = {
  allowed: () => boolean;
  viewport: () => Viewport;
  bounds: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  allocate: () => number;
  draw: (item: TemplateItem | null) => void;
  notice: (message: MessageTypes.Value) => void;
  insert: (item: TemplateItem) => Promise<boolean>;
};
