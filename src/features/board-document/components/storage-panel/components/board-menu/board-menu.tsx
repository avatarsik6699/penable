import type React from "react";
import type { BoardMenuTypes } from "./board-menu.types";
import styles from "./board-menu.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const BoardMenu: React.FC<BoardMenuTypes.Props> = (props) => (
  <div
    ref={(node) => {
      props.bindRoot(node);
    }}
    id="board-menu"
    className={styles.panel}
    role="dialog"
    aria-label="Меню доски"
  >
    <div className={styles.heading}>
      <h2>Доска</h2>
      <Button onClick={props.onClose} aria-label="Закрыть меню доски">
        <EditorIcon name="close" />
      </Button>
    </div>
    <div className={styles.actions}>
      <Button
        disabled={!props.hasDocument}
        onClick={props.onExport}
        aria-label="Скачать копию"
      >
        <EditorIcon name="download" />
        Скачать JSON-копию
      </Button>
      <Button
        disabled={!props.state.canImport || props.busy || props.state.importing}
        onClick={props.onImport}
        aria-label="Импорт"
      >
        <EditorIcon name="upload" />
        Импортировать копию
      </Button>
    </div>
    <div className={styles.divider} />
    {props.backgroundControl}
    <div className={styles.divider} />
    <div className={styles.recovery}>
      <h3>Резервные копии</h3>
      {props.state.hasPrevious ? (
        <Button onClick={props.onPrevious}>
          <EditorIcon name="history" />
          Копия до замены
          <EditorIcon name="download" />
        </Button>
      ) : (
        <p>Копии до замены пока нет.</p>
      )}
      {props.state.hasUpgradeCopy ? (
        <Button onClick={props.onUpgrade}>
          <EditorIcon name="history" />
          Копия до обновления
          <EditorIcon name="download" />
        </Button>
      ) : (
        <p>Копии до обновления пока нет.</p>
      )}
    </div>
    <p className={styles.local}>
      <EditorIcon name="device" />
      <span>
        Копия хранится в этом браузере.
        <br />
        JSON-файл поможет сохранить её отдельно.
      </span>
    </p>
  </div>
);
