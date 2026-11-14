import type { TemplateConfig } from "~/entities/board";

export namespace TemplateDraftTypes {
  export type Field = "min" | "max" | "step";

  export type State = {
    config: TemplateConfig;
    fields: Record<Field, string>;
    automatic: boolean;
    preview: TemplateConfig;
    resolved: TemplateConfig | null;
    recommendation: number | null;
    error: { field: Field; message: string } | null;
  };
}
