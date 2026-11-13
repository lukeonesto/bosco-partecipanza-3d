import { useCallback, useEffect, useRef, useState } from 'react';

interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationConstructorWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export interface UseCompassResult {
  compassEnabled: boolean;
  heading: number | null;
  compassError: string | null;
  toggleCompass: () => Promise<void>;
  disableCompass: () => void;
  clearCompassError: () => void;
}

export function useCompass(unsupportedMessage: string): UseCompassResult {
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassError, setCompassError] = useState<string | null>(null);

  const smoothedRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);

  const disableCompass = useCallback(() => {
    setCompassEnabled(false);
  }, []);

  const clearCompassError = useCallback(() => {
    setCompassError(null);
  }, []);

  const toggleCompass = useCallback(async () => {
    if (compassEnabled) {
      setCompassEnabled(false);
      return;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setCompassError(unsupportedMessage);
      return;
    }

    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationConstructorWithPermission;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const perm = await DOE.requestPermission();
        if (perm !== 'granted') {
          setCompassError(unsupportedMessage);
          return;
        }
      } catch {
        setCompassError(unsupportedMessage);
        return;
      }
    }

    setCompassError(null);
    smoothedRef.current = null;
    setCompassEnabled(true);
  }, [compassEnabled, unsupportedMessage]);

  useEffect(() => {
    if (!compassEnabled) return;

    const handleOrientation = (event: Event) => {
      const e = event as DeviceOrientationEventWithWebkit;
      let rawHeading: number | null = null;

      if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
        rawHeading = e.webkitCompassHeading;
      } else if (e.absolute && typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        rawHeading = (360 - e.alpha) % 360;
      } else if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        rawHeading = (360 - e.alpha) % 360;
      }

      if (rawHeading === null) return;

      const normalized = ((rawHeading % 360) + 360) % 360;
      const prev = smoothedRef.current;

      let nextHeading: number;
      if (prev === null) {
        nextHeading = normalized;
      } else {
        // Shortest-arc circular smoothing to avoid 359° -> 0° jumps
        const delta = ((normalized - prev + 540) % 360) - 180;
        nextHeading = (prev + 0.25 * delta + 360) % 360;
      }
      smoothedRef.current = nextHeading;

      const now = performance.now();
      if (now - lastEmitRef.current >= 90) {
        lastEmitRef.current = now;
        setHeading(Math.round(nextHeading));
      }
    };

    const eventName =
      'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : 'deviceorientation';

    window.addEventListener(eventName, handleOrientation, true);
    return () => {
      window.removeEventListener(eventName, handleOrientation, true);
    };
  }, [compassEnabled]);

  return {
    compassEnabled,
    heading,
    compassError,
    toggleCompass,
    disableCompass,
    clearCompassError,
  };
}
