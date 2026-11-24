import { useColorScheme } from "react-native";

const dark = {
  dark: true, bg: "#0f1115", card: "#181b22", card2: "#222630", text: "#f3f4f6",
  sub: "#9aa3b2", border: "#181b22", primary: "#3b82f6", danger: "#ef4444", ok: "#22c55e",
};
const light = {
  dark: false, bg: "#f5f6f8", card: "#ffffff", card2: "#eceef2", text: "#111827",
  sub: "#6b7280", border: "#ffffff", primary: "#2563eb", danger: "#dc2626", ok: "#16a34a",
};

// Tự theo giao diện sáng/tối của điện thoại
export function useTheme() {
  return useColorScheme() === "light" ? light : dark;
}
