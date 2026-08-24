import { CiFleetController, CiFleetControllerPulumiConfigValues, makeCiFleetControllerConfig } from "@beep/infra";
import { O, Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import * as pulumi from "@pulumi/pulumi";
import { Effect, MutableHashMap, pipe, Result } from "effect";
import * as S from "effect/Schema";

const validConfigValues = {
  githubAppIdSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/id",
  githubAppKeyBase64SsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/key",
  githubAppKmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
  githubAppWebhookSecretSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/webhook-secret",
  runnerBinariesSyncerLambdaZip: "/artifacts/runner-binaries-syncer.zip",
  runnerRolePermissionsBoundaryArn: "arn:aws:iam::123456789012:policy/beep-ci-fleet-boundary",
  runnersLambdaZip: "/artifacts/runners.zip",
  terminationWatcherLambdaZip: "/artifacts/termination-watcher.zip",
  webhookLambdaZip: "/artifacts/webhook.zip",
};

const decodeConfigValues = S.decodeUnknownResult(CiFleetControllerPulumiConfigValues);
const isString = S.is(S.String);

const assertSubstringBefore = (text: string, before: string, after: string): void => {
  const beforeIndex = Str.indexOf(before)(text);
  const afterIndex = Str.indexOf(after)(text);
  assert.isTrue(O.isSome(beforeIndex));
  assert.isTrue(O.isSome(afterIndex));
  if (O.isSome(beforeIndex) && O.isSome(afterIndex)) {
    assert.isTrue(beforeIndex.value < afterIndex.value);
  }
};

describe("@beep/infra CiFleetController", () => {
  it("accepts AWS ARNs and rejects malformed values", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, githubAppKmsKeyArn: "not-an-arn" }))).toBe(true);
  });

  it("accepts SSM parameter ARNs and rejects other ARN kinds", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          githubAppIdSsmParameterArn: "arn:aws:iam::123456789012:role/not-an-ssm-parameter",
        })
      )
    ).toBe(true);
  });

  it("accepts absolute ZIP paths and rejects relative or non-ZIP paths", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({ ...validConfigValues, runnerBinariesSyncerLambdaZip: "artifacts/syncer.zip" })
      )
    ).toBe(true);
    expect(
      Result.isFailure(decodeConfigValues({ ...validConfigValues, runnerBinariesSyncerLambdaZip: "/artifacts/syncer" }))
    ).toBe(true);
  });

  it("accepts runner labels and rejects empty, spaced, or overlong labels", () => {
    expect(Result.isSuccess(decodeConfigValues({ ...validConfigValues, runnerLabel: "beep_runner-shadow" }))).toBe(
      true
    );
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, runnerLabel: "" }))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, runnerLabel: "beep runner" }))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          runnerLabel: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        })
      )
    ).toBe(true);
  });

  it("accepts absolute AMI SSM parameter paths and rejects relative paths", () => {
    expect(
      Result.isSuccess(
        decodeConfigValues({
          ...validConfigValues,
          amiSsmParameterName: "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          amiSsmParameterName: "aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
        })
      )
    ).toBe(true);
  });

  it("decodes complete Pulumi config values", () => {
    const result = decodeConfigValues({ ...validConfigValues, runnerLabel: "beep-custom-shadow" });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.githubAppKmsKeyArn).toBe(validConfigValues.githubAppKmsKeyArn);
      expect(result.success.runnerLabel).toBe("beep-custom-shadow");
      expect(result.success.webhookLambdaZip).toBe(validConfigValues.webhookLambdaZip);
    }
  });

  it("defaults the runner label when absent and honors an explicit label", () => {
    const withoutLabel = decodeConfigValues(validConfigValues);
    const withLabel = decodeConfigValues({ ...validConfigValues, runnerLabel: "beep-custom-shadow" });

    expect(Result.isSuccess(withoutLabel)).toBe(true);
    expect(Result.isSuccess(withLabel)).toBe(true);
    if (Result.isSuccess(withoutLabel) && Result.isSuccess(withLabel)) {
      expect(makeCiFleetControllerConfig(withoutLabel.success).runnerLabel).toBe("beep-ec2-heavy");
      expect(makeCiFleetControllerConfig(withLabel.success).runnerLabel).toBe("beep-custom-shadow");
    }
  });

  it("defaults the controller AMI SSM parameter when absent", () => {
    const result = decodeConfigValues(validConfigValues);

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const config = makeCiFleetControllerConfig(result.success);
      expect(O.isNone(config.amiId)).toBe(true);
      expect(config.amiSsmParameterName).toBe("/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64");
    }
  });

  it("honors an explicit controller AMI id instead of the SSM default", () => {
    const result = decodeConfigValues({ ...validConfigValues, amiId: "ami-07a5b367e8dc8bd92" });

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(O.getOrUndefined(makeCiFleetControllerConfig(result.success).amiId)).toBe("ami-07a5b367e8dc8bd92");
    }
  });

  it("rejects malformed controller AMI ids", () => {
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, amiId: "latest" }))).toBe(true);
  });

  it.effect(
    "provisions and verifies iptables-nft before wiring the fail-closed per-job hook",
    Effect.fnUntraced(function* () {
      const modulePostInstall = MutableHashMap.empty<string, string>();

      yield* Effect.acquireUseRelease(
        Effect.tryPromise(() =>
          pulumi.runtime.setMocks(
            {
              call: () => ({ accountId: "123456789012", partition: "aws" }),
              newResource: (args) => {
                const postInstall = args.inputs.userdata_post_install;
                if (args.type === "ghaRunners:index:Module" && isString(postInstall)) {
                  MutableHashMap.set(modulePostInstall, args.name, postInstall);
                }
                return { id: `${args.name}-id`, state: args.inputs };
              },
            },
            "beep-effect",
            "test"
          )
        ),
        () =>
          Effect.sync(() => {
            new CiFleetController("ci-fleet-controller-test", {
              config: makeCiFleetControllerConfig(
                CiFleetControllerPulumiConfigValues.make({
                  ...validConfigValues,
                  amiId: "ami-07a5b367e8dc8bd92",
                })
              ),
              region: "us-east-1",
              subnetIds: ["subnet-abc"],
              vpcId: "vpc-123",
              workerSecurityGroupId: "sg-456",
            });
          }),
        () => Effect.tryPromise(() => pulumi.runtime.disconnect())
      );

      const captured = MutableHashMap.get(modulePostInstall, "ci-fleet-controller-test");
      assert.isTrue(O.isSome(captured));
      if (O.isNone(captured)) {
        return;
      }

      const postInstall = captured.value;
      // The toolbelt install must stay marker-gated and fail open: the baked
      // image stamps /etc/beep-ci/baked-runner, an unbaked boot installs.
      assert.isTrue(Str.includes("if [ -f /etc/beep-ci/baked-runner ]; then")(postInstall));
      assertSubstringBefore(
        postInstall,
        "if [ -f /etc/beep-ci/baked-runner ]; then",
        "dnf install -y git unzip zip jq"
      );
      assertSubstringBefore(postInstall, "baked runner image; toolbelt already present", "else");
      assert.isTrue(Str.includes("(\n  set -eu\n  dnf install -y iptables-nft")(postInstall));
      assertSubstringBefore(postInstall, "dnf install -y iptables-nft", "command -v iptables");
      assertSubstringBefore(postInstall, "command -v iptables", "iptables --version | grep -Fq 'nf_tables'");
      assertSubstringBefore(postInstall, "iptables -m owner --help", "cat > /opt/beep/imds-job-started.sh");
      assertSubstringBefore(
        postInstall,
        "cat > /opt/beep/imds-job-started.sh",
        "ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/beep/imds-job-started-hook.sh"
      );
      assert.isTrue(Str.includes("#!/usr/bin/env bash\nset -eu\nrunner_uid=")(postInstall));
      assert.isTrue(Str.includes("exec sudo /opt/beep/imds-job-started.sh")(postInstall));
      assert.isTrue(Str.includes("ec2-user ALL=(root) NOPASSWD: /opt/beep/imds-job-started.sh")(postInstall));
      assert.isTrue(
        Str.includes('iptables -C OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "$${runner_uid}" -j DROP')(
          postInstall
        )
      );
      assert.isTrue(
        Str.includes('|| iptables -A OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "$${runner_uid}" -j DROP')(
          postInstall
        )
      );
      // Terraform parses `.tf.json` strings as HCL templates: the module-bound
      // value may carry no unescaped `${`/`%{`, and rendering `$${` back to
      // `${` must reproduce the original bash byte-identically.
      expect(postInstall).not.toMatch(/(?<!\$)\$\{/u);
      expect(postInstall).not.toMatch(/(?<!%)%\{/u);
      const rendered = pipe(postInstall, Str.replaceAll("$${", "${"), Str.replaceAll("%%{", "%{"));
      assert.isTrue(
        Str.includes('iptables -C OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "${runner_uid}" -j DROP')(rendered)
      );
      assert.isTrue(Str.includes('if [ -d "${runner_dir}" ]; then')(rendered));
      assert.isTrue(Str.includes('if [ "${hook_armed}" = false ]; then')(rendered));
      assert.isTrue(
        Str.includes('logger -t beep-imds-hook "runner directory not found; per-job IMDS hook NOT armed"\n    exit 1')(
          rendered
        )
      );
    })
  );
});
