import { chromium } from "playwright";
// Run: npm run build && npx serve out -l 4173 & then  npm run e2e   (BASE_URL, CHROMIUM_PATH optional)
const B = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "fa-IR", deviceScaleFactor: 2 });
const errors = [];
const p = await ctx.newPage();
p.on("pageerror", (e) => errors.push("PAGEERR " + e.message));
p.on("console", (m) => m.type() === "error" && !/tile|openstreetmap|ERR_|404/.test(m.text()) && errors.push("CONSOLE " + m.text()));
const ok = (c, m) => console.log((c ? "PASS " : "FAIL ") + m);
await p.goto(`${B}/orders/`);
await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
await p.goto(`${B}/orders/`); await p.waitForTimeout(500); // seeds
await p.evaluate(() => {
  const k = "kamionet:v2"; const s = JSON.parse(localStorage.getItem(k));
  for (const id of ["o-seed-1", "o-seed-3"]) {
    const o = s.orders.find((x) => x.id === id);
    o.status = "IN_TRANSIT"; o.driverId = "u-driver1"; o.startedAt = Date.now() - 100_000; o.assignedAt = o.startedAt - 1000; o.waybillNo = "KM-1"; o.media = [];
  }
  localStorage.setItem(k, JSON.stringify(s));
});
await p.goto(`${B}/login/?as=shipper`); await p.fill('input[inputmode="tel"]', "09121112233"); await p.getByText("دریافت کد تأیید").click();
await p.fill('input[inputmode="numeric"]', "12345"); await p.getByText("تأیید و ورود").click(); await p.waitForURL(/shipper/);
await p.goto(`${B}/shipper/order/?id=o-seed-1`); await p.waitForTimeout(1500);
ok(await p.getByText("دمای بار در مسیر").isVisible(), "temperature panel visible on in-transit order");
ok(await p.getByText("داده‌ی شبیه‌سازی‌شده").isVisible(), "telemetry honestly labelled as simulated");
ok(await p.getByText("بازه‌ی مجاز", { exact: true }).first().isVisible(), "allowed band labelled");
await p.locator("text=دمای بار در مسیر").scrollIntoViewIfNeeded();
const chart = p.locator("svg[role=img]").first(); const box = await chart.boundingBox();
await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5); await p.waitForTimeout(200);
ok(await p.getByText(/در بازه|بالاتر از بازه|پایین‌تر از بازه/).first().isVisible(), "hover tooltip with status text");
await p.screenshot({ path: `${SHOTS}/tel-inTransit.png`, fullPage: true });
await p.getByRole("button", { name: /نمایش جدول/ }).click();
ok(await p.locator("table").isVisible(), "table view available");
// delivered seed trip always has an excursion
await p.goto(`${B}/shipper/order/?id=o-seed-done`); await p.waitForTimeout(1200);
ok(await p.getByText("افزایش دما").first().isVisible(), "excursion listed in the log on the delivered trip");
await p.locator("text=گزارش تخطی‌ها").scrollIntoViewIfNeeded();
await p.screenshot({ path: `${SHOTS}/tel-delivered.png`, fullPage: true });
await p.goto(`${B}/shipper/`); await p.waitForTimeout(800);
ok(await p.getByText(/دمای بار .*°/).first().isVisible(), "live temperature badge on dashboard card");
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors");
await browser.close();
