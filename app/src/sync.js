import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEY_SYNC } from "./constants";

const SLACK = 5 * 60 * 1000; // lùi 5 phút để không sót ghi chú khi lệch đồng hồ

// Gộp hai danh sách: bản có updated_at mới hơn thắng
export function mergeNotes(a, b) {
  const map = new Map(a.map((n) => [n.id, n]));
  for (const n of b) {
    const cur = map.get(n.id);
    if (!cur || n.updated_at > cur.updated_at) map.set(n.id, { ...n, deleted: !!n.deleted });
  }
  return [...map.values()];
}

// Đẩy thay đổi lên server rồi kéo thay đổi mới về. Trả về danh sách từ server.
export async function syncNotes(notes, cfg) {
  const base = cfg.url.trim().replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${cfg.secret.trim()}`, "content-type": "application/json" };
  const last = Number((await AsyncStorage.getItem(KEY_SYNC)) || 0);
  const started = Date.now();

  const dirty = notes.filter((n) => n.updated_at > last);
  if (dirty.length) {
    const r = await fetch(`${base}/notes`, { method: "POST", headers, body: JSON.stringify({ notes: dirty }) });
    if (r.status === 401) throw new Error("Sai mã bí mật");
    if (!r.ok) throw new Error(`Đẩy lên lỗi ${r.status}`);
  }
  const r2 = await fetch(`${base}/notes?since=${last}`, { headers });
  if (r2.status === 401) throw new Error("Sai mã bí mật");
  if (!r2.ok) throw new Error(`Kéo về lỗi ${r2.status}`);
  const { notes: remote } = await r2.json();

  await AsyncStorage.setItem(KEY_SYNC, String(Math.max(0, started - SLACK)));
  return { remote, pushed: dirty.length, pulled: remote.length };
}
