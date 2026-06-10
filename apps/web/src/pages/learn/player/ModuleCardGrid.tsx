import { BookOpen, Lock } from "lucide-react";
import type { ModuleWithLessons } from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { cn } from "@/lib/utils.js";
import type { ProgressStatus } from "./shared.js";

// ── Module card grid ──────────────────────────────────────────────────────────

interface ModuleCardGridProps {
  modules: ModuleWithLessons[];
  progressMap: Map<string, ProgressStatus>;
  lockedModuleIds?: Set<string>;
  onModuleClick: (moduleId: string) => void;
}

export function ModuleCardGrid({
  modules,
  progressMap,
  lockedModuleIds,
  onModuleClick,
}: ModuleCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {modules.map((mod) => {
        const total = mod.lessons.length;
        const done = mod.lessons.filter(
          (l) => progressMap.get(l.id) === "completed",
        ).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const isLocked = lockedModuleIds?.has(mod.id) === true;

        return (
          <Card
            key={mod.id}
            className={cn(
              "transition-all",
              isLocked
                ? "opacity-60 cursor-not-allowed"
                : "cursor-pointer hover:shadow-md hover:border-teal/40",
            )}
            onClick={() => {
              if (!isLocked) onModuleClick(mod.id);
            }}
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 p-2 rounded-lg flex-shrink-0",
                    isLocked ? "bg-meta/10" : "bg-teal/10",
                  )}
                >
                  {isLocked ? (
                    <Lock size={16} className="text-meta" />
                  ) : (
                    <BookOpen size={16} className="text-teal" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-dark leading-snug">
                    {mod.title}
                  </h3>
                  {mod.description !== null && mod.description.length > 0 && (
                    <p className="text-xs text-meta mt-1 line-clamp-2">
                      {mod.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-meta">
                    {String(done)} / {String(total)} leçon
                    {total !== 1 ? "s" : ""}
                  </span>
                  <span className="font-medium text-dark tabular-nums">
                    {String(pct)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-rule rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct === 100 ? "bg-teal" : "bg-olive",
                    )}
                    style={{ width: `${String(pct)}%` }}
                  />
                </div>
              </div>

              {pct === 100 && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal">
                  Terminé
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
