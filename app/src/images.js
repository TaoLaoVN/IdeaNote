import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { uid } from "./constants";

const dir = () => new Directory(Paths.document, "ideanote-images");
const fileOf = (id) => new File(dir(), `${id}.jpg`);

function ensureDir() {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
}

export const imageUri = (id) => fileOf(id).uri;
export const hasImage = (id) => fileOf(id).exists;
export const readImageBase64 = (id) => fileOf(id).base64();

export function writeImageBase64(id, b64) {
  ensureDir();
  const f = fileOf(id);
  if (!f.exists) f.create();
  f.write(b64, { encoding: "base64" });
}

// Server từ chối ảnh có chuỗi base64 dài hơn mức này (xem backend/src/index.js)
export const MAX_IMAGE_CHARS = 1_500_000;
// [rộng tối đa, mức nén]: thử lần lượt tới khi ảnh vừa giới hạn
const STEPS = [[1280, 0.6], [1080, 0.5], [900, 0.45], [720, 0.4], [540, 0.35]];

async function encodeImage(uri, width) {
  for (const [maxWidth, compress] of STEPS) {
    const ctx = ImageManipulator.manipulate(uri);
    if (width > maxWidth) ctx.resize({ width: maxWidth });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (out.base64.length <= MAX_IMAGE_CHARS) return out.base64;
  }
  throw new Error("Ảnh quá lớn, không thu nhỏ đủ để đồng bộ được");
}

// Thu nhỏ ảnh đã lưu từ trước mà vượt giới hạn, ghi đè file và trả về base64 mới
export async function fitImage(id) {
  const { width } = await ImageManipulator.manipulate(imageUri(id)).renderAsync();
  const b64 = await encodeImage(imageUri(id), width);
  writeImageBase64(id, b64);
  return b64;
}

// Chọn một ảnh làm icon dự án: cắt vuông, thu còn 128px, trả về data URI (rỗng nếu huỷ)
export async function pickIcon() {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled) return "";
  const ctx = ImageManipulator.manipulate(res.assets[0].uri);
  ctx.resize({ width: 128, height: 128 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.PNG, base64: true });
  return `data:image/png;base64,${out.base64}`;
}

// Chọn ảnh từ thư viện, thu nhỏ (rộng tối đa 1280px, JPEG) rồi lưu. Trả về danh sách id.
export async function pickImages() {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (res.canceled) return [];
  const ids = [];
  for (const a of res.assets) {
    const b64 = await encodeImage(a.uri, a.width);
    const id = uid();
    writeImageBase64(id, b64);
    ids.push(id);
  }
  return ids;
}
