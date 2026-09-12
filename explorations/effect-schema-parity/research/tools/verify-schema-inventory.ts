/** Offline declaration-facet validation; regeneration never overwrites the checked inventory. */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const research = resolve(root, "explorations/effect-schema-parity/research");
const upstream = resolve(root, ".repos/effect");
const out = resolve(research, "inventory");
const pin = "51d4a2f08a5c7691dc876415bc9fc0ecf467e153";
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
assert(
  execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() === pin,
  "Upstream HEAD pin mismatch"
);
const paths = [...readFileSync(resolve(research, "../CAPTURE.md"), "utf8").matchAll(/^A {2}(\S+\.ts)$/gm)].map(
  (m) => m[1]
);
const moduleOf = (path: string) =>
  "effect/" +
  path
    .replace(/^packages\/effect\/src\//, "")
    .replace(/\.ts$/, "")
    .replace(/\/index$/, "");
const modules = paths.map(moduleOf);
const lineCounts = new Map(
  paths.map((path) => {
    const live = readFileSync(resolve(upstream, path));
    const pinned = execFileSync("git", ["-C", upstream, "show", `${pin}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
    assert(live.equals(pinned), `Dirty upstream source: ${path}`);
    return [path, live.toString("utf8").split(/\r\n|\r|\n/).length] as const;
  })
);
const index = readFileSync(resolve(out, "INDEX.md"), "utf8");
assert(index.includes(`Pin: \`${pin}\``), "INDEX pin mismatch");
const entries = [...index.matchAll(/^\| \[([^\]]+)\]\(([^)]+\.jsonl)\) \| (\d+) \| (\d+) \|$/gm)].map((m) => ({
  module: m[1],
  file: m[2],
  rows: Number(m[3]),
  bytes: Number(m[4]),
}));
assert(
  entries.length === modules.length && new Set(entries.map((e) => e.module)).size === modules.length,
  "INDEX module count/uniqueness mismatch"
);
const actualFiles = readdirSync(out)
  .filter((f) => f.endsWith(".jsonl"))
  .sort();
assert(
  JSON.stringify(actualFiles) === JSON.stringify(modules.map((m) => m.replaceAll("/", "-") + ".jsonl").sort()),
  "Unexpected or missing JSONL files"
);
const fields = [
  "sha",
  "module",
  "file",
  "line",
  "symbol",
  "kind",
  "category",
  "since",
  "deprecated",
  "internal",
  "signature",
  "summary",
  "hasExample",
  "overloads",
].sort();
const kinds = new Set([
  "function",
  "const",
  "class",
  "interface",
  "type",
  "namespace",
  "method",
  "property",
  "accessor",
  "call",
  "constructor",
  "re-export",
]);
const identities = new Set<string>();
let totalRows = 0;
let totalBytes = 0;
let schemaRows = 0;
for (const entry of entries) {
  assert(modules.includes(entry.module), `Unexpected module: ${entry.module}`);
  assert(entry.file === entry.module.replaceAll("/", "-") + ".jsonl", `INDEX filename: ${entry.module}`);
  const data = readFileSync(resolve(out, entry.file));
  const body = data.toString("utf8");
  assert(body.endsWith("\n"), `Missing final newline: ${entry.file}`);
  const rows = body
    .slice(0, -1)
    .split("\n")
    .map((line) => JSON.parse(line));
  assert(rows.length === entry.rows && data.length === entry.bytes, `INDEX rows/bytes mismatch: ${entry.module}`);
  // Independent line census, also used by the generator for every kind/category cell.
  const census = Number(
    execFileSync("rg", ["--no-ignore", "--no-heading", "-F", "-c", '"sha":', resolve(out, entry.file)], {
      encoding: "utf8",
    }).trim()
  );
  assert(census === rows.length, `ripgrep count mismatch: ${entry.module}`);
  for (const row of rows) {
    assert(row !== null && typeof row === "object" && !Array.isArray(row), `Non-object row: ${entry.file}`);
    assert(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(fields), `Wrong fields: ${entry.file}`);
    for (const field of ["sha", "module", "file", "symbol", "kind", "signature", "summary"])
      assert(typeof row[field] === "string", `Invalid ${field}: ${entry.file}`);
    assert(row.sha === pin.slice(0, 10) && row.module === entry.module, `Row pin/module mismatch: ${entry.file}`);
    assert(row.symbol.length > 0 && kinds.has(row.kind), `Invalid symbol/kind: ${entry.file}`);
    for (const field of ["category", "since"])
      assert(row[field] === null || typeof row[field] === "string", `Invalid ${field}: ${row.symbol}`);
    for (const field of ["deprecated", "internal", "hasExample"])
      assert(typeof row[field] === "boolean", `Invalid ${field}: ${row.symbol}`);
    assert(
      Number.isInteger(row.line) && row.line >= 1 && row.line <= (lineCounts.get(row.file) ?? 0),
      `Invalid source line: ${row.symbol}`
    );
    assert(Number.isInteger(row.overloads) && row.overloads >= 0, `Invalid overloads: ${row.symbol}`);
    assert(
      row.signature.length <= 300 && row.summary.length <= 400 && !/[\r\n]/.test(row.signature + row.summary),
      `Invalid preview: ${row.symbol}`
    );
    const identity = JSON.stringify([row.module, row.symbol, row.kind]);
    assert(!identities.has(identity), `Duplicate identity: ${identity}`);
    identities.add(identity);
  }
  totalRows += rows.length;
  totalBytes += data.length;
  if (entry.module === "effect/Schema") schemaRows = rows.length;
}
assert(index.includes(`| **Total** | **${totalRows}** | **${totalBytes}** |`), "INDEX total mismatch");
const scratch = resolve(research, "tools/.tmp");
mkdirSync(scratch, { recursive: true });
const temporary = mkdtempSync(resolve(scratch, "verify-"));
try {
  execFileSync("bun", ["run", resolve(research, "tools/schema-inventory.ts"), temporary], {
    cwd: research,
    stdio: "pipe",
  });
  assert(
    JSON.stringify(
      readdirSync(temporary)
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
    ) === JSON.stringify(actualFiles),
    "Regenerated file set mismatch"
  );
  for (const file of [...actualFiles, "INDEX.md"])
    assert(
      readFileSync(resolve(out, file)).equals(readFileSync(resolve(temporary, file))),
      `Regeneration differs: ${file}`
    );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log(`PASS: upstream HEAD and source bytes pinned to ${pin}`);
console.log(
  `PASS: ${entries.length} modules; ${totalRows} rows; Schema.ts ${schemaRows} rows; JSONL ${totalBytes} bytes; INDEX and ripgrep counts agree`
);
console.log(
  "PASS: (module, symbol, kind) identities unique; all fields/types, preview bounds and defining-file line bounds valid"
);
console.log("PASS: regenerated JSONL and INDEX.md byte-identical from research cwd; temporary directory deleted");
