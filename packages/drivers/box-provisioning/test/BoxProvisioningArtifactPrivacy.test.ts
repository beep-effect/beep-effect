import {
  BoxApplyAttemptId,
  BoxBlockedByAmbiguity,
  BoxBlockedByEntitlement,
  BoxBlockedByPolicy,
  BoxPlanName,
  BoxProviderId,
  BoxProviderRevision,
  BoxSourceRevision,
} from "@beep/box-provisioning";
import { Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const sensitiveSentinels = [
  "Confidential Client Folder",
  "attorney@example.test",
  "https://example.test/box/callback",
  "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
];

const rejectsEverySentinel = (schema: S.Top): boolean =>
  A.every(sensitiveSentinels, (sentinel) => !S.is(schema)(sentinel));

describe("@beep/box-provisioning artifact privacy schemas", () => {
  it("rejects sensitive-looking values from every plan and receipt string carrier", () => {
    expect(rejectsEverySentinel(BoxApplyAttemptId)).toBe(true);
    expect(rejectsEverySentinel(BoxSourceRevision)).toBe(true);
    expect(rejectsEverySentinel(BoxProviderId)).toBe(true);
    expect(rejectsEverySentinel(BoxProviderRevision)).toBe(true);
    expect(rejectsEverySentinel(Sha256Hex)).toBe(true);
  });

  it("keeps entitlement plan names and blocker values in closed domains", () => {
    expect(rejectsEverySentinel(BoxPlanName)).toBe(true);
    expect(
      A.every(
        sensitiveSentinels,
        (sentinel) =>
          !S.is(BoxBlockedByEntitlement)({
            _tag: "BlockedByEntitlement",
            entitlement: "metadata",
            planName: sentinel,
          }) &&
          !S.is(BoxBlockedByAmbiguity)({
            _tag: "BlockedByAmbiguity",
            candidateCount: 2,
            matchKind: sentinel,
          }) &&
          !S.is(BoxBlockedByPolicy)({ _tag: "BlockedByPolicy", policy: sentinel })
      )
    ).toBe(true);
  });
});
