"use client";

import { CheckCircle2, FileCheck2, XCircle } from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { VerificationBadge } from "@/components/molecules";
import { toast } from "@/components/Toaster";
import { Button, Card, EmptyState, Modal, Textarea } from "@/components/ui";
import { degrees, jDateTime, jNum, relative, VEHICLES } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { reviewKyc } from "@/lib/store";

export default function AdminKyc() {
  const { s } = useApp();
  const [rej, setRej] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const q = s.drivers.filter((d) => d.kyc === "pending");
  const rest = s.drivers.filter((d) => d.kyc !== "pending" && d.kyc !== "none" && d.kyc !== "draft");
  const name = (id: string) => s.users.find((u) => u.id === id)?.name ?? "—";

  return (
    <AdminShell title="احراز هویت رانندگان">
      {q.length === 0 ? <EmptyState icon={<FileCheck2 className="size-7" />} title="صف بررسی خالی است" body="مدارک جدید که ارسال شود اینجا می‌آید." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.map((d) => {
            const imgs = Object.entries(d.docs).filter(([, v]) => v?.dataUrl);
            return (
              <Card key={d.userId} className="animate-rise space-y-3 p-5">
                <div className="flex items-center justify-between"><b className="text-lg">{name(d.userId)}</b><span className="text-xs text-ink-3">{d.submittedAt ? relative(d.submittedAt) : ""}</span></div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-ink-3">خودرو</dt><dd className="font-bold">{VEHICLES[d.vehicle.type]}</dd></div>
                  <div><dt className="text-ink-3">پلاک</dt><dd className="font-bold">{d.vehicle.plate}</dd></div>
                  <div><dt className="text-ink-3">یخچال</dt><dd className="font-bold">{d.vehicle.fridgeBrand}</dd></div>
                  <div><dt className="text-ink-3">حداقل دما</dt><dd className="font-bold" dir="ltr">{degrees(d.vehicle.minTemp)}</dd></div>
                  <div><dt className="text-ink-3">انقضای بیمه</dt><dd className="font-bold">{d.docs.insurance?.expiresAt ? jNum(d.docs.insurance.expiresAt) : "—"}</dd></div>
                  <div><dt className="text-ink-3">انقضای معاینه فنی</dt><dd className="font-bold">{d.docs.inspection?.expiresAt ? jNum(d.docs.inspection.expiresAt) : "—"}</dd></div>
                </dl>
                {imgs.length ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {imgs.map(([k, v]) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={k} href={v!.dataUrl} target="_blank" rel="noreferrer"><img src={v!.dataUrl} alt={k} className="aspect-square rounded-lg object-cover" /></a>
                    ))}
                  </div>
                ) : <p className="rounded-ui bg-surface-2 p-3 text-xs text-ink-3">داده‌ی نمونه؛ تصویری بارگذاری نشده است.</p>}
                <div className="flex gap-2 pt-1">
                  <Button variant="danger" className="flex-1" onClick={() => { setRej(d.userId); setReason(""); }}><XCircle className="size-4" />نیاز به اصلاح</Button>
                  <Button className="flex-1" onClick={() => { reviewKyc(d.userId, true); toast(`${name(d.userId)} تأیید شد`); }}><CheckCircle2 className="size-4" />تأیید</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {rest.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-bold">بررسی‌شده‌ها</h2>
          <Card className="divide-y divide-line">
            {rest.map((d) => (
              <div key={d.userId} className="flex items-center justify-between p-4 text-sm"><span className="font-bold">{name(d.userId)}</span><span className="text-ink-3">{VEHICLES[d.vehicle.type]}</span><VerificationBadge standing={d.kyc} /></div>
            ))}
          </Card>
        </>
      )}
      <Modal open={!!rej} onClose={() => setRej(null)} title="درخواست اصلاح مدارک">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً تصویر سلفی واضح نیست" />
        <Button className="mt-4" block variant="danger" disabled={reason.trim().length < 3} onClick={() => { reviewKyc(rej!, false, reason.trim()); setRej(null); toast("درخواست اصلاح ارسال شد", "info"); }}>ارسال به راننده</Button>
      </Modal>
      <span className="hidden">{jDateTime(0)}</span>
    </AdminShell>
  );
}
