import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
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

const colors: ReadonlyArray<{
  id: BoardColor;
  label: MessageTypes.Value;
}> = [
  { id: "blue", label: Messages.create("blue") },
  { id: "teal", label: Messages.create("teal") },
  { id: "green", label: Messages.create("green") },
  { id: "amber", label: Messages.create("amber") },
  { id: "orange", label: Messages.create("orange") },
  { id: "red", label: Messages.create("red") },
  { id: "violet", label: Messages.create("purple") },
  { id: "pink", label: Messages.create("pink") },
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

const symbols: ReadonlyArray<{
  id: BoardIcon;
  label: MessageTypes.Value;
}> = [
  { id: "notebook", label: Messages.create("notebook") },
  { id: "book", label: Messages.create("book") },
  { id: "calculator", label: Messages.create("calculator") },
  { id: "languages", label: Messages.create("languages") },
  { id: "flask", label: Messages.create("flask") },
  { id: "atom", label: Messages.create("atom") },
  { id: "code", label: Messages.create("code") },
  { id: "briefcase", label: Messages.create("briefcase") },
  { id: "lightbulb", label: Messages.create("lightBulb") },
  { id: "music", label: Messages.create("music") },
  { id: "palette", label: Messages.create("palette") },
  { id: "globe", label: Messages.create("globe") },
  { id: "calendar", label: Messages.create("calendar") },
  { id: "folder", label: Messages.create("folder") },
  { id: "graduation", label: Messages.create("study") },
  { id: "pen", label: Messages.create("pen") },
];

export const BoardCoverConfig = { colors, icons, symbols };
