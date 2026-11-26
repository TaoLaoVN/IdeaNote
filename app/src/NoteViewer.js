import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TYPES, TYPE_ICONS, TYPE_COLOR, PRIORITIES, STATUSES, fmtDateTime } from "./constants";
import ProjectBadge from "./ProjectBadge";
import Icon from "./Icon";
import { imageUri, hasImage } from "./images";

// Xem ghi chú, không sửa được. Không có onEdit thì ẩn nút Sửa (ghi chú trong thùng rác)
export default function NoteViewer({ note, look, t, onClose, onEdit }) {
  const checklist = note.checklist || [];
  const images = note.images || [];
  const info = [
    { text: TYPES[note.type], icon: <Icon name={TYPE_ICONS[note.type]} size={15} color={TYPE_COLOR[note.type]} /> },
    { text: `Ưu tiên ${PRIORITIES[note.priority]}` },
    { text: STATUSES[note.status] },
    note.project && {
      text: note.project,
      icon: look?.icon || look?.image
        ? <ProjectBadge name={note.project} look={look} size={15} />
        : <Icon name="folder" size={15} color={t.sub} />,
    },
    !!note.remind_at && { text: fmtDateTime(note.remind_at), icon: <Icon name="bell" size={15} color={t.sub} /> },
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
              <View key={x.text} style={[st.tag, { backgroundColor: t.card2 }]}>
                {x.icon}
                <Text style={{ color: t.sub, fontSize: 13 }}>{x.text}</Text>
              </View>
            ))}
          </View>
          {!!note.body && <Text selectable style={{ color: t.text, fontSize: 16, lineHeight: 24 }}>{note.body}</Text>}

          {checklist.length > 0 && (
            <View style={{ marginTop: 20 }}>
              {checklist.map((c) => (
                <View key={c.id} style={st.check}>
                  <Icon name={c.done ? "checked" : "checkbox"} size={20} color={c.done ? t.ok : t.sub} />
                  <Text style={{
                    flex: 1, color: c.done ? t.sub : t.text, fontSize: 16,
                    textDecorationLine: c.done ? "line-through" : "none",
                  }}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {images.map((id) =>
            hasImage(id) ? (
              <Image key={id} source={{ uri: imageUri(id) }} style={st.image} resizeMode="contain" />
            ) : (
              <Text key={id} style={{ color: t.sub, marginTop: 14 }}>Ảnh đang tải…</Text>
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
  tag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  image: { width: "100%", height: 320, marginTop: 14, borderRadius: 12 },
});
