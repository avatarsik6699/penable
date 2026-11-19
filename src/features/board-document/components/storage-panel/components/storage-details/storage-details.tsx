import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import type { StorageDetailsTypes } from "./storage-details.types";
import styles from "./storage-details.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { StorageStatus } from "../storage-status";
import { RecoveryBrowser } from "../recovery-browser";
import { useExportCopy } from "./hooks/use-export-copy";

export const StorageDetails: React.FC<StorageDetailsTypes.Props> = (props) => {
  const exported = useExportCopy(props);

  return (
    <div className={styles.content}>
      <div className={styles.state}>
        <StorageStatus
          state={props.state}
          recovering={Boolean(props.recovery.library.recovery)}
        />
      </div>
      {props.state.message && (
        <p className={props.state.phase === "error" ? styles.error : undefined}>
          {I18n.text(props.state.message)}
        </p>
      )}
      {props.notice && <p role="status">{I18n.text(props.notice)}</p>}
      {props.state.phase === "error" && props.state.writable ? (
        <Button className={styles.primary} onClick={props.onRetry}>
          <EditorIcon name="retry" />
          {I18n.t("retrySave")}
        </Button>
      ) : (
        props.state.canReconnect && (
          <Button className={styles.secondary} onClick={props.onRetry}>
            <EditorIcon name="retry" />
            {I18n.t("reconnect")}
          </Button>
        )
      )}
      <div className={styles.actions}>
        <Button
          disabled={!props.hasDocument || exported.busy}
          aria-label={I18n.t("downloadCopy")}
          onClick={() => void exported.download()}
        >
          <EditorIcon name="download" />
          {I18n.t("downloadJsonCopy")}
        </Button>
        <Button
          disabled={
            !props.state.canImport || props.busy || props.state.importing
          }
          aria-label={I18n.t("import")}
          onClick={props.onImport}
        >
          <EditorIcon name="upload" />
          {I18n.t("importBackup")}
        </Button>
      </div>
      <RecoveryBrowser {...props.recovery} />
      <div className={styles.recovery}>
        <h3>{I18n.t("recoveryCopies")}</h3>
        {props.state.hasRawCopy && (
          <Button onClick={() => void exported.download(props.onRaw)}>
            <EditorIcon name="history" />
            {I18n.t("originalRecord")}
          </Button>
        )}
        {props.state.hasSchema6Copy && props.onSchema6 && (
          <Button onClick={() => void exported.download(props.onSchema6!)}>
            <EditorIcon name="history" />
            {I18n.t("downloadCopyBeforeDocument6")}
          </Button>
        )}
        {props.state.hasSchema5Copy && props.onSchema5 && (
          <Button onClick={() => void exported.download(props.onSchema5!)}>
            {I18n.t("beforeTheToolsUpdate")}
          </Button>
        )}
        {props.state.hasSchema4Copy && (
          <Button onClick={() => void exported.download(props.onSchema4)}>
            <EditorIcon name="history" />
            {I18n.t("copyBeforeV4Update")}
          </Button>
        )}
        {props.state.hasLibraryCopy && (
          <Button onClick={() => void exported.download(props.onLibrary)}>
            <EditorIcon name="history" />
            {I18n.t("copyBeforeBoardLibrary")}
          </Button>
        )}
        {props.state.hasPrevious && (
          <Button onClick={() => void exported.download(props.onPrevious)}>
            <EditorIcon name="history" />
            {I18n.t("copyBeforeReplacement")}
          </Button>
        )}
        {props.state.hasSchema3Copy && (
          <Button onClick={() => void exported.download(props.onSchema3)}>
            <EditorIcon name="history" />
            {I18n.t("copyBeforeUpdate")}
          </Button>
        )}
        {props.state.hasUpgradeCopy && (
          <Button onClick={() => void exported.download(props.onUpgrade)}>
            <EditorIcon name="history" />
            {I18n.text(
              props.state.hasSchema3Copy
                ? Messages.create("earlierCopyBeforeUpdate")
                : Messages.create("copyBeforeUpdate"),
            )}
          </Button>
        )}
        {!props.state.hasPrevious &&
          !props.state.hasSchema4Copy &&
          !props.state.hasSchema5Copy &&
          !props.state.hasSchema6Copy &&
          !props.state.hasLibraryCopy &&
          !props.state.hasRawCopy &&
          !props.state.hasSchema3Copy &&
          !props.state.hasUpgradeCopy && <p>{I18n.t("noRecoveryCopiesYet")}</p>}
      </div>
      <p className={styles.help}>{I18n.t("notesStayInThisBrowserProfileA")}</p>
    </div>
  );
};
