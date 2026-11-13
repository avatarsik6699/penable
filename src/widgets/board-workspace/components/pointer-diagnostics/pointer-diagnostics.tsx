import styles from "./pointer-diagnostics.module.css";
import type React from "react";
import type { PointerDiagnosticsTypes } from "./pointer-diagnostics.types";

export const PointerDiagnostics: React.FC<PointerDiagnosticsTypes.Props> = (
  props,
) => {
  return (
    <div className={styles["diagnostics"]}>
      <div className={styles["diagnostics-panel"]}>
        <dl>
          <div>
            <dt>Указатель</dt>
            <dd>{props.diagnostics.pointerType ?? "ожидание ввода"}</dd>
          </div>
          <div>
            <dt>Давление</dt>
            <dd>{props.diagnostics.pressure?.toFixed(3) ?? "—"}</dd>
          </div>
          <div>
            <dt>Штрих</dt>
            <dd>{props.diagnostics.active ? "идёт письмо" : "не активен"}</dd>
          </div>
          <div>
            <dt>DPR</dt>
            <dd>{props.diagnostics.dpr}</dd>
          </div>
          <div>
            <dt>Coalesced events</dt>
            <dd>
              {props.diagnostics.coalesced ? "доступны" : "обычные события"}
            </dd>
          </div>
          <div>
            <dt>Масштаб доски</dt>
            <dd>{Math.round(props.diagnostics.zoom * 100)}%</dd>
          </div>
          <div>
            <dt>Масштаб pinch</dt>
            <dd>{props.diagnostics.nativeScale.toFixed(2)}×</dd>
          </div>
          <div>
            <dt>Разрешение</dt>
            <dd>
              {props.diagnostics.effectiveRatio.toFixed(2)}× /{" "}
              {props.diagnostics.requestedRatio.toFixed(2)}×
            </dd>
          </div>
          <div>
            <dt>Каждый слой</dt>
            <dd>
              {props.diagnostics.bitmapWidth} × {props.diagnostics.bitmapHeight}{" "}
              px
            </dd>
          </div>
        </dl>
        <p
          className={
            props.diagnostics.resolutionCapped
              ? styles["resolution-limit"]
              : undefined
          }
        >
          {props.diagnostics.resolutionCapped
            ? "Достигнут предел разрешения: 16,8 млн пикселей на два слоя, до 8192 px на сторону."
            : "Разрешение: фактическое / запрошенное. Два слоя, до 16,8 млн пикселей суммарно."}
        </p>
        <p>Давление показано из события. Толщина ручки постоянная.</p>
      </div>
    </div>
  );
};
