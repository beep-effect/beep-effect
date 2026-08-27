import { chromium } from "playwright";

const storyId = process.argv[2] ?? "drivers-graph3d-knowledgegraph--perf-probe-2500";
const shot = process.argv[3] ?? "/tmp/story.png";
const url = `http://localhost:6006/iframe.html?id=${storyId}&viewMode=story`;

const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto(url);
await page.waitForSelector('[data-testid="graph3d-container"] canvas', { timeout: 30000 });
await page.waitForTimeout(4000);
const overlay = await page.textContent('[data-testid="graph3d-overlay"]');
await page.screenshot({ path: shot });
console.log(JSON.stringify({ overlay, pageErrors: errors.slice(0, 5) }, null, 1));
await browser.close();
