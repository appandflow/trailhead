import { useState } from "react";
import {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SCROLL_DIRECTION_THRESHOLD = 4;
const SHOW_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.65,
};
const HIDE_SPRING = {
  damping: 22,
  stiffness: 260,
  mass: 0.65,
  overshootClamping: true,
};

interface ScrollVisibilityOptions {
  hiddenTranslateY: number;
}

/** Attach onScroll to an animated list; apply translateY to its floating toolbar. */
export function useScrollVisibility({
  hiddenTranslateY,
}: ScrollVisibilityOptions) {
  const [interactive, setInteractive] = useState(true);
  const translateY = useSharedValue(0);
  const visible = useSharedValue(true);
  const previousScrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const scrollY = Math.max(0, event.contentOffset.y);
      const delta = scrollY - previousScrollY.value;

      if (scrollY <= SCROLL_DIRECTION_THRESHOLD) {
        if (!visible.value) {
          visible.value = true;
          runOnJS(setInteractive)(true);
          translateY.value = withSpring(0, SHOW_SPRING);
        }
      } else if (delta > SCROLL_DIRECTION_THRESHOLD && visible.value) {
        visible.value = false;
        runOnJS(setInteractive)(false);
        translateY.value = withSpring(hiddenTranslateY, HIDE_SPRING);
      } else if (delta < -SCROLL_DIRECTION_THRESHOLD && !visible.value) {
        visible.value = true;
        runOnJS(setInteractive)(true);
        translateY.value = withSpring(0, SHOW_SPRING);
      }

      previousScrollY.value = scrollY;
    },
  });

  return { onScroll, translateY, interactive };
}
