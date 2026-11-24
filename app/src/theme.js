import { useColorScheme } from "react-native";

const dark = {
  dark: true, bg: "#0b0d12", card: "#151922", card2: "#1d222d", text: "#f3f4f6",
  sub: "#9aa3b2", border: "#262c39", primary: "#3b82f6", danger: "#ef4444", ok: "#22c55e",
};
const light = {
  dark: false, bg: "#f3f4f6", card: "#ffffff", card2: "#e9ecf1", text: "#111827",
  sub: "#6b7280", border: "#dfe3ea", primary: "#2563eb", danger: "#dc2626", ok: "#16a34a",
};

// Tự theo giao diện sáng/tối của điện thoại
export function useTheme() {
  return useColorScheme() === "light" ? light : dark;
}
