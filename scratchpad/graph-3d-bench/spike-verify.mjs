import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:1420/?graph3d-spike";
const shot = process.argv[3] ?? "/tmp/spike.png";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto(url);
await page.waitForSelector('[data-testid="graph3d-spike-container"] canvas', { timeout: 30000 });
await page.waitForTimeout(4000);
const before = await page.textContent("body");
await page.click("text=run stress pass");
await page.waitForTimeout(1500);
const overlay = await page.locator(".pointer-events-none").first().textContent();
await page.screenshot({ path: shot });
console.log(JSON.stringify({ overlay, pageErrors: errors.slice(0, 5) }, null, 1));
await browser.close();
