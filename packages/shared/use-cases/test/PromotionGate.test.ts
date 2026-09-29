import {
  PromotionBlockReason,
  PromotionGateRequest,
  PromotionGateVerdict,
  PromotionSubjectRef,
  PromotionTenantRef,
} from "@beep/shared-use-cases/PromotionGate";
import { PromotionGate } from "@beep/shared-use-cases/server";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import type { Brand } from "effect";

const isPromotionBlockReason2 = S.is(PromotionBlockReason);
const decodePromotionBlockReason = S.decodeUnknownResult(PromotionBlockReason);
const encodePromotionBlockReason = S.encodeUnknownResult(PromotionBlockReason);

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
    expect(isPromotionBlockReason2("vertical-policy-blocked")).toBe(true);
    expect(isPromotionBlockReason2("raw internal failure: password=secret")).toBe(false);
    expect(isPromotionBlockReason2(" vertical-policy-blocked ")).toBe(false);
    expect(isPromotionBlockReason2("VerticalPolicyBlocked")).toBe(false);
    expect(isPromotionBlockReason2(`blocked-${"x".repeat(80)}`)).toBe(false);
  });

  it("keeps the refusal-reason brand keys, trimming decode, messages, and bytes", () => {
    expectTypeOf<PromotionBlockReason>().toEqualTypeOf<
      string & Brand.Brand<"NonEmptyTrimmedStr"> & Brand.Brand<"KebabCaseStr"> & Brand.Brand<"PromotionBlockReason">
    >();
    expect(Result.getOrThrow(decodePromotionBlockReason(" vertical-policy-blocked "))).toBe("vertical-policy-blocked");
    expect(Result.getOrThrow(encodePromotionBlockReason("vertical-policy-blocked"))).toBe("vertical-policy-blocked");
    expect(String(Result.merge(decodePromotionBlockReason("   ")))).toContain("String must not be empty");
    expect(String(Result.merge(decodePromotionBlockReason("VerticalPolicyBlocked")))).toContain(
      "Must be KebabCase format"
    );
  });

  it("round-trips the shared boundary schemas", () => {
    assertSchemaArbitraryDecodesToSelf(PromotionSubjectRef, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(PromotionGateRequest, { runs: 25 });
    assertSchemaArbitraryDecodesToSelf(PromotionGateVerdict, { runs: 25 });
  });
});
