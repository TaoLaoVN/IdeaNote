import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ScrollView, Alert,
  StatusBar, Platform, Linking, AppState, RefreshControl, KeyboardAvoidingView, Animated, Easing,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { requestWidgetUpdate } from "react-native-android-widget";

import { QuickNoteWidget } from "./widget/QuickNote";
import { useTheme } from "./src/theme";
import {
  KEY_NOTES, KEY_SETTINGS, KEY_SYNC, KEY_WIDGET_PROJECT, TYPES, PRIO_RANK, TRASH_DAYS, uid, projectColor, buildPrompt,
} from "./src/constants";
import { rescheduleReminders } from "./src/reminders";
import { mergeNotes, syncNotes, saveSyncState } from "./src/sync";
import { Chip, NoteCard } from "./src/components";
import NoteEditor from "./src/NoteEditor";
import SettingsModal from "./src/SettingsModal";

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const NEXT = { new: "doing", doing: "done", done: "new" };

// Haptics an toàn: bỏ qua lỗi và không làm gì trên web / nền tảng không hỗ trợ
const haptic = (fn) => {
  if (Platform.OS === "web") return;
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch (e) {
    // ignore
  }
};
const hapticSelect = () => haptic(() => Haptics.selectionAsync());
const hapticMedium = () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

function Main() {
  const t = useTheme();
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState({ url: "", secret: "" });
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("open"); // open | done | all
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);
  const [quick, setQuick] = useState("");
  const [quickType, setQuickType] = useState("bug");
  const [undo, setUndo] = useState(null); // { id, title }
  const undoTimer = useRef(null);
  const [banner, setBanner] = useState(null); // { text, ok }
  const bannerTimer = useRef(null);
  const spin = useRef(new Animated.Value(0)).current;

  // Xoay biểu tượng 🔄 khi đang đồng bộ
  useEffect(() => {
    if (!syncing) {
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [syncing, spin]);

  useEffect(() => () => clearTimeout(bannerTimer.current), []);

  const showBanner = useCallback((text, ok) => {
    setBanner({ text, ok });
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 3500);
  }, []);

  const notesRef = useRef([]);
  const settingsRef = useRef(settings);
  const busy = useRef(false);
  const readyRef = useRef(false);
  settingsRef.current = settings;

  // Mọi thay đổi ghi chú đi qua đây để ref và state luôn khớp nhau
  const commit = useCallback((fn) => {
    const next = fn(notesRef.current);
    notesRef.current = next;
    setNotes(next);
    return next;
  }, []);

  // Nạp dữ liệu lúc mở app
  useEffect(() => {
    (async () => {
      const [n, s] = await Promise.all([AsyncStorage.getItem(KEY_NOTES), AsyncStorage.getItem(KEY_SETTINGS)]);
      if (n) commit((cur) => mergeNotes(JSON.parse(n), cur));
      if (s) setSettings(JSON.parse(s));
      readyRef.current = true;
      setReady(true);
    })();
  }, [commit]);

  // Tự lưu vào máy mỗi khi ghi chú đổi
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY_NOTES, JSON.stringify(notes));
  }, [notes, ready]);

  // Đặt lại lịch nhắc khi ghi chú đổi
  useEffect(() => {
    if (ready) rescheduleReminders(notes);
  }, [notes, ready]);

  const doSync = useCallback(async (cfgArg, quiet) => {
    const cfg = cfgArg || settingsRef.current;
    if (!cfg.url || !cfg.secret) {
      if (!quiet) {
        const msg = "Chưa cài đặt đồng bộ (bấm ⚙️)";
        setSyncMsg(msg);
        showBanner(msg, false);
      }
      return;
    }
    // Chưa nạp xong dữ liệu trong máy thì không đồng bộ, tránh ghi đè và dời mốc sai
    if (!readyRef.current || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const { remote, pushed, pulled, imagesFailed, state } = await syncNotes(notesRef.current, cfg);
      const merged = commit((cur) => mergeNotes(cur, remote));
      // Ghi chú phải nằm trong máy trước khi dời mốc đồng bộ
      await AsyncStorage.setItem(KEY_NOTES, JSON.stringify(merged));
      await saveSyncState(state);
      const okMsg = `✓ Đã đồng bộ (↑${pushed} ↓${pulled})` +
        (imagesFailed ? ` · ${imagesFailed} ảnh chưa xong, sẽ thử lại` : "");
      setSyncMsg(okMsg);
      showBanner(okMsg, !imagesFailed);
    } catch (e) {
      const errMsg = "Lỗi đồng bộ: " + e.message;
      setSyncMsg(errMsg);
      showBanner(errMsg, false);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [commit, showBanner]);

  // Đồng bộ khi mở app và mỗi lần quay lại app
  useEffect(() => {
    if (ready) doSync(undefined, true);
  }, [ready, doSync]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      // Đặt lại lịch nhắc: người dùng có thể vừa bật quyền thông báo trong cài đặt máy
      if (readyRef.current) rescheduleReminders(notesRef.current);
      doSync(undefined, true);
    });
    return () => sub.remove();
  }, [doSync]);

  const projects = useMemo(() => {
    const count = {};
    notes.forEach((n) => { if (!n.deleted && n.project) count[n.project] = (count[n.project] || 0) + (n.status === "done" ? 0 : 1); });
    return Object.keys(count).sort((a, b) => count[b] - count[a]).map((name) => ({ name, open: count[name] }));
  }, [notes]);
  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);

  // Làm mới widget khi danh sách app đổi
  const projectsKey = projectNames.join("|");
  useEffect(() => {
    if (!ready || Platform.OS !== "android") return;
    requestWidgetUpdate({
      widgetName: "QuickNote",
      renderWidget: async () => {
        let cur = (await AsyncStorage.getItem(KEY_WIDGET_PROJECT)) || "";
        if (cur && !projectNames.includes(cur)) cur = "";
        return <QuickNoteWidget project={cur} />;
      },
    }).catch(() => {});
  }, [projectsKey, ready]); // eslint-disable-line

  const live = useMemo(() => notes.filter((n) => !n.deleted), [notes]);

  const trashed = useMemo(
    () => notes.filter((n) => n.deleted && n.updated_at > Date.now() - TRASH_DAYS * 86400000)
      .sort((a, b) => b.updated_at - a.updated_at),
    [notes]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (status === "trash") return trashed;
    return live
      .filter((n) => !project || n.project === project)
      .filter((n) => !type || n.type === type)
      .filter((n) => (status === "all" ? true : status === "done" ? n.status === "done" : n.status !== "done"))
      .filter((n) => !q || `${n.title} ${n.body} ${n.project}`.toLowerCase().includes(q))
      .sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || b.updated_at - a.updated_at);
  }, [live, trashed, project, type, status, query]);

  const openCount = live.filter((n) => n.status !== "done").length;
  const highBugs = live.filter((n) => n.status !== "done" && n.type === "bug" && n.priority === "high").length;

  // ----- thao tác -----
  const save = (n) => {
    const next = { ...n, updated_at: Date.now() };
    const prev = notes.find((x) => x.id === n.id);
    if (prev && prev.status !== n.status) hapticSelect();
    commit((cur) => (cur.some((x) => x.id === n.id) ? cur.map((x) => (x.id === n.id ? next : x)) : [...cur, next]));
    setEditing(null);
    doSync(undefined, true);
  };

  const toggle = (n) => {
    hapticSelect();
    commit((cur) => cur.map((x) => (x.id === n.id ? { ...x, status: NEXT[x.status], updated_at: Date.now() } : x)));
    doSync(undefined, true);
  };

  const setDeleted = (id, deleted) => {
    commit((cur) => cur.map((x) => (x.id === id ? { ...x, deleted, updated_at: Date.now() } : x)));
    doSync(undefined, true);
  };

  // Xoá ngay, cho phép hoàn tác trong vài giây (và khôi phục sau từ Thùng rác)
  const remove = (n) => {
    setDeleted(n.id, true);
    setEditing(null);
    clearTimeout(undoTimer.current);
    setUndo({ id: n.id, title: n.title });
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const undoDelete = () => {
    if (undo) setDeleted(undo.id, false);
    clearTimeout(undoTimer.current);
    setUndo(null);
  };

  const newNote = useCallback((noteType = "bug", proj) => {
    setEditing({
      id: uid(), project: proj ?? project, type: TYPES[noteType] ? noteType : "bug", priority: "medium",
      status: "new", title: "", body: "", checklist: [], remind_at: 0, images: [], created_at: Date.now(), updated_at: Date.now(), deleted: false,
    });
  }, [project]);

  const quickAdd = () => {
    const title = quick.trim();
    if (!title) return;
    const now = Date.now();
    commit((cur) => [...cur, {
      id: uid(), project, type: quickType, priority: "medium", status: "new", title, body: "",
      checklist: [], remind_at: 0, images: [], created_at: now, updated_at: now, deleted: false,
    }]);
    setQuick("");
    doSync(undefined, true);
  };

  // Bấm widget màn hình chính -> ideanote://new?type=bug&project=...
  // Chỉ đăng ký một lần: getInitialURL() luôn trả về link lúc mở app, gọi lại sẽ bật lại trình soạn
  const newNoteRef = useRef(newNote);
  const editingRef = useRef(editing);
  useEffect(() => {
    newNoteRef.current = newNote;
    editingRef.current = editing;
  }, [newNote, editing]);
  useEffect(() => {
    const open = (url) => {
      if (!url || !url.startsWith("ideanote://new")) return;
      const tm = url.match(/type=(\w+)/);
      const pm = url.match(/project=([^&]*)/);
      let proj;
      try {
        proj = pm ? decodeURIComponent(pm[1]) : undefined;
      } catch {
        proj = undefined; // link hỏng thì bỏ qua tên app
      }
      const start = () => newNoteRef.current(tm ? tm[1] : "bug", proj);
      if (!editingRef.current) return start();
      Alert.alert("Đang soạn dở một ghi chú", "Tạo ghi chú mới sẽ bỏ phần chưa lưu.", [
        { text: "Soạn tiếp", style: "cancel" },
        { text: "Bỏ và tạo mới", style: "destructive", onPress: start },
      ]);
    };
    Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener("url", (e) => open(e.url));
    return () => sub.remove();
  }, []);

  // Chọn nhiều để chép prompt
  const selecting = selected.size > 0;
  const toggleSelect = (id) =>
    setSelected((s) => {
      const nx = new Set(s);
      nx.has(id) ? nx.delete(id) : nx.add(id);
      return nx;
    });

  const copyPrompt = async () => {
    const list = selecting ? visible.filter((n) => selected.has(n.id)) : visible.filter((n) => n.status !== "done");
    if (!list.length) return Alert.alert("Không có ghi chú nào để chép");
    await Clipboard.setStringAsync(buildPrompt(list));
    setSelected(new Set());
    Alert.alert("Đã chép", `${list.length} ghi chú đã vào clipboard. Dán vào Claude Code.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={t.dark ? "light-content" : "dark-content"} backgroundColor={t.bg} />

      {/* Header */}
      {selecting ? (
        <View style={st.header}>
          <TouchableOpacity onPress={() => setSelected(new Set())} hitSlop={12}>
            <Text style={{ color: t.sub, fontSize: 16 }}>✕ Bỏ chọn</Text>
          </TouchableOpacity>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{selected.size} đã chọn</Text>
          <TouchableOpacity onPress={copyPrompt} hitSlop={12}>
            <Text style={{ color: t.primary, fontWeight: "700", fontSize: 16 }}>📋 Chép</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={st.header}>
          <View>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "800" }}>IdeaNote</Text>
            <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>
              {openCount} việc đang mở{highBugs ? ` · ${highBugs} bug ưu tiên cao` : ""}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <TouchableOpacity onPress={copyPrompt} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Chép prompt các ghi chú">
              <Text style={st.icon}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => doSync()} hitSlop={8} disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={syncing ? "Đang đồng bộ dữ liệu" : "Đồng bộ dữ liệu"}>
              <Animated.Text style={[st.icon, {
                transform: [{
                  rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
                }]
              }]}>
                🔄
              </Animated.Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Cài đặt">
              <Text style={st.icon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tìm kiếm + bộ lọc */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ position: "relative", justifyContent: "center" }}>
          <TextInput
            style={[st.search, { backgroundColor: t.card, color: t.text }, query.length > 0 && { paddingRight: 40 }]}
            placeholder="🔍 Tìm ghi chú…"
            placeholderTextColor={t.sub}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Tìm ghi chú"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Xoá nội dung tìm kiếm"
              style={st.clear}
            >
              <Text style={{ color: t.sub, fontSize: 16, fontWeight: "600" }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <Chip t={t} label="Tất cả app" active={!project} onPress={() => setProject("")} />
          {projects.map((p) => (
            <Chip key={p.name} t={t} label={`${p.name}${p.open ? ` · ${p.open}` : ""}`} color={projectColor(p.name)}
              active={project === p.name} onPress={() => setProject(project === p.name ? "" : p.name)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip t={t} small label="Đang mở" active={status === "open"} onPress={() => setStatus("open")} />
          <Chip t={t} small label="Đã xong" active={status === "done"} onPress={() => setStatus("done")} />
          <Chip t={t} small label="Tất cả" active={status === "all"} onPress={() => setStatus("all")} />
          <Chip t={t} small label={`🗑 Thùng rác${trashed.length ? ` · ${trashed.length}` : ""}`} active={status === "trash"} onPress={() => setStatus("trash")} />
          <View style={{ width: 12 }} />
          <Chip t={t} small label="Mọi loại" active={!type} onPress={() => setType("")} />
          {Object.entries(TYPES).map(([k, v]) => (
            <Chip key={k} t={t} small label={v} active={type === k} onPress={() => setType(type === k ? "" : k)} />
          ))}
        </ScrollView>
      </View>
      {!!banner && (
        <View
          style={[st.banner, { backgroundColor: banner.ok ? t.ok : t.danger }]}
          accessibilityRole="alert" accessibilityLiveRegion="polite"
        >
          <Text style={st.bannerText} numberOfLines={1}>{banner.text}</Text>
        </View>
      )}
      {!!syncMsg && !banner && <Text style={{ color: t.sub, fontSize: 12, paddingHorizontal: 16, paddingBottom: 2 }}>{syncMsg}</Text>}

      {/* Danh sách */}
      <FlatList
        data={visible}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => doSync()} tintColor={t.sub} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 70 }}>
            <Text style={{ fontSize: 44 }}>{query ? "🔍" : "📝"}</Text>
            <Text style={{ color: t.sub, marginTop: 10, textAlign: "center", lineHeight: 22 }}>
              {query ? "Không tìm thấy ghi chú nào." : "Chưa có ghi chú nào.\nBấm nút bên dưới để thêm bug hoặc ý tưởng."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NoteCard
            note={item} t={t} selecting={selecting} selected={selected.has(item.id)}
            trash={status === "trash"}
            onPress={() =>
              status === "trash"
                ? Alert.alert("Khôi phục ghi chú?", item.title, [{ text: "Huỷ" }, { text: "Khôi phục", onPress: () => setDeleted(item.id, false) }])
                : selecting ? toggleSelect(item.id) : setEditing(item)
            }
            onLongPress={() => {
              if (status === "trash") return;
              if (!selecting) hapticMedium();
              toggleSelect(item.id);
            }}
            onToggle={() => toggle(item)}
          />
        )}
      />

      {!!undo && (
        <View style={[st.snack, { backgroundColor: t.card2, bottom: (!selecting && status !== "trash") ? 84 : 16 }]}>
          <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>Đã xoá “{undo.title}”</Text>
          <TouchableOpacity onPress={undoDelete} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="Hoàn tác xoá ghi chú">
            <Text style={{ color: t.primary, fontWeight: "700", marginLeft: 12 }}>HOÀN TÁC</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ghi nhanh: gõ rồi bấm gửi, chi tiết bổ sung sau */}
      {!selecting && status !== "trash" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={st.composerWrap}
          pointerEvents="box-none"
        >
          <View style={[st.composer, { backgroundColor: t.card }]}>
            <TouchableOpacity
              onPress={() => setQuickType(quickType === "bug" ? "idea" : "bug")}
              accessibilityRole="button"
              accessibilityLabel={quickType === "bug" ? "Đổi sang ý tưởng" : "Đổi sang bug"}
              style={[st.typeBtn, { backgroundColor: quickType === "bug" ? "#dc262633" : t.primary + "33" }]}
            >
              <Text style={{ fontSize: 20 }}>{quickType === "bug" ? "🐞" : "💡"}</Text>
            </TouchableOpacity>
            <TextInput
              style={{ flex: 1, color: t.text, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10 }}
              placeholder={quickType === "bug" ? "Ghi nhanh một bug…" : "Ghi nhanh một ý tưởng…"}
              placeholderTextColor={t.sub}
              value={quick}
              onChangeText={setQuick}
              onSubmitEditing={quickAdd}
              blurOnSubmit={false}
              returnKeyType="send"
              accessibilityLabel="Nội dung ghi nhanh"
            />
            {quick.trim() ? (
              <TouchableOpacity onPress={quickAdd}
                accessibilityRole="button" accessibilityLabel="Gửi ghi nhanh"
                style={[st.send, { backgroundColor: t.primary }]}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>↑</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => newNote(quickType)}
                accessibilityRole="button" accessibilityLabel="Tạo ghi chú mới"
                style={[st.send, { backgroundColor: t.card2 }]}>
                <Text style={{ color: t.text, fontSize: 20 }}>＋</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {editing && (
        <NoteEditor
          key={editing.id} note={editing} projects={projectNames} t={t}
          onSave={save} onCancel={() => setEditing(null)}
          onDelete={notes.some((x) => x.id === editing.id) ? () => remove(editing) : null}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings} notes={live} t={t}
          onClose={() => setShowSettings(false)}
          onImport={(list) => {
            commit((cur) => mergeNotes(cur, list.map((n) => ({ ...n, updated_at: Date.now() }))));
            doSync(undefined, true);
          }}
          onSave={async (cfg) => {
            setSettings(cfg);
            settingsRef.current = cfg;
            await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(cfg));
            await AsyncStorage.removeItem(KEY_SYNC); // đồng bộ lại toàn bộ với server mới
            setShowSettings(false);
            doSync(cfg);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  icon: { fontSize: 22 },
  search: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15 },
  clear: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  banner: { marginHorizontal: 16, marginTop: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  snack: { position: "absolute", left: 16, right: 16, bottom: 84, flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14 },
  composerWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  composer: { marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", padding: 6, borderRadius: 28 },
  typeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
