import { ImportDialog } from "./components/import-dialog";
import { StorageDetails } from "./components/storage-details";
import { StorageStatus } from "./components/storage-status";
import { Button } from "~/shared/ui/button";
import styles from "./storage-panel.module.css";
import type React from "react";
import type { StoragePanelTypes } from "./storage-panel.types";
import { useStoragePanel } from "./hooks/use-storage-panel";

export const StoragePanel: React.FC<StoragePanelTypes.Props> = (props) => {
  const panel = useStoragePanel(props);

  return (
    <section
      className={styles["storage-panel"]}
      aria-label="Локальное сохранение и копии"
    >
      <div className={styles["storage-row"]}>
        <StorageStatus state={props.state} />
        <span className={styles["storage-local"]}>
          Локально в этом браузере
        </span>
        <div className={styles["storage-actions"]}>
          <Button
            type="button"
            disabled={!props.hasDocument}
            onClick={() => panel.feedback(props.onExport())}
          >
            Скачать копию
          </Button>
          <Button
            type="button"
            disabled={
              !props.state.canImport || props.busy || props.state.importing
            }
            onClick={panel.importDialog.begin}
          >
            Импорт
          </Button>
          <Button
            ref={(node) => {
              panel.bindTrigger(node);
            }}
            type="button"
            aria-expanded={panel.popoverOpen}
            aria-controls="storage-popover"
            onClick={() => panel.setPopoverOpen((value) => !value)}
          >
            Хранение
          </Button>
        </div>
      </div>
      {panel.popoverOpen && (
        <StorageDetails
          state={props.state}
          onUpgrade={props.onUpgrade}
          onPrevious={props.onPrevious}
          onRetry={props.onRetry}
          details={panel}
        />
      )}
      <ImportDialog state={props.state} dialog={panel.importDialog} />
    </section>
  );
};
