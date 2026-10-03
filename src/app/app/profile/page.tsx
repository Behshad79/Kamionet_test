"use client";

import { BadgeCheck, Check, Clock, Heart, ImagePlus, MapPinned, Pencil, ShieldCheck, Sparkles, Building2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PinPicker, type Pin } from "@/components/PinPicker";
import { FileDrop } from "@/components/molecules";
import { ProfileHero, ReviewItem } from "@/components/profile";
import { RulesStatus } from "@/components/rules";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Field, Input, Progress, Select, Sheet, Tabs, Toggle } from "@/components/ui";
import { RatingPill } from "@/components/molecules";
import { person } from "@/lib/engine/core";
import { driverStats, shipperStats } from "@/lib/engine/stats";
import { COMPLETENESS, saveShipperAddress, saveShipperIdentity, saveShipperLogo, shipperCompleteness, submitVerifyDoc, type CompletenessKey } from "@/lib/engine/profiles";
import { fa, jShort } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";
import { Avatar } from "@/components/profile";

type Tab = "profile" | "settings" | "favorites" | "rules";
const TEHRAN: Pin = { lat: 35.6892, lng: 51.389 };

export default function Page() {
  const { s, me, shipper } = usePortal("shipper");
  const [tab, setTab] = useState<Tab>("profile");
  const [edit, setEdit] = useState<CompletenessKey | null>(null);
  const [name, setName] = useState("");
  const [co, setCo] = useState("");
  const [code, setCode] = useState("");
  const [addr, setAddr] = useState("");
  const [pin, setPin] = useState<Pin | undefined>();
  const [img, setImg] = useState<string>();
  if (!me || !shipper) return null;
  const st = shipperStats(s, me.id);
  const comp = shipperCompleteness(shipper);
  const done = Object.values(comp).filter(Boolean).length;
  const mut = (fn: (sh: NonNullable<typeof shipper>) => void) => act((x) => { const sh = x.shippers.find((p) => p.personId === me.id); if (sh) fn(sh); });
  const open = (k: CompletenessKey) => {
    setEdit(k); setImg(undefined);
    setName(shipper.displayName); setCo(shipper.company?.name ?? ""); setCode(shipper.company?.economicCode ?? "");
    setAddr(shipper.address?.text ?? ""); setPin(shipper.address ? { lat: shipper.address.lat, lng: shipper.address.lng } : undefined);
  };
  const run = (r: { ok: boolean; error?: string }, msg: string) => { toast(r.ok ? msg : r.error ?? "انجام نشد", r.ok ? "ok" : "err"); if (r.ok) setEdit(null); };
  const title = COMPLETENESS.find((c) => c.key === edit)?.label ?? "";
  const vd = shipper.verifyDoc;
  return (
    <div className="space-y-5">
      <ProfileHero name={shipper.displayName} hue={shipper.hue} verified={shipper.businessVerified} rating={st.rating} ratingCount={st.ratingCount}
        headline={shipper.company?.sector ? `صاحب بار · ${shipper.company.sector}` : shipper.company ? "شرکت حمل و پخش" : "صاحب بار"}
        badges={<>{shipper.businessVerified && <Badge tone="ok"><BadgeCheck className="size-3.5" aria-hidden />کسب‌وکار تأییدشده</Badge>}{vd?.status === "pending" && <Badge tone="warn"><Clock className="size-3.5" aria-hidden />تأیید در انتظار بازبینی</Badge>}</>}
        stats={[{ label: "محموله", value: fa(st.shipments) }, { label: "بارگیری به‌موقع", value: `${fa(Math.round(st.onTimeLoading * 100))}٪` }, { label: "اعتبار حساب", value: fa(shipper.honesty) }]}
        actions={<Button size="sm" variant="secondary" onClick={() => open("name")}><Pencil className="size-4" aria-hidden />ویرایش</Button>} />

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "profile", label: "تکمیل پروفایل" }, { id: "settings", label: "تنظیمات" }, { id: "favorites", label: "راننده‌های محبوب", count: shipper.favorites.length }, { id: "rules", label: "قوانین" }]} />

      {tab === "profile" && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between"><h2 className="font-extrabold">پروفایل شما چقدر کامل است؟</h2><span className="rounded-full bg-act-soft px-3 py-1 text-sm font-black text-act-ink">{fa(done)} از ۵</span></div>
            <Progress value={(done / 5) * 100} />
            <p className="text-sm leading-7 text-ink-3">پروفایل کامل‌تر یعنی اعتماد بیشتر رانندگان و تخصیص سریع‌تر. هر مرحله را باید واقعاً انجام دهید؛ تیک خودکار نمی‌خورد.</p>
            <ul className="space-y-2">
              {COMPLETENESS.map((c) => (
                <li key={c.key} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${comp[c.key] ? "bg-ok text-white" : "bg-white text-ink-4 ring-1 ring-line"}`}>{comp[c.key] ? <Check className="size-4" aria-hidden /> : c.key === "address" ? <MapPinned className="size-4" aria-hidden /> : c.key === "logo" ? <ImagePlus className="size-4" aria-hidden /> : c.key === "verify" ? <ShieldCheck className="size-4" aria-hidden /> : c.key === "company" ? <Building2 className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}</span>
                  <div className="min-w-0 flex-1"><div className="font-bold">{c.label}</div><div className="text-xs leading-5 text-ink-3">{c.key === "verify" && vd ? (vd.status === "pending" ? "مدرک ارسال شد؛ در انتظار بازبینی تیم کامیونت." : vd.status === "rejected" ? `رد شد${vd.note ? `: ${vd.note}` : ""}؛ دوباره ارسال کنید.` : "تأیید شد.") : c.how}</div></div>
                  <Button size="sm" variant={comp[c.key] ? "ghost" : "secondary"} disabled={c.key === "verify" && vd?.status === "pending"} onClick={() => open(c.key)}>{comp[c.key] ? "ویرایش" : c.key === "verify" && vd?.status === "pending" ? "در بررسی" : "انجام بده"}</Button>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-5">
            <Card className="space-y-3 p-5">
              <h2 className="font-extrabold">پروفایل شما از دید رانندگان</h2>
              <div className="flex items-center gap-3"><Avatar name={shipper.displayName} hue={shipper.hue} size={52} src={shipper.logo} /><div><div className="font-black">{shipper.displayName}</div><RatingPill r={{ avg: st.rating, count: st.ratingCount }} /></div></div>
              <p className="text-xs leading-6 text-ink-3">نشانی و تلفن شما تا پرداخت بیعانه برای راننده پنهان است.</p>
            </Card>
            <Card className="space-y-4 p-5"><h2 className="font-extrabold">نظر رانندگان</h2>{st.recent.length === 0 ? <p className="text-sm text-ink-3">هنوز نظری ثبت نشده است.</p> : st.recent.slice(0, 4).map((r) => <ReviewItem key={r.id} name={person(s, r.fromId)?.name ?? "راننده"} rating={r.overall} text={r.comment} at={jShort(r.at)} hue={(r.fromId.length * 47) % 360} />)}</Card>
            <Card className="space-y-2 p-5"><h2 className="font-extrabold">دعوت دوستان</h2><p className="text-sm leading-7 text-ink-3">کد شما: <b dir="ltr" className="tabular">{shipper.referralCode}</b></p></Card>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">تنظیمات</h2>
          <div className="flex items-center justify-between gap-3"><div><div className="font-bold">پرداخت خودکار بیعانه</div><div className="text-xs text-ink-3">پیش‌فرض برای سفارش‌های جدید</div></div><Toggle checked={shipper.prefs.autoPayDeposit} onChange={(v) => mut((sh) => { sh.prefs.autoPayDeposit = v; })} label="پرداخت خودکار بیعانه" /></div>
          <Field label="مقصد پیش‌فرض بازپرداخت">{(id) => <Select id={id} value={shipper.prefs.refundTo} onChange={(e) => mut((sh) => { sh.prefs.refundTo = e.target.value as "wallet" | "card"; })}><option value="wallet">کیف پول (فوری)</option><option value="card">کارت بانکی (تا ۳ روز کاری)</option></Select>}</Field>
          {([["orders", "اعلان وضعیت سفارش"], ["payments", "اعلان پرداخت"], ["marketing", "پیشنهادها و تخفیف‌ها"]] as const).map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3"><span className="font-medium">{l}</span><Toggle checked={!!shipper.prefs.notify[k]} onChange={(v) => mut((sh) => { sh.prefs.notify[k] = v; })} label={l} /></div>
          ))}
          <p className="text-xs text-ink-3">سفارش‌های تکرارشونده از منوی «تکرارشونده‌ها» مدیریت می‌شود.</p>
        </Card>
      )}

      {tab === "favorites" && (shipper.favorites.length === 0 ? <EmptyState icon={<Heart className="size-8" />} title="هنوز راننده‌ی محبوبی ندارید" body="در صفحه‌ی سفارش، راننده‌هایی را که دوست داشتید با قلب نشان کنید." /> : (
        <div className="grid gap-3 md:grid-cols-2">{shipper.favorites.map((id) => { const p = person(s, id); const ds = driverStats(s, id); const pro = s.drivers.find((d) => d.personId === id)?.pro.status === "pro"; return <Link key={id} href={`/app/driver/?id=${id}`}><Card className="card-lift flex items-center gap-3 p-4"><Avatar name={p?.name ?? "راننده"} pro={pro} size={52} hue={(id.length * 61) % 360} /><div className="min-w-0 flex-1"><div className="font-black">{p?.name}</div><RatingPill r={{ avg: ds.rating, count: ds.ratingCount }} /></div></Card></Link>; })}</div>
      ))}

      {tab === "rules" && <RulesStatus personId={me.id} audience="shipper" />}

      <Sheet open={edit === "name" || edit === "company"} onClose={() => setEdit(null)} title="هویت و شرکت" footer={<Button block onClick={() => run(act((x) => saveShipperIdentity(x, me.id, { displayName: name, company: co, economicCode: code })), "ذخیره شد.")}>ذخیره</Button>}>
        <div className="space-y-4"><Field label="نام نمایشی">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field><Field label="نام شرکت">{(id) => <Input id={id} value={co} onChange={(e) => setCo(e.target.value)} />}</Field><Field label="کد اقتصادی (حداقل ۸ رقم)">{(id) => <Input id={id} dir="ltr" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />}</Field></div>
      </Sheet>
      <Sheet open={edit === "address"} onClose={() => setEdit(null)} title={title} wide footer={<Button block disabled={!pin || addr.trim().length < 6} onClick={() => run(act((x) => saveShipperAddress(x, me.id, { text: addr, lat: pin!.lat, lng: pin!.lng })), "نشانی ذخیره شد.")}>ذخیره‌ی نشانی و پین</Button>}>
        <div className="space-y-4"><Field label="نشانی دقیق انبار">{(id) => <Input id={id} value={addr} onChange={(e) => setAddr(e.target.value)} />}</Field><PinPicker label="محل دقیق روی نقشه" tone="origin" center={pin ?? TEHRAN} value={pin} onChange={setPin} /></div>
      </Sheet>
      <Sheet open={edit === "logo"} onClose={() => setEdit(null)} title={title} footer={<Button block disabled={!img} onClick={() => run(act((x) => saveShipperLogo(x, me.id, img!)), "لوگو ذخیره شد.")}>ذخیره‌ی تصویر</Button>}>
        <FileDrop label="لوگو یا عکس پروفایل" hint="تصویر مربع و واضح" value={img ?? shipper.logo} onChange={(c) => setImg(c.dataUrl)} />
      </Sheet>
      <Sheet open={edit === "verify"} onClose={() => setEdit(null)} title={title} footer={<Button block disabled={!img} onClick={() => run(act((x) => submitVerifyDoc(x, me.id, img!)), "مدرک برای بازبینی ارسال شد.")}>ارسال برای تأیید</Button>}>
        <div className="space-y-4"><p className="text-sm leading-7 text-ink-3">عکس خوانای جواز کسب، روزنامه‌ی رسمی یا کارت اقتصادی شرکت را بفرستید. پس از بازبینی تیم کامیونت، نشان «کسب‌وکار تأییدشده» فعال می‌شود. (ابتدا اطلاعات شرکت را ثبت کنید.)</p><FileDrop label="عکس مدرک کسب‌وکار" capture value={img} onChange={(c) => setImg(c.dataUrl)} /></div>
      </Sheet>
    </div>
  );
}
