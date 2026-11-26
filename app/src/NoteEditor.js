import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { TYPES, TYPE_ICONS, PRIORITIES, STATUSES, PRIO_COLOR, projectColor, buildPrompt, uid, fmtDateTime } from "./constants";
import { pickImages, imageUri, hasImage } from "./images";
import { ensureReminderPermission } from "./reminders";
import { Chip, Segment } from "./components";
import ProjectBadge from "./ProjectBadge";
import Icon from "./Icon";
import { showDialog } from "./Dialog";

export default function NoteEditor({ note, projects, looks, t, onSave, onCancel, onDelete }) {
  const [n, setN] = useState(note);
  const set = (patch) => setN({ ...n, ...patch });
  const canSave = n.title.trim().length > 0;
  const isNew = !onDelete;

  const copyPrompt = async () => {
    await Clipboard.setStringAsync(buildPrompt([{ ...n, title: n.title.trim() || "(chưa có tiêu đề)" }]));
    showDialog("Đã chép", "Dán vào Claude Code để xử lý mục này.");
  };

  const checklist = n.checklist || [];
  const images = n.images || [];
  const [newItem, setNewItem] = useState("");
  const setItem = (id, patch) => set({ checklist: checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    set({ checklist: [...checklist, { id: uid(), text, done: false }] });
    setNewItem("");
  };

  const addImages = async () => {
    try {
      const ids = await pickImages();
      if (ids.length) set({ images: [...images, ...ids] });
    } catch (e) {
      showDialog("Không thêm được ảnh", String(e.message || e));
    }
  };
  const removeImage = (id) =>
    showDialog("Bỏ ảnh này khỏi ghi chú?", "", [
      { text: "Huỷ", style: "cancel" },
      { text: "Bỏ ảnh", style: "destructive", onPress: () => set({ images: images.filter((x) => x !== id) }) },
    ]);

  const setReminder = async (ms) => {
    if (ms && !(await ensureReminderPermission())) {
      showDialog("Chưa được phép gửi thông báo", "Hãy bật thông báo cho IdeaNote trong cài đặt điện thoại để nhận nhắc việc.");
    }
    set({ remind_at: ms });
  };
  const at = (days, hour) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  const reminderOptions = [
    ["1 giờ nữa", () => Date.now() + 3600000],
    ["Tối nay 20:00", () => (at(0, 20) > Date.now() ? at(0, 20) : at(1, 20))],
    ["Sáng mai 8:00", () => at(1, 8)],
    ["Tuần sau", () => at(7, 8)],
  ];

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

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Segment t={t} options={TYPES} icons={TYPE_ICONS} value={n.type} onChange={(type) => set({ type })} />

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

            <Text style={[st.label, { color: t.sub }]}>Checklist</Text>
            {checklist.map((c) => (
              <View key={c.id} style={st.row}>
                <TouchableOpacity onPress={() => setItem(c.id, { done: !c.done })} hitSlop={8}>
                  <Icon name={c.done ? "checked" : "checkbox"} size={24} color={c.done ? t.ok : t.sub} />
                </TouchableOpacity>
                <TextInput
                  style={{ flex: 1, color: c.done ? t.sub : t.text, fontSize: 16, marginHorizontal: 10, textDecorationLine: c.done ? "line-through" : "none" }}
                  value={c.text}
                  onChangeText={(text) => setItem(c.id, { text })}
                />
                <TouchableOpacity onPress={() => set({ checklist: checklist.filter((x) => x.id !== c.id) })} hitSlop={8}>
                  <Icon name="close" size={18} color={t.sub} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={st.row}>
              <TextInput
                style={[...input, { flex: 1, marginBottom: 0 }]}
                placeholder="+ Thêm việc nhỏ"
                placeholderTextColor={t.sub}
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={addItem}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={addItem} style={{ marginLeft: 10 }}>
                <Text style={{ color: t.primary, fontWeight: "700", fontSize: 16 }}>Thêm</Text>
              </TouchableOpacity>
            </View>

            <Text style={[st.label, { color: t.sub, marginTop: 16 }]}>Ảnh chụp màn hình</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {images.map((id) => (
                <TouchableOpacity key={id} onLongPress={() => removeImage(id)} style={{ marginRight: 10 }}>
                  {hasImage(id) ? (
                    <Image source={{ uri: imageUri(id) }} style={st.thumb} />
                  ) : (
                    <View style={[st.thumb, { backgroundColor: t.card2, alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ color: t.sub, fontSize: 11 }}>Đang tải…</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={addImages} style={[st.thumb, { backgroundColor: t.card2, alignItems: "center", justifyContent: "center" }]}>
                <Icon name="add" size={28} color={t.primary} />
              </TouchableOpacity>
            </ScrollView>

            <Text style={[st.label, { color: t.sub }]}>
              Nhắc việc{n.remind_at ? `: ${fmtDateTime(n.remind_at)}` : ""}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
              {reminderOptions.map(([label, fn]) => (
                <Chip key={label} t={t} label={label} onPress={() => setReminder(fn())} />
              ))}
              {!!n.remind_at && <Chip t={t} label="Tắt nhắc" color={t.danger} active onPress={() => setReminder(0)} />}
            </View>

            <Text style={[st.label, { color: t.sub }]}>Dự án</Text>
            <TextInput
              style={input}
              placeholder="Gõ tên dự án hoặc chọn bên dưới"
              placeholderTextColor={t.sub}
              value={n.project}
              onChangeText={(project) => set({ project })}
            />
            {projects.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
                {projects.map((p) => (
                  <Chip key={p} t={t} label={p} color={projectColor(p, looks[p])}
                    icon={looks[p]?.icon || looks[p]?.image
                      ? <ProjectBadge name={p} look={n.project === p ? { ...looks[p], color: "#fff" } : looks[p]} size={16} />
                      : null} active={n.project === p} onPress={() => set({ project: p })} />
                ))}
              </View>
            )}

            <Text style={[st.label, { color: t.sub }]}>Ưu tiên</Text>
            <Segment t={t} options={PRIORITIES} value={n.priority} onChange={(priority) => set({ priority })} colors={PRIO_COLOR} />

            <Text style={[st.label, { color: t.sub }]}>Trạng thái</Text>
            <Segment t={t} options={STATUSES} value={n.status} onChange={(status) => set({ status })} />

            <TouchableOpacity onPress={copyPrompt} style={[st.btn, { backgroundColor: t.card2, flexDirection: "row", justifyContent: "center", gap: 8 }]}>
              <Icon name="copy" size={20} color={t.text} />
              <Text style={{ color: t.text, fontWeight: "600" }}>Chép thành prompt cho Claude Code</Text>
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
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  thumb: { width: 96, height: 96, borderRadius: 12 },
  btn: { alignItems: "center", padding: 14, borderRadius: 12, marginTop: 6 },
});
