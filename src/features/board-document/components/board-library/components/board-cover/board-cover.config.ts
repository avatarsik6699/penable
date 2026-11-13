import {
  Notebook,
  BookOpen,
  Calculator,
  Languages,
  FlaskConical,
  Atom,
  Code,
  Briefcase,
  Lightbulb,
  Music,
  Palette,
  Globe,
  Calendar,
  Folder,
  GraduationCap,
  Pen,
} from "lucide-react";
import type { BoardColor, BoardIcon } from "../../../../board-document.types";

const colors: ReadonlyArray<{ id: BoardColor; label: string }> = [
  { id: "blue", label: "Синий" },
  { id: "teal", label: "Бирюзовый" },
  { id: "green", label: "Зелёный" },
  { id: "amber", label: "Янтарный" },
  { id: "orange", label: "Оранжевый" },
  { id: "red", label: "Красный" },
  { id: "violet", label: "Фиолетовый" },
  { id: "pink", label: "Розовый" },
];

const icons = {
  notebook: Notebook,
  book: BookOpen,
  calculator: Calculator,
  languages: Languages,
  flask: FlaskConical,
  atom: Atom,
  code: Code,
  briefcase: Briefcase,
  lightbulb: Lightbulb,
  music: Music,
  palette: Palette,
  globe: Globe,
  calendar: Calendar,
  folder: Folder,
  graduation: GraduationCap,
  pen: Pen,
};

const symbols: ReadonlyArray<{ id: BoardIcon; label: string }> = [
  { id: "notebook", label: "Блокнот" },
  { id: "book", label: "Книга" },
  { id: "calculator", label: "Калькулятор" },
  { id: "languages", label: "Языки" },
  { id: "flask", label: "Колба" },
  { id: "atom", label: "Атом" },
  { id: "code", label: "Код" },
  { id: "briefcase", label: "Портфель" },
  { id: "lightbulb", label: "Лампочка" },
  { id: "music", label: "Музыка" },
  { id: "palette", label: "Палитра" },
  { id: "globe", label: "Глобус" },
  { id: "calendar", label: "Календарь" },
  { id: "folder", label: "Папка" },
  { id: "graduation", label: "Учёба" },
  { id: "pen", label: "Перо" },
];

export const BoardCoverConfig = { colors, icons, symbols };
