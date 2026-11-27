import { maxStageSlugLength, requireDistinctStage, requireFencedNames } from "@beep/infra-ci-runners/Guards";
import { PhysicalNames, physicalNames } from "@beep/infra-ci-runners/Names";
import { sweepProvider } from "@beep/infra-ci-runners/Providers";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import { describe, expect, it } from "@effect/vitest";
import { Stage } from "alchemy/Stage";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";

describe("CiRunners guards and providers", () => {
  it.effect("refuses names that overlap the live fleet, naming each one", () =>
    Effect.gen(function* () {
      const live = PhysicalNames.make({
        ...physicalNames("prod"),
        fleet: "beep-ci",
        ssmRoot: "/github-action-runners",
      });
      const error = yield* requireFencedNames(live).pipe(Effect.flip);
      expect(error._tag).toBe("ConfigError");
      expect(error.message).toContain("beep-ci");
      expect(error.message).toContain("/github-action-runners");
    })
  );

  it.effect("refuses a non-canonical stage, a prefix overlap with prod either way, an empty or too long slug", () =>
    Effect.gen(function* () {
      yield* requireDistinctStage("prod");
      yield* requireDistinctStage("dev-alice");
      yield* requireDistinctStage("staging");
      yield* requireDistinctStage(Str.repeat(maxStageSlugLength)("a"));
      const refused = yield* Effect.forEach(
        ["dev_alice", "prodfoo", "pro", "prod-x", "Prod", "__", Str.repeat(maxStageSlugLength + 1)("a")],
        (stage) => requireDistinctStage(stage).pipe(Effect.flip),
        { concurrency: 1 }
      );
      const messages = A.map(refused, (error) => error.message);
      expect(A.map(refused, (error) => error._tag)).toEqual(A.replicate("ConfigError", 7));
      expect(messages[0]).toContain('not canonical: use "dev-alice"');
      expect(messages[1]).toContain("prefix one another");
      expect(messages[2]).toContain("prefix one another");
      expect(messages[3]).toContain("prefix one another");
      expect(messages[4]).toContain("not canonical");
      expect(messages[5]).toContain("empty");
      expect(messages[6]).toContain("longer than 16");
    })
  );

  it.effect("admits only slugs every generated name keeps whole, at each boundary-scoped name limit", () =>
    Effect.sync(() => {
      const slug = Str.repeat(maxStageSlugLength)("a");
      const suffix = Str.repeat(16)("x");
      const generated = (logicalId: string) => `CiRunners-${logicalId}-${slug}-${suffix}`;
      const limits: ReadonlyArray<readonly [string, number]> = [
        ["RunnerBinariesSyncer", 64],
        ["TerminationWatcher", 64],
        ["SsmHousekeeper", 64],
        ["RunnerBinaries", 63],
        ["DeregisterRetryQueueDlq", 80],
      ];
      for (const [logicalId, limit] of limits) {
        expect(
          [logicalId, generated(logicalId).length <= limit],
          "Alchemy generates <stack>-<logical id>-<stage>-<suffix> names; past the limit it truncates"
        ).toStrictEqual([logicalId, true]);
      }
      expect(`CiRunners-RunnerBinariesSyncer-${slug}a-${suffix}`.length > 64).toBe(true);
    })
  );

  it.effect("refuses a personal stage whose slug has a prod segment, and keeps prod the production stage", () =>
    Effect.gen(function* () {
      yield* requireDistinctStage("prod");
      yield* requireDistinctStage("dev-alice");
      yield* requireDistinctStage("dev-product");
      yield* requireDistinctStage("reprod-1");
      const refused = yield* Effect.forEach(
        ["alice-prod", "dev-prod-x", "prod-x"],
        (stage) => requireDistinctStage(stage).pipe(Effect.flip),
        { concurrency: 1 }
      );
      for (const error of refused) {
        expect(error.message).toContain("stage slug contains a 'prod' segment, reserved for production");
      }
      const product = yield* requireDistinctStage("product-x").pipe(Effect.flip);
      expect(
        product.message,
        "product-x is refused by the older prefix rule: its fleet name starts with beep-fleet-prod"
      ).toContain("prefix one another");
      expect(product.message).not.toContain("'prod' segment");
    })
  );

  it.effect("builds the RunnerSweep provider for a stage without calling AWS or GitHub", () =>
    Effect.gen(function* () {
      const context = yield* Layer.build(
        sweepProvider.pipe(
          Layer.provide(Layer.mergeAll(Layer.succeed(Stage, "prod"), FetchHttpClient.layer, AwsCredentials.mock))
        )
      );
      expect(context).toBeDefined();
    })
  );
});
