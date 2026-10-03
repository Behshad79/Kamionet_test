import { chromium } from "playwright";
// Run: npm run build && npx serve out -l 4173 &  then  node tests/e2e/<file>.mjs  (BASE_URL, CHROMIUM_PATH optional)
export const B = process.env.BASE_URL || "http://localhost:4173";
export const SHOTS = process.env.SHOTS_DIR || "/tmp";
export const errors = [];
export async function launch(viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport, locale: "fa-IR" });
  const mk = async () => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push("PAGEERR " + e.message));
    p.on("console", (m) => m.type() === "error" && !/tile|openstreetmap|ERR_|404/.test(m.text()) && errors.push("CONSOLE " + m.text()));
    return p;
  };
  return { browser, ctx, mk };
}
let failed = 0;
export const ok = (c, m) => { if (!c) failed++; console.log((c ? "PASS " : "FAIL ") + m); };
export const done = async (browser) => {
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
};
export async function demoLogin(p, portal, phone) {
  const path = portal === "shipper" ? "app" : portal;
  await p.goto(`${B}/${path}/login/`);
  await p.waitForFunction(() => document.querySelector('input[inputmode="tel"]'));
  await p.fill('input[inputmode="tel"]', phone);
  await p.getByText("دریافت کد تأیید").click();
  await p.fill('input[inputmode="numeric"]', "12345");
  await p.getByRole("button", { name: "ورود", exact: true }).click();
  await p.waitForURL(new RegExp(`/${path}/$`));
}

export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
export const img = { name: "x.png", mimeType: "image/png", buffer: PNG };
/** Read the whole mock database straight from IndexedDB (what the app persists). */
export async function readState(p) {
  return p.evaluate(() => new Promise((res) => { const o = indexedDB.open("kamionet", 1); o.onsuccess = () => { const r = o.result.transaction("kv").objectStore("kv").get("state-v3"); r.onsuccess = () => res(r.result); }; }));
}

/** Shipper creates a Karaj→Qom order, driver claims+confirms, shipper pays the deposit, driver is brought to AT_PICKUP. */
export async function bringToPickup(sh, dr, { weight = "4000" } = {}) {
  await sh.goto(`${B}/app/new/`);
  const pick = async (label, q) => { await sh.getByLabel(label, { exact: true }).first().fill(q); await sh.getByRole("option").first().click(); };
  await pick("مبدأ", "کرج"); await pick("مقصد", "قم");
  await sh.getByLabel("نشانی دقیق مبدأ").fill("مهرشهر، بلوار ارم"); await sh.getByLabel("نشانی دقیق مقصد").fill("شکوهیه، خیابان صنعت");
  for (const i of [0, 1]) { const m = sh.locator(".leaflet-container").nth(i); await m.scrollIntoViewIfNeeded(); await sh.waitForTimeout(500); await m.click({ position: { x: 120, y: 175 } }); }
  await sh.getByLabel("نام گیرنده").fill("گیرنده تست"); await sh.getByLabel("موبایل گیرنده").fill("09123334455");
  await sh.getByRole("button", { name: "ادامه" }).click();
  await sh.getByLabel("وزن (کیلوگرم)").fill(weight); await sh.getByLabel("ارزش اعلامی بار (تومان)").fill("300000000");
  await sh.getByRole("button", { name: "ادامه" }).click(); await sh.getByRole("button", { name: "ادامه" }).click();
  await sh.getByRole("button", { name: /استفاده از میانه/ }).click(); await sh.getByRole("radio", { name: /بدون بیمه/ }).click();
  await sh.getByRole("radio", { name: /بیعانه و مابقی پس از تحویل/ }).click();
  await sh.getByRole("button", { name: "ادامه" }).click();
  await sh.getByRole("button", { name: /ثبت و انتشار/ }).click();
  await sh.waitForURL(/\/app\/order\/\?id=/);
  const id = new URL(sh.url()).searchParams.get("id");
  await sh.waitForTimeout(600);
  await dr.goto(`${B}/driver/order/?id=${id}`);
  await dr.getByRole("button", { name: /انتخاب این بار/ }).click();
  await dr.getByRole("button", { name: "تأیید نهایی" }).click();
  await dr.waitForTimeout(800);
  await sh.reload(); await sh.waitForSelector("text=پرداخت بیعانه");
  await sh.getByRole("button", { name: /^پرداخت بیعانه/ }).click();
  await sh.getByRole("dialog").getByRole("button", { name: /^پرداخت / }).last().click();
  await sh.waitForSelector("text=پرداخت موفق");
  await sh.waitForTimeout(600);
  await dr.goto(`${B}/driver/trip/?id=${id}`);
  await dr.getByRole("button", { name: "شروع حرکت به مبدأ" }).click();
  await dr.getByRole("button", { name: "به مبدأ رسیدم" }).click();
  return id;
}
