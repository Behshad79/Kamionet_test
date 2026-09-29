"use client";

import { Ban, Lock, PackageX, ShieldCheck, Timer, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { BackLink, CargoLabel, Countdown, RatingPill, RouteLine, StatusBadge, TempChip } from "@/components/molecules";
import { toast } from "@/components/Toaster";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { fa, jDateTime, payLabel, toman, VEHICLES, weightLabel, windowLabel } from "@/lib/format";
import { useApp, useQueryId } from "@/lib/hooks";
import { MATCH_FAIL_TEXT, matchVehicle } from "@/lib/matching";
import { isFull, isPublic, viewOrder } from "@/lib/mask";
import { driverNet, platformFee } from "@/lib/pricing";
import { claimOrder, confirmAssign, releaseLock } from "@/lib/store";

export default function DriverOrder() {
  const id = useQueryId();
  const router = useRouter();
  const { s, me, driver, standing, ready } = useApp();
  const o = s.orders.find((x) => x.id === id);
  const v = o ? viewOrder(o, s) : undefined;
  const pub = v && isPublic(v) ? v : undefined;

  const circles = useMemo(() => (pub ? [
    { id: "a", lat: pub.originArea.lat, lng: pub.originArea.lng, radius: pub.originArea.radius, tone: "brand" as const },
    { id: "b", lat: pub.destArea.lat, lng: pub.destArea.lng, radius: pub.destArea.radius, tone: "accent" as const },
  ] : []), [pub]);
  const lines = useMemo(() => (pub ? [{ id: "l", points: [[pub.originArea.lat, pub.originArea.lng], [pub.destArea.lat, pub.destArea.lng]] as [number, number][], dashed: true }] : []), [pub]);
  const markers = useMemo(() => (pub ? [
    { id: "o", lat: pub.originArea.lat, lng: pub.originArea.lng, kind: "origin" as const },
    { id: "d", lat: pub.destArea.lat, lng: pub.destArea.lng, kind: "dest" as const },
  ] : []), [pub]);

  if (!ready || id === null) return <AppShell area="driver"><Skeleton className="h-96" /></AppShell>;
  // Own orders are invisible in driver mode; the backend also rejects claiming them.
  if (!o || !v || o.shipperId === me?.id)
    return <AppShell area="driver"><EmptyState icon={<PackageX className="size-7" />} title="این سفارش در دسترس نیست" body="سفارش وجود ندارد یا متعلق به حساب خودتان (در نقش صاحب بار) است." action={<Link href="/driver/"><Button>بازگشت به بازار</Button></Link>} /></AppShell>;

  if (isFull(v))
    return (
      <AppShell area="driver">
        <Card className="animate-rise space-y-3 p-6 text-center">
          <ShieldCheck className="mx-auto size-10 text-ok" />
          <h1 className="text-xl font-black">این سفارش به شما تخصیص یافته است</h1>
          <p className="text-sm text-ink-3">جزئیات کامل، بارنامه و مراحل سفر را ببینید.</p>
          <Link href={`/driver/trip/?id=${v.id}`}><Button size="lg">ادامه‌ی سفر</Button></Link>
        </Card>
      </AppShell>
    );
  if (!pub) return null;

  const gone = pub.status !== "OPEN" && !pub.lockedByMe;
  const net = driverNet(pub.price, s.config);
  const mine = pub.lockedByMe && pub.status === "LOCKED" && pub.lockedUntil;
  const fit = driver?.vehicle.plate ? matchVehicle(driver.vehicle, pub) : ({ ok: true } as const);
  const verified = standing === "verified";
  const disabledReason = !verified ? "پس از تأیید مدارک فعال می‌شود" : !fit.ok ? MATCH_FAIL_TEXT[fit.why] : "";
  const cancelled = pub.status === "CANCELLED" || pub.status === "EXPIRED";

  const claim = () => {
    const r = claimOrder(pub.id);
    if (!r.ok) toast(r.error, "err");
  };

  return (
    <AppShell area="driver">
      <div className="mb-4 flex items-center justify-between"><BackLink href="/driver/">بازار بار</BackLink><StatusBadge status={pub.status} /></div>

      <div className="space-y-4">
        <div className="h-56 overflow-hidden rounded-ui shadow-soft">
          <MapView markers={markers} circles={circles} lines={lines} fitKey={pub.id} className="size-full" />
        </div>
        <p className="flex items-center gap-2 text-xs text-ink-3"><Lock className="size-3.5" />دایره‌ها محدوده‌ی تقریبی‌اند؛ نشانی دقیق، نام و شماره‌ی صاحب بار بعد از تأیید نهایی باز می‌شود.</p>

        {gone && (
          <Card className="animate-rise space-y-3 bg-danger-bg p-4 text-center shadow-none">
            <Ban className="mx-auto size-7 text-danger" />
            <p className="font-bold text-danger">{cancelled ? "این سفارش دیگر در دسترس نیست." : "این سفارش هم‌اکنون به راننده دیگری اختصاص یافته است."}</p>
            <Link href="/driver/"><Button variant="secondary">دیدن بارهای دیگر</Button></Link>
          </Card>
        )}

        <Card className="space-y-4 p-5">
          <RouteLine from={pub.originCity} to={pub.destCity} sub={["محدوده‌ی تقریبی بارگیری", `${fa(pub.distanceKm)} کیلومتر`]} />
          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><dt className="text-ink-3">نوع بار</dt><dd className="font-bold"><CargoLabel type={pub.cargo} /></dd></div>
            <div><dt className="text-ink-3">وزن</dt><dd className="font-bold">{weightLabel(pub.weightKg)}{pub.pallets ? ` · ${fa(pub.pallets)} پالت` : ""}{pub.volumeM3 ? ` · ${fa(pub.volumeM3)} م³` : ""}</dd></div>
            <div className="col-span-2"><dt className="text-ink-3">دمای موردنیاز در تمام مسیر</dt><dd className="mt-0.5"><TempChip min={pub.tempMin} max={pub.tempMax} /></dd></div>
            <div><dt className="text-ink-3">خودروی درخواستی</dt><dd className="font-bold">{VEHICLES[pub.vehicleType]}</dd></div>
            <div><dt className="text-ink-3">پرداخت</dt><dd className="font-bold">{payLabel(pub.payment)}</dd></div>
            <div><dt className="text-ink-3">بازه‌ی بارگیری</dt><dd className="font-bold">{windowLabel(pub.pickupAt, pub.pickupTo)}</dd></div>
            <div><dt className="text-ink-3">مهلت تحویل</dt><dd className="font-bold">{jDateTime(pub.deliverBy)}</dd></div>
            <div><dt className="text-ink-3">امتیاز صاحب بار</dt><dd className="mt-0.5"><RatingPill r={pub.shipperRating} /></dd></div>
            {pub.insurance && <div className="col-span-2"><dd className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-3 py-1 text-xs font-bold text-ok"><ShieldCheck className="size-3.5" />بار بیمه‌شده است</dd></div>}
          </dl>
        </Card>

        <Card className="space-y-2 p-5">
          <div className="flex flex-wrap items-end justify-between gap-x-4"><span className="text-ink-3">سهم شما از این سفر</span><span className="text-2xl font-black tabular sm:text-3xl">{toman(net)}</span></div>
          <div className="flex justify-between text-xs text-ink-3"><span>کرایه‌ی کل {toman(pub.price)}</span><span>کارمزد پلتفرم {toman(platformFee(pub.price, s.config))}</span></div>
        </Card>

        {mine ? (
          <Card className="animate-rise space-y-4 border-2 border-brand-500 p-5">
            <div className="flex items-center gap-2 font-bold"><Timer className="size-5 text-brand-700" />سفارش برای شما رزرو شد</div>
            <Countdown until={pub.lockedUntil!} total={s.config.lockSeconds} />
            <p className="text-sm leading-7 text-ink-3">تا پایان مهلت، سفارش فقط برای شماست. با تأیید نهایی، نشانی دقیق و شماره‌ی صاحب بار باز می‌شود و بارنامه صادر می‌گردد.</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { releaseLock(pub.id); toast("سفارش رها شد", "info"); }}><Undo2 className="size-4" />رها کردن</Button>
              <Button className="flex-1" size="lg" onClick={() => {
                const r = confirmAssign(pub.id);
                if (r.ok) { toast("سفارش به شما تخصیص یافت. بارنامه صادر شد"); router.push(`/driver/trip/?id=${pub.id}`); } else toast(r.error, "err");
              }}>تأیید نهایی و دریافت اطلاعات</Button>
            </div>
          </Card>
        ) : !gone ? (
          <div className="space-y-2">
            <Button block size="lg" disabled={!!disabledReason} onClick={claim}>رزرو فوری این بار</Button>
            <p className="rounded-ui bg-accent-50 p-3 text-[13px] leading-7 text-accent-700">
              با انتخاب این بار، <b>بلافاصله برای شما رزرو می‌شود</b>؛ نیازی به تأیید صاحب بار نیست و قیمت هم چانه‌زنی ندارد. اولین راننده‌ای که انتخاب کند برنده است و {fa(Math.round(s.config.lockSeconds / 60 * 10) / 10)} دقیقه فرصت دارد تأیید نهایی کند؛ وگرنه بار دوباره برای دیگران باز می‌شود.
            </p>
            {disabledReason && <p className="text-center text-sm text-ink-3">{disabledReason}{!verified && <> · <Link href="/driver/kyc/" className="font-bold text-accent-600">تکمیل مدارک</Link></>}</p>}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
