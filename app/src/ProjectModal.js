import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, StyleSheet } from "react-native";
import { PROJECT_COLORS, PROJECT_ICONS, projectColor } from "./constants";
import { pickIcon } from "./images";
import { showDialog } from "./Dialog";
import ProjectBadge from "./ProjectBadge";

// Tạo dự án mới, hoặc sửa màu / icon của dự án đã có (editName).
// onDelete chỉ được truyền khi dự án chưa có ghi chú nào
export default function ProjectModal({ editName, initialLook, t, onSave, onClose, onDelete }) {
  const editing = !!editName;
  const [name, setName] = useState(editName || "");
  const [look, setLook] = useState(initialLook || {}); // { color, icon, image }
  const value = name.trim();
  const color = projectColor(value, look);
  const submit = () => {
    if (value) onSave(value, look);
  };

  const chooseImage = async () => {
    try {
      const image = await pickIcon();
      if (image) setLook((cur) => ({ ...cur, image, icon: "" }));
    } catch (e) {
      showDialog("Không chọn được ảnh", String(e.message || e));
    }
  };

  const option = (active) => [st.icon, { backgroundColor: t.card2, borderColor: active ? color : "transparent" }];

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={st.backdrop}>
        <View style={[st.box, { backgroundColor: t.card }]}>
          <Text style={[st.title, { color: t.text }]}>{editing ? "Sửa dự án" : "Thêm dự án"}</Text>

          <ScrollView style={st.scroll} keyboardShouldPersistTaps="handled">
            <View style={[st.preview, { backgroundColor: color + "33" }]}>
              <ProjectBadge name={value} look={look} size={30} />
              <Text style={{ color, fontSize: 16, fontWeight: "700", marginLeft: 8, flexShrink: 1 }} numberOfLines={1}>
                {value || "Tên dự án"}
              </Text>
            </View>

            {!editing && (
              <TextInput
                style={[st.input, { backgroundColor: t.card2, color: t.text }]}
                placeholder="Tên dự án"
                placeholderTextColor={t.sub}
                value={name}
                onChangeText={setName}
                onSubmitEditing={submit}
                returnKeyType="done"
                autoFocus
                accessibilityLabel="Tên dự án mới"
              />
            )}

            <Text style={[st.label, { color: t.sub }]}>Màu</Text>
            <View style={st.grid}>
              {PROJECT_COLORS.map((c, i) => (
                <TouchableOpacity key={c} onPress={() => setLook({ ...look, color: c })}
                  accessibilityRole="button" accessibilityLabel={`Màu số ${i + 1}`} accessibilityState={{ selected: color === c }}
                  style={[st.swatch, { borderColor: color === c ? t.text : "transparent" }]}>
                  <View style={[st.swatchFill, { backgroundColor: c }]} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[st.label, { color: t.sub }]}>Icon hoặc hình</Text>
            <View style={st.grid}>
              <TouchableOpacity onPress={() => setLook({ ...look, icon: "", image: "" })} style={option(!look.icon && !look.image)}
                accessibilityRole="button" accessibilityLabel="Không dùng icon, chỉ chấm màu">
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={chooseImage} style={option(!!look.image)}
                accessibilityRole="button" accessibilityLabel="Chọn ảnh từ thư viện">
                {look.image ? <ProjectBadge look={look} size={34} /> : <Text style={{ fontSize: 20 }}>🖼️</Text>}
              </TouchableOpacity>
              {PROJECT_ICONS.map((icon) => (
                <TouchableOpacity key={icon} onPress={() => setLook({ ...look, icon, image: "" })} style={option(look.icon === icon)}
                  accessibilityRole="button" accessibilityLabel={`Icon ${icon}`}>
                  <Text style={{ fontSize: 20 }}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={st.actions}>
            {!!onDelete && (
              <TouchableOpacity onPress={onDelete} hitSlop={12} accessibilityRole="button" style={{ marginRight: "auto" }}>
                <Text style={{ color: t.danger, fontSize: 16, fontWeight: "600" }}>Xoá dự án</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={{ color: t.sub, fontSize: 16 }}>Huỷ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={!value} hitSlop={12} accessibilityRole="button">
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700", opacity: value ? 1 : 0.35 }}>
                {editing ? "Lưu" : "Thêm"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#0009", justifyContent: "center", paddingHorizontal: 20, paddingTop: 48 },
  box: { borderRadius: 22, padding: 18, maxHeight: "94%" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 14 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  preview: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginBottom: 14, maxWidth: "100%" },
  input: { borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  swatchFill: { width: 30, height: 30, borderRadius: 15 },
  icon: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 28, paddingTop: 14 },
});
