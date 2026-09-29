import { chromium } from "playwright";
// Run: npm run build && npx serve out -l 4173 & then  node tests/e2e/marketplace.mjs   (BASE_URL, CHROMIUM_PATH optional)
const B = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "fa-IR" });
const errors = [];
const mk = async () => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("PAGEERR " + e.message));
  p.on("console", (m) => m.type() === "error" && !/tile|openstreetmap|ERR_|404/.test(m.text()) && errors.push("CONSOLE " + m.text()));
  return p;
};
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const login = async (p, phone, as) => {
  await p.goto(`${B}/orders/`);
  await p.evaluate(() => { sessionStorage.removeItem("kamionet:session"); localStorage.removeItem("kamionet:session"); localStorage.removeItem("kamionet:driver-loc"); });
  await p.goto(`${B}/login/?as=${as}`);
  await p.fill('input[inputmode="tel"]', phone);
  await p.getByText("دریافت کد تأیید").click();
  await p.fill('input[inputmode="numeric"]', "12345");
  await p.getByText("تأیید و ورود").click();
  await p.waitForURL(new RegExp(`/${as}/`));
};

const a = await mk();
await a.goto(`${B}/orders/`);
await a.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
await a.goto(`${B}/orders/`);
await a.waitForTimeout(500);
// Make the third seeded truck driver verified so two matching drivers can race.
await a.evaluate(() => {
  const k = "kamionet:v2"; const s = JSON.parse(localStorage.getItem(k));
  s.drivers.find((d) => d.userId === "u-driver3").kyc = "verified";
  localStorage.setItem(k, JSON.stringify(s));
});

// A shipper account that is also a driver: own order must be invisible / unclaimable in driver mode.
await login(a, "09150000001", "shipper");
const own = await a.evaluate(() => {
  const k = "kamionet:v2"; const s = JSON.parse(localStorage.getItem(k));
  const me = s.users.find((u) => u.phone === "09150000001");
  const o = { ...s.orders.find((x) => x.id === "o-seed-1"), id: "o-own", groupId: "g-own", shipperId: me.id };
  s.orders.unshift(o); localStorage.setItem(k, JSON.stringify(s)); return o.id;
});
await a.goto(`${B}/driver/order/?id=${own}`);
await a.waitForTimeout(700);
ok(await a.getByText("این سفارش در دسترس نیست").isVisible(), "own order blocked in driver mode");

// Two verified truck drivers race for the same open order.
const d1 = await mk(), d2 = await mk();
await login(d1, "09351112233", "driver");
await login(d2, "09353334455", "driver");
const target = `${B}/driver/order/?id=o-seed-1`;
await d1.goto(target); await d2.goto(target);
await d1.waitForTimeout(600); await d2.waitForTimeout(600);
const claim = (p) => p.getByText("رزرو فوری این بار").click({ timeout: 4000 }).catch(() => {});
await Promise.all([claim(d1), claim(d2)]);
await d1.waitForTimeout(900); await d2.waitForTimeout(900);
const w1 = await d1.getByText("تأیید نهایی و دریافت اطلاعات").isVisible();
const w2 = await d2.getByText("تأیید نهایی و دریافت اطلاعات").isVisible();
ok(w1 !== w2, `exactly one driver holds the lock (d1=${w1}, d2=${w2})`);
const winner = w1 ? d1 : d2, loser = w1 ? d2 : d1;
ok(await loser.getByText("هم‌اکنون به راننده دیگری").first().isVisible().catch(() => false), "loser sees 'already assigned' instantly");
await winner.getByText("تأیید نهایی و دریافت اطلاعات").click();
await winner.waitForURL(/driver\/trip/);
ok(await winner.getByText("شروع سفر · مدارک بارگیری").isVisible(), "assigned → trip page with pickup form");

// Masking: guest sees no street addresses.
const g = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
await g.goto(`${B}/orders/`); await g.waitForTimeout(800);
ok(!(await g.content()).includes("خیابان"), "guest view leaks no street addresses");

console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors");
if (errors.length) process.exitCode = 1;
await browser.close();
