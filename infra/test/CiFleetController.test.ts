import { CiFleetControllerPulumiConfigValues, makeCiFleetControllerConfig } from "@beep/infra";
import { Result } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

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
      expect(makeCiFleetControllerConfig(withoutLabel.success).runnerLabel).toBe("beep-ec2-heavy-shadow");
      expect(makeCiFleetControllerConfig(withLabel.success).runnerLabel).toBe("beep-custom-shadow");
    }
  });
});
