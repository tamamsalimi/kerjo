import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";

type LocState = "undetermined" | "granted" | "denied";

export function useLocation() {
  const [status, setStatus] = useState<LocState>("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      setStatus(perm.granted ? "granted" : perm.canAskAgain ? "undetermined" : "denied");
      setCanAskAgain(perm.canAskAgain);
      if (perm.granted) fetchCoords();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCoords = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      // ignore
    }
  }, []);

  // Returns one of: 'granted' | 'denied' | 'blocked'
  const request = useCallback(async (): Promise<"granted" | "denied" | "blocked"> => {
    if (Platform.OS === "web") {
      setStatus("granted");
      return "granted";
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
