import { CiTurboCachePulumiConfigValues } from "@beep/infra";
import { Result } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

const validConfigValues = {
  bucketName: "beep-turbo-cache-123456789012",
  lambdaZipPath: "/artifacts/turbo-cache.zip",
  readOnlyTokenSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/read-only-token",
  region: "us-east-1",
  trustedWriteTokenSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/trusted-write-token",
};

const decodeConfigValues = S.decodeUnknownResult(CiTurboCachePulumiConfigValues);

describe("@beep/infra CiTurboCache", () => {
  it("accepts a complete cache configuration", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
  });

  it("accepts DNS-compatible bucket names and rejects malformed names", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, bucketName: "Beep_Cache" }))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, bucketName: "192.168.0.1" }))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, bucketName: "ab" }))).toBe(true);
  });

  it("accepts SSM parameter ARNs and rejects other ARN kinds", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          readOnlyTokenSsmParameterArn: "arn:aws:iam::123456789012:role/not-an-ssm-parameter",
        })
      )
    ).toBe(true);
  });

  it("accepts AWS regions and rejects availability zones", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, region: "us-east-1a" }))).toBe(true);
  });

  it("accepts absolute ZIP paths and rejects relative or non-ZIP paths", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, lambdaZipPath: "cache.zip" }))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, lambdaZipPath: "/artifacts/cache" }))).toBe(
      true
    );
  });
});
