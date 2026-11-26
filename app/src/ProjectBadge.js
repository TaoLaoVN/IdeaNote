import React from "react";
import { View, Text, Image } from "react-native";
import { projectColor } from "./constants";

// Hình đại diện dự án: ảnh riêng, icon emoji, hoặc chấm màu. look = { color, icon, image }
export default function ProjectBadge({ name, look, size = 24 }) {
  if (look?.image) {
    return <Image source={{ uri: look.image }} style={{ width: size, height: size, borderRadius: size / 4 }} />;
  }
  const color = projectColor(name, look);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {look?.icon ? (
        <Text style={{ fontSize: size * 0.72, lineHeight: size }}>{look.icon}</Text>
      ) : (
        <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, backgroundColor: color }} />
      )}
    </View>
  );
}
