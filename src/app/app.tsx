import type React from "react";
import { BoardWorkspace } from "~/widgets/board-workspace";
import type { AppTypes } from "./app.types";

export const App: React.FC<AppTypes.Props> = () => <BoardWorkspace />;
