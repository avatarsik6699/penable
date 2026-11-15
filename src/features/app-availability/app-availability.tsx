import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { useState } from "react";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { usePanelDismiss } from "~/shared/ui/panel-dismiss";
import { useAppAvailability } from "./hooks/use-app-availability";
import type { AppAvailabilityTypes } from "./app-availability.types";
import styles from "./app-availability.module.css";

export const AppAvailability: React.FC<AppAvailabilityTypes.Props> = () => {
  const availability = useAppAvailability();
  const [open, setOpen] = useState(false);
  const panel = usePanelDismiss({ open, onClose: () => setOpen(false) });

  const labels = {
    preparing: Messages.create("preparingOfflineAccess"),
    ready: Messages.create("readyToWorkOffline"),
    unavailable: Messages.create("couldNotPrepareOfflineAccess"),
    development: Messages.create("offlineAccessIsAvailableInThePublished"),
  };

  return (
    <>
      <div className={styles.trigger} data-editor-chrome="">
        <Button
          ref={(node) => panel.bindTrigger(node)}
          aria-label={I18n.t("appAndOffline")}
          title={I18n.t("appAndOffline")}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="app-availability-panel"
          onClick={() => setOpen(!open)}
        >
          <EditorIcon name="device" />
        </Button>
      </div>
      {open && (
        <div
          ref={(node) => panel.bindRoot(node)}
          className={styles.panel}
          id="app-availability-panel"
          role="dialog"
          aria-label={I18n.t("appAndOffline")}
          data-editor-chrome=""
        >
          <div className={styles.heading}>
            <h2>{I18n.t("appAndOffline")}</h2>
            <Button
              aria-label={I18n.t("closeAppAndOffline")}
              onClick={panel.closeAndFocus}
            >
              <EditorIcon name="close" />
            </Button>
          </div>
          <p role="status">
            {I18n.text(labels[availability.snapshot.offline])}
          </p>
          {availability.snapshot.offline === "unavailable" && (
            <Button className={styles.action} onClick={availability.retry}>
              {I18n.t("retryPreparation")}
            </Button>
          )}
          {availability.snapshot.waiting && (
            <p>{I18n.t("updateReadyWaitForYourNotesTo")}</p>
          )}
          {availability.snapshot.installable &&
            !availability.snapshot.installed && (
              <Button className={styles.action} onClick={availability.install}>
                {I18n.t("installPenable")}
              </Button>
            )}
          {availability.snapshot.installed && (
            <p>{I18n.t("penableIsRunningAsAnApp")}</p>
          )}
          {availability.snapshot.installError && (
            <p>{I18n.t("couldNotOpenInstallationTryInstallingPenable")}</p>
          )}
          <p className={styles.hint}>
            {I18n.t("inChromeAndEdgeInstallFromThe")}
          </p>
          <p className={styles.hint}>
            {I18n.t("theFirstLoadNeedsInternetOncePrepared")}
          </p>
          <p className={styles.hint}>
            {I18n.t("notesStayInThisBrowserInstallationDoes")}
          </p>
        </div>
      )}
    </>
  );
};
