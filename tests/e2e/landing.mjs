import { launch, ok, done, B, SHOTS } from "./lib.mjs";
for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
  const { browser, mk } = await launch({ width: w, height: h });
  const p = await mk();
  await p.goto(`${B}/`);
  await p.waitForSelector("text=بارهای باز همین الان");
  await p.waitForTimeout(1500);
  ok(await p.getByText("مستقیم، شفاف، بیمه‌شده").first().isVisible(), `${w}: tagline`);
  ok(!(await p.content()).includes("بدون واسطه"), `${w}: no 'بدون واسطه'`);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(sw <= 1, `${w}: no horizontal scroll (${sw})`);
  ok((await p.locator("a:has(button), button:has(a)").count()) === 0, `${w}: no nested interactive`);
  ok((await p.locator("article").count()) >= 3, `${w}: live loads render`);
  await p.screenshot({ path: `${SHOTS}/m1-landing-${w}.png`, fullPage: true });
  await browser.close();
}
await done({ close() {} });
