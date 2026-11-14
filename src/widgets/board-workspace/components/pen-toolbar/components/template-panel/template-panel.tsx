import type React from "react";
import { useState } from "react";
import { BoardTemplates, type TemplateConfig } from "~/entities/board";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { InkPalette } from "../ink-palette";
import { TemplatePreview } from "./components/template-preview";
import type { TemplatePanelTypes } from "./template-panel.types";
import styles from "./template-panel.module.css";

export const TemplatePanel: React.FC<TemplatePanelTypes.Props> = (props) => {
  const [config, setConfig] = useState<TemplateConfig>(() =>
    BoardTemplates.defaults(),
  );

  const [explicitSize, setExplicitSize] = useState(false);
  const error = BoardTemplates.validate(config);
  const mathematical = config.kind === "axes" || config.kind === "number-line";

  const closed =
    config.kind === "rectangle" ||
    config.kind === "ellipse" ||
    config.kind === "triangle";

  const change = (patch: Partial<TemplateConfig>) =>
    setConfig({ ...config, ...patch });

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label="Фигуры и заготовки"
      ref={(node) => props.bindRoot(node)}
    >
      <div className={styles.heading}>
        <h2>Фигуры и заготовки</h2>
        <Button onClick={props.onClose} aria-label="Закрыть заготовки">
          <EditorIcon name="close" />
        </Button>
      </div>
      <div className={styles.choices} role="group" aria-label="Фигуры">
        {BoardTemplates.kinds.slice(0, 5).map((kind) => (
          <Button
            key={kind}
            aria-pressed={config.kind === kind}
            disabled={props.disabled}
            onClick={() => {
              setExplicitSize(false);

              setConfig({
                ...BoardTemplates.defaults(kind),
                color: config.color,
              });
            }}
          >
            {BoardTemplates.names[kind]}
          </Button>
        ))}
      </div>
      <h3>Математика</h3>
      <div className={styles.choices} role="group" aria-label="Математика">
        {BoardTemplates.kinds.slice(5).map((kind) => (
          <Button
            key={kind}
            aria-pressed={config.kind === kind}
            disabled={props.disabled}
            onClick={() => {
              setExplicitSize(false);

              setConfig({
                ...BoardTemplates.defaults(kind),
                color: config.color,
              });
            }}
          >
            {BoardTemplates.names[kind]}
          </Button>
        ))}
      </div>
      <div className={styles.preview}>
        {!error && <TemplatePreview config={config} />}
      </div>
      <fieldset disabled={props.disabled} className={styles.fields}>
        <legend>Параметры</legend>
        <div className={styles.row}>
          <label>
            Ширина
            <input
              type="number"
              min={config.kind === "circle" ? 280 : 40}
              max="2000"
              value={Number.isFinite(config.width) ? config.width : ""}
              onChange={(event) => {
                setExplicitSize(true);

                const width = event.target.valueAsNumber;

                change(
                  config.kind === "circle"
                    ? { width, height: width }
                    : { width },
                );
              }}
            />
          </label>
          <label>
            Высота
            <input
              type="number"
              min="40"
              max="2000"
              disabled={config.kind === "circle"}
              value={Number.isFinite(config.height) ? config.height : ""}
              onChange={(event) => {
                setExplicitSize(true);
                change({ height: event.target.valueAsNumber });
              }}
            />
          </label>
        </div>
        <label>
          Толщина контура
          <input
            type="number"
            min="0.5"
            max="12"
            step="0.5"
            value={Number.isFinite(config.lineWidth) ? config.lineWidth : ""}
            onChange={(event) =>
              change({ lineWidth: event.target.valueAsNumber })
            }
          />
        </label>
        {!mathematical && config.kind !== "circle" && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={config.dashed}
              onChange={(event) => change({ dashed: event.target.checked })}
            />
            Пунктир
          </label>
        )}
        {closed && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={config.fill !== null}
              onChange={(event) =>
                change({ fill: event.target.checked ? config.color : null })
              }
            />
            Заливка
          </label>
        )}
        {mathematical && (
          <>
            <div className={styles.row}>
              <label>
                От
                <input
                  type="number"
                  value={Number.isFinite(config.min) ? config.min : ""}
                  onChange={(event) =>
                    change({ min: event.target.valueAsNumber })
                  }
                />
              </label>
              <label>
                До
                <input
                  type="number"
                  value={Number.isFinite(config.max) ? config.max : ""}
                  onChange={(event) =>
                    change({ max: event.target.valueAsNumber })
                  }
                />
              </label>
            </div>
            <label>
              Шаг делений
              <input
                type="number"
                min="0.000001"
                step="any"
                value={Number.isFinite(config.step) ? config.step : ""}
                onChange={(event) =>
                  change({ step: event.target.valueAsNumber })
                }
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={config.numbers}
                onChange={(event) => change({ numbers: event.target.checked })}
              />
              Числа
            </label>
            {config.kind === "axes" && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={config.grid}
                  onChange={(event) => change({ grid: event.target.checked })}
                />
                Сетка
              </label>
            )}
          </>
        )}
        {config.kind === "circle" && (
          <>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={config.labels}
                onChange={(event) => change({ labels: event.target.checked })}
              />
              Подписи углов в радианах
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={config.rays}
                onChange={(event) => change({ rays: event.target.checked })}
              />
              Вспомогательные лучи
            </label>
          </>
        )}
      </fieldset>
      <p className={styles.help}>
        Размеры — в единицах доски. Заготовка будет уменьшена, если не
        помещается в видимой области.
      </p>
      <InkPalette
        color={config.color}
        disabled={props.disabled}
        onChange={(color) => change({ color })}
      />
      {config.fill && (
        <InkPalette
          color={config.fill}
          label="Цвет заливки"
          disabled={props.disabled}
          onChange={(fill) => change({ fill })}
        />
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button
        className={styles.place}
        disabled={props.disabled || Boolean(error)}
        onClick={() => props.onPlace(config, explicitSize)}
      >
        Разместить на доске
      </Button>
      <p className={styles.help}>
        Параметры задаются до вставки. Затем заготовку можно перемещать, менять
        размер и вырезать её части.
      </p>
    </div>
  );
};
