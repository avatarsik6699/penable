import { BackgroundControl } from "./components/background-control";
import { ViewportControls } from "./components/viewport-controls";
import { InkSettings } from "./components/ink-settings";
import { HistoryControls } from "./components/history-controls";
import { ToolControls } from "./components/tool-controls";
import styles from "./pen-toolbar.module.css";
import type React from "react";
import type { PenToolbarTypes } from "./pen-toolbar.types";
import { PointerDiagnostics } from "./components/pointer-diagnostics";

export const PenToolbar: React.FC<PenToolbarTypes.Props> = (props) => {
  return (
    <header className={styles["pen-toolbar"]}>
      <div className={styles["toolbar-row"]}>
        <h1 className={styles.brand}>
          penable
          <span className={styles["brand-dot"]} aria-hidden="true" />
        </h1>
        <ToolControls
          tool={props.tool}
          onToolChange={props.onToolChange}
          readOnly={props.readOnly}
          historyState={props.historyState}
          selectionDisabled={props.selectionDisabled}
        />
        <HistoryControls
          onUndo={props.onUndo}
          readOnly={props.readOnly}
          historyState={props.historyState}
          onRedo={props.onRedo}
        />
        <InkSettings
          width={props.width}
          readOnly={props.readOnly}
          onWidthChange={props.onWidthChange}
          stabilization={props.stabilization}
          onStabilizationChange={props.onStabilizationChange}
        />
        <ViewportControls
          onZoomOut={props.onZoomOut}
          historyState={props.historyState}
          diagnostics={props.diagnostics}
          onResetView={props.onResetView}
          onZoomIn={props.onZoomIn}
          selectionDisabled={props.selectionDisabled}
          onFitAll={props.onFitAll}
        />
        <BackgroundControl
          background={props.background}
          readOnly={props.readOnly}
          onBackgroundChange={props.onBackgroundChange}
        />
        <PointerDiagnostics diagnostics={props.diagnostics} />
      </div>
      <div className={styles["toolbar-notes"]}>
        <p id="prototype-warning" className={styles["prototype-warning"]}>
          Пишите пером или мышью. Ластик удаляет штрихи целиком.
        </p>
        <p className={styles["gesture-help"]}>
          Колесо — перемещение. Ctrl + колесо — масштаб. Пробел + перетаскивание
          или средняя кнопка — перемещение.
        </p>
      </div>
    </header>
  );
};
