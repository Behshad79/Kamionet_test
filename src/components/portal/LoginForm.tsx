"use client";

import { ArrowRight, KeyRound, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAdmin, loginPerson, normalizePhone, OTP_CODE, DEMO_MODE, PORTAL_HOME } from "@/lib/store";
import { useStore } from "@/lib/store";
import type { PortalId } from "@/lib/types";
import { Logo, PortalCue } from "../brand";
import { Button, Card, Field, Input } from "../ui";
import { DemoAccounts } from "./DemoDrawer";

const COPY: Record<PortalId, { cue: string; title: string; sub: string }> = {
  shipper: { cue: "پنل صاحب بار", title: "ورود به پنل صاحب بار", sub: "سفارش ثبت کنید، مسیر بار را زنده ببینید و دمای زنجیره‌ی سرد را کنترل کنید." },
  driver: { cue: "اپ راننده", title: "ورود به اپ راننده", sub: "بار مناسب مسیر خودتان را انتخاب کنید؛ کرایه‌ی شفاف، پرداخت مطمئن." },
  admin: { cue: "مدیریت", title: "ورود به کنسول مدیریت", sub: "فقط برای اعضای تیم کامیونت." },
};

export function LoginForm({ portal }: { portal: PortalId }) {
  const router = useRouter();
  const s = useStore();
  const c = COPY[portal];
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const p = normalizePhone(phone);
  const known = s.persons.some((x) => x.phone === p) || s.admins.some((x) => x.phone === p);
  const validPhone = /^09\d{9}$/.test(p);
  const needName = portal !== "admin" && step === "code" && !known;

  const next = () => {
    setErr("");
    if (!validPhone) return setErr("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷");
    setStep("code");
  };
  const submit = async () => {
    setErr("");
    if (needName && name.trim().length < 3) return setErr("نام و نام خانوادگی را وارد کنید.");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 350));
    const r = portal === "admin" ? loginAdmin(phone, code) : loginPerson(portal, phone, code, name);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.replace(PORTAL_HOME[portal]);
  };

  return (
    <main data-portal={portal} className="min-h-dvh bg-tint">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="صفحه‌ی اصلی کامیونت"><Logo /></Link>
          <PortalCue label={c.cue} tone={portal} />
        </div>
        <Card className="space-y-5 p-6">
          <div>
            <h1 className="text-xl font-black">{c.title}</h1>
            <p className="mt-1.5 text-sm leading-6 text-ink-3">{c.sub}</p>
          </div>
          {step === "phone" ? (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); next(); }}>
              <Field label="شماره موبایل" error={err}>
                {(id) => <Input id={id} inputMode="tel" autoComplete="tel" dir="ltr" className="text-left" placeholder="۰۹۱۲۱۲۳۴۵۶۷" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />}
              </Field>
              <Button block size="lg" type="submit"><Smartphone className="size-5" aria-hidden />دریافت کد تأیید</Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <button type="button" onClick={() => setStep("phone")} className="inline-flex h-11 items-center gap-1 text-sm font-medium text-accent-600"><ArrowRight className="size-4" aria-hidden />{p} · ویرایش شماره</button>
              {needName && <Field label="نام و نام خانوادگی">{(id) => <Input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}</Field>}
              <Field label="کد تأیید" hint={DEMO_MODE ? `در نسخه‌ی نمایشی، کد همیشه ${OTP_CODE.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])} است.` : undefined} error={err}>
                {(id) => <Input id={id} inputMode="numeric" autoComplete="one-time-code" dir="ltr" className="text-center text-lg tracking-[0.5em]" maxLength={5} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
              </Field>
              <Button block size="lg" type="submit" loading={busy}><KeyRound className="size-5" aria-hidden />ورود</Button>
            </form>
          )}
        </Card>
        {DEMO_MODE && <DemoAccounts portal={portal} compact />}
        <p className="text-center text-xs text-ink-3">{portal === "admin" ? "" : <>ورود به بخش دیگر؟ <Link href="/login/" className="font-bold text-accent-600">انتخاب پورتال</Link></>}</p>
      </div>
    </main>
  );
}
