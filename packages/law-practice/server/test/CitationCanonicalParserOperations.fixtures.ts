/** Original resolution-test parser calls and assertions from eyecite, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const site = "tests/test_ResolveTest.py:130:20:get_citations";
const assertionSite = "tests/test_ResolveTest.py:131:12:caseDeclaration";
const Capture = S.fromJsonString(S.Struct({ events: S.Array(S.Struct({ id: S.String, payload: S.String })) }));
const One = S.Struct({ kind: S.tag("value"), value: S.tag(1) });
const Criterion = S.fromJsonString(
  S.Struct({
    context: S.Struct({
      values: S.Struct({ cite_text: S.String, cites: S.Array(S.JsonObject).check(S.isBetweenLength(1, 1)) }),
    }),
    operands: S.Tuple([One, One, S.Struct({ kind: S.tag("value"), value: S.String })]),
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
    passed: S.tag(true),
  })
);
const Operations = S.fromJsonString(CitationOracleOperations);
const JsonModels = S.Array(S.JsonObject);

const readRows = Effect.fn("CanonicalParserTest.read")(function* () {
  const operations = yield* readCitationOracleFixture(
    "operation-cases",
    "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
  ).pipe(Effect.flatMap(S.decodeEffect(Operations)));
  const capture = yield* readCitationOracleFixture(
    "assertion-cases",
    "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
  ).pipe(Effect.flatMap(S.decodeEffect(Capture)));
  const assertions = HashMap.fromIterable(A.map(capture.events, (row) => Tuple.make(row.id, row)));
  const selected = A.filter(operations.cases, (row) => row.operation === "get_citations" && row.sourceSiteId === site);
  expect(selected).toHaveLength(77);
  return yield* Effect.forEach(
    selected,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original parser operation");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original successful parser call");
      expect(body.outcome.value, row.id).toHaveLength(1);
      expect(body.input.clean_steps, row.id).toBeNull();
      expect(body.input.markup_text, row.id).toBe("");
      expect(body.input.remove_ambiguous, row.id).toBe(false);
      expect(body.input.tokenizer.tokenizer, row.id).toBe("AhocorasickTokenizer");
      const id = Str.replace(site, assertionSite)(row.id);
      const event = yield* Effect.fromOption(HashMap.get(assertions, id));
      const criterion = yield* S.decodeEffect(Criterion)(event.payload);
      expect(body.input.plain_text, id).toBe(criterion.context.values.cite_text);
      const models = yield* S.decodeEffect(JsonModels)(body.outcome.value);
      expect(models, id).toEqual(criterion.context.values.cites);
      return { id, body, expected: A.getUnsafe(body.outcome.value, 0) };
    })
  );
});
/** Execute raw original fragments through default cleaning, extraction and verification.
 * Original default API behavior is compared; alternate tokenizer interfaces and
 * native model identities are separate obligations.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalParserOperations = Effect.fn("CanonicalParserTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  shard: number,
  size: number,
  entriesOnly?: boolean
) {
  const rows = yield* readRows();
  const selected =
    entriesOnly === true
      ? A.dedupeWith(rows, (left, right) => left.expected.citationType === right.expected.citationType)
      : A.take(A.drop(rows, shard * size), size);
  expect(selected.length).toBe(entriesOnly === true ? 7 : Math.min(size, rows.length - shard * size));
  expect(selected.length).toBeGreaterThan(0);
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  for (const row of selected) {
    const result = yield* replay.extract(row.body.input.plain_text, "plain", [row.expected], row.id);
    expect(result.source.source.sourceText, row.id).toBe(row.body.stages.document.plainText);
  }
  yield* replay.assertRetired;
});
