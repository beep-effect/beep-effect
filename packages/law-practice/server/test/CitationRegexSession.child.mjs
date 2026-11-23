import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";

const file = process.argv[1];
const hostileRealProcessModeForParentProtocolAndKillPath = NodePath.basename(file, ".mjs");
const version = "citation-regex-worker/v3";
const ready = `{"_tag":"Ready","version":"${version}"}\n`;
process.stdout.write(ready);
function closeCopies(descriptor) {
  const stdout = NodeFS.readlinkSync(`/proc/self/fd/${descriptor}`);
  const copies = NodeFS.readdirSync("/proc/self/fd").filter((fd) => {
    try {
      return NodeFS.readlinkSync(`/proc/self/fd/${fd}`) === stdout;
    } catch {
      return false;
    }
  });
  for (const fd of copies) NodeFS.closeSync(Number(fd));
}
function closeStdoutWhileAlive() {
  NodeFS.writeFileSync(`${file}.entered`, "alive-before-stdout-close");
  closeCopies(1);
  setInterval(() => {}, 1000);
}

function finishEarly() {
  if (hostileRealProcessModeForParentProtocolAndKillPath === "sent") return true;
  if (hostileRealProcessModeForParentProtocolAndKillPath === "eof") {
    process.exit(0);
    return true;
  }
  if (hostileRealProcessModeForParentProtocolAndKillPath === "eof-live") {
    closeStdoutWhileAlive();
    return true;
  }
  if (hostileRealProcessModeForParentProtocolAndKillPath === "oversize") {
    process.stdout.write("x".repeat(8192));
    return true;
  }
  return false;
}
let sequence = 0;
if (
  hostileRealProcessModeForParentProtocolAndKillPath !== "closed-stdin" &&
  hostileRealProcessModeForParentProtocolAndKillPath !== "blocked-stdin"
)
  NodeReadline.createInterface({ input: process.stdin }).on("line", () => {
    if (finishEarly()) return;
    const selected = hostileRealProcessModeForParentProtocolAndKillPath === "wrong-sequence" ? sequence + 1 : sequence;
    process.stdout.write(`{"_tag":"Started","version":"${version}","sequence":${selected}}\n`);
    if (hostileRealProcessModeForParentProtocolAndKillPath === "running") {
      NodeFS.writeFileSync(`${file}.entered`, "entered");
      /^(a+)+$/.test(`${"a".repeat(40)}!`);
      return;
    }
    if (hostileRealProcessModeForParentProtocolAndKillPath === "wrong-sequence") return;
    if (hostileRealProcessModeForParentProtocolAndKillPath === "failure") {
      process.stdout.write(
        `{"_tag":"Failure","version":"${version}","sequence":${sequence},"failure":{"_tag":"CitationSafetyLimitExceeded","operation":"extract","limit":"patternMatches"}}\n`
      );
      return;
    }
    if (hostileRealProcessModeForParentProtocolAndKillPath === "result") {
      const timer = setInterval(() => {
        if (NodeFS.existsSync(`${file}.result-release`)) {
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
if (hostileRealProcessModeForParentProtocolAndKillPath === "idle") {
  const timer = setInterval(() => {
    if (NodeFS.existsSync(`${file}.release`)) {
      clearInterval(timer);
      process.stdout.write(ready);
    }
  }, 5);
}

if (hostileRealProcessModeForParentProtocolAndKillPath === "closed-stdin") {
  const timer = setInterval(() => {
    if (NodeFS.existsSync(`${file}.close-input`)) {
      clearInterval(timer);
      NodeFS.writeFileSync(`${file}.entered`, "closing-stdin");
      closeCopies(0);
      setInterval(() => {}, 1000);
    }
  }, 5);
}

if (hostileRealProcessModeForParentProtocolAndKillPath === "blocked-stdin") setInterval(() => {}, 1000);
