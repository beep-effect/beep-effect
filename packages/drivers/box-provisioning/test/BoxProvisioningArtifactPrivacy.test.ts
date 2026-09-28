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
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const isBoxBlockedByAmbiguity = S.is(BoxBlockedByAmbiguity);
const isBoxBlockedByEntitlement = S.is(BoxBlockedByEntitlement);
const isBoxBlockedByPolicy = S.is(BoxBlockedByPolicy);

const sensitiveSentinels = [
  { category: "folder-name", value: "Confidential Client Folder" },
  { category: "email", value: "attorney@example.test" },
  { category: "callback-url", value: "https://example.test/box/callback" },
  { category: "bearer-token", value: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature" },
];

const stringCarriers = [
  { schemaName: "BoxApplyAttemptId", accepts: S.is(BoxApplyAttemptId) },
  { schemaName: "BoxSourceRevision", accepts: S.is(BoxSourceRevision) },
  { schemaName: "BoxProviderId", accepts: S.is(BoxProviderId) },
  { schemaName: "BoxProviderRevision", accepts: S.is(BoxProviderRevision) },
  { schemaName: "Sha256Hex", accepts: S.is(Sha256Hex) },
];

const closedDomains = [
  { schemaName: "BoxPlanName", accepts: S.is(BoxPlanName) },
  {
    schemaName: "BoxBlockedByEntitlement",
    accepts: (sentinel: string) =>
      isBoxBlockedByEntitlement({
        _tag: "BlockedByEntitlement",
        entitlement: "metadata",
        planName: sentinel,
      }),
  },
  {
    schemaName: "BoxBlockedByAmbiguity",
    accepts: (sentinel: string) =>
      isBoxBlockedByAmbiguity({
        _tag: "BlockedByAmbiguity",
        candidateCount: 2,
        matchKind: sentinel,
      }),
  },
  {
    schemaName: "BoxBlockedByPolicy",
    accepts: (sentinel: string) => isBoxBlockedByPolicy({ _tag: "BlockedByPolicy", policy: sentinel }),
  },
];

describe("@beep/box-provisioning artifact privacy schemas", () => {
  describe("rejects sensitive-looking values from every plan and receipt string carrier", () => {
    it.each(
      A.flatMap(stringCarriers, (carrier) => A.map(sensitiveSentinels, (sentinel) => ({ ...carrier, ...sentinel })))
    )("$schemaName rejects $category", ({ accepts, value }) => {
      pipe(accepts(value), assertFalse);
    });
  });

  describe("keeps entitlement plan names and blocker values in closed domains", () => {
    it.each(
      A.flatMap(closedDomains, (carrier) => A.map(sensitiveSentinels, (sentinel) => ({ ...carrier, ...sentinel })))
    )("$schemaName rejects $category", ({ accepts, value }) => {
      pipe(accepts(value), assertFalse);
    });
  });
});
