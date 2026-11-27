import {
  PoolRuntimeConfig,
  runtimeConfigEnvName,
  WebhookRuntimeConfig,
} from "@beep/alchemy-github-runners/RunnerRuntime.models";
import { program } from "@beep/infra-ci-runners/CiRunners";
import { deployRolePolicy, fleetBoundary, fleetBoundaryPolicyArn } from "@beep/infra-ci-runners/DeployRolePolicy";
import { touchesLiveFleet } from "@beep/infra-ci-runners/Names";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeAppKeyBase64, fakeWebhookSecret } from "./support/Credentials.ts";
import * as Fakes from "./support/Fakes.ts";
import type * as IAM from "@alchemy.run/aws/IAM";
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

const arnGlobMatches = (pattern: string, arn: string) =>
  /^[A-Za-z0-9:/*-]+$/u.test(pattern) && new RegExp(`^${Str.replaceAll("*", ".*")(pattern)}$`, "u").test(arn);

const resourceList = (value: string | ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
  P.isString(value) ? [value] : (value ?? []);

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

const physicalNamePropOfType: Readonly<Record<string, string>> = {
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
    A.filter(recorder.reconciled, (entry) => R.has(physicalNamePropOfType, entry.type)),
    (entry) => [entry.fqn, entry.news[physicalNamePropOfType[entry.type] ?? ""]] as const
  );

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
  production.provider("serves the production repository with org runners at the primary caps", (stack) =>
    Effect.gen(function* () {
      const { recorder } = production;
      const output = yield* stack.deploy(program.pipe(environmentOf(productionSecrets)));
      expect(output.fleet).toBe("beep-fleet-prod");
      expect(output.phase).toBe("primary");
      const heavy = yield* poolConfig(recorder, "heavy");
      expect(heavy.runnerType).toBe("Org");
      expect(heavy.pool.maximumCount).toBe(2);
      expect(heavy.pool.runnerGroup).toBe("beep-ec2-heavy");
      expect(heavy.pool.instanceTypes).toHaveLength(5);
      const overflow = yield* poolConfig(recorder, "overflow");
      expect(overflow.pool.maximumCount).toBe(48);
      expect(overflow.pool.runnerGroup).toBe("beep-shard-overflow");
      expect([
        heavy.pool.jobQueuedCheck,
        overflow.pool.jobQueuedCheck,
        O.isSome(heavy.buildDlqUrl),
        O.isSome(overflow.buildDlqUrl),
      ]).toStrictEqual([true, true, true, true]);
      expect(A.filter(declaredNames(recorder), touchesLiveFleet)).toEqual([]);
      const queues = A.filter(
        recorder.reconciled,
        (entry) =>
          entry.type === "SQS.Queue" &&
          (Str.endsWith("/BuildQueue")(entry.fqn) || Str.endsWith("/JobRetryQueue")(entry.fqn))
      );
      expect(
        A.map(
          A.sortWith(queues, ({ fqn }) => fqn, Order.String),
          ({ fqn, news }) => [
            fqn,
            news.visibilityTimeout,
            news.messageRetentionPeriod,
            P.isNotUndefined(news.redrivePolicy),
          ]
        ),
        "a job waiting for the cap stays on the build queue a day and never reaches a DLQ for waiting alone"
      ).toStrictEqual([
        ["Runners/Poolheavy/BuildQueue", "1 minute", "1 day", false],
        ["Runners/Poolheavy/JobRetryQueue", "2 minutes", undefined, true],
        ["Runners/Pooloverflow/BuildQueue", "1 minute", "1 day", false],
        ["Runners/Pooloverflow/JobRetryQueue", "2 minutes", undefined, true],
      ]);
      const mappings = A.filter(recorder.reconciled, (entry) => entry.type === "Lambda.EventSourceMapping");
      expect(
        A.sort(
          A.map(mappings, (entry) => entry.fqn),
          Order.String
        )
      ).toStrictEqual([
        "Runners/DeregisterRetrySource",
        "Runners/Poolheavy/JobRetrySource",
        "Runners/Poolheavy/ScaleUpSource",
        "Runners/Pooloverflow/JobRetrySource",
        "Runners/Pooloverflow/ScaleUpSource",
      ]);
      const notByArn = A.filter(
        mappings,
        (entry) =>
          !(P.isString(entry.news.functionName) && Str.startsWith("arn:aws:lambda:us-east-1:")(entry.news.functionName))
      );
      expect(
        A.map(notByArn, (entry) => entry.fqn),
        "the deploy role conditions every mapping call on lambda:FunctionArn, so each names its function by ARN"
      ).toStrictEqual([]);
    })
  );

  const pinnedNames = Fakes.harness({ stage: "prod" });
  pinnedNames.provider("pins every production physical name under beep-fleet-prod", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(program.pipe(environmentOf(productionSecrets)));
      expect(
        R.fromEntries(physicalNamesOf(pinnedNames.recorder)),
        "every physical name the prod stage chooses; the remaining resources take AWS-assigned ids"
      ).toStrictEqual(productionPhysicalNames);
    })
  );

  const roleArns = Fakes.harness({ stage: "prod" });
  roleArns.provider("plans every role at an ARN the deploy role's grants and the boundary both match", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(program.pipe(environmentOf(productionSecrets)));
      const { reconciled } = roleArns.recorder;
      const roles = A.filter(reconciled, (entry) => entry.type === "IAM.Role");
      const functions = A.filter(reconciled, (entry) => entry.type === "Lambda.Function");
      const plannedRoleArnsAtDefaultPath = [
        ...A.map(
          roles,
          (entry) => `arn:aws:iam::832907639880:role${String(entry.news.path ?? "/")}${String(entry.news.roleName)}`
        ),
        ...A.map(
          functions,
          (entry) =>
            `arn:aws:iam::832907639880:role/CiRunners-${Str.replaceAll("/", "-")(entry.fqn)}-prod-0123456789abcdef`
        ),
      ];
      expect(A.length(roles)).toBe(3);
      expect(A.length(functions)).toBe(11);
      const grantPatterns = A.flatMap(
        A.filter(deployRolePolicy(O.none()).Statement, (statement) => statement.Sid === "IamFleetRoleBounded"),
        (statement: IAM.PolicyStatement) => resourceList(statement.Resource)
      );
      const boundaryPatterns = A.flatMap(
        A.filter(fleetBoundary("prod").Statement, (statement) => statement.Sid === "DenyPassOutsideFleet"),
        (statement: IAM.PolicyStatement) => resourceList(statement.NotResource)
      );
      expect(A.length(grantPatterns)).toBe(2);
      expect(A.length(boundaryPatterns)).toBe(2);
      for (const arn of plannedRoleArnsAtDefaultPath) {
        expect([arn, A.some(grantPatterns, (pattern) => arnGlobMatches(pattern, arn))]).toStrictEqual([arn, true]);
        expect([arn, A.some(boundaryPatterns, (pattern) => arnGlobMatches(pattern, arn))]).toStrictEqual([arn, true]);
      }
      for (const entry of [...roles, ...functions]) {
        expect([entry.fqn, entry.news.permissionsBoundary]).toStrictEqual([entry.fqn, fleetBoundaryPolicyArn]);
      }
    })
  );

  const boundedGrants = Fakes.harness({ stage: "prod" });
  boundedGrants.provider("allows every action a function role grants under the fleet boundary", (stack) =>
    Effect.gen(function* () {
      yield* stack.deploy(program.pipe(environmentOf(productionSecrets)));
      const functions = A.filter(boundedGrants.recorder.reconciled, (entry) => entry.type === "Lambda.Function");
      const allows = A.filter(fleetBoundary("prod").Statement, (statement) => statement.Effect === "Allow");
      const statementsOfBinding = (data: Readonly<Record<string, unknown>>): ReadonlyArray<IAM.PolicyStatement> =>
        A.isArray(data.policyStatements) ? (data.policyStatements as ReadonlyArray<IAM.PolicyStatement>) : [];
      const granted = A.flatMap(functions, (entry) =>
        A.flatMap(entry.bindings, (binding) =>
          A.flatMap(
            A.filter(statementsOfBinding(binding.data), (statement) => statement.Effect === "Allow"),
            (statement: IAM.PolicyStatement) =>
              A.map(resourceList(statement.Action), (action) => `${entry.fqn} ${action}`)
          )
        )
      );
      const covered = (grant: string) =>
        A.some(allows, (allow) =>
          A.some(resourceList(allow.Action), (pattern) => arnGlobMatches(pattern, Str.split(" ")(grant)[1] ?? ""))
        );
      expect(A.length(granted)).toBeGreaterThan(0);
      expect(
        A.filter(granted, (grant) => !covered(grant)),
        "the boundary caps every function role: a granted action it does not allow is denied at run time"
      ).toStrictEqual([]);
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
