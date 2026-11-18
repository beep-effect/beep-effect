import { requireFencedNames } from "@beep/infra-ci-runners/Guards";
import { PhysicalNames, physicalNames } from "@beep/infra-ci-runners/Names";
import { sweepProvider } from "@beep/infra-ci-runners/Providers";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import { describe, expect, it } from "@effect/vitest";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";

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
