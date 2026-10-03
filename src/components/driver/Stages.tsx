"use client";

import { BadgeCheck, Banknote, Clock, FileCheck2, PackageSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "../Toaster";
import { Badge, Button, ButtonLink, Card, Field, Textarea } from "../ui";
import { suspensionOf } from "@/lib/engine/drivers";
import { resumeKycAfterReject } from "@/lib/engine/kyc";
import { submitAppeal } from "@/lib/engine/trust";
import { cv } from "@/lib/config";
import { kycReady } from "@/lib/engine/kyc";
import { fa, jDateTime, toman, CARGO } from "@/lib/format";
import { person } from "@/lib/engine/core";
import { RouteLine } from "../molecules";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";

export function Rejected({ pid, reasons }: { pid: string; reasons: string[] }) {
  return (
    <Card className="space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-xl font-black text-danger"><ShieldAlert className="size-6" aria-hidden />مدارک شما نیاز به اصلاح دارد</h1>
      <ul className="list-disc space-y-1 ps-5 text-sm leading-7">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <Button block onClick={() => act((s) => resumeKycAfterReject(s, pid))}>اصلاح و ارسال مجدد مدارک</Button>
    </Card>
  );
}

export function Suspended({ pid }: { pid: string }) {
  const { s, driver } = usePortal("driver");
  const sus = driver && suspensionOf(s, driver);
  const [txt, setTxt] = useState("");
  if (!sus) return null;
  return (
    <Card className="space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-xl font-black text-danger"><ShieldAlert className="size-6" aria-hidden />حساب شما معلق است</h1>
      <p className="text-sm leading-7">{sus.reason}</p>
      {sus.derived ? <p className="rounded-ui bg-surface-2 p-3 text-sm leading-7">با ثبت مدرک جدید در بخش پروفایل، تعلیق خودکار برداشته می‌شود.</p> : sus.appeal === "none" ? (
        <div className="space-y-3"><Field label="درخواست تجدیدنظر">{(id) => <Textarea id={id} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="توضیح دهید و در صورت لزوم مدرک پیوست کنید." />}</Field><Button disabled={txt.trim().length < 10} onClick={() => { const r = act((st) => submitAppeal(st, pid, txt)); toast(r.ok ? "درخواست ثبت شد." : r.error, r.ok ? "ok" : "err"); }}>ارسال درخواست</Button></div>
      ) : <p className="rounded-ui bg-warn-bg p-3 text-sm font-bold text-warn">{{ open: "درخواست شما در حال بررسی است.", rejected: "درخواست رد شد.", accepted: "درخواست پذیرفته شد." }[sus.appeal as "open" | "rejected" | "accepted"]}</p>}
    </Card>
  );
}


export const isLive = (stage?: string) => ["verified", "pro_invited", "pro"].includes(stage ?? "");

/** Shown above the load board while the driver can browse but not yet claim loads. */
export function StageBanner({ stage, pid }: { stage: string; pid: string }) {
  const { s } = usePortal("driver");
  const missing = kycReady(s, pid);
  if (stage === "in_review") return <Card className="flex items-start gap-3 border border-warn/30 bg-warn-bg p-4"><Clock className="mt-0.5 size-6 shrink-0 text-warn" aria-hidden /><div><div className="font-black text-warn">مدارک شما در حال بررسی است</div><p className="text-sm leading-7 text-ink-2">می‌توانید بارها را ببینید؛ پس از تأیید (معمولاً کمتر از یک روز کاری) می‌توانید بار انتخاب کنید. نتیجه را با اعلان و پیامک می‌گیرید.</p></div></Card>;
  if (stage === "rejected") return <Card className="flex flex-wrap items-center justify-between gap-3 border border-danger/30 bg-danger-bg p-4"><div className="flex items-center gap-3"><ShieldAlert className="size-6 text-danger" aria-hidden /><div className="font-black text-danger">مدارک شما نیاز به اصلاح دارد</div></div><ButtonLink href="/driver/kyc/" size="sm">اصلاح مدارک</ButtonLink></Card>;
  return (
    <Card className="space-y-3 border-2 border-act p-4">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-6 shrink-0 text-act-ink" aria-hidden /><div><div className="font-black">برای انتخاب بار، احراز هویت را کامل کنید</div><p className="text-sm leading-7 text-ink-3">بارها را آزادانه ببینید؛ پیش از انتخاب بار باید هویت و مدارک شما تأیید شود.</p></div></div>
      {missing.length > 0 && <p className="text-xs text-ink-3">مانده: {missing.slice(0, 4).join("، ")}{missing.length > 4 ? ` و ${fa(missing.length - 4)} مورد دیگر` : ""}</p>}
      <ButtonLink href="/driver/kyc/" block>{missing.length > 6 ? "شروع احراز هویت" : "ادامه‌ی احراز هویت"}</ButtonLink>
    </Card>
  );
}

const TOUR = [
  { icon: PackageSearch, title: "بارهای یخچالی را ببینید", body: "بارهای واقعی کنار شما با مبدأ، مقصد، دما و درآمد خالص نمایش داده می‌شود. نیازی به ثبت‌نام برای دیدن نیست." },
  { icon: FileCheck2, title: "یک‌بار مدارک بدهید", body: "کد ملی، عکس چهره، گواهینامه، کارت هوشمند و مشخصات دقیق خودرو. هر مرحله ذخیره می‌شود و می‌توانید بعداً ادامه دهید." },
  { icon: Banknote, title: "بار بگیرید و درآمد بسازید", body: "بعد از تأیید، بار را رزرو می‌کنید، بیعانه که پرداخت شد آدرس دقیق باز می‌شود و درآمدتان بعد از تحویل قابل برداشت است." },
  { icon: BadgeCheck, title: "پرو شوید و بالاتر دیده شوید", body: "با وقت‌شناسی، نظافت و اتصال دماسنج به سنسور کامیونت امتیاز بگیرید و به جمع رانندگان کامیونت پرو بپیوندید." },
];

/** First-run walkthrough (4 cards). Marks itself done on the person so it never returns. */
export function DriverTour({ pid, onDone }: { pid: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const T = TOUR[i];
  const last = i === TOUR.length - 1;
  const finish = () => { act((s) => { const p = s.persons.find((x) => x.id === pid); if (p) p.tourDone = true; }); onDone(); };
  return (
    <Card className="space-y-5 p-6 text-center">
      <div className="flex justify-end"><button onClick={finish} className="min-h-11 px-2 text-sm font-bold text-ink-3 hover:text-ink">رد کردن</button></div>
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-act-soft text-act-ink"><T.icon className="size-10" aria-hidden /></span>
      <h1 className="text-xl font-black">{T.title}</h1>
      <p className="mx-auto max-w-sm text-sm leading-8 text-ink-2">{T.body}</p>
      <div className="flex justify-center gap-2" aria-hidden>{TOUR.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-act" : "w-2 bg-surface-3"}`} />)}</div>
      <div className="flex gap-2">{i > 0 && <Button variant="secondary" onClick={() => setI(i - 1)}>قبلی</Button>}<Button className="flex-1" size="lg" onClick={() => (last ? finish() : setI(i + 1))}>{last ? "دیدن بارها" : "بعدی"}</Button></div>
    </Card>
  );
}

/** Logged-out browsing: cities, cargo type and a rounded price range only (the guest view). Every action leads to sign-up. */
export function GuestMarket() {
  const { s } = usePortal("driver");
  const rows = s.orders.filter((o) => o.status === "OPEN" || o.status === "PRO_POOL").slice(-24).reverse();
  const on = cv<boolean>(s, "feature.guestBrowse");
  if (!on) return null;
  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-2 border-act p-5">
        <h1 className="text-xl font-black">بار یخچالی، درآمد مطمئن</h1>
        <p className="text-sm leading-7 text-ink-3">بارهای امروز را ببینید. برای انتخاب بار و دیدن مبدأ و مقصد دقیق، با شماره‌ی موبایل ثبت‌نام کنید و مدارک را کامل کنید.</p>
        <div className="grid grid-cols-2 gap-2"><ButtonLink href="/driver/login/" size="lg">ثبت‌نام / ورود</ButtonLink><Badge tone="ok" className="justify-center">{fa(rows.length)} بار باز</Badge></div>
      </Card>
      <div className="space-y-3">
        {rows.map((o) => (
          <Link key={o.id} href="/driver/login/" className="block">
            <Card className="space-y-3 p-4 transition active:scale-[0.99]">
              <div className="flex items-center justify-between gap-2 text-sm"><span className="font-bold">{CARGO[o.cargo].label}{o.cargoMode === "AMBIENT" ? " · غیریخچالی" : ""}</span>{o.status === "PRO_POOL" && <Badge tone="brand">ویژه‌ی پرو</Badge>}</div>
              <RouteLine from={o.origin.city} to={o.dest.city} />
              <div className="flex items-end justify-between border-t border-line pt-3"><span className="text-xs text-ink-3">برای دیدن جزئیات ثبت‌نام کنید</span><div className="text-end"><div className="text-xs text-ink-3">کرایه‌ی تقریبی</div><div className="font-black tabular">{toman(Math.round(o.freight * 0.9 / 10_000_000) * 10_000_000)} تا {toman(Math.round(o.freight * 1.1 / 10_000_000) * 10_000_000)}</div></div></div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
void person;
