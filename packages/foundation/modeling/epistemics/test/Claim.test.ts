import { makeClaimReview, ReviewTag, ValidTime, validAt } from "@beep/epistemics/Claim";
import { $EpistemicsId } from "@beep/identity/packages";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";

const bind = (path: string) =>
  makeClaimReview({
    $I: $EpistemicsId.create(path),
    ids: {
      assertion: S.String.pipe(S.brand("TestAssertionId")),
      activity: S.String.pipe(S.brand("TestActivityId")),
      principal: S.String.pipe(S.brand("TestPrincipalId")),
    },
  });

const review = bind("test/ClaimReviewA");
const absent = { _tag: "Absent", reason: "not-assessed" } as const;
const basis = Str.repeat(64)("b");
const disposition = (value: string) => ({
  disposition: value,
  reviewer: "reviewer-1",
  basis,
  reviewedAt: 2,
  reason: "Synthetic review",
});

describe("Claim review vocabulary", () => {
  it("derives every review tag from the review-state union", () => {
    expect([...ReviewTag.literals].sort()).toEqual([...Struct.keys(review.ReviewState.cases)].sort());
  });

  it("gives each binding its own schema identifiers", () => {
    const other = bind("test/ClaimReviewB");
    expect(SchemaAST.resolveIdentifier(review.ReviewState.ast)).not.toBe(
      SchemaAST.resolveIdentifier(other.ReviewState.ast)
    );
  });

  it.effect("rejects a review state whose disposition contradicts its tag", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownEffect(review.ReviewState);
      const accepted = yield* Effect.exit(decode({ _tag: "Accepted", disposition: disposition("accepted") }));
      const mismatched = yield* Effect.exit(decode({ _tag: "Accepted", disposition: disposition("rejected") }));
      accepted.pipe(Exit.isSuccess, assertTrue);
      mismatched.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("keeps five independent signals and accepts reported extractor confidence", () =>
    Effect.gen(function* () {
      const codec = review.EvidenceSignals;
      const reported = {
        sourceTrust: absent,
        sourceAssertedConfidence: absent,
        extractorConfidence: {
          _tag: "Present",
          value: { _tag: "ReportedConfidence", value: 0, method: "synthetic-report" },
        },
        validator: absent,
        reviewer: { _tag: "Present", value: disposition("abstained") },
      };
      const decoded = yield* S.decodeUnknownEffect(codec)(reported);
      const encoded = yield* S.encodeEffect(codec)(decoded);
      expect(encoded).toEqual(reported);
      const missing = yield* Effect.exit(S.decodeUnknownEffect(codec)({ ...reported, validator: undefined }));
      missing.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("records source dependence without assuming independence", () =>
    Effect.gen(function* () {
      const row = {
        left: "a",
        right: "b",
        dependence: "unknown" as const,
        basis: "same newsroom",
        producedBy: "act-1",
      };
      const decoded = yield* S.decodeEffect(review.DependenceAssessment)(row);
      expect(decoded.dependence).toBe("unknown");
    })
  );
});

describe("ValidTime", () => {
  it.effect("rejects an inverted Interval valid time", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(S.decodeEffect(ValidTime)({ _tag: "Interval", validFrom: 10, validTo: 5 }));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it("never selects unknown valid time", () => {
    assertFalse(validAt(ValidTime.cases.Unknown.make({}), DateTime.makeUnsafe(0)));
  });

  it.effect("selects instants inside a half-open interval", () =>
    Effect.gen(function* () {
      const interval = yield* S.decodeEffect(ValidTime)({ _tag: "Interval", validFrom: 10, validTo: 20 });
      assertTrue(validAt(interval, DateTime.makeUnsafe(10)));
      assertFalse(validAt(DateTime.makeUnsafe(20))(interval));
    })
  );
});

describe("Claim review vocabulary properties", () => {
  const json = S.fromJsonString(review.EvidenceSignals);
  const equivalent = S.toEquivalence(review.EvidenceSignals);
  it.effect.prop(
    "every generated evidence-signal set survives its JSON codec unchanged",
    [Arbitrary.schema(review.EvidenceSignals)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(json)(value);
        const decoded = yield* S.decodeEffect(json)(encoded);
        assertTrue(equivalent(decoded, value));
      }),
    { arbitrary: fcRuns(50) }
  );
});
