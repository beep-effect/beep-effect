import { CiTurboCache, CiTurboCachePulumiConfigValues } from "@beep/infra";
import * as pulumi from "@pulumi/pulumi";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

const validConfigValues = {
  bucketName: "beep-turbo-cache-123456789012",
  lambdaZipPath: "/artifacts/turbo-cache.zip",
  readOnlyTokenSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/read-only-token",
  tokenKmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
  trustedWriteTokenSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/trusted-write-token",
  writerSharedSecretSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/writer-hmac-secret",
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

  it("rejects S3-reserved bucket name prefixes and suffixes", () => {
    const reserved = [
      "xn--beep-cache",
      "sthree-beep-cache",
      "amzn-s3-demo-beep-cache",
      "beep-cache-s3alias",
      "beep-cache--ol-s3",
      "beep-cache.mrap",
      "beep-cache--x-s3",
      "beep-cache--table-s3",
    ];
    for (const bucketName of reserved) {
      expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, bucketName }))).toBe(true);
    }
    expect(Result.isSuccess(decodeConfigValues({ ...validConfigValues, bucketName: "beep-cache-s3aliased" }))).toBe(
      true
    );
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
    expect(
      Result.isFailure(
        decodeConfigValues({
          ...validConfigValues,
          writerSharedSecretSsmParameterArn: "arn:aws:iam::123456789012:role/not-an-ssm-parameter",
        })
      )
    ).toBe(true);
    const { writerSharedSecretSsmParameterArn: _writerSharedSecretSsmParameterArn, ...missingWriterSharedSecret } =
      validConfigValues;
    expect(Result.isFailure(decodeConfigValues(missingWriterSharedSecret))).toBe(true);
  });

  it("accepts a KMS key ARN and rejects malformed or missing values", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, tokenKmsKeyArn: "not-an-arn" }))).toBe(true);
    const { tokenKmsKeyArn: _tokenKmsKeyArn, ...missingKmsKeyArn } = validConfigValues;
    expect(Result.isFailure(decodeConfigValues(missingKmsKeyArn))).toBe(true);
  });

  it("accepts absolute ZIP paths and rejects relative or non-ZIP paths", () => {
    expect(Result.isSuccess(decodeConfigValues(validConfigValues))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, lambdaZipPath: "cache.zip" }))).toBe(true);
    expect(Result.isFailure(decodeConfigValues({ ...validConfigValues, lambdaZipPath: "/artifacts/cache" }))).toBe(
      true
    );
  });

  it("uses Lambda invocation ARNs for the read and write API integrations", () => {
    const integrationUris = new Map<string, unknown>();
    const functionArn = (name: string) => `arn:aws:lambda:us-east-1:123456789012:function:${name}`;
    const invokeArn = (name: string) =>
      `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${functionArn(name)}/invocations`;

    return Effect.runPromise(
      Effect.acquireUseRelease(
        Effect.tryPromise(() =>
          pulumi.runtime.setMocks(
            {
              call: () => ({
                accountId: "123456789012",
                json: "{}",
                partition: "aws",
              }),
              newResource: (args) => {
                const state = { ...args.inputs };
                if (args.type === "aws:lambda/function:Function") {
                  Object.assign(state, {
                    arn: functionArn(args.name),
                    invokeArn: invokeArn(args.name),
                  });
                }
                if (args.type === "aws:apigatewayv2/integration:Integration") {
                  integrationUris.set(args.name, args.inputs.integrationUri);
                }
                return { id: `${args.name}-id`, state };
              },
            },
            "beep-effect",
            "test"
          )
        ),
        () =>
          Effect.sync(() => {
            new CiTurboCache("ci-turbo-cache-test", {
              config: CiTurboCachePulumiConfigValues.make(validConfigValues),
            });
          }),
        () => Effect.tryPromise(() => pulumi.runtime.disconnect())
      ).pipe(
        Effect.andThen(
          Effect.sync(() => {
            expect(integrationUris).toEqual(
              new Map([
                ["ci-turbo-cache-test-read-integration", invokeArn("ci-turbo-cache-test-read")],
                ["ci-turbo-cache-test-write-integration", invokeArn("ci-turbo-cache-test-write")],
              ])
            );
            expect([...integrationUris.values()]).not.toContain(functionArn("ci-turbo-cache-test-read"));
            expect([...integrationUris.values()]).not.toContain(functionArn("ci-turbo-cache-test-write"));
          })
        )
      )
    );
  });
});
