import { VEHICLES } from "../vehicles";
import type { DriverProfile, ShipperProfile, State } from "../types";
import { now, uid } from "./core";

export const refCode = (s: State, prefix: string) => `${prefix}${(1000 + ((s.seq * 7919) % 9000)).toString()}`;

export function blankShipper(s: State, personId: string, displayName: string): ShipperProfile {
  return {
    personId, displayName, businessVerified: false,
    completeness: { name: displayName !== "کاربر جدید", company: false, verify: false, address: false, logo: false },
    memberSince: now(s), favorites: [], cargoCategories: [],
    controls: { creditLimit: 0, creditTermsDays: 0, invoiceCycle: "order", blockCardToCard: false, cashToDriver: false, couponEligible: true, walletFrozen: false, blocked: false },
    honesty: 100,
    prefs: { autoPayDeposit: false, refundTo: "wallet", quietHours: false, notify: { assigned: true, transit: true, delivered: true, mismatch: true, payment: true } },
    referralCode: refCode(s, "KS"), loyaltyTier: "bronze", notes: [], hue: (s.seq * 47) % 360,
  };
}

export function blankDriver(s: State, personId: string): DriverProfile {
  return {
    personId,
    kyc: { status: "none", step: 0, idMatch: { status: "idle", attempts: 0 } },
    vehicle: { kind: "nissan", capacityKg: VEHICLES.nissan.capacityKg, color: "#F3F4F6", plate: null, minTemp: 0, canRunAmbient: false, fridgeBrand: "", lastCargoOdor: "NONE" },
    docs: {}, pro: { status: "none", inspection: "none" }, strikes: [], clean: { score: 60 },
    controls: { walletFrozen: false, payoutHold: false, cashToDriver: false, maxDebt: 150_000_000, instantPayout: false, incentiveEligible: true },
    declaredTrips: [], online: false, referralCode: refCode(s, "KD"), notes: [], createdAt: now(s),
  };
}

export function ensureShipper(s: State, personId: string) {
  let p = s.shippers.find((x) => x.personId === personId);
  if (!p) {
    const name = s.persons.find((x) => x.id === personId)?.name ?? "کاربر جدید";
    p = blankShipper(s, personId, name);
    s.shippers.push(p);
  }
  return p;
}

export function ensureDriver(s: State, personId: string) {
  let p = s.drivers.find((x) => x.personId === personId);
  if (!p) {
    p = blankDriver(s, personId);
    s.drivers.push(p);
  }
  return p;
}

void uid;
