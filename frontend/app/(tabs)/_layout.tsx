import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { Icon } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="rectangle.stack.fill" />
          <NativeTabs.Trigger.Label>Cari</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="matches">
          <NativeTabs.Trigger.Icon sf="message.fill" />
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="post">
          <NativeTabs.Trigger.Icon sf="plus.circle.fill" />
          <NativeTabs.Trigger.Label>Pasang</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
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
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Cari", tabBarButtonTestID: "tab-cari", tabBarIcon: ({ color }) => <Icon name="cards" size={26} color={color} /> }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: "Chat", tabBarButtonTestID: "tab-chat", tabBarIcon: ({ color }) => <Icon name="chat-processing" size={26} color={color} /> }}
      />
      <Tabs.Screen
        name="post"
        options={{ title: "Pasang", tabBarButtonTestID: "tab-pasang", tabBarIcon: ({ color }) => <Icon name="plus-box" size={26} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarButtonTestID: "tab-profil", tabBarIcon: ({ color }) => <Icon name="account" size={26} color={color} /> }}
      />
    </Tabs>
  );
}
