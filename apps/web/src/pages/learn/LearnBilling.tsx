import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { api } from "@/lib/api.js";
import type { MyOrdersResponse } from "@/lib/api.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { formatDateShort, formatPrice } from "@/lib/utils.js";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  authorised: "Autorisé",
  active: "En cours",
  paid: "Payé",
  failed: "Échoué",
  cancelled: "Annulé",
  refunded: "Remboursé",
};

const PLAN_LABELS: Record<string, string> = {
  full: "Comptant",
  x3: "3 ×",
  x10: "10 ×",
  comp: "Offert",
};

const TABLE_HEADERS = [
  "Date",
  "Formation",
  "Plan",
  "Montant",
  "Statut",
  "Facture",
];

export function LearnBillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api.get<MyOrdersResponse>("/orders/my"),
  });

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark">Facturation</h1>
        <p className="mt-1 text-sm text-meta">Vos achats et vos factures.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-meta">Chargement…</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-sm text-meta">Aucun achat pour le moment.</p>
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
                      <td className="px-3 py-2 text-dark">
                        {o.courseTitle ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-meta">
                        {PLAN_LABELS[o.plan] ?? o.plan}
                      </td>
                      <td className="px-3 py-2 font-medium text-dark">
                        {formatPrice(o.amountCents, o.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="default">
                          {STATUS_LABELS[o.status] ?? o.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {o.invoiceId !== null ? (
                          <Link
                            to={`/learn/invoices/${o.invoiceId}`}
                            className="inline-flex items-center gap-1 text-teal hover:underline"
                          >
                            <FileText size={13} aria-hidden="true" />
                            {o.invoiceNumber}
                          </Link>
                        ) : (
                          <span className="text-meta">—</span>
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
    </div>
  );
}
