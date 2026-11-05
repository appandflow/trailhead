import type { MenuComponentProps } from "@expo/ui/community/menu";
import { BlurView } from "expo-blur";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

type Props = Pick<MenuComponentProps, "actions" | "children" | "onPressAction" | "style"> & {
  blurTarget?: RefObject<View | null>;
};

/** Android counterpart only; SearchFilterControls still uses native MenuView on iOS. */
export function AndroidSortMenu({ actions, children, onPressAction, style, blurTarget }: Props) {
  const { name, colors } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const triggerRef = useRef<View>(null);
  const openingRef = useRef(false);
  const closingRef = useRef(false);
  const mountedRef = useRef(true);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const progress = useSharedValue(0);
  const menuWidth = Math.min(250, width - insets.left - insets.right - 16);
  const rowHeight = Math.max(44, Math.ceil(22 * Math.min(fontScale, 1.5) + 16));
  const menuHeight = Math.min(actions.length * rowHeight + 14, height - insets.top - insets.bottom - 16);
  const left = Math.max(insets.left + 8, Math.min(anchor?.x ?? 0, width - insets.right - menuWidth - 8));
  const top = Math.max(insets.top + 8, Math.min(anchor?.y ?? 0, height - insets.bottom - menuHeight - 8));

  useEffect(() => {
    mountedRef.current = true;
    // A measured anchor is no longer valid after rotating/resizing the window.
    const subscription = Dimensions.addEventListener("change", () => {
      cancelAnimation(progress);
      setAnchor(null);
      openingRef.current = false;
      closingRef.current = false;
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
      cancelAnimation(progress);
    };
  }, [progress]);

  const finishClose = () => {
    if (mountedRef.current) setAnchor(null);
    openingRef.current = false;
    closingRef.current = false;
  };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.set(withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finishClose)();
    }));
  };

  const open = () => {
    if (openingRef.current || anchor) return;
    openingRef.current = true;
    triggerRef.current?.measureInWindow((x, y, triggerWidth, triggerHeight) => {
      openingRef.current = false;
      if (!mountedRef.current || triggerWidth <= 0 || triggerHeight <= 0) return;
      closingRef.current = false;
      progress.set(0);
      setAnchor({ x, y });
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.92, 1]) }],
  }));

  return (
    <>
      <View ref={triggerRef} collapsable={false} style={style}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${actions.find((action) => action.state === "on")?.title ?? "Name"}`}
          accessibilityHint="Shows sorting options"
          accessibilityState={{ expanded: anchor !== null }}
          android_disableSound
        >
          <View importantForAccessibility="no-hide-descendants" pointerEvents="none">
            {children}
          </View>
        </Pressable>
      </View>
      {anchor ? (
        <Modal
          visible
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          onRequestClose={close}
          onShow={() => {
            if (!closingRef.current) {
              progress.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
            }
          }}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss sorting options"
              onPress={close}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
            <Animated.View
              accessibilityViewIsModal
              style={[
                {
                  position: "absolute",
                  top,
                  left,
                  width: menuWidth,
                  height: menuHeight,
                  borderRadius: 28,
                  transformOrigin: "top left",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                },
                animatedStyle,
              ]}
            >
              <BlurView
                blurTarget={blurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                tint={name === "dark" ? "systemThinMaterialDark" : "light"}
                intensity={80}
                style={{ flex: 1, borderRadius: 28, overflow: "hidden" }}
              >
                <ScrollView
                  style={{ backgroundColor: `${colors.surface}99` }}
                  bounces={false}
                  showsVerticalScrollIndicator={menuHeight < actions.length * rowHeight + 14}
                  contentContainerStyle={{ paddingVertical: 7 }}
                >
                  {actions.map((action) => (
                    <Pressable
                      key={action.id ?? action.title}
                      accessibilityRole="radio"
                      accessibilityLabel={action.title}
                      accessibilityState={{ checked: action.state === "on" }}
                      onPress={() => {
                        if (closingRef.current) return;
                        // Update the trigger immediately; every dismissal takes the same path.
                        onPressAction?.({ nativeEvent: { event: action.id ?? action.title } });
                        close();
                      }}
                      style={({ pressed }) => ({
                        minHeight: rowHeight,
                        paddingHorizontal: 18,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: pressed ? `${colors.primaryMuted}88` : "transparent",
                      })}
                    >
                      <Text
                        importantForAccessibility="no"
                        style={{ width: 18, fontSize: 18, color: colors.text }}
                      >
                        {action.state === "on" ? "✓" : ""}
                      </Text>
                      <Text
                        maxFontSizeMultiplier={1.5}
                        style={{ flex: 1, fontSize: 17, color: colors.text }}
                      >
                        {action.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </BlurView>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
