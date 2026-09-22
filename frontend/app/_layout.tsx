import { Fredoka_600SemiBold } from "@expo-google-fonts/fredoka";
import { Nunito_600SemiBold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/toast";
import { AuthProvider, useAuth } from "@/src/features/auth/auth-context";
import { PhoneFrame } from "@/src/layout/phone-frame";
import { queryClient } from "@/src/services/query-client";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function Splash() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.onBrandPrimary} />
    </View>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    if (!user) {
      if (first !== "login") router.replace("/login");
      return;
    }
    if (first === "login" || first === undefined) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  if (loading) return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="worker/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="applicants" options={{ presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": PlusJakartaSans_600SemiBold,
    "PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
    "Fredoka-SemiBold": Fredoka_600SemiBold,
    "Nunito-SemiBold": Nunito_600SemiBold,
    "Nunito-ExtraBold": Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (typeof document !== "undefined") document.title = "kerjo.id";
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <SafeAreaProvider>
              <PhoneFrame>
                <AuthProvider>
                  <ToastProvider>
                    <StatusBar style="dark" />
                    {fontsLoaded ? <RootNavigator /> : <Splash />}
                  </ToastProvider>
                </AuthProvider>
              </PhoneFrame>
            </SafeAreaProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
