import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import { Linking } from "react-native";

import { useToast } from "@/src/components/toast";

type PickImageOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  permissionMessage?: string;
};

export function useImagePicker() {
  const toast = useToast();

  return useCallback(async ({
    allowsEditing = false,
    aspect,
    quality = 0.7,
    permissionMessage = "Akses foto dibutuhkan untuk memilih foto",
  }: PickImageOptions = {}): Promise<string | null> => {
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (permission.status !== "granted") {
      toast(
        permission.canAskAgain ? permissionMessage : "Izinkan akses foto di Pengaturan",
        "info",
      );
      if (!permission.canAskAgain) void Linking.openSettings();
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing,
      aspect,
      quality,
    });
    return result.canceled ? null : result.assets[0].uri;
  }, [toast]);
}
