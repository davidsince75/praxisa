import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";
import type { LessonItem, ModuleWithLessons } from "@/lib/api.js";
import { cn } from "@/lib/utils.js";
import { CONTENT_TYPE_ICONS, CONTENT_TYPE_LABELS } from "./shared.js";
import type { ProgressStatus } from "./shared.js";

// ── Lesson sidebar item ────────────────────────────────────────────────────────

interface LessonNavItemProps {
  lesson: LessonItem;
  status: ProgressStatus;
  isActive: boolean;
  onClick: () => void;
}

export function LessonNavItem({
  lesson,
  status,
  isActive,
  onClick,
}: LessonNavItemProps) {
  const Icon = CONTENT_TYPE_ICONS[lesson.contentType];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors",
        isActive ? "bg-teal/10 text-dark" : "hover:bg-cream/60 text-meta",
      )}
    >
      <span className="mt-0.5 flex-shrink-0">
        {status === "completed" ? (
          <CheckCircle2 size={13} className="text-teal" />
        ) : status === "in_progress" ? (
          <PlayCircle size={13} className="text-olive" />
        ) : (
          <Circle size={13} className="text-meta/40" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="text-xs font-medium leading-snug block truncate">
          {lesson.title}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-meta/60 mt-0.5">
          <Icon size={10} />
          {CONTENT_TYPE_LABELS[lesson.contentType]}
          {lesson.durationMinutes !== null && (
            <span> · {String(lesson.durationMinutes)} min</span>
          )}
        </span>
      </span>
    </button>
  );
}

// ── Module nav section ─────────────────────────────────────────────────────────

interface ModuleNavSectionProps {
  mod: ModuleWithLessons;
  progressMap: Map<string, ProgressStatus>;
  activeLessonId: string | null;
  onLessonClick: (lesson: LessonItem) => void;
}

export function ModuleNavSection({
  mod,
  progressMap,
  activeLessonId,
  onLessonClick,
}: ModuleNavSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-rule hover:bg-cream/40 transition-colors"
      >
        {open ? (
          <ChevronDown size={12} className="text-meta flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-meta flex-shrink-0" />
        )}
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-dark truncate">
          {mod.title}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-rule/50">
          {mod.lessons.map((les) => (
            <LessonNavItem
              key={les.id}
              lesson={les}
              status={progressMap.get(les.id) ?? "not_started"}
              isActive={activeLessonId === les.id}
              onClick={() => {
                onLessonClick(les);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
