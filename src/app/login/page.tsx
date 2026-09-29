"use client";

import { ArrowLeft, MessageSquareText, Truck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { toast } from "@/components/Toaster";
import { Button, Card, Field, Input, Segmented } from "@/components/ui";
import { useApp } from "@/lib/hooks";
import { login, OTP_CODE, switchRole } from "@/lib/store";
import type { Role } from "@/lib/types";

function LoginForm() {
  const router = useRouter();
  const { me, admin, ready, role: sessionRole } = useApp();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<Role>("shipper");
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const as = q.get("as");
    if (as === "driver" || as === "shipper") setRole(as);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = new URLSearchParams(window.location.search).get("next");
    // Already signed in: never show the form; go where their current role lives.
    if (admin) router.replace("/admin/");
    else if (me) router.replace(next && next.startsWith("/") ? next : `/${sessionRole}/`);
  }, [ready, me, admin, router, sessionRole]);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  if (ready && (me || admin)) {
    return (
      <div className="mx-auto max-w-md pt-4" role="status">
        <Card className="space-y-3 p-6"><div className="skeleton h-7 w-40" /><div className="skeleton h-12 w-full" /><p className="text-sm text-ink-3">شما وارد شده‌اید؛ در حال انتقال به داشبورد…</p></Card>
      </div>
    );
  }

  const sendCode = () => {
    if (!/^(09|۰۹)[\d۰-۹]{9}$/.test(phone.replace(/\s/g, ""))) return setErr("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷");
    setErr("");
    setStep("code");
    setLeft(60);
    toast(`کد تأیید ارسال شد (نسخه‌ی نمایشی: ${new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(+OTP_CODE)})`, "info");
  };

  const verify = () => {
    const r = login(phone, code.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))), name);
    if (!r.ok) return setErr(r.error);
    switchRole(role);
  };

  return (
    <div className="mx-auto max-w-md pt-4">
      <Card className="animate-rise space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-black">{step === "phone" ? "ورود یا ثبت‌نام" : "کد تأیید را وارد کنید"}</h1>
          <p className="mt-1.5 text-sm leading-7 text-ink-3">
            {step === "phone" ? "با شماره‌ی موبایل وارد شوید؛ حساب شما هر دو نقش صاحب بار و راننده را پشتیبانی می‌کند." : "کد ۵ رقمی به شماره‌ی شما پیامک شد."}
          </p>
        </div>

        {step === "phone" ? (
          <>
            <Field label="شماره موبایل" error={err}>
              {(id) => <Input id={id} dir="ltr" inputMode="tel" placeholder="09121234567" value={phone} className="text-start tabular" onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCode()} autoFocus />}
            </Field>
            <Field label="نام و نام خانوادگی (اختیاری)">
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی احمدی" />}
            </Field>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-ink-2">می‌خواهید چه کاری انجام دهید؟</span>
              <Segmented value={role} onChange={setRole} options={[
                { value: "shipper", label: <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" />بار دارم</span>, sub: "ثبت سفارش حمل" },
                { value: "driver", label: <span className="inline-flex items-center gap-1.5"><Truck className="size-4" />راننده‌ام</span>, sub: "دریافت بار" },
              ]} />
            </div>
            <Button block size="lg" onClick={sendCode}><MessageSquareText className="size-5" />دریافت کد تأیید</Button>
          </>
        ) : (
          <>
            <Field label="کد تأیید" error={err} hint={`ارسال‌شده به ${phone}`}>
              {(id) => <Input id={id} dir="ltr" inputMode="numeric" maxLength={5} placeholder="•••••" value={code} className="text-center text-2xl font-black tracking-[0.5em] tabular" onChange={(e) => { setCode(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && verify()} autoFocus />}
            </Field>
            <Button block size="lg" onClick={verify} disabled={code.length < 5}>تأیید و ورود <ArrowLeft className="size-5" /></Button>
            <div className="flex items-center justify-between text-sm">
              <button className="text-accent-600" onClick={() => { setStep("phone"); setCode(""); setErr(""); }}>ویرایش شماره</button>
              {left > 0 ? <span className="text-ink-3 tabular">ارسال مجدد تا {new Intl.NumberFormat("fa-IR").format(left)} ثانیه</span> : <button className="font-bold text-accent-600" onClick={() => { setLeft(60); toast("کد دوباره ارسال شد", "info"); }}>ارسال مجدد کد</button>}
            </div>
          </>
        )}
      </Card>
      <p className="mt-4 text-center text-xs leading-6 text-ink-3">نسخه‌ی نمایشی: کد تأیید همیشه <b className="tabular">۱۲۳۴۵</b> است.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense><LoginForm /></Suspense>
    </AppShell>
  );
}
