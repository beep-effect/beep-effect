/**
 * Schema models for runner image baking.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Runners/Runners.schemas");

/**
 * Public AL2023 parameter shared with the CI fleet controller.
 *
 * **Example** (Inspect the public base AMI parameter)
 *
 * ```ts
 * import { DEFAULT_RUNNER_BASE_AMI_PARAMETER } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(DEFAULT_RUNNER_BASE_AMI_PARAMETER)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_RUNNER_BASE_AMI_PARAMETER =
  "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64";

/**
 * SSM parameter through which the controller publishes the active runner image.
 *
 * **Example** (Inspect the runner AMI pin parameter)
 *
 * ```ts
 * import { RUNNER_AMI_PIN_PARAMETER } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(RUNNER_AMI_PIN_PARAMETER)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RUNNER_AMI_PIN_PARAMETER = "/beep-ci/controller/runner-ami-id";

/**
 * Execution modes accepted by `runners bake`.
 *
 * **Example** (Check a bake mode)
 *
 * ```ts
 * import { BakeMode } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(BakeMode.is.plan("plan")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BakeMode = LiteralKit(["bake", "check", "plan"]).pipe(
  $I.annoteSchema("BakeMode", { description: "Planning, freshness-check, or image-creation runner bake mode." })
);

/**
 * Runtime type for {@link BakeMode}.
 *
 * **Example** (Use a bake mode type)
 *
 * ```ts
 * import type { BakeMode } from "@beep/repo-cli/commands/Runners"
 *
 * const mode: BakeMode = "plan"
 * console.log(mode)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BakeMode = typeof BakeMode.Type;

const defaultBaseAmiParameter = S.NonEmptyString.pipe(
  S.withConstructorDefault(Effect.succeed(DEFAULT_RUNNER_BASE_AMI_PARAMETER)),
  S.withDecodingDefault(Effect.succeed(DEFAULT_RUNNER_BASE_AMI_PARAMETER))
);
const defaultInstanceType = S.NonEmptyString.pipe(
  S.withConstructorDefault(Effect.succeed("r7a.2xlarge")),
  S.withDecodingDefault(Effect.succeed("r7a.2xlarge"))
);
const defaultTags = S.Record(S.String, S.String).pipe(
  S.withConstructorDefault(Effect.succeed({})),
  S.withDecodingDefault(Effect.succeed({}))
);

/**
 * Fully resolved operator configuration for one AMI bake.
 *
 * **Example** (Construct bake configuration)
 *
 * ```ts
 * import { BakeConfig } from "@beep/repo-cli/commands/Runners"
 * import { O } from "@beep/utils"
 *
 * const config = BakeConfig.make({
 *   region: "us-east-1",
 *   subnetId: "subnet-0123456789abcdef0",
 *   securityGroupId: "sg-0123456789abcdef0",
 *   instanceProfile: O.none(),
 *   bakeTimestamp: 1786640400000,
 * })
 * console.log(config.instanceType) // "r7a.2xlarge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BakeConfig extends S.Class<BakeConfig>($I`BakeConfig`)(
  {
    region: S.NonEmptyString,
    subnetId: S.NonEmptyString,
    securityGroupId: S.NonEmptyString,
    // The launcher's guardrails DENY RunInstances whenever an instance
    // profile is present (bake guests get no AWS identity); the console-marker
    // driver needs no in-guest AWS calls, so the profile is opt-in only.
    instanceProfile: S.OptionFromOptionalKey(S.NonEmptyString),
    bakeTimestamp: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    baseAmiSsmParameter: defaultBaseAmiParameter,
    instanceType: defaultInstanceType,
    tags: defaultTags,
  },
  $I.annote("BakeConfig", {
    description: "Resolved AWS placement and tagging configuration for a temporary runner AMI bake instance.",
  })
) {}

/**
 * Durable report emitted after a successful bake.
 *
 * **Example** (Construct a bake report)
 *
 * ```ts
 * import { BakeReport } from "@beep/repo-cli/commands/Runners"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const report = BakeReport.make({
 *   amiId: "ami-0123456789abcdef0",
 *   lockfileSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   bunArchiveSha256: Sha256Hex.make("951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f"),
 *   bunVersion: "1.2.20",
 *   baseAmiId: "ami-0fedcba9876543210",
 *   priorPin: O.none(),
 *   pulumiPinCommand: "pulumi config set ciFleetController:amiId ami-0123456789abcdef0 --stack production",
 *   startedAt: "2026-08-13T12:00:00.000Z",
 *   completedAt: "2026-08-13T12:10:00.000Z",
 * })
 * console.log(report.amiId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BakeReport extends S.Class<BakeReport>($I`BakeReport`)(
  {
    amiId: S.NonEmptyString,
    lockfileSha256: Sha256Hex,
    bunArchiveSha256: Sha256Hex,
    bunVersion: S.NonEmptyString,
    baseAmiId: S.NonEmptyString,
    priorPin: S.OptionFromOptionalKey(S.NonEmptyString),
    pulumiPinCommand: S.NonEmptyString,
    startedAt: S.NonEmptyString,
    completedAt: S.NonEmptyString,
  },
  $I.annote("BakeReport", {
    description: "Machine-readable provenance and activation recipe for a successfully baked runner AMI.",
  })
) {}

/**
 * JSON-string codec used by both the report writer and report readers.
 *
 * **Example** (Inspect the bake report codec)
 *
 * ```ts
 * import { BakeReportJson } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof BakeReportJson.encode)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BakeReportJson = JsonStringCodec(BakeReport);

/**
 * One subprocess invocation shown by `bake --plan`.
 *
 * **Example** (Construct a bake plan step)
 *
 * ```ts
 * import { BakePlanStep } from "@beep/repo-cli/commands/Runners"
 *
 * const step = BakePlanStep.make({ name: "resolve-base-ami", argv: ["aws", "ssm", "get-parameter"] })
 * console.log(step.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BakePlanStep extends S.Class<BakePlanStep>($I`BakePlanStep`)(
  {
    name: S.NonEmptyString,
    argv: S.Array(S.String),
  },
  $I.annote("BakePlanStep", { description: "Named argv-only operation in the runner bake plan." })
) {}

/**
 * AWS-free plan rendered before an operator supplies placement values.
 *
 * **Example** (Inspect required inputs)
 *
 * ```ts
 * import { BakePlan } from "@beep/repo-cli/commands/Runners"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const plan = BakePlan.make({
 *   lockfileSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   bunArchiveSha256: Sha256Hex.make("951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f"),
 *   bunVersion: "1.2.20",
 *   gitRevision: "0123456789abcdef0123456789abcdef01234567",
 *   requiredFlags: ["--region"],
 *   invariants: ["beep-ci=runner"],
 *   steps: [],
 * })
 * console.log(plan.steps.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BakePlan extends S.Class<BakePlan>($I`BakePlan`)(
  {
    lockfileSha256: Sha256Hex,
    bunArchiveSha256: Sha256Hex,
    bunVersion: S.NonEmptyString,
    gitRevision: S.NonEmptyString,
    requiredFlags: S.Array(S.NonEmptyString),
    invariants: S.Array(S.NonEmptyString),
    steps: S.Array(BakePlanStep),
  },
  $I.annote("BakePlan", { description: "AWS-free execution plan for the runner AMI bake workflow." })
) {}

/**
 * JSON-string codec for `bake --plan --json`.
 *
 * **Example** (Inspect the bake plan codec)
 *
 * ```ts
 * import { BakePlanJson } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof BakePlanJson.encode)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BakePlanJson = JsonStringCodec(BakePlan);

/**
 * Result of comparing the active AMI tags with the repository staleness key.
 *
 * **Example** (Construct a bake freshness report)
 *
 * ```ts
 * import { BakeCheckReport } from "@beep/repo-cli/commands/Runners"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const digest = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const report = BakeCheckReport.make({
 *   amiId: "ami-0123456789abcdef0",
 *   expectedLockfileSha256: digest,
 *   actualLockfileSha256: O.some(digest),
 *   expectedBunArchiveSha256: digest,
 *   actualBunArchiveSha256: O.some(digest),
 *   expectedBunVersion: "1.2.20",
 *   actualBunVersion: O.some("1.2.20"),
 *   lockfileMatches: true,
 *   bunArchiveMatches: true,
 *   bunVersionMatches: true,
 *   fresh: true,
 * })
 * console.log(report.fresh)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BakeCheckReport extends S.Class<BakeCheckReport>($I`BakeCheckReport`)(
  {
    amiId: S.NonEmptyString,
    expectedLockfileSha256: Sha256Hex,
    actualLockfileSha256: S.OptionFromOptionalKey(Sha256Hex),
    expectedBunArchiveSha256: Sha256Hex,
    actualBunArchiveSha256: S.OptionFromOptionalKey(Sha256Hex),
    expectedBunVersion: S.NonEmptyString,
    actualBunVersion: S.OptionFromOptionalKey(S.NonEmptyString),
    lockfileMatches: S.Boolean,
    bunArchiveMatches: S.Boolean,
    bunVersionMatches: S.Boolean,
    fresh: S.Boolean,
  },
  $I.annote("BakeCheckReport", {
    description: "Lockfile, Bun release archive, and Bun version freshness result for the live runner AMI pin.",
  })
) {}

/**
 * JSON-string codec for `bake --check --json`.
 *
 * **Example** (Inspect the bake check codec)
 *
 * ```ts
 * import { BakeCheckReportJson } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof BakeCheckReportJson.encode)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BakeCheckReportJson = JsonStringCodec(BakeCheckReport);

/**
 * Internal wire shape returned by `aws ssm get-parameter`.
 *
 * **Example** (Construct an SSM response)
 *
 * ```ts
 * import { AwsGetParameterResponse } from "@beep/repo-cli/commands/Runners"
 *
 * const response = AwsGetParameterResponse.make({ Parameter: { Value: "ami-0123456789abcdef0" } })
 * console.log(response.Parameter.Value)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AwsGetParameterResponse extends S.Class<AwsGetParameterResponse>($I`AwsGetParameterResponse`)(
  { Parameter: S.Struct({ Value: S.NonEmptyString }) },
  $I.annote("AwsGetParameterResponse", { description: "AWS CLI SSM get-parameter response subset." })
) {}

/**
 * Internal wire shape returned by `aws ec2 run-instances`.
 *
 * **Example** (Construct a run-instances response)
 *
 * ```ts
 * import { AwsRunInstancesResponse } from "@beep/repo-cli/commands/Runners"
 *
 * const response = AwsRunInstancesResponse.make({ Instances: [{ InstanceId: "i-0123456789abcdef0" }] })
 * console.log(response.Instances[0]?.InstanceId)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AwsRunInstancesResponse extends S.Class<AwsRunInstancesResponse>($I`AwsRunInstancesResponse`)(
  { Instances: S.Array(S.Struct({ InstanceId: S.NonEmptyString })) },
  $I.annote("AwsRunInstancesResponse", { description: "AWS CLI run-instances response subset." })
) {}

/**
 * Internal wire shape returned by `aws ec2 create-image`.
 *
 * **Example** (Construct a create-image response)
 *
 * ```ts
 * import { AwsCreateImageResponse } from "@beep/repo-cli/commands/Runners"
 *
 * const response = AwsCreateImageResponse.make({ ImageId: "ami-0123456789abcdef0" })
 * console.log(response.ImageId)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AwsCreateImageResponse extends S.Class<AwsCreateImageResponse>($I`AwsCreateImageResponse`)(
  { ImageId: S.NonEmptyString },
  $I.annote("AwsCreateImageResponse", { description: "AWS CLI create-image response subset." })
) {}

/**
 * Internal AWS resource tag wire shape.
 *
 * **Example** (Construct an AWS tag)
 *
 * ```ts
 * import { AwsTag } from "@beep/repo-cli/commands/Runners"
 *
 * const tag = AwsTag.make({ Key: "beep-ci", Value: "runner" })
 * console.log(tag.Value)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AwsTag extends S.Class<AwsTag>($I`AwsTag`)(
  { Key: S.NonEmptyString, Value: S.String },
  $I.annote("AwsTag", { description: "Key/value tag emitted by the AWS CLI." })
) {}

/**
 * Internal wire shape returned by `aws ec2 describe-images`.
 *
 * **Example** (Construct a describe-images response)
 *
 * ```ts
 * import { AwsDescribeImagesResponse, AwsTag } from "@beep/repo-cli/commands/Runners"
 *
 * const response = AwsDescribeImagesResponse.make({
 *   Images: [{ Tags: [AwsTag.make({ Key: "beep-ci", Value: "runner" })] }],
 * })
 * console.log(response.Images.length)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AwsDescribeImagesResponse extends S.Class<AwsDescribeImagesResponse>($I`AwsDescribeImagesResponse`)(
  { Images: S.Array(S.Struct({ Tags: S.optionalKey(AwsTag.pipe(S.Array)) })) },
  $I.annote("AwsDescribeImagesResponse", { description: "AWS CLI describe-images response subset." })
) {}

/**
 * Internal wire shape returned by `aws ec2 get-console-output`.
 *
 * **Example** (Construct a console-output response)
 *
 * ```ts
 * import { AwsConsoleOutputResponse } from "@beep/repo-cli/commands/Runners"
 * import * as O from "effect/Option"
 *
 * const response = AwsConsoleOutputResponse.make({ Output: O.some("BEEP_RUNNERS_BAKE_COMPLETE") })
 * console.log(O.isSome(response.Output))
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class AwsConsoleOutputResponse extends S.Class<AwsConsoleOutputResponse>($I`AwsConsoleOutputResponse`)(
  { Output: S.OptionFromNullishOr(S.String) },
  $I.annote("AwsConsoleOutputResponse", { description: "AWS CLI instance console-output response subset." })
) {}
