import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Modal, StyleSheet,
  ScrollView, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { requestWidgetUpdate } from "react-native-android-widget";
import { QuickNoteWidget } from "./widget/QuickNote";

const KEY_NOTES = "ideanote:notes";
const KEY_SETTINGS = "ideanote:settings";
const KEY_SYNC = "ideanote:lastSync";

const TYPES = { bug: "🐞 Bug", idea: "💡 Ý tưởng", improvement: "✨ Cải tiến" };
const PRIORITIES = { high: "Cao", medium: "Vừa", low: "Thấp" };
const STATUSES = { new: "Mới", doing: "Đang làm", done: "Xong" };
const PRIO_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function App() {
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState({ url: "", secret: "" });
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("open"); // open | all | done
  const [editing, setEditing] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [ready, setReady] = useState(false);

  // Nạp dữ liệu lúc mở app
  useEffect(() => {
    (async () => {
      const n = await AsyncStorage.getItem(KEY_NOTES);
      const s = await AsyncStorage.getItem(KEY_SETTINGS);
      if (n) setNotes(JSON.parse(n));
      if (s) setSettings(JSON.parse(s));
      setReady(true);
    })();
  }, []);

  // Tự lưu máy mỗi khi notes đổi, rồi làm mới widget để danh sách app luôn mới
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY_NOTES, JSON.stringify(notes)).then(() => {
      if (Platform.OS === "android") {
        requestWidgetUpdate({
          widgetName: "QuickNote",
          renderWidget: async () => {
            const cur = (await AsyncStorage.getItem("ideanote:widgetProject")) || "";
            return <QuickNoteWidget project={cur} />;
          },
        }).catch(() => {});
      }
    });
  }, [notes, ready]);

  const sync = useCallback(async (current = notes, cfg = settings) => {
    if (!cfg.url || !cfg.secret) { setSyncMsg("Chưa cài đặt server"); return; }
    try {
      setSyncMsg("Đang đồng bộ…");
      const headers = { Authorization: `Bearer ${cfg.secret}`, "content-type": "application/json" };
      const base = cfg.url.replace(/\/$/, "");
      const last = Number((await AsyncStorage.getItem(KEY_SYNC)) || 0);

      // 1) đẩy lên các ghi chú đã đổi từ lần sync trước
      const dirty = current.filter((n) => n.updated_at > last);
      if (dirty.length) {
        const r = await fetch(`${base}/notes`, { method: "POST", headers, body: JSON.stringify({ notes: dirty }) });
        if (!r.ok) throw new Error(`Đẩy lên lỗi ${r.status}`);
      }
      // 2) kéo về các thay đổi mới
      const r2 = await fetch(`${base}/notes?since=${last}`, { headers });
      if (!r2.ok) throw new Error(`Kéo về lỗi ${r2.status}`);
      const { notes: remote, now } = await r2.json();

      const map = new Map(current.map((n) => [n.id, n]));
      for (const rn of remote) {
        const local = map.get(rn.id);
        if (!local || rn.updated_at > local.updated_at) {
          map.set(rn.id, { ...rn, deleted: !!rn.deleted });
        }
      }
      const merged = [...map.values()];
      setNotes(merged);
      await AsyncStorage.setItem(KEY_SYNC, String(now));
      setSyncMsg("Đã đồng bộ ✓");
    } catch (e) {
      setSyncMsg("Lỗi: " + e.message);
    }
  }, [notes, settings]);

  // Đồng bộ khi vừa nạp xong
  useEffect(() => { if (ready) sync(); }, [ready]); // eslint-disable-line

  const projects = useMemo(
    () => [...new Set(notes.filter((n) => !n.deleted && n.project).map((n) => n.project))],
    [notes]
  );

  const visible = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 };
    return notes
      .filter((n) => !n.deleted)
      .filter((n) => !filterProject || n.project === filterProject)
      .filter((n) => filterStatus === "all" ? true : filterStatus === "done" ? n.status === "done" : n.status !== "done")
      .sort((a, b) => rank[a.priority] - rank[b.priority] || b.updated_at - a.updated_at);
  }, [notes, filterProject, filterStatus]);

  const saveNote = (n) => {
    const now = Date.now();
    const next = { ...n, updated_at: now };
    const updated = notes.some((x) => x.id === n.id)
      ? notes.map((x) => (x.id === n.id ? next : x))
      : [...notes, next];
    setNotes(updated);
    setEditing(null);
    sync(updated);
  };

  const deleteNote = (n) => {
    Alert.alert("Xoá ghi chú?", n.title, [
      { text: "Huỷ" },
      { text: "Xoá", style: "destructive", onPress: () => {
        const updated = notes.map((x) => x.id === n.id ? { ...x, deleted: true, updated_at: Date.now() } : x);
        setNotes(updated); setEditing(null); sync(updated);
      } },
    ]);
  };

  // Xuất prompt để dán vào Claude Code khi ngồi PC
  const exportPrompt = async () => {
    const list = visible.filter((n) => n.status !== "done");
    if (!list.length) { Alert.alert("Không có ghi chú nào để xuất"); return; }
    const lines = list.map((n, i) =>
      `${i + 1}. [${TYPES[n.type]}] [${PRIORITIES[n.priority]}]${n.project ? ` (${n.project})` : ""} ${n.title}` +
      (n.body ? `\n   ${n.body.replace(/\n/g, "\n   ")}` : "")
    );
    const text = `Dưới đây là danh sách bug và ý tưởng tôi ghi lại. Hãy xem code, đánh giá và xử lý lần lượt từ mục ưu tiên cao nhất. Với mỗi mục, nói rõ bạn định làm gì trước khi sửa.\n\n${lines.join("\n\n")}`;
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã sao chép", `${list.length} ghi chú đã được chép vào clipboard. Dán vào Claude Code.`);
  };

  const newNote = useCallback((type = "bug", project) =>
    setEditing({
      id: uid(), project: project ?? filterProject, type: TYPES[type] ? type : "bug", priority: "medium", status: "new",
      title: "", body: "", created_at: Date.now(), updated_at: Date.now(), deleted: false,
    }), [filterProject]);

  // Bấm widget màn hình chính -> deep link ideanote://new?type=bug -> mở thẳng màn hình ghi note
  useEffect(() => {
    const open = (url) => {
      if (url && url.startsWith("ideanote://new")) {
        const t = url.match(/type=(\w+)/);
        const p = url.match(/project=([^&]*)/);
        newNote(t ? t[1] : "bug", p ? decodeURIComponent(p[1]) : undefined);
      }
    };
    Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener("url", (e) => open(e.url));
    return () => sub.remove();
  }, [newNote]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.h1}>IdeaNote</Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <TouchableOpacity onPress={exportPrompt}><Text style={s.hIcon}>📋</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => sync()}><Text style={s.hIcon}>🔄</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)}><Text style={s.hIcon}>⚙️</Text></TouchableOpacity>
        </View>
      </View>
      {!!syncMsg && <Text style={s.sync}>{syncMsg}</Text>}

      <View style={s.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label="Tất cả dự án" active={!filterProject} onPress={() => setFilterProject("")} />
          {projects.map((p) => (
            <Chip key={p} label={p} active={filterProject === p} onPress={() => setFilterProject(p)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <Chip label="Đang mở" active={filterStatus === "open"} onPress={() => setFilterStatus("open")} />
          <Chip label="Đã xong" active={filterStatus === "done"} onPress={() => setFilterStatus("done")} />
          <Chip label="Tất cả" active={filterStatus === "all"} onPress={() => setFilterStatus("all")} />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListEmptyComponent={<Text style={s.empty}>Chưa có ghi chú. Bấm dấu + để thêm.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => setEditing(item)}>
            <View style={[s.bar, { backgroundColor: PRIO_COLOR[item.priority] }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.meta}>
                {TYPES[item.type]}{item.project ? `  ·  ${item.project}` : ""}  ·  {STATUSES[item.status]}
              </Text>
              <Text style={[s.title, item.status === "done" && s.done]}>{item.title}</Text>
              {!!item.body && <Text style={s.body} numberOfLines={2}>{item.body}</Text>}
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={s.fab} onPress={() => newNote("bug")}><Text style={s.fabText}>＋</Text></TouchableOpacity>

      {editing && (
        <NoteEditor
          note={editing} projects={projects}
          onSave={saveNote} onCancel={() => setEditing(null)}
          onDelete={notes.some((x) => x.id === editing.id) ? () => deleteNote(editing) : null}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={async (cfg) => {
            setSettings(cfg);
            await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(cfg));
            await AsyncStorage.removeItem(KEY_SYNC); // sync lại toàn bộ
            setShowSettings(false);
            sync(notes, cfg);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 12 }}>
      {Object.entries(options).map(([k, v]) => (
        <Chip key={k} label={v} active={value === k} onPress={() => onChange(k)} />
      ))}
    </View>
  );
}

function NoteEditor({ note, projects, onSave, onCancel, onDelete }) {
  const [n, setN] = useState(note);
  const set = (patch) => setN({ ...n, ...patch });
  return (
    <Modal animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.header}>
            <TouchableOpacity onPress={onCancel}><Text style={s.hIcon}>✕</Text></TouchableOpacity>
            <Text style={s.h1}>Ghi chú</Text>
            <TouchableOpacity disabled={!n.title.trim()} onPress={() => onSave({ ...n, title: n.title.trim() })}>
              <Text style={[s.save, !n.title.trim() && { opacity: 0.3 }]}>Lưu</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Segment options={TYPES} value={n.type} onChange={(type) => set({ type })} />
            <TextInput style={s.input} placeholder="Tiêu đề ngắn gọn" placeholderTextColor="#777"
              value={n.title} onChangeText={(title) => set({ title })} autoFocus />
            <TextInput style={[s.input, { height: 140, textAlignVertical: "top" }]} multiline
              placeholder="Chi tiết: bấm gì thì lỗi gì, mong muốn ra sao…" placeholderTextColor="#777"
              value={n.body} onChangeText={(body) => set({ body })} />
            <Text style={s.label}>Dự án (app / game)</Text>
            <TextInput style={s.input} placeholder="Ví dụ: MaTools" placeholderTextColor="#777"
              value={n.project} onChangeText={(project) => set({ project })} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
              {projects.map((p) => <Chip key={p} label={p} active={n.project === p} onPress={() => set({ project: p })} />)}
            </View>
            <Text style={s.label}>Ưu tiên</Text>
            <Segment options={PRIORITIES} value={n.priority} onChange={(priority) => set({ priority })} />
            <Text style={s.label}>Trạng thái</Text>
            <Segment options={STATUSES} value={n.status} onChange={(status) => set({ status })} />
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={{ marginTop: 20 }}>
                <Text style={{ color: "#ef4444", textAlign: "center" }}>Xoá ghi chú</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function SettingsModal({ settings, onSave, onClose }) {
  const [cfg, setCfg] = useState(settings);
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Text style={s.hIcon}>✕</Text></TouchableOpacity>
          <Text style={s.h1}>Cài đặt đồng bộ</Text>
          <TouchableOpacity onPress={() => onSave(cfg)}><Text style={s.save}>Lưu</Text></TouchableOpacity>
        </View>
        <View style={{ padding: 16 }}>
          <Text style={s.label}>Địa chỉ server (Worker URL)</Text>
          <TextInput style={s.input} autoCapitalize="none" placeholder="https://ideanote-api.xxx.workers.dev"
            placeholderTextColor="#777" value={cfg.url} onChangeText={(url) => setCfg({ ...cfg, url })} />
          <Text style={s.label}>Mã bí mật</Text>
          <TextInput style={s.input} autoCapitalize="none" secureTextEntry placeholder="API secret"
            placeholderTextColor="#777" value={cfg.secret} onChangeText={(secret) => setCfg({ ...cfg, secret })} />
          <Text style={{ color: "#888", marginTop: 8 }}>
            Để trống nếu chỉ muốn dùng trên máy này. Ghi chú vẫn lưu offline và tự đồng bộ khi có cài đặt.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f1115" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 20 },
  h1: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hIcon: { color: "#fff", fontSize: 20 },
  save: { color: "#60a5fa", fontSize: 17, fontWeight: "600" },
  sync: { color: "#888", fontSize: 12, paddingHorizontal: 16 },
  filters: { paddingHorizontal: 12, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#1c1f26", marginRight: 8, marginBottom: 6 },
  chipOn: { backgroundColor: "#2563eb" },
  chipText: { color: "#bbb", fontSize: 13 },
  card: { flexDirection: "row", backgroundColor: "#1a1d24", borderRadius: 10, marginBottom: 10, overflow: "hidden" },
  bar: { width: 5 },
  meta: { color: "#888", fontSize: 12, paddingTop: 10, paddingHorizontal: 12 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", paddingHorizontal: 12, paddingTop: 2, paddingBottom: 4 },
  done: { textDecorationLine: "line-through", color: "#777" },
  body: { color: "#aaa", paddingHorizontal: 12, paddingBottom: 10 },
  empty: { color: "#666", textAlign: "center", marginTop: 60 },
  fab: { position: "absolute", right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", elevation: 6 },
  fabText: { color: "#fff", fontSize: 30, marginTop: -2 },
  input: { backgroundColor: "#1c1f26", color: "#fff", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  label: { color: "#999", marginBottom: 6, fontSize: 13 },
});
