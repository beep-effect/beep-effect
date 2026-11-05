import {
  ClaimInputCollection,
  ClaimInputRecord,
  inspectClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import {
  ClaimInspection,
  ClaimInspectionCursor,
  ClaimInspectionError,
  ClaimInspectionLive,
  ClaimInspectionPage,
  ClaimInspectionPageRequest,
  UsptoClaimInputs,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { claimInspectInput } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const input = ClaimInputCollection.make({
  sourceKey: "synthetic-explicit-missing-reference",
  records: [
    ClaimInputRecord.cases.text.make({
      sourceOrdinal: 1,
      numberText: O.some("1"),
      sourceText: "A housing comprising the panel.",
      canonicalText: "A housing comprising the panel.",
    }),
  ],
});
const pageJson = S.fromJsonString(ClaimInspectionPage);
const encodePage = S.encodeEffect(pageJson);
const decodePage = S.decodeEffect(pageJson);
const local = ClaimInspectionLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("InspectionBoundary.unusedSource")(() =>
        Effect.fail(UsptoClaimsError.make({ reason: "unavailable", message: "Only supplied source is checked." }))
      ),
    })
  )
);

describe("inspection page findings and provider boundary", () => {
  it.layer(local, { timeout: "10 seconds" })((it) => {
    it.effect("keeps an actual missing-reference alert in a complete encoded page", () =>
      Effect.gen(function* () {
        const page = yield* claimInspectInput(ClaimInspectionPageRequest.make({ input }));
        assert.strictEqual(A.headNonEmpty(page.records).status, "complete");
        const encoded = yield* encodePage(page);
        const decoded = yield* decodePage(encoded);
        const result = A.headNonEmpty(decoded.records);
        if (result.status !== "complete") return assert.fail("Expected covered record with a substantive finding.");
        assert.isTrue(A.some(result.findings, (finding) => finding.kind === "missing-antecedent"));
        assert.strictEqual(decoded.summary.complete, 1);
      })
    );
  });
  it.effect("returns a typed invalid-cursor failure when a provider returns a shorter valid ledger", () =>
    Effect.gen(function* () {
      const shortReport = yield* inspectClaimInput(input);
      const longerInput = ClaimInputCollection.make({
        sourceKey: "synthetic-longer-ledger",
        records: [
          A.headNonEmpty(input.records),
          ClaimInputRecord.cases.text.make({
            sourceOrdinal: 2,
            numberText: O.some("2"),
            sourceText: "A housing comprising a panel.",
            canonicalText: "A housing comprising a panel.",
          }),
        ],
      });
      const provider = ClaimInspection.of({
        inspect: Effect.fn("InspectionBoundary.shortReport")(() => Effect.succeed(shortReport)),
        inspectPublished: Effect.fn("InspectionBoundary.noPublishedSource")(() =>
          Effect.fail(
            ClaimInspectionError.make({ reason: "public-source-unavailable", message: "No published source." })
          )
        ),
      });
      const error = yield* Effect.flip(
        claimInspectInput(
          ClaimInspectionPageRequest.make({
            input: longerInput,
            cursor: ClaimInspectionCursor.make({ sourceKey: longerInput.sourceKey, nextSourceOrdinal: 2 }),
          })
        ).pipe(Effect.provideService(ClaimInspection, provider))
      );
      assert.strictEqual(error.reason, "invalid-cursor");
    })
  );
});
