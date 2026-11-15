import { I18n } from "~/shared/lib/i18n";
import { MinimapView } from "./components/minimap-view";
import { BoardCursorView } from "./components/board-cursor";
import { SurfaceLayers } from "./components/surface-layers";
import type React from "react";
import { useWritingSurface } from "./hooks/use-writing-surface";
import styles from "./writing-surface.module.css";
import type { WritingSurfaceTypes } from "./writing-surface.types";

export const WritingSurface: React.FC<WritingSurfaceTypes.Props> = (props) => {
  const surface = useWritingSurface(props);

  return (
    <section
      data-testid="board-surface"
      className={styles["writing-surface"]}
      aria-label={I18n.t("penInputTestBoard")}
    >
      <SurfaceLayers
        background={props.background}
        tool={props.tool}
        bindBackground={surface.bindBackground}
        bindCompleted={surface.bindCompleted}
        bindCanvas={surface.bindCanvas}
        bindSelectionPath={surface.bindSelectionPath}
        bindSelectionHandles={surface.bindSelectionHandles}
      />
      <BoardCursorView
        bindCursor={surface.bindCursor}
        bindFocusBadge={surface.bindFocusBadge}
      />
      {props.minimapOpen && (
        <MinimapView
          onClose={props.onMinimapClose}
          bindRoot={surface.bindMapRoot}
          bindMapCanvas={surface.bindMapCanvas}
          bindMapFrame={surface.bindMapFrame}
          bindMapMarker={surface.bindMapMarker}
          bindMapStatus={surface.bindMapStatus}
          bindMapOutside={surface.bindMapOutside}
          bindMapArea={surface.bindMapArea}
          bindMapFit={surface.bindMapFit}
        />
      )}
      <p id="writing-help" className={styles["visually-hidden"]}>
        {I18n.t("writeWithAPenTipOrPrimary")}
      </p>
    </section>
  );
};
