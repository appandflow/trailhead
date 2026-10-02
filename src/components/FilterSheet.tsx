import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, useTheme } from "@/src/theme";

const SHEET_IN = SlideInDown.duration(300).easing(Easing.out(Easing.cubic));
const SHEET_OUT = SlideOutDown.duration(220).easing(Easing.in(Easing.cubic));
const MAX_CONTROL_FONT_SCALE = 1.5;
const IS_ANDROID = Platform.OS === "android";
const SheetRoot = IS_ANDROID ? GestureHandlerRootView : View;

export function FilterSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const dragOffset = useSharedValue(IS_ANDROID ? screenHeight : 0);
  const scrollOffset = useSharedValue(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const sheetHeight = Math.min(
    600,
    screenHeight * 0.82,
    screenHeight - insets.top - spacing.md,
  );
  const handleContentScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y;
    },
  });
  const scrollFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollOffset.value, [0, 16], [0, 1], Extrapolation.CLAMP),
  }));

  const dismissSheet = () => {
    dragOffset.value = withTiming(
      screenHeight,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  };

  const dragGesture = Gesture.Pan()
    .activeOffsetY(6)
    .onUpdate((event) => {
      dragOffset.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        dragOffset.value = withTiming(
          screenHeight,
          { duration: 220, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onClose)();
          },
        );
        return;
      }

      dragOffset.value = withSpring(0, { damping: 22, stiffness: 240 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragOffset.value }],
  }));

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent={IS_ANDROID ? true : undefined}
      animationType="none"
      onShow={IS_ANDROID ? () => {
        // Wait for Android's native modal, then animate without fixing its origin.
        dragOffset.set(withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        }));
      } : undefined}
      onRequestClose={dismissSheet}
    >
      <SheetRoot style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(160)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        >
          <Pressable
            onPress={dismissSheet}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${title.toLowerCase()}`}
            style={[{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }, { backgroundColor: colors.scrim }]}
          />
        </Animated.View>
        <Animated.View
          entering={IS_ANDROID ? undefined : SHEET_IN}
          exiting={IS_ANDROID ? undefined : SHEET_OUT}
          style={[{ position: "absolute", bottom: 0, left: 0, right: 0 }, { height: sheetHeight }]}
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              {
                flex: 1,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.16,
                shadowRadius: 16,
                elevation: 16,
              },
              {
                backgroundColor: colors.surface,
              },
              dragStyle,
            ]}
          >
            <GestureDetector gesture={dragGesture}>
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`Drag to dismiss ${title.toLowerCase()}`}
                style={{ minHeight: 28, alignItems: "center", justifyContent: "center" }}
              >
                <View
                  style={[
                    { width: 40, height: 4, borderRadius: radius.pill },
                    { backgroundColor: colors.border },
                  ]}
                />
              </View>
            </GestureDetector>
            <View style={{ minHeight: 56, alignItems: "center", justifyContent: "center" }}>
              <Text
                maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                style={[{ fontSize: 20, fontWeight: "800", textAlign: "center" }, { color: colors.text }]}
              >
                {title}
              </Text>
            </View>
            <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <Animated.ScrollView
                showsVerticalScrollIndicator
                onScroll={handleContentScroll}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
                contentContainerStyle={[
                  { gap: spacing.xl, paddingBottom: spacing.sm },
                  { paddingBottom: footerHeight + spacing.lg },
                ]}
                scrollIndicatorInsets={{ bottom: footerHeight }}
              >
                {children}
              </Animated.ScrollView>
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: "absolute", top: 0, left: 0, right: 0, height: 24 },
                  scrollFadeStyle,
                ]}
              >
                <LinearGradient
                  colors={[colors.surface, `${colors.surface}00`]}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  }}
                />
              </Animated.View>
            </View>
            <View
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
                backgroundColor: colors.surface,
              }}
            >
              {footer}
            </View>
          </Animated.View>
        </Animated.View>
      </SheetRoot>
    </Modal>
  );
}

export function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
        style={[{ fontSize: 15, fontWeight: "800" }, { color: colors.text }]}
      >
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{children}</View>
    </View>
  );
}

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
        },
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.68 },
      ]}
    >
      <Text
        maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
        style={[
          { fontSize: 13, fontWeight: "600" },
          { color: selected ? colors.textInverse : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
