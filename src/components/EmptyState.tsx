import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing, useTheme } from "@/src/theme";

interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  action?: {
    label: string;
    accessibilityLabel?: string;
    onPress: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        paddingTop: spacing.xxl,
        gap: spacing.sm,
      }}
    >
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          textAlign: "center",
          paddingHorizontal: spacing.xl,
          color: colors.textMuted,
        }}
      >
        {description}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          style={{
            minHeight: 44,
            marginTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
