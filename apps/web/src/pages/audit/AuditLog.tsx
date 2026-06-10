import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.js";
import type { AuditEventsResponse } from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Input } from "@/components/ui/input.js";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import { formatDate } from "@/lib/utils.js";

const PAGE_SIZE = 50;

// Colour-code by event type prefix
function eventVariant(
  eventType: string,
):
  | "default"
  | "destructive"
  | "completed"
  | "pending"
  | "in_progress"
  | "rejected" {
  if (eventType.startsWith("gdpr.erasure")) return "rejected";
  if (eventType.startsWith("gdpr.")) return "pending";
  if (eventType.startsWith("auth.")) return "in_progress";
  if (eventType.includes("completed")) return "completed";
  return "default";
}

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [actorFilter, setActorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
    ...(actorFilter.trim() !== "" ? { actorUserId: actorFilter.trim() } : {}),
    ...(typeFilter.trim() !== "" ? { eventType: typeFilter.trim() } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, actorFilter, typeFilter],
    queryFn: () =>
      api.get<AuditEventsResponse>(`/audit/events?${params.toString()}`),
  });

  const totalPages =
    data !== undefined
      ? data.pagination.count < PAGE_SIZE
        ? page + 1
        : page + 2
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Journal d'audit</h1>
        <p className="text-meta text-sm mt-1">
          Trace immuable de toutes les actions système
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Filtrer par acteur (user ID)"
          value={actorFilter}
          onChange={(e) => {
            setActorFilter(e.target.value);
            setPage(0);
          }}
          className="max-w-xs text-sm"
        />
        <Input
          placeholder="Filtrer par type (ex: gdpr.erasure)"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(0);
          }}
          className="max-w-xs text-sm"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && <p className="text-meta text-sm p-6">Chargement…</p>}
          {!isLoading && data?.events.length === 0 && (
            <p className="text-meta text-sm p-6">Aucun événement.</p>
          )}

          {/* Header */}
          {(data?.events.length ?? 0) > 0 && (
            <div className="grid grid-cols-12 px-6 py-2 border-b border-rule bg-cream">
              <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-meta">
                Date
              </span>
              <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-meta">
                Type
              </span>
              <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-meta">
                Entité
              </span>
              <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-meta">
                Acteur
              </span>
            </div>
          )}

          <ul className="divide-y divide-rule">
            {data?.events.map((ev) => (
              <li
                key={ev.id}
                className="grid grid-cols-12 px-6 py-3 items-center hover:bg-cream/50 transition-colors"
              >
                <span className="col-span-3 text-xs text-meta">
                  {formatDate(ev.eventAt)}
                </span>
                <span className="col-span-3">
                  <Badge variant={eventVariant(ev.eventType)}>
                    {ev.eventType}
                  </Badge>
                </span>
                <span className="col-span-3 text-xs text-dark font-mono">
                  {ev.entityType}/{ev.entityId.slice(0, 8)}…
                </span>
                <span className="col-span-3 text-xs text-meta font-mono">
                  {ev.actorUserId !== null
                    ? ev.actorUserId.slice(0, 8) + "…"
                    : "system"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-meta">
            Page {page + 1} · {data?.pagination.count ?? 0} résultats
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => {
                setPage((p) => p - 1);
              }}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => {
                setPage((p) => p + 1);
              }}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
