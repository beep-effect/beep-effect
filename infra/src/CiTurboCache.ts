/**
 * Pulumi component for the asymmetric beep CI Turbo remote cache.
 *
 * **Details**
 *
 * A Lambda authorizer applies the token-and-method matrix before the HTTP API
 * sends reads to a read-only shim process and artifact uploads to a separately
 * permissioned writer. Token values remain in SSM SecureString parameters.
 * The `ci-runners` stack entrypoint instantiates this component. The P3
 * payload-size gate passed before deployment: the only artifacts above the
 * Lambda proxy ceiling are uncacheable app builds, which API Gateway rejects
 * and Turbo tolerates as non-fatal upload warnings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { resolveInfraArtifactPath } from "./internal/InfraArtifactPath.ts";
import type { InfraPathEnv } from "./internal/InfraArtifactPath.ts";

const $I = $InfraId.create("CiTurboCache");

const bucketNamePattern =
  /^(?!\d{1,3}(?:\.\d{1,3}){3}$)(?!.*\.\.)(?!.*\.-)(?!.*-\.)(?!xn--)(?!sthree-)(?!amzn-s3-demo-)(?!.*-s3alias$)(?!.*--ol-s3$)(?!.*\.mrap$)(?!.*--x-s3$)(?!.*--table-s3$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const kmsKeyArnPattern = /^arn:aws(?:-us-gov|-cn)?:kms:[a-z0-9-]+:\d{12}:key\/[A-Za-z0-9-]+$/u;
const ssmParameterArnPattern = /^arn:aws(?:-us-gov|-cn)?:ssm:[a-z0-9-]+:\d{12}:parameter\/[A-Za-z0-9_./-]+$/u;
const absoluteZipPathPattern = /^\/.+\.zip$/u;

const KmsKeyArn = S.String.check(
  S.isPattern(
    kmsKeyArnPattern,
    $I.annote("KmsKeyArnFormat", {
      title: "KMS Key ARN Format",
      description: "An ARN for an AWS KMS key.",
      message: "Expected an AWS KMS key ARN",
    })
  )
).pipe(
  $I.annoteSchema("KmsKeyArn", {
    description: "An ARN for the KMS key encrypting the cache SecureString parameters.",
  })
);

const CacheBucketName = S.String.check(
  S.isPattern(
    bucketNamePattern,
    $I.annote("CacheBucketNameFormat", {
      title: "Cache Bucket Name Format",
      description:
        "A lowercase, DNS-compatible S3 bucket name between 3 and 63 characters, excluding S3-reserved prefixes (xn--, sthree-, amzn-s3-demo-) and suffixes (-s3alias, --ol-s3, .mrap, --x-s3, --table-s3).",
      message: "Expected a lowercase, DNS-compatible S3 bucket name without S3-reserved prefixes or suffixes",
    })
  )
).pipe(
  // fallow-ignore-next-line code-duplication -- each infra stack module owns its AWS schemas under its own file-local identity. Owner: @beep/infra. Exit: move the shared bucket-name schema into one infra schema module when a third stack needs it.
  $I.annoteSchema("CacheBucketName", {
    description: "A lowercase, DNS-compatible S3 bucket name for Turbo artifacts.",
  })
);

const SsmParameterArn = S.String.check(
  S.isPattern(
    ssmParameterArnPattern,
    $I.annote("SsmParameterArnFormat", {
      title: "SSM Parameter ARN Format",
      description: "An ARN for an AWS Systems Manager parameter.",
      message: "Expected an SSM parameter ARN",
    })
  )
).pipe(
  // fallow-ignore-next-line code-duplication -- each infra stack module owns its AWS schemas under its own file-local identity. Owner: @beep/infra. Exit: move the shared schema into one infra schema module when a third stack needs it.
  $I.annoteSchema("SsmParameterArn", {
    description: "An ARN for an AWS Systems Manager SecureString parameter.",
  })
);

const AbsoluteZipPath = S.String.check(
  S.isPattern(
    absoluteZipPathPattern,
    $I.annote("AbsoluteZipPathFormat", {
      title: "Absolute ZIP Path Format",
      description: "An absolute filesystem path ending in .zip.",
      message: "Expected an absolute path ending in .zip",
    })
  )
).pipe(
  $I.annoteSchema("AbsoluteZipPath", {
    description: "An absolute path to the bundled Turbo cache Lambda ZIP.",
  })
);

type CiTurboCachePulumiConfigValuesFields = {
  readonly bucketName: string;
  readonly lambdaZipPath: string;
  readonly readOnlyTokenSsmParameterArn: string;
  readonly tokenKmsKeyArn: string;
  readonly trustedWriteTokenSsmParameterArn: string;
  readonly writerSharedSecretSsmParameterArn: string;
};

/**
 * Validated Pulumi configuration for the asymmetric Turbo cache component.
 *
 * **Example** (Decode component configuration)
 *
 * ```ts
 * import { CiTurboCachePulumiConfigValues } from "@beep/infra"
 *
 * console.log(CiTurboCachePulumiConfigValues)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiTurboCachePulumiConfigValues = S.Class<CiTurboCachePulumiConfigValuesFields>(
  $I`CiTurboCachePulumiConfigValues`
)(
  {
    bucketName: CacheBucketName,
    lambdaZipPath: AbsoluteZipPath,
    readOnlyTokenSsmParameterArn: SsmParameterArn,
    tokenKmsKeyArn: KmsKeyArn,
    trustedWriteTokenSsmParameterArn: SsmParameterArn,
    writerSharedSecretSsmParameterArn: SsmParameterArn,
  },
  $I.annote("CiTurboCachePulumiConfigValues", {
    description: "Validated Pulumi configuration for the asymmetric Turbo cache component.",
  })
);

/**
 * Runtime type produced by {@link CiTurboCachePulumiConfigValues}.
 *
 * @see {@link CiTurboCachePulumiConfigValues} for validation and construction.
 * @category models
 * @since 0.0.0
 */
export type CiTurboCachePulumiConfigValues = typeof CiTurboCachePulumiConfigValues.Type;

/**
 * Load the Turbo cache configuration from the `ciTurboCache` Pulumi namespace.
 *
 * **Details**
 *
 * A relative `lambdaZipPath` resolves against `BEEP_INFRA_ARTIFACTS_ROOT`, or
 * `$HOME/beep-infra-artifacts` when that variable is unset; an absolute value
 * is used as configured.
 *
 * **Example** (Reference the loader)
 *
 * ```ts
 * import { loadCiTurboCacheConfig } from "@beep/infra"
 *
 * console.log(loadCiTurboCacheConfig)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadCiTurboCacheConfig = (env: InfraPathEnv = process.env): CiTurboCachePulumiConfigValues => {
  const config = new pulumi.Config("ciTurboCache");

  return CiTurboCachePulumiConfigValues.make({
    bucketName: config.require("bucketName"),
    lambdaZipPath: resolveInfraArtifactPath(env)(config.require("lambdaZipPath")),
    readOnlyTokenSsmParameterArn: config.require("readOnlyTokenSsmParameterArn"),
    tokenKmsKeyArn: config.require("tokenKmsKeyArn"),
    trustedWriteTokenSsmParameterArn: config.require("trustedWriteTokenSsmParameterArn"),
    writerSharedSecretSsmParameterArn: config.require("writerSharedSecretSsmParameterArn"),
  });
};

type CiTurboCacheArgs = {
  readonly config: CiTurboCachePulumiConfigValues;
  readonly remediation?: CiTurboCacheRemediation;
  readonly throttleAlarmRecipients?: ReadonlyArray<pulumi.Input<string>>;
};

const TurboCacheLabEpoch = S.String.check(
  S.isPattern(
    /^[a-z0-9]{4,16}$/u,
    $I.annote("TurboCacheLabEpochFormat", {
      title: "Turbo Cache Lab Epoch Format",
      description: "Four to sixteen lowercase alphanumerics naming one disposable lab epoch.",
      message: "turboCacheLab:epoch must be 4-16 lowercase alphanumerics",
    })
  )
).pipe($I.annoteSchema("TurboCacheLabEpoch", { description: "Disposable conformance-lab epoch identifier." }));

/**
 * Validate a disposable lab's epoch and bucket name and derive its resource names.
 *
 * **Details**
 *
 * The lab bucket must carry the `beep-tcl-<epoch>-` prefix so no lab stack can
 * address a production bucket; the evolved incumbent's bucket inserts `-evo`
 * after that prefix. Invalid input throws a Pulumi `RunError`, like
 * {@link loadCiTurboCacheConfig}.
 *
 * **Example** (Derive lab names)
 *
 * ```ts
 * import { resolveTurboCacheLabBuckets } from "@beep/infra"
 *
 * const names = resolveTurboCacheLabBuckets({ epoch: "c1023a", bucketName: "beep-tcl-c1023a-123456789012" })
 * console.assert(names.evolvedBucket === "beep-tcl-c1023a-evo-123456789012")
 * ```
 *
 * @param input - The `turboCacheLab:epoch` stack config value and the lab incumbent's configured bucket name.
 * @returns The lab component prefix and the evolved incumbent's bucket name.
 * @category configuration
 * @since 0.0.0
 */
export const resolveTurboCacheLabBuckets = ({
  epoch,
  bucketName,
}: {
  readonly epoch: string;
  readonly bucketName: string;
}) => {
  if (!S.is(TurboCacheLabEpoch)(epoch)) {
    throw new pulumi.RunError("turboCacheLab:epoch must be 4-16 lowercase alphanumerics");
  }
  const prefix = `beep-tcl-${epoch}-`;
  if (!Str.startsWith(prefix)(bucketName)) {
    throw new pulumi.RunError("ciTurboCache:bucketName must carry the lab prefix beep-tcl-<epoch>-");
  }
  return {
    componentPrefix: `beep-tcl-${epoch}`,
    evolvedBucket: `beep-tcl-${epoch}-evo-${Str.slice(prefix.length)(bucketName)}`,
  };
};

const ReservedConcurrency = S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 })).pipe(
  $I.annoteSchema("ReservedConcurrency", {
    description: "A Lambda reserved-concurrency value within the account's default 1,000 limit.",
  })
);

/**
 * Optional evolved-incumbent settings for the conformance lab and production.
 *
 * **Details**
 *
 * Omitted fields keep the original values (no tag passthrough, reserved
 * concurrency 20 read, 10 write, 20 authorizer). Production passes only the
 * concurrency fields, sized from the lab's 1.5x load envelope. `tagPassthrough` sets the shim's
 * `TURBO_REMOTE_CACHE_SIGNATURE_KEY` to a fixed non-secret mode switch: the
 * pinned shim then stores and returns `x-artifact-tag` without ever verifying
 * with that value.
 *
 * **Gotchas**
 *
 * With passthrough on, the shim answers 404 for any artifact stored without a
 * tag, so every writer must sign and existing untagged objects read as misses.
 *
 * **Example** (Describe the evolved lab incumbent)
 *
 * ```ts
 * import { CiTurboCacheRemediation } from "@beep/infra"
 *
 * const evolved = CiTurboCacheRemediation.make({ tagPassthrough: true, readReservedConcurrency: 60 })
 * console.assert(evolved.readReservedConcurrency === 60)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiTurboCacheRemediation extends S.Opaque<CiTurboCacheRemediation, { readonly brand: unique symbol }>()(
  S.Struct({
    tagPassthrough: S.optionalKey(S.Boolean),
    readReservedConcurrency: S.optionalKey(ReservedConcurrency),
    writeReservedConcurrency: S.optionalKey(ReservedConcurrency),
    authorizerReservedConcurrency: S.optionalKey(ReservedConcurrency),
  }).pipe(
    $I.annoteSchema("CiTurboCacheRemediation", {
      description: "Optional evolved-incumbent settings; omitted fields keep the deployed values.",
    })
  )
) {}

const defaultTags = {
  App: "turbo-cache",
  ManagedBy: "pulumi",
  Project: "beep-ci",
};

// Resolved lazily inside the constructor: a module-scope invoke would run on
// import, firing a Pulumi resource-monitor call in any process that merely
// imports this barrel — including test runners with no monitor configured.
const lambdaAssumeRolePolicy = () =>
  aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["sts:AssumeRole"],
        principals: [{ identifiers: ["lambda.amazonaws.com"], type: "Service" }],
      },
    ],
  });

/**
 * Trusted-write, PR-read-only asymmetric Turbo remote cache.
 *
 * **Details**
 *
 * `GET`, `HEAD`, and event-reporting requests reach a read-only Lambda whose
 * role cannot write S3. `PUT` reaches a writer whose role can write cache
 * objects. A separate Lambda authorizer resolves both token parameters and
 * rejects the read token on `PUT`. The authorizer signs each allowed write
 * request with a shared secret held in SSM, and the dedicated writer wrapper
 * validates that HMAC before delegating to the unauthenticated shim. Every role
 * uses the account's `beep-ci-fleet-boundary` permissions boundary.
 *
 * **Gotchas**
 *
 * The Lambda ZIP must export `index.handler` for the read-only shim,
 * `authorizer.handler` for the token-and-method authorizer, and
 * `writer.handler` for the HMAC-validating writer wrapper. The authorizer and
 * writer must calculate and verify the HMAC over the API Gateway request id,
 * method, and raw path before the wrapper delegates to the shim. The writer's
 * `lambda:InvokeFunction` resource permission is additionally scoped to this
 * API's `PUT /v8/artifacts/{hash}` execution ARN. These barriers are independent
 * of the API resource policy, so a same-account principal with direct invoke
 * authority still cannot mint an accepted write event.
 *
 * All resources inherit the enclosing stack's AWS provider. The component has
 * no independent region setting, preventing Lambda, API Gateway, and permission
 * resources from being split across regions. The bucket policy admits object
 * reads only from the reader and writer roles and object writes only from the
 * writer role. Stack administrators retain bucket control-plane authority, so
 * they can update or remove the policy, but cannot read or mutate cache objects
 * while this data-plane policy remains installed.
 *
 * **Example** (Declare the component)
 *
 * ```ts
 * import { CiTurboCache, CiTurboCachePulumiConfigValues } from "@beep/infra"
 *
 * const config = CiTurboCachePulumiConfigValues.make({
 *   bucketName: "beep-turbo-cache-123456789012",
 *   lambdaZipPath: "/artifacts/turbo-cache.zip",
 *   readOnlyTokenSsmParameterArn:
 *     "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/read-only-token",
 *   tokenKmsKeyArn:
 *     "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
 *   trustedWriteTokenSsmParameterArn:
 *     "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/trusted-write-token",
 *   writerSharedSecretSsmParameterArn:
 *     "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/writer-hmac-secret",
 * })
 *
 * console.log(new CiTurboCache("ci-turbo-cache", { config }).apiEndpoint)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export class CiTurboCache extends pulumi.ComponentResource {
  /**
   * Base URL supplied to `TURBO_API`.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly apiEndpoint: pulumi.Output<string>;

  /**
   * S3 bucket containing Turbo cache artifacts.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly bucketName: pulumi.Output<string>;

  public constructor(name: string, args: CiTurboCacheArgs, opts?: pulumi.ComponentResourceOptions) {
    super("beep:infra:CiTurboCache", name, {}, opts);

    const { config } = args;
    const accountId = aws.getCallerIdentityOutput({}, { parent: this }).accountId;
    const partition = aws.getPartitionOutput({}, { parent: this }).partition;
    const permissionsBoundary = pulumi.interpolate`arn:${partition}:iam::${accountId}:policy/beep-ci-fleet-boundary`;

    const bucket = new aws.s3.Bucket(
      `${name}-artifacts`,
      {
        bucket: config.bucketName,
        forceDestroy: false,
        tags: { ...defaultTags, DataClass: "ci-build-cache" },
      },
      { parent: this }
    );

    new aws.s3.BucketPublicAccessBlock(
      `${name}-public-access-block`,
      {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        bucket: bucket.id,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
      { parent: this }
    );

    new aws.s3.BucketServerSideEncryptionConfiguration(
      `${name}-encryption`,
      {
        bucket: bucket.id,
        rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
      },
      { parent: this }
    );

    new aws.s3.BucketLifecycleConfiguration(
      `${name}-lifecycle`,
      {
        bucket: bucket.id,
        rules: [
          {
            abortIncompleteMultipartUpload: { daysAfterInitiation: 1 },
            expiration: { days: 30 },
            filter: { prefix: "" },
            id: "expire-stale-cache-artifacts",
            status: "Enabled",
          },
        ],
      },
      { parent: this }
    );

    const readLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-read-logs`,
      {
        name: `/aws/lambda/${name}-read`,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );
    const writeLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-write-logs`,
      {
        name: `/aws/lambda/${name}-write`,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );
    const authorizerLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-authorizer-logs`,
      {
        name: `/aws/lambda/${name}-authorizer`,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );

    const assumeRolePolicyJson = lambdaAssumeRolePolicy().json;

    const readRole = new aws.iam.Role(
      `${name}-read-role`,
      {
        assumeRolePolicy: assumeRolePolicyJson,
        permissionsBoundary,
        tags: defaultTags,
      },
      { parent: this }
    );
    const writeRole = new aws.iam.Role(
      `${name}-write-role`,
      {
        assumeRolePolicy: assumeRolePolicyJson,
        permissionsBoundary,
        tags: defaultTags,
      },
      { parent: this }
    );
    const authorizerRole = new aws.iam.Role(
      `${name}-authorizer-role`,
      {
        assumeRolePolicy: assumeRolePolicyJson,
        permissionsBoundary,
        tags: defaultTags,
      },
      { parent: this }
    );

    const readPolicy = aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["s3:ListBucket"],
          resources: [bucket.arn],
          sid: "ListCacheBucket",
        },
        {
          actions: ["s3:GetObject"],
          resources: [pulumi.interpolate`${bucket.arn}/*`],
          sid: "ReadCacheObjects",
        },
        {
          actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
          resources: [pulumi.interpolate`${readLogGroup.arn}:*`],
          sid: "WriteOwnLogs",
        },
      ],
    });
    const writePolicy = aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["s3:ListBucket"],
          resources: [bucket.arn],
          sid: "ListCacheBucket",
        },
        {
          actions: ["s3:GetObject", "s3:PutObject"],
          resources: [pulumi.interpolate`${bucket.arn}/*`],
          sid: "ReadWriteCacheObjects",
        },
        {
          actions: ["ssm:GetParameter"],
          resources: [config.writerSharedSecretSsmParameterArn],
          sid: "ReadWriterSharedSecret",
        },
        {
          actions: ["kms:Decrypt"],
          resources: [config.tokenKmsKeyArn],
          sid: "DecryptWriterSharedSecret",
        },
        {
          actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
          resources: [pulumi.interpolate`${writeLogGroup.arn}:*`],
          sid: "WriteOwnLogs",
        },
      ],
    });
    const authorizerPolicy = aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["ssm:GetParameter", "ssm:GetParameters"],
          resources: [
            config.readOnlyTokenSsmParameterArn,
            config.trustedWriteTokenSsmParameterArn,
            config.writerSharedSecretSsmParameterArn,
          ],
          sid: "ReadCacheTokens",
        },
        {
          actions: ["kms:Decrypt"],
          resources: [config.tokenKmsKeyArn],
          sid: "DecryptCacheSecrets",
        },
        {
          actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
          resources: [pulumi.interpolate`${authorizerLogGroup.arn}:*`],
          sid: "WriteOwnLogs",
        },
      ],
    });

    const readRolePolicy = new aws.iam.RolePolicy(
      `${name}-read-policy`,
      { policy: readPolicy.json, role: readRole.id },
      { parent: this }
    );
    const writeRolePolicy = new aws.iam.RolePolicy(
      `${name}-write-policy`,
      { policy: writePolicy.json, role: writeRole.id },
      { parent: this }
    );
    const authorizerRolePolicy = new aws.iam.RolePolicy(
      `${name}-authorizer-policy`,
      { policy: authorizerPolicy.json, role: authorizerRole.id },
      { parent: this }
    );

    const bucketPolicy = aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["s3:*"],
          conditions: [{ test: "Bool", values: ["false"], variable: "aws:SecureTransport" }],
          effect: "Deny",
          principals: [{ identifiers: ["*"], type: "*" }],
          resources: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
          sid: "DenyInsecureTransport",
        },
        {
          actions: ["s3:GetObject"],
          principals: [{ identifiers: [readRole.arn], type: "AWS" }],
          resources: [pulumi.interpolate`${bucket.arn}/*`],
          sid: "AllowReaderObjectAccess",
        },
        {
          actions: ["s3:GetObject", "s3:PutObject"],
          principals: [{ identifiers: [writeRole.arn], type: "AWS" }],
          resources: [pulumi.interpolate`${bucket.arn}/*`],
          sid: "AllowWriterObjectAccess",
        },
        {
          actions: ["s3:*"],
          conditions: [
            {
              test: "ArnNotEquals",
              values: [readRole.arn, writeRole.arn],
              variable: "aws:PrincipalArn",
            },
          ],
          effect: "Deny",
          principals: [{ identifiers: ["*"], type: "*" }],
          resources: [pulumi.interpolate`${bucket.arn}/*`],
          sid: "DenyObjectAccessOutsideCacheRoles",
        },
      ],
    });

    new aws.s3.BucketPolicy(
      `${name}-bucket-policy`,
      { bucket: bucket.id, policy: bucketPolicy.json },
      { parent: this }
    );

    const remediation = args.remediation ?? CiTurboCacheRemediation.make({});
    const commonEnvironment = {
      AUTH_MODE: "none",
      STORAGE_PATH: config.bucketName,
      STORAGE_PROVIDER: "s3",
      ...(remediation.tagPassthrough === true
        ? { TURBO_REMOTE_CACHE_SIGNATURE_KEY: "tag-passthrough-mode-switch" }
        : {}),
    };
    const code = new pulumi.asset.FileArchive(config.lambdaZipPath);
    const readFunction = new aws.lambda.Function(
      `${name}-read`,
      {
        code,
        environment: {
          variables: {
            ...commonEnvironment,
            READ_ONLY: "true",
          },
        },
        handler: "index.handler",
        memorySize: 512,
        name: `${name}-read`,
        reservedConcurrentExecutions: remediation.readReservedConcurrency ?? 20,
        role: readRole.arn,
        runtime: "nodejs22.x",
        tags: defaultTags,
        timeout: 10,
      },
      { dependsOn: [readLogGroup, readRolePolicy], parent: this }
    );
    const writeFunction = new aws.lambda.Function(
      `${name}-write`,
      {
        code,
        environment: {
          variables: {
            ...commonEnvironment,
            READ_ONLY: "false",
            WRITER_SHARED_SECRET_SSM_PARAMETER_ARN: config.writerSharedSecretSsmParameterArn,
          },
        },
        handler: "writer.handler",
        memorySize: 512,
        name: `${name}-write`,
        reservedConcurrentExecutions: remediation.writeReservedConcurrency ?? 10,
        role: writeRole.arn,
        runtime: "nodejs22.x",
        tags: defaultTags,
        timeout: 10,
      },
      { dependsOn: [writeLogGroup, writeRolePolicy], parent: this }
    );
    const authorizerFunction = new aws.lambda.Function(
      `${name}-authorizer`,
      {
        code,
        environment: {
          variables: {
            READ_ONLY_TOKEN_SSM_PARAMETER_ARN: config.readOnlyTokenSsmParameterArn,
            TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN: config.trustedWriteTokenSsmParameterArn,
            WRITER_SHARED_SECRET_SSM_PARAMETER_ARN: config.writerSharedSecretSsmParameterArn,
          },
        },
        handler: "authorizer.handler",
        memorySize: 128,
        name: `${name}-authorizer`,
        reservedConcurrentExecutions: remediation.authorizerReservedConcurrency ?? 20,
        role: authorizerRole.arn,
        runtime: "nodejs22.x",
        tags: defaultTags,
        timeout: 5,
      },
      { dependsOn: [authorizerLogGroup, authorizerRolePolicy], parent: this }
    );

    const api = new aws.apigatewayv2.Api(
      `${name}-api`,
      {
        description: "Method-separated trusted-write and PR-read-only Turbo cache API.",
        protocolType: "HTTP",
        tags: defaultTags,
      },
      { parent: this }
    );
    const authorizer = new aws.apigatewayv2.Authorizer(
      `${name}-authorizer`,
      {
        apiId: api.id,
        authorizerPayloadFormatVersion: "2.0",
        authorizerResultTtlInSeconds: 0,
        authorizerType: "REQUEST",
        authorizerUri: authorizerFunction.invokeArn,
        enableSimpleResponses: true,
        identitySources: ["$request.header.Authorization"],
        name: `${name}-token-method-authorizer`,
      },
      { parent: this }
    );
    const readIntegration = new aws.apigatewayv2.Integration(
      `${name}-read-integration`,
      {
        apiId: api.id,
        integrationMethod: "POST",
        integrationType: "AWS_PROXY",
        integrationUri: readFunction.invokeArn,
        payloadFormatVersion: "2.0",
      },
      { parent: this }
    );
    const writeIntegration = new aws.apigatewayv2.Integration(
      `${name}-write-integration`,
      {
        apiId: api.id,
        integrationMethod: "POST",
        integrationType: "AWS_PROXY",
        integrationUri: writeFunction.invokeArn,
        payloadFormatVersion: "2.0",
      },
      { parent: this }
    );

    const route = (suffix: string, routeKey: string, integration: aws.apigatewayv2.Integration) =>
      new aws.apigatewayv2.Route(
        `${name}-${suffix}`,
        {
          apiId: api.id,
          authorizationType: "CUSTOM",
          authorizerId: authorizer.id,
          routeKey,
          target: pulumi.interpolate`integrations/${integration.id}`,
        },
        { parent: this }
      );

    // No POST /v8/artifacts route: the pinned shim does not implement the
    // artifact-query endpoint, so exposing it would authorize requests the
    // backend can only 404. Clients get a plain API Gateway 404 instead.
    route("status", "GET /v8/artifacts/status", readIntegration);
    route("get-artifact", "GET /v8/artifacts/{hash}", readIntegration);
    route("head-artifact", "HEAD /v8/artifacts/{hash}", readIntegration);
    route("events", "POST /v8/artifacts/events", readIntegration);
    route("put-artifact", "PUT /v8/artifacts/{hash}", writeIntegration);

    new aws.apigatewayv2.Stage(
      `${name}-default-stage`,
      {
        apiId: api.id,
        autoDeploy: true,
        // Bounded abuse ceiling: the read token is public-equivalent by
        // design, so a leaked token must not translate into unbounded
        // API Gateway/Lambda/S3 spend. CI waves stay far below these rates.
        defaultRouteSettings: {
          throttlingBurstLimit: 200,
          throttlingRateLimit: 100,
        },
        name: "$default",
      },
      { parent: this }
    );
    new aws.lambda.Permission(
      `${name}-authorizer-api-permission`,
      {
        action: "lambda:InvokeFunction",
        function: authorizerFunction.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${api.executionArn}/authorizers/${authorizer.id}`,
      },
      { parent: this }
    );
    new aws.lambda.Permission(
      `${name}-read-api-permission`,
      {
        action: "lambda:InvokeFunction",
        function: readFunction.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
      },
      { parent: this }
    );
    new aws.lambda.Permission(
      `${name}-write-api-permission`,
      {
        action: "lambda:InvokeFunction",
        function: writeFunction.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${api.executionArn}/*/PUT/v8/artifacts/*`,
      },
      { parent: this }
    );

    // Each throttled read is a silent Turbo cache miss and each throttled write
    // a lost upload, so any throttle in a five-minute window alarms.
    const throttleAlarmRecipients = args.throttleAlarmRecipients ?? [];
    if (A.isReadonlyArrayNonEmpty(throttleAlarmRecipients)) {
      const throttleTopic = new aws.sns.Topic(
        `${name}-throttles`,
        { name: `${name}-throttles`, tags: defaultTags },
        { parent: this }
      );
      A.forEach(throttleAlarmRecipients, (endpoint, index) => {
        new aws.sns.TopicSubscription(
          `${name}-throttles-recipient-${index}`,
          { endpoint, protocol: "email", topic: throttleTopic.arn },
          { additionalSecretOutputs: ["endpoint"], parent: this }
        );
      });
      A.forEach(
        [
          ["read", readFunction],
          ["write", writeFunction],
          ["authorizer", authorizerFunction],
        ] as const,
        ([role, fn]) => {
          new aws.cloudwatch.MetricAlarm(
            `${name}-${role}-throttles`,
            {
              alarmActions: [throttleTopic.arn],
              alarmDescription: `The ${role} Lambda was throttled at its reserved concurrency.`,
              comparisonOperator: "GreaterThanThreshold",
              dimensions: { FunctionName: fn.name },
              evaluationPeriods: 1,
              metricName: "Throttles",
              name: `${name}-${role}-throttles`,
              namespace: "AWS/Lambda",
              period: 300,
              statistic: "Sum",
              tags: defaultTags,
              threshold: 0,
              treatMissingData: "notBreaching",
            },
            { parent: this }
          );
        }
      );
    }

    this.apiEndpoint = api.apiEndpoint;
    this.bucketName = bucket.bucket;
    this.registerOutputs({ apiEndpoint: this.apiEndpoint, bucketName: this.bucketName });
  }
}
