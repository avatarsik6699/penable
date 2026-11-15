import { I18n } from "~/shared/lib/i18n";
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
          aria-label={I18n.t("help")}
          title={I18n.t("help")}
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
          aria-label={I18n.t("help")}
        >
          <div className={styles.heading}>
            <h2>{I18n.t("usingTheBoard")}</h2>
            <Button
              onClick={help.closeAndFocus}
              aria-label={I18n.t("closeHelp")}
            >
              <EditorIcon name="close" />
            </Button>
          </div>
          <dl>
            <div>
              <dt>{I18n.t("writing")}</dt>
              <dd>{I18n.t("penOrPrimaryMouseButtonForTouch")}</dd>
            </div>
            <div>
              <dt>{I18n.t("pan")}</dt>
              <dd>{I18n.t("oneFingerOnScreenTwoFingersOn")}</dd>
            </div>
            <div>
              <dt>{I18n.t("zoom")}</dt>
              <dd>{I18n.t("twoFingersOnScreenCtrlWheel")}</dd>
            </div>
            <div>
              <dt>{I18n.t("undoRedo")}</dt>
              <dd>Ctrl+Z / Ctrl+Shift+Z</dd>
            </div>
            <div>
              <dt>{I18n.t("selection")}</dt>
              <dd>{I18n.t("drawARegionAndDragItThe")}</dd>
            </div>
          </dl>
          <Button
            className={styles.diagnosticButton}
            onClick={() => props.onDiagnosticsChange(true)}
          >
            <EditorIcon name="device" />
            {I18n.t("diagnostics")}
          </Button>
          <a
            className={styles.feedbackLink}
            href="https://t.me/avatarsikkk"
            target="_blank"
            rel="noopener noreferrer"
            title={I18n.t("openTelegramInANewTab")}
          >
            <EditorIcon name="message" />
            {I18n.t("telegramFeedback")}
          </a>
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
          aria-label={I18n.t("inputDiagnostics")}
        >
          <div className={styles.heading}>
            <h2>{I18n.t("diagnostics")}</h2>
            <Button
              onClick={diagnostics.closeAndFocus}
              aria-label={I18n.t("closeDiagnostics")}
            >
              <EditorIcon name="close" />
            </Button>
          </div>
          <p className={styles.hint}>
            {I18n.t("thisPanelStaysOpenWhileYouWrite")}
          </p>
          <PointerDiagnostics diagnostics={props.diagnostics} />
        </div>
      )}
    </>
  );
};
