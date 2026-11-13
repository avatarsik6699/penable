// Exact execution owners. New browser capabilities require an explicit policy change.
export const platformOwners = {
  "src/features/board-document/adapters/library-indexeddb.ts": ["storage"],
  "src/features/board-document/adapters/library-factory.ts": ["dom"],
  "src/features/board-document/adapters/image-preflight.ts": [
    "canvas",
    "files",
  ],
  "src/widgets/board-workspace/components/writing-surface/native/images/image-input.types.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/images/bitmap-cache.types.ts":
    ["canvas"],
  "src/widgets/board-workspace/components/writing-surface/native/images/bitmap-cache.ts":
    ["canvas", "files"],
  "src/widgets/board-workspace/components/writing-surface/native/images/image-input.ts":
    ["canvas", "files", "dom", "clipboard", "timers"],
  "src/main.tsx": ["dom"],
  "src/widgets/board-workspace/adapters/workspace-platform.ts": ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/editor-runtime.ts":
    ["canvas", "dom", "clock"],
  "src/widgets/board-workspace/components/writing-surface/native/editor-runtime.types.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/renderer.ts":
    ["frames"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/renderer.types.ts":
    ["canvas", "dom"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/layer-painter.ts":
    ["canvas"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/paint.ts":
    ["canvas"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/path-cache.ts":
    ["canvas"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/png.ts":
    ["canvas", "files", "dom", "url", "clipboard", "timers"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/surface-diagnostics.ts":
    ["dom", "timers"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/surface-presenters.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/rendering/surface-resolution.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/bindings/surface-bindings.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/bindings/surface-bindings.types.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/bindings/cursor-binding.ts":
    ["dom", "frames"],
  "src/widgets/board-workspace/components/writing-surface/native/bindings/pointer-binding.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/bindings/keyboard-binding.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/bindings/edge-pan.ts":
    ["clock", "frames"],
  "src/widgets/board-workspace/components/writing-surface/native/commands/selection-commands.ts":
    ["files"],
  "src/widgets/board-workspace/components/writing-surface/native/commands/editor-commands.types.ts":
    ["dom"],
  "src/widgets/board-workspace/components/writing-surface/native/commands/editor-controls.ts":
    ["dom"],
  "src/features/board-document/adapters/indexeddb.ts": ["storage"],
  "src/features/board-document/adapters/writer-lock.ts": ["dom", "locks"],
  "src/features/board-document/adapters/download-json.ts": [
    "url",
    "files",
    "dom",
  ],
  "src/features/board-document/adapters/session-bindings.ts": ["dom"],
  "src/features/board-document/adapters/storage-files.ts": ["files", "dom"],
  "src/features/board-document/modules/jobs/job-transport.ts": [
    "worker",
    "url",
    "messaging",
    "clock",
  ],
  "src/features/board-document/modules/jobs/document-jobs.types.ts": ["worker"],
  "src/features/board-document/modules/jobs/job-scheduling.ts": ["timers"],
  "src/features/board-document/modules/jobs/jobs-worker.ts": [
    "worker-scope",
    "messaging",
  ],
  "src/widgets/board-workspace/components/writing-surface/native/minimap/minimap.ts":
    ["dom", "timers"],
  "src/widgets/board-workspace/components/writing-surface/native/minimap/minimap-presentation.ts":
    ["canvas", "dom"],
  "src/widgets/board-workspace/components/writing-surface/native/minimap/minimap.types.ts":
    ["dom"],
  "src/shared/lib/task-clock/task-clock.ts": ["timers"],
  "src/shared/lib/overlay/overlay.ts": ["dom"],
};

export const layers = ["app", "widgets", "features", "entities", "shared"];
export const isolatedLayers = new Set(["widgets", "features", "entities"]);

export const isTest = (file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
