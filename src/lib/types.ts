export type Role = "shipper" | "driver";

export type OrderStatus =
  | "DRAFT"
  | "OPEN"
  | "LOCKED"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "EXPIRED";

export type CargoType = "dairy" | "meat" | "pharma" | "icecream" | "other";
export type VehicleType = "pickup" | "khavar" | "truck10" | "trailer";
export type PayMethod = "prepaid" | "deposit" | "cod";
export interface Payment { method: PayMethod; depositPct?: number }

export interface Place {
  city: string;
  province?: string;
  lat: number;
  lng: number;
  address: string;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  createdAt: number;
}

export type DocKey =
  | "nationalFront"
  | "nationalBack"
  | "license"
  | "smartCard"
  | "selfie"
  | "regFront"
  | "regBack"
  | "insurance"
  | "inspection"
  | "carExterior"
  | "carInterior";

export interface DocFile {
  dataUrl?: string;
  expiresAt?: number;
}

export type KycStatus = "none" | "draft" | "pending" | "verified" | "rejected";

export interface Vehicle {
  type: VehicleType;
  plate: string;
  fridgeBrand: string;
  /** Lowest temperature (°C) the refrigeration unit can hold. */
  minTemp: number;
  /** Payload in kg; matched against the order's cargo weight. */
  capacityKg: number;
  lastServiceAt?: number;
}

export interface DriverProfile {
  userId: string;
  kyc: KycStatus;
  rejectReason?: string;
  submittedAt?: number;
  vehicle: Vehicle;
  docs: Partial<Record<DocKey, DocFile>>;
}

export interface Media {
  kind: "cargo" | "invoice_pickup" | "invoice_delivery";
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

export interface Order {
  id: string;
  groupId: string;
  groupIndex: number;
  groupSize: number;
  shipperId: string;
  driverId?: string;
  status: OrderStatus;
  origin: Place;
  dest: Place;
  /** Start of the pickup window. */
  pickupAt: number;
  pickupTo: number;
  deliverBy: number;
  cargo: CargoType;
  /** Required temperature band, °C. Both ends matter: freezing damages chilled cargo too. */
  tempMin: number;
  tempMax: number;
  vehicleType: VehicleType;
  weightKg: number;
  pallets?: number;
  volumeM3?: number;
  /** Declared cargo value (toman): the insurance basis. Never the fare. */
  declaredValue: number;
  /** Fare for this vehicle. */
  price: number;
  payment: Payment;
  insurance: boolean;
  insuranceFee: number;
  distanceKm: number;
  note?: string;
  cancelFee?: number;
  createdAt: number;
  lockedBy?: string;
  lockedUntil?: number;
  assignedAt?: number;
  startedAt?: number;
  deliveredAt?: number;
  waybillNo?: string;
  media: Media[];
  flag?: OrderFlag;
  templateId?: string;
  cancelReason?: string;
}

export interface Template {
  id: string;
  shipperId: string;
  cadence: "daily" | "weekly";
  hour: number;
  active: boolean;
  nextRunAt: number;
  /** Pickup window length and delivery lead time, replayed on every spawn. */
  windowMs: number;
  deliverAfterMs: number;
  draft: Omit<Order, "id" | "groupId" | "groupIndex" | "groupSize" | "status" | "media" | "createdAt" | "pickupAt" | "pickupTo" | "deliverBy">;
}

export interface Rating {
  orderId: string;
  from: string;
  to: string;
  stars: number;
  comment: string;
  at: number;
}

export interface Notification {
  id: string;
  userId: string;
  text: string;
  at: number;
  read: boolean;
  href?: string;
}

export interface TicketMsg {
  from: "user" | "admin";
  text: string;
  at: number;
}

export interface Ticket {
  id: string;
  userId: string;
  orderId?: string;
  subject: string;
  status: "open" | "closed";
  messages: TicketMsg[];
}

export interface RateEntry {
  id: string;
  from: string;
  to: string;
  min: number;
  max: number;
}

export interface Config {
  insuranceMode: "optional" | "mandatory";
  /** Fraction of the DECLARED CARGO VALUE, e.g. 0.003 */
  insuranceRate: number;
  /** Fraction of the fare charged when the shipper cancels after assignment. */
  cancelFeePct: number;
  /** Soft-lock length in seconds. */
  lockSeconds: number;
  /** Platform commission fraction. */
  commission: number;
}

export interface Session {
  userId: string | null;
  role: Role;
  admin: boolean;
}

export interface State {
  ready: boolean;
  users: User[];
  drivers: DriverProfile[];
  orders: Order[];
  templates: Template[];
  ratings: Rating[];
  notifications: Notification[];
  tickets: Ticket[];
  rates: RateEntry[];
  config: Config;
  session: Session;
}

/* ───── Masked views: what each viewer is allowed to see ───── */

export interface GuestView {
  level: "guest";
  id: string;
  status: OrderStatus;
  originCity: string;
  destCity: string;
  priceRange: [number, number];
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
  cargo: CargoType;
  tempMin: number;
  tempMax: number;
  vehicleType: VehicleType;
  weightKg: number;
  pallets?: number;
  volumeM3?: number;
  price: number;
  payment: Payment;
  insurance: boolean;
  shipperRating?: { avg: number; count: number };
  lockedUntil?: number;
  lockedByMe: boolean;
}

export interface FullView extends Omit<PublicView, "level"> {
  level: "full";
  origin: Place;
  dest: Place;
  shipper: { name: string; phone: string };
  driver?: { name: string; phone: string; plate?: string };
  waybillNo?: string;
  media: Media[];
  flag?: OrderFlag;
  startedAt?: number;
  deliveredAt?: number;
  assignedAt?: number;
  note?: string;
  declaredValue: number;
  cancelFee?: number;
  groupId: string;
  groupSize: number;
  groupIndex: number;
}

export type OrderView = GuestView | PublicView | FullView;
