"use client";

import { AdminShell } from "@/components/AdminShell";
import { toast } from "@/components/Toaster";
import { Card, Field, Input, Segmented } from "@/components/ui";
import { fa } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { setConfig } from "@/lib/store";

export default function AdminSettings() {
  const { s } = useApp();
  const c = s.config;
  return (
    <AdminShell title="تنظیمات سیستم">
      <div className="max-w-2xl space-y-4">
        <Card className="space-y-4 p-5">
          <div><h2 className="font-bold">حالت بیمه‌ی بار</h2><p className="mt-1 text-sm leading-7 text-ink-3">با یک کلیک برای همه‌ی سفارش‌های جدید اعمال می‌شود؛ در حالت اجباری، سوییچ بیمه در فرم قفل و روشن می‌ماند و هزینه‌اش همیشه در مجموع لحاظ می‌شود.</p></div>
          <Segmented value={c.insuranceMode} onChange={(v) => { setConfig({ insuranceMode: v }); toast(v === "mandatory" ? "بیمه اجباری شد" : "بیمه اختیاری شد", "info"); }} options={[
            { value: "optional", label: "اختیاری", sub: "کاربر تصمیم می‌گیرد" },
            { value: "mandatory", label: "اجباری", sub: "همیشه روشن و قفل" },
          ]} />
          <Field label="نرخ بیمه (درصد از ارزش اعلامی بار)" hint="مبنا ارزش بار است نه کرایه؛ پیشنهاد: ۰٫۲ تا ۰٫۵ درصد">
            {(id) => <Input id={id} dir="ltr" className="w-32 text-start tabular" defaultValue={+(c.insuranceRate * 100).toFixed(3)} onBlur={(e) => { const n = parseFloat(e.target.value); if (n > 0 && n < 5) { setConfig({ insuranceRate: n / 100 }); toast("ذخیره شد", "info"); } }} />}
          </Field>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-bold">کارمزد و قفل سفارش</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="کارمزد کامیونت (درصد)" hint={`سهم راننده ${fa(100 - c.commission * 100)}٪`}>
              {(id) => <Input id={id} dir="ltr" className="text-start tabular" defaultValue={c.commission * 100} onBlur={(e) => { const n = parseFloat(e.target.value); if (n >= 0 && n < 60) { setConfig({ commission: n / 100 }); toast("ذخیره شد", "info"); } }} />}
            </Field>
            <Field label="جریمه‌ی لغو پس از تعیین راننده (درصد کرایه)" hint="قبل از تعیین راننده لغو رایگان است">
              {(id) => <Input id={id} dir="ltr" className="text-start tabular" defaultValue={+(c.cancelFeePct * 100).toFixed(1)} onBlur={(e) => { const n = parseFloat(e.target.value); if (n >= 0 && n <= 50) { setConfig({ cancelFeePct: n / 100 }); toast("ذخیره شد", "info"); } }} />}
            </Field>
            <Field label="مهلت تأیید نهایی راننده (ثانیه)" hint="پیشنهاد: ۱۲۰ تا ۱۸۰ ثانیه">
              {(id) => <Input id={id} dir="ltr" className="text-start tabular" defaultValue={c.lockSeconds} onBlur={(e) => { const n = parseInt(e.target.value); if (n >= 30 && n <= 600) { setConfig({ lockSeconds: n }); toast("ذخیره شد", "info"); } }} />}
            </Field>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
