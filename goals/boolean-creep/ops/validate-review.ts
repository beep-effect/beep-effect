/** Validate complete exact-source independent review coverage. */
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const inventoryPath = `${repoRoot}goals/boolean-creep/data/inventory.jsonl`;
const reviewDir = Bun.argv[2];
if (reviewDir === undefined) {
  console.error("usage: bun goals/boolean-creep/ops/validate-review.ts <review-directory>");
  process.exit(1);
}

const ReviewFinding = S.Struct({
  area: S.Literals(["evidence", "design"]),
  severity: S.Literals(["blocking", "nonblocking"]),
  note: S.NonEmptyString,
});
const ReviewRecord = S.Struct({
  schemaVersion: S.Literal("boolean-creep-review/v1"),
  id: S.NonEmptyString,
  sourceSha: S.NonEmptyString,
  reviewer: S.Literal("claude-cli-fable"),
  evidenceStatus: S.Literals(["pass", "finding"]),
  designStatus: S.Literals(["pass", "finding"]),
  findings: S.Array(ReviewFinding),
});
const InventoryKey = S.Struct({ id: S.NonEmptyString, status: S.String });
const decodeInventory = S.decodeUnknownSync(S.fromJsonString(InventoryKey));
const decodeReview = S.decodeUnknownResult(S.fromJsonString(ReviewRecord));

const inventoryLines = A.filter(Str.split(await Bun.file(inventoryPath).text(), "\n"), (line) =>
  Str.isNonEmpty(Str.trim(line))
);
const expected = A.map(
  A.filter(
    A.map(inventoryLines, (line) => decodeInventory(line)),
    (record) => record.status !== "disqualified"
  ),
  (record) => record.id
);
const sourceSha = Str.trim(await Bun.file(`${reviewDir}/source-sha.txt`).text());
const glob = new Bun.Glob("*.jsonl");
const seen = MutableHashMap.empty<string, string>();
let failures = 0;

for await (const file of glob.scan({ cwd: reviewDir, onlyFiles: true })) {
  const lines = A.filter(Str.split(await Bun.file(`${reviewDir}/${file}`).text(), "\n"), (line) =>
    Str.isNonEmpty(Str.trim(line))
  );
  for (const [index, line] of lines.entries()) {
    const where = `${file}:${index + 1}`;
    const decoded = decodeReview(line);
    if (Result.isFailure(decoded)) {
      failures += 1;
      console.error(`${where}: ${decoded.failure.message}`);
      continue;
    }
    const record = decoded.success;
    if (!A.contains(expected, record.id)) {
      failures += 1;
      console.error(`${where}: unexpected qualified id ${record.id}`);
    }
    const prior = MutableHashMap.get(seen, record.id);
    if (O.isSome(prior)) {
      failures += 1;
      console.error(`${where}: duplicate review for ${record.id}; first seen at ${prior.value}`);
    } else {
      MutableHashMap.set(seen, record.id, where);
    }
    if (!Str.Equivalence(record.sourceSha, sourceSha)) {
      failures += 1;
      console.error(`${where}: source SHA ${record.sourceSha} does not match ${sourceSha}`);
    }
    if (
      record.evidenceStatus !== "pass" ||
      record.designStatus !== "pass" ||
      A.isReadonlyArrayNonEmpty(record.findings)
    ) {
      failures += 1;
      console.error(`${where}: unresolved independent-review finding for ${record.id}`);
    }
  }
}

for (const id of expected) {
  if (O.isNone(MutableHashMap.get(seen, id))) {
    failures += 1;
    console.error(`missing independent review for ${id}`);
  }
}

if (failures > 0) {
  console.error(`review INVALID: ${failures} failure(s) across ${A.length(expected)} qualified ids`);
  process.exit(1);
}
console.log(`review OK: ${A.length(expected)} qualified ids at ${sourceSha}`);
