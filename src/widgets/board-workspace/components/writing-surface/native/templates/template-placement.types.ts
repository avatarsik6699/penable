import type { TemplateItem, Viewport } from "~/entities/board";

export type TemplatePlacementOptions = {
  allowed: () => boolean;
  viewport: () => Viewport;
  bounds: () => { left: number; top: number; width: number; height: number };
  allocate: () => number;
  draw: (item: TemplateItem | null) => void;
  notice: (message: string) => void;
  insert: (item: TemplateItem) => Promise<boolean>;
};
