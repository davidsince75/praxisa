import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api } from "@/lib/api.js";
import type { InvoiceResponse } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { formatDateShort, formatPrice } from "@/lib/utils.js";

const PLAN_LABELS: Record<string, string> = {
  full: "Paiement comptant",
  x3: "Paiement en 3 fois",
  x10: "Paiement en 10 fois",
  comp: "Accès offert",
};

export function LearnInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const id = invoiceId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get<InvoiceResponse>(`/invoices/${id}`),
    enabled: id.length > 0,
  });

  if (isLoading) {
    return <p className="text-sm text-meta">Chargement…</p>;
  }
  if (error !== null || data === undefined) {
    return <p className="text-sm text-rose">Facture introuvable.</p>;
  }

  const inv = data.invoice;
  const studentName =
    `${inv.studentFirstName ?? ""} ${inv.studentLastName ?? ""}`.trim();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <Button
          size="sm"
          onClick={() => {
            window.print();
          }}
        >
          <Printer size={14} className="mr-2" aria-hidden="true" />
          Imprimer / Enregistrer en PDF
        </Button>
      </div>

      <div className="rounded-lg border border-rule bg-white p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-dark">Facture</h1>
            <p className="mt-1 text-sm text-meta">{inv.number}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-dark">{inv.issuer.name}</p>
            <p className="text-meta">{inv.issuer.legalName}</p>
            <p className="text-meta">{inv.issuer.address}</p>
            <p className="text-meta">SIRET : {inv.issuer.siret}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-meta">
              Facturé à
            </p>
            <p className="mt-1 font-medium text-dark">
              {studentName.length > 0 ? studentName : "—"}
            </p>
            {inv.studentEmail !== null && (
              <p className="text-meta">{inv.studentEmail}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-meta">
              Date d'émission
            </p>
            <p className="mt-1 text-dark">{formatDateShort(inv.issuedAt)}</p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs uppercase tracking-wider text-meta">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule">
              <td className="py-3 text-dark">
                Formation — {inv.courseTitle ?? "—"}
                <span className="block text-xs text-meta">
                  {PLAN_LABELS[inv.plan] ?? inv.plan}
                </span>
              </td>
              <td className="py-3 text-right text-dark">
                {formatPrice(inv.totalCents, inv.currency)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="py-3 text-right font-semibold text-dark">Total</td>
              <td className="py-3 text-right font-semibold text-dark">
                {formatPrice(inv.totalCents, inv.currency)}
              </td>
            </tr>
          </tfoot>
        </table>

        {inv.vatNote !== null && (
          <p className="mt-4 text-xs text-meta">{inv.vatNote}</p>
        )}
      </div>
    </div>
  );
}
