/**
 * The job-name side of the CI lane map: the names GitHub prints for each
 * lane's jobs and for the support jobs that belong to no lane.
 *
 * **Details**
 *
 * `CI_LANE_DESCRIPTORS` (`CiLane.ts`) is the map. Each lane descriptor
 * carries the lane id, its workflow, its reporting job (`contextName`), the
 * earlier and conditional names of that job (`jobAliases`), the family its
 * partition jobs report under (`shardFamily`, else `contextName`) and whether
 * its context is required. The route census, the lane-timings census, the
 * certainty scorecard, heavy admission and the ruleset governance check read
 * job names from here instead of spelling them.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CI_LANE_DESCRIPTORS, CI_LANE_ID_VALUES, CiLaneId } from "./CiLane.ts";
import type { CiLaneDescriptor } from "./CiLane.ts";

const $I = $RepoCliId.create("commands/Ci/CiLaneJobs");

// A job of a called (reusable) workflow reports as `<caller> / <job>`, e.g. `Heavy / Check`.
const CALLED_JOB_SEPARATOR = " / ";
// A partition job reports as `<family> (<partition>)`, e.g. `Lint (lint-a)`.
const PARTITION_OPEN = " (";
const PARTITION_CLOSE = ")";
const PARTITION_SUFFIX = / \([^()]*\)$/;
const PARTITION_ID = / \(([^()]*)\)$/;

/**
 * The name GitHub prints for a job of a called workflow: `<caller> / <job>`.
 *
 * **Example** (Name a job of the heavy workflow)
 *
 * ```ts import.meta.vitest name="Name a job of the heavy workflow"
 * import { ciCalledJobName } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciCalledJobName("Check", "Heavy") // => "Heavy / Check"
 * ciCalledJobName("Heavy")("Docgen") // => "Heavy / Docgen"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ciCalledJobName: {
  (caller: string): (job: string) => string;
  (job: string, caller: string): string;
} = dual(2, (job: string, caller: string): string => `${caller}${CALLED_JOB_SEPARATOR}${job}`);

/**
 * The caller of a `<caller> / <job>` name: everything before its last
 * ` / `.
 *
 * **Example** (Read the caller of a called job)
 *
 * ```ts import.meta.vitest name="Read the caller of a called job"
 * import { ciCallerJobName } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 * import * as O from "effect/Option"
 *
 * O.getOrNull(ciCallerJobName("Test Unit (repo-cli-1) / Overflow")) // => "Test Unit (repo-cli-1)"
 * O.isNone(ciCallerJobName("Lint")) // => true
 * ```
 *
 * @param name - A job name as GitHub lists it.
 * @returns The caller's job name, or `None` for a job no workflow called.
 * @category utilities
 * @since 0.0.0
 */
export const ciCallerJobName = (name: string): O.Option<string> =>
  O.map(Str.lastIndexOf(CALLED_JOB_SEPARATOR)(name), (index) => Str.slice(0, index)(name));

/**
 * The family of a partition job: its name without the ` (<partition>)`
 * suffix.
 *
 * **Example** (Read the family of a partition job)
 *
 * ```ts import.meta.vitest name="Read the family of a partition job"
 * import { ciJobShardFamily } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 * import * as O from "effect/Option"
 *
 * O.getOrNull(ciJobShardFamily("Test Integration (lps-int-1)")) // => "Test Integration"
 * O.isNone(ciJobShardFamily("Test Plan")) // => true
 * ```
 *
 * @param name - A job name as GitHub lists it.
 * @returns The family, or `None` for a name without a partition suffix.
 * @category utilities
 * @since 0.0.0
 */
export const ciJobShardFamily = (name: string): O.Option<string> =>
  O.liftPredicate(Str.replace(PARTITION_SUFFIX, "")(name), (family) => !Str.Equivalence(family, name));

const partitionOfName = (name: string): O.Option<string> =>
  O.filter(
    O.flatMap(Str.match(PARTITION_ID)(name), (groups) => O.fromUndefinedOr(groups[1])),
    Str.isNonEmpty
  );

/**
 * The partition a job reports for: its own ` (<partition>)` suffix or, for a
 * job of a called workflow, its caller's.
 *
 * **Example** (Read the partition of three jobs)
 *
 * ```ts import.meta.vitest name="Read the partition of three jobs"
 * import { ciJobPartition } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 * import * as O from "effect/Option"
 *
 * O.getOrNull(ciJobPartition("Test Integration (int-rest)")) // => "int-rest"
 * O.getOrNull(ciJobPartition("Test Unit (repo-cli-1) / Overflow")) // => "repo-cli-1"
 * O.isNone(ciJobPartition("Heavy / Test Integration")) // => true
 * ```
 *
 * @param name - A job name as GitHub lists it.
 * @returns The partition id, or `None` for a job that reports for no partition.
 * @category utilities
 * @since 0.0.0
 */
export const ciJobPartition = (name: string): O.Option<string> =>
  O.orElse(partitionOfName(name), () => O.flatMap(ciCallerJobName(name), partitionOfName));

/**
 * Hosted jobs that belong to no lane: the change profile, heavy admission and
 * its `Heavy` call of heavy.yml, the test plan that selects the partitions of
 * several lanes, and heavy.yml's producer pilot jobs.
 *
 * **Details**
 *
 * `Test Plan` must match the `name:` of the `test-plan` job in
 * `.github/workflows/check.yml`. `PR Size Label` is a support job too; it is
 * the `pr-size` descriptor's context, so {@link isCiSupportJobName} reads it
 * from the descriptors.
 *
 * **Example** (Name the test plan job)
 *
 * ```ts import.meta.vitest name="Name the test plan job"
 * import { CiSupportJobName } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * CiSupportJobName.Enum["Test Plan"] // => "Test Plan"
 * CiSupportJobName.is.Heavy("Heavy") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiSupportJobName = LiteralKit([
  "Change Profile",
  "Heavy",
  "Heavy / Build candidate producer adapter",
  "Heavy / Execute approved signed producer",
  "Heavy / Inspect producer sources and tools",
  "Heavy / Observe local cache pilot",
  "Heavy Admission",
  "Test Plan",
]).pipe(
  $I.annoteSchema("CiSupportJobName", {
    description: "A hosted job outside every CI lane, named as GitHub lists it.",
  })
);

/**
 * A hosted job outside every CI lane.
 *
 * **Example** (Type a support job name)
 *
 * ```ts
 * import type { CiSupportJobName } from "@beep/repo-cli/commands/Ci"
 *
 * const name: CiSupportJobName = "Heavy Admission"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiSupportJobName = typeof CiSupportJobName.Type;

/**
 * The check-context prefix every heavy lane reports under: check.yml's
 * `Heavy` job calls heavy.yml, so its jobs report as `Heavy / <job>`.
 *
 * **Example** (Recognise a heavy context)
 *
 * ```ts
 * import { HEAVY_CONTEXT_PREFIX } from "@beep/repo-cli/commands/Ci"
 *
 * console.log("Heavy / Check".startsWith(HEAVY_CONTEXT_PREFIX)) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HEAVY_CONTEXT_PREFIX = `${CiSupportJobName.Enum.Heavy}${CALLED_JOB_SEPARATOR}`;

const isCiLaneId = S.is(CiLaneId);

// The descriptors of runnable lanes; `pr-size` and `dependency-review` are checks, not lanes.
const LANE_DESCRIPTORS: ReadonlyArray<readonly [CiLaneId, CiLaneDescriptor]> = A.getSomes(
  A.map(CI_LANE_DESCRIPTORS, (descriptor) =>
    O.map(O.liftPredicate(descriptor.id, isCiLaneId), (lane) => [lane, descriptor] as const)
  )
);
const DESCRIPTOR_BY_LANE: HashMap.HashMap<CiLaneId, CiLaneDescriptor> = HashMap.fromIterable(LANE_DESCRIPTORS);

/**
 * The descriptor of a lane.
 *
 * **Details**
 *
 * Every lane id has exactly one descriptor (the conservation test in
 * `ci-lane-jobs.test.ts` holds it), so the lookup is total.
 *
 * **Example** (Read a lane's reporting job)
 *
 * ```ts import.meta.vitest name="Read a lane's reporting job"
 * import { ciLaneDescriptor } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciLaneDescriptor("check").contextName // => "Heavy / Check"
 * ciLaneDescriptor("check").workflow // => "heavy"
 * ```
 *
 * @param lane - The lane to look up.
 * @returns Its workflow, reporting job, job aliases, shard family and required flag.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneDescriptor = (lane: CiLaneId): CiLaneDescriptor => HashMap.getUnsafe(DESCRIPTOR_BY_LANE, lane);

/**
 * Every name a lane's reporting job is listed under: its context name first,
 * then its earlier and conditional names.
 *
 * **Example** (The coverage job's two names)
 *
 * ```ts import.meta.vitest name="The coverage job's two names"
 * import { ciLaneReportingNames } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciLaneReportingNames("coverage") // => ["Heavy / Coverage Regression", "Coverage Artifact Migration"]
 * ciLaneReportingNames("lint") // => ["Lint"]
 * ```
 *
 * @param lane - The lane whose reporting job is named.
 * @returns The context name, then the lane's job aliases.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneReportingNames = (lane: CiLaneId): A.NonEmptyReadonlyArray<string> => {
  const descriptor = ciLaneDescriptor(lane);
  return A.prepend(descriptor.jobAliases, descriptor.contextName);
};

/**
 * Every family a lane's partition jobs are joined through: its context name,
 * then its declared shard family.
 *
 * **Example** (Test Integration shards report outside the heavy prefix)
 *
 * ```ts import.meta.vitest name="Test Integration shards report outside the heavy prefix"
 * import { ciLaneShardFamilies } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciLaneShardFamilies("test-integration") // => ["Heavy / Test Integration", "Test Integration"]
 * ciLaneShardFamilies("test-unit") // => ["Test Unit"]
 * ```
 *
 * @param lane - The lane whose partition jobs are joined.
 * @returns The context name, then the shard family when the lane declares one.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneShardFamilies = (lane: CiLaneId): A.NonEmptyReadonlyArray<string> => {
  const descriptor = ciLaneDescriptor(lane);
  return A.prepend(O.toArray(descriptor.shardFamily), descriptor.contextName);
};

/**
 * The start every partition job of a lane reports under:
 * `<family> (`, where the family is the lane's shard family or, without one,
 * its context name.
 *
 * **Example** (Recognise a Test Unit partition job)
 *
 * ```ts import.meta.vitest name="Recognise a Test Unit partition job"
 * import { ciLaneShardJobPrefix } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciLaneShardJobPrefix("test-unit") // => "Test Unit ("
 * ciLaneShardJobPrefix("test-integration") // => "Test Integration ("
 * ```
 *
 * @param lane - The lane whose partition jobs are named.
 * @returns The prefix of the lane's partition job names.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneShardJobPrefix = (lane: CiLaneId): string => {
  const descriptor = ciLaneDescriptor(lane);
  return `${O.getOrElse(descriptor.shardFamily, () => descriptor.contextName)}${PARTITION_OPEN}`;
};

/**
 * The name GitHub prints for one partition job of a lane:
 * `<family> (<partition>)`.
 *
 * **Example** (Name two partition jobs)
 *
 * ```ts import.meta.vitest name="Name two partition jobs"
 * import { ciLaneShardJobName } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciLaneShardJobName("lint-a", "lint") // => "Lint (lint-a)"
 * ciLaneShardJobName("test-integration")("int-rest") // => "Test Integration (int-rest)"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneShardJobName: {
  (lane: CiLaneId): (partition: string) => string;
  (partition: string, lane: CiLaneId): string;
} = dual(
  2,
  (partition: string, lane: CiLaneId): string => `${ciLaneShardJobPrefix(lane)}${partition}${PARTITION_CLOSE}`
);

const laneIndex = (namesOf: (lane: CiLaneId) => ReadonlyArray<string>): HashMap.HashMap<string, CiLaneId> =>
  HashMap.fromIterable(A.flatMap(CI_LANE_ID_VALUES, (lane) => A.map(namesOf(lane), (name) => [name, lane] as const)));

const LANE_BY_REPORTING_NAME = laneIndex(ciLaneReportingNames);
const LANE_BY_SHARD_FAMILY = laneIndex(ciLaneShardFamilies);

/**
 * The lane whose reporting job is listed under exactly this name, a context
 * name or one of its aliases.
 *
 * **Example** (Join two names of the build lane)
 *
 * ```ts import.meta.vitest name="Join two names of the build lane"
 * import { ciLaneOfReportingName } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 * import * as O from "effect/Option"
 *
 * O.getOrNull(ciLaneOfReportingName("Heavy / Build")) // => "build"
 * O.getOrNull(ciLaneOfReportingName("Build")) // => "build"
 * O.isNone(ciLaneOfReportingName("Lint (lint-a)")) // => true
 * ```
 *
 * @param name - A job name as GitHub lists it.
 * @returns The lane, or `None` when no lane reports under the name.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneOfReportingName = (name: string): O.Option<CiLaneId> => HashMap.get(LANE_BY_REPORTING_NAME, name);

/**
 * The lane whose partition jobs report under this family.
 *
 * **Example** (Join a shard family)
 *
 * ```ts import.meta.vitest name="Join a shard family"
 * import { ciLaneOfShardFamily } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 * import * as O from "effect/Option"
 *
 * O.getOrNull(ciLaneOfShardFamily("Test Integration")) // => "test-integration"
 * O.isNone(ciLaneOfShardFamily("Test Integration Partitions")) // => true
 * ```
 *
 * @param family - A partition job's name without its partition suffix.
 * @returns The lane, or `None` when no lane's partitions report under it.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneOfShardFamily = (family: string): O.Option<CiLaneId> => HashMap.get(LANE_BY_SHARD_FAMILY, family);

/**
 * Whether a lane runs in heavy.yml's verify matrix, which heavy admission
 * routes.
 *
 * **Example** (Check runs in heavy.yml, Test Unit does not)
 *
 * ```ts import.meta.vitest name="Check runs in heavy.yml, Test Unit does not"
 * import { isCiHeavyLane } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * isCiHeavyLane("check") // => true
 * isCiHeavyLane("test-unit") // => false
 * ```
 *
 * @param lane - The lane heavy admission may route.
 * @returns `true` when the lane's descriptor names the heavy workflow.
 * @category utilities
 * @since 0.0.0
 */
export const isCiHeavyLane = (lane: CiLaneId): boolean => Str.Equivalence(ciLaneDescriptor(lane).workflow, "heavy");

// Support jobs: the named ones, plus the context of every descriptor that is no lane (`PR Size Label`) and
// whose name no lane reports under (`Security` is the security lane's).
const SUPPORT_JOB_NAMES: HashSet.HashSet<string> = HashSet.fromIterable(
  A.appendAll(
    CiSupportJobName.literals,
    pipe(
      CI_LANE_DESCRIPTORS,
      A.filter((descriptor) => !isCiLaneId(descriptor.id)),
      A.map((descriptor) => descriptor.contextName),
      A.filter((name) => O.isNone(ciLaneOfReportingName(name)))
    )
  )
);

/**
 * Whether a job name is a known job outside every lane.
 *
 * **Example** (Two support jobs and a lane job)
 *
 * ```ts import.meta.vitest name="Two support jobs and a lane job"
 * import { isCiSupportJobName } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * isCiSupportJobName("Test Plan") // => true
 * isCiSupportJobName("PR Size Label") // => true
 * isCiSupportJobName("Security") // => false
 * ```
 *
 * @param name - A job name as GitHub lists it.
 * @returns `true` for a {@link CiSupportJobName} or a non-lane check's context.
 * @category utilities
 * @since 0.0.0
 */
export const isCiSupportJobName = (name: string): boolean => HashSet.has(SUPPORT_JOB_NAMES, name);

// The jobs a partition job runs through a called workflow. Each reports as `<shard> / <job>` and is that shard
// on another runner, so the lane-timings census measures it in its layout and its pickup. `Overflow` is the job
// of shard-overflow.yml: a Test Unit partition that Test Plan routed to the self-hosted overflow pool runs
// through it, called from check.yml's matrix job of the same name (goals/ci-lane-economics, 2026-11-13).
const SHARD_CALLED_JOBS: ReadonlyArray<string> = ["Overflow"];

/**
 * Every name one partition job can report under: its own, then
 * `<shard> / <job>` for each job it may run through a called workflow.
 *
 * **Example** (A shard routed to the overflow pool)
 *
 * ```ts import.meta.vitest name="A shard routed to the overflow pool"
 * import { ciShardJobNames } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * ciShardJobNames("Test Unit (unit-a)") // => ["Test Unit (unit-a)", "Test Unit (unit-a) / Overflow"]
 * ```
 *
 * @param shardName - A partition job's name, e.g. `Test Unit (unit-a)`.
 * @returns The shard's own name first.
 * @category utilities
 * @since 0.0.0
 */
export const ciShardJobNames = (shardName: string): A.NonEmptyReadonlyArray<string> =>
  A.prepend(A.map(SHARD_CALLED_JOBS, ciCalledJobName(shardName)), shardName);

/**
 * Whether a job reports one partition job, under any name in
 * {@link ciShardJobNames}.
 *
 * **Example** (Match a shard job by name)
 *
 * ```ts import.meta.vitest name="Match a shard job by name"
 * import { isCiShardJobNamed } from "@beep/repo-cli/commands/Ci/CiLaneJobs"
 *
 * isCiShardJobNamed("Test Unit (unit-a) / Overflow", "Test Unit (unit-a)") // => true
 * isCiShardJobNamed("Lint (lint-b)")("Lint (lint-a)") // => false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isCiShardJobNamed: {
  (shardName: string): (jobName: string) => boolean;
  (jobName: string, shardName: string): boolean;
} = dual(2, (jobName: string, shardName: string): boolean => A.contains(ciShardJobNames(shardName), jobName));
