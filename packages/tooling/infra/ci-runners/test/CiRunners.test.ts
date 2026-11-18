import {
  PoolRuntimeConfig,
  runtimeConfigEnvName,
  WebhookRuntimeConfig,
} from "@beep/alchemy-github-runners/RunnerRuntime.models";
import { program } from "@beep/infra-ci-runners/CiRunners";
import { touchesLiveFleet } from "@beep/infra-ci-runners/Names";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeAppKeyBase64, fakeWebhookSecret } from "./support/Credentials.ts";
import * as Fakes from "./support/Fakes.ts";
import type { Recorder } from "./support/Fakes.ts";

const decodePool = S.decodeUnknownEffect(S.fromJsonString(PoolRuntimeConfig));
const decodeWebhook = S.decodeUnknownEffect(S.fromJsonString(WebhookRuntimeConfig));

const environmentOf = (values: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

const productionSecrets = {
  CI: "true",
  CI_RUNNERS_GITHUB_APP_ID: "12345",
  CI_RUNNERS_GITHUB_APP_KEY_BASE64: fakeAppKeyBase64,
  CI_RUNNERS_GITHUB_WEBHOOK_SECRET: fakeWebhookSecret,
};

const typeCounts = (recorder: Recorder) =>
  A.reduce(recorder.reconciled, R.empty<string, number>(), (counts, entry) =>
    R.set(counts, entry.type, (counts[entry.type] ?? 0) + 1)
  );

const runtimeConfigOf = (recorder: Recorder, fqn: string) =>
  pipe(
    recorder.at(fqn),
    O.flatMap((entry) =>
      O.fromNullishOr((entry.news.env as Record<string, unknown> | undefined)?.[runtimeConfigEnvName])
    )
  );

const poolConfig = (recorder: Recorder, pool: string) =>
  Effect.flatMap(Effect.fromOption(runtimeConfigOf(recorder, `Runners/Pool${pool}/ScaleUp`)), decodePool);

const declaredNames = (recorder: Recorder) =>
  A.flatMap(recorder.reconciled, (entry) =>
    A.flatMap(["name", "groupName", "logGroupName", "functionName", "aliasName", "policyName", "roleName"], (key) => {
      const value = entry.news[key];
      return P.isString(value) ? [value] : [];
    })
  );

// The prop each resource type pins its physical name with; types absent here get AWS-assigned ids.
const nameKey: Readonly<Record<string, string>> = {
  "Lambda.Function": "functionName",
  "SQS.Queue": "queueName",
  "IAM.Role": "roleName",
  "IAM.Policy": "policyName",
  "IAM.InstanceProfile": "instanceProfileName",
  RunnerLaunchTemplate: "launchTemplateName",
  "EventBridge.Rule": "name",
  "S3.Bucket": "bucketName",
  "Logs.LogGroup": "logGroupName",
  "EC2.SecurityGroup": "groupName",
};

const physicalNamesOf = (recorder: Recorder) =>
  A.map(
    A.filter(recorder.reconciled, (entry) => R.has(nameKey, entry.type)),
    (entry) => [entry.fqn, entry.news[nameKey[entry.type] ?? ""]] as const
  );

// Every physical name the prod stage chooses; the remaining resources take AWS-assigned ids.
const productionPhysicalNames: Readonly<Record<string, string>> = {
  FlowLogGroup: "/beep-fleet/prod/vpc-flow-logs",
  FlowLogsRole: "beep-fleet-prod-flow-logs",
  ImdsDisablePolicy: "beep-fleet-prod-runner-imds-disable",
  Reaper: "beep-fleet-prod-reaper",
  ReaperSchedule: "beep-fleet-prod-reaper",
  RunnerSecurityGroup: "beep-fleet-prod-runner",
  "Runners/DeregisterRetryQueue": "beep-fleet-prod-deregister-retry",
  "Runners/DeregisterRetryQueueDlq": "beep-fleet-prod-deregister-retry-dlq",
  "Runners/InstanceStateChangeRule": "beep-fleet-prod-instance-state-change",
  "Runners/Poolheavy/BuildQueue": "beep-fleet-prod-heavy-build",
  "Runners/Poolheavy/BuildQueueDlq": "beep-fleet-prod-heavy-build-dlq",
  "Runners/Poolheavy/JobRetry": "beep-fleet-prod-heavy-job-retry",
  "Runners/Poolheavy/JobRetryQueue": "beep-fleet-prod-heavy-job-retry",
  "Runners/Poolheavy/JobRetryQueueDlq": "beep-fleet-prod-heavy-job-retry-dlq",
  "Runners/Poolheavy/LaunchTemplate": "beep-fleet-prod-heavy",
  "Runners/Poolheavy/RunnerInstanceProfile": "beep-fleet-prod-heavy-runner",
  "Runners/Poolheavy/RunnerRole": "beep-fleet-prod-heavy-runner",
  "Runners/Poolheavy/ScaleDown": "beep-fleet-prod-heavy-scale-down",
  "Runners/Poolheavy/ScaleDownSchedule": "beep-fleet-prod-heavy-scale-down",
  "Runners/Poolheavy/ScaleUp": "beep-fleet-prod-heavy-scale-up",
  "Runners/Pooloverflow/BuildQueue": "beep-fleet-prod-overflow-build",
  "Runners/Pooloverflow/BuildQueueDlq": "beep-fleet-prod-overflow-build-dlq",
  "Runners/Pooloverflow/JobRetry": "beep-fleet-prod-overflow-job-retry",
  "Runners/Pooloverflow/JobRetryQueue": "beep-fleet-prod-overflow-job-retry",
  "Runners/Pooloverflow/JobRetryQueueDlq": "beep-fleet-prod-overflow-job-retry-dlq",
  "Runners/Pooloverflow/LaunchTemplate": "beep-fleet-prod-overflow",
  "Runners/Pooloverflow/RunnerInstanceProfile": "beep-fleet-prod-overflow-runner",
  "Runners/Pooloverflow/RunnerRole": "beep-fleet-prod-overflow-runner",
  "Runners/Pooloverflow/ScaleDown": "beep-fleet-prod-overflow-scale-down",
  "Runners/Pooloverflow/ScaleDownSchedule": "beep-fleet-prod-overflow-scale-down",
  "Runners/Pooloverflow/ScaleUp": "beep-fleet-prod-overflow-scale-up",
  "Runners/RunnerBinaries": "beep-fleet-prod-binaries-832907639880",
  "Runners/RunnerBinariesSyncer": "beep-fleet-prod-binaries-syncer",
  "Runners/RunnerBinariesSyncerSchedule": "beep-fleet-prod-binaries-syncer",
  "Runners/SpotInterruptionRule": "beep-fleet-prod-spot-interruption",
  "Runners/SsmHousekeeper": "beep-fleet-prod-ssm-housekeeper",
  "Runners/SsmHousekeeperSchedule": "beep-fleet-prod-ssm-housekeeper",
  "Runners/TerminationWatcher": "beep-fleet-prod-termination-watcher",
  "Runners/Webhook": "beep-fleet-prod-webhook",
};

describe("CiRunners personal stage", () => {
  const personal = Fakes.harness({ stage: "dev-test" });
  personal.provider("creates the whole graph under fenced names with no way to register a runner", (stack) =>
    Effect.gen(function* () {
      const { recorder } = personal;
      const output = yield* stack.deploy(program.pipe(environmentOf({})));

      expect(typeCounts(recorder)).toStrictEqual({
        "EC2.Vpc": 1,
        "EC2.DefaultSecurityGroup": 1,
        "EC2.InternetGateway": 1,
        "EC2.RouteTable": 1,
        "EC2.Route": 1,
        "EC2.Subnet": 5,
        "EC2.RouteTableAssociation": 5,
        "EC2.SecurityGroup": 1,
        "EC2.FlowLog": 1,
        "Logs.LogGroup": 1,
        "IAM.Role": 3,
        "IAM.Policy": 1,
        "IAM.InstanceProfile": 2,
        "KMS.Key": 1,
        "KMS.Alias": 1,
        "SSM.Parameter": 3,
        "S3.Bucket": 1,
        "SQS.Queue": 6,
        RunnerLaunchTemplate: 2,
        "Lambda.Function": 9,
        "Lambda.EventSourceMapping": 3,
        "EventBridge.Rule": 7,
        "Lambda.Permission": 7,
      });
      expect(output.fleet).toBe("beep-fleet-dev-test");

      const names = declaredNames(recorder);
      expect(A.filter(names, touchesLiveFleet)).toEqual([]);
      expect(names).toContain("beep-fleet-dev-test-runner");
      expect(names).toContain("/beep-fleet/dev-test/vpc-flow-logs");
      expect(names).toContain("beep-fleet-dev-test-reaper");
      expect(names).toContain("alias/beep-fleet-dev-test-github-app");
      expect(A.filter(names, Str.startsWith("/beep-fleet/dev-test/"))).toHaveLength(4);

      const heavy = yield* poolConfig(recorder, "heavy");
      expect(heavy.pool.maximumCount).toBe(0);
      expect(heavy.runnerType).toBe("Repo");
      expect(heavy.environment).toBe("beep-fleet-dev-test-heavy");
      const webhook = yield* Effect.flatMap(
        Effect.fromOption(runtimeConfigOf(recorder, "Runners/Webhook")),
        decodeWebhook
      );
      expect(webhook.repositoryAllowList).toEqual([]);
      expect(A.map(webhook.pools, (pool) => pool.labels)).toEqual([["beep-fleet-heavy"], ["beep-fleet-overflow"]]);
    })
  );
});

describe("CiRunners update and destroy", () => {
  const lifecycle = Fakes.harness({ stage: "dev-test" });
  lifecycle.provider("a rehearsal is refused inside the overlap budget, and destroy sweeps before teardown", (stack) =>
    Effect.gen(function* () {
      const { recorder } = lifecycle;
      yield* stack.deploy(program.pipe(environmentOf({})));
      recorder.events = [];
      const refused = yield* Fakes.refusal(stack)(
        program.pipe(
          environmentOf({
            CI_RUNNERS_REHEARSAL_REPOSITORY: "alice/sandbox",
            CI_RUNNERS_GITHUB_APP_ID: "1",
            CI_RUNNERS_GITHUB_APP_KEY_BASE64: fakeAppKeyBase64,
            CI_RUNNERS_GITHUB_WEBHOOK_SECRET: fakeWebhookSecret,
          })
        )
      );
      expect(Fakes.tagChain(refused)).toContain("ConfigError");
      expect(A.filter(recorder.events, Str.startsWith("reconcile:"))).toEqual([]);
      const overflow = yield* poolConfig(recorder, "overflow");
      expect(overflow.pool.maximumCount).toBe(0);

      recorder.events = [];
      yield* stack.destroy();
      const sweep = Fakes.eventIndex(recorder)("sweep:listRunners");
      expect(sweep).toBeGreaterThanOrEqual(0);
      for (const prefix of [
        "delete:EC2.Vpc:",
        "delete:EC2.Subnet:",
        "delete:EC2.SecurityGroup:",
        "delete:RunnerLaunchTemplate:",
        "delete:Lambda.Function:Runners/Poolheavy/ScaleUp",
        "delete:Lambda.Function:Runners/Pooloverflow/ScaleUp",
        "delete:EC2.Route:",
        "delete:EC2.RouteTableAssociation:",
        "delete:EC2.InternetGateway:",
        "delete:EC2.RouteTable:",
        "delete:KMS.Key:",
      ]) {
        expect(Fakes.eventIndex(recorder)(prefix)).toBeGreaterThan(sweep);
      }
    })
  );
});

describe("CiRunners production stage", () => {
  const production = Fakes.harness({ stage: "prod" });
  production.provider("serves the production repository with org runners at the overlap caps", (stack) =>
    Effect.gen(function* () {
      const { recorder } = production;
      const output = yield* stack.deploy(program.pipe(environmentOf(productionSecrets)));
      expect(output.fleet).toBe("beep-fleet-prod");
      expect(output.phase).toBe("overlap");
      const heavy = yield* poolConfig(recorder, "heavy");
      expect(heavy.runnerType).toBe("Org");
      expect(heavy.pool.maximumCount).toBe(1);
      expect(heavy.pool.runnerGroup).toBe("beep-ec2-heavy");
      expect(heavy.pool.instanceTypes).toHaveLength(7);
      const overflow = yield* poolConfig(recorder, "overflow");
      expect(overflow.pool.maximumCount).toBe(2);
      expect(overflow.pool.runnerGroup).toBe("beep-shard-overflow");
      expect(A.filter(declaredNames(recorder), touchesLiveFleet)).toEqual([]);
    })
  );

  const pinnedNames = Fakes.harness({ stage: "prod" });
  pinnedNames.provider("pins every production physical name under beep-fleet-prod", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(program.pipe(environmentOf(productionSecrets)));
      expect(R.fromEntries(physicalNamesOf(pinnedNames.recorder))).toStrictEqual(productionPhysicalNames);
    })
  );

  const outsideCi = Fakes.harness({ stage: "prod" });
  outsideCi.provider("refuses prod outside CI before any resource", (stack) =>
    Effect.gen(function* () {
      const { CI: _ci, ...secrets } = productionSecrets;
      const error = yield* Fakes.refusal(stack)(program.pipe(environmentOf(secrets)));
      expect(Fakes.tagChain(error)).toContain("ConfigError");
      expect(outsideCi.recorder.reconciled).toEqual([]);
    })
  );

  const noCredentials = Fakes.harness({ stage: "prod" });
  noCredentials.provider("refuses prod without App credentials", (stack) =>
    Effect.gen(function* () {
      const error = yield* Fakes.refusal(stack)(program.pipe(environmentOf({ CI: "true" })));
      expect(Fakes.tagChain(error)).toContain("ConfigError");
      expect(noCredentials.recorder.reconciled).toEqual([]);
    })
  );

  const otherAccount = Fakes.harness({ stage: "dev-test", accountId: Fakes.accounts.other });
  otherAccount.provider("refuses another account", (stack) =>
    Effect.gen(function* () {
      const error = yield* Fakes.refusal(stack)(program.pipe(environmentOf({})));
      expect(Fakes.tagChain(error)).toContain("ConfigError");
      expect(String(error)).toContain("832907639880");
      expect(otherAccount.recorder.reconciled).toEqual([]);
    })
  );

  const otherRegion = Fakes.harness({ stage: "dev-test", region: "us-west-2" });
  otherRegion.provider("refuses another region", (stack) =>
    Effect.gen(function* () {
      const error = yield* Fakes.refusal(stack)(program.pipe(environmentOf({})));
      expect(Fakes.tagChain(error)).toContain("ConfigError");
      expect(otherRegion.recorder.reconciled).toEqual([]);
    })
  );
});
