/**
 * Opt-in, read-only live check of the account singletons.
 *
 * Runs only with `BEEP_ALCHEMY_AWS_EXTRAS_LIVE=1` and AWS credentials in the
 * environment (for example `eval "$(aws configure export-credentials
 * --profile elpresidank-vault --format env)"`). It calls `read` only: it never
 * reconciles or deletes, so it cannot change the live account settings.
 * `beep:test` excludes `test/integration`, so hosted CI never runs it.
 */
import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import * as Test from "@alchemy.run/test/Vitest";
import { ComputeOptimizerEnrollmentType } from "@beep/alchemy-aws-extras/ComputeOptimizerEnrollment";
import { CostAllocationTagType } from "@beep/alchemy-aws-extras/CostAllocationTag";
import { CostOptimizationHubEnrollmentType } from "@beep/alchemy-aws-extras/CostOptimizationHubEnrollment";
import { Providers, providers } from "@beep/alchemy-aws-extras/Providers";
import { describe, expect } from "@effect/vitest";
import { inMemoryState } from "alchemy/State";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const live = Effect.runSync(Config.Boolean("BEEP_ALCHEMY_AWS_EXTRAS_LIVE").pipe(Config.withDefault(false)));

const environment = Layer.succeed(
  AWSEnvironment,
  Effect.gen(function* () {
    const accountId = yield* Config.String("AWS_ACCOUNT_ID").pipe(Config.withDefault("832907639880"));
    const region = yield* Config.String("AWS_REGION").pipe(Config.withDefault("us-east-1"));
    const accessKeyId = yield* Config.String("AWS_ACCESS_KEY_ID");
    const secretAccessKey = yield* Config.Redacted("AWS_SECRET_ACCESS_KEY");
    const sessionToken = yield* Config.Redacted("AWS_SESSION_TOKEN").pipe(Config.option);
    return {
      accountId,
      region,
      credentials: Effect.succeed({
        accessKeyId: Redacted.make(accessKeyId),
        secretAccessKey,
        sessionToken: sessionToken._tag === "Some" ? sessionToken.value : undefined,
        region,
      }),
    };
  }).pipe(Effect.orDie)
);

/** The `read` lifecycle method, with its failure named (providers type it `any`). */
type ReadFn = (input: {
  readonly id: string;
  readonly fqn: string;
  readonly instanceId: string;
  readonly olds: object;
  readonly output: undefined;
}) => Effect.Effect<unknown, { readonly _tag: string }>;

const readAttributes = Effect.fn("LiveRead.readAttributes")(function* (type: string, olds: object) {
  const collection = yield* Providers;
  const read: ReadFn | undefined = collection.get(type)?.read;
  if (read === undefined) return yield* Effect.die(`no read for ${type}`);
  return yield* read({ id: type, fqn: type, instanceId: "live-read", olds, output: undefined });
});

const { test } = Test.make({ providers: providers.pipe(Layer.provide(environment)), state: inMemoryState() });

describe("live read-only account singletons", () => {
  test.provider.skipIf(!live)(
    "reads the six cost allocation tags and both enrollments",
    () =>
      Effect.gen(function* () {
        for (const tagKey of ["App", "Project", "ManagedBy", "beep-ci", "ghr:environment", "DataClass"]) {
          const tag = yield* readAttributes(CostAllocationTagType, { tagKey });
          expect(tag).toMatchObject({ tagKey, status: "Active" });
        }
        const computeOptimizer = yield* readAttributes(ComputeOptimizerEnrollmentType, {});
        expect(computeOptimizer).toMatchObject({ status: "Active" });
        const optimizationHub = yield* readAttributes(CostOptimizationHubEnrollmentType, {});
        expect(optimizationHub).toMatchObject({ status: "Active" });
      }),
    60_000
  );
});
