export namespace AppAvailabilityTypes {
  export type Props = Record<never, never>;

  export type Snapshot = {
    offline: "preparing" | "ready" | "unavailable" | "development";
    waiting: boolean;
    installable: boolean;
    installed: boolean;
    installError: boolean;
  };
}
