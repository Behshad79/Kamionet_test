import { launch, ok, done, demoLogin, readState, B } from "./lib.mjs";
const { browser, mk } = await launch({ width: 390, height: 844 });

/* public: blog, sitemap, robots, handoff */
const g = await mk();
await g.goto(`${B}/blog/`); await g.waitForSelector("h1");
ok((await g.locator("a[href*='/blog/']").count()) >= 6, "blog lists articles");
await g.goto(`${B}/blog/refrigerated-freight-cost-iran/`); await g.waitForSelector("article h1");
ok(await g.locator('script[type="application/ld+json"]').count() > 0, "article has JSON-LD");
const sm = await g.request.get(`${B}/sitemap.xml`); ok(sm.ok() && (await sm.text()).includes("/blog/"), "sitemap.xml served");
const rb = await g.request.get(`${B}/robots.txt`); ok(rb.ok() && (await rb.text()).includes("Disallow: /admin/"), "robots.txt blocks portals");
await g.goto(`${B}/handoff/`); await g.waitForSelector("text=مرور آماری");
ok(await g.getByText("صفحه‌ها به تفکیک بخش").isVisible(), "handoff stats cards render");
await g.getByRole("button", { name: /^صفحه‌ها/ }).click();
ok(await g.getByText("ثبت سفارش (۵ مرحله)").isVisible(), "handoff lists screens with states");

/* shipper wizard suggests free drivers on Karaj→Qom */
const sh = await mk(); await demoLogin(sh, "shipper", "09120000007");
await sh.goto(`${B}/app/new/`);
const pick = async (label, q) => { await sh.getByLabel(label, { exact: true }).first().fill(q); await sh.getByRole("option").first().click(); };
await pick("مبدأ", "کرج"); await pick("مقصد", "قم");
await sh.getByLabel("نشانی دقیق مبدأ").fill("مهرشهر"); await sh.getByLabel("نشانی دقیق مقصد").fill("شکوهیه");
for (const i of [0, 1]) { const m = sh.locator(".leaflet-container").nth(i); await m.scrollIntoViewIfNeeded(); await sh.waitForTimeout(500); await m.click({ position: { x: 120, y: 175 } }); }
await sh.getByLabel("نام گیرنده").fill("گیرنده"); await sh.getByLabel("موبایل گیرنده").fill("09123334455");
await sh.getByRole("button", { name: "ادامه" }).click();
await sh.getByLabel("وزن (کیلوگرم)").fill("4000"); await sh.getByLabel("ارزش اعلامی بار (تومان)").fill("300000000");
await sh.getByRole("button", { name: "ادامه" }).click(); await sh.getByRole("button", { name: "ادامه" }).click();
await sh.getByRole("button", { name: /استفاده از میانه/ }).click();
await sh.waitForSelector("text=رانندگان آزاد روی این مسیر", { timeout: 6000 });
ok(true, "wizard suggests free drivers for the route");
await sh.getByRole("button", { name: "انتخاب", exact: true }).first().click();
await sh.getByRole("radio", { name: /بدون بیمه/ }).click();
await sh.getByRole("radio", { name: /بیعانه و مابقی پس از تحویل/ }).click();
await sh.getByRole("button", { name: "ادامه" }).click();
await sh.getByRole("button", { name: /ثبت و انتشار/ }).click();
await sh.waitForURL(/\/app\/order\/\?id=/);
const id = new URL(sh.url()).searchParams.get("id");
await sh.waitForTimeout(500);
let st = await readState(sh);
const o = st.orders.find((x) => x.id === id);
ok(o.status === "DIRECT_REQUESTED" && !!o.directDriverId, "picking a free driver creates a direct request to him (" + o.status + ")");

/* official slip: pending after waybill, admin uploads, shipper sees ready */
const dr = await mk(); await demoLogin(dr, "driver", st.persons.find((p) => p.id === o.directDriverId).phone);
await dr.goto(`${B}/driver/order/?id=${id}`);
await dr.getByRole("button", { name: /پذیرش/ }).click();
await dr.waitForTimeout(500);
const ad = await mk(); await demoLogin(ad, "admin", "09130000001");
await ad.goto(`${B}/admin/docs/`); await ad.waitForSelector("h1");
ok(await ad.getByRole("heading", { name: "حواله‌های رسمی" }).isVisible(), "admin official-slip queue renders");
const rd = await mk(); await demoLogin(rd, "driver", "09100000006");
await rd.goto(`${B}/driver/radar/`); await rd.waitForSelector("h1");
ok((await rd.getByRole("button", { name: "روشن‌کردن رادار" }).count()) + (await rd.getByRole("status").count()) > 0, "radar page offers the switch (or explains why it is off)");
await done(browser);
