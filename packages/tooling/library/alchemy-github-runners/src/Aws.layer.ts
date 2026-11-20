/**
 * Live AWS layers over `@distilled.cloud/aws`: EC2 fleet, SSM Parameter Store,
 * SQS and the S3 runner-binaries mirror.
 *
 * **Details**
 *
 * Request shapes ported from `lambdas/functions/control-plane/src/aws/ec2-runners.ts`
 * and `lambdas/libs/aws-ssm-util` of github-aws-runners/terraform-aws-github-runner
 * v7.10.1 (MIT); see the package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Category from "@distilled.cloud/aws/Category";
import * as ec2 from "@distilled.cloud/aws/ec2";
import * as s3 from "@distilled.cloud/aws/s3";
import * as sqs from "@distilled.cloud/aws/sqs";
import * as ssm from "@distilled.cloud/aws/ssm";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { FleetLaunchResult, TaggedInstance } from "./Ec2Fleet.models.ts";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { $AlchemyGithubRunnersId } from "./internal/AlchemyGithubRunnersId.ts";
import { MessageQueue } from "./MessageQueue.service.ts";
import { ReleaseAsset, RunnerBinaries } from "./RunnerBinaries.service.ts";
import { AwsApiError, AwsThrottlingCode, GitHubApiError } from "./RunnerFleet.errors.ts";
import { RunnerInstance, RunnerTag, runnerApplicationTagValue } from "./RunnerInstance.models.ts";
import { ParameterEntry, SsmStore } from "./SsmStore.service.ts";
import type { Credentials as AwsCredentials } from "@distilled.cloud/aws/Credentials";
import type * as Context from "effect/Context";
import type { FleetLaunchRequest } from "./Ec2Fleet.models.ts";
import type { AwsFault } from "./RunnerFleet.errors.ts";
import type { RunnerFilter } from "./RunnerInstance.models.ts";

const $I = $AlchemyGithubRunnersId.create("Aws.layer");

type AwsServices = AwsCredentials | HttpClient.HttpClient;

const retryableTags = [
  "EC2ThrottledException",
  "InternalError",
  "InternalServerError",
  "RequestLimitExceeded",
  "RequestTimeout",
  "RequestTimeoutException",
  "ServiceUnavailable",
  "Throttling",
  "ThrottlingException",
  "SlowDown",
  "HttpClientError",
  "TooManyUpdates",
];

// SSM answers these with HTTP 400 and a resend of the same request fails the same way, though distilled files
// `ParameterMaxVersionLimitExceeded` under its throttling category.
const clientTags = ["ParameterMaxVersionLimitExceeded"];

const clientCategories: ReadonlyArray<(error: unknown) => boolean> = [
  Category.isBadRequestError,
  Category.isAuthError,
  Category.isNotFoundError,
  Category.isConflictError,
  Category.isQuotaError,
  Category.isAlreadyExistsError,
  Category.isConfigurationError,
  Category.isDependencyViolationError,
];

type SdkFailure = {
  readonly _tag: string;
  readonly message?: unknown;
  readonly status?: unknown;
  readonly code?: unknown;
};

// The SDK's unknown-error class carries the HTTP status; its declared error classes carry a category instead.
const statusOf = (error: SdkFailure): O.Option<number> =>
  P.hasProperty(error, "status") && P.isNumber(error.status) && Number.isInteger(error.status)
    ? O.some(error.status)
    : O.none();

const isTransientStatus = (status: number) => status === 429 || status >= 500;
const isClientStatus = (status: number) => status >= 400 && status < 500 && status !== 429;

const isThrottlingCode = S.is(AwsThrottlingCode);

// The wire code of the SDK's unknown-error class, else the declared class's tag.
const codeOf = (error: SdkFailure): string =>
  P.hasProperty(error, "code") && P.isString(error.code) ? error.code : error._tag;

// AWS throttles with HTTP 400, so a throttling code, tag or category is read before any status rule.
const isThrottled = (error: SdkFailure): boolean =>
  isThrottlingCode(error._tag) || isThrottlingCode(codeOf(error)) || Category.isThrottling(error);

const faultRules: ReadonlyArray<readonly [(error: SdkFailure, status: O.Option<number>) => boolean, AwsFault]> = [
  [(error) => A.contains(clientTags, error._tag), "client"],
  [isThrottled, "transient"],
  [(_error, status) => O.exists(status, isTransientStatus), "transient"],
  [(error) => A.contains(retryableTags, error._tag) || Category.isTransientError(error), "transient"],
  [(_error, status) => O.exists(status, isClientStatus), "client"],
  [(error) => A.some(clientCategories, (isCategory) => isCategory(error)), "client"],
];

const faultOf = (error: SdkFailure, status: O.Option<number>): AwsFault =>
  O.getOrElse(
    O.map(
      A.findFirst(faultRules, ([matches]) => matches(error, status)),
      ([, fault]) => fault
    ),
    (): AwsFault => "unknown"
  );

/**
 * Maps a distilled AWS SDK error to the fleet's {@link AwsApiError}.
 *
 * **Details**
 *
 * `code` is the wire code of the SDK's unknown-error class, else the
 * declared class's tag; `status` is the HTTP status only that class carries.
 * `fault` reads, in order: a resend-proof client code
 * (`ParameterMaxVersionLimitExceeded`), a throttling code, tag or category
 * (AWS throttles with HTTP 400, so this outranks the status), a 429 or 5xx, a
 * transient category, a 4xx, then a client category; otherwise `unknown`.
 *
 * **Example** (A throttled write answered with 400)
 *
 * ```ts
 * import { toAwsApiError } from "@beep/alchemy-github-runners/Aws.layer"
 *
 * const error = toAwsApiError({ service: "ssm", operation: "putParameter" })({
 *   _tag: "UnknownAwsError",
 *   status: 400,
 *   code: "ThrottlingException",
 *   message: "Rate exceeded",
 * })
 * console.log(error.fault) // "transient"
 * ```
 *
 * @param call - The service and operation that failed.
 * @returns A mapper from the SDK error to {@link AwsApiError}.
 * @category utilities
 * @since 0.0.0
 */
export const toAwsApiError =
  ({ service, operation }: { readonly service: string; readonly operation: string }) =>
  (error: SdkFailure): AwsApiError => {
    const status = statusOf(error);
    return AwsApiError.make({
      service,
      operation,
      code: O.some(codeOf(error)),
      retryable: A.contains(retryableTags, error._tag) || isThrottlingCode(codeOf(error)),
      status,
      fault: faultOf(error, status),
      message: P.isString(error.message) ? error.message : error._tag,
    });
  };

const tagList = (tags: Readonly<Record<string, string>>) =>
  A.map(R.toEntries(tags), ([Key, Value]) => ({ Key, Value }));

/**
 * The EC2 `CreateFleet` request a {@link FleetLaunchRequest} becomes.
 *
 * **Details**
 *
 * `Type: "instant"` makes the call synchronous and fire-and-forget: EC2
 * launches what it can and returns the instance ids and per-pool errors, and
 * keeps no fleet to maintain. Tags go on the instance, its volumes and the
 * fleet record.
 *
 * **Example** (Inspect the wire request)
 *
 * ```ts
 * import { toCreateFleetRequest } from "@beep/alchemy-github-runners/Aws.layer"
 * import { FleetLaunchRequest, FleetOverride } from "@beep/alchemy-github-runners/Ec2Fleet.models"
 * import { LaunchTemplateRef } from "@beep/alchemy-github-runners/RunnerRuntime.models"
 * import * as O from "effect/Option"
 *
 * const wire = toCreateFleetRequest(
 *   FleetLaunchRequest.make({
 *     launchTemplate: LaunchTemplateRef.make({ launchTemplateId: "lt-1", version: "$Default" }),
 *     overrides: [FleetOverride.make({ subnetId: "subnet-1", instanceType: "m7i.4xlarge", imageId: O.none(), priority: O.none() })],
 *     capacityType: "spot",
 *     allocationStrategy: "capacity-optimized",
 *     targetCapacity: 1,
 *     tags: {},
 *   })
 * )
 * console.log(wire.Type) // "instant"
 * ```
 *
 * @param request - The launch request.
 * @returns The distilled `CreateFleet` input.
 * @category layers
 * @since 0.0.0
 */
export const toCreateFleetRequest = (request: FleetLaunchRequest): ec2.CreateFleetRequest => {
  const tags = tagList(request.tags);
  return {
    LaunchTemplateConfigs: [
      {
        LaunchTemplateSpecification: {
          LaunchTemplateId: request.launchTemplate.launchTemplateId,
          Version: request.launchTemplate.version,
        },
        Overrides: A.map(request.overrides, (override) => ({
          SubnetId: override.subnetId,
          InstanceType: override.instanceType,
          ...O.getOrElse(
            O.map(override.imageId, (ImageId) => ({ ImageId })),
            () => ({})
          ),
          ...O.getOrElse(
            O.map(override.priority, (Priority) => ({ Priority })),
            () => ({})
          ),
        })),
      },
    ],
    ...(request.capacityType === "spot"
      ? { SpotOptions: { AllocationStrategy: request.allocationStrategy } }
      : { OnDemandOptions: { AllocationStrategy: request.allocationStrategy } }),
    TargetCapacitySpecification: {
      TotalTargetCapacity: request.targetCapacity,
      DefaultTargetCapacityType: request.capacityType,
    },
    TagSpecifications: [
      { ResourceType: "instance", Tags: tags },
      { ResourceType: "volume", Tags: tags },
      { ResourceType: "fleet", Tags: tags },
    ],
    Type: "instant",
  };
};

const runnerFilters = (filter: RunnerFilter) =>
  A.getSomes([
    O.some({ Name: "instance-state-name", Values: A.copy(filter.states) }),
    O.some({ Name: `tag:${RunnerTag.application}`, Values: [runnerApplicationTagValue] }),
    O.map(filter.environment, (value) => ({ Name: `tag:${RunnerTag.environment}`, Values: [value] })),
    O.map(filter.type, (value) => ({ Name: `tag:${RunnerTag.type}`, Values: [value] })),
    O.map(filter.owner, (value) => ({ Name: `tag:${RunnerTag.owner}`, Values: [value] })),
    filter.orphan ? O.some({ Name: `tag:${RunnerTag.orphan}`, Values: ["true"] }) : O.none(),
  ]);

const tagsOf = (instance: ec2.Instance): Readonly<Record<string, string>> =>
  R.fromEntries(
    A.getSomes(
      A.map(instance.Tags ?? [], (tag) =>
        tag.Key !== undefined && tag.Value !== undefined ? O.some([tag.Key, tag.Value] as const) : O.none()
      )
    )
  );

const toRunnerInstance = (instance: ec2.Instance): O.Option<RunnerInstance> =>
  O.map(O.fromUndefinedOr(instance.InstanceId), (instanceId) => {
    const tags = tagsOf(instance);
    const tag = (key: string) => O.fromUndefinedOr(tags[key]);
    return RunnerInstance.make({
      instanceId,
      launchTime: O.map(O.fromUndefinedOr(instance.LaunchTime), (date) => date.getTime()),
      owner: tag(RunnerTag.owner),
      type: tag(RunnerTag.type),
      githubRunnerId: tag(RunnerTag.githubRunnerId),
      orphan: O.contains(tag(RunnerTag.orphan), "true"),
      bypassRemoval: O.contains(tag(RunnerTag.bypassRemoval), "true"),
    });
  });

const awsCall =
  (services: Context.Context<AwsServices>, service: string, operation: string) =>
  <A, E extends { readonly _tag: string; readonly message?: unknown }>(
    call: Effect.Effect<A, E, AwsServices>
  ): Effect.Effect<A, AwsApiError> =>
    call.pipe(Effect.provideContext(services), Effect.mapError(toAwsApiError({ service, operation })));

/**
 * Live {@link Ec2Fleet} over distilled EC2.
 *
 * **Example** (Provide credentials and HTTP at the Lambda boundary)
 *
 * ```ts
 * import { ec2FleetLive } from "@beep/alchemy-github-runners/Aws.layer"
 *
 * console.log(ec2FleetLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ec2FleetLive: Layer.Layer<Ec2Fleet, never, AwsServices> = Layer.effect(
  Ec2Fleet,
  Effect.gen(function* () {
    const services = yield* Effect.context<AwsServices>();
    return Ec2Fleet.of({
      createFleet: Effect.fn("Ec2Fleet.createFleet")(function* (request) {
        const result = yield* awsCall(services, "ec2", "createFleet")(ec2.createFleet(toCreateFleetRequest(request)));
        return FleetLaunchResult.make({
          instanceIds: A.flatMap(result.Instances ?? [], (instance) => instance.InstanceIds ?? []),
          errorCodes: A.getSomes(A.map(result.Errors ?? [], (error) => O.fromUndefinedOr(error.ErrorCode))),
        });
      }),
      listRunners: Effect.fn("Ec2Fleet.listRunners")(function* (filter) {
        const reservations = yield* awsCall(
          services,
          "ec2",
          "describeInstances"
        )(ec2.describeInstances.items({ Filters: runnerFilters(filter) }).pipe(Stream.runCollect));
        return A.getSomes(
          A.map(
            A.flatMap(A.fromIterable(reservations), (reservation) => reservation.Instances ?? []),
            toRunnerInstance
          )
        );
      }),
      describeInstances: Effect.fn("Ec2Fleet.describeInstances")(function* (instanceIds) {
        const result = yield* awsCall(
          services,
          "ec2",
          "describeInstances"
        )(
          ec2
            .describeInstances({ InstanceIds: A.copy(instanceIds) })
            .pipe(Effect.catchTag("InvalidInstanceID.NotFound", () => Effect.succeed({ Reservations: [] })))
        );
        return A.getSomes(
          A.map(
            A.flatMap(result.Reservations ?? [], (reservation) => reservation.Instances ?? []),
            (instance) =>
              O.map(O.fromUndefinedOr(instance.InstanceId), (instanceId) =>
                TaggedInstance.make({ instanceId, tags: tagsOf(instance) })
              )
          )
        );
      }),
      terminate: Effect.fn("Ec2Fleet.terminate")(function* (instanceId) {
        yield* awsCall(services, "ec2", "terminateInstances")(ec2.terminateInstances({ InstanceIds: [instanceId] }));
      }),
      tag: Effect.fn("Ec2Fleet.tag")(function* (instanceId, tags) {
        yield* awsCall(services, "ec2", "createTags")(ec2.createTags({ Resources: [instanceId], Tags: tagList(tags) }));
      }),
      untag: Effect.fn("Ec2Fleet.untag")(function* (instanceId, keys) {
        yield* awsCall(
          services,
          "ec2",
          "deleteTags"
        )(ec2.deleteTags({ Resources: [instanceId], Tags: A.map(keys, (Key) => ({ Key })) }));
      }),
    });
  })
);

/**
 * Live {@link SsmStore} over distilled SSM.
 *
 * **Details**
 *
 * SSM refuses `Tags` together with `Overwrite`, so a tagged put creates and an
 * untagged put overwrites, as upstream does. Every put names its tier: the
 * Standard tier's 4 KB value limit is too small for a JIT runner config.
 *
 * **Example** (The layer)
 *
 * ```ts
 * import { ssmStoreLive } from "@beep/alchemy-github-runners/Aws.layer"
 *
 * console.log(ssmStoreLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ssmStoreLive: Layer.Layer<SsmStore, never, AwsServices> = Layer.effect(
  SsmStore,
  Effect.gen(function* () {
    const services = yield* Effect.context<AwsServices>();
    return SsmStore.of({
      get: Effect.fn("SsmStore.get")(function* (name) {
        const result = yield* awsCall(
          services,
          "ssm",
          "getParameter"
        )(
          ssm.getParameter({ Name: name, WithDecryption: true }).pipe(
            Effect.map((response) => O.fromUndefinedOr(response.Parameter?.Value)),
            Effect.catchTag("ParameterNotFound", () => Effect.succeedNone)
          )
        );
        return O.map(result, (value) => (Redacted.isRedacted(value) ? value : Redacted.make(value)));
      }),
      put: Effect.fn("SsmStore.put")(function* (input) {
        const tags = tagList(input.tags);
        yield* awsCall(
          services,
          "ssm",
          "putParameter"
        )(
          ssm.putParameter({
            Name: input.name,
            Value: input.value,
            Type: input.secure ? "SecureString" : "String",
            Tier: input.tier,
            ...(A.isReadonlyArrayNonEmpty(tags) ? { Tags: tags } : { Overwrite: true }),
          })
        );
      }),
      delete: Effect.fn("SsmStore.delete")(function* (name) {
        yield* awsCall(
          services,
          "ssm",
          "deleteParameter"
        )(ssm.deleteParameter({ Name: name }).pipe(Effect.catchTag("ParameterNotFound", () => Effect.void)));
      }),
      listByPath: Effect.fn("SsmStore.listByPath")(function* (path) {
        const pages = yield* awsCall(
          services,
          "ssm",
          "getParametersByPath"
        )(ssm.getParametersByPath.pages({ Path: path, Recursive: true }).pipe(Stream.runCollect));
        return A.getSomes(
          A.map(
            A.flatMap(A.fromIterable(pages), (page) => page.Parameters ?? []),
            (parameter) =>
              O.map(O.fromUndefinedOr(parameter.Name), (name) =>
                ParameterEntry.make({
                  name,
                  lastModified: O.map(O.fromUndefinedOr(parameter.LastModifiedDate), (date) => date.getTime()),
                })
              )
          )
        );
      }),
    });
  })
);

/**
 * Live {@link MessageQueue} over distilled SQS.
 *
 * **Example** (The layer)
 *
 * ```ts
 * import { messageQueueLive } from "@beep/alchemy-github-runners/Aws.layer"
 *
 * console.log(messageQueueLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const messageQueueLive: Layer.Layer<MessageQueue, never, AwsServices> = Layer.effect(
  MessageQueue,
  Effect.gen(function* () {
    const services = yield* Effect.context<AwsServices>();
    return MessageQueue.of({
      send: Effect.fn("MessageQueue.send")(function* (input) {
        yield* awsCall(
          services,
          "sqs",
          "sendMessage"
        )(
          sqs.sendMessage({
            QueueUrl: input.queueUrl,
            MessageBody: input.body,
            ...O.getOrElse(
              O.map(input.delaySeconds, (DelaySeconds) => ({ DelaySeconds })),
              () => ({})
            ),
          })
        );
      }),
    });
  })
);

const LatestRelease = S.Struct({
  tag_name: S.String,
  assets: S.Array(S.Struct({ name: S.String, browser_download_url: S.String })),
}).pipe(
  $I.annoteSchema("LatestRelease", { description: "The parts of GitHub's latest-release response the syncer reads." })
);

const mirrorPartSize = 16 * 1024 * 1024;

const AssetContentLength = S.NumberFromString.check(S.isInt(), S.isGreaterThan(0)).pipe(
  $I.annoteSchema("AssetContentLength", { description: "The positive byte length a release-asset download declares." })
);

interface PendingBytes {
  readonly chunks: ReadonlyArray<Uint8Array>;
  readonly size: number;
}

const noPendingBytes: PendingBytes = { chunks: [], size: 0 };

const joinBytes = ({ chunks, size }: PendingBytes): Uint8Array => {
  const out = new Uint8Array(size);
  A.reduce(chunks, 0, (offset, chunk) => {
    out.set(chunk, offset);
    return offset + chunk.byteLength;
  });
  return out;
};

// Regroups download chunks into parts of exactly `partSize` bytes; the remainder waits for more.
const splitParts =
  (partSize: number) =>
  (pending: PendingBytes, chunk: Uint8Array): readonly [PendingBytes, ReadonlyArray<Uint8Array>] => {
    const next: PendingBytes = { chunks: A.append(pending.chunks, chunk), size: pending.size + chunk.byteLength };
    if (next.size < partSize) {
      return [next, []];
    }
    const bytes = joinBytes(next);
    const count = Math.floor(next.size / partSize);
    const rest = bytes.slice(count * partSize);
    return [
      rest.byteLength === 0 ? noPendingBytes : { chunks: [rest], size: rest.byteLength },
      A.makeBy(count, (index) => bytes.subarray(index * partSize, (index + 1) * partSize)),
    ];
  };

const flushParts = (pending: PendingBytes): ReadonlyArray<Uint8Array> =>
  pending.size === 0 ? [] : [joinBytes(pending)];

interface UploadedParts {
  readonly bytes: number;
  readonly parts: ReadonlyArray<{ readonly ETag: string; readonly PartNumber: number }>;
}

/**
 * Live {@link RunnerBinaries}: the public GitHub releases API for the asset,
 * distilled S3 for the mirror.
 *
 * **Details**
 *
 * The mirror streams the download into an S3 multipart upload, one bounded
 * 16 MiB part buffer at a time, each part a fixed-length body. A streamed
 * `PutObject` cannot work over `FetchHttpClient`: it drops `Content-Length`
 * and sends the stream `Transfer-Encoding: chunked`, which S3 rejects with
 * 501 NotImplemented. A download without a positive `Content-Length` fails
 * with {@link GitHubApiError} before anything is written, and a download that
 * ends short of it aborts the upload.
 *
 * **Example** (The layer)
 *
 * ```ts
 * import { runnerBinariesLive } from "@beep/alchemy-github-runners/Aws.layer"
 *
 * console.log(runnerBinariesLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const runnerBinariesLive: Layer.Layer<RunnerBinaries, never, AwsServices> = Layer.effect(
  RunnerBinaries,
  Effect.gen(function* () {
    const services = yield* Effect.context<AwsServices>();
    const http = yield* HttpClient.HttpClient;
    const githubError = (operation: string) => (error: { readonly message?: unknown }) =>
      GitHubApiError.make({ operation, message: P.isString(error.message) ? error.message : operation });
    return RunnerBinaries.of({
      latestAsset: Effect.fn("RunnerBinaries.latestAsset")(function* (target) {
        const release = yield* http
          .execute(
            HttpClientRequest.get("https://api.github.com/repos/actions/runner/releases/latest").pipe(
              HttpClientRequest.setHeaders({
                accept: "application/vnd.github+json",
                "user-agent": "beep-runner-syncer",
              })
            )
          )
          .pipe(
            Effect.flatMap(HttpClientResponse.filterStatusOk),
            Effect.flatMap(HttpClientResponse.schemaBodyJson(LatestRelease)),
            Effect.mapError(githubError("getLatestRelease"))
          );
        const version = Str.replace(/^v/u, "")(release.tag_name);
        const marker = `actions-runner-${target.os}-${target.architecture}-${version}.`;
        const matching = A.filter(release.assets, (asset) => Str.includes(marker)(asset.name));
        return O.map(
          O.filter(A.head(matching), () => matching.length === 1),
          (asset) => ReleaseAsset.make({ name: asset.name, downloadUrl: asset.browser_download_url })
        );
      }),
      cachedName: Effect.fn("RunnerBinaries.cachedName")(function* (object) {
        const tagging = yield* awsCall(
          services,
          "s3",
          "getObjectTagging"
        )(s3.getObjectTagging({ Bucket: object.bucket, Key: object.key }).pipe(Effect.option));
        return O.flatMap(tagging, (output) =>
          O.flatMap(
            A.findFirst(output.TagSet ?? [], (tag) => tag.Key === "name"),
            (tag) => O.fromUndefinedOr(tag.Value)
          )
        );
      }),
      mirror: Effect.fn("RunnerBinaries.mirror")(function* (input) {
        const downloadError = githubError("downloadAsset");
        const response = yield* http
          .execute(HttpClientRequest.get(input.asset.downloadUrl))
          .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk), Effect.mapError(downloadError));
        const contentLength = yield* S.decodeUnknownEffect(AssetContentLength)(response.headers["content-length"]).pipe(
          Effect.mapError(() =>
            GitHubApiError.make({
              operation: "downloadAsset",
              message: `${input.asset.name}: the download has no positive content-length; refusing an upload of unknown length`,
            })
          )
        );
        const object = { Bucket: input.bucket, Key: input.key };
        const created = yield* awsCall(
          services,
          "s3",
          "createMultipartUpload"
        )(s3.createMultipartUpload({ ...object, Tagging: `name=${input.asset.name}` }));
        const UploadId = yield* Effect.fromOption(O.fromUndefinedOr(created.UploadId)).pipe(
          Effect.mapError(() =>
            AwsApiError.make({ service: "s3", operation: "createMultipartUpload", message: "no UploadId returned" })
          )
        );
        const uploadPart = (uploaded: UploadedParts, Body: Uint8Array) => {
          const PartNumber = uploaded.parts.length + 1;
          return awsCall(
            services,
            "s3",
            "uploadPart"
          )(s3.uploadPart({ ...object, UploadId, PartNumber, Body })).pipe(
            Effect.flatMap((output) =>
              Effect.fromOption(O.fromUndefinedOr(output.ETag)).pipe(
                Effect.mapError(() =>
                  AwsApiError.make({
                    service: "s3",
                    operation: "uploadPart",
                    message: `part ${PartNumber} has no ETag`,
                  })
                )
              )
            ),
            Effect.map(
              (ETag): UploadedParts => ({
                parts: A.append(uploaded.parts, { ETag, PartNumber }),
                bytes: uploaded.bytes + Body.byteLength,
              })
            )
          );
        };
        yield* Effect.gen(function* () {
          const uploaded = yield* response.stream.pipe(
            Stream.mapError(downloadError),
            Stream.mapAccum(() => noPendingBytes, splitParts(mirrorPartSize), { onHalt: flushParts }),
            Stream.runFoldEffect((): UploadedParts => ({ parts: [], bytes: 0 }), uploadPart)
          );
          if (uploaded.bytes !== contentLength) {
            return yield* GitHubApiError.make({
              operation: "downloadAsset",
              message: `${input.asset.name}: downloaded ${uploaded.bytes} of ${contentLength} bytes`,
            });
          }
          yield* awsCall(
            services,
            "s3",
            "completeMultipartUpload"
          )(s3.completeMultipartUpload({ ...object, UploadId, MultipartUpload: { Parts: A.copy(uploaded.parts) } }));
        }).pipe(
          Effect.onError(() =>
            awsCall(
              services,
              "s3",
              "abortMultipartUpload"
            )(s3.abortMultipartUpload({ ...object, UploadId })).pipe(Effect.ignore)
          )
        );
      }),
    });
  })
);
