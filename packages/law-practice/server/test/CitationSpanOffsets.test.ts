import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationHtmlTagGeometry } from "@beep/law-practice-server/internal/Citation/HtmlTagGeometry";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationSpanDiffStep,
  CitationSpanOffsetEntry,
  CitationSpanOffsetSide,
  makeCitationSpanOffsets,
} from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationSpanOffsets");
const Native = CitationNativeUnicodeHex;
const Tag = S.Struct({ text: Native, start: S.Natural, end: S.Natural });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-span-offsets/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    dmp: S.tag("2.0.1"),
    producerSha256: S.tag("056e2cead2d863ed14ac2b08a1c4e8f2974c6bc8162d1e5cfb982dea05bff955"),
    maps: S.Array(
      S.Struct({
        id: S.Natural,
        before: Native,
        after: Native,
        error: S.Null,
        steps: S.Array(CitationSpanDiffStep),
        entries: S.Array(CitationSpanOffsetEntry),
        queries: S.Array(
          S.Struct({
            position: S.Int,
            side: CitationSpanOffsetSide,
            value: S.NullOr(S.Int),
            error: S.NullOr(S.Literals(["IndexError"])),
          })
        ),
      })
    ).check(S.isBetweenLength(68, 68)),
    documents: S.Array(
      S.Struct({
        plain: Native,
        forwardMap: S.Natural,
        backwardMap: S.Natural,
        tags: S.Array(Tag),
        queries: S.Array(S.Struct({ position: S.Int, tags: S.Array(Tag) })),
        conversions: S.Array(S.Struct({ tag: Tag, text: Native, start: S.Int, end: S.Int })),
      })
    ).check(S.isBetweenLength(14, 14)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Original constructor entries, all bisect observations and real HTML document geometry; diff generation is not target-qualified.",
  })
);
const load = Effect.fn("SpanOffsetsTest.load")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "span-offsets",
    "d1f8800ef9c6b3730348c0f634d92d9e6c473a822ab72b8c933d57a67f030fd5"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const input = yield* makeCitationRegexInput(limits);
  const plans = yield* Effect.forEach(
    corpus.maps,
    Effect.fn("SpanOffsetsTest.preparePlan")(function* (row) {
      const before = yield* input.prepareUnicode(row.before, () => Effect.void);
      const after = yield* input.prepareUnicode(row.after, () => Effect.void);
      return { before: before.layout, after: after.layout, steps: row.steps };
    })
  );
  return { corpus, limits, plans };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source diff offsets and HTML geometry", (it) => {
  it.effect("preserves every original constructor entry and left/right lookup", () =>
    Effect.gen(function* () {
      const { corpus, limits, plans } = yield* load();
      let count = 0;
      for (const row of corpus.maps) {
        const map = yield* makeCitationSpanOffsets(limits, A.getUnsafe(plans, row.id));
        const snapshot = yield* map.snapshot;
        expect(snapshot).toEqual(row.entries);
        for (const query of row.queries) {
          if (query.error !== null) {
            const failure = yield* map.update(query.position, query.side).pipe(Effect.flip);
            expect(failure).toMatchObject({ _tag: "CitationSpanOffsetsFailure", reason: "empty-map" });
          } else {
            const value = yield* map.update(query.position, query.side);
            expect(value, `${row.id}:${query.side}:${query.position}`).toBe(query.value);
          }
          count++;
        }
      }
      expect(count).toBe(2222);
    })
  );
  it.effect("finds unique emphasis matches and converts native spans from prepared original plans", () =>
    Effect.gen(function* () {
      const { corpus, limits, plans } = yield* load();
      let queries = 0;
      let conversions = 0;
      for (const document of corpus.documents) {
        const budget = yield* makeCitationTextBudget(limits);
        const geometry = yield* makeCitationHtmlTagGeometry(limits, {
          plain: document.plain,
          tags: document.tags,
          forward: A.getUnsafe(plans, document.forwardMap),
          backward: A.getUnsafe(plans, document.backwardMap),
        }).pipe(Effect.provideService(CitationTextBudget, budget));
        for (const query of document.queries) {
          const tags = yield* geometry.find(query.position);
          expect(tags).toEqual(query.tags);
          queries++;
        }
        for (const conversion of document.conversions) {
          const mapped = yield* geometry.convert([conversion.tag]);
          expect(mapped).toEqual({ text: conversion.text, start: conversion.start, end: conversion.end });
          const duplicated = yield* geometry.convert([conversion.tag, conversion.tag]);
          expect(duplicated).toEqual(mapped);
          conversions++;
        }
      }
      expect(queries).toBe(312);
      expect(conversions).toBe(14);
    })
  );
  it.effect("preflights input/step budgets and owns map state after installation", () =>
    Effect.gen(function* () {
      const { limits, plans } = yield* load();
      const source = A.getUnsafe(plans, 8);
      const raw = { ...source, steps: A.map(source.steps, (step) => ({ ...step })) };
      const map = yield* makeCitationSpanOffsets(limits, raw);
      const before = yield* map.snapshot;
      A.getUnsafe(raw.steps, 0).amount = 0;
      const after = yield* map.snapshot;
      expect(after).toEqual(before);
      const tooMany = yield* makeCitationSpanOffsets({ ...limits, diffSteps: 1 }, source).pipe(Effect.flip);
      expect(tooMany).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffSteps" });
      const tooLong = yield* makeCitationSpanOffsets({ ...limits, diffInputUtf16: 1 }, source).pipe(Effect.flip);
      expect(tooLong).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffInputUtf16" });
      const incoherent = yield* makeCitationSpanOffsets(limits, raw).pipe(Effect.flip);
      expect(incoherent).toMatchObject({ _tag: "CitationSpanOffsetsFailure", reason: "invalid-plan" });
      const invalid = yield* map.update(0.5, "right").pipe(Effect.flip);
      expect(invalid).toMatchObject({ reason: "invalid-offset" });
      const invalidSide = yield* map.update(0, "middle").pipe(Effect.flip);
      expect(invalidSide).toMatchObject({ reason: "invalid-offset" });
      const invalidPolicy = yield* makeCitationSpanOffsets({}, source).pipe(Effect.flip);
      expect(invalidPolicy).toMatchObject({ reason: "invalid-policy" });
      const invalidPlan = yield* makeCitationSpanOffsets(limits, {}).pipe(Effect.flip);
      expect(invalidPlan).toMatchObject({ reason: "invalid-plan" });
    })
  );
  it.effect("copies exposed tag buffers and rejects ambiguous geometry without partial text", () =>
    Effect.gen(function* () {
      const { corpus, limits, plans } = yield* load();
      const document = A.getUnsafe(corpus.documents, 0);
      const raw = {
        plain: document.plain,
        tags: document.tags,
        forward: A.getUnsafe(plans, document.forwardMap),
        backward: A.getUnsafe(plans, document.backwardMap),
      };
      const budget = yield* makeCitationTextBudget(limits);
      const geometry = yield* makeCitationHtmlTagGeometry(limits, raw).pipe(
        Effect.provideService(CitationTextBudget, budget)
      );
      const query = yield* Effect.fromOption(A.findFirst(document.queries, (row) => row.tags.length === 1));
      const tags = yield* geometry.find(query.position);
      A.getUnsafe(tags, 0).text.bytes.fill(0);
      const repeated = yield* geometry.find(query.position);
      expect(repeated).toEqual(query.tags);
      const empty = yield* geometry.convert([]).pipe(Effect.flip);
      expect(empty).toMatchObject({ reason: "empty-tags" });
      const tag = A.getUnsafe(document.tags, 0);
      const ambiguous = yield* makeCitationHtmlTagGeometry(limits, { ...raw, tags: [tag, tag] }).pipe(
        Effect.provideService(CitationTextBudget, budget)
      );
      const rejected = yield* ambiguous.find(query.position);
      expect(rejected).toEqual([]);
      const tightBudget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 1 });
      const tight = yield* makeCitationHtmlTagGeometry({ ...limits, producedTextUtf16: 1 }, raw).pipe(
        Effect.provideService(CitationTextBudget, tightBudget),
        Effect.flip
      );
      expect(tight).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
    })
  );
});
