import { SelectionActions } from "./components/selection-actions";
import { Button } from "~/shared/ui/button";
import styles from "./selection-toolbar.module.css";
import type React from "react";
import type { SelectionToolbarTypes } from "./selection-toolbar.types";
import { useSelectionActions } from "./hooks/use-selection-actions";

export const SelectionToolbar: React.FC<SelectionToolbarTypes.Props> = (
  props,
) => {
  const toolbar = useSelectionActions(props);

  return (
    <div
      ref={(node) => {
        toolbar.bindRoot(node);
      }}
      className={styles["selection-toolbar"]}
      data-board-selection-toolbar=""
      role="region"
      aria-label="Действия выделения"
    >
      <div
        className={styles["selection-actions"]}
        role="group"
        aria-label="Способ выделения"
      >
        <Button
          type="button"
          aria-pressed={props.shape === "rectangle"}
          disabled={toolbar.busy}
          onClick={() => toolbar.changeShape("rectangle")}
        >
          Рамка
        </Button>
        <Button
          type="button"
          aria-pressed={props.shape === "lasso"}
          disabled={toolbar.busy}
          onClick={() => toolbar.changeShape("lasso")}
        >
          Лассо
        </Button>
        <Button
          ref={(node) => {
            toolbar.bindTrigger(node);
          }}
          type="button"
          aria-expanded={toolbar.open}
          aria-controls="selection-menu"
          disabled={props.blocked}
          onClick={() => toolbar.setOpen((value) => !value)}
        >
          Действия
        </Button>
      </div>
      {toolbar.open && (
        <SelectionActions
          state={props.state}
          readOnly={props.readOnly}
          blocked={props.blocked}
          busy={toolbar.busy}
          command={toolbar.command}
        />
      )}
      {!toolbar.open && props.state.message && (
        <p className={styles["selection-feedback"]} role="status">
          {props.state.message}
        </p>
      )}
    </div>
  );
};
