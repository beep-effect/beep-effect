/**
 * Effect service for checking and baking runner AMIs through the AWS CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Console, Context, DateTime, Duration, Effect, FileSystem, Layer, Path, pipe, Schedule } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { hashFileSha256 } from "../../internal/cli/FsGuards.ts";
import { formatCommandLine, runCaptured } from "../../internal/process/StepExec.ts";
import { RunnersCommandError } from "./Runners.errors.ts";
import {
  AwsConsoleOutputResponse,
  AwsCreateImageResponse,
  AwsDescribeImagesResponse,
  AwsGetParameterResponse,
  AwsRunInstancesResponse,
  AwsTag,
  BakeCheckReport,
  BakePlan,
  BakePlanStep,
  BakeReport,
  BakeReportJson,
  DEFAULT_RUNNER_BASE_AMI_PARAMETER,
  RUNNER_AMI_PIN_PARAMETER,
} from "./Runners.schemas.ts";
import type { Crypto } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { BakeConfig } from "./Runners.schemas.ts";

const $I = $RepoCliId.create("commands/Runners/Runners.service");
const BAKE_COMPLETE_MARKER = "BEEP_RUNNERS_BAKE_COMPLETE";
const BAKE_FAILED_MARKER = "BEEP_RUNNERS_BAKE_FAILED";
const BAKE_CANONICAL_REPO = "github.com/beep-effect/beep-effect";
const BAKE_CLONE_URL = `https://${BAKE_CANONICAL_REPO}.git`;
// HTTPS remotes carry `github.com/owner/repo`, SSH remotes `github.com:owner/repo`.
const BAKE_CANONICAL_REMOTE_FORMS = [BAKE_CANONICAL_REPO, "github.com:beep-effect/beep-effect"];
const REPORT_FILE_NAME = "runners-bake-report.json";
const AWS_POLL_INTERVAL = Duration.seconds(15);
const BAKE_WAIT_LIMIT = Duration.hours(6);
// EC2 posts a stopped instance's console output minutes after the stop; the
// window an empty read is propagation rather than a bake failure. Observed
// live: one bake posted within ~2 minutes, the next took over 6.
const CONSOLE_POST_LIMIT = Duration.minutes(20);
const IMAGE_WAIT_LIMIT = Duration.hours(2);

const BunVersion = S.String.check(
  S.isPattern(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u, {
    identifier: $I`BunVersionPattern`,
    title: "Bun version",
    description: "Exact Bun semantic version safe for interpolation into runner bake shell commands.",
    message: "Expected an exact Bun semantic version",
  })
).pipe($I.annoteSchema("BunVersion", { description: "Validated Bun release used by the runner bake." }));

const AwsTagResourceType = LiteralKit(["image", "instance"]).pipe(
  $I.annoteSchema("AwsTagResourceType", { description: "EC2 resource types tagged by the runner bake." })
);

class AwsTagSpecification extends S.Class<AwsTagSpecification>($I`AwsTagSpecification`)(
  { ResourceType: AwsTagResourceType, Tags: S.Array(AwsTag) },
  $I.annote("AwsTagSpecification", { description: "Complete JSON EC2 tag specification passed to the AWS CLI." })
) {}

class AwsEbsBlockDevice extends S.Class<AwsEbsBlockDevice>($I`AwsEbsBlockDevice`)(
  {
    DeleteOnTermination: S.Boolean,
    Encrypted: S.Boolean,
    Iops: S.Int,
    Throughput: S.Int,
    VolumeSize: S.Int,
    VolumeType: S.Literal("gp3"),
  },
  $I.annote("AwsEbsBlockDevice", { description: "EBS settings for the temporary bake instance root volume." })
) {}

class AwsBlockDeviceMapping extends S.Class<AwsBlockDeviceMapping>($I`AwsBlockDeviceMapping`)(
  { DeviceName: S.Literal("/dev/xvda"), Ebs: AwsEbsBlockDevice },
  $I.annote("AwsBlockDeviceMapping", { description: "EC2 root block-device override for a runner bake." })
) {}

/**
 * Error raised when an AWS resource observed during a runner bake has not yet reached the state the
 * bake expects.
 *
 * **Details**
 *
 * Carries the resource identity plus the expected and actual states so callers can retry or report
 * with the same diagnostic identity; declared equivalence compares those three fields only.
 *
 * **Example** (Describe a runner instance that is still starting)
 *
 * ```ts
 * import { AwsResourcePending } from "@beep/repo-cli/commands/Runners/Runners.service"
 *
 * const pending = AwsResourcePending.make({ resource: "instance i-0123", expected: "running", actual: "pending" })
 * console.log(pending._tag) // "AwsResourcePending"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AwsResourcePending extends S.TaggedError<AwsResourcePending>($I`AwsResourcePending`)(
  "AwsResourcePending",
  {
    actual: S.NonEmptyString,
    expected: S.NonEmptyString,
    resource: S.NonEmptyString,
  },
  $I.annoteError<AwsResourcePending>("AwsResourcePending", {
    description: "Internal signal that an AWS resource has not reached its target state.",
  })
) {}

const decodeParameter = S.decodeUnknownEffect(S.fromJsonString(AwsGetParameterResponse));
const decodeRunInstances = S.decodeUnknownEffect(S.fromJsonString(AwsRunInstancesResponse));
const decodeCreateImage = S.decodeUnknownEffect(S.fromJsonString(AwsCreateImageResponse));
const decodeDescribeImages = S.decodeUnknownEffect(S.fromJsonString(AwsDescribeImagesResponse));
const decodeConsoleOutput = S.decodeUnknownEffect(S.fromJsonString(AwsConsoleOutputResponse));
const decodeAwsStates = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.NonEmptyString)));
const encodeTagSpecification = S.encodeEffect(S.fromJsonString(AwsTagSpecification));
const encodeBlockDeviceMappings = S.encodeEffect(S.fromJsonString(S.Array(AwsBlockDeviceMapping)));

/**
 * Local repository inputs that form the immutable bake key.
 *
 * **Example** (Construct local bake inputs)
 *
 * ```ts
 * import { BakeLocalInputs } from "@beep/repo-cli/commands/Runners"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const inputs = BakeLocalInputs.make({
 *   repoRoot: "/work/beep-effect",
 *   lockfileSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   bunArchiveSha256: Sha256Hex.make("951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f"),
 *   bunVersion: "1.2.20",
 *   gitRevision: "0123456789abcdef0123456789abcdef01234567",
 * })
 * console.log(inputs.bunVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BakeLocalInputs extends S.Class<BakeLocalInputs>($I`BakeLocalInputs`)(
  {
    repoRoot: S.NonEmptyString,
    lockfileSha256: Sha256Hex,
    bunArchiveSha256: Sha256Hex,
    bunVersion: S.NonEmptyString,
    gitRevision: S.NonEmptyString,
  },
  $I.annote("BakeLocalInputs", {
    description: "Repository root, revision, lock digest, Bun archive digest, and Bun version used by a bake.",
  })
) {}

/**
 * Service contract for runner AMI planning, checking, and baking.
 *
 * **Example** (Select a service operation)
 *
 * ```ts
 * import type { RunnersServiceShape } from "@beep/repo-cli/commands/Runners"
 *
 * const operationName = <K extends keyof RunnersServiceShape>(name: K): K => name
 * console.log(operationName("plan"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface RunnersServiceShape {
  readonly bake: (config: BakeConfig, reportPath: O.Option<string>) => Effect.Effect<BakeReport, RunnersCommandError>;
  readonly check: (region: string) => Effect.Effect<BakeCheckReport, RunnersCommandError>;
  readonly plan: Effect.Effect<BakePlan, RunnersCommandError>;
}

/**
 * Service tag for runner AMI operations.
 *
 * **Example** (Access the service)
 *
 * ```ts
 * import { RunnersService } from "@beep/repo-cli/commands/Runners"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.service(RunnersService))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RunnersService extends Context.Service<RunnersService, RunnersServiceShape>()($I`RunnersService`) {}

const runnersError = (message: string, cause?: unknown): RunnersCommandError =>
  cause === undefined ? RunnersCommandError.make({ message }) : RunnersCommandError.make({ message, cause });

const awsArgs = (region: string, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.appendAll(["--no-cli-pager", "--region", region], args);

const runAws = Effect.fn("Runners.runAws")(function* (
  region: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, RunnersCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const argv = awsArgs(region, args);
  const result = yield* runCaptured({ command: "aws", args: argv, source: "all", trim: true }).pipe(
    RunnersCommandError.mapError(`Failed to spawn ${formatCommandLine("aws", argv)}.`)
  );
  if (result.exitCode !== 0) {
    return yield* RunnersCommandError.make({
      message: `${formatCommandLine("aws", argv)} failed${Str.isEmpty(result.output) ? "." : `: ${result.output}`}`,
      command: formatCommandLine("aws", argv),
      exitCode: result.exitCode,
    });
  }
  return result.output;
});

// The bake guest clones the canonical repository and detaches to this
// revision, so a revision that only exists locally — or only on a fork
// remote — fails inside the guest after the instance has already launched.
// Refuse before any AWS call, and only trust remote-tracking refs that
// belong to a remote pointing at the canonical clone source.
const assertRevisionPushed = Effect.fn("Runners.assertRevisionPushed")(function* (
  repoRoot: string,
  revision: string
): Effect.fn.Return<void, RunnersCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const remotes = yield* runCaptured({
    command: "git",
    args: ["remote", "-v"],
    cwd: repoRoot,
    source: "all",
    trim: true,
  }).pipe(RunnersCommandError.mapError("Failed to list Git remotes for the bake reachability check."));
  const canonicalRemotes = pipe(
    Str.split("\n")(remotes.output),
    A.filter((line) => A.some(BAKE_CANONICAL_REMOTE_FORMS, (form) => Str.includes(form)(line))),
    A.map((line) => A.head(Str.split("\t")(Str.trim(line)))),
    A.getSomes,
    A.dedupe
  );
  if (remotes.exitCode !== 0 || A.isReadonlyArrayEmpty(canonicalRemotes)) {
    return yield* RunnersCommandError.make({
      message: `No Git remote points at ${BAKE_CANONICAL_REPO}; the bake guest clones that repository.`,
    });
  }
  const contains = yield* runCaptured({
    command: "git",
    args: ["branch", "-r", "--contains", revision],
    cwd: repoRoot,
    source: "all",
    trim: true,
  }).pipe(RunnersCommandError.mapError("Failed to check remote reachability of the bake revision."));
  const reachable =
    contains.exitCode === 0 &&
    pipe(
      Str.split("\n")(contains.output),
      A.map(Str.trim),
      A.some((ref) => A.some(canonicalRemotes, (remote) => Str.startsWith(`${remote}/`)(ref)))
    );
  if (!reachable) {
    return yield* RunnersCommandError.make({
      message: `Bake revision ${revision} is not reachable from any ${BAKE_CANONICAL_REPO} remote branch; push it before baking.`,
    });
  }
});

const runGitRevision = Effect.fn("Runners.gitRevision")(function* (
  repoRoot: string
): Effect.fn.Return<string, RunnersCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCaptured({
    command: "git",
    args: ["rev-parse", "HEAD"],
    cwd: repoRoot,
    source: "all",
    trim: true,
  }).pipe(RunnersCommandError.mapError("Failed to inspect the current Git revision."));
  if (result.exitCode !== 0 || Str.isEmpty(result.output)) {
    return yield* RunnersCommandError.make({
      message: "Failed to resolve the current Git revision.",
      exitCode: result.exitCode,
    });
  }
  return result.output;
});

const assertBakeInputsClean = Effect.fn("Runners.assertBakeInputsClean")(function* (
  repoRoot: string
): Effect.fn.Return<void, RunnersCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const args = [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    "bun.lock",
    ".bun-version",
    ".bun-linux-x64.sha256",
  ];
  const result = yield* runCaptured({
    command: "git",
    args,
    cwd: repoRoot,
    source: "all",
    trim: true,
  }).pipe(RunnersCommandError.mapError("Failed to inspect runner bake inputs in Git."));
  if (result.exitCode !== 0) {
    return yield* RunnersCommandError.make({
      message: "Failed to inspect runner bake inputs in Git.",
      command: formatCommandLine("git", args),
      exitCode: result.exitCode,
    });
  }
  if (!Str.isEmpty(result.output)) {
    return yield* RunnersCommandError.make({
      message: "Refusing to bake while bun.lock, .bun-version, or .bun-linux-x64.sha256 has uncommitted changes.",
    });
  }
});

const loadLocalInputs = Effect.fn("Runners.loadLocalInputs")(function* (): Effect.fn.Return<
  BakeLocalInputs,
  RunnersCommandError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(RunnersCommandError.mapError("Failed to locate the repository root."));
  const lockfilePath = path.join(repoRoot, "bun.lock");
  const bunVersionPath = path.join(repoRoot, ".bun-version");
  const bunArchiveSha256Path = path.join(repoRoot, ".bun-linux-x64.sha256");
  yield* assertBakeInputsClean(repoRoot);
  const lockfileSha256 = yield* hashFileSha256(lockfilePath, (cause) =>
    runnersError(`Failed to hash ${lockfilePath}.`, cause)
  );
  const rawBunVersion = yield* fs
    .readFileString(bunVersionPath)
    .pipe(Effect.map(Str.trim), RunnersCommandError.mapError(`Failed to read ${bunVersionPath}.`));
  const bunVersion = yield* S.decodeEffect(BunVersion)(rawBunVersion).pipe(
    RunnersCommandError.mapError(`${bunVersionPath} must contain an exact Bun semantic version.`)
  );
  const rawBunArchiveSha256 = yield* fs
    .readFileString(bunArchiveSha256Path)
    .pipe(Effect.map(Str.trim), RunnersCommandError.mapError(`Failed to read ${bunArchiveSha256Path}.`));
  const bunArchiveSha256 = yield* S.decodeEffect(Sha256Hex)(rawBunArchiveSha256).pipe(
    RunnersCommandError.mapError(`${bunArchiveSha256Path} must contain one SHA-256 digest.`)
  );
  const gitRevision = yield* runGitRevision(repoRoot);
  return BakeLocalInputs.make({ repoRoot, lockfileSha256, bunArchiveSha256, bunVersion, gitRevision });
});

const parseAws = <A, I>(
  label: string,
  decode: (input: I) => Effect.Effect<A, S.SchemaError>,
  input: I
): Effect.Effect<A, RunnersCommandError> =>
  decode(input).pipe(RunnersCommandError.mapError(`AWS returned an invalid ${label} response.`));

const getParameter = Effect.fn("Runners.getParameter")(function* (region: string, name: string) {
  const output = yield* runAws(region, ["ssm", "get-parameter", "--name", name, "--output", "json"]);
  const response = yield* parseAws("SSM get-parameter", decodeParameter, output);
  return response.Parameter.Value;
});

const getPriorPin = (
  region: string
): Effect.Effect<O.Option<string>, RunnersCommandError, ChildProcessSpawner.ChildProcessSpawner> =>
  getParameter(region, RUNNER_AMI_PIN_PARAMETER).pipe(
    Effect.asSome,
    Effect.catchTag("RunnersCommandError", (error) =>
      Str.includes("ParameterNotFound")(error.message) ? Effect.succeedNone : Effect.fail(error)
    )
  );

const makeBakeScript = (inputs: BakeLocalInputs): string => `#!/usr/bin/env bash
set -euo pipefail
exec >> /dev/console 2>&1
trap 'echo "BEEP_RUNNERS_BAKE_FAILED line \${LINENO}: \${BASH_COMMAND}" >> /dev/console' ERR
shutdown -P +350
trap 'shutdown -P now' EXIT
dnf install -y git unzip zip jq docker libicu
systemctl enable --now docker
install -d -o ec2-user -g ec2-user /home/ec2-user/.bun
install -d -o root -g root -m 0755 /usr/local/bin /opt/beep-ci /etc/beep-ci
curl --fail --location --proto '=https' --tlsv1.2 --retry 3 \
  --output /tmp/bun-linux-x64.zip \
  'https://github.com/oven-sh/bun/releases/download/bun-v${inputs.bunVersion}/bun-linux-x64.zip'
printf '%s  %s\n' '${inputs.bunArchiveSha256}' /tmp/bun-linux-x64.zip | sha256sum --check --strict -
rm -rf /tmp/bun-linux-x64
unzip -q /tmp/bun-linux-x64.zip -d /tmp/bun-linux-x64
install -o root -g root -m 0755 \
  /tmp/bun-linux-x64/bun-linux-x64/bun /usr/local/bin/bun
ln -sfn bun /usr/local/bin/bunx
chown -h root:root /usr/local/bin/bunx
bun_binary_sha256="$(sha256sum /usr/local/bin/bun | cut -d ' ' -f 1)"
/usr/local/bin/bunx --version
rm -rf /tmp/bun-linux-x64 /tmp/bun-linux-x64.zip
git clone --filter=blob:none ${BAKE_CLONE_URL} /tmp/beep-effect
git -C /tmp/beep-effect checkout --detach ${inputs.gitRevision}
test "$(sha256sum /tmp/beep-effect/bun.lock | cut -d ' ' -f 1)" = "${inputs.lockfileSha256}"
chown -R ec2-user:ec2-user /tmp/beep-effect
sudo -u ec2-user env HOME=/home/ec2-user PATH=/usr/local/bin:/usr/bin:/bin \
  /usr/local/bin/bun install --cwd /tmp/beep-effect --frozen-lockfile
tar -C /home/ec2-user/.bun/install -czf /opt/beep-ci/bun-install-cache.tgz cache
chown root:root /opt/beep-ci/bun-install-cache.tgz
chmod 0444 /opt/beep-ci/bun-install-cache.tgz
bun_install_cache_sha256="$(sha256sum /opt/beep-ci/bun-install-cache.tgz | cut -d ' ' -f 1)"
printf '%s\n' '${inputs.lockfileSha256}' > /etc/beep-ci/bun-lock.sha256
printf '%s\n' '${inputs.bunVersion}' > /etc/beep-ci/bun-version
printf '%s\n' '${inputs.bunArchiveSha256}' > /etc/beep-ci/bun-archive.sha256
printf '%s\n' "\${bun_binary_sha256}" > /etc/beep-ci/bun-binary.sha256
printf '%s\n' "\${bun_install_cache_sha256}" > /etc/beep-ci/bun-install-cache.sha256
printf '%s\n' '${inputs.gitRevision}' > /etc/beep-ci/source-revision
install -o root -g root -m 0444 /dev/null /etc/beep-ci/baked-runner
chmod 0444 /etc/beep-ci/*.sha256 /etc/beep-ci/bun-version /etc/beep-ci/source-revision
rm -rf /tmp/beep-effect /root/.cache /home/ec2-user/.cache \
  /home/ec2-user/.bun/bin /home/ec2-user/.bun/install/cache
cloud-init clean --logs
truncate -s 0 /etc/machine-id
rm -f /var/lib/dbus/machine-id
rm -rf /var/lib/cloud/instances/* /var/log/cloud-init*.log
sync
echo '${BAKE_COMPLETE_MARKER}' > /dev/console
sync
sleep 10
trap - EXIT
shutdown -P now
`;

const tagsFromRecord = (tags: Readonly<Record<string, string>>): ReadonlyArray<AwsTag> =>
  pipe(
    R.toEntries(tags),
    A.map(([Key, Value]) => AwsTag.make({ Key, Value }))
  );

const requiredInstanceTags = (config: BakeConfig): Readonly<Record<string, string>> =>
  pipe(config.tags, R.set("beep-ci", "runner"), R.set("beep-ci:bake", "true"));

const imageTags = (
  config: BakeConfig,
  inputs: BakeLocalInputs,
  baseAmiId: string,
  bakeDate: string
): Readonly<Record<string, string>> =>
  pipe(
    config.tags,
    R.set("beep-ci", "runner"),
    R.set("beep-ci:lockfile-sha256", inputs.lockfileSha256),
    R.set("beep-ci:bun-archive-sha256", inputs.bunArchiveSha256),
    R.set("beep-ci:bun-version", inputs.bunVersion),
    R.set("App", "ci-runners"),
    R.set("ManagedBy", "beep-runners-bake"),
    R.set("beep-ci:base-ami-id", baseAmiId),
    R.set("beep-ci:bake-date", bakeDate)
  );

const runInstance = Effect.fn("Runners.runInstance")(function* (
  config: BakeConfig,
  baseAmiId: string,
  userData: string
) {
  const instanceTagJson = yield* encodeTagSpecification(
    AwsTagSpecification.make({ ResourceType: "instance", Tags: tagsFromRecord(requiredInstanceTags(config)) })
  ).pipe(RunnersCommandError.mapError("Failed to encode bake instance tags."));
  const blockDeviceMappings = yield* encodeBlockDeviceMappings([
    AwsBlockDeviceMapping.make({
      DeviceName: "/dev/xvda",
      Ebs: AwsEbsBlockDevice.make({
        DeleteOnTermination: true,
        Encrypted: true,
        Iops: 3000,
        Throughput: 250,
        VolumeSize: 100,
        VolumeType: "gp3",
      }),
    }),
  ]).pipe(RunnersCommandError.mapError("Failed to encode bake instance block-device mappings."));
  const output = yield* runAws(config.region, [
    "ec2",
    "run-instances",
    "--image-id",
    baseAmiId,
    "--instance-type",
    config.instanceType,
    "--network-interfaces",
    `DeviceIndex=0,SubnetId=${config.subnetId},Groups=${config.securityGroupId},AssociatePublicIpAddress=true,DeleteOnTermination=true`,
    ...O.match(config.instanceProfile, {
      onNone: () => [],
      onSome: (name) => ["--iam-instance-profile", `Name=${name}`],
    }),
    "--metadata-options",
    "HttpTokens=required,HttpEndpoint=enabled,HttpPutResponseHopLimit=1,InstanceMetadataTags=enabled",
    "--instance-initiated-shutdown-behavior",
    "stop",
    "--block-device-mappings",
    blockDeviceMappings,
    "--user-data",
    userData,
    "--tag-specifications",
    instanceTagJson,
    "--count",
    "1",
    "--output",
    "json",
  ]);
  const response = yield* parseAws("EC2 run-instances", decodeRunInstances, output);
  return yield* A.head(response.Instances).pipe(
    O.map((instance) => instance.InstanceId),
    Effect.fromOption(() => RunnersCommandError.make({ message: "AWS launched no bake instance." }))
  );
});

const terminateInstance = (region: string, instanceId: string) =>
  runAws(region, ["ec2", "terminate-instances", "--instance-ids", instanceId, "--output", "json"]).pipe(
    Effect.tapError((error) => Console.error(`runners bake: teardown failed for ${instanceId}: ${error.message}`)),
    Effect.ignore
  );

const waitForAwsState = Effect.fn("Runners.waitForAwsState")(function* <R>(
  resource: string,
  expected: string,
  limit: Duration.Duration,
  readState: Effect.Effect<string, RunnersCommandError | AwsResourcePending, R>
) {
  yield* readState.pipe(
    Effect.flatMap((actual) =>
      Str.Equivalence(actual, expected)
        ? Effect.void
        : Effect.fail(AwsResourcePending.make({ actual, expected, resource }))
    ),
    Effect.retry({
      schedule: Schedule.spaced(AWS_POLL_INTERVAL).pipe(Schedule.upTo({ duration: limit })),
      while: P.isTagged("AwsResourcePending"),
    }),
    Effect.catchTag("AwsResourcePending", (pending) =>
      RunnersCommandError.make({
        message: `${pending.resource} did not reach ${pending.expected} within ${Duration.format(limit)} (last state: ${pending.actual}).`,
      })
    )
  );
});

// EC2 read-after-write is eventually consistent: a just-created resource can
// 404 on describe for several seconds. Fold that window into the pending-state
// retry instead of failing the bake on the propagation race.
const pendingWhileNotFound =
  (resource: string, notFoundCode: string) =>
  <A, R>(
    self: Effect.Effect<A, RunnersCommandError, R>
  ): Effect.Effect<A, RunnersCommandError | AwsResourcePending, R> =>
    Effect.catchTag(self, "RunnersCommandError", (error) =>
      Effect.fail<RunnersCommandError | AwsResourcePending>(
        Str.includes(notFoundCode)(error.message)
          ? AwsResourcePending.make({ actual: "propagating", expected: "visible", resource })
          : error
      )
    );

const readInstanceState = Effect.fn("Runners.readInstanceState")(function* (region: string, instanceId: string) {
  const output = yield* runAws(region, [
    "ec2",
    "describe-instances",
    "--instance-ids",
    instanceId,
    "--query",
    "Reservations[].Instances[].State.Name",
    "--output",
    "json",
  ]).pipe(pendingWhileNotFound(instanceId, "InvalidInstanceID.NotFound"));
  const states = yield* parseAws("EC2 describe-instances state", decodeAwsStates, output);
  return yield* A.head(states).pipe(
    Effect.fromOption(() => RunnersCommandError.make({ message: `AWS returned no state for ${instanceId}.` }))
  );
});

const readImageState = Effect.fn("Runners.readImageState")(function* (region: string, imageId: string) {
  const output = yield* runAws(region, [
    "ec2",
    "describe-images",
    "--image-ids",
    imageId,
    "--query",
    "Images[].State",
    "--output",
    "json",
  ]).pipe(pendingWhileNotFound(imageId, "InvalidAMIID.NotFound"));
  const states = yield* parseAws("EC2 describe-images state", decodeAwsStates, output);
  return yield* A.head(states).pipe(
    Effect.fromOption(() => RunnersCommandError.make({ message: `AWS returned no state for ${imageId}.` }))
  );
});

const consoleTailOf = (consoleOutput: string): string =>
  Str.slice(Math.max(0, consoleOutput.length - 1500))(consoleOutput);

const readPostedConsole = Effect.fn("Runners.readPostedConsole")(function* (region: string, instanceId: string) {
  const output = yield* runAws(region, [
    "ec2",
    "get-console-output",
    "--latest",
    "--instance-id",
    instanceId,
    "--output",
    "json",
  ]);
  const response = yield* parseAws("EC2 get-console-output", decodeConsoleOutput, output);
  // AWS CLI v2 auto-decodes get-console-output's base64 Output field, so the
  // value arrives as plain console text.
  const decoded = O.getOrElse(response.Output, () => "");
  if (Str.includes(BAKE_COMPLETE_MARKER)(decoded)) {
    return decoded;
  }
  if (Str.includes(BAKE_FAILED_MARKER)(decoded)) {
    return yield* RunnersCommandError.make({
      message: `Bake instance ${instanceId} stopped without the ${BAKE_COMPLETE_MARKER} success marker. Console tail:\n${consoleTailOf(decoded)}`,
    });
  }
  // Empty OR partial reads right after "stopped" are the post-at-stop
  // publication window, not a bake verdict: the narrating script writes from
  // its first command, so already-posted boot output can arrive before the
  // final capture that carries a marker. Surface both as pending.
  return yield* AwsResourcePending.make({ actual: "unposted-or-partial", expected: "marker", resource: instanceId });
});

const verifyBakeCompleted = Effect.fn("Runners.verifyBakeCompleted")(function* (region: string, instanceId: string) {
  yield* waitForAwsState(instanceId, "stopped", BAKE_WAIT_LIMIT, readInstanceState(region, instanceId));
  // readPostedConsole is terminal only on a marker: success returns the
  // output, the explicit failure marker raises with the console tail, and
  // everything else (empty or partial publication) retries until the window
  // closes.
  yield* readPostedConsole(region, instanceId).pipe(
    Effect.retry({
      schedule: Schedule.spaced(AWS_POLL_INTERVAL).pipe(Schedule.upTo({ duration: CONSOLE_POST_LIMIT })),
      while: P.isTagged("AwsResourcePending"),
    }),
    Effect.catchTag("AwsResourcePending", () =>
      RunnersCommandError.make({
        message: `Bake instance ${instanceId} console output carried no ${BAKE_COMPLETE_MARKER} or ${BAKE_FAILED_MARKER} marker within ${Duration.format(CONSOLE_POST_LIMIT)} of stopping.`,
      })
    )
  );
});

const createImage = Effect.fn("Runners.createImage")(function* (
  config: BakeConfig,
  instanceId: string,
  tags: Readonly<Record<string, string>>,
  inputs: BakeLocalInputs
) {
  const imageTagJson = yield* encodeTagSpecification(
    AwsTagSpecification.make({ ResourceType: "image", Tags: tagsFromRecord(tags) })
  ).pipe(RunnersCommandError.mapError("Failed to encode baked AMI tags."));
  const name = `beep-ci-runners-${Str.slice(0, 12)(inputs.lockfileSha256)}-${config.bakeTimestamp}`;
  const output = yield* runAws(config.region, [
    "ec2",
    "create-image",
    "--instance-id",
    instanceId,
    "--name",
    name,
    "--description",
    "Lockfile-keyed beep CI runner image",
    "--no-reboot",
    "--tag-specifications",
    imageTagJson,
    "--output",
    "json",
  ]);
  const response = yield* parseAws("EC2 create-image", decodeCreateImage, output);
  yield* waitForAwsState(
    response.ImageId,
    "available",
    IMAGE_WAIT_LIMIT,
    readImageState(config.region, response.ImageId)
  );
  return response.ImageId;
});

const writeBakeReport = Effect.fn("Runners.writeBakeReport")(function* (pathValue: string, report: BakeReport) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const encoded = yield* BakeReportJson.encode(report).pipe(
    RunnersCommandError.mapError("Failed to schema-encode the bake report.")
  );
  yield* fs
    .makeDirectory(path.dirname(pathValue), { recursive: true })
    .pipe(RunnersCommandError.mapError(`Failed to create the report directory for ${pathValue}.`));
  yield* fs
    .writeFileString(pathValue, `${encoded}\n`)
    .pipe(RunnersCommandError.mapError(`Failed to write the bake report to ${pathValue}.`));
});

const makePlan = Effect.fn("Runners.plan")(function* () {
  const inputs = yield* loadLocalInputs();
  return BakePlan.make({
    lockfileSha256: inputs.lockfileSha256,
    bunArchiveSha256: inputs.bunArchiveSha256,
    bunVersion: inputs.bunVersion,
    gitRevision: inputs.gitRevision,
    requiredFlags: ["--region", "--subnet", "--security-group"],
    invariants: [
      "beep-ci=runner",
      "beep-ci:bake=true",
      "AssociatePublicIpAddress=true",
      "shutdown -P backstop",
      "root-owned Bun binary + installed digest + authenticated warm cache",
      "lockfile-sha256 + bun-archive-sha256 + bun-version staleness key",
      "unconditional instance termination",
    ],
    steps: [
      BakePlanStep.make({
        name: "resolve-base-ami",
        argv: ["aws", "ssm", "get-parameter", "--name", DEFAULT_RUNNER_BASE_AMI_PARAMETER],
      }),
      BakePlanStep.make({ name: "launch-bake-instance", argv: ["aws", "ec2", "run-instances"] }),
      BakePlanStep.make({ name: "wait-for-bake", argv: ["aws", "ec2", "describe-instances"] }),
      BakePlanStep.make({ name: "verify-console-marker", argv: ["aws", "ec2", "get-console-output", "--latest"] }),
      BakePlanStep.make({ name: "create-image", argv: ["aws", "ec2", "create-image", "--no-reboot"] }),
      BakePlanStep.make({ name: "wait-for-image", argv: ["aws", "ec2", "describe-images"] }),
      BakePlanStep.make({ name: "terminate-instance", argv: ["aws", "ec2", "terminate-instances"] }),
    ],
  });
});

const tagValue = (tags: ReadonlyArray<AwsTag>, key: string): O.Option<string> =>
  pipe(
    tags,
    A.findFirst((tag) => Str.Equivalence(tag.Key, key)),
    O.map((tag) => tag.Value)
  );

const checkBake = Effect.fn("Runners.check")(function* (region: string) {
  const inputs = yield* loadLocalInputs();
  const amiId = yield* getParameter(region, RUNNER_AMI_PIN_PARAMETER);
  const output = yield* runAws(region, ["ec2", "describe-images", "--image-ids", amiId, "--output", "json"]);
  const response = yield* parseAws("EC2 describe-images", decodeDescribeImages, output);
  const tags = pipe(
    A.head(response.Images),
    O.flatMap((image) => O.fromUndefinedOr(image.Tags)),
    O.getOrElse(A.empty<AwsTag>)
  );
  const rawLockfile = tagValue(tags, "beep-ci:lockfile-sha256");
  const actualLockfileSha256 = pipe(rawLockfile, O.flatMap(S.decodeUnknownOption(Sha256Hex)));
  const rawBunArchive = tagValue(tags, "beep-ci:bun-archive-sha256");
  const actualBunArchiveSha256 = pipe(rawBunArchive, O.flatMap(S.decodeUnknownOption(Sha256Hex)));
  const actualBunVersion = tagValue(tags, "beep-ci:bun-version");
  const sha256Equivalence = S.toEquivalence(Sha256Hex);
  const lockfileMatches = pipe(
    actualLockfileSha256,
    O.exists((actual) => sha256Equivalence(actual, inputs.lockfileSha256))
  );
  const bunArchiveMatches = pipe(
    actualBunArchiveSha256,
    O.exists((actual) => sha256Equivalence(actual, inputs.bunArchiveSha256))
  );
  const bunVersionMatches = pipe(
    actualBunVersion,
    O.exists((actual) => Str.Equivalence(actual, inputs.bunVersion))
  );
  return BakeCheckReport.make({
    amiId,
    expectedLockfileSha256: inputs.lockfileSha256,
    actualLockfileSha256,
    expectedBunArchiveSha256: inputs.bunArchiveSha256,
    actualBunArchiveSha256,
    expectedBunVersion: inputs.bunVersion,
    actualBunVersion,
    lockfileMatches,
    bunArchiveMatches,
    bunVersionMatches,
    fresh: lockfileMatches && bunArchiveMatches && bunVersionMatches,
  });
});

const bakeImage = Effect.fn("Runners.bake")(function* (config: BakeConfig, reportPath: O.Option<string>) {
  const path = yield* Path.Path;
  const inputs = yield* loadLocalInputs();
  // Only image creation ships the revision to a guest clone; --plan and
  // --check must keep working on an unpushed HEAD.
  yield* assertRevisionPushed(inputs.repoRoot, inputs.gitRevision);
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const bakeDate = Str.slice(0, 10)(startedAt);
  const baseAmiId = yield* getParameter(config.region, config.baseAmiSsmParameter);
  const priorPin = yield* getPriorPin(config.region);
  const userData = makeBakeScript(inputs);
  const amiId = yield* Effect.acquireUseRelease(
    runInstance(config, baseAmiId, userData),
    Effect.fn("Runners.useBakeInstance")(function* (instanceId) {
      yield* verifyBakeCompleted(config.region, instanceId);
      return yield* createImage(config, instanceId, imageTags(config, inputs, baseAmiId, bakeDate), inputs);
    }),
    (instanceId) => terminateInstance(config.region, instanceId)
  );
  const completedAt = DateTime.formatIso(yield* DateTime.now);
  const pulumiPinCommand = `cd infra/ci-runners && pulumi config set ciFleetController:amiId ${amiId} --stack production`;
  const report = BakeReport.make({
    amiId,
    lockfileSha256: inputs.lockfileSha256,
    bunArchiveSha256: inputs.bunArchiveSha256,
    bunVersion: inputs.bunVersion,
    baseAmiId,
    priorPin,
    pulumiPinCommand,
    startedAt,
    completedAt,
  });
  const resolvedReportPath = pipe(
    reportPath,
    O.map((value) => path.resolve(inputs.repoRoot, value)),
    O.getOrElse(() => path.join(inputs.repoRoot, ".beep", "runners", REPORT_FILE_NAME))
  );
  yield* writeBakeReport(resolvedReportPath, report);
  return report;
});

const makeRunnersService = Effect.fn("RunnersService.make")(function* () {
  const context = yield* Effect.context<
    FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
  >();
  return RunnersService.of({
    plan: makePlan().pipe(Effect.provide(context)),
    check: Effect.fn("RunnersService.check")((region) => checkBake(region).pipe(Effect.provide(context))),
    bake: Effect.fn("RunnersService.bake")((config, reportPath) =>
      bakeImage(config, reportPath).pipe(Effect.provide(context))
    ),
  });
});

/**
 * Live runner bake service backed by platform files, crypto, and child processes.
 *
 * **Example** (Inspect the live service layer)
 *
 * ```ts
 * import { RunnersServiceLive } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof RunnersServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RunnersServiceLive = Layer.effect(RunnersService, makeRunnersService());

/**
 * Test-only report writer that exercises the production schema codec path.
 *
 * **Example** (Inspect the test report writer)
 *
 * ```ts
 * import { writeBakeReportForTesting } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof writeBakeReportForTesting)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const writeBakeReportForTesting = writeBakeReport;

/**
 * Test-only bake script renderer used to prove immutable launch content.
 *
 * **Example** (Inspect the test script renderer)
 *
 * ```ts
 * import { makeBakeScriptForTesting } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof makeBakeScriptForTesting)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeBakeScriptForTesting = makeBakeScript;

/**
 * Test-only NotFound-to-pending mapper used to prove propagation tolerance.
 *
 * **Example** (Inspect the test mapper)
 *
 * ```ts
 * import { pendingWhileNotFoundForTesting } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof pendingWhileNotFoundForTesting)
 * ```
 *
 * @param options - Effect to guard plus the resource and NotFound code to match.
 * @returns The guarded effect with the propagation window surfaced as pending.
 * @category testing
 * @since 0.0.0
 */
export const pendingWhileNotFoundForTesting = <A, R>(options: {
  readonly self: Effect.Effect<A, RunnersCommandError, R>;
  readonly resource: string;
  readonly notFoundCode: string;
}): Effect.Effect<A, RunnersCommandError | AwsResourcePending, R> =>
  pendingWhileNotFound(options.resource, options.notFoundCode)(options.self);

/**
 * Test-only posted-console reader used to prove post-at-stop tolerance.
 *
 * **Example** (Inspect the test reader)
 *
 * ```ts
 * import { readPostedConsoleForTesting } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof readPostedConsoleForTesting)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const readPostedConsoleForTesting = readPostedConsole;

/**
 * Test-only AWS command runner for injected-spawner argv assertions.
 *
 * **Example** (Inspect the test AWS runner)
 *
 * ```ts
 * import { runAwsForTesting } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof runAwsForTesting)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const runAwsForTesting = runAws;
