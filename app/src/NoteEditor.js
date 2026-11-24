import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { TYPES, PRIORITIES, STATUSES, PRIO_COLOR, projectColor, buildPrompt } from "./constants";
import { Chip, Segment } from "./components";

export default function NoteEditor({ note, projects, t, onSave, onCancel, onDelete }) {
  const [n, setN] = useState(note);
  const set = (patch) => setN({ ...n, ...patch });
  const canSave = n.title.trim().length > 0;
  const isNew = !onDelete;

  const copyPrompt = async () => {
    await Clipboard.setStringAsync(buildPrompt([{ ...n, title: n.title.trim() || "(chưa có tiêu đề)" }]));
    Alert.alert("Đã chép", "Dán vào Claude Code để xử lý mục này.");
  };

  const input = [st.input, { backgroundColor: t.card2, color: t.text }];

  return (
    <Modal animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={st.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={12}>
            <Text style={{ color: t.sub, fontSize: 16 }}>Huỷ</Text>
          </TouchableOpacity>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{isNew ? "Ghi chú mới" : "Sửa ghi chú"}</Text>
          <TouchableOpacity disabled={!canSave} onPress={() => onSave({ ...n, title: n.title.trim(), project: n.project.trim() })} hitSlop={12}>
            <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700", opacity: canSave ? 1 : 0.35 }}>Lưu</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Segment t={t} options={TYPES} value={n.type} onChange={(type) => set({ type })} />

            <TextInput
              style={[...input, { fontSize: 18, fontWeight: "600" }]}
              placeholder="Tiêu đề ngắn gọn"
              placeholderTextColor={t.sub}
              value={n.title}
              onChangeText={(title) => set({ title })}
              autoFocus={isNew}
            />
            <TextInput
              style={[...input, { height: 150, textAlignVertical: "top" }]}
              multiline
              placeholder={
                n.type === "bug"
                  ? "Bấm gì thì lỗi gì? Đáng ra phải thế nào?"
                  : "Mô tả ý tưởng, vì sao hay, làm thế nào…"
              }
              placeholderTextColor={t.sub}
              value={n.body}
              onChangeText={(body) => set({ body })}
            />

            <Text style={[st.label, { color: t.sub }]}>App / game</Text>
            <TextInput
              style={input}
              placeholder="Gõ tên app hoặc chọn bên dưới"
              placeholderTextColor={t.sub}
              value={n.project}
              onChangeText={(project) => set({ project })}
            />
            {projects.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
                {projects.map((p) => (
                  <Chip key={p} t={t} label={p} color={projectColor(p)} active={n.project === p} onPress={() => set({ project: p })} />
                ))}
              </View>
            )}

            <Text style={[st.label, { color: t.sub }]}>Ưu tiên</Text>
            <Segment t={t} options={PRIORITIES} value={n.priority} onChange={(priority) => set({ priority })} colors={PRIO_COLOR} />

            <Text style={[st.label, { color: t.sub }]}>Trạng thái</Text>
            <Segment t={t} options={STATUSES} value={n.status} onChange={(status) => set({ status })} />

            <TouchableOpacity onPress={copyPrompt} style={[st.btn, { backgroundColor: t.card2 }]}>
              <Text style={{ color: t.text, fontWeight: "600" }}>📋 Chép thành prompt cho Claude Code</Text>
            </TouchableOpacity>
            {!isNew && (
              <TouchableOpacity onPress={onDelete} style={{ marginTop: 18 }}>
                <Text style={{ color: t.danger, textAlign: "center", fontWeight: "600" }}>Xoá ghi chú</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: "600" },
  btn: { alignItems: "center", padding: 14, borderRadius: 12, marginTop: 6 },
});
