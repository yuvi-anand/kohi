import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';

interface Coords {
  latitude: number;
  longitude: number;
}

interface LocationContextType {
  coords: Coords | null;
  permissionDenied: boolean;
  loading: boolean;
  retry: () => void;
}

const LocationContext = createContext<LocationContextType>({
  coords: null,
  permissionDenied: false,
  loading: true,
  retry: () => {},
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function request() {
      setLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setPermissionDenied(true);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setPermissionDenied(false);
        }
      } catch {
        // location unavailable — leave coords null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    request();
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <LocationContext.Provider
      value={{ coords, permissionDenied, loading, retry: () => setTick((t) => t + 1) }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => useContext(LocationContext);
