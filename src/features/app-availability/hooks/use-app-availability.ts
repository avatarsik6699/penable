import { useEffect, useRef, useState } from "react";
import { AppPlatform } from "../adapters/app-platform";
import type { AppAvailabilityTypes } from "../app-availability.types";

export function useAppAvailability() {
  const platform = useRef<AppPlatform | null>(null);

  const [snapshot, setSnapshot] = useState<AppAvailabilityTypes.Snapshot>({
    offline: "preparing",
    waiting: false,
    installable: false,
    installed: false,
    installError: false,
  });

  useEffect(function availabilityFx() {
    const instance = new AppPlatform(setSnapshot);

    platform.current = instance;
    instance.start();

    return () => {
      platform.current = null;
      instance.dispose();
    };
  }, []);

  return {
    snapshot,
    retry: () => void platform.current?.prepare(),
    install: () => void platform.current?.install(),
  };
}
