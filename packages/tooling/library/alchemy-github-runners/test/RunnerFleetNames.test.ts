import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import * as Test from "@alchemy.run/test/Vitest";
import {
  FleetNamePrefix,
  fleetResourceNames,
  JobRetryPolicy,
  poolResourceNames,
  RunnerFleet,
  RunnerFleetProps,
  RunnerPool,
} from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { inMemoryState } from "alchemy/State/InMemoryState";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeProviders, Recorder } from "./support/FakeProviders.ts";
import { World } from "./support/FakeWorld.ts";
import type { ScratchStack } from "@alchemy.run/test/Vitest";

const isPrefix = S.is(FleetNamePrefix);

const namePropOf: Readonly<Record<string, string>> = {
  "Lambda.Function": "functionName",
  "SQS.Queue": "queueName",
  "IAM.Role": "roleName",
  "IAM.InstanceProfile": "instanceProfileName",
  "BeepAWS.EC2.RunnerLaunchTemplate": "launchTemplateName",
  "EventBridge.Rule": "name",
  "S3.Bucket": "bucketName",
};

const nameOf = (entry: { readonly type: string; readonly news: Readonly<Record<string, unknown>> }) =>
  entry.news[namePropOf[entry.type] ?? ""];

const environment = Layer.succeed(
  AWSEnvironment,
  Effect.succeed({
    accountId: "123456789012",
    region: "us-east-1",
    credentials: Effect.succeed({
      accessKeyId: Redacted.make("test"),
      secretAccessKey: Redacted.make("test"),
      sessionToken: undefined,
      region: "us-east-1",
    }),
  }) as never
);

const harness = (stage: string) => {
  const recorder = new Recorder();
  const { test } = Test.make({
    providers: fakeProviders({ recorder, world: new World() }).pipe(Layer.provideMerge(environment)),
    state: inMemoryState(),
    stage,
  });
  return { recorder, test };
};

const pools: A.NonEmptyReadonlyArray<RunnerPool> = [
  RunnerPool.make({
    name: "heavy",
    instanceTypes: ["m7i.4xlarge"],
    maximumCount: 2,
    labels: ["beep-fleet-heavy"],
    jobRetry: JobRetryPolicy.makeOption({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 }),
  }),
  RunnerPool.make({
    name: "overflow",
    instanceTypes: ["r7a.2xlarge"],
    maximumCount: 48,
    labels: ["beep-fleet-overflow"],
  }),
];

const fleet = (namePrefix: string | undefined) =>
  RunnerFleet(
    RunnerFleetProps.make({
      id: "Runners",
      name: "beep-fleet-prod",
      ssmRoot: "/beep-fleet/prod",
      runnerType: "Org",
      repositoryAllowList: ["beep-effect/beep-effect"],
      subnetIds: ["subnet-a"],
      app: { id: Redacted.make("1"), keyBase64: Redacted.make("a2V5"), webhookSecret: Redacted.make("s") },
      pools,
      launchTemplate: { imageId: "ami-0123456789abcdef0" },
      ...(namePrefix === undefined ? {} : { namePrefix }),
    })
  );

const namedEntries = (recorder: Recorder) => A.filter(recorder.reconciled, (entry) => R.has(namePropOf, entry.type));

const deploy = (stack: ScratchStack, namePrefix: string | undefined) => {
  const run: (definition: ReturnType<typeof fleet>) => Effect.Effect<unknown, { readonly _tag: string }> = stack.deploy;
  return run(fleet(namePrefix));
};

describe("RunnerFleetNames", () => {
  it.effect("keeps the longest names inside every AWS limit for a 28-character prefix", () =>
    Effect.sync(() => {
      const prefix = Str.repeat(28)("a");
      assertTrue(isPrefix(prefix));
      assertFalse(isPrefix(`${prefix}b`));
      assertFalse(isPrefix("Beep-fleet"));
      for (const reserved of ["xn--fleet", "sthree-fleet", "amzn-s3-demo-fleet", "sthree", "xn-", "amzn-s3-demo"]) {
        assertFalse(
          isPrefix(reserved),
          "the check reads the derived <prefix>-binaries bucket name, so boundaries refuse too"
        );
      }
      const isPool = S.is(RunnerPool.fields.name);
      assertTrue(isPool("heavy"));
      assertFalse(isPool("heavy-two"), "dash-free pool names keep <prefix>-<pool> unique per (prefix, pool)");
      for (const allowed of ["sthre", "xn", "amzn-s3-dem", "s3alias", "beep-fleet-prod"]) {
        assertTrue(isPrefix(allowed));
      }
      const pool = poolResourceNames(prefix, Str.repeat(24)("p"));
      const fleetNames = fleetResourceNames(prefix);
      expect(
        A.every([pool.scaleUp, pool.jobRetry, pool.scaleDown, fleetNames.terminationWatcher], (n) => n.length <= 64)
      ).toBe(true);
      expect(A.every([pool.scaleDownRule, fleetNames.instanceStateChangeRule], (n) => n.length <= 64)).toBe(true);
      expect(pool.runnerRole.length).toBeLessThanOrEqual(64);
      expect(A.every([pool.buildDlq, pool.jobRetryDlq, fleetNames.deregisterDlq], (n) => n.length <= 80)).toBe(true);
      expect(`${fleetNames.binariesBucketPrefix}-123456789012`.length).toBeLessThanOrEqual(63);
    })
  );

  const pinned = harness("prod");
  pinned.test.provider("pins every name the composite chooses when namePrefix is set", (stack) =>
    Effect.gen(function* () {
      yield* deploy(stack, "beep-fleet-prod");
      const names = A.map(namedEntries(pinned.recorder), (entry) => [entry.fqn, nameOf(entry)] as const);
      expect(A.filter(names, ([, name]) => !P.isString(name))).toEqual([]);
      expect(A.filter(names, ([, name]) => !Str.startsWith("beep-fleet-prod-")(String(name)))).toEqual([]);
      const byFqn = R.fromEntries(names);
      expect(byFqn["Runners/Poolheavy/ScaleUp"]).toBe("beep-fleet-prod-heavy-scale-up");
      expect(byFqn["Runners/Pooloverflow/RunnerRole"]).toBe("beep-fleet-prod-overflow-runner");
      expect(byFqn["Runners/Pooloverflow/LaunchTemplate"]).toBe("beep-fleet-prod-overflow");
      expect(byFqn["Runners/Poolheavy/BuildQueueDlq"]).toBe("beep-fleet-prod-heavy-build-dlq");
      expect(byFqn["Runners/RunnerBinaries"]).toBe("beep-fleet-prod-binaries-123456789012");
      expect(byFqn["Runners/InstanceStateChangeRule"]).toBe("beep-fleet-prod-instance-state-change");
      expect(byFqn["Runners/Webhook"]).toBe("beep-fleet-prod-webhook");
      expect(byFqn["Runners/Poolheavy/JobRetry"]).toBe("beep-fleet-prod-heavy-job-retry");
      expect(byFqn["Runners/Poolheavy/JobRetryQueueDlq"]).toBe("beep-fleet-prod-heavy-job-retry-dlq");
    })
  );

  const generated = harness("dev-test");
  generated.test.provider("leaves every name to Alchemy without a prefix", (stack) =>
    Effect.gen(function* () {
      yield* deploy(stack, undefined);
      const pinnedNames = A.filter(namedEntries(generated.recorder), (entry) => P.isString(nameOf(entry)));
      expect(A.map(pinnedNames, (entry) => entry.fqn)).toEqual([]);
    })
  );
});
