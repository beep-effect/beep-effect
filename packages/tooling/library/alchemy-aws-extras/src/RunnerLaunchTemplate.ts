/**
 * EC2 launch template with the block-device, EBS-optimisation, Spot and tag
 * specification props Alchemy's `AWS.AutoScaling.LaunchTemplate` lacks.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as ec2 from "@distilled.cloud/aws/ec2";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import { createPhysicalName } from "alchemy/PhysicalName";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import { createInternalTags, diffTags, hasTags } from "alchemy/Tags";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { LaunchTemplateUnexpectedResponse } from "./Errors.ts";
import { decodeProps } from "./internal/decodeProps.ts";
import type { ExtrasResource } from "./internal/ExtrasResource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyAwsExtrasId.create("RunnerLaunchTemplate");

/**
 * Resource type string registered by {@link RunnerLaunchTemplate}.
 *
 * @category constants
 * @since 0.0.0
 */
export const RunnerLaunchTemplateType = "BeepAWS.EC2.RunnerLaunchTemplate" as const;

/**
 * EBS volume types a block device mapping may request.
 *
 * **Example** (Read the gp3 literal)
 *
 * ```ts
 * import { EbsVolumeType } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 *
 * console.log(EbsVolumeType.Enum.gp3) // "gp3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EbsVolumeType = LiteralKit(["gp2", "gp3", "io1", "io2", "st1", "sc1", "standard"]).pipe(
  $I.annoteSchema("EbsVolumeType", { description: "EBS volume type of a launch-template block device." })
);

/**
 * Decoded {@link EbsVolumeType}.
 *
 * @category models
 * @since 0.0.0
 */
export type EbsVolumeType = typeof EbsVolumeType.Type;

const PositiveInt = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveInt", { description: "A strictly positive integer." })
);

/**
 * EBS settings of one launch-template block device.
 *
 * **Example** (Decode a gp3 root volume)
 *
 * ```ts
 * import { LaunchTemplateEbs } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const ebs = S.decodeUnknownSync(LaunchTemplateEbs)({ volumeSize: 100, volumeType: "gp3", encrypted: true })
 * console.log(ebs.volumeSize) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaunchTemplateEbs = S.Struct({
  volumeSize: S.optionalKey(PositiveInt),
  volumeType: S.optionalKey(EbsVolumeType),
  iops: S.optionalKey(PositiveInt),
  throughput: S.optionalKey(PositiveInt),
  encrypted: S.optionalKey(S.Boolean),
  kmsKeyId: S.optionalKey(S.NonEmptyString),
  snapshotId: S.optionalKey(S.NonEmptyString),
  deleteOnTermination: S.optionalKey(S.Boolean),
}).pipe($I.annoteSchema("LaunchTemplateEbs", { description: "EBS settings of one launch-template block device." }));

/**
 * Decoded {@link LaunchTemplateEbs}.
 *
 * @category models
 * @since 0.0.0
 */
export type LaunchTemplateEbs = typeof LaunchTemplateEbs.Type;

/**
 * One block device mapping of the launch template.
 *
 * **Example** (Decode an AL2023 root mapping)
 *
 * ```ts
 * import { LaunchTemplateBlockDevice } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const device = S.decodeUnknownSync(LaunchTemplateBlockDevice)({
 *   deviceName: "/dev/xvda",
 *   ebs: { volumeSize: 100, volumeType: "gp3" }
 * })
 * console.log(device.deviceName) // "/dev/xvda"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaunchTemplateBlockDevice = S.Struct({
  deviceName: S.NonEmptyString,
  ebs: LaunchTemplateEbs,
}).pipe($I.annoteSchema("LaunchTemplateBlockDevice", { description: "One EBS block device mapping." }));

/**
 * Decoded {@link LaunchTemplateBlockDevice}.
 *
 * @category models
 * @since 0.0.0
 */
export type LaunchTemplateBlockDevice = typeof LaunchTemplateBlockDevice.Type;

/**
 * Spot request type of a launch template.
 *
 * @category models
 * @since 0.0.0
 */
export const SpotInstanceType = LiteralKit(["one-time", "persistent"]).pipe(
  $I.annoteSchema("SpotInstanceType", { description: "Whether a Spot request is one-time or persistent." })
);

/**
 * Decoded {@link SpotInstanceType}.
 *
 * @category models
 * @since 0.0.0
 */
export type SpotInstanceType = typeof SpotInstanceType.Type;

/**
 * What EC2 does to a Spot instance it reclaims.
 *
 * @category models
 * @since 0.0.0
 */
export const SpotInterruptionBehavior = LiteralKit(["hibernate", "stop", "terminate"]).pipe(
  $I.annoteSchema("SpotInterruptionBehavior", { description: "Behaviour of a Spot instance on interruption." })
);

/**
 * Decoded {@link SpotInterruptionBehavior}.
 *
 * @category models
 * @since 0.0.0
 */
export type SpotInterruptionBehavior = typeof SpotInterruptionBehavior.Type;

/**
 * Spot market options of the launch template.
 *
 * **Example** (Decode one-time Spot options)
 *
 * ```ts
 * import { LaunchTemplateMarketOptions } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const market = S.decodeUnknownSync(LaunchTemplateMarketOptions)({
 *   marketType: "spot",
 *   spotOptions: { spotInstanceType: "one-time", instanceInterruptionBehavior: "terminate" }
 * })
 * console.log(market.marketType) // "spot"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaunchTemplateMarketOptions = S.Struct({
  marketType: S.tag("spot"),
  spotOptions: S.optionalKey(
    S.Struct({
      maxPrice: S.optionalKey(S.NonEmptyString),
      spotInstanceType: S.optionalKey(SpotInstanceType),
      instanceInterruptionBehavior: S.optionalKey(SpotInterruptionBehavior),
    })
  ),
}).pipe(
  $I.annoteSchema("LaunchTemplateMarketOptions", { description: "Spot purchasing options for launched instances." })
);

/**
 * Decoded {@link LaunchTemplateMarketOptions}.
 *
 * @category models
 * @since 0.0.0
 */
export type LaunchTemplateMarketOptions = typeof LaunchTemplateMarketOptions.Type;

/**
 * An `enabled` / `disabled` switch.
 *
 * @category models
 * @since 0.0.0
 */
export const EnabledState = LiteralKit(["enabled", "disabled"]).pipe(
  $I.annoteSchema("EnabledState", { description: "An instance-metadata enabled/disabled switch." })
);

/**
 * Decoded {@link EnabledState}.
 *
 * @category models
 * @since 0.0.0
 */
export type EnabledState = typeof EnabledState.Type;

/**
 * Whether IMDS requires session tokens (IMDSv2).
 *
 * @category models
 * @since 0.0.0
 */
export const HttpTokensState = LiteralKit(["optional", "required"]).pipe(
  $I.annoteSchema("HttpTokensState", { description: "IMDS session-token requirement; required means IMDSv2." })
);

/**
 * Decoded {@link HttpTokensState}.
 *
 * @category models
 * @since 0.0.0
 */
export type HttpTokensState = typeof HttpTokensState.Type;

/**
 * Instance metadata service options of the launch template.
 *
 * **Example** (Decode IMDSv2 with instance tags)
 *
 * ```ts
 * import { LaunchTemplateMetadataOptions } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const imds = S.decodeUnknownSync(LaunchTemplateMetadataOptions)({
 *   httpTokens: "required",
 *   httpPutResponseHopLimit: 1
 * })
 * console.log(imds.httpTokens) // "required"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaunchTemplateMetadataOptions = S.Struct({
  httpEndpoint: S.optionalKey(EnabledState),
  httpTokens: S.optionalKey(HttpTokensState),
  httpPutResponseHopLimit: S.optionalKey(S.Int.check(S.isBetween({ minimum: 1, maximum: 64 }))),
  httpProtocolIpv6: S.optionalKey(EnabledState),
  instanceMetadataTags: S.optionalKey(EnabledState),
}).pipe($I.annoteSchema("LaunchTemplateMetadataOptions", { description: "Instance metadata service (IMDS) options." }));

/**
 * Decoded {@link LaunchTemplateMetadataOptions}.
 *
 * @category models
 * @since 0.0.0
 */
export type LaunchTemplateMetadataOptions = typeof LaunchTemplateMetadataOptions.Type;

/**
 * Resources a launch template may tag at launch.
 *
 * @category models
 * @since 0.0.0
 */
export const LaunchTagResourceType = LiteralKit([
  "instance",
  "volume",
  "network-interface",
  "spot-instances-request",
]).pipe(
  $I.annoteSchema("LaunchTagResourceType", { description: "Resource kind tagged at launch by a tag specification." })
);

/**
 * Decoded {@link LaunchTagResourceType}.
 *
 * @category models
 * @since 0.0.0
 */
export type LaunchTagResourceType = typeof LaunchTagResourceType.Type;

const TagMap = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("TagMap", { description: "AWS tags as a key/value record." })
);

/**
 * Tags applied to resources EC2 creates at launch.
 *
 * **Example** (Tag launched instances)
 *
 * ```ts
 * import { LaunchTagSpecification } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const spec = S.decodeUnknownSync(LaunchTagSpecification)({
 *   resourceType: "instance",
 *   tags: { "beep-ci": "runner" }
 * })
 * console.log(spec.resourceType) // "instance"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LaunchTagSpecification = S.Struct({
  resourceType: LaunchTagResourceType,
  tags: TagMap,
}).pipe($I.annoteSchema("LaunchTagSpecification", { description: "Tags applied to one resource kind at launch." }));

/**
 * Decoded {@link LaunchTagSpecification}.
 *
 * @category models
 * @since 0.0.0
 */
export type LaunchTagSpecification = typeof LaunchTagSpecification.Type;

/**
 * Props of a {@link RunnerLaunchTemplate}.
 *
 * **Details**
 *
 * `imageId` takes an AMI id or an SSM parameter reference in EC2's
 * `resolve:ssm:<parameter>` form (see {@link resolveSsmImageId}); EC2
 * resolves the parameter at each launch. `launchTemplateName` is the
 * identity: changing it replaces the template. Every other prop change
 * publishes a new default version.
 *
 * **Example** (Decode the minimal props)
 *
 * ```ts
 * import { RunnerLaunchTemplateProps } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownSync(RunnerLaunchTemplateProps)({
 *   imageId: "resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64",
 *   ebsOptimized: true
 * })
 * console.log(props.ebsOptimized) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerLaunchTemplateProps = S.Struct({
  launchTemplateName: S.optionalKey(S.NonEmptyString),
  imageId: S.NonEmptyString,
  instanceType: S.optionalKey(S.NonEmptyString),
  instanceProfileArn: S.optionalKey(S.NonEmptyString),
  instanceProfileName: S.optionalKey(S.NonEmptyString),
  securityGroupIds: S.NonEmptyString.pipe(S.Array, S.optionalKey),
  associatePublicIpAddress: S.optionalKey(S.Boolean),
  userData: S.optionalKey(S.String),
  ebsOptimized: S.optionalKey(S.Boolean),
  blockDeviceMappings: LaunchTemplateBlockDevice.pipe(S.Array, S.optionalKey),
  instanceMarketOptions: S.optionalKey(LaunchTemplateMarketOptions),
  metadataOptions: S.optionalKey(LaunchTemplateMetadataOptions),
  tagSpecifications: LaunchTagSpecification.pipe(S.Array, S.optionalKey),
  tags: S.optionalKey(TagMap),
}).pipe(
  $I.annoteSchema("RunnerLaunchTemplateProps", {
    description: "Desired EC2 launch template for self-hosted CI runner instances.",
  })
);

/**
 * Decoded {@link RunnerLaunchTemplateProps}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunnerLaunchTemplateProps = typeof RunnerLaunchTemplateProps.Type;

/**
 * Attributes EC2 reports for the launch template.
 *
 * **Example** (Decode observed attributes)
 *
 * ```ts
 * import { RunnerLaunchTemplateAttributes } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownSync(RunnerLaunchTemplateAttributes)({
 *   launchTemplateId: "lt-0123456789abcdef0",
 *   launchTemplateArn: "arn:aws:ec2:us-east-1:123456789012:launch-template/lt-0123456789abcdef0",
 *   launchTemplateName: "runners",
 *   defaultVersionNumber: 1,
 *   latestVersionNumber: 1,
 *   tags: {}
 * })
 * console.log(attrs.defaultVersionNumber) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerLaunchTemplateAttributes = S.Struct({
  launchTemplateId: S.String,
  launchTemplateArn: S.String,
  launchTemplateName: S.String,
  defaultVersionNumber: S.Finite,
  latestVersionNumber: S.Finite,
  tags: TagMap,
}).pipe(
  $I.annoteSchema("RunnerLaunchTemplateAttributes", { description: "Observed state of the EC2 launch template." })
);

/**
 * Decoded {@link RunnerLaunchTemplateAttributes}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunnerLaunchTemplateAttributes = typeof RunnerLaunchTemplateAttributes.Type;

/**
 * Alchemy resource contract for {@link RunnerLaunchTemplate}.
 *
 * @category resources
 * @since 0.0.0
 */
export interface RunnerLaunchTemplate
  extends Resource<
    typeof RunnerLaunchTemplateType,
    RunnerLaunchTemplateProps,
    RunnerLaunchTemplateAttributes,
    never,
    Providers
  > {}

const RunnerLaunchTemplateResource = Resource<RunnerLaunchTemplate>(RunnerLaunchTemplateType);

/**
 * An EC2 launch template for CI runner instances launched by `CreateFleet`.
 *
 * **Details**
 *
 * Covers what `AWS.AutoScaling.LaunchTemplate` cannot express: block device
 * mappings (gp3 root volume, encryption, IOPS, throughput), `ebsOptimized`,
 * Spot `instanceMarketOptions` and launch `tagSpecifications`, beside IMDS
 * options, an instance profile, security groups, user data and an
 * SSM-resolved AMI. Each update publishes a new version and makes it the
 * default. Ownership is tag-based: `read` brands a same-name template
 * without Alchemy's internal tags `Unowned`, so adopting it needs an explicit
 * adopt policy.
 *
 * **Example** (Declare the runner template)
 *
 * ```ts
 * import { RunnerLaunchTemplate, resolveSsmImageId } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 *
 * const template = RunnerLaunchTemplate("Runners", {
 *   imageId: resolveSsmImageId("/beep-ci/runner-ami-id"),
 *   ebsOptimized: true,
 *   blockDeviceMappings: [
 *     { deviceName: "/dev/xvda", ebs: { volumeSize: 100, volumeType: "gp3", encrypted: true } }
 *   ]
 * })
 * console.log(typeof template) // "object"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const RunnerLaunchTemplate: ExtrasResource<RunnerLaunchTemplate> = RunnerLaunchTemplateResource;

/**
 * Build the `resolve:ssm:` image reference EC2 resolves at each launch.
 *
 * **Example** (Reference an AMI parameter)
 *
 * ```ts
 * import { resolveSsmImageId } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 *
 * console.log(resolveSsmImageId("/beep-ci/runner-ami-id")) // "resolve:ssm:/beep-ci/runner-ami-id"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveSsmImageId = (parameterName: string): string => `resolve:ssm:${parameterName}`;

const notFoundTags = [
  "InvalidLaunchTemplateNameNotFoundException",
  "InvalidLaunchTemplateIdNotFoundException",
  "InvalidLaunchTemplateId.Malformed",
  "InvalidLaunchTemplateId.NotFound",
  "InvalidLaunchTemplateName.NotFoundException",
  "InvalidLaunchTemplateId.NotFoundException",
];

const isLaunchTemplateNotFound = (error: unknown): boolean =>
  P.hasProperty(error, "_tag") && P.isString(error._tag) && A.contains(notFoundTags, error._tag);

const toTagRecord = (tags: ReadonlyArray<ec2.Tag> | undefined): Record<string, string> =>
  R.fromEntries(
    A.flatMap(tags ?? [], (tag) =>
      tag.Key === undefined || tag.Value === undefined ? [] : [[tag.Key, tag.Value] as const]
    )
  );

const toTagList = (tags: Readonly<Record<string, string>>): Array<ec2.Tag> =>
  A.map(R.toEntries(tags), ([Key, Value]) => ({ Key, Value }));

const toEbs = (ebs: LaunchTemplateEbs): ec2.LaunchTemplateEbsBlockDeviceRequest => ({
  ...(ebs.volumeSize === undefined ? {} : { VolumeSize: ebs.volumeSize }),
  ...(ebs.volumeType === undefined ? {} : { VolumeType: ebs.volumeType }),
  ...(ebs.iops === undefined ? {} : { Iops: ebs.iops }),
  ...(ebs.throughput === undefined ? {} : { Throughput: ebs.throughput }),
  ...(ebs.encrypted === undefined ? {} : { Encrypted: ebs.encrypted }),
  ...(ebs.kmsKeyId === undefined ? {} : { KmsKeyId: ebs.kmsKeyId }),
  ...(ebs.snapshotId === undefined ? {} : { SnapshotId: ebs.snapshotId }),
  ...(ebs.deleteOnTermination === undefined ? {} : { DeleteOnTermination: ebs.deleteOnTermination }),
});

const toMetadataOptions = (
  options: LaunchTemplateMetadataOptions
): ec2.LaunchTemplateInstanceMetadataOptionsRequest => ({
  ...(options.httpEndpoint === undefined ? {} : { HttpEndpoint: options.httpEndpoint }),
  ...(options.httpTokens === undefined ? {} : { HttpTokens: options.httpTokens }),
  ...(options.httpPutResponseHopLimit === undefined
    ? {}
    : { HttpPutResponseHopLimit: options.httpPutResponseHopLimit }),
  ...(options.httpProtocolIpv6 === undefined ? {} : { HttpProtocolIpv6: options.httpProtocolIpv6 }),
  ...(options.instanceMetadataTags === undefined ? {} : { InstanceMetadataTags: options.instanceMetadataTags }),
});

const toMarketOptions = (market: LaunchTemplateMarketOptions): ec2.LaunchTemplateInstanceMarketOptionsRequest => ({
  MarketType: market.marketType,
  ...(market.spotOptions === undefined
    ? {}
    : {
        SpotOptions: {
          ...(market.spotOptions.maxPrice === undefined ? {} : { MaxPrice: market.spotOptions.maxPrice }),
          ...(market.spotOptions.spotInstanceType === undefined
            ? {}
            : { SpotInstanceType: market.spotOptions.spotInstanceType }),
          ...(market.spotOptions.instanceInterruptionBehavior === undefined
            ? {}
            : { InstanceInterruptionBehavior: market.spotOptions.instanceInterruptionBehavior }),
        },
      }),
});

const toNetworking = (props: RunnerLaunchTemplateProps): ec2.RequestLaunchTemplateData =>
  props.associatePublicIpAddress === undefined
    ? props.securityGroupIds === undefined
      ? {}
      : { SecurityGroupIds: A.copy(props.securityGroupIds) }
    : {
        NetworkInterfaces: [
          {
            DeviceIndex: 0,
            AssociatePublicIpAddress: props.associatePublicIpAddress,
            DeleteOnTermination: true,
            ...(props.securityGroupIds === undefined ? {} : { Groups: A.copy(props.securityGroupIds) }),
          },
        ],
      };

const toInstanceProfile = (props: RunnerLaunchTemplateProps): ec2.RequestLaunchTemplateData =>
  props.instanceProfileArn !== undefined
    ? { IamInstanceProfile: { Arn: props.instanceProfileArn } }
    : props.instanceProfileName !== undefined
      ? { IamInstanceProfile: { Name: props.instanceProfileName } }
      : {};

/**
 * Translate decoded props into the EC2 `LaunchTemplateData` request shape.
 *
 * **Example** (Inspect the gp3 mapping EC2 receives)
 *
 * ```ts
 * import { toLaunchTemplateData } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 *
 * const data = toLaunchTemplateData({
 *   imageId: "ami-0123456789abcdef0",
 *   blockDeviceMappings: [{ deviceName: "/dev/xvda", ebs: { volumeType: "gp3" } }]
 * })
 * console.log(data.BlockDeviceMappings?.[0]?.Ebs?.VolumeType) // "gp3"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const toLaunchTemplateData = (props: RunnerLaunchTemplateProps): ec2.RequestLaunchTemplateData => ({
  ImageId: props.imageId,
  ...(props.instanceType === undefined ? {} : { InstanceType: props.instanceType }),
  ...(props.ebsOptimized === undefined ? {} : { EbsOptimized: props.ebsOptimized }),
  ...(props.userData === undefined ? {} : { UserData: Base64.encode(props.userData) }),
  ...(props.blockDeviceMappings === undefined
    ? {}
    : {
        BlockDeviceMappings: A.map(props.blockDeviceMappings, (device) => ({
          DeviceName: device.deviceName,
          Ebs: toEbs(device.ebs),
        })),
      }),
  ...(props.instanceMarketOptions === undefined
    ? {}
    : { InstanceMarketOptions: toMarketOptions(props.instanceMarketOptions) }),
  ...(props.metadataOptions === undefined ? {} : { MetadataOptions: toMetadataOptions(props.metadataOptions) }),
  ...(props.tagSpecifications === undefined
    ? {}
    : {
        TagSpecifications: A.map(props.tagSpecifications, (spec) => ({
          ResourceType: spec.resourceType,
          Tags: toTagList(spec.tags),
        })),
      }),
  ...toNetworking(props),
  ...toInstanceProfile(props),
});

/**
 * Provider layer for {@link RunnerLaunchTemplate}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { RunnerLaunchTemplateProvider } from "@beep/alchemy-aws-extras/RunnerLaunchTemplate"
 *
 * const layer = RunnerLaunchTemplateProvider
 * console.log(typeof layer) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const RunnerLaunchTemplateProvider = Provider.effect(
  RunnerLaunchTemplateResource,
  Effect.sync(() => {
    const toName = (id: string, props: { readonly launchTemplateName?: string | undefined } | undefined) =>
      props?.launchTemplateName === undefined
        ? createPhysicalName({ id, maxLength: 128, lowercase: true })
        : Effect.succeed(props.launchTemplateName);

    const describe = (request: ec2.DescribeLaunchTemplatesRequest) =>
      ec2.describeLaunchTemplates(request).pipe(
        Effect.map((result) => A.head(result.LaunchTemplates ?? [])),
        Effect.map((option) => (option._tag === "Some" ? option.value : undefined)),
        Effect.catchIf(isLaunchTemplateNotFound, () => Effect.undefined)
      );

    const describeById = (launchTemplateId: string) => describe({ LaunchTemplateIds: [launchTemplateId] });
    const describeByName = (launchTemplateName: string) => describe({ LaunchTemplateNames: [launchTemplateName] });

    const observe = Effect.fn("RunnerLaunchTemplate.observe")(function* (
      id: string,
      props: { readonly launchTemplateName?: string | undefined } | undefined,
      output: RunnerLaunchTemplateAttributes | undefined
    ) {
      const byId = output === undefined ? undefined : yield* describeById(output.launchTemplateId);
      if (byId !== undefined) return byId;
      const name = yield* toName(id, props);
      return yield* describeByName(name);
    });

    const toAttributes = Effect.fn("RunnerLaunchTemplate.toAttributes")(function* (template: ec2.LaunchTemplate) {
      if (template.LaunchTemplateId === undefined || template.LaunchTemplateName === undefined) {
        return yield* LaunchTemplateUnexpectedResponse.make({
          message: "EC2 returned a launch template without an id or name",
        });
      }
      const env = yield* AWSEnvironment.current;
      return {
        launchTemplateId: template.LaunchTemplateId,
        launchTemplateArn: `arn:aws:ec2:${env.region}:${env.accountId}:launch-template/${template.LaunchTemplateId}`,
        launchTemplateName: template.LaunchTemplateName,
        defaultVersionNumber: template.DefaultVersionNumber ?? 1,
        latestVersionNumber: template.LatestVersionNumber ?? template.DefaultVersionNumber ?? 1,
        tags: toTagRecord(template.Tags),
      } satisfies RunnerLaunchTemplateAttributes;
    });

    const publishVersion = Effect.fn("RunnerLaunchTemplate.publishVersion")(function* (
      launchTemplateId: string,
      props: RunnerLaunchTemplateProps
    ) {
      const created = yield* ec2.createLaunchTemplateVersion({
        LaunchTemplateId: launchTemplateId,
        VersionDescription: "alchemy-update",
        LaunchTemplateData: toLaunchTemplateData(props),
      });
      const versionNumber = created.LaunchTemplateVersion?.VersionNumber;
      if (versionNumber === undefined) {
        return yield* LaunchTemplateUnexpectedResponse.make({
          message: `createLaunchTemplateVersion returned no version for '${launchTemplateId}'`,
        });
      }
      yield* ec2.modifyLaunchTemplate({ LaunchTemplateId: launchTemplateId, DefaultVersion: `${versionNumber}` });
    });

    const syncTags = Effect.fn("RunnerLaunchTemplate.syncTags")(function* (
      launchTemplateId: string,
      observed: Record<string, string>,
      desired: Record<string, string>
    ) {
      const { removed, upsert } = diffTags(observed, desired);
      if (A.isReadonlyArrayNonEmpty(removed)) {
        yield* ec2.deleteTags({ Resources: [launchTemplateId], Tags: A.map(removed, (Key) => ({ Key })) });
      }
      if (A.isReadonlyArrayNonEmpty(upsert)) {
        yield* ec2.createTags({ Resources: [launchTemplateId], Tags: upsert });
      }
    });

    return {
      stables: ["launchTemplateId", "launchTemplateArn", "launchTemplateName"],
      diff: Effect.fn("RunnerLaunchTemplate.diff")(function* ({ id, olds, news }) {
        if (!isResolved(news)) return undefined;
        const oldName = yield* toName(id, olds);
        const newName = yield* toName(id, news as RunnerLaunchTemplateProps);
        return oldName === newName ? undefined : ({ action: "replace" } as const);
      }),
      read: Effect.fn("RunnerLaunchTemplate.read")(function* ({ id, olds, output }) {
        const template = yield* observe(id, olds, output);
        if (template === undefined) return undefined;
        const attrs = yield* toAttributes(template);
        const internalTags = yield* createInternalTags(id);
        return hasTags(internalTags, attrs.tags) ? attrs : Unowned(attrs);
      }),
      list: () =>
        ec2.describeLaunchTemplates.pages({}).pipe(
          Stream.runCollect,
          Effect.flatMap((pages) =>
            Effect.forEach(
              A.flatMap(A.fromIterable(pages), (page) => page.LaunchTemplates ?? []),
              toAttributes
            )
          )
        ),
      reconcile: Effect.fn("RunnerLaunchTemplate.reconcile")(function* ({ id, news, output, session }) {
        const props = yield* decodeProps({ resourceType: RunnerLaunchTemplateType, schema: RunnerLaunchTemplateProps })(
          news
        );
        const launchTemplateName = output?.launchTemplateName ?? (yield* toName(id, props));
        const internalTags = yield* createInternalTags(id);
        const desiredTags = { ...internalTags, ...props.tags };
        const existing = yield* observe(id, props, output);

        if (existing?.LaunchTemplateId === undefined) {
          const created = yield* ec2.createLaunchTemplate({
            LaunchTemplateName: launchTemplateName,
            VersionDescription: "alchemy-create",
            TagSpecifications: [{ ResourceType: "launch-template", Tags: toTagList(desiredTags) }],
            LaunchTemplateData: toLaunchTemplateData(props),
          });
          if (created.LaunchTemplate === undefined) {
            return yield* LaunchTemplateUnexpectedResponse.make({
              message: `createLaunchTemplate returned no launch template for '${launchTemplateName}'`,
            });
          }
          const attrs = yield* toAttributes(created.LaunchTemplate);
          yield* session.note(attrs.launchTemplateId);
          return attrs;
        }

        const launchTemplateId = existing.LaunchTemplateId;
        yield* publishVersion(launchTemplateId, props);
        yield* syncTags(launchTemplateId, toTagRecord(existing.Tags), desiredTags);
        const refreshed = yield* describeById(launchTemplateId);
        if (refreshed === undefined) {
          return yield* LaunchTemplateUnexpectedResponse.make({
            message: `launch template '${launchTemplateName}' was not readable after reconcile`,
          });
        }
        const attrs = yield* toAttributes(refreshed);
        yield* session.note(attrs.launchTemplateId);
        return attrs;
      }),
      delete: Effect.fn("RunnerLaunchTemplate.delete")(function* ({ output }) {
        yield* ec2
          .deleteLaunchTemplate({ LaunchTemplateId: output.launchTemplateId })
          .pipe(Effect.catchIf(isLaunchTemplateNotFound, () => Effect.void));
      }),
    };
  })
);
