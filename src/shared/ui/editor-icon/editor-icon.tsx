import type React from "react";
import type { EditorIconTypes } from "./editor-icon.types";
import styles from "./editor-icon.module.css";

export const EditorIcon: React.FC<EditorIconTypes.Props> = (props) => (
  <svg
    className={[styles.icon, props.className ?? ""].join(" ")}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {props.name === "chevron-down" && (
      <>
        <path d="m7 10 5 5 5-5" />
      </>
    )}
    {props.name === "pen" && (
      <>
        <path d="m14 4 6 6-9 9-7 1 1-7Z M11 7l6 6 M4 20l4-4" />
      </>
    )}
    {props.name === "eraser" && (
      <>
        <path d="m14 4 6 6-10 10H6l-4-4Z M8 10l6 6 M10 20h11" />
      </>
    )}
    {props.name === "selection" && (
      <>
        <path strokeDasharray="3 3" d="M4 4h16v16H4Z" />
      </>
    )}
    {props.name === "undo" && (
      <>
        <path d="m8 4-5 5 5 5 M3 9h11a6 6 0 0 1 0 12" />
      </>
    )}
    {props.name === "redo" && (
      <>
        <path d="m16 4 5 5-5 5 M21 9H10a6 6 0 0 0 0 12" />
      </>
    )}
    {props.name === "more" && (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    )}
    {props.name === "check" && (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    )}
    {props.name === "close" && (
      <>
        <path d="m6 6 12 12 M6 18 18 6" />
      </>
    )}
    {props.name === "copy" && (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    )}
    {props.name === "cut" && (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="m8 8 12 12 M8 16 20 4" />
      </>
    )}
    {props.name === "paste" && (
      <>
        <rect x="7" y="3" width="10" height="4" rx="1" />
        <path d="M7 5H4v16h16V5h-3 M8 12h8 M8 16h6" />
      </>
    )}
    {props.name === "duplicate" && (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5 M11 14h7 M14.5 10.5v7" />
      </>
    )}
    {props.name === "image" && (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 18 6-6 4 4 3-3 5 5" />
      </>
    )}
    {props.name === "download" && (
      <>
        <path d="M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5" />
      </>
    )}
    {props.name === "upload" && (
      <>
        <path d="M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5" />
      </>
    )}
    {props.name === "trash" && (
      <>
        <path d="M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7" />
      </>
    )}
    {props.name === "history" && (
      <>
        <path d="M3 4v6h6 M3 10a9 9 0 1 1 1 7 M12 7v6l4 2" />
      </>
    )}
    {props.name === "device" && (
      <>
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M8 21h8 M12 17v4" />
      </>
    )}
    {props.name === "retry" && (
      <>
        <path d="M20 4v6h-6 M20 10a8 8 0 1 0 0 6" />
      </>
    )}
    {props.name === "minus" && (
      <>
        <path d="M5 12h14" />
      </>
    )}
    {props.name === "plus" && (
      <>
        <path d="M5 12h14 M12 5v14" />
      </>
    )}
    {props.name === "fit" && (
      <>
        <path d="M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M8 8h8v8H8Z" />
      </>
    )}
    {props.name === "help" && (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2 M12 17h.01" />
      </>
    )}
  </svg>
);
