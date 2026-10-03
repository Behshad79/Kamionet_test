/** Persian labels + tones for every enum the back office shows (no raw English codes in the UI). */
type Tone = "ok" | "warn" | "danger" | "info" | "neutral";
const m = <T extends Record<string, [string, Tone]>>(x: T) => x;

export const PAYMENT_STATUS = m({
  PENDING: ["در انتظار", "warn"], PROCESSING: ["در حال پردازش", "warn"], SUCCEEDED: ["موفق", "ok"], FAILED: ["ناموفق", "danger"], EXPIRED: ["منقضی", "neutral"],
  REFUNDED: ["بازپرداخت‌شده", "info"], PARTIAL_REFUND: ["بازپرداخت جزئی", "info"], AWAITING_VERIFICATION: ["در انتظار تأیید رسید", "warn"],
});
export const PAYMENT_PURPOSE: Record<string, string> = { topup: "شارژ کیف پول", deposit: "بیعانه", balance: "مابقی کرایه", tip: "انعام", mismatch_delta: "مابه‌التفاوت مغایرت", debt: "تسویه‌ی بدهی", fee: "جریمه" };
export const PAYMENT_METHOD: Record<string, string> = { wallet: "کیف پول", card: "کارت بانکی", split: "ترکیبی", card2card: "کارت‌به‌کارت", paya: "پایا", credit: "اعتبار سازمانی" };
export const PAYOUT_STATUS = m({
  REQUESTED: ["ثبت‌شده", "neutral"], UNDER_REVIEW: ["در بررسی", "info"], APPROVED: ["تأییدشده", "info"], ON_HOLD: ["نگه‌داشته‌شده", "warn"], SENT: ["ارسال‌شده به بانک", "info"], SETTLED: ["واریزشده", "ok"], FAILED: ["ناموفق", "danger"],
});
export const BATCH_STATUS = m({ DRAFT: ["پیش‌نویس", "neutral"], APPROVED: ["تأییدشده", "info"], EXPORTED: ["فایل بانک آماده", "info"], SENT: ["ارسال‌شده", "warn"], RECONCILED: ["تطبیق‌شده", "ok"] });
export const REFUND_STATUS = m({ PENDING_APPROVAL: ["در انتظار تأیید", "warn"], APPROVED: ["تأییدشده", "info"], PAID: ["پرداخت‌شده", "ok"], REJECTED: ["ردشده", "danger"] });
export const DEBT_STATUS = m({ OPEN: ["باز", "warn"], PAID: ["تسویه‌شده", "ok"], PENDING_WRITEOFF: ["در انتظار سوخت", "info"], WRITTEN_OFF: ["سوخت‌شده", "neutral"] });
export const INVOICE_STATUS = m({ DRAFT: ["پیش‌نویس", "neutral"], ISSUED: ["صادرشده", "info"], PAID: ["پرداخت‌شده", "ok"], OVERDUE: ["سررسیدگذشته", "danger"], VOID: ["ابطال‌شده", "neutral"] });
export const INVOICE_KIND: Record<string, string> = { receipt: "رسید", tax_invoice: "فاکتور رسمی", credit_note: "اعتبار (برگشتی)", driver_statement: "صورت‌حساب راننده", monthly_statement: "صورت‌حساب ماهانه", insurer_settlement: "تسویه با بیمه‌گر" };
export const CLAIM_STATUS = m({ OPEN: ["باز", "warn"], REVIEW: ["در بررسی", "info"], APPROVED: ["تأییدشده", "info"], PAID: ["پرداخت‌شده", "ok"], REJECTED: ["ردشده", "danger"] });
export const RISK_STATUS = m({ OPEN: ["باز", "warn"], REVIEW: ["در بررسی", "info"], CLEARED: ["رفع‌شده", "ok"], CONFIRMED: ["تقلب تأییدشده", "danger"] });
export const lab = <T extends Record<string, [string, Tone]>>(map: T, k: string): [string, Tone] => (map as Record<string, [string, Tone]>)[k] ?? [k, "neutral"];
