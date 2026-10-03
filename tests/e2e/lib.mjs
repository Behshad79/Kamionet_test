import { chromium } from "playwright";
// Run: npm run build && npx serve out -l 4173 &  then  node tests/e2e/<file>.mjs  (BASE_URL, CHROMIUM_PATH optional)
export const B = process.env.BASE_URL || "http://localhost:4173";
export const SHOTS = process.env.SHOTS_DIR || "/tmp";
export const errors = [];
export async function launch(viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport, locale: "fa-IR" });
  const mk = async () => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push("PAGEERR " + e.message));
    p.on("console", (m) => m.type() === "error" && !/tile|openstreetmap|ERR_|404/.test(m.text()) && errors.push("CONSOLE " + m.text()));
    return p;
  };
  return { browser, ctx, mk };
}
let failed = 0;
export const ok = (c, m) => { if (!c) failed++; console.log((c ? "PASS " : "FAIL ") + m); };
export const done = async (browser) => {
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no console errors");
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
};
export async function demoLogin(p, portal, phone) {
  const path = portal === "shipper" ? "app" : portal;
  await p.goto(`${B}/${path}/login/`);
  await p.waitForFunction(() => document.querySelector('input[inputmode="tel"]'));
  await p.fill('input[inputmode="tel"]', phone);
  await p.getByText("دریافت کد تأیید").click();
  await p.fill('input[inputmode="numeric"]', "12345");
  await p.getByRole("button", { name: "ورود", exact: true }).click();
  await p.waitForURL(new RegExp(`/${path}/$`));
}
