import { useQuery } from "@tanstack/react-query";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { Icon } from "@/src/components/ui";
import { fetchUnreadCount } from "@/src/features/matching/services/matching-service";
import { usesNativeTabs } from "@/src/utils/navigation";
import { fonts, useTheme } from "@/src/theme";
import { useAuth } from "@/src/features/auth/auth-context";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const verified = user?.verification_status === "approved";

  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 5000,
    enabled: verified,
  });
  const count = unread?.count ?? 0;

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Data Diri</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="rectangle.stack.fill" />
          <NativeTabs.Trigger.Label>Jelajah</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="matches">
          <NativeTabs.Trigger.Icon sf="message.fill" />
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
          {count > 0 ? <NativeTabs.Trigger.Badge>{String(count)}</NativeTabs.Trigger.Badge> : null}
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.brandSecondary,
          borderTopWidth: 1,
          paddingTop: 4,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center", minHeight: 48 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: colors.brandPrimary, color: colors.onBrandPrimary, fontFamily: fonts.medium, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{ title: "Data Diri", tabBarButtonTestID: "tab-profil", tabBarIcon: ({ color }) => <Icon name="account" size={26} color={String(color)} /> }}
      />
      <Tabs.Screen
        name="post"
        options={{
          href: null,
          title: "Pasang",
          tabBarButtonTestID: "tab-pasang",
          tabBarIcon: ({ color }) => <Icon name="plus-box" size={26} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: "Jelajah", tabBarButtonTestID: "tab-cari", tabBarIcon: ({ color }) => <Icon name="cards" size={26} color={String(color)} /> }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Chat",
          tabBarButtonTestID: "tab-chat",
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color }) => <Icon name="chat-processing" size={26} color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
