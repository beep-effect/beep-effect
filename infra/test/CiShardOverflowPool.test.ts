import {
  CiFleetController,
  CiFleetControllerPulumiConfigValues,
  CiShardOverflowPoolConfig,
  CiShardOverflowPoolConfigError,
  ciHeavyRunnerBurstCap,
  ciHeavyRunnerPool,
  ciRunnerInstanceVcpus,
  ciRunnerPoolWorstCaseVcpu,
  ciShardOverflowRunnerLabel,
  ciShardOverflowRunnerPool,
  ciShardOverflowWebhook,
  ciSpotVcpuBudget,
  ciSpotVcpuQuota,
  declareCiShardOverflowController,
  loadCiShardOverflowPoolConfig,
  makeCiFleetControllerConfig,
  makeCiShardOverflowControllerConfig,
} from "@beep/infra";
import { it } from "@beep/test-runner";
import { O, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as pulumi from "@pulumi/pulumi";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

class CiShardOverflowPoolTestOperationError extends S.TaggedError<
  CiShardOverflowPoolTestOperationError,
  { readonly brand: unique symbol }
>()(
  "CiShardOverflowPoolTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in CiShardOverflowPool.test.ts." }
) {}

const overflowSecretArn = "arn:aws:ssm:us-east-1:123456789012:parameter/github-action-runners/shard-overflow/secret";
const heavy = makeCiFleetControllerConfig(
  CiFleetControllerPulumiConfigValues.make({
    amiId: "ami-07a5b367e8dc8bd92",
    githubAppIdSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/id",
    githubAppKeyBase64SsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/key",
    githubAppKmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
    githubAppWebhookSecretSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/webhook-secret",
    runnerBinariesSyncerLambdaZip: "/artifacts/runner-binaries-syncer.zip",
    runnerRolePermissionsBoundaryArn: "arn:aws:iam::123456789012:policy/beep-ci-fleet-boundary",
    runnersLambdaZip: "/artifacts/runners.zip",
    terminationWatcherLambdaZip: "/artifacts/termination-watcher.zip",
    webhookLambdaZip: "/artifacts/webhook.zip",
  })
);
const enabled = CiShardOverflowPoolConfig.make({
  enabled: true,
  githubAppWebhookSecretSsmParameterArn: O.some(overflowSecretArn),
});
const isString = S.is(S.String);

// The roles the hand-maintained `beep-ci-fleet-boundary` (v5) lets a pool's scale-up Lambda pass to EC2.
const passOwnRoles = ["role/beep-ci/beep-ci-", "role/beep-ovf/beep-ovf-"];
// github-aws-runners v7.10.1 creates the runner role at `role_path` (default `/<prefix>/`), named
// `<prefix>-runner-<md5 of it>`; the hash suffix does not change what the boundary admits.
const runnerRole = (module: Record<string, unknown>): string =>
  `role${isString(module.role_path) ? module.role_path : `/${String(module.prefix)}/`}${String(module.prefix)}-runner-0123abcd`;
const passableToEc2 = (role: string): boolean => A.some(passOwnRoles, (admitted) => Str.startsWith(admitted)(role));

describe("@beep/infra CiRunnerPool", () => {
  // The termination watcher matches `ghr:environment` (the prefix) by `startsWith`, so neither pool's prefix may
  // start with the other's, or one pool's handler deregisters the other's runners.
  it("keeps the two pools' prefixes apart", () => {
    expect(ciShardOverflowRunnerPool.prefix).toBe("beep-ovf");
    expect(Str.startsWith(ciHeavyRunnerPool.prefix)(ciShardOverflowRunnerPool.prefix)).toBe(false);
    expect(Str.startsWith(ciShardOverflowRunnerPool.prefix)(ciHeavyRunnerPool.prefix)).toBe(false);
  });

  it("keeps the heavy pool's former controller values", () => {
    expect(ciHeavyRunnerPool.prefix).toBe("beep-ci");
    expect(ciHeavyRunnerPool.runnerGroupName).toBe("beep-ec2-heavy");
    expect(ciHeavyRunnerPool.runnerNamePrefix).toBe("beep-ci-");
    expect(ciHeavyRunnerPool.maximumCount).toBe(2);
    expect(ciHeavyRunnerPool.webhookSecretSsmParameterName).toBe(
      "/github-action-runners/app/github_app_webhook_secret"
    );
    expect(A.length(ciHeavyRunnerPool.instanceTypes)).toBe(7);
  });

  it("limits the overflow pool to 48 eight-vCPU .2xlarge VMs in its own group", () => {
    expect(ciShardOverflowRunnerPool.instanceTypes).toStrictEqual(["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"]);
    expect(A.every(ciShardOverflowRunnerPool.instanceTypes, (type) => ciRunnerInstanceVcpus[type] === 8)).toBe(true);
    expect(ciShardOverflowRunnerPool.maximumCount).toBe(48);
    expect(ciShardOverflowRunnerPool.runnerGroupName).toBe(ciShardOverflowRunnerLabel);
    expect(ciShardOverflowRunnerPool.prefix).not.toBe(ciHeavyRunnerPool.prefix);
    expect(ciRunnerPoolWorstCaseVcpu(ciShardOverflowRunnerPool, 48)).toBe(384);
    expect(pipe(ciHeavyRunnerPool, ciRunnerPoolWorstCaseVcpu(8))).toBe(128);
  });

  it("fits overflow plus the heavy pool at its burst cap inside the Spot quota, and no more", () => {
    expect(ciSpotVcpuBudget({ heavyBurstCap: ciHeavyRunnerBurstCap, overflowCap: 48 })).toStrictEqual({
      heavyVcpu: 128,
      overflowVcpu: 384,
      totalVcpu: 512,
      quotaVcpu: ciSpotVcpuQuota,
      fits: true,
    });
    expect(ciSpotVcpuBudget({ heavyBurstCap: 2, overflowCap: 48 }).totalVcpu).toBe(416);
    expect(ciSpotVcpuBudget({ heavyBurstCap: 9, overflowCap: 48 }).fits).toBe(false);
    expect(ciSpotVcpuBudget({ heavyBurstCap: 8, overflowCap: 49 }).fits).toBe(false);
  });
});

describe("@beep/infra makeCiShardOverflowControllerConfig", () => {
  it("derives the overflow controller from the heavy one with its own label and webhook secret", () => {
    const overflow = Result.getOrThrow(makeCiShardOverflowControllerConfig(heavy, enabled));
    expect(overflow.runnerLabel).toBe(ciShardOverflowRunnerLabel);
    expect(overflow.githubAppWebhookSecretSsmParameterArn).toBe(overflowSecretArn);
    expect(overflow.githubAppIdSsmParameterArn).toBe(heavy.githubAppIdSsmParameterArn);
    expect(overflow.githubAppKeyBase64SsmParameterArn).toBe(heavy.githubAppKeyBase64SsmParameterArn);
    expect(overflow.runnerRolePermissionsBoundaryArn).toBe(heavy.runnerRolePermissionsBoundaryArn);
    assertSome(overflow.amiId, "ami-07a5b367e8dc8bd92");
    pipe(heavy, makeCiShardOverflowControllerConfig(enabled), Result.isSuccess, assertTrue);
  });

  it("refuses a missing webhook secret and a budget over the Spot quota", () => {
    const missing = pipe(
      makeCiShardOverflowControllerConfig(
        heavy,
        CiShardOverflowPoolConfig.make({ enabled: true, githubAppWebhookSecretSsmParameterArn: O.none() })
      ),
      Result.getFailure,
      O.getOrThrow
    );
    assertInstanceOf(missing, CiShardOverflowPoolConfigError);
    expect(missing.message).toContain("githubAppWebhookSecretSsmParameterArn is required");
    const over = pipe(
      makeCiShardOverflowControllerConfig(heavy, CiShardOverflowPoolConfig.make({ ...enabled, heavyBurstCap: 9 })),
      Result.getFailure,
      O.getOrThrow
    );
    expect(over.message).toBe(
      "ciShardOverflow: 384 overflow vCPU plus 144 heavy vCPU at a burst cap of 9 is 528, over the 512-vCPU Spot quota"
    );
  });
});

describe("@beep/infra loadCiShardOverflowPoolConfig", { concurrent: false }, () => {
  it.effect("is disabled unless the stack enables it", () =>
    Effect.acquireUseRelease(
      Effect.sync(pulumi.runtime.allConfig),
      () =>
        Effect.sync(() => {
          pulumi.runtime.setAllConfig({});
          const absent = loadCiShardOverflowPoolConfig();
          expect(absent.enabled).toBe(false);
          assertNone(absent.githubAppWebhookSecretSsmParameterArn);
          expect(absent.heavyBurstCap).toBe(ciHeavyRunnerBurstCap);
          pulumi.runtime.setAllConfig({
            "ciShardOverflow:enabled": "true",
            "ciShardOverflow:githubAppWebhookSecretSsmParameterArn": overflowSecretArn,
            "ciShardOverflow:heavyBurstCap": "4",
          });
          const set = loadCiShardOverflowPoolConfig();
          expect(set.enabled).toBe(true);
          assertSome(set.githubAppWebhookSecretSsmParameterArn, overflowSecretArn);
          expect(set.heavyBurstCap).toBe(4);
        }),
      (config) => Effect.sync(() => pulumi.runtime.setAllConfig(config))
    )
  );
});

describe("@beep/infra CiFleetController with the overflow pool", () => {
  it.effect(
    "declares a second controller with the heavy pool's rails and the overflow pool's limits",
    Effect.fnUntraced(function* () {
      const modules = MutableHashMap.empty<string, Record<string, unknown>>();
      const resources = MutableHashMap.empty<string, Record<string, unknown>>();
      const lambdaNames: Array<string> = [];
      yield* Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () =>
            pulumi.runtime.setMocks(
              {
                call: (args) => {
                  if (args.token === "aws:lambda/getFunction:getFunction" && isString(args.inputs.functionName)) {
                    lambdaNames.push(args.inputs.functionName);
                    return { role: `arn:aws:iam::123456789012:role/${args.inputs.functionName}-role` };
                  }
                  if (args.token === "aws:iam/getRole:getRole" && isString(args.inputs.name)) {
                    return { uniqueId: `immutable-id-${args.inputs.name}` };
                  }
                  return { accountId: "123456789012", partition: "aws" };
                },
                newResource: (args) => {
                  if (args.type === "ghaRunners:index:Module") MutableHashMap.set(modules, args.name, args.inputs);
                  MutableHashMap.set(resources, args.name, args.inputs);
                  return {
                    id: `${args.name}-id`,
                    state: { ...args.inputs, arn: `arn:aws:iam::123456789012:policy/${args.name}` },
                  };
                },
              },
              "beep-effect",
              "test"
            ),
          catch: (cause) => CiShardOverflowPoolTestOperationError.make({ cause }),
        }),
        () =>
          Effect.sync(() => {
            const network = {
              region: pulumi.output("us-east-1"),
              subnetIds: ["subnet-a", "subnet-b"],
              vpcId: "vpc-123",
              workerSecurityGroupId: "sg-456",
            };
            new CiFleetController("heavy", { config: heavy, ...network });
            // A disabled pool declares nothing and exports no webhook; an enabled one declares the controller.
            const disabled = declareCiShardOverflowController({
              heavy,
              overflow: CiShardOverflowPoolConfig.make({ ...enabled, enabled: false }),
              network,
            });
            assertNone(disabled);
            expect(ciShardOverflowWebhook(disabled)).toBeUndefined();
            const declared = declareCiShardOverflowController({ heavy, overflow: enabled, network });
            assertTrue(O.isSome(declared));
            expect(ciShardOverflowWebhook(declared)).toBeDefined();
          }),
        () =>
          Effect.tryPromise({
            try: () => pulumi.runtime.disconnect(),
            catch: (cause) => CiShardOverflowPoolTestOperationError.make({ cause }),
          })
      );

      const heavyModule = MutableHashMap.get(modules, "heavy");
      const overflowModule = MutableHashMap.get(modules, "ci-shard-overflow-controller");
      assertTrue(O.isSome(heavyModule) && O.isSome(overflowModule));
      const h = heavyModule.value;
      const o = overflowModule.value;
      // What differs: the pool's identity and limits.
      expect(o.prefix).toBe("beep-ovf");
      expect(o.runner_group_name).toBe("beep-shard-overflow");
      expect(o.runner_name_prefix).toBe("beep-ovf-");
      expect(o.runner_extra_labels).toStrictEqual(["beep-shard-overflow"]);
      expect(o.instance_types).toStrictEqual(["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge"]);
      expect(o.runners_maximum_count).toBe(48);
      expect(o.github_app).toStrictEqual({
        id_ssm: { arn: heavy.githubAppIdSsmParameterArn, name: "/github-action-runners/app/github_app_id" },
        key_base64_ssm: {
          arn: heavy.githubAppKeyBase64SsmParameterArn,
          name: "/github-action-runners/app/github_app_key_base64",
        },
        webhook_secret_ssm: {
          arn: overflowSecretArn,
          name: "/github-action-runners/shard-overflow/github_app_webhook_secret",
        },
      });
      // Neither controller sets a role path, so each runner role lands under its own prefix, inside the
      // boundary's PassOwnRoles; anything else would make every scale-up fail on iam:PassRole.
      expect(o.role_path).toBeUndefined();
      expect(h.role_path).toBeUndefined();
      expect(runnerRole(o)).toBe("role/beep-ovf/beep-ovf-runner-0123abcd");
      expect(passableToEc2(runnerRole(o))).toBe(true);
      expect(passableToEc2(runnerRole(h))).toBe(true);
      expect(passableToEc2(runnerRole({ prefix: "beep-ci-ovf" }))).toBe(false);
      // The heavy pool keeps its literals.
      expect(h.prefix).toBe("beep-ci");
      expect(h.runner_group_name).toBe("beep-ec2-heavy");
      expect(h.runners_maximum_count).toBe(2);
      // What must not differ: every rail.
      for (const rail of [
        "enable_ephemeral_runners",
        "enable_jit_config",
        "enable_job_queued_check",
        "enable_organization_runners",
        "enable_runner_bidirectional_label_match",
        "enable_runner_on_demand_failover_for_errors",
        "enable_ssm_on_runners",
        "enable_managed_runner_security_group",
        "instance_allocation_strategy",
        "instance_target_capacity_type",
        "instance_termination_watcher",
        "job_retry",
        "repository_white_list",
        "role_permissions_boundary",
        "runner_additional_security_group_ids",
        "runner_disable_default_labels",
        "runner_ec2_tags",
        "runner_metadata_options",
        "runner_run_as",
        "userdata_post_install",
        "block_device_mappings",
        "minimum_running_time_in_minutes",
        "scale_up_reserved_concurrent_executions",
        "subnet_ids",
        "vpc_id",
      ]) {
        expect(o[rail], rail).toStrictEqual(h[rail]);
      }
      expect(o.instance_target_capacity_type).toBe("spot");
      expect(o.enable_runner_on_demand_failover_for_errors).toStrictEqual([]);
      // The controller's own resources and the termination-watcher grants are named by prefix.
      const amiParameter = MutableHashMap.get(resources, "ci-shard-overflow-controller-runner-ami");
      assertTrue(O.isSome(amiParameter));
      expect(amiParameter.value.name).toBe("/beep-ovf/controller/runner-ami-id");
      const imdsPolicy = MutableHashMap.get(resources, "ci-shard-overflow-controller-runner-imds-disable");
      assertTrue(O.isSome(imdsPolicy));
      expect(imdsPolicy.value.name).toBe("beep-ovf-runner-imds-disable");
      expect(imdsPolicy.value.path).toBe("/beep-ovf/");
      expect(imdsPolicy.value.policy).toBe(
        O.getOrUndefined(MutableHashMap.get(resources, "heavy-runner-imds-disable"))?.policy
      );
      expect(A.filter(lambdaNames, Str.startsWith("beep-ovf-"))).toStrictEqual([
        "beep-ovf-spot-termination-notification",
        "beep-ovf-spot-termination-handler",
        "beep-ovf-deregister-retry",
      ]);
    })
  );
});
