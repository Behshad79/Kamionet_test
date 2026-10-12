import { launch, ok, done, demoLogin, B } from "./lib.mjs";
const { browser, mk } = await launch({ width: 390, height: 844 });
const sh = await mk(); await demoLogin(sh, "shipper", "09120000007");
await sh.goto(`${B}/app/available/`);
const send = sh.getByRole("button", { name: /ارسال بار فعال من به این راننده/ }).first();
await send.waitFor({ timeout: 15000 });
ok(true, "free-driver card offers «send my active load»");
await send.click();
const pick = sh.locator('[role="dialog"] ul button').first();
if (await pick.count()) await pick.click();
await sh.waitForTimeout(1500); await sh.waitForSelector("text=منتظر پاسخ راننده", { timeout: 4000 });
ok(true, "card shows waiting-for-driver state with countdown");
/* the targeted driver gets the direct request */
const st = await sh.evaluate(() => new Promise((res) => { const r = indexedDB.open("kamionet"); r.onsuccess = () => res(null); }));
const dr = await mk();
const phones = ["09351000026", "09351000052"];
let seen = false;
for (const ph of phones) {
  await dr.goto(`${B}/driver/login/`).catch(() => {});
  await demoLogin(dr, "driver", ph);
  await dr.goto(`${B}/driver/`);
  await dr.waitForTimeout(2500);
  if (await dr.getByText(/درخواست مستقیم|شما را.*انتخاب/).first().isVisible().catch(() => false)) { seen = true; break; }
}
ok(seen, "the chosen driver sees the direct request");
await done(browser);
