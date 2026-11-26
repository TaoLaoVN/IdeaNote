import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TYPES, PRIORITIES, STATUSES, fmtDateTime } from "./constants";
import { imageUri, hasImage } from "./images";

// Xem ghi chú, không sửa được. Không có onEdit thì ẩn nút Sửa (ghi chú trong thùng rác)
export default function NoteViewer({ note, look, t, onClose, onEdit }) {
  const checklist = note.checklist || [];
  const images = note.images || [];
  const info = [
    TYPES[note.type],
    `Ưu tiên ${PRIORITIES[note.priority]}`,
    STATUSES[note.status],
    note.project ? `${look?.icon || "📁"} ${note.project}` : "",
    note.remind_at ? `⏰ ${fmtDateTime(note.remind_at)}` : "",
  ].filter(Boolean);

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={{ color: t.sub, fontSize: 16 }}>Đóng</Text>
          </TouchableOpacity>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Xem ghi chú</Text>
          {onEdit ? (
            <TouchableOpacity onPress={onEdit} hitSlop={12} accessibilityRole="button">
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700" }}>Sửa</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text selectable style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>{note.title}</Text>
          <View style={st.info}>
            {info.map((x) => (
              <Text key={x} style={[st.tag, { color: t.sub, backgroundColor: t.card2 }]}>{x}</Text>
            ))}
          </View>
          {!!note.body && <Text selectable style={{ color: t.text, fontSize: 16, lineHeight: 24 }}>{note.body}</Text>}

          {checklist.length > 0 && (
            <View style={{ marginTop: 20 }}>
              {checklist.map((c) => (
                <Text key={c.id} style={{
                  color: c.done ? t.sub : t.text, fontSize: 16, marginBottom: 8,
                  textDecorationLine: c.done ? "line-through" : "none",
                }}>
                  {c.done ? "☑" : "☐"}  {c.text}
                </Text>
              ))}
            </View>
          )}

          {images.map((id) =>
            hasImage(id) ? (
              <Image key={id} source={{ uri: imageUri(id) }} style={st.image} resizeMode="contain" />
            ) : (
              <Text key={id} style={{ color: t.sub, marginTop: 14 }}>🖼 Ảnh đang tải…</Text>
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  info: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 18 },
  tag: { fontSize: 13, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, overflow: "hidden" },
  image: { width: "100%", height: 320, marginTop: 14, borderRadius: 12 },
});
