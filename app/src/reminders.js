import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function ensureChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Nhắc việc",
      importance: AndroidImportance.HIGH,
    });
  }
}

export async function ensureReminderPermission() {
  await ensureChannel(); // Android 13+: phải có kênh trước khi xin quyền
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

let asked = false; // tự xin quyền tối đa một lần mỗi phiên, tránh hỏi lặp
let latest = [];
let queue = Promise.resolve();

async function apply(notes) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const due = notes.filter((n) => !n.deleted && n.status !== "done" && n.remind_at > now);
  if (!due.length) return;

  // Nhắc việc có thể đến từ máy khác qua đồng bộ, nên máy này cũng cần kênh và quyền
  await ensureChannel();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    if (asked || !perm.canAskAgain) return;
    asked = true;
    if (!(await ensureReminderPermission())) return;
  }

  for (const n of due) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.project ? `${n.project}: nhắc việc` : "Nhắc việc", body: n.title },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.remind_at), channelId: "reminders" },
      });
    } catch (e) {
      console.warn("Không đặt được nhắc việc", n.id, e); // một mục lỗi không chặn các mục còn lại
    }
  }
}

// Đặt lại toàn bộ lịch nhắc. Các lần gọi chạy nối tiếp, chỉ danh sách mới nhất được áp dụng.
export function rescheduleReminders(notes) {
  latest = notes;
  queue = queue
    .then(() => (notes === latest ? apply(notes) : undefined))
    .catch((e) => console.warn("Không đặt lại được lịch nhắc", e));
  return queue;
}
