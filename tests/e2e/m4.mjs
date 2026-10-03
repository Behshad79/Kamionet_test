import { launch, ok, done, demoLogin, readState, bringToPickup, img, B, SHOTS } from "./lib.mjs";
const { browser, mk } = await launch({ width: 390, height: 844 });
const sh = await mk(); await demoLogin(sh, "shipper", "09120000007");
const dr = await mk(); await demoLogin(dr, "driver", "09100000006");
const id = await bringToPickup(sh, dr);
ok(!!id, "order at pickup " + id);

/* ───── mismatch: driver reports, shipper approves + pays the difference, loading resumes with waybill v2 ───── */
await dr.getByRole("button", { name: "گزارش مغایرت بار" }).click();
await dr.getByRole("checkbox", { name: /وزن بیشتر از اظهار/ }).check();
await dr.getByLabel(/وزن واقعی/).fill("5500");
for (let i = 0; i < 2; i++) await dr.locator('input[type=file]').nth(i + 2).setInputFiles(img).catch(() => {});
await dr.waitForFunction(() => document.querySelectorAll("img[alt^='عکس']").length >= 2, null, { timeout: 8000 });
ok(await dr.getByText("محاسبه‌ی کرایه‌ی پیشنهادی").isVisible(), "formula preview shown");
await dr.getByRole("button", { name: "ارسال برای صاحب بار" }).click();
await dr.waitForSelector("text=در انتظار تصمیم صاحب بار");
ok(true, "mismatch reported (needs ≥2 photos)");
await sh.waitForTimeout(700); await sh.reload();
await sh.waitForSelector("text=مغایرت بار");
await sh.screenshot({ path: `${SHOTS}/m4-mismatch.png`, fullPage: true });
await sh.getByRole("button", { name: /تأیید و اصلاح بارنامه/ }).click();
await sh.waitForSelector("text=پرداخت مابه‌التفاوت");
await sh.getByRole("button", { name: "پرداخت مابه‌التفاوت" }).click();
await sh.getByRole("button", { name: /^پرداخت / }).last().click();
await sh.waitForSelector("text=پرداخت موفق");
await sh.waitForTimeout(800);
let st = await readState(sh);
let o = st.orders.find((x) => x.id === id);
ok(o.status === "AT_PICKUP" && o.waybills.length === 2, `after payment loading resumes with waybill v${o.waybills.length} (${o.status})`);
ok(st.ledger.reduce((n, e) => n + e.amount, 0) === 0, "ledger balanced after mismatch");

/* ───── trip → tracking page for the consignee ───── */
await dr.reload();
await dr.waitForSelector("text=بارگیری");
await dr.locator('input[type=file]').nth(0).setInputFiles(img);
await dr.locator('input[type=file]').nth(1).setInputFiles(img);
await dr.waitForFunction(() => document.querySelectorAll("img[alt]").length >= 2, null, { timeout: 8000 });
await dr.getByRole("button", { name: /بارگیری شد؛ شروع سفر/ }).click();
await dr.waitForSelector("text=به مقصد رسیدم");
const token = (await readState(dr)).orders.find((x) => x.id === id).consignee.token;
const tr = await mk(); await tr.goto(`${B}/track/?t=${token}`);
await tr.waitForSelector("text=کد تحویل شما");
ok(true, "consignee tracking shows the delivery code without login");
await tr.screenshot({ path: `${SHOTS}/m4-track.png`, fullPage: true });
const demo = await mk(); await demo.goto(`${B}/track/demo/`); await demo.waitForURL(/t=demo/); await demo.waitForSelector("text=رهگیری بار");
ok(true, "/track/demo sample link works");

/* ───── certificate + support ───── */
const cert = await mk(); await cert.goto(`${B}/certificate/?t=${token}`);
await cert.waitForSelector("text=گواهی زنجیره‌ی سرد");
ok(true, "certificate renders");
await sh.goto(`${B}/app/wallet/`);
await sh.getByRole("button", { name: /^پشتیبانی/ }).click();
ok(await sh.getByText("پشتیبانی مالی و کیف پول").first().isVisible(), "support widget opens on the finance channel from the wallet");
await sh.getByLabel("شرح مشکل").fill("پرداخت من اعمال نشده است.");
await sh.getByRole("button", { name: "ثبت درخواست" }).click();
await sh.waitForSelector("text=درخواست شما ثبت شد");
ok(true, "ticket created from the widget");
await done(browser);
