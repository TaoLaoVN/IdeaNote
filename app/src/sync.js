import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEY_SYNC } from "./constants";
import { hasImage, readImageBase64, writeImageBase64, fitImage, MAX_IMAGE_CHARS } from "./images";

const SLACK = 5 * 60 * 1000; // lùi mốc đẩy 5 phút, phòng khi đồng hồ máy bị chỉnh lùi

// Gộp hai danh sách: bản có updated_at mới hơn thắng
export function mergeNotes(a, b) {
  const map = new Map(a.map((n) => [n.id, n]));
  for (const n of b) {
    const cur = map.get(n.id);
    if (!cur || n.updated_at > cur.updated_at) map.set(n.id, { ...n, deleted: !!n.deleted });
  }
  return [...map.values()];
}

// Trạng thái đồng bộ gắn với một server:
//   push      mốc theo đồng hồ MÁY NÀY, ghi chú sửa sau mốc cần đẩy lên
//   cursor    số thứ tự do SERVER cấp, dùng để kéo về
//   pendingUp ảnh tải lên chưa thành công
async function loadSyncState(url) {
  try {
    const s = JSON.parse(await AsyncStorage.getItem(KEY_SYNC));
    if (s && s.url === url) return s;
  } catch {}
  return { url, push: 0, cursor: 0, pendingUp: [] };
}

// Gọi SAU khi ghi chú kéo về đã được lưu vào máy
export const saveSyncState = (state) => AsyncStorage.setItem(KEY_SYNC, JSON.stringify(state));

async function uploadImage(base, headers, id) {
  let data = await readImageBase64(id);
  if (data.length > MAX_IMAGE_CHARS) data = await fitImage(id);
  const r = await fetch(`${base}/images/${id}`, { method: "PUT", headers, body: JSON.stringify({ data }) });
  if (!r.ok) throw new Error(`Tải ảnh lên lỗi ${r.status}`);
}

async function downloadImage(base, headers, id) {
  const r = await fetch(`${base}/images/${id}`, { headers });
  if (!r.ok) throw new Error(`Tải ảnh về lỗi ${r.status}`);
  writeImageBase64(id, (await r.json()).data);
}

// Đẩy thay đổi lên server rồi kéo thay đổi mới về.
// Trả về ghi chú từ server và trạng thái mới (người gọi lưu bằng saveSyncState).
export async function syncNotes(notes, cfg) {
  const base = cfg.url.trim().replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${cfg.secret.trim()}`, "content-type": "application/json" };
  const state = await loadSyncState(base);
  const started = Date.now();

  const dirty = notes.filter((n) => n.updated_at > state.push);
  // Ảnh trước, để máy kia kéo ghi chú về là có ảnh ngay. Ảnh lỗi được giữ lại để thử lần sau.
  const uploads = new Set([...(state.pendingUp || []), ...dirty.flatMap((n) => n.images || [])]);
  const pendingUp = [];
  for (const id of uploads) {
    if (!hasImage(id)) continue;
    try {
      await uploadImage(base, headers, id);
    } catch {
      pendingUp.push(id);
    }
  }
  if (dirty.length) {
    const r = await fetch(`${base}/notes`, { method: "POST", headers, body: JSON.stringify({ notes: dirty }) });
    if (r.status === 401) throw new Error("Sai mã bí mật");
    if (!r.ok) throw new Error(`Đẩy lên lỗi ${r.status}`);
  }
  const r2 = await fetch(`${base}/notes?after=${state.cursor}`, { headers });
  if (r2.status === 401) throw new Error("Sai mã bí mật");
  if (!r2.ok) throw new Error(`Kéo về lỗi ${r2.status}`);
  // Server chưa cập nhật thì không trả cursor: giữ 0, mỗi lần đều kéo về tất cả
  const { notes: remote, cursor = 0 } = await r2.json();

  // Chỉ đếm những ghi chú thật sự mới với máy này (không tính bản vừa tự đẩy lên)
  const local = new Map(notes.map((n) => [n.id, n.updated_at]));
  const pulled = remote.filter((n) => !local.has(n.id) || n.updated_at > local.get(n.id)).length;

  // Xét mọi ghi chú, không chỉ bản vừa kéo về, để ảnh lỗi lần trước được tải lại
  const wanted = new Set(mergeNotes(notes, remote).filter((n) => !n.deleted).flatMap((n) => n.images || []));
  let downloadFailed = 0;
  for (const id of wanted) {
    if (hasImage(id)) continue;
    try {
      await downloadImage(base, headers, id);
    } catch {
      downloadFailed++;
    }
  }

  return {
    remote,
    pushed: dirty.length,
    pulled,
    imagesFailed: pendingUp.length + downloadFailed,
    state: { url: base, push: Math.max(0, started - SLACK), cursor, pendingUp },
  };
}
