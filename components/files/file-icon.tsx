import { File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileType, FileVideo, Folder, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileCategory } from "@/lib/files/names";

const ICONS: Record<FileCategory, { icon: typeof File; color: string }> = {
  folder: { icon: Folder, color: "text-sky-500" },
  image: { icon: FileImage, color: "text-pink-500" },
  video: { icon: FileVideo, color: "text-violet-500" },
  audio: { icon: FileAudio, color: "text-indigo-500" },
  pdf: { icon: FileType, color: "text-red-500" },
  text: { icon: FileText, color: "text-neutral-500" },
  document: { icon: FileText, color: "text-blue-600" },
  spreadsheet: { icon: FileSpreadsheet, color: "text-emerald-600" },
  presentation: { icon: Presentation, color: "text-orange-500" },
  archive: { icon: FileArchive, color: "text-amber-600" },
  other: { icon: File, color: "text-neutral-400" },
};

export function FileIcon({ category, className }: { category: FileCategory; className?: string }) {
  const { icon: Icon, color } = ICONS[category];
  return <Icon className={cn(color, className)} aria-hidden />;
}
