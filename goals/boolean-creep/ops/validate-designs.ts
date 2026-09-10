/** Validate one complete design surface for every qualified inventory record. */
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const inventoryPath = `${repoRoot}goals/boolean-creep/data/inventory.jsonl`;
const InventoryDesignKey = S.Struct({
  id: S.NonEmptyString,
  status: S.Literals(["confirmed", "designed", "reviewed", "applied", "disqualified"]),
});
const decodeRecord = S.decodeUnknownSync(S.fromJsonString(InventoryDesignKey));
const requiredSections = [
  "Current shape",
  "Cardinality gap",
  "Target schema",
  "Migration inventory",
  "Guard-deletion accounting",
  "Encoded-side impact",
  "Test impact",
  "Risk",
] as const;

const records = A.map(
  A.filter(Str.split(await Bun.file(inventoryPath).text(), "\n"), (line) => Str.isNonEmpty(Str.trim(line))),
  decodeRecord
);
const qualified = A.filter(records, (record) => record.status !== "disqualified");
let failures = 0;

for (const record of qualified) {
  const path = `${repoRoot}goals/boolean-creep/designs/${record.id}.md`;
  const design = Bun.file(path);
  if (!(await design.exists())) {
    failures += 1;
    console.error(`${record.id}: missing designs/${record.id}.md`);
    continue;
  }
  const text = await design.text();
  for (const section of requiredSections) {
    if (!Str.includes(section)(text)) {
      failures += 1;
      console.error(`${record.id}: design is missing a ${section} section`);
    }
  }
}

if (failures > 0) {
  console.error(`design coverage INVALID: ${failures} missing surface(s) across ${A.length(qualified)} qualified ids`);
  process.exit(1);
}

console.log(`design coverage OK: ${A.length(qualified)} qualified ids`);
