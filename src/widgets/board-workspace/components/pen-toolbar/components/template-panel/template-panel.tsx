import type React from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { HelpHint } from "~/shared/ui/help-hint";
import { RangeInput } from "~/shared/ui/range-input";
import { InkPalette } from "../ink-palette";
import { TemplatePreview } from "./components/template-preview";
import { TemplatePicker } from "./components/template-picker";
import { MathSettings } from "./components/math-settings";
import { useTemplateDraft } from "./hooks/use-template-draft";
import type { TemplatePanelTypes } from "./template-panel.types";
import styles from "./template-panel.module.css";

export const TemplatePanel: React.FC<TemplatePanelTypes.Props> = (props) => {
  const draft = useTemplateDraft();
  const config = draft.state.config;
  const mathematical = config.kind === "axes" || config.kind === "number-line";

  const closed =
    config.kind === "rectangle" ||
    config.kind === "ellipse" ||
    config.kind === "triangle";

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label="Фигуры и заготовки"
      ref={(node) => props.bindRoot(node)}
    >
      <div className={styles.heading}>
        <h2>Фигуры и заготовки</h2>
        <div className={styles.actions}>
          <HelpHint
            label="О фигурах и заготовках"
            text="Настройте заготовку, затем нажмите на доску для вставки. Изменяйте размер ручками выделения. Автошаг подбирает читаемые деления; диапазон должен включать ноль. Esc отменяет вставку."
          />
          <Button onClick={props.onClose} aria-label="Закрыть заготовки">
            <EditorIcon name="close" />
          </Button>
        </div>
      </div>
      <TemplatePicker
        value={config.kind}
        disabled={props.disabled}
        onChange={draft.choose}
      />
      <div
        className={styles.preview}
        data-stale={Boolean(draft.state.error) || undefined}
      >
        <TemplatePreview config={draft.state.preview} />
        {draft.state.error && (
          <span className={styles.stale}>Последний корректный вид</span>
        )}
      </div>
      <div className={styles.outline}>
        <div className={styles.caption}>
          <label htmlFor="template-line-width">Толщина контура</label>
          <output htmlFor="template-line-width">
            {config.lineWidth.toFixed(1)}
            <span>px</span>
          </output>
        </div>
        <RangeInput
          id="template-line-width"
          min="0.5"
          max="12"
          step="0.5"
          value={config.lineWidth}
          disabled={props.disabled}
          onChange={(event) =>
            draft.change({ lineWidth: Number(event.target.value) })
          }
        />
      </div>
      <InkPalette
        color={config.color}
        disabled={props.disabled}
        onChange={(color) => draft.change({ color })}
      />
      {!mathematical && config.kind !== "circle" && (
        <fieldset disabled={props.disabled} className={styles.options}>
          <legend>Оформление фигуры</legend>
          <label>
            <input
              type="checkbox"
              checked={config.dashed}
              onChange={(event) =>
                draft.change({ dashed: event.target.checked })
              }
            />
            Пунктир
          </label>
          {closed && (
            <label>
              <input
                type="checkbox"
                checked={config.fill !== null}
                onChange={(event) =>
                  draft.change({
                    fill: event.target.checked ? config.color : null,
                  })
                }
              />
              Заливка
            </label>
          )}
        </fieldset>
      )}
      {config.fill && (
        <InkPalette
          color={config.fill}
          label="Цвет заливки"
          disabled={props.disabled}
          onChange={(fill) => draft.change({ fill })}
        />
      )}
      {mathematical && (
        <MathSettings
          state={draft.state}
          disabled={props.disabled}
          onField={draft.field}
          onAutomatic={draft.automatic}
          onRecommendation={draft.applyRecommendation}
          onNumbers={(numbers) => draft.change({ numbers })}
          onGrid={(grid) => draft.change({ grid })}
        />
      )}
      {config.kind === "circle" && (
        <fieldset disabled={props.disabled} className={styles.options}>
          <legend>Оформление окружности</legend>
          <label>
            <input
              type="checkbox"
              checked={config.labels}
              onChange={(event) =>
                draft.change({ labels: event.target.checked })
              }
            />
            Подписи углов в радианах
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.rays}
              onChange={(event) => draft.change({ rays: event.target.checked })}
            />
            Вспомогательные лучи
          </label>
        </fieldset>
      )}
      <Button
        className={styles.place}
        disabled={props.disabled || !draft.state.resolved}
        onClick={() => {
          if (draft.state.resolved) props.onPlace(draft.state.resolved);
        }}
      >
        Разместить на доске
      </Button>
    </div>
  );
};
