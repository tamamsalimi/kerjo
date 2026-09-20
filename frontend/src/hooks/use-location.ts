import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";

type LocState = "undetermined" | "granted" | "denied";
type Coordinates = { latitude: number; longitude: number };

let cachedCoords: Coordinates | null = null;

export function useLocation() {
  const [status, setStatus] = useState<LocState>("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [coords, setCoordsState] = useState<Coordinates | null>(cachedCoords);
  const setCoords = useCallback((value: Coordinates) => {
    cachedCoords = value;
    setCoordsState(value);
  }, []);

  const fetchCoords = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          });
        });
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        return true;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      return true;
    } catch {
      return false;
    }
  }, [setCoords]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      setStatus(perm.granted ? "granted" : perm.canAskAgain ? "undetermined" : "denied");
      setCanAskAgain(perm.canAskAgain);
      if (perm.granted) fetchCoords();
    })();
  }, [fetchCoords]);

  // Returns one of: 'granted' | 'denied' | 'blocked'
  const request = useCallback(async (): Promise<"granted" | "denied" | "blocked"> => {
    if (Platform.OS === "web") {
      const granted = await fetchCoords();
      setStatus(granted ? "granted" : "denied");
      return granted ? "granted" : "denied";
    }
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      setStatus("granted");
      fetchCoords();
      return "granted";
    }
    if (!current.canAskAgain) {
      setStatus("denied");
      setCanAskAgain(false);
      Linking.openSettings();
      return "blocked";
    }
    const res = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(res.canAskAgain);
    if (res.granted) {
      setStatus("granted");
      fetchCoords();
      return "granted";
    }
    setStatus("denied");
    if (!res.canAskAgain) return "blocked";
    return "denied";
  }, [fetchCoords]);

  return { status, canAskAgain, coords, request };
}
