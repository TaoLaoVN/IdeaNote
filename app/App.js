import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Linking, AppState, RefreshControl, KeyboardAvoidingView, Animated, Easing,
  BackHandler, LayoutAnimation, useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { requestWidgetUpdate } from "react-native-android-widget";

import { QuickNoteWidget } from "./widget/QuickNote";
import { useTheme } from "./src/theme";
import {
  KEY_NOTES, KEY_SETTINGS, KEY_SYNC, KEY_WIDGET_PROJECT, KEY_PROJECTS, KEY_PROJECT_LOOKS, TYPES, TYPE_ICONS, TYPE_COLOR, PRIO_RANK, TRASH_DAYS, uid, projectColor, buildPrompt,
} from "./src/constants";
import { rescheduleReminders } from "./src/reminders";
import { mergeNotes, syncNotes, saveSyncState } from "./src/sync";
import { NoteCard } from "./src/components";
import NoteEditor from "./src/NoteEditor";
import SettingsModal from "./src/SettingsModal";
import { showDialog, DialogHost } from "./src/Dialog";
import NoteViewer from "./src/NoteViewer";
import ProjectModal from "./src/ProjectModal";
import ProjectBadge from "./src/ProjectBadge";
import Icon from "./src/Icon";
import Dropdown, { DropdownItem } from "./src/Dropdown";

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const NEXT = { new: "doing", doing: "done", done: "new" };
const STATUS_FILTERS = { open: "Đang mở", done: "Đã xong", all: "Tất cả", trash: "Thùng rác" };
const STATUS_ICONS = { open: "open", done: "done", all: "all", trash: "trash" };

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
const hapticLight = () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

function Main() {
  const t = useTheme();
  const [notes, setNotes] = useState([]);
  const [settings, setSettings] = useState({ url: "", secret: "" });
  const [project, setProject] = useState("");
  const [added, setAdded] = useState([]); // dự án tự thêm
  const [looks, setLooks] = useState({}); // màu, icon của từng dự án
  const [projectForm, setProjectForm] = useState(null); // null = đóng, "" = thêm mới, tên = sửa
  const [dropdown, setDropdown] = useState(null); // null | { side: "left" | "right", top }
  const leftBtn = useRef(null);
  const rightBtn = useRef(null);
  const [menuId, setMenuId] = useState(""); // ghi chú đang mở hàng nút (nhấn giữ)
  const touch = useRef({ x: 0, y: 0, inside: false });
  const listRef = useRef(null);
  const scrollY = useRef(0);
  const { height: screenHeight } = useWindowDimensions();
  const [viewingId, setViewingId] = useState("");
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
      const [n, s, a, l] = await Promise.all([
        AsyncStorage.getItem(KEY_NOTES), AsyncStorage.getItem(KEY_SETTINGS), AsyncStorage.getItem(KEY_PROJECTS),
        AsyncStorage.getItem(KEY_PROJECT_LOOKS),
      ]);
      if (l) setLooks(JSON.parse(l));
      if (a) setAdded(JSON.parse(a));
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

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY_PROJECTS, JSON.stringify(added));
  }, [added, ready]);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY_PROJECT_LOOKS, JSON.stringify(looks));
  }, [looks, ready]);

  // Đặt lại lịch nhắc khi ghi chú đổi
  useEffect(() => {
    if (ready) rescheduleReminders(notes);
  }, [notes, ready]);

  const doSync = useCallback(async (cfgArg, quiet) => {
    const cfg = cfgArg || settingsRef.current;
    if (!cfg.url || !cfg.secret) {
      if (!quiet) {
        const msg = "Chưa cài đặt đồng bộ (bấm nút Cài đặt)";
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
    const info = new Map();
    notes.forEach((n) => {
      if (n.deleted || !n.project) return;
      const cur = info.get(n.project) || { open: 0, total: 0 };
      info.set(n.project, { open: cur.open + (n.status === "done" ? 0 : 1), total: cur.total + 1 });
    });
    added.forEach((name) => { if (!info.has(name)) info.set(name, { open: 0, total: 0 }); });
    return [...info].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.open - a.open);
  }, [notes, added]);
  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);

  // Làm mới widget khi danh sách dự án đổi
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

  const viewingNote = notes.find((x) => x.id === viewingId);

  // ----- thao tác -----
  // Đo vị trí nút để hộp xổ ra ngay bên dưới
  const openDropdown = (side, ref) => {
    ref.current?.measureInWindow((x, y, w, h) => setDropdown({ side, top: y + h + 6 }));
  };

  const showActions = useCallback((id) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(160, "easeInEaseOut", "opacity"));
    setMenuId(id);
  }, []);

  // Chạm ra ngoài card đang mở thì ẩn hàng nút. Sự kiện chạm đi từ card lên khung gốc,
  // nên card đang mở đánh dấu "bên trong" trước. Ngón tay di chuyển là đang cuộn, không tính
  const onRootTouchStart = (e) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, inside: false };
  };
  const onRootTouchEnd = (e) => {
    const { x, y, inside } = touch.current;
    const moved = Math.abs(e.nativeEvent.pageX - x) > 10 || Math.abs(e.nativeEvent.pageY - y) > 10;
    if (menuId && !inside && !moved) showActions("");
  };

  // Nút Back đóng hàng nút trước khi thoát app
  useEffect(() => {
    if (!menuId) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      showActions("");
      return true;
    });
    return () => sub.remove();
  }, [menuId, showActions]);

  // Card ở cuối màn hình: cuộn thêm để hàng nút không nằm sau thanh ghi nhanh
  const revealActions = (view) => {
    if (!view) return;
    view.measureInWindow((x, y, w, h) => {
      const over = y + h - (screenHeight - 140);
      if (over > 0) listRef.current?.scrollToOffset({ offset: scrollY.current + over, animated: true });
    });
  };

  const saveProject = (name, look) => {
    if (projectForm) {
      setLooks((cur) => ({ ...cur, [projectForm]: look }));
    } else {
      // Trùng tên (không phân biệt hoa thường) thì chọn dự án đã có, giữ nguyên kiểu cũ
      const found = projectNames.find((x) => x.toLowerCase() === name.toLowerCase());
      if (!found) {
        setAdded((cur) => [...cur, name]);
        setLooks((cur) => ({ ...cur, [name]: look }));
      }
      setProject(found || name);
    }
    setProjectForm(null);
  };

  // Chỉ xoá được dự án chưa có ghi chú nào (ví dụ gõ nhầm tên)
  const removeProject = (p) => {
    if (p.total) return;
    showDialog("Xoá dự án này?", p.name, [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá", style: "destructive",
        onPress: () => {
          setAdded((cur) => cur.filter((x) => x !== p.name));
          setLooks((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== p.name)));
          setProjectForm(null);
          setProject((cur) => (cur === p.name ? "" : cur));
        },
      },
    ]);
  };

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
        proj = undefined; // link hỏng thì bỏ qua tên dự án
      }
      const start = () => newNoteRef.current(tm ? tm[1] : "bug", proj);
      if (!editingRef.current) return start();
      showDialog("Đang soạn dở một ghi chú", "Tạo ghi chú mới sẽ bỏ phần chưa lưu.", [
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

  const copyOne = async (n) => {
    await Clipboard.setStringAsync(buildPrompt([n]));
    showDialog("Đã chép", "Dán vào Claude Code để xử lý mục này.");
  };

  const menuItems = (n) => {
    // Bấm nút nào thì đóng hàng nút trước rồi mới làm việc
    const item = (icon, label, run, danger) => ({ icon, label, danger, onPress: () => { showActions(""); run(); } });
    const view = item("view", "Xem", () => setViewingId(n.id));
    if (status === "trash") return [view, item("reopen", "Khôi phục", () => setDeleted(n.id, false))];
    const done = n.status === "done";
    return [
      view,
      item("edit", "Sửa", () => setEditing(n)),
      item(done ? "reopen" : "done", done ? "Mở lại" : "Xong", () => save({ ...n, status: done ? "new" : "done" })),
      item("copy", "Chép", () => copyOne(n)),
      item("checked", "Chọn", () => toggleSelect(n.id)),
      item("trash", "Xoá", () => remove(n), true),
    ];
  };

  const copyPrompt = async () => {
    const list = selecting ? visible.filter((n) => selected.has(n.id)) : visible.filter((n) => n.status !== "done");
    if (!list.length) return showDialog("Không có ghi chú nào để chép");
    await Clipboard.setStringAsync(buildPrompt(list));
    setSelected(new Set());
    showDialog("Đã chép", `${list.length} ghi chú đã vào clipboard. Dán vào Claude Code.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} onTouchStart={onRootTouchStart} onTouchEnd={onRootTouchEnd}>
      <StatusBar barStyle={t.dark ? "light-content" : "dark-content"} backgroundColor={t.bg} />

      {/* Header */}
      {selecting ? (
        <View style={st.header}>
          <TouchableOpacity onPress={() => setSelected(new Set())} hitSlop={12}>
            <View style={st.textBtn}>
              <Icon name="close" size={16} color={t.sub} />
              <Text style={{ color: t.sub, fontSize: 16 }}>Bỏ chọn</Text>
            </View>
          </TouchableOpacity>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>{selected.size} đã chọn</Text>
          <TouchableOpacity onPress={copyPrompt} hitSlop={12}>
            <View style={st.textBtn}>
              <Icon name="copy" size={20} color={t.primary} />
              <Text style={{ color: t.primary, fontWeight: "700", fontSize: 16 }}>Chép</Text>
            </View>
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
              <Icon name="copy" size={26} color={t.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => doSync()} hitSlop={8} disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel={syncing ? "Đang đồng bộ dữ liệu" : "Đồng bộ dữ liệu"}>
              <Animated.View style={{
                transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
              }}>
                <Icon name="sync" size={26} color={t.text} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Cài đặt">
              <Icon name="settings" size={26} color={t.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tìm kiếm + bộ lọc */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ position: "relative", justifyContent: "center" }}>
          <TextInput
            style={[st.search, { backgroundColor: t.card, color: t.text }, query.length > 0 && { paddingRight: 40 }]}
            placeholder="Tìm ghi chú…"
            placeholderTextColor={t.sub}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Tìm ghi chú"
          />
          <View style={st.searchIcon} pointerEvents="none">
            <Icon name="search" size={20} color={t.sub} />
          </View>
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Xoá nội dung tìm kiếm"
              style={st.clear}
            >
              <Icon name="close" size={16} color={t.sub} />
            </TouchableOpacity>
          )}
        </View>
        <View style={st.filterBar}>
          <TouchableOpacity ref={leftBtn} onPress={() => openDropdown("left", leftBtn)} style={[st.filterBtn, { backgroundColor: t.card2 }]}
            accessibilityRole="button" accessibilityLabel={`Chọn dự án, đang chọn ${project || "tất cả dự án"}`}>
            {!!project && <View style={{ marginRight: 6 }}><ProjectBadge name={project} look={looks[project]} size={20} /></View>}
            <Text style={{ color: t.text, fontSize: 14, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
              {project || "Tất cả dự án"}
            </Text>
            <View style={{ marginLeft: 8 }}><Icon name="caret" size={14} color={t.sub} /></View>
          </TouchableOpacity>
          <TouchableOpacity ref={rightBtn} onPress={() => openDropdown("right", rightBtn)} style={[st.filterBtn, { backgroundColor: t.card2 }]}
            accessibilityRole="button" accessibilityLabel={`Chọn trạng thái, đang chọn ${STATUS_FILTERS[status]}`}>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
              {STATUS_FILTERS[status]}{type && status !== "trash" ? ` · ${TYPES[type]}` : ""}
            </Text>
            <View style={{ marginLeft: 8 }}><Icon name="caret" size={14} color={t.sub} /></View>
          </TouchableOpacity>
        </View>
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
        ref={listRef}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        data={visible}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => doSync()} tintColor={t.sub} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 70 }}>
            <Icon name={query ? "search" : "newNote"} size={56} color={t.sub} />
            <Text style={{ color: t.sub, marginTop: 10, textAlign: "center", lineHeight: 22 }}>
              {query ? "Không tìm thấy ghi chú nào." : "Chưa có ghi chú nào.\nBấm nút bên dưới để thêm bug hoặc ý tưởng."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NoteCard
            note={item} t={t} look={looks[item.project]} selecting={selecting} selected={selected.has(item.id)}
            trash={status === "trash"}
            actions={menuId === item.id ? menuItems(item) : null}
            onActionsShown={revealActions}
            onTouchEnd={menuId === item.id ? () => { touch.current.inside = true; } : undefined}
            onPress={() =>
              // Đang mở hàng nút thì chạm card nào cũng chỉ đóng lại
              menuId ? showActions("")
              : status === "trash"
                ? showDialog("Khôi phục ghi chú?", item.title, [{ text: "Huỷ", style: "cancel" }, { text: "Khôi phục", onPress: () => setDeleted(item.id, false) }])
                : selecting ? toggleSelect(item.id) : setEditing(item)
            }
            onLongPress={() => {
              hapticLight();
              if (selecting) toggleSelect(item.id);
              else showActions(menuId === item.id ? "" : item.id);
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
        // Android bật edge-to-edge nên adjustResize không tự đẩy ô nhập lên: cần padding ở cả hai nền tảng
        <KeyboardAvoidingView
          behavior="padding"
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
              <Icon name={TYPE_ICONS[quickType]} size={24} color={TYPE_COLOR[quickType]} />
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
                <Icon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => newNote(quickType)}
                accessibilityRole="button" accessibilityLabel="Tạo ghi chú mới"
                style={[st.send, { backgroundColor: t.card2 }]}>
                <Icon name="add" size={20} color={t.text} />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {editing && (
        <NoteEditor
          key={editing.id} note={editing} projects={projectNames} looks={looks} t={t}
          onSave={save} onCancel={() => setEditing(null)}
          onDelete={notes.some((x) => x.id === editing.id) ? () => remove(editing) : null}
        />
      )}

      {dropdown?.side === "left" && (
        <Dropdown side="left" top={dropdown.top} t={t} onClose={() => setDropdown(null)}>
          {(close) => (
            <>
              <DropdownItem t={t} label="Tất cả dự án" count={openCount} active={!project}
                onPress={() => close(() => setProject(""))} />
              {projects.map((p) => (
                <DropdownItem key={p.name} t={t} label={p.name} count={p.open}
                  badge={<ProjectBadge name={p.name} look={looks[p.name]} />}
                  active={project === p.name} onPress={() => close(() => setProject(p.name))}
                  onLongPress={hapticLight} onHoldRelease={() => close(() => setProjectForm(p.name))} />
              ))}
              <TouchableOpacity onPress={() => close(() => setProjectForm(""))} accessibilityRole="button"
                style={[st.addProject, { backgroundColor: t.card2 }]}>
                <View style={st.textBtn}>
                  <Icon name="add" size={16} color={t.primary} />
                  <Text style={{ color: t.primary, fontSize: 16, fontWeight: "700" }}>Thêm dự án</Text>
                </View>
              </TouchableOpacity>
              {projects.length > 0 && (
                <Text style={[st.hint, { color: t.sub }]}>Nhấn giữ một dự án để đổi màu, icon.</Text>
              )}
            </>
          )}
        </Dropdown>
      )}

      {dropdown?.side === "right" && (
        <Dropdown side="right" top={dropdown.top} t={t} onClose={() => setDropdown(null)}>
          {(close) => (
            <>
              {Object.entries(STATUS_FILTERS).map(([k, v]) => (
                <DropdownItem key={k} t={t} label={v} count={k === "trash" ? trashed.length : 0}
                  badge={<Icon name={STATUS_ICONS[k]} size={20} color={status === k ? t.primary : t.sub} />}
                  active={status === k} onPress={() => close(() => setStatus(k))} />
              ))}
              <Text style={[st.section, { color: t.sub, borderTopColor: t.card2 }]}>Loại ghi chú</Text>
              <DropdownItem t={t} label="Mọi loại" active={!type}
                badge={<Icon name="all" size={20} color={!type ? t.primary : t.sub} />} onPress={() => close(() => setType(""))} />
              {Object.entries(TYPES).map(([k, v]) => (
                <DropdownItem key={k} t={t} label={v} active={type === k} onPress={() => close(() => setType(k))}
                  badge={<Icon name={TYPE_ICONS[k]} size={20} color={TYPE_COLOR[k]} />} />
              ))}
            </>
          )}
        </Dropdown>
      )}

      {viewingNote && (
        <NoteViewer
          note={viewingNote} look={looks[viewingNote.project]} t={t} onClose={() => setViewingId("")}
          onEdit={viewingNote.deleted ? null : () => { setViewingId(""); setEditing(viewingNote); }}
        />
      )}

      {projectForm !== null && (
        <ProjectModal
          t={t} editName={projectForm} initialLook={looks[projectForm]}
          onSave={saveProject} onClose={() => setProjectForm(null)}
          onDelete={projects.some((p) => p.name === projectForm && !p.total)
            ? () => removeProject(projects.find((p) => p.name === projectForm)) : null}
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

      <DialogHost t={t} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  searchIcon: { position: "absolute", left: 14, top: 0, bottom: 0, justifyContent: "center" },
  search: { borderRadius: 14, paddingLeft: 44, paddingRight: 16, paddingVertical: 11, fontSize: 15 },
  clear: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  textBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  filterBar: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 10 },
  filterBtn: { flexDirection: "row", alignItems: "center", flexShrink: 1, paddingHorizontal: 14, minHeight: 44, borderRadius: 22 },
  addProject: { alignItems: "center", padding: 12, borderRadius: 12, marginTop: 6 },
  hint: { fontSize: 11, textAlign: "center", marginTop: 8, marginBottom: 2 },
  section: { fontSize: 13, fontWeight: "600", borderTopWidth: 1, marginTop: 6, paddingTop: 10, marginBottom: 4, paddingHorizontal: 12 },
  banner: { marginHorizontal: 16, marginTop: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  snack: { position: "absolute", left: 16, right: 16, bottom: 84, flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14 },
  composerWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  composer: { marginHorizontal: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", padding: 6, borderRadius: 28 },
  typeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
