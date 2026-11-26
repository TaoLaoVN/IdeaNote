import React from "react";
// Bộ icon Phosphor Duotone. Nhập từng file để bản đóng gói không kéo theo cả nghìn icon
import { ArrowCounterClockwise } from "phosphor-react-native/src/icons/ArrowCounterClockwise";
import { ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { ArrowsClockwise } from "phosphor-react-native/src/icons/ArrowsClockwise";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { Books } from "phosphor-react-native/src/icons/Books";
import { Bug } from "phosphor-react-native/src/icons/Bug";
import { Camera } from "phosphor-react-native/src/icons/Camera";
import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { ChatCircle } from "phosphor-react-native/src/icons/ChatCircle";
import { Check } from "phosphor-react-native/src/icons/Check";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { CheckSquare } from "phosphor-react-native/src/icons/CheckSquare";
import { Coins } from "phosphor-react-native/src/icons/Coins";
import { Copy } from "phosphor-react-native/src/icons/Copy";
import { Desktop } from "phosphor-react-native/src/icons/Desktop";
import { DeviceMobile } from "phosphor-react-native/src/icons/DeviceMobile";
import { Eye } from "phosphor-react-native/src/icons/Eye";
import { FirstAidKit } from "phosphor-react-native/src/icons/FirstAidKit";
import { Folder } from "phosphor-react-native/src/icons/Folder";
import { GameController } from "phosphor-react-native/src/icons/GameController";
import { GearSix } from "phosphor-react-native/src/icons/GearSix";
import { Globe } from "phosphor-react-native/src/icons/Globe";
import { Image } from "phosphor-react-native/src/icons/Image";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { ListChecks } from "phosphor-react-native/src/icons/ListChecks";
import { Lock } from "phosphor-react-native/src/icons/Lock";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { MusicNote } from "phosphor-react-native/src/icons/MusicNote";
import { NotePencil } from "phosphor-react-native/src/icons/NotePencil";
import { Palette } from "phosphor-react-native/src/icons/Palette";
import { PencilSimple } from "phosphor-react-native/src/icons/PencilSimple";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Robot } from "phosphor-react-native/src/icons/Robot";
import { Rocket } from "phosphor-react-native/src/icons/Rocket";
import { ShoppingCart } from "phosphor-react-native/src/icons/ShoppingCart";
import { Sparkle } from "phosphor-react-native/src/icons/Sparkle";
import { Square } from "phosphor-react-native/src/icons/Square";
import { SquaresFour } from "phosphor-react-native/src/icons/SquaresFour";
import { Trash } from "phosphor-react-native/src/icons/Trash";
import { Tray } from "phosphor-react-native/src/icons/Tray";
import { X } from "phosphor-react-native/src/icons/X";

const ICONS = {
  add: Plus, bell: Bell, bug: Bug, caret: CaretDown, check: Check, checkbox: Square, checked: CheckSquare,
  checklist: ListChecks, close: X, copy: Copy, done: CheckCircle, edit: PencilSimple, folder: Folder, idea: Lightbulb,
  image: Image, improvement: Sparkle, newNote: NotePencil, open: Tray, all: SquaresFour, reopen: ArrowCounterClockwise,
  search: MagnifyingGlass, send: ArrowUp, settings: GearSix, sync: ArrowsClockwise, trash: Trash, view: Eye,
  // icon cho dự án
  mobile: DeviceMobile, desktop: Desktop, web: Globe, game: GameController, shop: ShoppingCart, chat: ChatCircle,
  camera: Camera, music: MusicNote, books: Books, money: Coins, health: FirstAidKit, rocket: Rocket, lock: Lock,
  art: Palette, robot: Robot,
};

export const hasIcon = (name) => !!ICONS[name];

// Một số icon chỉ là nét đơn (mũi tên, dấu cộng, dấu tick) nên dùng nét đậm cho rõ
const BOLD = new Set(["add", "caret", "check", "close", "send"]);

export default function Icon({ name, size = 22, color, weight }) {
  const Svg = ICONS[name];
  if (!Svg) return null;
  return <Svg size={size} color={color} weight={weight || (BOLD.has(name) ? "bold" : "duotone")} />;
}
