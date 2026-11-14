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
import * as Fakes from "./support/Fakes.ts";
import type { Recorder } from "./support/Fakes.ts";

const decodePool = S.decodeUnknownEffect(S.fromJsonString(PoolRuntimeConfig));
const decodeWebhook = S.decodeUnknownEffect(S.fromJsonString(WebhookRuntimeConfig));

const environmentOf = (values: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

const productionSecrets = {
  CI: "true",
  CI_RUNNERS_GITHUB_APP_ID: "12345",
  CI_RUNNERS_GITHUB_APP_KEY_BASE64: "a2V5",
  CI_RUNNERS_GITHUB_WEBHOOK_SECRET: "webhook-secret",
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

describe("CiRunners personal stage", () => {
  const personal = Fakes.harness({ stage: "dev_test" });
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
        "IAM.Policy": 2,
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
  const lifecycle = Fakes.harness({ stage: "dev_test" });
  lifecycle.provider("a rehearsal raises the caps in place, and destroy sweeps before teardown", (stack) =>
    Effect.gen(function* () {
      const { recorder } = lifecycle;
      yield* stack.deploy(program.pipe(environmentOf({})));
      yield* stack.deploy(
        program.pipe(
          environmentOf({
            CI_RUNNERS_REHEARSAL_REPOSITORY: "alice/sandbox",
            CI_RUNNERS_GITHUB_APP_ID: "1",
            CI_RUNNERS_GITHUB_APP_KEY_BASE64: "a2V5",
            CI_RUNNERS_GITHUB_WEBHOOK_SECRET: "s",
          })
        )
      );
      const overflow = yield* poolConfig(recorder, "overflow");
      expect(overflow.pool.maximumCount).toBe(1);
      expect(overflow.runnerType).toBe("Repo");

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

  const otherAccount = Fakes.harness({ stage: "dev_test", accountId: Fakes.accounts.other });
  otherAccount.provider("refuses another account", (stack) =>
    Effect.gen(function* () {
      const error = yield* Fakes.refusal(stack)(program.pipe(environmentOf({})));
      expect(Fakes.tagChain(error)).toContain("ConfigError");
      expect(String(error)).toContain("832907639880");
      expect(otherAccount.recorder.reconciled).toEqual([]);
    })
  );

  const otherRegion = Fakes.harness({ stage: "dev_test", region: "us-west-2" });
  otherRegion.provider("refuses another region", (stack) =>
    Effect.gen(function* () {
      const error = yield* Fakes.refusal(stack)(program.pipe(environmentOf({})));
      expect(Fakes.tagChain(error)).toContain("ConfigError");
      expect(otherRegion.recorder.reconciled).toEqual([]);
    })
  );
});
