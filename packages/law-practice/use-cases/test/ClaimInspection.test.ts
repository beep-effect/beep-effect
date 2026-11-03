import { ContentDigest } from "@beep/file-processing/Artifact";
import {
  ClaimInputCollection,
  ClaimInputInspectionReport,
  ClaimInputRecord,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import {
  ClaimInspection,
  ClaimInspectionLive,
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
        const report = yield* claimInspectInput(mixed);
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
        const report = yield* claimInspectInput(input);
        assert.strictEqual(report.indexStatus, "incomplete");
        assert.deepStrictEqual(
          A.map(report.records, ({ status }) => status),
          ["unchecked"]
        );
        assert.deepStrictEqual(report.input.records, input.records);
      })
    );
    it.effect("refuses a complete response over 1 MiB including UTF-8 expansion without truncation", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(claimInspectInput(inputOf(Str.repeat(70_000)("界"))));
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
    assert.strictEqual(ClaimInspectionTool.successSchema, ClaimInputInspectionReport);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.Readonly), true);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.Destructive), false);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.Idempotent), true);
    assert.strictEqual(Context.get(ClaimInspectionTool.annotations, Tool.OpenWorld), false);
    assert.strictEqual(ClaimSelfCheckTool.name, "claim_self_check");
    assert.strictEqual(ClaimSelfCheckTool.parametersSchema, ClaimSelfCheckReviewRequest);
  });
});
