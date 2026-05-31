import { PlanType } from "@prisma/client";
declare const router: import("express-serve-static-core").Router;
export declare const PLAN_KEY_MAP: Record<string, {
    amount: number;
    planType: PlanType;
    validityDays: number;
    label: string;
}>;
export declare const PRICE_MAP: Record<string, {
    amount: number;
    planType: PlanType;
    validityDays: number;
    label: string;
}>;
export default router;
//# sourceMappingURL=razorpay.routes.d.ts.map