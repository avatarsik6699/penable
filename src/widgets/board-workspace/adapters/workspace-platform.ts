import { I18n } from "~/shared/lib/i18n";
import { BoardCoordinates } from "~/entities/board";
import { DocumentDownloads, BoardLibraries } from "~/features/board-document";
import { WorkspaceModel } from "../model/workspace-model";

function create(): WorkspaceModel {
  return new WorkspaceModel({
    session: BoardLibraries.create,
    defaultBoardTitle: I18n.t("myBoard"),
    download: DocumentDownloads.download,
    diagnostics: {
      pointerType: null,
      pressure: null,
      active: false,
      dpr: BoardCoordinates.validDpr(window.devicePixelRatio),
      coalesced:
        typeof PointerEvent !== "undefined" &&
        typeof PointerEvent.prototype.getCoalescedEvents === "function",
      zoom: 1,
      nativeScale: BoardCoordinates.validDpr(window.visualViewport?.scale ?? 1),
      requestedRatio: 1,
      effectiveRatio: 1,
      bitmapWidth: 0,
      bitmapHeight: 0,
      resolutionCapped: false,
    },
  });
}

export const WorkspacePlatform = { create };
