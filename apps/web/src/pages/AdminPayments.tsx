import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  Loader2,
  Plus,
  ExternalLink,
  X,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Badge } from "@/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { api } from "@/lib/api.js";
import type {
  PaymentStatusResponse,
  PaymentItem,
  PaymentsListResponse,
  PaymentLinkResponse,
} from "@/lib/api.js";

// ── Status helpers ──────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<
  string,
  "default" | "pending" | "in_progress" | "completed" | "destructive"
> = {
  pending_submission: "pending",
  pending_customer_approval: "pending",
  submitted: "in_progress",
  confirmed: "completed",
  paid_out: "completed",
  cancelled: "destructive",
  customer_approval_denied: "destructive",
  failed: "destructive",
  charged_back: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending_submission: "En attente",
  pending_customer_approval: "Approbation",
  submitted: "Soumis",
  confirmed: "Confirmé",
  paid_out: "Payé",
  cancelled: "Annulé",
  customer_approval_denied: "Refusé",
  failed: "Échoué",
  charged_back: "Contesté",
};

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Create link dialog ──────────────────────────────────────────────────────────

interface CreateLinkDialogProps {
  onClose: () => void;
}

function CreateLinkDialog({ onClose }: CreateLinkDialogProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<PaymentLinkResponse>("/payments/links", {
        description,
        amount: Math.round(Number(amount) * 100),
        currency: "EUR",
        studentName: studentName || undefined,
        studentEmail: studentEmail || undefined,
      }),
    onSuccess: (data) => {
      setResultUrl(data.paymentUrl);
    },
  });

  const canSubmit =
    description.trim().length > 0 && Number(amount) >= 1 && !resultUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Créer un lien de paiement</CardTitle>
          <button
            onClick={onClose}
            className="text-meta hover:text-dark transition-colors"
          >
            <X size={18} />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {resultUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-meta">
                Lien de paiement créé avec succès. Partagez-le avec
                l&apos;étudiant :
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resultUrl}
                  className="flex-1 rounded-md border border-rule bg-slate-50 px-3 py-2 text-xs outline-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(resultUrl);
                    setCopied(true);
                    setTimeout(() => {
                      setCopied(false);
                    }, 2000);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="mr-1" />
                  Ouvrir le lien
                </a>
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-dark mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                  }}
                  placeholder="Frais d'inscription — Formation X"
                  className="w-full rounded-md border border-rule px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark mb-1">
                  Montant (EUR) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                  }}
                  placeholder="150.00"
                  className="w-full rounded-md border border-rule px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark mb-1">
                  Nom de l&apos;étudiant
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                  }}
                  className="w-full rounded-md border border-rule px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-dark mb-1">
                  Email de l&apos;étudiant
                </label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => {
                    setStudentEmail(e.target.value);
                  }}
                  className="w-full rounded-md border border-rule px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  createMutation.mutate();
                }}
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <Plus size={14} className="mr-2" />
                )}
                Créer le lien
              </Button>
              {createMutation.isError && (
                <p className="text-xs text-rose text-center">
                  Erreur lors de la création du lien
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Payment table ───────────────────────────────────────────────────────────────

function PaymentTable() {
  const [statusFilter, setStatusFilter] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const params = new URLSearchParams();
  if (statusFilter) {
    params.set("status", statusFilter);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }

  const { data, isLoading } = useQuery<PaymentsListResponse>({
    queryKey: ["payments", statusFilter, cursor],
    queryFn: () =>
      api.get<PaymentsListResponse>(
        `/payments${params.toString() ? `?${params.toString()}` : ""}`,
      ),
  });

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCursor(null);
            setPrevCursors([]);
          }}
          className="rounded-md border border-rule bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal/40"
        >
          <option value="">Tous les statuts</option>
          <option value="pending_submission">En attente</option>
          <option value="submitted">Soumis</option>
          <option value="confirmed">Confirmé</option>
          <option value="paid_out">Payé</option>
          <option value="cancelled">Annulé</option>
          <option value="failed">Échoué</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-meta">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (data?.payments.length ?? 0) === 0 && (
        <p className="text-center text-meta py-8">Aucun paiement trouvé</p>
      )}

      {/* Table */}
      {(data?.payments.length ?? 0) > 0 && (
        <div className="rounded-lg border border-rule bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-meta text-xs uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-2.5 font-medium text-meta text-xs uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-2.5 font-medium text-meta text-xs uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-4 py-2.5 font-medium text-meta text-xs uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-2.5 font-medium text-meta text-xs uppercase tracking-wider">
                  Référence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {(data?.payments ?? []).map((p: PaymentItem) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-dark">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-dark max-w-[200px] truncate">
                    {p.description || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-dark">
                    {formatAmount(p.amount, p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[p.status] ?? "default"}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-meta text-xs">
                    {p.reference || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={prevCursors.length === 0}
          onClick={() => {
            const newPrev = [...prevCursors];
            const prev = newPrev.pop();
            setPrevCursors(newPrev);
            setCursor(prev ?? null);
          }}
        >
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.nextCursor}
          onClick={() => {
            if (data?.nextCursor) {
              setPrevCursors((prev) => [...prev, cursor ?? ""]);
              setCursor(data.nextCursor);
            }
          }}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export function AdminPaymentsPage() {
  const [showCreate, setShowCreate] = useState(false);

  const { data: status, isLoading: statusLoading } =
    useQuery<PaymentStatusResponse>({
      queryKey: ["payments-status"],
      queryFn: () => api.get<PaymentStatusResponse>("/payments/status"),
    });

  if (statusLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-20 text-meta">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-dark mb-4 flex items-center gap-2">
          <CreditCard size={22} />
          Paiements
        </h1>
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader>
            <CardTitle>GoCardless non configuré</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-meta">
              Ajoutez les variables d&apos;environnement GoCardless
              (GOCARDLESS_ACCESS_TOKEN) pour activer les paiements.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-dark flex items-center gap-2">
          <CreditCard size={22} />
          Paiements
        </h1>
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(true);
          }}
        >
          <Plus size={14} className="mr-1" />
          Créer un lien
        </Button>
      </div>

      <PaymentTable />

      {showCreate && (
        <CreateLinkDialog
          onClose={() => {
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
