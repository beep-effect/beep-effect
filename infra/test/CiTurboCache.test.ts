import {
  CiTurboCache,
  CiTurboCachePulumiConfigValues,
  CiTurboCacheRemediation,
  loadCiTurboCacheConfig,
  resolveTurboCacheLabBuckets,
  TurboCacheLabBucketsInput,
} from "@beep/infra";
import { it } from "@beep/test-runner";
import { assert, describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as pulumi from "@pulumi/pulumi";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

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
    pipe(decodeConfigValues(validConfigValues), Result.isSuccess, assertTrue);
  });

  it("accepts DNS-compatible bucket names and rejects malformed names", () => {
    pipe(decodeConfigValues(validConfigValues), Result.isSuccess, assertTrue);
    pipe(decodeConfigValues({ ...validConfigValues, bucketName: "Beep_Cache" }), Result.isFailure, assertTrue);
    pipe(decodeConfigValues({ ...validConfigValues, bucketName: "192.168.0.1" }), Result.isFailure, assertTrue);
    pipe(decodeConfigValues({ ...validConfigValues, bucketName: "ab" }), Result.isFailure, assertTrue);
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
      pipe(decodeConfigValues({ ...validConfigValues, bucketName }), Result.isFailure, assertTrue);
    }
    pipe(
      decodeConfigValues({ ...validConfigValues, bucketName: "beep-cache-s3aliased" }),
      Result.isSuccess,
      assertTrue
    );
  });

  it("accepts SSM parameter ARNs and rejects other ARN kinds", () => {
    pipe(decodeConfigValues(validConfigValues), Result.isSuccess, assertTrue);
    pipe(
      decodeConfigValues({
        ...validConfigValues,
        readOnlyTokenSsmParameterArn: "arn:aws:iam::123456789012:role/not-an-ssm-parameter",
      }),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decodeConfigValues({
        ...validConfigValues,
        writerSharedSecretSsmParameterArn: "arn:aws:iam::123456789012:role/not-an-ssm-parameter",
      }),
      Result.isFailure,
      assertTrue
    );
    const { writerSharedSecretSsmParameterArn: _writerSharedSecretSsmParameterArn, ...missingWriterSharedSecret } =
      validConfigValues;
    pipe(decodeConfigValues(missingWriterSharedSecret), Result.isFailure, assertTrue);
  });

  it("accepts a KMS key ARN and rejects malformed or missing values", () => {
    pipe(decodeConfigValues(validConfigValues), Result.isSuccess, assertTrue);
    pipe(decodeConfigValues({ ...validConfigValues, tokenKmsKeyArn: "not-an-arn" }), Result.isFailure, assertTrue);
    const { tokenKmsKeyArn: _tokenKmsKeyArn, ...missingKmsKeyArn } = validConfigValues;
    pipe(decodeConfigValues(missingKmsKeyArn), Result.isFailure, assertTrue);
  });

  it("accepts absolute ZIP paths and rejects relative or non-ZIP paths", () => {
    pipe(decodeConfigValues(validConfigValues), Result.isSuccess, assertTrue);
    pipe(decodeConfigValues({ ...validConfigValues, lambdaZipPath: "cache.zip" }), Result.isFailure, assertTrue);
    pipe(decodeConfigValues({ ...validConfigValues, lambdaZipPath: "/artifacts/cache" }), Result.isFailure, assertTrue);
  });

  it.effect(
    "uses Lambda invocation ARNs for the read and write API integrations",
    Effect.fnUntraced(function* () {
      const integrationUris = MutableHashMap.empty<string, unknown>();
      const functionArn = (name: string) => `arn:aws:lambda:us-east-1:123456789012:function:${name}`;
      const invokeArn = (name: string) =>
        `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${functionArn(name)}/invocations`;

      yield* Effect.acquireUseRelease(
        Effect.tryPromise(() =>
          pulumi.runtime.setMocks(
            {
              call: () => ({
                accountId: "123456789012",
                json: "{}",
                partition: "aws",
              }),
              newResource: (args) => {
                const state =
                  args.type === "aws:lambda/function:Function"
                    ? {
                        ...args.inputs,
                        arn: functionArn(args.name),
                        invokeArn: invokeArn(args.name),
                      }
                    : args.inputs;
                if (args.type === "aws:apigatewayv2/integration:Integration") {
                  MutableHashMap.set(integrationUris, args.name, args.inputs.integrationUri);
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
      );

      const readUri = pipe(
        MutableHashMap.get(integrationUris, "ci-turbo-cache-test-read-integration"),
        O.getOrUndefined
      );
      const writeUri = pipe(
        MutableHashMap.get(integrationUris, "ci-turbo-cache-test-write-integration"),
        O.getOrUndefined
      );
      assert.strictEqual(readUri, invokeArn("ci-turbo-cache-test-read"));
      assert.strictEqual(writeUri, invokeArn("ci-turbo-cache-test-write"));
      assert.notStrictEqual(readUri, functionArn("ci-turbo-cache-test-read"));
      assert.notStrictEqual(writeUri, functionArn("ci-turbo-cache-test-write"));
    })
  );
});

describe("@beep/infra CiTurboCache remediation", { concurrent: false }, () => {
  type FunctionInputs = {
    readonly environment?: { readonly variables?: Readonly<Record<string, string>> };
    readonly reservedConcurrentExecutions?: number;
  };

  const functionInputsFor = Effect.fnUntraced(function* (remediation?: CiTurboCacheRemediation) {
    const functions = MutableHashMap.empty<string, FunctionInputs>();
    yield* Effect.acquireUseRelease(
      Effect.tryPromise(() =>
        pulumi.runtime.setMocks(
          {
            call: () => ({ accountId: "123456789012", json: "{}", partition: "aws" }),
            newResource: (args) => {
              if (args.type === "aws:lambda/function:Function") {
                MutableHashMap.set(functions, args.name, args.inputs as FunctionInputs);
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
          new CiTurboCache("ci-turbo-cache-test", {
            config: CiTurboCachePulumiConfigValues.make(validConfigValues),
            ...(remediation === undefined ? {} : { remediation }),
          });
        }),
      () => Effect.tryPromise(() => pulumi.runtime.disconnect())
    );
    return (name: string) => pipe(MutableHashMap.get(functions, `ci-turbo-cache-test-${name}`), O.getOrUndefined);
  });

  it.effect(
    "keeps the deployed concurrency and no tag passthrough when no remediation is passed",
    Effect.fnUntraced(function* () {
      const fn = yield* functionInputsFor();
      expect(fn("read")?.reservedConcurrentExecutions).toBe(20);
      expect(fn("write")?.reservedConcurrentExecutions).toBe(10);
      expect(fn("authorizer")?.reservedConcurrentExecutions).toBe(20);
      expect(fn("read")?.environment?.variables?.TURBO_REMOTE_CACHE_SIGNATURE_KEY).toBeUndefined();
      expect(fn("write")?.environment?.variables?.TURBO_REMOTE_CACHE_SIGNATURE_KEY).toBeUndefined();
    })
  );

  it.effect(
    "applies tag passthrough to both shim functions and the requested concurrency",
    Effect.fnUntraced(function* () {
      const fn = yield* functionInputsFor(
        CiTurboCacheRemediation.make({
          tagPassthrough: true,
          readReservedConcurrency: 60,
          writeReservedConcurrency: 30,
          authorizerReservedConcurrency: 60,
        })
      );
      expect(fn("read")?.reservedConcurrentExecutions).toBe(60);
      expect(fn("write")?.reservedConcurrentExecutions).toBe(30);
      expect(fn("authorizer")?.reservedConcurrentExecutions).toBe(60);
      expect(fn("read")?.environment?.variables?.TURBO_REMOTE_CACHE_SIGNATURE_KEY).toBe("tag-passthrough-mode-switch");
      expect(fn("write")?.environment?.variables?.TURBO_REMOTE_CACHE_SIGNATURE_KEY).toBe("tag-passthrough-mode-switch");
      expect(fn("authorizer")?.environment?.variables?.TURBO_REMOTE_CACHE_SIGNATURE_KEY).toBeUndefined();
    })
  );
});

describe("@beep/infra CiTurboCache throttle alarms", { concurrent: false }, () => {
  type AlarmInputs = {
    readonly alarmActions?: ReadonlyArray<string>;
    readonly comparisonOperator?: string;
    readonly dimensions?: { readonly FunctionName?: string };
    readonly metricName?: string;
    readonly namespace?: string;
    readonly statistic?: string;
    readonly threshold?: number;
    readonly treatMissingData?: string;
  };
  type Declared = { readonly type: string; readonly inputs: AlarmInputs & { readonly protocol?: string } };

  const resourcesFor = Effect.fnUntraced(function* (throttleAlarmRecipients?: ReadonlyArray<string>) {
    const resources = MutableHashMap.empty<string, Declared>();
    yield* Effect.acquireUseRelease(
      Effect.tryPromise(() =>
        pulumi.runtime.setMocks(
          {
            call: () => ({ accountId: "123456789012", json: "{}", partition: "aws" }),
            newResource: (args) => {
              MutableHashMap.set(resources, args.name, { type: args.type, inputs: args.inputs as Declared["inputs"] });
              return {
                id: `${args.name}-id`,
                state: { ...args.inputs, arn: `arn:aws:mock:us-east-1:123456789012:${args.name}` },
              };
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
            ...(throttleAlarmRecipients === undefined ? {} : { throttleAlarmRecipients }),
          });
        }),
      () => Effect.tryPromise(() => pulumi.runtime.disconnect())
    );
    return (name: string) => pipe(MutableHashMap.get(resources, `ci-turbo-cache-test-${name}`), O.getOrUndefined);
  });

  it.effect(
    "declares no topic or alarms without recipients",
    Effect.fnUntraced(function* () {
      const resource = yield* resourcesFor();
      expect(resource("throttles")).toBeUndefined();
      expect(resource("read-throttles")).toBeUndefined();
    })
  );

  it.effect(
    "alarms on any throttle of each function and notifies every recipient by email",
    Effect.fnUntraced(function* () {
      const resource = yield* resourcesFor(["ops@example.com", "cost@example.com"]);
      expect(resource("throttles")?.type).toBe("aws:sns/topic:Topic");
      expect(resource("throttles-recipient-0")?.inputs.protocol).toBe("email");
      expect(resource("throttles-recipient-1")?.inputs.protocol).toBe("email");
      expect(resource("throttles-recipient-2")).toBeUndefined();
      for (const role of ["read", "write", "authorizer"]) {
        const alarm = resource(`${role}-throttles`);
        expect(alarm?.type).toBe("aws:cloudwatch/metricAlarm:MetricAlarm");
        expect(alarm?.inputs).toMatchObject({
          alarmActions: ["arn:aws:mock:us-east-1:123456789012:ci-turbo-cache-test-throttles"],
          comparisonOperator: "GreaterThanThreshold",
          dimensions: { FunctionName: `ci-turbo-cache-test-${role}` },
          metricName: "Throttles",
          namespace: "AWS/Lambda",
          statistic: "Sum",
          threshold: 0,
          treatMissingData: "notBreaching",
        });
      }
    })
  );
});

describe("@beep/infra resolveTurboCacheLabBuckets", () => {
  it("derives the lab component prefix and the evolved bucket", () => {
    expect(
      resolveTurboCacheLabBuckets(
        TurboCacheLabBucketsInput.make({ epoch: "c1023a", bucketName: "beep-tcl-c1023a-123456789012" })
      )
    ).toEqual({
      componentPrefix: "beep-tcl-c1023a",
      evolvedBucket: "beep-tcl-c1023a-evo-123456789012",
    });
  });

  it("rejects a malformed epoch and a bucket outside the lab prefix", () => {
    expect(() =>
      resolveTurboCacheLabBuckets(
        TurboCacheLabBucketsInput.make({ epoch: "C1", bucketName: "beep-tcl-C1-123456789012" })
      )
    ).toThrow("turboCacheLab:epoch");
    expect(() =>
      resolveTurboCacheLabBuckets(
        TurboCacheLabBucketsInput.make({ epoch: "c1023a", bucketName: "beep-turbo-cache-123456789012" })
      )
    ).toThrow("lab prefix");
  });
});

describe("@beep/infra loadCiTurboCacheConfig", { concurrent: false }, () => {
  const withTurboCacheConfig = (lambdaZipPath: string, use: () => void) =>
    Effect.acquireUseRelease(
      Effect.sync(pulumi.runtime.allConfig),
      () =>
        Effect.sync(() => {
          pulumi.runtime.setAllConfig({
            "ciTurboCache:bucketName": validConfigValues.bucketName,
            "ciTurboCache:lambdaZipPath": lambdaZipPath,
            "ciTurboCache:readOnlyTokenSsmParameterArn": validConfigValues.readOnlyTokenSsmParameterArn,
            "ciTurboCache:tokenKmsKeyArn": validConfigValues.tokenKmsKeyArn,
            "ciTurboCache:trustedWriteTokenSsmParameterArn": validConfigValues.trustedWriteTokenSsmParameterArn,
            "ciTurboCache:writerSharedSecretSsmParameterArn": validConfigValues.writerSharedSecretSsmParameterArn,
          });
          use();
        }),
      (config) => Effect.sync(() => pulumi.runtime.setAllConfig(config))
    );

  it.effect("resolves a relative ZIP path against the artifacts root", () =>
    withTurboCacheConfig("turbo-cache/2.12.0/turbo-cache.zip", () => {
      expect(
        loadCiTurboCacheConfig({ BEEP_INFRA_ARTIFACTS_ROOT: "/srv/artifacts/", HOME: "/home/example" }).lambdaZipPath
      ).toBe("/srv/artifacts/turbo-cache/2.12.0/turbo-cache.zip");
      expect(loadCiTurboCacheConfig({ BEEP_INFRA_ARTIFACTS_ROOT: "", HOME: "/home/example" }).lambdaZipPath).toBe(
        "/home/example/beep-infra-artifacts/turbo-cache/2.12.0/turbo-cache.zip"
      );
    })
  );

  it.effect("keeps an absolute ZIP path and rejects an unresolvable relative one", () =>
    Effect.andThen(
      withTurboCacheConfig("/opt/artifacts/turbo-cache.zip", () => {
        expect(loadCiTurboCacheConfig({}).lambdaZipPath).toBe("/opt/artifacts/turbo-cache.zip");
      }),
      withTurboCacheConfig("turbo-cache.zip", () => {
        expect(() => loadCiTurboCacheConfig({})).toThrow("BEEP_INFRA_ARTIFACTS_ROOT");
        expect(() => loadCiTurboCacheConfig({ BEEP_INFRA_ARTIFACTS_ROOT: "artifacts" })).toThrow(
          "BEEP_INFRA_ARTIFACTS_ROOT"
        );
      })
    )
  );
});
