import type React from "react";
import { useRef } from "react";
import { I18n } from "~/shared/lib/i18n";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import { Button } from "~/shared/ui/button";
import type { RecoveryBrowserTypes } from "./recovery-browser.types";
import styles from "./recovery-browser.module.css";

export const RecoveryBrowser: React.FC<RecoveryBrowserTypes.Props> = (
  props,
) => {
  const firstBoard = useRef<OverlayElements.Button | null>(null);
  const recovery = props.library.recovery;

  if (!recovery) return null;

  const boards = props.library.boards.filter(
    (board) => board.id !== props.library.activeId,
  );

  const pending = boards.find((board) => board.id === recovery.pendingId);
  const preview = boards.find((board) => board.id === recovery.previewId);

  return (
    <section
      className={styles.browser}
      aria-labelledby="recovery-browser-title"
    >
      <h3 id="recovery-browser-title">{I18n.t("recoverBoards")}</h3>
      <div className={styles.boards}>
        {boards.map((board, index) => (
          <Button
            key={board.id}
            ref={index === 0 ? firstBoard : undefined}
            aria-pressed={board.id === recovery.previewId}
            onClick={() => props.onPreview(board.id)}
          >
            {board.title}
          </Button>
        ))}
      </div>
      <div role="status">
        {preview && (
          <p>{I18n.t("viewingRecoveryPreview", { p0: preview.title })}</p>
        )}
        {pending && (
          <p>{I18n.t("openingRecoveryPreview", { p0: pending.title })}</p>
        )}
        {recovery.message && (
          <p className={styles.error}>{I18n.text(recovery.message)}</p>
        )}
      </div>
      {(preview || pending) && (
        <Button
          onClick={() => {
            Overlay.focus(firstBoard.current);
            props.onClosePreview();
          }}
        >
          {I18n.t("closeRecoveryPreview")}
        </Button>
      )}
    </section>
  );
};
