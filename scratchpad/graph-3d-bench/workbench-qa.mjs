import { chromium } from "playwright";

const base = "http://127.0.0.1:1420";
const outDir = process.argv[2] ?? "/tmp";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

const report = {};
const vaultPath = process.env.QA_VAULT_PATH ?? "/tmp/qa-vault";
page.on("dialog", (dialog) => dialog.accept(vaultPath));
await page.goto(`${base}/#ontology`);
// first-run vault onboarding (fresh scratch db): answer the browser prompt
const onboarding = page.locator('[data-testid="vault-onboarding"]');
if (await onboarding.isVisible({ timeout: 8000 }).catch(() => false)) {
  await page.locator('[data-testid="vault-choose"]').click();
  report.vaultOnboarded = true;
  await page.waitForTimeout(3000);
}
const pathInput = page.getByLabel("Ontology file path");
await pathInput.waitFor({ timeout: 60000 });
report.pathValue = await pathInput.inputValue();
if (report.pathValue === "") {
  await pathInput.fill("pizza-tutorial.ttl");
}
await page.waitForLoadState("networkidle");
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Open", exact: true }).click();
// wait for the projection to land: the summary overlay reports node counts
try {
  await page.waitForFunction(() => /nodes [1-9]/.test(document.body.innerText), null, { timeout: 15000 });
} catch {
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await page.waitForFunction(() => /nodes [1-9]/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
}
report.bodyHasNodes = /nodes [1-9]/.test(await page.textContent("body"));
await page.waitForTimeout(2000);

const canvasCount = () => page.locator("canvas").count();
report.cosmosCanvases = await canvasCount();
report.badgeDefault = await page
  .locator("span", { hasText: /^(cosmos|sigma|pending|failed|3d)$/ })
  .first()
  .textContent()
  .catch(() => "not-found");
await page.screenshot({ path: `${outDir}/wb-cosmos.png` });

// flip to 3D
await page.getByLabel("Toggle 3D graph renderer").click();
await page.waitForTimeout(5000);
report.canvases3d = await canvasCount();
report.badge3d = await page
  .locator("span", { hasText: /^(cosmos|sigma|pending|failed|3d)$/ })
  .first()
  .textContent()
  .catch(() => "not-found");
await page.screenshot({ path: `${outDir}/wb-3d.png` });

// select a tree node for selection sync
const treeItem = page.locator('[role="treeitem"]').nth(1);
report.treeItemFound = (await treeItem.count()) > 0;
if (report.treeItemFound) {
  await treeItem.click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${outDir}/wb-3d-selected.png` });
}

// flip back to cosmos
await page.getByLabel("Toggle 3D graph renderer").click();
await page.waitForTimeout(4000);
report.canvasesBack = await canvasCount();
await page.screenshot({ path: `${outDir}/wb-cosmos-back.png` });

report.pageErrors = errors.slice(0, 5);
console.log(JSON.stringify(report, null, 1));
await browser.close();
