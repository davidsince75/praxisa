import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api.js";
import type {
  CourseDetailResponse,
  CoursePricing,
  CreateOrderResponse,
  PurchasablePlan,
} from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { cn, formatPrice } from "@/lib/utils.js";

const PLAN_LABELS: Record<PurchasablePlan, string> = {
  full: "Paiement en une fois",
  x3: "3 mensualités",
  x10: "10 mensualités",
};

function BackToCatalog() {
  return (
    <Link
      to="/learn/catalog"
      className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors hover:text-dark"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      Retour au catalogue
    </Link>
  );
}

export function LearnBuyCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = courseId ?? "";
  const [plan, setPlan] = useState<PurchasablePlan>("full");
  const [error, setError] = useState<string | null>(null);

  const { data: courseData } = useQuery({
    queryKey: ["course", id],
    queryFn: () => api.get<CourseDetailResponse>(`/courses/${id}`),
    enabled: id.length > 0,
  });

  const { data: pricing, isLoading } = useQuery({
    queryKey: ["course-pricing", id],
    queryFn: () => api.get<CoursePricing>(`/courses/${id}/pricing`),
    enabled: id.length > 0,
  });

  const orderMutation = useMutation({
    mutationFn: () =>
      api.post<CreateOrderResponse>("/orders", { courseId: id, plan }),
    onSuccess: (res) => {
      // Hand off to the GoCardless hosted authorisation page.
      window.location.assign(res.authorisationUrl);
    },
    onError: (err: unknown) => {
      setError(
        err instanceof Error
          ? err.message
          : "Le paiement n'a pas pu être lancé.",
      );
    },
  });

  const courseTitle = courseData?.course.title ?? "Formation";
  const currency = pricing?.currency ?? "EUR";
  const plans = pricing?.plans ?? [];
  const selected = plans.find((p) => p.plan === plan);

  const notForSale =
    !isLoading &&
    (pricing === undefined ||
      !pricing.forSale ||
      pricing.priceCents === null ||
      plans.length === 0);

  if (notForSale) {
    return (
      <div className="max-w-2xl space-y-4">
        <BackToCatalog />
        <Card>
          <CardContent className="p-8 text-center text-sm text-meta">
            Cette formation n'est pas disponible à l'achat.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackToCatalog />

      <div>
        <h1 className="text-2xl font-semibold text-dark">Accès complet</h1>
        <p className="mt-1 text-sm text-meta">{courseTitle}</p>
      </div>

      {pricing?.priceCents != null && (
        <p className="font-display text-4xl tracking-tight text-dark">
          {formatPrice(pricing.priceCents, currency)}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Choisir un plan de paiement"
        className="space-y-3"
      >
        {plans.map((p) => {
          const isSelected = p.plan === plan;
          return (
            <button
              key={p.plan}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                setPlan(p.plan);
              }}
              className={cn(
                "flex min-h-[44px] w-full items-center justify-between rounded-lg border px-5 py-4 text-left transition-colors",
                isSelected
                  ? "border-teal bg-teal/5"
                  : "border-rule hover:border-teal/50",
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    isSelected ? "border-teal" : "border-meta",
                  )}
                >
                  {isSelected && (
                    <span className="h-2.5 w-2.5 rounded-full bg-teal" />
                  )}
                </span>
                <span>
                  <span className="block font-semibold text-dark">
                    {PLAN_LABELS[p.plan]}
                  </span>
                  {p.instalments > 1 && (
                    <span className="block text-xs text-meta">
                      {String(p.instalments)} ×{" "}
                      {formatPrice(p.perInstalmentCents, currency)} / mois
                    </span>
                  )}
                </span>
              </span>
              <span className="font-semibold text-dark">
                {formatPrice(p.totalCents, currency)}
              </span>
            </button>
          );
        })}
      </div>

      {error !== null && <p className="text-sm text-rose">{error}</p>}

      <Button
        size="lg"
        className="w-full"
        disabled={orderMutation.isPending || selected === undefined}
        onClick={() => {
          setError(null);
          orderMutation.mutate();
        }}
      >
        {orderMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Redirection…
          </>
        ) : (
          "Payer par prélèvement bancaire"
        )}
      </Button>

      <p className="flex items-center gap-2 text-xs text-meta">
        <ShieldCheck size={14} aria-hidden="true" />
        Paiement sécurisé par prélèvement SEPA via GoCardless. Un mandat vous
        sera demandé.
      </p>
    </div>
  );
}
