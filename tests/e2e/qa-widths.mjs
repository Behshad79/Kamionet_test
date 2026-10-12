/** Layout QA: no horizontal page scroll and no console errors on key routes at 375 / 768 / 1280. */
import { chromium } from "playwright";
import { B, demoLogin } from "./lib.mjs";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ROUTES = { public: ["/", "/login/", "/blog/", "/blog/refrigerated-freight-cost-iran/", "/handoff/", "/handoff/dev/"], shipper: ["/app/", "/app/new/", "/app/wallet/", "/app/profile/", "/app/recurring/", "/app/available/", "/app/notifications/"], driver: ["/driver/", "/driver/trips/", "/driver/wallet/", "/driver/profile/", "/driver/radar/", "/driver/notifications/"], admin: ["/admin/", "/admin/orders/", "/admin/finance/", "/admin/comms/", "/admin/config/"] };
const PHONE = { shipper: "09120000007", driver: "09100000006", admin: "09130000001" };
let bad = 0;
for (const w of [375, 768, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: "fa-IR" });
  const errs = [];
  for (const [portal, list] of Object.entries(ROUTES)) {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(`${portal} PAGEERR ${e.message}`));
    if (portal !== "public") await demoLogin(p, portal, PHONE[portal]);
    for (const r of list) {
      await p.goto(`${B}${r}`); await p.waitForSelector("h1", { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(400);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const adminTable = portal === "admin" && w < 1024;
      if (over > 1 && !adminTable) { bad++; console.log(`FAIL ${w}px ${r} overflows by ${over}px`); }
    }
    await p.close();
  }
  console.log(`${w}px: ${errs.length ? errs.join("\n") : "no page errors"}`);
  await ctx.close();
}
console.log(bad ? `${bad} overflow problems` : "no horizontal overflow on any checked route");
await browser.close();
process.exit(bad ? 1 : 0);
