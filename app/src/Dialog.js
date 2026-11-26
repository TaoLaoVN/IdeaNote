import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, Platform, StyleSheet } from "react-native";

// Có thể có hai DialogHost cùng lúc khi Android dựng lại màn hình: bản mới gắn trước, bản cũ gỡ sau.
// Vì vậy mỗi bản chỉ gỡ đăng ký của chính nó
const hosts = [];

// Cùng cách gọi với Alert.alert. Android: hộp thoại theo giao diện app (hộp mặc định lấy theme native, lệch với app).
// iOS: giữ hộp thoại hệ thống, vì không chồng thêm Modal lên màn hình Modal đang mở được.
export function showDialog(title, message, buttons) {
  const present = hosts[hosts.length - 1];
  if (Platform.OS !== "android" || !present) return Alert.alert(title, message, buttons);
  present({ title, message, buttons: buttons && buttons.length ? buttons : [{ text: "OK" }] });
}

export function DialogHost({ t }) {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const present = (d) => setQueue((q) => [...q, d]);
    hosts.push(present);
    return () => { hosts.splice(hosts.indexOf(present), 1); };
  }, []);

  const dialog = queue[0];
  // Chỉ gắn Modal khi có hộp thoại, để nó mở sau và nằm trên các Modal khác
  if (!dialog) return null;

  const dismiss = () => setQueue((q) => q.slice(1));
  const press = (b) => {
    dismiss();
    if (b.onPress) b.onPress();
  };

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={dismiss}>
      <View style={st.backdrop}>
        <View style={[st.box, { backgroundColor: t.card }]} accessibilityRole="alert">
          <Text style={[st.title, { color: t.text }]}>{dialog.title}</Text>
          {!!dialog.message && (
            <ScrollView style={st.scroll}>
              <Text style={{ color: t.sub, fontSize: 15, lineHeight: 22 }}>{dialog.message}</Text>
            </ScrollView>
          )}
          <View style={st.actions}>
            {dialog.buttons.map((b) => {
              const cancel = b.style === "cancel";
              const bg = cancel ? t.card2 : b.style === "destructive" ? t.danger : t.primary;
              return (
                <TouchableOpacity key={b.text} onPress={() => press(b)} accessibilityRole="button"
                  style={[st.btn, { backgroundColor: bg }]}>
                  <Text style={{ color: cancel ? t.text : "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" }}>
                    {b.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#0009", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  box: { width: "100%", maxWidth: 360, borderRadius: 22, padding: 20 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  scroll: { maxHeight: 240, flexGrow: 0 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  btn: { flexGrow: 1, minHeight: 46, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
