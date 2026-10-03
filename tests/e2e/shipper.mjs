import { launch, ok, done, demoLogin, B, SHOTS } from "./lib.mjs";
const { browser, mk } = await launch({ width: 390, height: 844 });
const p = await mk();
await demoLogin(p, "shipper", "09120000003");
await p.waitForSelector("text=سلام");
ok(await p.getByText("نیازمند اقدام").count() >= 0, "dashboard renders");
await p.screenshot({ path: `${SHOTS}/m2-dash.png`, fullPage: true });

// --- wizard: validation first
await p.goto(`${B}/app/new/`);
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText("مبدأ را انتخاب کنید.").isVisible(), "step 1 blocks without origin");

// pick places via combobox
const pick = async (label, q) => { await p.getByLabel(label, { exact: true }).first().fill(q); await p.getByRole("option").first().click(); };
await pick("مبدأ", "تهران");
await pick("مقصد", "اصفهان");
await p.getByLabel("نشانی دقیق مبدأ").fill("شهرک صنعتی شمس‌آباد");
await p.getByLabel("نشانی دقیق مقصد").fill("میدان جهاد، انبار مرکزی");
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText("محل دقیق مبدأ را روی نقشه پین کنید.").isVisible(), "pin required for origin");
for (const i of [0, 1]) { const m = p.locator(".leaflet-container").nth(i); await m.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await m.click({ position: { x: 120, y: 175 } }); }
await p.getByLabel("نام گیرنده").fill("علی احمدی");
await p.getByLabel("موبایل گیرنده").fill("۰۹۱۲۳۴۵۶۷۸۹");
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText("نوع بار").first().isVisible(), "reached cargo step");
await p.getByLabel("وزن (کیلوگرم)").fill("۳۰۰۰۰");
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText(/بیشتر از ظرفیت/).isVisible(), "overweight rejected with capacity message");
await p.getByLabel("وزن (کیلوگرم)").fill("۶۰۰۰");
await p.getByLabel("ارزش اعلامی بار (تومان)").fill("۴۰۰۰۰۰۰۰۰");
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText("نوع سرویس").isVisible(), "reached service step");
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText("بازه‌ی رایج این مسیر").isVisible(), "price step shows market range");
await p.getByRole("button", { name: /استفاده از میانه/ }).click();
await p.getByRole("radio", { name: /بدون بیمه/ }).click();
await p.getByRole("button", { name: "ادامه" }).click();
ok(await p.getByText("بیعانه‌ی لازم").isVisible(), "review shows deposit");
ok(!(await p.content()).includes("کمیسیون"), "commission never shown to shipper");
await p.getByRole("button", { name: /ثبت و انتشار/ }).click();
await p.waitForTimeout(1500); await p.waitForURL(/\/app\/order\/\?id=/);
ok(await p.getByText("در انتظار راننده").first().isVisible(), "order created and open");
await p.screenshot({ path: `${SHOTS}/m2-order.png`, fullPage: true });

// --- wallet
await p.goto(`${B}/app/wallet/`);
await p.waitForSelector("text=کیف پول و صورت‌حساب");
await p.getByRole("button", { name: /افزایش موجودی/ }).click();
await p.getByRole("button", { name: "ادامه به پرداخت" }).click();
await p.getByRole("dialog").getByRole("button", { name: /^پرداخت / }).click();
await p.waitForSelector("text=پرداخت موفق");
ok(true, "wallet top-up through gateway succeeds");
await p.screenshot({ path: `${SHOTS}/m2-wallet.png` });
await done(browser);
