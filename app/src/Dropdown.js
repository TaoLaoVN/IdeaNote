import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Pressable, Modal, ScrollView, Animated, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Hộp xổ xuống ngay dưới nút vừa bấm. side: căn theo mép trái hoặc phải; top: toạ độ mép dưới của nút.
// children là hàm nhận close(việc làm sau khi đóng)
export default function Dropdown({ side, top, t, onClose, children }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [progress]);

  const close = (after) => {
    // Bấm hai lần liền: lần trước bị ngắt (finished = false), chỉ lần sau cùng được thực hiện
    Animated.timing(progress, { toValue: 0, duration: 110, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      onClose();
      if (typeof after === "function") after();
    });
  };

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => close()}>
      <Animated.View style={[st.backdrop, { opacity: progress }]}>
        <Pressable style={{ flex: 1 }} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Đóng danh sách" />
      </Animated.View>
      <Animated.View
        style={[st.panel, side === "left" ? { left: 16 } : { right: 16 }, {
          top, width: Math.min(width - 32, 270), maxHeight: height - top - insets.bottom - 16,
          backgroundColor: t.card, borderColor: t.card2, opacity: progress, transform: [{ translateY }],
        }]}
      >
        <ScrollView contentContainerStyle={{ padding: 6 }}>{children(close)}</ScrollView>
      </Animated.View>
    </Modal>
  );
}

// onLongPress chạy ngay khi giữ đủ lâu; onHoldRelease chạy lúc nhấc tay.
// Việc nào đóng hộp phải đặt ở onHoldRelease: đóng khi ngón tay còn giữ thì lần chạm sau bị mất
export function DropdownItem({ label, count, active, badge, onPress, onLongPress, onHoldRelease, t }) {
  const held = useRef(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress && (() => { held.current = true; onLongPress(); })}
      onPressOut={() => {
        if (!held.current) return;
        held.current = false;
        if (onHoldRelease) onHoldRelease();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[st.item, active && { backgroundColor: t.primary + "33" }]}
    >
      {!!badge && <View style={st.badge}>{badge}</View>}
      <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: active ? "700" : "400" }} numberOfLines={1}>{label}</Text>
      {!!count && <Text style={{ color: t.sub, fontSize: 13, marginLeft: 8 }}>{count}</Text>}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0006" },
  panel: { position: "absolute", borderRadius: 18, borderWidth: 1, elevation: 12, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, minHeight: 46, borderRadius: 12 },
  badge: { marginRight: 10 },
});
