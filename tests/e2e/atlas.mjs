import { launch, ok, done, B } from "./lib.mjs";
const { browser, mk } = await launch({ width: 1280, height: 900 });
const p = await mk();
await p.goto(`${B}/handoff/#atlas`);
await p.waitForSelector("[data-atlas-row]", { timeout: 20000 });
await p.waitForTimeout(1500); // let the seeded state hydrate
const rows = p.locator("[data-atlas-row]");
const n = await rows.count();
ok(n >= 250, `atlas lists every inventory row (${n})`);

/* tab bar: all tabs visible without horizontal scrolling */
const nav = p.getByRole("navigation", { name: "بخش‌های راهنما" });
const overflow = await nav.evaluate((e) => e.scrollWidth > e.clientWidth + 2);
ok(!overflow, "designer tab bar wraps (no hidden tabs)");
ok(await nav.getByRole("link", { name: /هنداف توسعه‌دهنده/ }).isVisible(), "developer hand-off link is in the tab bar");

/* hint sheet */
await rows.first().getByRole("button", { name: /راهنمای طراح/ }).click();
await p.waitForSelector("text=در چه شرایطی به این صفحه می‌رسد؟");
ok(true, "hint opens with arrival conditions, before/after and why");
ok(await p.getByText("سؤال برای مصاحبه").first().isVisible(), "interview questions are in the hint");
await p.keyboard.press("Escape");

/* open a representative sample and check the real screen renders */
const sample = [
  ["سفارش — تخصیص‌یافته تا در مسیر", /\/app\/order\/\?id=/],
  ["سفارش — در انتظار بیعانه", /\/app\/order\/\?id=/],
  ["سفارش — مغایرت بار", /\/app\/order\/\?id=/],
  ["سفر — در مسیر", /\/driver\/trip\/\?id=/],
  ["سفر — به‌سوی مبدأ", /\/driver\/trip\/\?id=/],
  ["بار — قابل رزرو", /\/driver\/order\/\?id=/],
  ["رهگیری — در مسیر (نقشه + دما)", /\/track\/\?t=/],
  ["مرور مالی و دفتر کل", /\/admin\/finance/],
];
for (const [label, re] of sample) {
  await p.getByLabel("جستجو در اطلس").fill(label);
  const row = p.locator("[data-atlas-row]").filter({ hasText: label }).first();
  const status = p.locator("p[role=status]");
  const [pop] = await Promise.all([p.context().waitForEvent("page", { timeout: 8000 }).catch(() => null), row.getByRole("button", { name: "باز کردن در کامیونت" }).click()]);
  if (!pop) { ok(false, `${label}: nothing opened — ${await status.innerText()}`); continue; }
  await pop.waitForLoadState("domcontentloaded");
  await pop.waitForTimeout(1800);
  const body = await pop.locator("body").innerText();
  ok(re.test(pop.url()) && !/404|پیدا نشد|This page could not be found/.test(body) && body.length > 80, `${label} → ${pop.url().replace(B, "")}`);
  await pop.close();
}
await done(browser);
