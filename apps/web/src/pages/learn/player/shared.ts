import {
  FileText,
  Video,
  File,
  Music,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { LessonContentType } from "@/lib/api.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProgressStatus = "not_started" | "in_progress" | "completed";

// ── Content-type icon map ──────────────────────────────────────────────────────

export const CONTENT_TYPE_ICONS: Record<LessonContentType, LucideIcon> = {
  text: FileText,
  video: Video,
  pdf: File,
  audio: Music,
  quiz: HelpCircle,
};

export const CONTENT_TYPE_LABELS: Record<LessonContentType, string> = {
  text: "Texte",
  video: "Vidéo",
  pdf: "PDF",
  audio: "Audio",
  quiz: "Quiz",
};
