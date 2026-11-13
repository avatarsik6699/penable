import type { SurfaceElements } from "../native/surface-elements";
import styles from "./writing-surface.module.css";
import type React from "react";
import { useEffect, useRef } from "react";
import { EditorRuntime, type EditorHandle } from "../native/editor-runtime";
import type { WritingSurfaceTypes } from "./writing-surface.types";
export const WritingSurface: React.FC<WritingSurfaceTypes.Props> = (props) => {
  const elements = useRef<SurfaceElements>({
    canvas: null,
    completed: null,
    background: null,
    selectionPath: null,
    cursor: null,
    focusBadge: null,
  });
  const settings = useRef(props);
  const runtime = useRef<EditorHandle | null>(null);
  useEffect(
    function settingsFx() {
      settings.current = props;
    },
    [props],
  );
  useEffect(function editorGenerationFx() {
    const editor = EditorRuntime.create(
      elements.current,
      () => settings.current,
    );
    runtime.current = editor;
    return () => {
      editor.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(
    function presentationFx() {
      if (props.modalOpen) runtime.current?.cancel();
      runtime.current?.refresh();
    },
    [props.tool, props.modalOpen, props.uiRevision],
  );
  return (
    <section
      data-testid="board-surface"
      className={styles["writing-surface"]}
      aria-label="Лист для проверки пера"
    >
      <div
        ref={(node) => {
          elements.current.background = node;
        }}
        className={styles["board-background"]}
        data-background={props.background}
        aria-hidden="true"
      />
      <canvas
        ref={(node) => {
          elements.current.completed = node;
        }}
        className={styles["completed-canvas"]}
        data-layer="completed"
        data-testid="board-completed"
        aria-hidden="true"
      />
      <canvas
        ref={(node) => {
          elements.current.canvas = node;
        }}
        className={styles["live-canvas"]}
        data-tool={props.tool}
        data-layer="live"
        data-testid="board-live"
        tabIndex={0}
        aria-label="Область письма и стирания пером или основной кнопкой мыши"
        aria-describedby="prototype-warning writing-help"
      >
        Для письма нужен браузер с поддержкой Canvas 2D.
      </canvas>
      <svg
        data-testid="board-selection"
        className={styles["selection-outline"]}
        aria-hidden="true"
      >
        <path
          ref={(node) => {
            elements.current.selectionPath = node;
          }}
        />
      </svg>
      <div
        data-testid="board-cursor"
        ref={(node) => {
          elements.current.cursor = node;
        }}
        className={styles["board-cursor"]}
        hidden
        aria-hidden="true"
      >
        <svg className={styles["cursor-arrow"]} viewBox="0 0 24 28">
          <path d="M2 2v21l6-6 5 9 4-2-5-9h9Z" />
        </svg>
        <svg className={styles["cursor-move"]} viewBox="0 0 24 24">
          <path d="M12 1 8 5h3v6H5V8l-4 4 4 4v-3h6v6H8l4 4 4-4h-3v-6h6v3l4-4-4-4v3h-6V5h3Z" />
        </svg>
        <span className={styles["cursor-dot"]} />
        <span className={styles["cursor-eraser"]} />
        <svg
          className={[styles["cursor-hand"], styles["cursor-hand-open"]].join(
            " ",
          )}
          viewBox="0 0 24 24"
        >
          <path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7h-1c-2 0-4-1-5-3l-4-6a1.5 1.5 0 0 1 2.4-1.8L8 14Z" />
        </svg>
        <svg
          className={[styles["cursor-hand"], styles["cursor-hand-closed"]].join(
            " ",
          )}
          viewBox="0 0 24 24"
        >
          <path d="M7 12V9a1.5 1.5 0 0 1 3 0v2-3a1.5 1.5 0 0 1 3 0v3-2a1.5 1.5 0 0 1 3 0v3-1a1.5 1.5 0 0 1 3 0v5c0 4-3 6-6 6h-1c-2 0-4-1-5-3l-3-5a1.5 1.5 0 0 1 2.5-1.6L7 14Z" />
        </svg>
      </div>
      <span
        ref={(node) => {
          elements.current.focusBadge = node;
        }}
        className={styles["canvas-focus-badge"]}
        hidden
      >
        Полотно
      </span>
      <p id="writing-help" className={styles["visually-hidden"]}>
        Пишите кончиком пера или левой кнопкой мыши. Ластик удаляет штрихи
        целиком. Толщина меняется со следующего штриха пера. Колесо перемещает
        доску. Ctrl и колесо меняют масштаб вокруг курсора. Пробел и
        перетаскивание или средняя кнопка перемещают доску.
      </p>
    </section>
  );
};
