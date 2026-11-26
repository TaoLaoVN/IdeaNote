import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QuickNoteWidget } from "./QuickNote";

const KEY_NOTES = "ideanote:notes";
const KEY_WIDGET_PROJECT = "ideanote:widgetProject";
const KEY_PROJECTS = "ideanote:projects";

async function getProjects() {
  const raw = await AsyncStorage.getItem(KEY_NOTES);
  const notes = raw ? JSON.parse(raw) : [];
  const added = JSON.parse((await AsyncStorage.getItem(KEY_PROJECTS)) || "[]");
  return [...new Set([...notes.filter((n) => !n.deleted && n.project).map((n) => n.project), ...added])];
}

export async function widgetTaskHandler(props) {
  const projects = await getProjects();
  let current = (await AsyncStorage.getItem(KEY_WIDGET_PROJECT)) || "";
  // dự án đã bị xoá hết ghi chú -> quay về "chưa chọn"
  if (current && !projects.includes(current)) current = "";

  if (props.widgetAction === "WIDGET_CLICK" && props.clickAction === "CYCLE_PROJECT") {
    const options = ["", ...projects];
    current = options[(options.indexOf(current) + 1) % options.length];
    await AsyncStorage.setItem(KEY_WIDGET_PROJECT, current);
  }

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
    case "WIDGET_CLICK":
      props.renderWidget(<QuickNoteWidget project={current} />);
      break;
    default:
      break;
  }
}
