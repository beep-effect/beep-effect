import * as NodeFS from "node:fs";

// Append one ledger line N times to the same hour file, one write(2) per line on an O_APPEND descriptor,
// exactly as the ledger's file store does.
const [file, line, count] = process.argv.slice(2);
for (let index = 0; index < Number(count); index += 1) {
  NodeFS.writeFileSync(file, `${line}\n`, { flag: "a", mode: 0o600 });
}
