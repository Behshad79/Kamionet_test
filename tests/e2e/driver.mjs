import { launch, ok, done, demoLogin, readState, bringToPickup, img, B, SHOTS } from "./lib.mjs";
const { browser, ctx, mk } = await launch({ width: 390, height: 844 });

/* ───── A. brand-new driver completes the resumable KYC wizard ───── */
const a = await mk();
await a.goto(`${B}/driver/login/`);
await a.waitForSelector('input[inputmode="tel"]');
await a.fill('input[inputmode="tel"]', "09199990001");
await a.getByText("دریافت کد تأیید").click();
await a.getByLabel("نام و نام خانوادگی").fill("تست راننده");
await a.fill('input[inputmode="numeric"]', "12345");
await a.getByRole("button", { name: "ورود", exact: true }).click();
await a.waitForURL(/\/driver\/$/);
// first run: walkthrough, then the (open) load board with the verification banner
await a.waitForSelector("text=بارهای یخچالی را ببینید");
await a.getByRole("button", { name: "رد کردن" }).click();
await a.waitForSelector("text=برای انتخاب بار، احراز هویت را کامل کنید");
ok(await a.getByText("همه‌ی بارها").isVisible(), "unverified driver can browse the load board");
await a.getByRole("link", { name: /احراز هویت/ }).first().click();
await a.waitForURL(/\/driver\/kyc\/$/);
await a.waitForSelector("text=احراز هویت راننده");
await a.getByLabel("کد ملی").fill("1234567890"); // test mode: any 10-digit national ID is accepted
await a.getByRole("button", { name: "ثبت و ادامه" }).click();
await a.getByRole("button", { name: "استعلام تطبیق" }).click();
await a.waitForSelector("text=عکس چهره");
// resumability: reload lands on the same step
await a.waitForTimeout(400); await a.reload(); await a.waitForSelector("text=عکس چهره");
ok(true, "KYC resumes at the face-photo step after reload");
const files = async (n) => { const inputs = a.locator('input[type=file]'); for (let i = 0; i < n; i++) await inputs.nth(i).setInputFiles(img); };
await files(1); await a.waitForTimeout(500);
await a.getByRole("button", { name: "ادامه" }).click();
await a.waitForSelector("text=گواهینامه و کارت هوشمند راننده");
await a.locator('input[type=file]').nth(0).setInputFiles(img); await a.locator('input[type=file]').nth(1).setInputFiles(img); await a.waitForTimeout(500);
await a.getByRole("button", { name: "ادامه" }).click();
await a.waitForSelector("text=خودرو و مدارک آن");
await a.getByLabel("دو رقم اول پلاک").fill("۱۲");
await a.getByLabel("حرف پلاک").selectOption("ب");
await a.getByLabel("سه رقم پلاک").fill("۳۴۵");
await a.getByLabel("کد استان پلاک").fill("۶۸");
await a.getByLabel("سازنده", { exact: true }).selectOption({ index: 1 });
await a.getByLabel("مدل دقیق").fill("NPR ۷۵ سقف بلند");
await a.getByLabel("سال ساخت (شمسی)").selectOption("1401");
await a.getByLabel("دماسنج داخل باکس یخچال").selectOption("digital");
await a.getByRole("button", { name: "اتصال به سنسور کامیونت" }).click();
await a.waitForSelector("text=دماسنج شما به کامیونت وصل است");
ok(true, "thermometer linked to the sensor in KYC");
for (const i of [0, 2, 3]) await a.locator('input[type=file]').nth(i).setInputFiles(img); await a.waitForTimeout(800);
await a.screenshot({ path: `${SHOTS}/m3-kyc-vehicle.png`, fullPage: true });
await a.getByRole("button", { name: "ادامه" }).click();
await a.waitForSelector("text=قوانین و مقررات رانندگان");
await a.getByRole("checkbox").check();
await a.getByRole("button", { name: "ادامه" }).click();
await a.waitForSelector("text=بازبینی و ارسال");
await a.getByRole("button", { name: "ارسال برای بررسی" }).click();
await a.waitForSelector("text=مدارک شما در حال بررسی است");
ok(true, "new driver submitted KYC → in review");
await a.close();

/* guests can browse loads without an account */
const g = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fa-IR" })).newPage();
await g.goto(`${B}/driver/`);
await g.waitForSelector("text=ثبت‌نام / ورود");
ok((await g.getByText("برای دیدن جزئیات ثبت‌نام کنید").count()) > 0, "guest sees masked loads (cities + price range) without logging in");

/* ───── B. full trip chain: shipper creates (with pins) → driver claims → deposit → trip → OTP delivery ───── */
const sh = await mk(); await demoLogin(sh, "shipper", "09120000007");
const dr = await mk(); await demoLogin(dr, "driver", "09100000006");
const orderId = await bringToPickup(sh, dr);
ok(!!orderId, "shipper order created with address + map pins " + orderId);
await dr.getByRole("img", { name: /مسیر تا مبدأ/ }).count();
ok(await dr.getByText("مسیر تا مبدأ").first().isVisible(), "driver sees the exact map + navigation after the deposit");
await dr.locator('input[type=file]').nth(0).setInputFiles(img);
await dr.locator('input[type=file]').nth(1).setInputFiles(img);
await dr.waitForFunction(() => document.querySelectorAll("img[alt]").length >= 2, null, { timeout: 8000 });
// offline: the pickup submission must queue, then flush on reconnect
await ctx.setOffline(true);
await dr.getByRole("button", { name: /بارگیری شد؛ شروع سفر/ }).click();
await dr.waitForSelector("text=در صف ارسال است");
ok(true, "offline submission is queued");
await ctx.setOffline(false);
await dr.evaluate(() => window.dispatchEvent(new Event("online")));
await dr.waitForSelector("text=به مقصد رسیدم", { timeout: 8000 });
ok(true, "queue flushed on reconnect → trip started");
await dr.getByRole("button", { name: "به مقصد رسیدم" }).click();
const st = await readState(dr);
const otp = st.orders.find((o) => o.id === orderId).consignee.otp;
await dr.getByLabel("کد تحویل گیرنده").fill(otp);
await dr.locator('input[type=file]').first().setInputFiles(img);
await dr.getByRole("button", { name: "ثبت تحویل" }).waitFor();
await dr.waitForFunction(() => !!document.querySelector("img[alt=\"عکس فاکتور تحویل\"]"), null, { timeout: 8000 });
await dr.getByRole("button", { name: "ثبت تحویل" }).click();
await dr.waitForSelector("text=سفر تحویل شد");
ok(true, "delivery with consignee OTP");
await dr.screenshot({ path: `${SHOTS}/m3-delivered.png`, fullPage: true });
const end = await readState(dr);
const o = end.orders.find((x) => x.id === orderId);
ok(["DELIVERED", "COMPLETED"].includes(o.status), "order status " + o.status);
const sum = end.ledger.reduce((n, e) => n + e.amount, 0);
ok(sum === 0, "ledger still sums to zero after the UI-driven trip");
await done(browser);
