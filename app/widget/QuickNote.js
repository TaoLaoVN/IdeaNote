import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

const uri = (type, project) =>
  `ideanote://new?type=${type}&project=${encodeURIComponent(project || "")}`;

// Widget: thanh chọn dự án (bấm để chuyển dự án kế tiếp) + 2 nút Bug / Ý tưởng
export function QuickNoteWidget({ project }) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#1a1d24",
        borderRadius: 24,
        padding: 8,
        flexDirection: "column",
      }}
    >
      <FlexWidget
        clickAction="CYCLE_PROJECT"
        style={{
          width: "match_parent",
          height: 40,
          backgroundColor: "#2b2f3a",
          borderRadius: 12,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <TextWidget
          text={`📁 ${project || "Chưa chọn dự án"}  ▾`}
          style={{ fontSize: 14, color: "#ffffff" }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>

      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "row" }}>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: uri("bug", project) }}
          style={{
            flex: 1, height: "match_parent", backgroundColor: "#dc2626", borderRadius: 14,
            justifyContent: "center", alignItems: "center", marginRight: 4,
          }}
        >
          <TextWidget text="🐞" style={{ fontSize: 28 }} />
          <TextWidget text="Bug" style={{ fontSize: 14, color: "#ffffff" }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: uri("idea", project) }}
          style={{
            flex: 1, height: "match_parent", backgroundColor: "#2563eb", borderRadius: 14,
            justifyContent: "center", alignItems: "center", marginLeft: 4,
          }}
        >
          <TextWidget text="💡" style={{ fontSize: 28 }} />
          <TextWidget text="Ý tưởng" style={{ fontSize: 14, color: "#ffffff" }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
