import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Search, Undo2 } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  AdminOrder,
  AdminOrdersResponse,
  CourseListResponse,
  UserSearchResponse,
  UserSearchResult,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import { Card, CardContent } from "@/components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { formatDateShort, formatPrice } from "@/lib/utils.js";
import { useDebounce } from "@/pages/users/shared.js";

type BadgeVariant =
  | "default"
  | "pending"
  | "in_progress"
  | "completed"
  | "rejected"
  | "destructive";

const STATUS: Record<
  AdminOrder["status"],
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "En attente", variant: "pending" },
  authorised: { label: "Autorisé", variant: "in_progress" },
  active: { label: "En cours", variant: "in_progress" },
  paid: { label: "Payé", variant: "completed" },
  failed: { label: "Échoué", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "destructive" },
  refunded: { label: "Remboursé", variant: "rejected" },
};

const PLAN_LABELS: Record<string, string> = {
  full: "Comptant",
  x3: "3 ×",
  x10: "10 ×",
  comp: "Offert",
};

function studentName(o: AdminOrder): string {
  const name = `${o.studentFirstName ?? ""} ${o.studentLastName ?? ""}`.trim();
  return name.length > 0 ? name : (o.studentEmail ?? "—");
}

// ── Comp-grant dialog ───────────────────────────────────────────────────────────

interface CompGrantDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

function CompGrantDialog({
  open,
  onOpenChange,
  onSuccess,
}: CompGrantDialogProps) {
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<UserSearchResult | null>(null);
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState("");
  const debounced = useDebounce(search, 300);

  const { data: searchData } = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () =>
      api.get<UserSearchResponse>(
        `/users/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.trim().length >= 2 && student === null,
  });

  const { data: coursesData } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<CourseListResponse>("/courses"),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/orders/comp", { studentId: student?.id, courseId }),
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Erreur lors de l'octroi.");
    },
  });

  const students = (searchData?.users ?? []).filter(
    (u) => u.role === "student",
  );
  const courses = coursesData?.courses ?? [];
  const canSubmit = student !== null && courseId.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accorder un accès complet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <p className="text-xs text-meta">
            Débloque l'intégralité d'une formation pour un apprenant, sans
            prélèvement (financement employeur / OPCO, virement…).
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="comp-student">Apprenant</Label>
            {student !== null ? (
              <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-sm">
                <span>
                  {student.firstName} {student.lastName}{" "}
                  <span className="text-meta">({student.email})</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-teal hover:underline"
                  onClick={() => {
                    setStudent(null);
                  }}
                >
                  Changer
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-meta"
                    aria-hidden="true"
                  />
                  <Input
                    id="comp-student"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    placeholder="Rechercher par nom ou email…"
                    className="pl-9"
                  />
                </div>
                {students.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-rule">
                    {students.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-cream/50"
                        onClick={() => {
                          setStudent(u);
                          setSearch("");
                        }}
                      >
                        <span className="font-medium text-dark">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="text-xs text-meta">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comp-course">Formation</Label>
            <select
              id="comp-course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
              }}
              className="h-11 w-full border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choisir une formation…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {error.length > 0 && <p className="text-xs text-rose">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Annuler
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => {
              setError("");
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Octroi…" : "Accorder l'accès"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABLE_HEADERS = [
  "Date",
  "Apprenant",
  "Formation",
  "Plan",
  "Montant",
  "Échéances",
  "Statut",
  "Action",
];

export function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [compOpen, setCompOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const [refundError, setRefundError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api.get<AdminOrdersResponse>("/orders"),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  const refundMutation = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/refund`, {}),
    onSuccess: () => {
      invalidate();
      setRefundOrder(null);
      setRefundError("");
    },
    onError: (err: unknown) => {
      setRefundError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark">Commandes</h1>
          <p className="mt-1 text-sm text-meta">
            {isLoading
              ? "Chargement…"
              : `${String(orders.length)} commande${orders.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCompOpen(true);
          }}
        >
          <Gift size={14} className="mr-2" />
          Accorder un accès
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-meta">Chargement…</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-sm text-meta">
              Aucune commande pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    {TABLE_HEADERS.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-meta"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-cream/50">
                      <td className="px-3 py-2 text-meta">
                        {formatDateShort(o.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="block font-medium text-dark">
                          {studentName(o)}
                        </span>
                        {o.studentEmail !== null && (
                          <span className="block text-xs text-meta">
                            {o.studentEmail}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-dark">
                        {o.courseTitle ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-meta">
                        {PLAN_LABELS[o.plan] ?? o.plan}
                      </td>
                      <td className="px-3 py-2 font-medium text-dark">
                        {formatPrice(o.amountCents, o.currency)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-meta">
                        {o.paymentsTotal > 0
                          ? `${String(o.paymentsConfirmed)}/${String(o.paymentsTotal)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS[o.status].variant}>
                          {STATUS[o.status].label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {o.status !== "refunded" &&
                          o.status !== "cancelled" &&
                          o.plan !== "comp" && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs text-meta transition-colors hover:text-rose"
                              onClick={() => {
                                setRefundError("");
                                setRefundOrder(o);
                              }}
                            >
                              <Undo2 size={13} aria-hidden="true" />
                              Rembourser
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CompGrantDialog
        open={compOpen}
        onOpenChange={setCompOpen}
        onSuccess={invalidate}
      />

      {refundOrder !== null && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setRefundOrder(null);
              setRefundError("");
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Rembourser la commande</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 px-6 py-4">
              <p className="text-sm text-dark">
                Annuler les prélèvements à venir et retirer l'accès complet de{" "}
                <span className="font-semibold">
                  {studentName(refundOrder)}
                </span>{" "}
                pour « {refundOrder.courseTitle ?? "cette formation"} » ?
              </p>
              <p className="text-xs text-meta">
                Les sommes déjà prélevées doivent être remboursées séparément
                par virement.
              </p>
              {refundError.length > 0 && (
                <p className="text-xs text-rose">{refundError}</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={refundMutation.isPending}
                onClick={() => {
                  refundMutation.mutate(refundOrder.id);
                }}
              >
                {refundMutation.isPending ? "Remboursement…" : "Rembourser"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
