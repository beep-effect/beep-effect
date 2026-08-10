/**
 * Pulumi component skeleton for the asymmetric beep CI Turbo remote cache.
 *
 * **Details**
 *
 * A Lambda authorizer applies the token-and-method matrix before the HTTP API
 * sends reads to a read-only shim process and artifact uploads to a separately
 * permissioned writer. Token values remain in SSM SecureString parameters.
 * This module is intentionally import-safe and is not instantiated by a stack
 * entrypoint. Deployment remains blocked on the Lambda payload-size decision
 * recorded in the P3 cache design.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as S from "effect/Schema";
import { withPulumiConfigDecodeEffect } from "./internal/PulumiConfigSchema.ts";

const $I = $InfraId.create("CiTurboCache");

const awsRegionPattern = /^[a-z]{2}(?:-[a-z]+)+-\d$/u;
const bucketNamePattern = /^(?!\d{1,3}(?:\.\d{1,3}){3}$)(?!.*\.\.)(?!.*\.-)(?!.*-\.)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const ssmParameterArnPattern = /^arn:aws(?:-us-gov|-cn)?:ssm:[a-z0-9-]+:\d{12}:parameter\/[A-Za-z0-9_./-]+$/u;
const absoluteZipPathPattern = /^\/.+\.zip$/u;

const AwsRegion = S.String.check(
  S.isPattern(awsRegionPattern, {
    identifier: $I`AwsRegionFormat`,
    title: "AWS Region Format",
    description: "An AWS region name such as us-east-1.",
    message: "Expected an AWS region name like us-east-1",
  })
).pipe($I.annoteSchema("AwsRegion", { description: "An AWS region name such as us-east-1." }));

const CacheBucketName = S.String.check(
  S.isPattern(bucketNamePattern, {
    identifier: $I`CacheBucketNameFormat`,
    title: "Cache Bucket Name Format",
    description: "A lowercase, DNS-compatible S3 bucket name between 3 and 63 characters.",
    message: "Expected a lowercase, DNS-compatible S3 bucket name",
  })
).pipe(
  $I.annoteSchema("CacheBucketName", {
    description: "A lowercase, DNS-compatible S3 bucket name for Turbo artifacts.",
  })
);

const SsmParameterArn = S.String.check(
  S.isPattern(ssmParameterArnPattern, {
    identifier: $I`SsmParameterArnFormat`,
    title: "SSM Parameter ARN Format",
    description: "An ARN for an AWS Systems Manager parameter.",
    message: "Expected an SSM parameter ARN",
  })
).pipe(
  $I.annoteSchema("SsmParameterArn", {
    description: "An ARN for an AWS Systems Manager SecureString parameter.",
  })
);

const AbsoluteZipPath = S.String.check(
  S.isPattern(absoluteZipPathPattern, {
    identifier: $I`AbsoluteZipPathFormat`,
    title: "Absolute ZIP Path Format",
    description: "An absolute filesystem path ending in .zip.",
    message: "Expected an absolute path ending in .zip",
  })
).pipe(
  $I.annoteSchema("AbsoluteZipPath", {
    description: "An absolute path to the bundled Turbo cache Lambda ZIP.",
  })
);

type CiTurboCachePulumiConfigValuesFields = {
  readonly bucketName: string;
  readonly lambdaZipPath: string;
  readonly readOnlyTokenSsmParameterArn: string;
  readonly region: string;
  readonly trustedWriteTokenSsmParameterArn: string;
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
    region: AwsRegion,
    trustedWriteTokenSsmParameterArn: SsmParameterArn,
  },
  $I.annote("CiTurboCachePulumiConfigValues", {
    description: "Validated Pulumi configuration for the asymmetric Turbo cache component.",
  })
).pipe(withPulumiConfigDecodeEffect);

/**
 * Runtime type produced by {@link CiTurboCachePulumiConfigValues}.
 *
 * @see {@link CiTurboCachePulumiConfigValues} for validation and construction.
 * @category models
 * @since 0.0.0
 */
export type CiTurboCachePulumiConfigValues = typeof CiTurboCachePulumiConfigValues.Type;

type CiTurboCacheArgs = {
  readonly config: CiTurboCachePulumiConfigValues;
};

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
 * Non-deployed component skeleton for a trusted-write and PR-read-only Turbo
 * remote cache.
 *
 * **Details**
 *
 * `GET`, `HEAD`, and event-reporting requests reach a read-only Lambda whose
 * role cannot write S3. `PUT` reaches a writer whose role can write cache
 * objects. A separate Lambda authorizer resolves both token parameters and
 * rejects the read token on `PUT`. Every role uses the account's
 * `beep-ci-fleet-boundary` permissions boundary.
 *
 * **Gotchas**
 *
 * The Lambda ZIP must export `index.handler` for the shim and
 * `authorizer.handler` for the token-and-method authorizer.
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
 *   region: "us-east-1",
 *   trustedWriteTokenSsmParameterArn:
 *     "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/cache/trusted-write-token",
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
    const permissionsBoundary = pulumi.interpolate`arn:aws:iam::${accountId}:policy/beep-ci-fleet-boundary`;

    const bucket = new aws.s3.Bucket(
      `${name}-artifacts`,
      {
        bucket: config.bucketName,
        forceDestroy: false,
        region: config.region,
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
        region: config.region,
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
        region: config.region,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );
    const writeLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-write-logs`,
      {
        name: `/aws/lambda/${name}-write`,
        region: config.region,
        retentionInDays: 14,
        tags: defaultTags,
      },
      { parent: this }
    );
    const authorizerLogGroup = new aws.cloudwatch.LogGroup(
      `${name}-authorizer-logs`,
      {
        name: `/aws/lambda/${name}-authorizer`,
        region: config.region,
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
          resources: [config.readOnlyTokenSsmParameterArn, config.trustedWriteTokenSsmParameterArn],
          sid: "ReadCacheTokens",
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

    const commonEnvironment = {
      AUTH_MODE: "none",
      AWS_REGION: config.region,
      STORAGE_PATH: config.bucketName,
      STORAGE_PROVIDER: "s3",
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
        region: config.region,
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
          },
        },
        handler: "index.handler",
        memorySize: 512,
        name: `${name}-write`,
        region: config.region,
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
          },
        },
        handler: "authorizer.handler",
        memorySize: 128,
        name: `${name}-authorizer`,
        region: config.region,
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
        integrationUri: readFunction.arn,
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
        integrationUri: writeFunction.arn,
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

    route("status", "GET /v8/artifacts/status", readIntegration);
    route("get-artifact", "GET /v8/artifacts/{hash}", readIntegration);
    route("head-artifact", "HEAD /v8/artifacts/{hash}", readIntegration);
    route("query-artifact", "POST /v8/artifacts", readIntegration);
    route("events", "POST /v8/artifacts/events", readIntegration);
    route("put-artifact", "PUT /v8/artifacts/{hash}", writeIntegration);

    new aws.apigatewayv2.Stage(
      `${name}-default-stage`,
      { apiId: api.id, autoDeploy: true, name: "$default" },
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
        sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
      },
      { parent: this }
    );

    this.apiEndpoint = api.apiEndpoint;
    this.bucketName = bucket.bucket;
    this.registerOutputs({ apiEndpoint: this.apiEndpoint, bucketName: this.bucketName });
  }
}
