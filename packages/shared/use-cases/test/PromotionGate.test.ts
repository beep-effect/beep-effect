import {
  PromotionBlockReason,
  PromotionGateRequest,
  PromotionGateVerdict,
  PromotionSubjectRef,
  PromotionTenantRef,
} from "@beep/shared-use-cases/PromotionGate";
import { PromotionGate } from "@beep/shared-use-cases/server";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

describe("PromotionGate", () => {
  it.effect("carries only an opaque subject across the contract", () =>
    Effect.gen(function* () {
      const subject = PromotionSubjectRef.make({ id: "subject-1", kind: "matter" });
      const request = PromotionGateRequest.make({ subject, tenantRef: PromotionTenantRef.make("tenant-1") });
      const verdict = yield* PromotionGate.pipe(Effect.flatMap((gate) => gate.evaluate(request)));

      expect(verdict.outcome).toBe("clear");
    }).pipe(
      Effect.provideService(
        PromotionGate,
        PromotionGate.of({
          evaluate: Effect.fnUntraced(function* () {
            return PromotionGateVerdict.cases.clear.make({});
          }),
        })
      )
    )
  );

  it("rejects prose, whitespace, uppercase, and unbounded refusal reasons", () => {
    const isPromotionBlockReason = S.is(PromotionBlockReason);

    expect(isPromotionBlockReason("vertical-policy-blocked")).toBe(true);
    expect(isPromotionBlockReason("raw internal failure: password=secret")).toBe(false);
    expect(isPromotionBlockReason(" vertical-policy-blocked ")).toBe(false);
    expect(isPromotionBlockReason("VerticalPolicyBlocked")).toBe(false);
    expect(isPromotionBlockReason(`blocked-${"x".repeat(80)}`)).toBe(false);
  });

  it("round-trips the shared boundary schemas", () => {
    assertSchemaArbitraryDecodesToSelf(PromotionSubjectRef, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(PromotionGateRequest, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(PromotionGateVerdict, { numRuns: 25 });
  });
});
