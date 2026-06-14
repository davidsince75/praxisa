// Commerce — course pricing + checkout response types.
// Split out of lib/api.ts; consumed via re-export from @/lib/api.

export type PurchasablePlan = "full" | "x3" | "x10";

export interface PricingPlanOption {
  plan: PurchasablePlan;
  instalments: number;
  perInstalmentCents: number;
  scheduleCents: number[];
  totalCents: number;
}

export interface CoursePricing {
  forSale: boolean;
  priceCents: number | null;
  currency: string;
  plans: PricingPlanOption[];
}

export interface CreateOrderResponse {
  orderId: string;
  plan: PurchasablePlan;
  amountCents: number;
  currency: string;
  authorisationUrl: string;
}

// ── Admin orders dashboard ───────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "authorised"
  | "active"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface AdminOrder {
  id: string;
  studentId: string;
  courseId: string;
  amountCents: number;
  currency: string;
  plan: PurchasablePlan | "comp";
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string | null;
  courseTitle: string | null;
  paymentsConfirmed: number;
  paymentsTotal: number;
}

export interface AdminOrdersResponse {
  orders: AdminOrder[];
}
