import type React from "react";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { TemplateIconTypes } from "./template-icon.types";

export const TemplateIcon: React.FC<TemplateIconTypes.Props> = (props) => {
  if (props.kind === "line") return <EditorIcon name="minus" />;

  if (props.kind === "arrow") return <EditorIcon name="shape-arrow" />;

  if (props.kind === "rectangle") return <EditorIcon name="shape-rectangle" />;

  if (props.kind === "ellipse") return <EditorIcon name="shape-ellipse" />;

  if (props.kind === "triangle") return <EditorIcon name="shape-triangle" />;

  if (props.kind === "number-line")
    return <EditorIcon name="math-number-line" />;

  if (props.kind === "axes") return <EditorIcon name="math-axes" />;

  return <EditorIcon name="math-circle" />;
};
