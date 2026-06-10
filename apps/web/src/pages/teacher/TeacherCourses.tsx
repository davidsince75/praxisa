import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Users, Wrench, Globe, Rocket } from "lucide-react";
import { api } from "@/lib/api.js";
import type { CourseListResponse } from "@/lib/api.js";
import { useAuth } from "@/hooks/useAuth.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";

const STATUS_LABELS = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

function statusVariant(status: string) {
  if (status === "published") return "completed" as const;
  if (status === "archived") return "rejected" as const;
  return "pending" as const;
}

export function TeacherCoursesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const publishMutation = useMutation({
    mutationFn: (courseId: string) =>
      api.post(`/courses/${courseId}/publish`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const myCourses = (data?.courses ?? []).filter(
    (c) => c.instructorId === user?.id,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Mes cours</h1>
        <p className="text-meta text-sm mt-1">
          {isLoading
            ? "Chargement…"
            : `${String(myCourses.length)} cours assigné${myCourses.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-meta text-sm">Chargement…</p>
      ) : myCourses.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <BookOpen size={32} className="text-meta" />
            <p className="text-meta text-sm">
              Aucun cours assigné pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {myCourses.map((course) => (
            <Card key={course.id}>
              <CardContent className="p-0">
                <div className="flex items-start justify-between px-6 py-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded bg-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <BookOpen size={18} className="text-teal" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-dark truncate">
                          {course.title}
                        </h2>
                        <Badge variant={statusVariant(course.status)}>
                          {STATUS_LABELS[course.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-meta font-mono mt-0.5">
                        {course.slug}
                      </p>
                      {course.description !== null && (
                        <p className="text-sm text-meta mt-1.5 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-meta">
                        <Globe size={11} />
                        {course.language.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {course.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={publishMutation.isPending}
                        onClick={() => {
                          publishMutation.mutate(course.id);
                        }}
                      >
                        <Rocket size={13} className="mr-1.5" />
                        Publier
                      </Button>
                    )}
                    <Link to={`/teacher/courses/${course.id}`}>
                      <Button size="sm" variant="outline">
                        <Users size={13} className="mr-1.5" />
                        Apprenants
                      </Button>
                    </Link>
                    <Link to={`/teacher/courses/${course.id}/builder`}>
                      <Button size="sm">
                        <Wrench size={13} className="mr-1.5" />
                        Contenu
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
