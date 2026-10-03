import { launch, ok, done, demoLogin, readState, B, SHOTS } from "./lib.mjs";
import { ADMIN_SLUGS } from "./slugs.mjs";
const { browser, mk } = await launch({ width: 1440, height: 900 });
const a = await mk(); await demoLogin(a, "admin", "09130000001");
a.on("dialog", (d) => d.accept());

/* every module renders for the super admin, with the sidebar and a heading */
for (const slug of ADMIN_SLUGS) {
  await a.goto(`${B}/admin/${slug ? slug + "/" : ""}`);
  await a.waitForSelector("h1", { timeout: 8000 });
  const h = (await a.locator("h1").first().innerText()).trim();
  ok(h.length > 0 && !h.includes("دسترسی ندارید") && !h.includes("پیدا نشد"), `module /${slug} → ${h}`);
}
await a.goto(`${B}/admin/`); await a.waitForSelector("h1");
await a.screenshot({ path: `${SHOTS}/admin-dash.png` });
await a.goto(`${B}/admin/finance/`); await a.waitForSelector("text=سلامت دفتر کل");
ok(await a.getByText("همه‌ی ۳ قید برقرار است").isVisible(), "ledger invariants healthy in finance overview");
await a.screenshot({ path: `${SHOTS}/admin-finance.png`, fullPage: true });

/* command palette */
await a.keyboard.press("Control+k");
await a.getByRole("combobox", { name: "جستجو" }).fill("پرداخت");
ok(await a.locator("#cmdk-list [role=option]").first().isVisible(), "command palette lists modules");
await a.keyboard.press("Enter");
await a.waitForURL(/admin\/payments/);
ok(true, "palette navigates");

/* config change is applied + audited */
await a.goto(`${B}/admin/config/`); await a.waitForSelector("text=کارمزد پایه");
await a.getByRole("button", { name: "ویرایش" }).first().click();
await a.getByRole("dialog").getByRole("spinbutton").or(a.getByRole("dialog").locator("input").first()).fill("21");
await a.getByRole("dialog").getByRole("button", { name: "ذخیره" }).click();
await a.waitForTimeout(500);
let st = await readState(a);
ok(Math.abs(st.config.values["commission.standard"] - 0.21) < 1e-9, "commission.standard changed to 21%");
ok(st.audit.some((x) => x.action === "config.set"), "config change audited");

/* demo director: payout batch + invariants */
await a.goto(`${B}/admin/`); await a.waitForSelector("h1");
await a.getByRole("button", { name: "کارگردان دمو" }).click();
await a.getByRole("button", { name: "ثبت سفارش باز" }).click();
await a.getByRole("button", { name: "اجرای دسته‌ی برداشت" }).click();
await a.getByRole("button", { name: "واریز ناشناس (حساب معلق)" }).click();
await a.waitForTimeout(600);
st = await readState(a);
ok(st.ledger.reduce((n, e) => n + e.amount, 0) === 0, "ledger still balanced after director actions");
ok(st.batches.some((b) => b.status === "RECONCILED"), "payout batch reconciled by director");

/* RBAC: accountant sees finance but not support/dispatch, and cannot act */
const b = await mk(); await demoLogin(b, "admin", "09130000007");
await b.goto(`${B}/admin/finance/`); await b.waitForSelector("h1");
ok(await b.getByRole("link", { name: "مرور مالی و دفتر کل" }).isVisible(), "accountant sees finance");
ok((await b.getByRole("link", { name: "کنسول توزیع بار" }).count()) === 0, "accountant nav hides dispatch");
await b.goto(`${B}/admin/dispatch/`); await b.waitForSelector("h1");
ok(await b.getByText("دسترسی ندارید").isVisible(), "direct URL to dispatch shows Denied");

/* mobile: drawer navigation works */
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fa-IR" });
const mp = await m.newPage(); await demoLogin(mp, "admin", "09130000001");
await mp.goto(`${B}/admin/orders/`); await mp.waitForSelector("h1");
await mp.getByRole("button", { name: "باز کردن منو" }).click();
ok(await mp.getByRole("dialog", { name: "منوی مدیریت" }).isVisible(), "mobile admin drawer opens");
await mp.screenshot({ path: `${SHOTS}/admin-mobile.png` });
ok(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no horizontal page scroll on mobile");
await done(browser);
