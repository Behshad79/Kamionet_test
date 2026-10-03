/* ───────────────────────── Kamionet domain model v3 ─────────────────────────
 * All money is integer RIAL. Display converts to Toman via lib/money.ts.
 * Person ≠ profile: one Person may own a ShipperProfile and/or a DriverProfile,
 * but a session belongs to exactly one portal (no in-session role switch).
 */

export type Rial = number;
export type PortalId = "shipper" | "driver" | "admin";

/* ───── People & profiles ───── */

export interface Person {
  id: string;
  phone: string;
  name: string;
  nationalId?: string;
  birthDate?: string;
  createdAt: number;
}

export interface Note {
  id: string;
  at: number;
  by: string;
  text: string;
}

export interface ShipperControls {
  creditLimit: Rial;
  creditTermsDays: 0 | 15 | 30;
  invoiceCycle: "order" | "weekly" | "monthly";
  blockCardToCard: boolean;
  depositPctOverride?: number;
  cashToDriver: boolean;
  couponEligible: boolean;
  walletFrozen: boolean;
  refundLimit?: Rial;
  blocked: boolean;
}

export interface ShipperProfile {
  personId: string;
  displayName: string;
  company?: { name: string; economicCode?: string; sector?: string };
  businessVerified: boolean;
  memberSince: number;
  favorites: string[];
  cargoCategories: CargoKind[];
  controls: ShipperControls;
  honesty: number;
  prefs: { autoPayDeposit: boolean; refundTo: "wallet" | "card"; quietHours: boolean; notify: Record<string, boolean> };
  referralCode: string;
  /** Saved warehouse address with an exact pin. */
  address?: { text: string; lat: number; lng: number };
  logo?: string;
  verifyDoc?: { dataUrl: string; at: number; status: "pending" | "approved" | "rejected"; note?: string };
  loyaltyTier: "bronze" | "silver" | "gold";
  autoRecharge?: { threshold: Rial; amount: Rial };
  notes: Note[];
  hue: number;
}

export type VehicleKind = "pickup" | "nissan" | "kamionet" | "khavar" | "truck10" | "dahcharkh" | "trailer" | "dry";
export type Silhouette = "pickup" | "small" | "mid" | "heavy" | "trailer";
export type OdorClass = "NONE" | "LOW" | "STRONG";
export type PlateVariant = "private" | "public" | "commercial";

export interface Plate {
  two: string;
  letter: string;
  three: string;
  prov: string;
  variant: PlateVariant;
}

export interface Vehicle {
  kind: VehicleKind;
  /** Sub-brand for pickups: pride | zamyad | mazda. */
  model?: string;
  capacityKg: Rial | number;
  color: string;
  plate: Plate | null;
  /** Lowest temperature the fridge can hold; null = no refrigeration unit. */
  minTemp: number | null;
  canRunAmbient: boolean;
  fridgeBrand: string;
  lastServiceAt?: number;
  lastCargoOdor: OdorClass;
  lastWashAt?: number;
  year?: number;
}

export type DocKey =
  | "nationalFront" | "nationalBack" | "selfie" | "license" | "smartCard"
  | "regFront" | "regBack" | "insurance" | "inspection" | "carExterior" | "carInterior";

export interface DocFile {
  dataUrl?: string;
  expiresAt?: number;
  /** A staff member has looked at the uploaded image. */
  reviewed?: boolean;
}

export type KycStatus = "none" | "draft" | "pending" | "rejected" | "verified";

export interface Strike {
  id: string;
  at: number;
  kind: "warning" | "late" | "cancel" | "offplatform" | "temp" | "document" | "behavior";
  points: number;
  reason: string;
  orderId?: string;
}

export interface DeclaredTrip {
  id: string;
  /** Outbound leg the driver is already doing (or plans). */
  from: string;
  to: string;
  departAt: number;
  /** Where the driver wants to end up after unloading (backhaul target). */
  backTo: string;
  backAt?: number;
  active: boolean;
}

export interface DriverControls {
  walletFrozen: boolean;
  payoutHold: boolean;
  commissionOverride?: number;
  cashToDriver: boolean;
  maxDebt: Rial;
  instantPayout: boolean;
  incentiveEligible: boolean;
  /** Automatic Pro invitations (default on). */
  autoPro?: boolean;
}

export interface DriverProfile {
  personId: string;
  kyc: {
    status: KycStatus;
    step: number;
    submittedAt?: number;
    rejectedAt?: number;
    rejectReasons?: string[];
    reviewer?: string;
    idMatch: { status: "idle" | "ok" | "mismatch"; attempts: number; lastAt?: number };
  };
  vehicle: Vehicle;
  docs: Partial<Record<DocKey, DocFile>>;
  iban?: { sheba: string; holder: string; holderMatches: boolean; addedAt: number };
  pro: { status: "none" | "invited" | "pro" | "revoked"; invitedAt?: number; since?: number; inspection: "none" | "scheduled" | "passed" | "failed"; inspectionAt?: number; inspectionCenter?: string; inspectionNote?: string; grantedBy?: string };
  suspension?: { reason: string; since: number; appeal: "none" | "open" | "rejected" | "accepted"; appealText?: string };
  strikes: Strike[];
  clean: { score: number; badgeUntil?: number; lastWashAt?: number };
  controls: DriverControls;
  declaredTrips: DeclaredTrip[];
  online: boolean;
  lastLoc?: { lat: number; lng: number; at: number };
  referralCode: string;
  notes: Note[];
  createdAt: number;
  /** Seed-only: precomputed lifetime stats for generated drivers without full order history. */
  base?: { trips: number; rating: number; onTime: number };
}

export type AdminRole = "super" | "ops" | "support" | "kyc" | "finance_mgr" | "finance_op" | "wallet_support" | "accountant";

export interface AdminUser {
  id: string;
  phone: string;
  name: string;
  role: AdminRole;
  twoFA: boolean;
  active: boolean;
  createdAt: number;
  devices: { id: string; label: string; lastAt: number; current?: boolean }[];
}

/* ───── Places & cargo ───── */

export interface Place {
  city: string;
  province?: string;
  lat: number;
  lng: number;
  address: string;
}

export type CargoMode = "REFRIGERATED" | "AMBIENT";
export type CargoKind = "dairy" | "meat" | "fish" | "produce" | "icecream" | "pharma" | "dry" | "other";
export type ServiceClass = "STANDARD" | "PRO";
export type AssignMode = "OPEN" | "PRO_POOL" | "DIRECT" | "SMART";
export type PayTerms = "PREPAID" | "DEPOSIT_BALANCE_BEFORE_LOADING" | "DEPOSIT_BALANCE_AFTER_DELIVERY" | "CASH_BALANCE_TO_DRIVER";

export type OrderStatus =
  | "DRAFT" | "OPEN" | "PRO_POOL" | "DIRECT_REQUESTED" | "LOCKED" | "AWAITING_DEPOSIT" | "ASSIGNED"
  | "EN_ROUTE_TO_PICKUP" | "AT_PICKUP" | "MISMATCH_REVIEW" | "IN_TRANSIT" | "AT_DELIVERY"
  | "DELIVERED" | "COMPLETED"
  | "CANCELLED_BY_SHIPPER" | "CANCELLED_BY_DRIVER" | "CANCELLED_BY_SYSTEM" | "EXPIRED" | "DISPUTED";

export interface Media {
  kind: "cargo" | "invoice_pickup" | "invoice_delivery" | "mismatch" | "wash_before" | "wash_after";
  dataUrl: string;
  takenAt: number;
  lat: number;
  lng: number;
  items?: number;
}

export interface OrderFlag {
  note: string;
  by: string;
  at: number;
  status: "open" | "resolved";
}

export interface WaybillVersion {
  v: number;
  at: number;
  reason: string;
  weightKg: number;
  volumeM3?: number;
  pallets?: number;
  cargo: CargoKind;
  declaredValue: Rial;
  freight: Rial;
  insurancePremium: Rial;
  supersededAt?: number;
}

export interface OrderEvent {
  at: number;
  from?: OrderStatus;
  to: OrderStatus;
  by: string;
  note?: string;
}

export interface Buckets {
  insurance: Rial;
  vat: Rial;
  tip: Rial;
  freight: Rial;
  waiting: Rial;
}

export interface Order {
  id: string;
  groupId: string;
  groupIndex: number;
  groupSize: number;
  shipperId: string;
  driverId?: string;
  status: OrderStatus;
  /** Pool the order returns to when a lock/deposit/request lapses. */
  pool: "OPEN" | "PRO_POOL";
  origin: Place;
  dest: Place;
  distanceKm: number;
  pickupAt: number;
  pickupTo: number;
  deliverBy: number;

  cargoMode: CargoMode;
  cargo: CargoKind;
  odor: OdorClass;
  odorSensitive: boolean;
  tempMin?: number;
  tempMax?: number;
  vehicleKind: VehicleKind;
  weightKg: number;
  volumeM3?: number;
  pallets?: number;
  packaging: string;
  itemizedInvoice: boolean;
  declaredValue: Rial;
  note?: string;
  cleanOnly: boolean;

  serviceClass: ServiceClass;
  assignMode: AssignMode;
  directDriverId?: string;
  directExpiresAt?: number;
  directDeclined?: string[];

  /** Fare for this vehicle (includes Pro uplift). */
  freight: Rial;
  proUpliftPct: number;
  insurance: { productId: string | null; premium: Rial; coverage: Rial; deductible: Rial };
  tipPre: Rial;
  tipPost: Rial;
  discount: Rial;
  couponCode?: string;
  vat: Rial;

  terms: PayTerms;
  depositPct: number;
  depositRequired: Rial;
  paid: Buckets;
  autoPayDeposit: boolean;
  /** Part of the freight the parties agreed to settle in cash with the driver. */
  cashAgreed: Rial;
  cash?: { driverDeclared?: Rial; shipperConfirmed?: Rial; status: "none" | "pending" | "matched" | "mismatch" };

  lockedBy?: string;
  lockedUntil?: number;
  depositDueAt?: number;
  redispatch?: boolean;
  /** Drivers who confirmed but whose deposit never arrived (auto-cancel after the configured limit). */
  depositMisses?: number;

  assignedAt?: number;
  departedAt?: number;
  deadheadKm?: number;
  arrivedPickupAt?: number;
  loadedAt?: number;
  arrivedDeliveryAt?: number;
  deliveredAt?: number;
  completedAt?: number;
  waitFee: Rial;
  discountPosted?: boolean;
  forceExcursionAt?: number;

  consignee: { name: string; phone: string; token: string; otp: string };
  waybills: WaybillVersion[];
  mismatchId?: string;
  media: Media[];
  flag?: OrderFlag;
  events: OrderEvent[];
  cancel?: { by: "shipper" | "driver" | "system"; at: number; reason: string; fee: Rial; driverComp: Rial; platformFee: Rial; refund: Rial };
  settlement?: { at: number; commission: Rial; commissionDebt: Rial; driverNet: Rial; releaseAt: number; released: boolean; held: boolean };
  templateId?: string;
  createdAt: number;
}

export interface OrderInput {
  origin: Place;
  dest: Place;
  pickupAt: number;
  pickupTo: number;
  deliverBy: number;
  count: number;
  cargoMode: CargoMode;
  cargo: CargoKind;
  odor: OdorClass;
  odorSensitive: boolean;
  tempMin?: number;
  tempMax?: number;
  vehicleKind: VehicleKind;
  weightKg: number;
  volumeM3?: number;
  pallets?: number;
  packaging: string;
  itemizedInvoice: boolean;
  declaredValue: Rial;
  note?: string;
  cleanOnly: boolean;
  serviceClass: ServiceClass;
  assignMode: AssignMode;
  directDriverId?: string;
  /** Fare the shipper offers, before the Pro uplift. */
  freightBase: Rial;
  tipPre: Rial;
  insuranceProductId: string | null;
  coveragePct: number;
  couponCode?: string;
  terms: PayTerms;
  autoPayDeposit: boolean;
  consignee: { name: string; phone: string };
}

export interface Template {
  id: string;
  shipperId: string;
  cadence: "daily" | "weekly";
  hour: number;
  active: boolean;
  nextRunAt: number;
  windowMs: number;
  deliverAfterMs: number;
  draft: Omit<OrderInput, "pickupAt" | "pickupTo" | "deliverBy">;
}

/* ───── Mismatch ───── */

export type MismatchType = "weight_up" | "volume_up" | "pallets_up" | "cargo_type" | "temperature" | "packaging" | "quantity_down" | "odor_hazard";
export type MismatchStatus = "PENDING_SHIPPER" | "COUNTERED" | "APPROVED" | "REJECTED" | "ESCALATED" | "RESOLVED_DRIVER" | "RESOLVED_SHIPPER" | "SPLIT";

export interface Mismatch {
  id: string;
  orderId: string;
  driverId: string;
  shipperId: string;
  at: number;
  types: MismatchType[];
  actual: { weightKg?: number; volumeM3?: number; pallets?: number; cargo?: CargoKind; tempMin?: number; tempMax?: number; odor?: OdorClass; note: string };
  photos: Media[];
  formula: { label: string; amount: Rial }[];
  suggestedFreight: Rial;
  proposedFreight: Rial;
  newDeclaredValue: Rial;
  status: MismatchStatus;
  dueAt: number;
  counter?: { freight: Rial; at: number };
  decision?: { by: string; at: number; note: string };
  ticketId?: string;
}

/* ───── Money ───── */

export type PaymentMethod = "wallet" | "card" | "split" | "card2card" | "paya" | "credit";
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "REFUNDED" | "PARTIAL_REFUND" | "AWAITING_VERIFICATION";
export type PaymentPurpose = "topup" | "deposit" | "balance" | "tip" | "mismatch_delta" | "debt" | "fee";

export interface Payment {
  id: string;
  at: number;
  payerId: string;
  orderId?: string;
  purpose: PaymentPurpose;
  amount: Rial;
  walletPart: Rial;
  cardPart: Rial;
  method: PaymentMethod;
  status: PaymentStatus;
  failReason?: string;
  gatewayRef?: string;
  receiptId?: string;
  idemKey: string;
  refunded: Rial;
  /** Gateway said failed but the bank deducted the money (finance-ticket scenario). */
  deducted?: boolean;
  settleAt?: number;
  /** Gateway / bank trail shown in the wallet statement (mock values, deterministic per payment). */
  trail?: PaymentTrail;
}

export interface PaymentTrail {
  channel: "wallet" | "gateway" | "card2card" | "paya" | "credit";
  bank?: string;
  cardMasked?: string;
  holder?: string;
  terminalId?: string;
  merchantId?: string;
  rrn?: string;
  traceNo?: string;
  authCode?: string;
  ip?: string;
  device?: string;
  initiatedAt: number;
  paidAt?: number;
  callbackAt?: number;
}

export interface TransferReceipt {
  id: string;
  paymentId: string;
  payerId: string;
  kind: "card2card" | "paya";
  amount: Rial;
  refNo: string;
  image?: string;
  at: number;
  slaDueAt: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reason?: string;
}

export type PayoutStatus = "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "ON_HOLD" | "SENT" | "SETTLED" | "FAILED";

export interface Payout {
  id: string;
  driverId: string;
  amount: Rial;
  fee: Rial;
  instant: boolean;
  status: PayoutStatus;
  sheba: string;
  holder: string;
  at: number;
  batchId?: string;
  failReason?: string;
  flags: string[];
  history: { at: number; status: PayoutStatus; by: string; note?: string }[];
}

export interface PayoutBatch {
  id: string;
  at: number;
  status: "DRAFT" | "APPROVED" | "EXPORTED" | "SENT" | "RECONCILED";
  payoutIds: string[];
  createdBy: string;
  approvedBy?: string;
}

export interface Refund {
  id: string;
  at: number;
  payerId: string;
  orderId?: string;
  ticketId?: string;
  amount: Rial;
  to: "wallet" | "card";
  status: "PENDING_APPROVAL" | "APPROVED" | "PAID" | "REJECTED";
  reason: string;
  eta?: number;
  decidedBy?: string;
}

export interface Debt {
  id: string;
  driverId: string;
  orderId?: string;
  amount: Rial;
  remaining: Rial;
  at: number;
  reason: string;
  /** Collection ladder: 0 auto-deduct · 1 reminders · 2 top-up required · 3 escalated · 4 suspended · 5 write-off. */
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  reminders: number;
  status: "OPEN" | "PAID" | "PENDING_WRITEOFF" | "WRITTEN_OFF";
}

export interface Coupon {
  code: string;
  title: string;
  kind: "PCT" | "FIXED";
  value: number;
  maxDiscount?: Rial;
  minOrder?: Rial;
  firstOrderOnly: boolean;
  routes?: string[];
  vehicleKinds?: VehicleKind[];
  cargoModes?: CargoMode[];
  serviceClass?: ServiceClass;
  segment?: "new" | "enterprise" | "all";
  start: number;
  end: number;
  totalLimit: number;
  perUser: number;
  stackable: boolean;
  fundedBy: "platform" | "driver_bonus";
  auto: boolean;
  paused: boolean;
  redemptions: { personId: string; orderId: string; amount: Rial; at: number }[];
}

export interface Referral {
  id: string;
  kind: "shipper_shipper" | "driver_driver" | "driver_shipper";
  referrerId: string;
  refereeId: string;
  status: "PENDING" | "QUALIFIED" | "REWARDED" | "FRAUD";
  reward: Rial;
  at: number;
}

export interface Incentive {
  id: string;
  kind: "trip_count" | "peak_route" | "backhaul" | "pro" | "referral" | "streak";
  title: string;
  desc: string;
  target: number;
  reward: Rial;
  budget: Rial;
  spent: Rial;
  active: boolean;
  route?: string;
}

export type InvoiceKind = "receipt" | "tax_invoice" | "credit_note" | "driver_statement" | "monthly_statement" | "insurer_settlement";

export interface Invoice {
  id: string;
  no: string;
  kind: InvoiceKind;
  partyId: string;
  orderId?: string;
  amount: Rial;
  vat: Rial;
  at: number;
  dueAt?: number;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "VOID";
  lines: { label: string; amount: Rial }[];
  dunning: { at: number; channel: string }[];
}

/* ───── Ledger ───── */

export interface LedgerEntry {
  id: string;
  txId: string;
  at: number;
  account: string;
  /** Debit positive, credit negative. Every tx sums to zero. */
  amount: Rial;
  memo: string;
  ref?: { orderId?: string; payoutId?: string; ticketId?: string; paymentId?: string; personId?: string };
}

export interface ReconRow {
  ref: string;
  amount: Rial;
  matched: boolean;
  paymentId?: string;
  note?: string;
}

export interface ReconFile {
  id: string;
  kind: "gateway" | "bank";
  at: number;
  name: string;
  rows: ReconRow[];
}

/* ───── Trust, support, rules ───── */

export type TicketChannel = "trip" | "account" | "finance";

export interface Ticket {
  id: string;
  channel: TicketChannel;
  category: string;
  personId: string;
  portal: "shipper" | "driver";
  orderId?: string;
  subject: string;
  status: "OPEN" | "PENDING" | "ESCALATED" | "RESOLVED" | "CLOSED";
  priority: "low" | "normal" | "high";
  assignee?: string;
  at: number;
  slaDueAt: number;
  messages: { from: "user" | "agent" | "system"; by?: string; text: string; at: number }[];
  csat?: number;
  context?: Record<string, string>;
  linked: string[];
}

export interface Review {
  id: string;
  orderId: string;
  fromId: string;
  toId: string;
  fromRole: "shipper" | "driver";
  criteria: Record<string, number>;
  overall: number;
  comment: string;
  photo?: string;
  at: number;
  revealed: boolean;
  moderation: "ok" | "reported" | "hidden";
}

export interface RuleDoc {
  id: string;
  audience: "driver" | "shipper";
  version: number;
  publishedAt: number;
  draft: boolean;
  keyPoints: { icon: string; text: string }[];
  sections: { title: string; items: string[] }[];
}

export interface RuleAcceptance {
  personId: string;
  audience: "driver" | "shipper";
  version: number;
  at: number;
  meta: string;
}

export interface Notification {
  id: string;
  personId: string;
  portal: PortalId;
  kind: string;
  text: string;
  at: number;
  read: boolean;
  href?: string;
}

export interface AuditEntry {
  id: string;
  at: number;
  actorType: "admin" | "system" | "person";
  actorId: string;
  actorLabel: string;
  action: string;
  target?: string;
  detail: string;
  ip?: string;
}

export interface Approval {
  id: string;
  at: number;
  action: string;
  title: string;
  requestedBy: string;
  amount?: Rial;
  payload: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy?: string;
  decidedAt?: number;
  reason?: string;
  needs: AdminRole[];
}

export interface RiskFlag {
  id: string;
  at: number;
  kind: string;
  personId: string;
  severity: "low" | "medium" | "high";
  detail: string;
  status: "OPEN" | "REVIEW" | "CLEARED" | "CONFIRMED";
}

export interface WashPartner {
  id: string;
  name: string;
  city: string;
  creditPct: number;
}

export interface Wash {
  id: string;
  driverId: string;
  at: number;
  partnerId?: string;
  before?: string;
  after?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface Insurer {
  id: string;
  name: string;
  hue: number;
}

export interface InsuranceProduct {
  id: string;
  insurerId: string;
  name: string;
  level: "BASIC" | "STANDARD" | "COMPREHENSIVE";
  ambient: boolean;
  /** Premium as a fraction of the declared value at 100% coverage. */
  rate: number;
  deductiblePct: number;
  covers: string[];
}

export interface Claim {
  id: string;
  orderId: string;
  productId: string;
  at: number;
  amount: Rial;
  reason: string;
  status: "OPEN" | "REVIEW" | "APPROVED" | "PAID" | "REJECTED";
}

export interface ConfigChange {
  id: string;
  key: string;
  at: number;
  effectiveAt: number;
  by: string;
  from: unknown;
  to: unknown;
  applied: boolean;
}

export interface ConfigState {
  values: Record<string, unknown>;
  history: ConfigChange[];
  scheduled: ConfigChange[];
}

export interface DemoState {
  /** Test-mode switches (Demo Director): national-ID/SIM match and IBAN-holder match outcomes. */
  idMatch: "ok" | "mismatch";
  ibanHolder: "ok" | "mismatch";
  gateway: "success" | "fail" | "cancel" | "timeout" | "delayed" | "double";
}

export interface SessionInfo {
  personId?: string;
  adminId?: string;
}

export interface State {
  ready: boolean;
  /** Transient clock override used while simulating seeded history. Never persisted. */
  _now?: number;
  version: number;
  /** Deterministic id counter. */
  seq: number;
  config: ConfigState;
  persons: Person[];
  shippers: ShipperProfile[];
  drivers: DriverProfile[];
  admins: AdminUser[];
  orders: Order[];
  templates: Template[];
  mismatches: Mismatch[];
  ledger: LedgerEntry[];
  txKeys: Record<string, string>;
  payments: Payment[];
  receipts: TransferReceipt[];
  payouts: Payout[];
  batches: PayoutBatch[];
  refunds: Refund[];
  debts: Debt[];
  coupons: Coupon[];
  referrals: Referral[];
  incentives: Incentive[];
  invoices: Invoice[];
  recon: ReconFile[];
  periodLockedUntil: number;
  closes: DayClose[];
  tickets: Ticket[];
  reviews: Review[];
  rules: RuleDoc[];
  acceptances: RuleAcceptance[];
  notifications: Notification[];
  audit: AuditEntry[];
  approvals: Approval[];
  risk: RiskFlag[];
  washes: Wash[];
  washPartners: WashPartner[];
  sms: SmsLog[];
  insurers: Insurer[];
  products: InsuranceProduct[];
  claims: Claim[];
  rates: RateEntry[];
  demo: DemoState;
  session: Record<PortalId, SessionInfo>;
}

export interface DayClose {
  id: string;
  at: number;
  /** Business day closed (start of that day). */
  day: number;
  by: string;
  entries: number;
  debit: Rial;
  credit: Rial;
  gateway: Rial;
  bank: Rial;
  suspense: Rial;
  unmatched: number;
  ok: boolean;
}

export interface SmsLog {
  id: string;
  at: number;
  personId: string;
  to: string;
  kind: string;
  text: string;
}

export interface RateEntry {
  id: string;
  from: string;
  to: string;
  min: Rial;
  max: Rial;
}

/* ───── Views: what each viewer may see ───── */

export interface GuestView {
  level: "guest";
  id: string;
  status: OrderStatus;
  originCity: string;
  destCity: string;
  priceRange: [Rial, Rial];
  cargoMode: CargoMode;
}

export interface Area {
  lat: number;
  lng: number;
  radius: number;
}

export interface PublicView {
  level: "public";
  id: string;
  status: OrderStatus;
  originCity: string;
  destCity: string;
  originArea: Area;
  destArea: Area;
  distanceKm: number;
  pickupAt: number;
  pickupTo: number;
  deliverBy: number;
  cargoMode: CargoMode;
  cargo: CargoKind;
  odor: OdorClass;
  odorSensitive: boolean;
  tempMin?: number;
  tempMax?: number;
  vehicleKind: VehicleKind;
  weightKg: number;
  pallets?: number;
  volumeM3?: number;
  freight: Rial;
  tipPre: Rial;
  terms: PayTerms;
  insured: boolean;
  serviceClass: ServiceClass;
  assignMode: AssignMode;
  cleanOnly: boolean;
  shipper: { id: string; name: string; verified: boolean; rating?: { avg: number; count: number } };
  lockedUntil?: number;
  lockedByMe: boolean;
  isDirectToMe: boolean;
  directExpiresAt?: number;
}

export interface FullView extends Omit<PublicView, "level"> {
  level: "full";
  origin: Place;
  dest: Place;
  shipperContact: { name: string; phone: string };
  driver?: { id: string; name: string; phone: string; plate?: string; vehicleKind?: VehicleKind; color?: string };
  waybills: WaybillVersion[];
  media: Media[];
  flag?: OrderFlag;
  loadedAt?: number;
  departedAt?: number;
  deliveredAt?: number;
  assignedAt?: number;
  note?: string;
  declaredValue: Rial;
  groupId: string;
  groupSize: number;
  groupIndex: number;
  depositDueAt?: number;
  consigneeToken: string;
}

export type OrderView = GuestView | PublicView | FullView;
