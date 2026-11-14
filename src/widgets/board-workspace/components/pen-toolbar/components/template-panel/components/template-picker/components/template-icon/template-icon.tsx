import type React from "react";
import { EditorIcon } from "~/shared/ui/editor-icon";
import type { TemplateIconTypes } from "./template-icon.types";

export const TemplateIcon: React.FC<TemplateIconTypes.Props> = (props) => {
  if (props.kind === "line") return <EditorIcon name="minus" />;

  if (props.kind === "arrow") return <EditorIcon name="shape-arrow" />;

  if (props.kind === "rectangle") return <EditorIcon name="shape-rectangle" />;

  if (props.kind === "ellipse") return <EditorIcon name="shape-ellipse" />;

  if (props.kind === "triangle") return <EditorIcon name="shape-triangle" />;

  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {props.kind === "number-line" ? (
        <path d="M3 12h18m-3-3 3 3-3 3M6 9v6m5-6v6m5-6v6" />
      ) : props.kind === "axes" ? (
        <path d="M3 17h18m-3-3 3 3-3 3M7 21V3m-3 3 3-3 3 3m1 9v4m4-4v4M5 8h4m-4 4h4" />
      ) : (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M2 12h20M12 2v20m0-10 6-5m-2 5a4 4 0 0 0-1-2.6" />
        </>
      )}
    </svg>
  );
};
