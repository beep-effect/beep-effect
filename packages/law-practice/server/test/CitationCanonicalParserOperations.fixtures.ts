/** Original resolution-test parser calls and assertions from eyecite, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const site = "tests/test_ResolveTest.py:130:20:get_citations";
const assertionSite = "tests/test_ResolveTest.py:131:12:caseDeclaration";
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
const JsonModels = S.Array(S.JsonObject);

const readRows = Effect.fn("CanonicalParserTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
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
      return { id, body, models, expected: A.getUnsafe(body.outcome.value, 0) };
    })
  );
});
type ParserReplayRow = Pick<Effect.Success<ReturnType<typeof readRows>>[number], "id" | "body" | "models">;
const replayRows = Effect.fn("CanonicalParserTest.rows")(function* (
  kind: CitationNativeRuntimeKind,
  rows: ReadonlyArray<ParserReplayRow>
) {
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  for (const row of rows) {
    const result = yield* replay.extract(row.body.input.plain_text, "plain", row.models, row.id, null);
    expect(result.source.source.sourceText, row.id).toBe(row.body.stages.document.plainText);
  }
  yield* replay.assertRetired;
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
  yield* replayRows(kind, selected);
});

const courtSite = "tests/test_CourtsTest.py:41:29:get_citations";
const CourtOperand = S.Struct({ kind: S.tag("value"), value: S.String });
const CourtCriterion = S.fromJsonString(
  S.Struct({
    context: S.Struct({ values: S.Struct({ key: S.String, eyecite_result: JsonModels }) }),
    passed: S.tag(true),
    operands: S.Tuple([CourtOperand, CourtOperand]),
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
  })
);
const CourtModel = S.Struct({ fields: S.Struct({ metadata: S.Struct({ fields: S.Struct({ court: S.String }) }) }) });
const readCourtRows = Effect.fn("CanonicalParserTest.courts")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const selected = A.filter(
    operations.cases,
    (row) => row.operation === "get_citations" && row.sourceSiteId === courtSite
  );
  expect(selected).toHaveLength(29);
  return yield* Effect.forEach(
    selected,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original court extraction");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original successful court extraction");
      expect(body.input.tokenizer.tokenizer, row.id).toBe("AhocorasickTokenizer");
      expect(body.input.clean_steps, row.id).toBeNull();
      expect(body.input.markup_text, row.id).toBe("");
      expect(body.input.remove_ambiguous, row.id).toBe(false);
      const models = yield* S.decodeEffect(JsonModels)(body.outcome.value);
      const id = Str.replace(courtSite, "tests/test_CourtsTest.py:42:12:caseDeclaration")(row.id);
      const assertion = yield* Effect.fromOption(HashMap.get(assertions, id));
      const criterion = yield* S.decodeEffect(CourtCriterion)(assertion.payload);
      expect(body.input.plain_text, id).toBe(criterion.context.values.key);
      expect(models, id).toEqual(criterion.context.values.eyecite_result);
      expect(criterion.operands[0].value, id).toBe(criterion.operands[1].value);
      expect(models, id).toHaveLength(1);
      const model = yield* S.decodeUnknownEffect(CourtModel)(A.getUnsafe(models, 0));
      expect(model.fields.metadata.fields.court, id).toBe(criterion.operands[1].value);
      return { id, body, models };
    })
  );
});
/** Replay original court assertions, retaining independent operands and raw input.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalCourtExtraction = Effect.fn("CanonicalParserTest.courtReplay")(function* (
  kind: CitationNativeRuntimeKind,
  shard: number,
  size: number,
  entriesOnly?: boolean
) {
  const rows = yield* readCourtRows();
  const selected =
    entriesOnly === true
      ? A.map([0, 11, 12, 18, 28], (index) => A.getUnsafe(rows, index))
      : A.take(A.drop(rows, shard * size), size);
  expect(selected).toHaveLength(entriesOnly === true ? 5 : Math.min(size, rows.length - shard * size));
  expect(selected.length).toBeGreaterThan(0);
  yield* replayRows(kind, selected);
});
