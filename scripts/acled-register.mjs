// Stealth browser attempt at ACLED registration (user-authorized temp-mail account)
// Usage: node /home/z/my-project/scripts/acled-register.mjs <email> <password>
import { chromium } from "/home/z/.npm-global/lib/node_modules/playwright/index.mjs";

const EMAIL = process.argv[2];
const FIRST = "Amani";
const LAST = "Kariuki";
const ORG = "KAMPS Kenya Watch";
const COUNTRY = "Kenya";

const ctx = await chromium.launchPersistentContext("/tmp/acled-profile", {
  headless: false,
  viewport: { width: 1280, height: 860 },
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});
const page = ctx.pages()[0] ?? await ctx.newPage();

// mask webdriver
await page.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  window.chrome = window.chrome ?? { runtime: {} };
  Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
});

try {
  await page.goto("https://acleddata.com/register/", { waitUntil: "domcontentloaded", timeout: 45000 });
  // wait up to 60s for CF to clear
  for (let i = 0; i < 30; i++) {
    const t = await page.title();
    if (!/just a moment/i.test(t)) break;
    await page.waitForTimeout(2000);
    // try clicking the turnstile checkbox if present
    const cb = page.frameLocator("iframe[title*='Widget']").first().locator("input[type=checkbox]");
    try { if (await cb.count() && await cb.isVisible({ timeout: 1000 })) await cb.click({ timeout: 2000 }); } catch {}
  }
  const title = await page.title();
  console.log("TITLE:", title);
  await page.screenshot({ path: "/tmp/acled-1.png", fullPage: false });

  if (/just a moment/i.test(title)) {
    console.log("STILL_BLOCKED");
    await ctx.close();
    process.exit(2);
  }

  // dump form fields
  const fields = await page.locator("form input, form select, form textarea").all();
  for (const f of fields) {
    const name = await f.getAttribute("name");
    const id = await f.getAttribute("id");
    const type = await f.getAttribute("type");
    const label = await page.locator(`label[for="${id}"]`).first().textContent().catch(() => "");
    console.log(`FIELD name=${name} id=${id} type=${type} label=${(label || "").trim().slice(0, 60)}`);
  }
  await ctx.close();
} catch (e) {
  console.log("ERROR:", e.message);
  await page.screenshot({ path: "/tmp/acled-err.png" }).catch(() => {});
  await ctx.close();
  process.exit(1);
}
