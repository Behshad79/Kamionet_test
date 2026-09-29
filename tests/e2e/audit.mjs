import { chromium } from "playwright";
// Run: npm run build && npx serve out -l 4173 & then  npm run e2e   (BASE_URL, CHROMIUM_PATH optional)
const B = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "/tmp";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: "fa-IR" });
const errors = [];
const mk = async () => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push("PAGEERR " + e.message)); p.on("console", (m) => m.type() === "error" && !/tile|openstreetmap|ERR_|404/.test(m.text()) && errors.push("CONSOLE " + m.text())); return p; };
const ok = (c, m) => console.log((c ? "PASS " : "FAIL ") + m);
const clear = async (p) => { await p.goto(`${B}/orders/`); await p.evaluate(() => { sessionStorage.removeItem("kamionet:session"); localStorage.removeItem("kamionet:session"); }); };
const login = async (p, phone, as) => { await clear(p); await p.goto(`${B}/login/?as=${as}`); await p.fill('input[inputmode="tel"]', phone); await p.getByText("دریافت کد تأیید").click(); await p.fill('input[inputmode="numeric"]', "12345"); await p.getByText("تأیید و ورود").click(); await p.waitForURL(new RegExp(`/${as}/`)); };

// fresh data
const a = await mk();
await a.goto(`${B}/orders/`); await a.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });

// ---- guest landing
const g = await mk(); await clear(g); await g.goto(`${B}/`); await g.waitForTimeout(1200);
ok(!(await g.content()).includes("بدون واسطه"), "tagline no longer claims 'no middleman'");
ok(await g.getByText("مستقیم، شفاف، بیمه‌شده").first().isVisible(), "new tagline shown");
ok(await g.getByRole("navigation", { name: "ناوبری اصلی" }).first().isVisible(), "guest header has navigation");
const routes = await g.locator("main section").last().locator("text=/←|→/").count();
const html = await g.content();
const cities = await g.locator("section").last().locator(".font-bold.leading-6").allTextContents();
const origins = cities.filter((_, i) => i % 2 === 0);
ok(new Set(origins).size === origins.length && origins.length >= 3, "sample loads show varied routes: " + cities.join(" ← "));
ok((await g.locator('a:has(button), button:has(a)').count()) === 0, "no nested a>button / button>a on landing");
const mb = await g.locator(".leaflet-container").first().boundingBox();
ok(!!mb && mb.height > 150 && mb.width > 200, `hero map has real size (${mb && Math.round(mb.width)}×${mb && Math.round(mb.height)})`);
await g.screenshot({ path: `${SHOTS}/f-landing-guest.png`, fullPage: true });

// ---- login redirect for signed-in user
await login(a, "09150000001", "shipper");
await a.goto(`${B}/login/`); await a.waitForURL(/shipper/, { timeout: 5000 }).catch(() => {});
ok(/\/shipper\/?$/.test(new URL(a.url()).pathname), "signed-in user is redirected away from /login");
await a.goto(`${B}/`); await a.waitForTimeout(800);
ok(!(await a.content()).includes("برای دیدن نوع بار، دما و زمان، وارد شوید"), "landing respects auth state (no guest copy)");
ok(await a.getByText("امروز چه باری داری؟").isVisible(), "logged-in landing greets user");
await a.screenshot({ path: `${SHOTS}/f-landing-user.png`, fullPage: true });

// ---- 2-vehicle order → grouped card
await a.goto(`${B}/shipper/new/`);
const c = a.getByRole("combobox");
await c.nth(0).click(); await c.nth(0).fill("تهران"); await a.getByRole("option").first().click();
await a.locator('input[placeholder^="خیابان"]').nth(0).fill("انبار ۱");
await c.nth(1).click(); await c.nth(1).fill("اصفهان"); await a.getByRole("option").first().click();
await a.locator('input[placeholder^="خیابان"]').nth(1).fill("انبار ۲");
await a.getByText("مرحله‌ی بعد").click();
await a.getByPlaceholder("مثلاً ۸٬۰۰۰").fill("8000"); await a.getByPlaceholder(/۵٬۰۰۰٬۰۰۰٬۰۰۰/).fill("640000000");
await a.getByText("مرحله‌ی بعد").click();
await a.getByRole("button", { name: "زیاد" }).click();
ok(await a.getByText(/جمعاً|مجموع ۲ برابر/).first().isVisible(), "multi-vehicle copy explains per-vehicle amounts");
await a.getByText("مرحله‌ی بعد").click(); await a.getByText("مرحله‌ی بعد").click();
const total = await a.locator("dl").filter({ hasText: "مجموع پرداختی" }).first().textContent();
ok(/۲ خودرو/.test(total), "review shows total for 2 vehicles");
await a.getByText("ثبت و انتشار سفارش").click(); await a.waitForURL(/shipper\/order/);
await a.goto(`${B}/shipper/`); await a.waitForTimeout(600);
ok(await a.getByText("سفارش ۲ خودرویی").isVisible(), "multi-vehicle order grouped under one parent card");
ok(await a.getByRole("button", { name: /^همه \(/ }).isVisible(), "filter chips show counts");
await a.screenshot({ path: `${SHOTS}/f-shipper-dash.png`, fullPage: true });

// ---- driver: list default, filters, clustering, map
const d1 = await mk(); await login(d1, "09351112233", "driver");
await d1.goto(`${B}/driver/`); await d1.waitForTimeout(1200);
ok((await d1.getByRole("tab", { name: "لیست" }).getAttribute("aria-selected")) === "true", "driver market defaults to LIST view");
ok(!(await d1.locator("main").textContent()).includes("در انتظار راننده"), "no redundant 'awaiting driver' badge in open list");
ok(await d1.getByText("مقصد دلخواه (بار برگشتی)").isVisible(), "return-trip destination filter present");
await d1.getByRole("combobox").first().click(); await d1.getByRole("combobox").first().fill("تهران"); await d1.getByRole("option").first().click();
await d1.waitForTimeout(400);
ok(await d1.getByText(/کیلومتر تا مبدأ بار/).first().isVisible(), "cards show distance from my location");
ok(await d1.getByText(/تن|کیلوگرم/).first().isVisible() && await d1.getByText(/تا .*:|تحویل تا/).first().isVisible(), "cards show weight and delivery deadline");
ok(await d1.locator('[aria-label^="امتیاز"]').first().isVisible(), "cards show shipper rating");
await d1.screenshot({ path: `${SHOTS}/f-driver-list.png`, fullPage: false });
await d1.getByRole("tab", { name: "نقشه" }).click(); await d1.waitForTimeout(1500);
const pins = await d1.locator(".km-pin").count();
const clusters = await d1.locator(".km-pin.cluster").count();
ok(pins > 0, `map renders pins (${pins}, clusters: ${clusters})`);
ok(!(await d1.locator(".km-pin.order").allTextContents()).some((t) => /^[\d۰-۹.٫]+ م$/.test(t.trim())), "price pills are explicit, not bare 'م'");
await d1.screenshot({ path: `${SHOTS}/f-driver-map.png` });
// claim copy + race
await d1.getByRole("tab", { name: "لیست" }).click();
await d1.locator('a[href*="/driver/order/"]').first().click(); await d1.waitForURL(/driver\/order/);
ok(await d1.getByText("بلافاصله برای شما رزرو می‌شود").isVisible(), "assignment model is explicit at the point of selection");
await d1.screenshot({ path: `${SHOTS}/f-driver-order.png`, fullPage: true });

// ---- vehicle-type matching: khavar driver must not see truck10-only orders
const d2 = await mk(); await login(d2, "09352223344", "driver"); await d2.evaluate(() => localStorage.removeItem("kamionet:driver-loc")); await d2.goto(`${B}/driver/`); await d2.waitForTimeout(1000);
const txt = await d2.locator("main").textContent();
ok(!txt.includes("کامیون ۱۰ تنی"), "khavar driver sees no 10-ton-truck loads (type is part of matching)");
ok(txt.includes("خاور"), "khavar driver sees khavar loads");

// ---- cancel dialog with penalty after assignment
const d3 = await mk(); await login(d3, "09351112233", "driver");
await d3.goto(`${B}/driver/`); await d3.waitForTimeout(800);
const mine = await a.evaluate(() => JSON.parse(localStorage.getItem("kamionet:v2")).orders.filter((o) => o.shipperId !== "u-shipper1" && o.status === "OPEN").length);
await a.goto(`${B}/shipper/`); await a.locator('a[href*="/shipper/order/?id="]').first().click(); await a.waitForURL(/shipper\/order/);
const oid = new URL(a.url()).searchParams.get("id");
await a.evaluate((id) => { const k = "kamionet:v2"; const s = JSON.parse(localStorage.getItem(k)); const o = s.orders.find((x) => x.id === id); o.status = "ASSIGNED"; o.driverId = "u-driver1"; o.assignedAt = Date.now(); o.waybillNo = "KM-9"; localStorage.setItem(k, JSON.stringify(s)); }, oid);
await a.reload(); await a.waitForTimeout(600);
await a.getByRole("button", { name: /لغو سفارش/ }).click();
ok(await a.getByText(/جریمه‌ی لغو|جریمه/).first().isVisible(), "cancel dialog states the penalty after assignment");
const btn = a.getByRole("button", { name: /لغو با جریمه/ });
ok(await btn.isDisabled(), "cancel-with-penalty needs explicit acknowledgement");
await a.screenshot({ path: `${SHOTS}/f-cancel.png` });
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no page errors");
await browser.close();
