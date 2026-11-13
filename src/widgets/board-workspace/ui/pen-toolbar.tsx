import { RangeInput } from "~/shared/ui/range-input";
import { Button } from "~/shared/ui/button";
import styles from "./pen-toolbar.module.css";
import type React from "react";
import type { PenToolbarTypes } from "./pen-toolbar.types";
import { PointerDiagnostics } from "./pointer-diagnostics";
import type { BackgroundMode } from "~/entities/board";

export const PenToolbar: React.FC<PenToolbarTypes.Props> = (props) => {
  return (
    <header className={styles["pen-toolbar"]}>
      <div className={styles["toolbar-row"]}>
        <h1 className={styles.brand}>
          penable
          <span className={styles["brand-dot"]} aria-hidden="true" />
        </h1>
        <div
          className={styles["tool-controls"]}
          role="group"
          aria-label="Инструмент"
        >
          <Button
            type="button"
            aria-pressed={props.tool === "pen"}
            onClick={() => props.onToolChange("pen")}
            disabled={props.readOnly || props.historyState.busy}
          >
            Перо
          </Button>
          <Button
            type="button"
            aria-pressed={props.tool === "eraser"}
            onClick={() => props.onToolChange("eraser")}
            title="Удаляет штрих целиком"
            disabled={props.readOnly || props.historyState.busy}
          >
            Ластик
          </Button>
          <Button
            type="button"
            aria-pressed={props.tool === "selection"}
            onClick={() => props.onToolChange("selection")}
            disabled={props.selectionDisabled || props.historyState.busy}
          >
            Выделение
          </Button>
        </div>
        <div
          className={styles["history-controls"]}
          role="group"
          aria-label="История штрихов"
        >
          <Button
            type="button"
            onClick={props.onUndo}
            aria-label="Отменить действие"
            title="Отменить действие (Ctrl+Z / ⌘Z)"
            disabled={
              props.readOnly ||
              props.historyState.busy ||
              !props.historyState.canUndo
            }
          >
            ↶
          </Button>
          <Button
            type="button"
            onClick={props.onRedo}
            aria-label="Вернуть действие"
            title="Вернуть действие (Ctrl+Shift+Z / ⌘Shift+Z)"
            disabled={
              props.readOnly ||
              props.historyState.busy ||
              !props.historyState.canRedo
            }
          >
            ↷
          </Button>
        </div>
        <div className={styles["width-control"]}>
          <label htmlFor="pen-width">Толщина</label>
          <RangeInput
            id="pen-width"

            min="0.5"
            max="12"
            step="0.1"
            value={props.width}
            disabled={props.readOnly}
            aria-valuetext={`${props.width.toFixed(1)} пикселя`}
            onChange={(event) =>
              props.onWidthChange(Number(event.target.value))
            }
          />
          <output htmlFor="pen-width">
            {props.width.toFixed(1)} <span>px</span>
          </output>
          <span className={styles["pen-preview"]} aria-hidden="true">
            <span style={{ width: props.width, height: props.width }} />
          </span>
        </div>
        <div className={styles["stabilization-control"]}>
          <div>
            <label htmlFor="pen-stabilization">Стабилизация</label>
            <span id="stabilization-help" className={styles["setting-help"]}>
              Со следующего штриха
            </span>
          </div>
          <RangeInput
            id="pen-stabilization"

            min="0"
            max="100"
            step="1"
            value={props.stabilization}
            disabled={props.readOnly}
            aria-describedby="stabilization-help"
            aria-valuetext={`${props.stabilization.toFixed(0)} процентов`}
            onChange={(event) =>
              props.onStabilizationChange(Number(event.target.value))
            }
          />
          <output htmlFor="pen-stabilization">
            {props.stabilization.toFixed(0)} <span>%</span>
          </output>
        </div>
        <div
          className={styles["zoom-controls"]}
          role="group"
          aria-label="Масштаб доски"
        >
          <Button
            type="button"
            onClick={props.onZoomOut}
            aria-label="Уменьшить масштаб доски"
            title="Уменьшить вокруг центра листа"
            disabled={props.historyState.busy || props.diagnostics.zoom <= 0.25}
          >
            −
          </Button>
          <Button
            type="button"
            className={styles["zoom-reset"]}
            onClick={props.onResetView}
            aria-label={`Масштаб ${Math.round(props.diagnostics.zoom * 100)} процентов. Вернуть исходный вид`}
            title="Вернуть 100% и исходное положение"
            disabled={props.historyState.busy}
          >
            {Math.round(props.diagnostics.zoom * 100)}%
          </Button>
          <Button
            type="button"
            onClick={props.onZoomIn}
            aria-label="Увеличить масштаб доски"
            title="Увеличить вокруг центра листа"
            disabled={props.historyState.busy || props.diagnostics.zoom >= 8}
          >
            +
          </Button>
        </div>
        <Button
          className={styles["fit-all"]}
          type="button"
          disabled={props.selectionDisabled || props.historyState.busy}
          onClick={props.onFitAll}
        >
          Показать все записи
        </Button>
        <div className={styles["background-control"]}>
          <label htmlFor="board-background">Фон</label>
          <select
            id="board-background"
            value={props.background}
            disabled={props.readOnly}
            onChange={(event) =>
              props.onBackgroundChange(event.target.value as BackgroundMode)
            }
          >
            <option value="blank">Без фона</option>
            <option value="dots">Точки</option>
            <option value="grid">Клетка</option>
          </select>
        </div>
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
