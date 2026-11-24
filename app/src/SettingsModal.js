import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

export default function SettingsModal({ settings, notes, t, onSave, onClose, onImport }) {
  const [cfg, setCfg] = useState(settings);
  const [testMsg, setTestMsg] = useState("");
  const input = [st.input, { backgroundColor: t.card2, color: t.text }];

  const test = async () => {
    setTestMsg("Đang thử…");
    try {
      const r = await fetch(`${cfg.url.trim().replace(/\/$/, "")}/notes?since=${Date.now()}`, {
        headers: { Authorization: `Bearer ${cfg.secret.trim()}` },
      });
      setTestMsg(r.ok ? "✓ Kết nối thành công" : r.status === 401 ? "✗ Sai mã bí mật" : `✗ Lỗi ${r.status}`);
    } catch {
      setTestMsg("✗ Không kết nối được. Kiểm tra URL và mạng");
    }
  };

  const backup = async () => {
    await Clipboard.setStringAsync(JSON.stringify(notes.filter((n) => !n.deleted), null, 1));
    Alert.alert("Đã sao lưu", `${notes.filter((n) => !n.deleted).length} ghi chú đã chép vào clipboard dưới dạng JSON. Dán vào một file ghi chú để giữ.`);
  };

  const restore = async () => {
    try {
      const list = JSON.parse(await Clipboard.getStringAsync());
      if (!Array.isArray(list)) throw new Error();
      const ok = list.filter((n) => n && n.id && n.title);
      onImport(ok);
      Alert.alert("Đã nhập", `${ok.length} ghi chú từ clipboard.`);
    } catch {
      Alert.alert("Không nhập được", "Clipboard không chứa bản sao lưu JSON hợp lệ.");
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: t.sub, fontSize: 16 }}>Đóng</Text>
          </TouchableOpacity>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Cài đặt</Text>
          <TouchableOpacity onPress={() => onSave({ url: cfg.url.trim(), secret: cfg.secret.trim() })} hitSlop={12}>
            <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700" }}>Lưu</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={[st.h, { color: t.text }]}>Đồng bộ điện thoại ↔ PC</Text>
          <Text style={[st.label, { color: t.sub }]}>Địa chỉ server</Text>
          <TextInput style={input} autoCapitalize="none" autoCorrect={false} placeholder="https://ideanote-api.xxx.workers.dev"
            placeholderTextColor={t.sub} value={cfg.url} onChangeText={(url) => setCfg({ ...cfg, url })} />
          <Text style={[st.label, { color: t.sub }]}>Mã bí mật</Text>
          <TextInput style={input} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Mã bí mật"
            placeholderTextColor={t.sub} value={cfg.secret} onChangeText={(secret) => setCfg({ ...cfg, secret })} />
          <TouchableOpacity onPress={test} style={[st.btn, { backgroundColor: t.card2 }]}>
            <Text style={{ color: t.text, fontWeight: "600" }}>Thử kết nối</Text>
          </TouchableOpacity>
          {!!testMsg && <Text style={{ color: t.sub, marginTop: 8, textAlign: "center" }}>{testMsg}</Text>}
          <Text style={{ color: t.sub, marginTop: 10, lineHeight: 20 }}>
            Để trống nếu chỉ dùng trên máy này. Ghi chú luôn lưu offline và tự đồng bộ khi có mạng.
          </Text>

          <Text style={[st.h, { color: t.text, marginTop: 28 }]}>Sao lưu</Text>
          <TouchableOpacity onPress={backup} style={[st.btn, { backgroundColor: t.card2 }]}>
            <Text style={{ color: t.text, fontWeight: "600" }}>Sao lưu ra clipboard (JSON)</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={restore} style={[st.btn, { backgroundColor: t.card2, marginTop: 8 }]}>
            <Text style={{ color: t.text, fontWeight: "600" }}>Nhập từ clipboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  h: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: "600" },
  input: { borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14 },
  btn: { alignItems: "center", padding: 14, borderRadius: 12 },
});
