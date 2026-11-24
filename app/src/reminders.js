import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureReminderPermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Nhắc việc",
      importance: AndroidImportance.HIGH,
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// Đặt lại toàn bộ lịch nhắc theo danh sách ghi chú hiện tại
export async function rescheduleReminders(notes) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const n of notes) {
      if (n.deleted || n.status === "done" || !n.remind_at || n.remind_at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.project ? `${n.project}: nhắc việc` : "Nhắc việc", body: n.title },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(n.remind_at), channelId: "reminders" },
      });
    }
  } catch {
    // chưa cấp quyền thì bỏ qua
  }
}
