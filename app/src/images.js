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
    const ctx = ImageManipulator.manipulate(a.uri);
    if (a.width > 1280) ctx.resize({ width: 1280 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
    const id = uid();
    writeImageBase64(id, out.base64);
    ids.push(id);
  }
  return ids;
}
