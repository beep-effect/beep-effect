/**
 * Schema validator for goals/boolean-creep/data/inventory.jsonl.
 *
 * Run from the repo root:
 *
 * ```sh
 * bun goals/boolean-creep/ops/validate-inventory.ts [path-to-jsonl ...]
 * ```
 *
 * With no arguments it validates the canonical inventory. Extra arguments let
 * sweep-lane outputs (files under `data/sweeps/`) be validated before merge.
 * Exits non-zero on any malformed line, duplicate id, duplicate
 * file/symbol/member cluster, duplicate declaration-line/member cluster, or
 * status-shape mismatch.
 */
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const SCHEMA_VERSION = "boolean-creep-inventory/v1";

/** Evidence classes that qualify a suspect (COMMON_CODE_SMELL.md gate). */
export const EvidenceClass = LiteralKit(["E1", "E2", "E3", "E4"]);
/** Disqualifier classes recorded for the census. */
export const DisqualifierClass = LiteralKit(["D1", "D2"]);
/** Whether the boolean cluster is stored state or a projection of one upstream source. */
export const Storage = LiteralKit(["stored", "derived"]);
/** How far the shape's encoded side travels. */
export const Exposure = LiteralKit(["internal", "persisted", "wire"]);
/** Per-instance target-shape taxonomy (ratified decision 3). */
export const TargetShape = LiteralKit(["literalkit", "tagged-union", "option-literal"]);
/** Lifecycle of a qualified instance through the campaign pipeline. */
export const QualifiedStatus = LiteralKit(["confirmed", "designed", "reviewed", "applied"]);
/** Scope kind the scanner net matched. */
export const ScopeKind = LiteralKit([
  "schema-struct",
  "type-literal",
  "interface",
  "object-literal",
  "props",
  "sibling-state",
  "class-fields",
]);
/** Landing tier (Tier 1 internal/derived batched; Tier 2 persisted/wire one-PR-each). */
export const Tier = LiteralKit([1, 2]);

const Citation = S.Struct({
  file: S.NonEmptyString,
  line: S.Int,
});

const Evidence = S.Struct({
  class: EvidenceClass,
  cite: Citation,
  note: S.NonEmptyString,
});

const baseFields = {
  schemaVersion: S.Literal(SCHEMA_VERSION),
  id: S.NonEmptyString,
  file: S.NonEmptyString,
  line: S.Int,
  symbol: S.NonEmptyString,
  kind: ScopeKind,
  members: S.NonEmptyArray(S.NonEmptyString),
  notes: S.optionalKey(S.NonEmptyString),
};

const cardinalityGap = S.makeFilter(
  (value: { readonly representable: number; readonly legal: number }) =>
    value.legal < value.representable
      ? undefined
      : { path: ["legal"], issue: "legal state count must be strictly below the representable 2^n" },
  {
    title: "cardinality gap",
    description: "A qualified instance must have k legal states strictly below its 2^n representable states.",
  }
);

const Cardinality = S.Struct({
  representable: S.Int,
  legal: S.Int,
}).pipe(S.check(cardinalityGap));

/**
 * A suspect that passed the gate: at least one cited evidence class, a
 * cardinality gap, and a per-instance target shape. `status` tracks it through
 * design -> review -> apply.
 */
export const QualifiedRecord = S.Struct({
  ...baseFields,
  status: QualifiedStatus,
  evidence: S.NonEmptyArray(Evidence),
  cardinality: Cardinality,
  storage: Storage,
  exposure: Exposure,
  targetShape: TargetShape,
  tier: Tier,
});

/**
 * A suspect recorded for the census only: carries its disqualifier, never a
 * target shape — the union makes "disqualified but designed against"
 * unrepresentable.
 */
export const DisqualifiedRecord = S.Struct({
  ...baseFields,
  status: S.Literal("disqualified"),
  disqualifier: S.Struct({
    class: DisqualifierClass,
    note: S.NonEmptyString,
  }),
});

export const InventoryRecord = S.Union([QualifiedRecord, DisqualifiedRecord]);

const decodeRecordLine = S.decodeUnknownResult(S.fromJsonString(InventoryRecord));

const repoRoot = new URL("../../..", import.meta.url).pathname;
const defaultInventory = `${repoRoot}goals/boolean-creep/data/inventory.jsonl`;
const targets = Bun.argv.length > 2 ? Bun.argv.slice(2) : [defaultInventory];

let failures = 0;
let total = 0;
const seenIds = MutableHashMap.empty<string, string>();
const seenClusters = MutableHashMap.empty<string, string>();
const seenDeclarationClusters = MutableHashMap.empty<string, string>();
const sourceLineCounts = MutableHashMap.empty<string, number>();

const sourceLineCount = async (relativePath: string): Promise<O.Option<number>> => {
  const cached = MutableHashMap.get(sourceLineCounts, relativePath);
  if (O.isSome(cached)) return cached;
  const source = Bun.file(`${repoRoot}${relativePath}`);
  if (!(await source.exists())) return O.none();
  const count = sourceLineCountFromText(await source.text());
  MutableHashMap.set(sourceLineCounts, relativePath, count);
  return O.some(count);
};

const sourceLineCountFromText = (text: string): number => A.length(Str.split(text, "\n"));

const validateSourceReference = async (where: string, relativePath: string, line: number): Promise<void> => {
  const count = await sourceLineCount(relativePath);
  if (O.isNone(count)) {
    failures += 1;
    console.error(`${where}: source reference does not exist: ${relativePath}`);
    return;
  }
  if (line < 1 || line > count.value) {
    failures += 1;
    console.error(`${where}: source line ${line} is outside ${relativePath} (1-${count.value})`);
  }
};

for (const target of targets) {
  const text = await Bun.file(target).text();
  const lines = A.filter(Str.split(text, "\n"), (line) => Str.isNonEmpty(Str.trim(line)));
  for (const [index, line] of lines.entries()) {
    total += 1;
    const where = `${target}:${index + 1}`;
    const decoded = decodeRecordLine(line);
    if (Result.isFailure(decoded)) {
      failures += 1;
      console.error(`${where}: ${decoded.failure.message}`);
      continue;
    }
    const record = decoded.success;
    await validateSourceReference(`${where} record`, record.file, record.line);
    if ("evidence" in record) {
      for (const [evidenceIndex, evidence] of record.evidence.entries()) {
        await validateSourceReference(`${where} evidence ${evidenceIndex + 1}`, evidence.cite.file, evidence.cite.line);
      }
    }
    const prior = MutableHashMap.get(seenIds, record.id);
    if (O.isSome(prior)) {
      failures += 1;
      console.error(`${where}: duplicate id "${record.id}" (first seen at ${prior.value})`);
      continue;
    }
    MutableHashMap.set(seenIds, record.id, where);
    const clusterKey = A.join(
      [record.file, record.symbol, A.join(A.sort(record.members, Order.String), "\u0000")],
      "\u0001"
    );
    const priorCluster = MutableHashMap.get(seenClusters, clusterKey);
    if (O.isSome(priorCluster)) {
      failures += 1;
      console.error(`${where}: duplicate file/symbol/member cluster (first seen at ${priorCluster.value})`);
      continue;
    }
    MutableHashMap.set(seenClusters, clusterKey, where);
    const declarationClusterKey = A.join(
      [record.file, `${record.line}`, A.join(A.sort(record.members, Order.String), "\u0000")],
      "\u0001"
    );
    const priorDeclarationCluster = MutableHashMap.get(seenDeclarationClusters, declarationClusterKey);
    if (O.isSome(priorDeclarationCluster)) {
      failures += 1;
      console.error(
        `${where}: duplicate file/declaration-line/member cluster (first seen at ${priorDeclarationCluster.value})`
      );
      continue;
    }
    MutableHashMap.set(seenDeclarationClusters, declarationClusterKey, where);
  }
}

if (failures > 0) {
  console.error(`inventory INVALID: ${failures}/${total} records failed`);
  process.exit(1);
}
console.log(`inventory OK: ${total} records, ${A.length(A.fromIterable(seenIds))} unique ids`);
