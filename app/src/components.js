import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { TYPE_ICON, PRIO_COLOR, STATUSES, projectColor, ago, fmtDateTime } from "./constants";
import ProjectBadge from "./ProjectBadge";

const nowMs = () => Date.now();

export function Chip({ label, active, onPress, color, t, small }) {
  const on = color || t.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        st.chip,
        small && { paddingVertical: 4 },
        { backgroundColor: active ? on : t.card2 },
      ]}
    >
      <Text style={{ color: active ? "#fff" : t.sub, fontSize: 13, fontWeight: active ? "600" : "400" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Segment({ options, value, onChange, t, colors }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
      {Object.entries(options).map(([k, v]) => (
        <Chip key={k} label={v} t={t} active={value === k} color={colors && colors[k]} onPress={() => onChange(k)} />
      ))}
    </View>
  );
}

// Ô tròn: trống = mới, nửa = đang làm, tick = xong
export function StatusBox({ status, onPress, t }) {
  const done = status === "done";
  const doing = status === "doing";
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <View
        style={[
          st.box,
          { borderColor: done ? t.ok : doing ? "#f59e0b" : t.sub, backgroundColor: done ? t.ok : "transparent" },
        ]}
      >
        {done && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
        {doing && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#f59e0b" }} />}
      </View>
    </TouchableOpacity>
  );
}

// actions: [{ icon, label, danger, onPress }] — có thì card mở rộng, hiện hàng nút bên dưới
export function NoteCard({ note, t, selected, selecting, onPress, onLongPress, onToggle, trash, actions, onActionsShown, onTouchEnd, look }) {
  const actionsRef = useRef(null);
  const done = note.status === "done";
  const cl = note.checklist || [];
  const clDone = cl.filter((c) => c.done).length;
  const imgs = (note.images || []).length;
  const overdue = note.remind_at && note.remind_at < nowMs() && !done;
  return (
    // View bọc ngoài để nhận onTouchEnd: TouchableOpacity không chuyển tiếp sự kiện này
    <View onTouchEnd={onTouchEnd}>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        st.card,
        { backgroundColor: t.card, borderColor: selected ? t.primary : t.border, opacity: done ? 0.6 : 1 },
        selected && { borderWidth: 2 },
        !!actions && { opacity: 1, borderWidth: 1, borderColor: t.primary },
      ]}
    >
      <View style={{ flexDirection: "row" }}>
      <View style={[st.bar, { backgroundColor: PRIO_COLOR[note.priority] }]} />
      <View style={{ paddingLeft: 12, justifyContent: "flex-start", paddingTop: 14 }}>
        {trash ? (
          <Text style={{ fontSize: 20 }}>🗑</Text>
        ) : selecting ? (
          <View style={[st.box, { borderColor: t.primary, backgroundColor: selected ? t.primary : "transparent" }]}>
            {selected && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
          </View>
        ) : (
          <StatusBox status={note.status} t={t} onPress={onToggle} />
        )}
      </View>
      <View style={{ flex: 1, padding: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          <Text style={{ fontSize: 13, marginRight: 8 }}>{TYPE_ICON[note.type]}</Text>
          {!!note.project && (
            <View style={[st.pill, { flexDirection: "row", alignItems: "center", backgroundColor: projectColor(note.project, look) + "33" }]}>
              {!!(look?.icon || look?.image) && (
                <View style={{ marginRight: 4 }}><ProjectBadge name={note.project} look={look} size={16} /></View>
              )}
              <Text style={{ color: projectColor(note.project, look), fontSize: 12, fontWeight: "600" }}>{note.project}</Text>
            </View>
          )}
          {note.status === "doing" && (
            <View style={[st.pill, { backgroundColor: "#f59e0b33" }]}>
              <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "600" }}>{STATUSES.doing}</Text>
            </View>
          )}
          <Text style={{ color: t.sub, fontSize: 12, marginLeft: "auto" }}>{ago(note.updated_at)}</Text>
        </View>
        <Text
          style={{ color: t.text, fontSize: 16, fontWeight: "600", marginTop: 6, textDecorationLine: done ? "line-through" : "none" }}
        >
          {note.title}
        </Text>
        {!!note.body && (
          <Text style={{ color: t.sub, marginTop: 4, lineHeight: 20 }} numberOfLines={2}>
            {note.body}
          </Text>
        )}
        {(cl.length > 0 || imgs > 0 || !!note.remind_at) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 12 }}>
            {cl.length > 0 && <Text style={{ color: clDone === cl.length ? t.ok : t.sub, fontSize: 12 }}>☑ {clDone}/{cl.length}</Text>}
            {imgs > 0 && <Text style={{ color: t.sub, fontSize: 12 }}>🖼 {imgs}</Text>}
            {!!note.remind_at && (
              <Text style={{ color: overdue ? t.danger : t.sub, fontSize: 12 }}>⏰ {fmtDateTime(note.remind_at)}</Text>
            )}
          </View>
        )}
      </View>
      </View>
      {!!actions && (
        <View ref={actionsRef} style={[st.actions, { borderTopColor: t.card2 }]}
          onLayout={() => onActionsShown && onActionsShown(actionsRef.current)}>
          {actions.map((a) => (
            <TouchableOpacity key={a.label} onPress={a.onPress} style={st.action}
              accessibilityRole="button" accessibilityLabel={a.label}>
              <Text style={st.actionIcon}>{a.icon}</Text>
              <Text style={{ color: a.danger ? t.danger : t.sub, fontSize: 11, fontWeight: "600" }} numberOfLines={1}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 6 },
  box: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", borderTopWidth: 1, paddingHorizontal: 4 },
  action: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 56 },
  actionIcon: { fontSize: 18, marginBottom: 3 },
  card: { borderRadius: 18, marginBottom: 10, overflow: "hidden", borderWidth: 0 },
  bar: { width: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 6 },
});
