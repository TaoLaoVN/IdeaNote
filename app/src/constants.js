export const KEY_NOTES = "ideanote:notes";
export const KEY_SETTINGS = "ideanote:settings";
export const KEY_SYNC = "ideanote:lastSync";
export const KEY_WIDGET_PROJECT = "ideanote:widgetProject";

export const TYPES = { bug: "🐞 Bug", idea: "💡 Ý tưởng", improvement: "✨ Cải tiến" };
export const TYPE_ICON = { bug: "🐞", idea: "💡", improvement: "✨" };
export const PRIORITIES = { high: "Cao", medium: "Vừa", low: "Thấp" };
export const STATUSES = { new: "Mới", doing: "Đang làm", done: "Xong" };
export const PRIO_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
export const PRIO_RANK = { high: 0, medium: 1, low: 2 };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Màu cố định cho mỗi dự án, suy ra từ tên
const PALETTE = ["#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#eab308"];
export function projectColor(name) {
  if (!name) return "#6b7280";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(ms).toLocaleDateString("vi-VN");
}

// Biến danh sách ghi chú thành prompt để dán vào Claude Code
export function buildPrompt(list) {
  const lines = list.map(
    (n, i) =>
      `${i + 1}. [${TYPES[n.type]}] [Ưu tiên ${PRIORITIES[n.priority]}]${n.project ? ` (${n.project})` : ""} ${n.title}` +
      (n.body ? `\n   ${n.body.replace(/\n/g, "\n   ")}` : "") +
      (n.checklist && n.checklist.length
        ? "\n" + n.checklist.map((c) => `   - [${c.done ? "x" : " "}] ${c.text}`).join("\n")
        : "") +
      (n.images && n.images.length ? `\n   (có ${n.images.length} ảnh chụp màn hình đính kèm trong app, không nằm trong prompt này)` : "")
  );
  const intro =
    list.length === 1
      ? "Dưới đây là một mục tôi ghi lại. Hãy xem code, đánh giá và xử lý. Nói rõ bạn định làm gì trước khi sửa."
      : "Dưới đây là danh sách bug và ý tưởng tôi ghi lại. Hãy xem code, đánh giá và xử lý lần lượt từ mục ưu tiên cao nhất. Với mỗi mục, nói rõ bạn định làm gì trước khi sửa.";
  return `${intro}\n\n${lines.join("\n\n")}`;
}

export const TRASH_DAYS = 30;
export const fmtDateTime = (ms) =>
  new Date(ms).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
