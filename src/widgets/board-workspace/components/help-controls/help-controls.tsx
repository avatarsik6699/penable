import type React from "react";
import type { HelpControlsTypes } from "./help-controls.types";
import styles from "./help-controls.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import { PointerDiagnostics } from "../pointer-diagnostics";

export const HelpControls: React.FC<HelpControlsTypes.Props> = (props) => {
  const help = usePanelDismiss({
    open: props.open,
    onClose: () => props.onOpenChange(false),
  });

  const diagnostics = usePanelDismiss({
    open: props.diagnosticsOpen,
    onEscape: props.onCancelActiveInput,
    onClose: () => props.onDiagnosticsChange(false),
    dismissOutside: false,
  });

  return (
    <>
      <div className={styles.chrome} data-editor-chrome="">
        <Button
          ref={(node) => {
            help.bindTrigger(node);
            diagnostics.bindTrigger(node);
          }}
          aria-label="Помощь"
          title="Помощь"
          aria-haspopup="dialog"
          aria-expanded={props.open || props.diagnosticsOpen}
          aria-controls={
            props.diagnosticsOpen ? "diagnostics-panel" : "help-panel"
          }
          onClick={() => props.onOpenChange(!props.open)}
        >
          <EditorIcon name="help" />
        </Button>
      </div>
      {props.open && (
        <div
          ref={(node) => {
            help.bindRoot(node);
          }}
          id="help-panel"
          className={styles.panel}
          role="dialog"
          aria-label="Помощь"
        >
          <div className={styles.heading}>
            <h2>Работа с доской</h2>
            <Button onClick={help.closeAndFocus} aria-label="Закрыть помощь">
              <EditorIcon name="close" />
            </Button>
          </div>
          <dl>
            <div>
              <dt>Письмо</dt>
              <dd>
                Перо или основная кнопка мыши. Для касаний включите «Рисовать
                пальцем» в параметрах пера.
              </dd>
            </div>
            <div>
              <dt>Перемещение</dt>
              <dd>
                Один палец на экране, два пальца на тачпаде или пробел +
                перетаскивание
              </dd>
            </div>
            <div>
              <dt>Масштаб</dt>
              <dd>Два пальца на экране / Ctrl + колесо</dd>
            </div>
            <div>
              <dt>Отмена / возврат</dt>
              <dd>Ctrl+Z / Ctrl+Shift+Z</dd>
            </div>
            <div>
              <dt>Выделение</dt>
              <dd>
                Обведите область и перетащите её. Ластик удаляет штрихи целиком.
              </dd>
            </div>
          </dl>
          <Button
            className={styles.diagnosticButton}
            onClick={() => props.onDiagnosticsChange(true)}
          >
            <EditorIcon name="device" />
            Диагностика
          </Button>
        </div>
      )}
      {props.diagnosticsOpen && (
        <div
          ref={(node) => {
            diagnostics.bindRoot(node);
          }}
          id="diagnostics-panel"
          className={styles.panel}
          role="dialog"
          aria-label="Диагностика ввода"
        >
          <div className={styles.heading}>
            <h2>Диагностика</h2>
            <Button
              onClick={diagnostics.closeAndFocus}
              aria-label="Закрыть диагностику"
            >
              <EditorIcon name="close" />
            </Button>
          </div>
          <p className={styles.hint}>
            Панель остаётся открытой во время письма.
          </p>
          <PointerDiagnostics diagnostics={props.diagnostics} />
        </div>
      )}
    </>
  );
};
