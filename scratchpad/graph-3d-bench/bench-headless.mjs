import { chromium } from "playwright";

const nodes = process.argv[2] ?? "2500";
const edges = process.argv[3] ?? "5000";
const url = `http://localhost:5199/?auto=1&nodes=${nodes}&edges=${edges}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleLines = [];
page.on("console", (msg) => consoleLines.push(msg.text()));
await page.goto(url);
await page.waitForFunction(() => window.__benchResult !== undefined, null, { timeout: 60000 });
const result = await page.evaluate(() => window.__benchResult);
// StrictMode-style destroy + double-remount exercise
await page.click("#remount");
await page.waitForTimeout(500);
const remount = consoleLines.find((l) => l.startsWith("REMOUNT_OK")) ?? "REMOUNT_MISSING";
console.log(JSON.stringify({ ...result, remount }, null, 1));
await browser.close();
