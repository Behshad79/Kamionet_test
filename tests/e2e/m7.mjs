import { launch, ok, done, demoLogin, readState, bringToPickup, B } from "./lib.mjs";
const { browser, mk } = await launch({ width: 390, height: 844 });
const sh = await mk(); await demoLogin(sh, "shipper", "09120000007");
const dr = await mk(); await demoLogin(dr, "driver", "09100000006");
const id = await bringToPickup(sh, dr);
ok(!!id, "order at pickup " + id);

/* chat both ways */
await sh.goto(`${B}/app/order/?id=${id}`);
await sh.getByLabel("پیام شما").fill("سلام، ساعت چند می‌رسید؟");
await sh.getByRole("button", { name: "ارسال پیام" }).click();
await sh.waitForTimeout(700);
await dr.goto(`${B}/driver/trip/?id=${id}`);
await dr.waitForSelector("text=سلام، ساعت چند می‌رسید؟");
ok(true, "driver receives the shipper's in-app message");
await dr.getByLabel("پیام شما").fill("حدود نیم ساعت دیگر");
await dr.getByRole("button", { name: "ارسال پیام" }).click();
await sh.waitForSelector("text=حدود نیم ساعت دیگر", { timeout: 8000 });
ok(true, "shipper receives the driver's reply (cross-tab sync)");

/* in-app call: ring → answer → end */
await sh.getByRole("button", { name: "تماس درون‌برنامه‌ای" }).click();
await dr.waitForSelector('[role="alertdialog"]', { timeout: 8000 });
ok(await dr.getByText(/تماس ورودی/).first().isVisible(), "driver sees the incoming call");
await dr.getByRole("button", { name: "پاسخ" }).click();
await sh.waitForSelector("text=در مکالمه", { timeout: 8000 });
ok(true, "call connected on both sides");
await sh.getByRole("button", { name: "پایان تماس" }).click();
await sh.waitForTimeout(600);
let st = await readState(sh);
ok(st.calls.some((c) => c.orderId === id && c.status === "ENDED"), "call logged as ended");

/* complaint raised by the driver, answered by the shipper */
await dr.getByRole("button", { name: "ثبت شکایت / مشکل" }).click();
await dr.getByLabel("شرح مشکل").fill("بار آماده نیست و انتظار طولانی است");
await dr.getByRole("button", { name: /ثبت و اطلاع به طرف مقابل/ }).click();
await sh.reload(); await sh.waitForSelector("text=شکایت از شما");
await sh.getByLabel("پاسخ", { exact: true }).fill("تا ده دقیقه‌ی دیگر آماده می‌شود");
await sh.getByRole("button", { name: "ارسال", exact: true }).last().click();
await sh.waitForTimeout(500);
st = await readState(sh);
ok(st.complaints.some((c) => c.orderId === id && c.status === "ANSWERED"), "complaint answered by the counterparty immediately");

/* phone numbers are not shown after delivery */
const me = st.persons.find((p) => p.phone === "09120000007");
const past = st.orders.find((o) => o.shipperId === me.id && o.driverId && o.status === "COMPLETED");
await sh.goto(`${B}/app/order/?id=${past.id}`); await sh.waitForSelector("h1");
ok((await sh.locator('a[href^="tel:"]').count()) === 0, "past order shows no driver phone link");

/* admin sees chats, calls, complaints */
const ad = await mk(); await demoLogin(ad, "admin", "09130000001");
await ad.goto(`${B}/admin/comms/`); await ad.waitForSelector("h1");
ok(await ad.getByRole("heading", { name: "گفتگوها، تماس‌ها و شکایت‌ها" }).isVisible(), "admin comms module renders");
await ad.getByRole("tab", { name: /گفتگوها/ }).click();
ok(await ad.getByText(id).count() >= 0 && (await ad.locator("tbody tr").count()) > 0, "admin lists chats");
await done(browser);
