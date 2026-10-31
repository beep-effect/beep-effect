import {
  RetentionPolicy,
  RetentionPolicyAdmission,
  retentionDecayAtAge,
  retentionPayloadBytes,
  retentionPolicyDigest,
  retentionTierAtAge,
} from "@beep/epistemic-domain/values/Retention";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Positive = RetentionPolicy.fields.hotThroughMillis.check(S.isLessThanOrEqualTo(1_000_000));
const PolicyArbitrary = Arbitrary.schema(
  S.Struct({
    hotThroughMillis: Positive,
    warmThroughMillis: Positive,
    coldThroughMillis: Positive,
    decayScaleMillis: Positive,
    payloadBudgetBytes: Positive,
  })
).pipe(
  Arbitrary.map((parts) =>
    RetentionPolicy.make({
      ...parts,
      warmThroughMillis: parts.hotThroughMillis + parts.warmThroughMillis,
      coldThroughMillis: parts.hotThroughMillis + parts.warmThroughMillis + parts.coldThroughMillis,
    })
  )
);

describe("retention policy domain", () => {
  it.effect.prop(
    "binds exact policy values across wire round trips and distinguishes changes",
    [PolicyArbitrary],
    ([policy]) =>
      Effect.gen(function* () {
        const wire = yield* S.encodeEffect(RetentionPolicy)(policy);
        const decoded = yield* S.decodeEffect(RetentionPolicy)(wire);
        const digest = yield* retentionPolicyDigest(policy);
        expect(yield* retentionPolicyDigest(decoded)).toBe(digest);
        const changed = RetentionPolicy.make({ ...policy, payloadBudgetBytes: policy.payloadBudgetBytes + 1 });
        expect(yield* retentionPolicyDigest(changed)).not.toBe(digest);
      })
  );
  it.effect.prop("uses inclusive policy boundaries in both call forms", [PolicyArbitrary], ([policy]) =>
    Effect.sync(() => {
      expect(retentionTierAtAge(0, policy)).toBe("hot");
      expect(retentionTierAtAge(policy.hotThroughMillis, policy)).toBe("hot");
      expect(retentionTierAtAge(policy)(policy.hotThroughMillis + 1)).toBe("warm");
      expect(retentionTierAtAge(policy.warmThroughMillis, policy)).toBe("warm");
      expect(retentionTierAtAge(policy)(policy.warmThroughMillis + 1)).toBe("cold");
      expect(retentionTierAtAge(policy.coldThroughMillis, policy)).toBe("cold");
      expect(retentionTierAtAge(policy)(policy.coldThroughMillis + 1)).toBe("evictable");
      expect(retentionDecayAtAge(0, policy)).toBe(1);
      expect(retentionDecayAtAge(policy)(policy.decayScaleMillis)).toBe(0.5);
    })
  );
  it("does not represent calibrated admission without a policy and receipt", () => {
    assertNone(S.decodeUnknownOption(RetentionPolicyAdmission)({ state: "calibrated" }));
    expect(RetentionPolicyAdmission.cases.inert.make({}).state).toBe("inert");
  });
  it("measures canonical UTF-8 payload bytes independently of key order", () => {
    expect(retentionPayloadBytes({ text: "é" })).toBe(13);
    expect(retentionPayloadBytes({ b: 2, a: { text: "é" } })).toBe(retentionPayloadBytes({ a: { text: "é" }, b: 2 }));
  });
});
