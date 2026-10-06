import {
  BoxContentMigrationBudgetError,
  BoxContentMigrationMapError,
  BoxProviderId,
  BoxProvisioningApplyJournalError,
  BoxProvisioningBlockerContractError,
  BoxProvisioningDriftError,
  BoxProvisioningInvariantError,
  BoxProvisioningPlanner,
  BoxProvisioningSchemaError,
  BoxProvisioningSubjectMismatchError,
  BoxProvisioningTenantMismatchError,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { desiredFixture, observedFixture, postApplyAdoptionsFixture } from "./fixtures.ts";

const sensitiveId = BoxProviderId.make("sensitive-provider-id");
const digest = Sha256Hex.make("a".repeat(64));

const errors = [
  { error: BoxProvisioningSchemaError.make({ stage: "migration-map" }), fragment: "migration-map" },
  {
    error: BoxProvisioningTenantMismatchError.make({
      actualEnterpriseId: sensitiveId,
      expectedEnterpriseId: sensitiveId,
    }),
    fragment: "enterprise fingerprint",
  },
  {
    error: BoxProvisioningSubjectMismatchError.make({ actualSubjectId: sensitiveId, expectedSubjectId: sensitiveId }),
    fragment: "service identity",
  },
  {
    error: BoxProvisioningDriftError.make({ actualPlanDigest: digest, expectedPlanDigest: digest }),
    fragment: "stale",
  },
  { error: BoxProvisioningInvariantError.make({ code: "invalid-plan-digest" }), fragment: "invalid-plan-digest" },
  {
    error: BoxProvisioningBlockerContractError.make({ code: "non-entitlement-blocker", phase: "pre-apply" }),
    fragment: "pre-apply blocker contract failed: non-entitlement-blocker",
  },
  { error: BoxProvisioningApplyJournalError.make({ operation: "append" }), fragment: "failed to append" },
  {
    error: BoxContentMigrationMapError.make({ reason: "duplicate-destination", violationCount: 2 }),
    fragment: "duplicate-destination (2)",
  },
  {
    error: BoxContentMigrationBudgetError.make({ maxProviderCalls: 10, phase: "post-plan", usedProviderCalls: 8 }),
    fragment: "post-plan would exceed the provider-call budget of 10",
  },
];

describe("@beep/box-provisioning errors", () => {
  it.each(errors)("$error._tag renders a sanitized message", ({ error, fragment }) => {
    expect(error.message).toContain(fragment);
    // Provider ids and digests are payload fields; the rendered message never repeats them.
    pipe(
      A.some([sensitiveId, digest], (secret) => pipe(error.message, Str.includes(secret))),
      assertFalse
    );
  });
});

it.layer(Layer.mergeAll(BoxProvisioningPlanner.layer, BunCrypto.layer), { timeout: "10 seconds" })(
  "@beep/box-provisioning planner service",
  (it) => {
    it.effect(
      "plans through the injectable service exactly like the pure planner",
      Effect.fnUntraced(function* () {
        const planner = yield* BoxProvisioningPlanner;

        const planned = yield* planner.plan(desiredFixture, observedFixture);
        const adopted = yield* planner.planWithAdoptions(desiredFixture, observedFixture, postApplyAdoptionsFixture);

        expect(planned.planDigest).toBe((yield* planBoxProvisioning(desiredFixture, observedFixture)).planDigest);
        expect(adopted.planDigest).toBe(
          (yield* planBoxProvisioning(desiredFixture, observedFixture, postApplyAdoptionsFixture)).planDigest
        );
      })
    );
  }
);
