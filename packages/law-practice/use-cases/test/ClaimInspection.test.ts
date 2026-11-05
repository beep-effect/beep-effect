import { ContentDigest } from "@beep/file-processing/Artifact";
import {
  ClaimInputCollection,
  ClaimInputInspectionReport,
  ClaimInputRecord,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import {
  ClaimInspection,
  ClaimInspectionCursor,
  ClaimInspectionLive,
  ClaimInspectionPage,
  ClaimInspectionPageRequest,
  ClaimInspectionSummary,
  PublishedClaimInspectionReport,
  UsptoClaimInputSet,
  UsptoClaimInputs,
  UsptoClaimSource,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import {
  ClaimInspectionTool,
  ClaimSelfCheckReviewRequest,
  ClaimSelfCheckTool,
  claimInspectInput,
  PracticeKgToolkit,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const digest = ContentDigest.make(`sha256:${Str.repeat(64)("d")}`);
const documentIdentifier = "synthetic-document";
const inputOf = (sourceText = "raw source fragment") =>
  ClaimInputCollection.make({
    sourceKey: `${documentIdentifier}:${digest}`,
    records: A.map(
      A.make(
        "A fixture comprising a panel.",
        "Unsupported fragment.",
        "A fixture comprising a sensor.",
        "Fixture of claim 2 wherein a relay."
      ),
      (canonicalText, index) =>
        ClaimInputRecord.cases.text.make({
          sourceOrdinal: index + 1,
          numberText: O.some(`${index + 1}`),
          sourceText,
          canonicalText,
        })
    ),
  });
const mixed = inputOf();
const source = UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20260100001") });
const reportJson = S.fromJsonString(PublishedClaimInspectionReport);
const encodePublished = S.encodeEffect(reportJson);
const decodePublished = S.decodeEffect(reportJson);
const equivalentPublished = S.toEquivalence(PublishedClaimInspectionReport);
const pageJson = S.fromJsonString(ClaimInspectionPage);
const encodePage = S.encodeEffect(pageJson);
const decodePage = S.decodeEffect(pageJson);
const encodeInput = S.encodeEffect(S.fromJsonString(ClaimInputCollection));
const encodeFull = S.encodeEffect(S.fromJsonString(ClaimInputInspectionReport));
const encoder = new TextEncoder();
const limit = 1024 * 1024;
const largeMixed = ClaimInputCollection.make({
  sourceKey: "synthetic-large-unicode-source",
  records: A.map(A.range(1, 7), (sourceOrdinal) =>
    ClaimInputRecord.cases.text.make({
      sourceOrdinal,
      numberText: O.some(`${sourceOrdinal}`),
      sourceText: Str.repeat(30_000)("界"),
      canonicalText:
        sourceOrdinal === 2
          ? "Unsupported fragment."
          : sourceOrdinal === 4
            ? "Fixture of claim 2 wherein a relay."
            : "A fixture comprising a panel and the panel.",
    })
  ),
});
const collectLargeInspectionPages = Effect.fn("ClaimInspectionTest.collectPages")(function* () {
  let page = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input: largeMixed }));
  let pages: A.NonEmptyReadonlyArray<ClaimInspectionPage> = [page];
  assert.strictEqual(page.deliveryStatus, "incomplete");
  while (O.isSome(page.nextCursor)) {
    const next = yield* claimInspectInput(
      ClaimInspectionPageRequest.make({ input: largeMixed, cursor: page.nextCursor.value })
    );
    assert.strictEqual(next.range.startSourceOrdinal, page.range.endSourceOrdinal + 1);
    page = next;
    pages = A.append(pages, next);
    assert.isAtMost(pages.length, largeMixed.records.length);
  }
  return { page, pages };
});

const assertPageIsGreedy = Effect.fn("ClaimInspectionTest.assertGreedyPage")(function* (
  value: ClaimInspectionPage,
  full: ClaimInputInspectionReport
) {
  if (O.isNone(value.nextCursor)) return;
  const nextRecord = yield* Effect.fromOption(A.get(full.records, value.range.endSourceOrdinal));
  const end = value.range.endSourceOrdinal + 1;
  const expanded = ClaimInspectionPage.make({
    ...value,
    records: A.append(value.records, nextRecord),
    range: { ...value.range, endSourceOrdinal: end },
    deliveryStatus: end === full.records.length ? "complete" : "incomplete",
    nextCursor:
      end === full.records.length
        ? O.none()
        : O.some(ClaimInspectionCursor.make({ sourceKey: largeMixed.sourceKey, nextSourceOrdinal: end + 1 })),
  });
  const expandedEncoded = yield* encodePage(expanded);
  assert.isAbove(encoder.encode(expandedEncoded).byteLength, limit);
});

const localOnly = ClaimInspectionLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("UsptoClaimInputs.inputs")(() =>
        Effect.die("Local inspection must not acquire public sources.")
      ),
    })
  )
);
const recorded = ClaimInspectionLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("UsptoClaimInputs.inputs")((requested: UsptoClaimSource) =>
        Effect.succeed(
          UsptoClaimInputSet.make({
            input: mixed,
            source: requested,
            documentIdentifier,
            sourceDocumentDigest: digest,
          })
        )
      ),
    })
  )
);
const failed = ClaimInspectionLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("UsptoClaimInputs.inputs")(() =>
        Effect.fail(UsptoClaimsError.make({ reason: "unavailable", message: "Recorded source failure." }))
      ),
    })
  )
);

describe("ClaimInspection service and local tool", () => {
  it.layer(localOnly)((it) => {
    it.effect("runs actual local tool inspection without acquisition, retaining every mixed-source outcome", () =>
      Effect.gen(function* () {
        const report = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input: mixed }));
        assert.strictEqual(report.indexStatus, "incomplete");
        assert.deepStrictEqual(
          A.map(report.records, ({ status }) => status),
          ["partial", "unchecked", "partial", "unchecked"]
        );
        assert.deepStrictEqual(report.input, mixed);
        assert.deepStrictEqual(
          A.map(report.records, ({ decomposition }) => decomposition.qualification.record),
          mixed.records
        );
      })
    );
    it.effect("returns all-unusable input with explicit unchecked outcomes", () =>
      Effect.gen(function* () {
        const input = ClaimInputCollection.make({
          sourceKey: "all-unusable",
          records: [
            ClaimInputRecord.cases.unavailable.make({
              sourceOrdinal: 1,
              numberText: O.none(),
              sourceText: "&broken;",
              reason: "invalid-text",
            }),
          ],
        });
        const report = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input }));
        assert.strictEqual(report.indexStatus, "incomplete");
        assert.deepStrictEqual(
          A.map(report.records, ({ status }) => status),
          ["unchecked"]
        );
        assert.deepStrictEqual(report.input.records, input.records);
      })
    );
    it.effect("traverses greedy UTF-8 pages with exact original records, findings and coverage", () =>
      Effect.gen(function* () {
        const full = yield* (yield* ClaimInspection).inspect(largeMixed);
        const fullEncoded = yield* encodeFull(full);
        assert.isAbove(encoder.encode(fullEncoded).byteLength, limit);
        const { page, pages } = yield* collectLargeInspectionPages();
        assert.isAbove(pages.length, 1);
        assert.strictEqual(page.deliveryStatus, "complete");
        assert.strictEqual(page.range.endSourceOrdinal, largeMixed.records.length);
        assert.deepStrictEqual(
          A.flatMap(pages, (value) => value.records),
          full.records
        );
        for (const value of pages) {
          assert.deepStrictEqual(value.input, largeMixed);
          assert.strictEqual(value.indexStatus, full.indexStatus);
          assert.deepStrictEqual(value.summary, ClaimInspectionSummary.make({ complete: 0, partial: 5, unchecked: 2 }));
          const encoded = yield* encodePage(value);
          assert.isAtMost(encoder.encode(encoded).byteLength, limit);
          assert.isAbove(encoder.encode(encoded).byteLength, encoded.length);
          const decoded = yield* decodePage(encoded);
          assert.deepStrictEqual(decoded, value);
          yield* assertPageIsGreedy(value, full);
        }
      })
    );
    it.effect("fits the complete remainder before charging unnecessary continuation metadata", () =>
      Effect.gen(function* () {
        const input = ClaimInputCollection.make({ ...mixed, sourceKey: Str.repeat(600_000)("x") });
        const page = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input }));
        assert.strictEqual(page.deliveryStatus, "complete");
        assert.strictEqual(page.records.length, mixed.records.length);
        assertNone(page.nextCursor);
        const encoded = yield* encodePage(page);
        assert.isAtMost(encoder.encode(encoded).byteLength, limit);
      })
    );
    it.effect("refuses an irreducible single record even when the full input ledger alone fits", () =>
      Effect.gen(function* () {
        const input = ClaimInputCollection.make({
          sourceKey: "single-large-record",
          records: [
            ClaimInputRecord.cases.text.make({
              sourceOrdinal: 1,
              numberText: O.some("1"),
              sourceText: Str.repeat(200_000)("界"),
              canonicalText: "A fixture comprising a panel.",
            }),
          ],
        });
        const encodedInput = yield* encodeInput(input);
        assert.isBelow(encoder.encode(encodedInput).byteLength, limit);
        const error = yield* Effect.flip(claimInspectInput(ClaimInspectionPageRequest.make({ input })));
        assert.strictEqual(error.reason, "response-too-large");
        assert.isTrue(Str.includes("No supplied record is cleared")(error.message));
      })
    );
    it.effect("delivers complete coverage counts for a fully checked source", () =>
      Effect.gen(function* () {
        const input = ClaimInputCollection.make({
          sourceKey: "complete",
          records: [
            ClaimInputRecord.cases.text.make({
              sourceOrdinal: 1,
              numberText: O.some("1"),
              sourceText: "A fixture comprising a panel.",
              canonicalText: "A fixture comprising a panel.",
            }),
          ],
        });
        const page = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input }));
        assert.strictEqual(page.indexStatus, "complete");
        assert.deepStrictEqual(page.summary, ClaimInspectionSummary.make({ complete: 1, partial: 0, unchecked: 0 }));
        assert.isFalse(S.is(ClaimInspectionPage)({ ...page, indexStatus: "incomplete" }));
      })
    );
    it.effect.prop(
      "round-trips source-derived unavailable records through the page codec",
      [Arbitrary.schema(ClaimInputRecord)],
      ([record]) =>
        Effect.gen(function* () {
          const unavailable = ClaimInputRecord.cases.unavailable.make({
            sourceOrdinal: 1,
            sourceText: record.sourceText,
            numberText: record.numberText,
            reason: "invalid-text",
          });
          const input = ClaimInputCollection.make({
            sourceKey: "arbitrary-preserved-fragment",
            records: [unavailable],
          });
          const page = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input }));
          const encoded = yield* encodePage(page);
          const decoded = yield* decodePage(encoded);
          assert.deepStrictEqual(decoded, page);
          assert.deepStrictEqual(decoded.input.records, [unavailable]);
          assert.deepStrictEqual(decoded.records[0].decomposition.qualification.record, unavailable);
        }),
      { arbitrary: fcRuns(100) }
    );
    it.effect("rejects foreign-source and out-of-range cursors with typed failures", () =>
      Effect.gen(function* () {
        for (const cursor of [
          ClaimInspectionCursor.make({ sourceKey: "other-version", nextSourceOrdinal: 2 }),
          ClaimInspectionCursor.make({ sourceKey: mixed.sourceKey, nextSourceOrdinal: 0 }),
          ClaimInspectionCursor.make({ sourceKey: mixed.sourceKey, nextSourceOrdinal: -1 }),
          ClaimInspectionCursor.make({ sourceKey: mixed.sourceKey, nextSourceOrdinal: mixed.records.length + 1 }),
        ]) {
          const error = yield* Effect.flip(
            claimInspectInput(ClaimInspectionPageRequest.make({ input: mixed, cursor }))
          );
          assert.strictEqual(error.reason, "invalid-cursor");
        }
      })
    );
    it.effect("enforces source, range, summary and delivery invariants in the page schema", () =>
      Effect.gen(function* () {
        const page = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input: mixed }));
        assert.isFalse(S.is(ClaimInspectionPage)({ ...page, range: { ...page.range, startSourceOrdinal: 2 } }));
        assert.isFalse(S.is(ClaimInspectionPage)({ ...page, summary: { ...page.summary, unchecked: 0 } }));
        assert.isFalse(S.is(ClaimInspectionPage)({ ...page, deliveryStatus: "incomplete" }));
        assert.isFalse(
          S.is(ClaimInspectionPage)({ ...page, nextCursor: O.some({ sourceKey: "foreign", nextSourceOrdinal: 2 }) })
        );
        assert.isFalse(S.is(ClaimInspectionPage)({ ...page, records: A.reverse(page.records) }));
      })
    );
    it.effect("refuses a complete response over 1 MiB including UTF-8 expansion without truncation", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          claimInspectInput(ClaimInspectionPageRequest.make({ input: inputOf(Str.repeat(100_000)("界")) }))
        );
        assert.strictEqual(error.reason, "response-too-large");
        assert.isTrue(Str.includes("No supplied record is cleared")(error.message));
      })
    );
  });

  it.layer(recorded)((it) => {
    it.effect("preserves exact publication, document identifier, source digest and input in a published report", () =>
      Effect.gen(function* () {
        const result = yield* (yield* ClaimInspection).inspectPublished(source);
        assert.deepStrictEqual(result.source.source, source);
        assert.strictEqual(result.source.documentIdentifier, documentIdentifier);
        assert.strictEqual(result.source.sourceDocumentDigest, digest);
        assert.deepStrictEqual(result.source.input, mixed);
        assert.deepStrictEqual(result.report.input, mixed);
        const encoded = yield* encodePublished(result);
        const decoded = yield* decodePublished(encoded);
        assert.isTrue(equivalentPublished(decoded, result));
      })
    );
    it.effect.prop(
      "retains arbitrary requested source identities through the real published service",
      [Arbitrary.schema(UsptoClaimSource)],
      ([requested]) =>
        Effect.gen(function* () {
          const result = yield* (yield* ClaimInspection).inspectPublished(requested);
          assert.deepStrictEqual(result.source.source, requested);
          assert.deepStrictEqual(result.report.input, result.source.input);
        }),
      { arbitrary: fcRuns(100) }
    );
  });

  it.layer(failed)((it) => {
    it.effect("translates acquisition failures without mistaking them for an empty successful report", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(ClaimInspection.use((service) => service.inspectPublished(source)));
        assert.strictEqual(error.reason, "public-source-unavailable");
        assert.isTrue(Str.includes("unavailable")(error.message));
      })
    );
  });

  it("registers the additive closed-world tool and preserves the old self-check contract", () => {
    assert.strictEqual(PracticeKgToolkit.tools.claim_inspect_input.name, "claim_inspect_input");
    assert.strictEqual(ClaimInspectionTool.successSchema, ClaimInspectionPage);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.Readonly), true);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.Destructive), false);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.Idempotent), true);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.OpenWorld), false);
    assert.strictEqual(ClaimSelfCheckTool.name, "claim_self_check");
    assert.strictEqual(ClaimSelfCheckTool.parametersSchema, ClaimSelfCheckReviewRequest);
  });
});
