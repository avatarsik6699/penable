import type { AppAvailabilityTypes } from "../app-availability.types";

type InstallOffer = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export class AppPlatform {
  private disposed = false;
  private offer: InstallOffer | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private cleanups: (() => void)[] = [];
  private snapshot: AppAvailabilityTypes.Snapshot = {
    offline: import.meta.env.PROD ? "preparing" : "development",
    waiting: false,
    installable: false,
    installed: false,
    installError: false,
  };

  constructor(
    private readonly publish: (snapshot: AppAvailabilityTypes.Snapshot) => void,
  ) {}

  start() {
    const standalone = window.matchMedia("(display-mode: standalone)");

    const installed = () =>
      this.update({
        installed:
          standalone.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      });

    const offer = (event: Event) => {
      event.preventDefault();
      this.offer = event as InstallOffer;
      this.update({ installable: true, installError: false });
    };

    const accepted = () => {
      this.offer = null;
      this.update({ installed: true, installable: false });
    };

    installed();
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", accepted);
    standalone.addEventListener("change", installed);

    this.cleanups.push(() => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", accepted);
      standalone.removeEventListener("change", installed);
    });

    void this.prepare();
  }

  readonly prepare = async () => {
    if (!import.meta.env.PROD || this.disposed) return;

    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      this.update({ offline: "unavailable" });

      return;
    }

    this.update({ offline: this.registration?.active ? "ready" : "preparing" });

    try {
      const registration = await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
        {
          scope: import.meta.env.BASE_URL,
          updateViaCache: "none",
        },
      );

      if (this.disposed) return;

      if (this.registration !== registration) {
        this.registration = registration;

        const inspect = () => {
          this.update({
            offline:
              registration.active?.state === "activated"
                ? "ready"
                : registration.installing || registration.waiting
                  ? "preparing"
                  : "unavailable",
            waiting: Boolean(registration.waiting && registration.active),
          });
        };

        const observe = () => {
          const worker = registration.installing;

          if (worker) {
            worker.addEventListener("statechange", inspect);

            this.cleanups.push(() =>
              worker.removeEventListener("statechange", inspect),
            );
          }

          inspect();
        };

        registration.addEventListener("updatefound", observe);

        this.cleanups.push(() =>
          registration.removeEventListener("updatefound", observe),
        );

        observe();

        // The initial worker moves through waiting/activating without controlling this page.
        for (const worker of [registration.active, registration.waiting]) {
          worker?.addEventListener("statechange", inspect);

          this.cleanups.push(() =>
            worker?.removeEventListener("statechange", inspect),
          );
        }
      }

      await registration.update();
    } catch {
      this.update({
        offline:
          this.registration?.active?.state === "activated"
            ? "ready"
            : "unavailable",
      });
    }
  };

  readonly install = async () => {
    const offer = this.offer;

    if (!offer || this.disposed) return;

    this.offer = null;
    this.update({ installable: false, installError: false });

    try {
      await offer.prompt();
      await offer.userChoice;
    } catch {
      this.update({ installError: true });
    }
  };

  dispose() {
    this.disposed = true;
    this.offer = null;

    for (const cleanup of this.cleanups) cleanup();

    this.cleanups = [];
  }

  private update(patch: Partial<AppAvailabilityTypes.Snapshot>) {
    if (this.disposed) return;

    this.snapshot = { ...this.snapshot, ...patch };
    this.publish(this.snapshot);
  }
}
