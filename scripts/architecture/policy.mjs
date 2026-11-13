// Exact execution owners. New browser capabilities require an explicit policy change.
export const platformOwners = {
  "src/main.tsx": ["dom"],
  "src/widgets/board-workspace/native/renderer.ts": ["canvas", "dom", "frames"],
  "src/widgets/board-workspace/native/paint.ts": ["canvas"],
  "src/widgets/board-workspace/native/path-cache.ts": ["canvas"],
  "src/widgets/board-workspace/native/png.ts": [
    "canvas",
    "files",
    "dom",
    "url",
    "clipboard",
    "timers",
  ],
  "src/widgets/board-workspace/native/editor-runtime.ts": [
    "canvas",
    "dom",
    "clock",
    "files",
  ],
  "src/widgets/board-workspace/native/surface-bindings.ts": [
    "dom",
    "frames",
    "clock",
  ],
  "src/widgets/board-workspace/native/surface-resolution.ts": ["dom"],
  "src/widgets/board-workspace/native/surface-diagnostics.ts": [
    "dom",
    "timers",
  ],
  "src/widgets/board-workspace/native/surface-elements.ts": ["dom"],
  "src/widgets/board-workspace/native/surface-presenters.ts": ["dom"],
  "src/widgets/board-workspace/native/workspace-platform.ts": ["dom"],
  "src/features/board-document/adapters/indexeddb.ts": ["storage"],
  "src/features/board-document/adapters/writer-lock.ts": ["dom", "locks"],
  "src/features/board-document/adapters/jobs.ts": [
    "worker",
    "url",
    "messaging",
    "timers",
    "clock",
  ],
  "src/features/board-document/adapters/jobs-worker.ts": [
    "worker-scope",
    "messaging",
  ],
  "src/features/board-document/adapters/download-json.ts": [
    "url",
    "files",
    "dom",
  ],
  "src/features/board-document/adapters/session-bindings.ts": ["dom"],
  "src/features/board-document/adapters/storage-files.ts": ["files", "dom"],
  "src/shared/lib/task-clock/task-clock.ts": ["timers"],
  "src/shared/lib/overlay/overlay.ts": ["dom"],
};

export const layers = ["app", "widgets", "features", "entities", "shared"];
export const isolatedLayers = new Set(["widgets", "features", "entities"]);

export const isTest = (file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
