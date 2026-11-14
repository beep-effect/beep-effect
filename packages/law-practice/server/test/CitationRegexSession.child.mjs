import { existsSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";

// Hostile real processes exercise the parent session's protocol and kill path.
const file = process.argv[1];
const mode = basename(file, ".mjs");
const version = "citation-regex-worker/v3";
const ready = `{"_tag":"Ready","version":"${version}"}\n`;
process.stdout.write(ready);
let sequence = 0;
createInterface({ input: process.stdin }).on("line", () => {
  if (mode === "sent") return;
  if (mode === "eof") {
    process.exit(0);
    return;
  }
  if (mode === "oversize") {
    process.stdout.write("x".repeat(8192));
    return;
  }
  const selected = mode === "wrong-sequence" ? sequence + 1 : sequence;
  process.stdout.write(`{"_tag":"Started","version":"${version}","sequence":${selected}}\n`);
  if (mode === "running") {
    writeFileSync(`${file}.entered`, "entered");
    /^(a+)+$/.test(`${"a".repeat(40)}!`);
    return;
  }
  if (mode === "wrong-sequence") return;
  process.stdout.write(
    `{"_tag":"Complete","version":"citation-regex-result/v1","sequence":${sequence},"groups":0,"matches":0,"spans":""}\n`
  );
  sequence++;
});
if (mode === "idle") {
  const timer = setInterval(() => {
    if (existsSync(`${file}.release`)) {
      clearInterval(timer);
      process.stdout.write(ready);
    }
  }, 5);
}
