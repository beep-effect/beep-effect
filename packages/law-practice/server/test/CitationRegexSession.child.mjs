import { closeSync, existsSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";

// Hostile real processes exercise the parent session's protocol and kill path.
const file = process.argv[1];
const mode = basename(file, ".mjs");
const version = "citation-regex-worker/v3";
const ready = `{"_tag":"Ready","version":"${version}"}\n`;
process.stdout.write(ready);
function closeCopies(descriptor) {
  const stdout = readlinkSync(`/proc/self/fd/${descriptor}`);
  const copies = readdirSync("/proc/self/fd").filter((fd) => {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`) === stdout;
    } catch {
      return false;
    }
  });
  for (const fd of copies) closeSync(Number(fd));
}
function closeStdoutWhileAlive() {
  writeFileSync(`${file}.entered`, "alive-before-stdout-close");
  closeCopies(1);
  setInterval(() => {}, 1000);
}

function finishEarly() {
  if (mode === "sent") return true;
  if (mode === "eof") {
    process.exit(0);
    return true;
  }
  if (mode === "eof-live") {
    closeStdoutWhileAlive();
    return true;
  }
  if (mode === "oversize") {
    process.stdout.write("x".repeat(8192));
    return true;
  }
  return false;
}
let sequence = 0;
if (mode !== "closed-stdin" && mode !== "blocked-stdin")
  createInterface({ input: process.stdin }).on("line", () => {
    if (finishEarly()) return;
    const selected = mode === "wrong-sequence" ? sequence + 1 : sequence;
    process.stdout.write(`{"_tag":"Started","version":"${version}","sequence":${selected}}\n`);
    if (mode === "running") {
      writeFileSync(`${file}.entered`, "entered");
      /^(a+)+$/.test(`${"a".repeat(40)}!`);
      return;
    }
    if (mode === "wrong-sequence") return;
    if (mode === "failure") {
      process.stdout.write(
        `{"_tag":"Failure","version":"${version}","sequence":${sequence},"failure":{"_tag":"CitationSafetyLimitExceeded","operation":"extract","limit":"patternMatches"}}\n`
      );
      return;
    }
    if (mode === "result") {
      const timer = setInterval(() => {
        if (existsSync(`${file}.result-release`)) {
          clearInterval(timer);
          process.stdout.write(
            `{"_tag":"Complete","version":"citation-regex-result/v1","sequence":${sequence},"groups":0,"matches":0,"spans":""}\n`
          );
        }
      }, 5);
      return;
    }
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

if (mode === "closed-stdin") {
  const timer = setInterval(() => {
    if (existsSync(`${file}.close-input`)) {
      clearInterval(timer);
      writeFileSync(`${file}.entered`, "closing-stdin");
      closeCopies(0);
      setInterval(() => {}, 1000);
    }
  }, 5);
}

if (mode === "blocked-stdin") setInterval(() => {}, 1000);
