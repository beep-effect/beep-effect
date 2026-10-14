/**
 * `beep goals doctor` — diff goal-packet manifest claims against reality.
 *
 * Blocking findings (manifest missing/invalid, status↔lifecycle mismatch,
 * README status-line drift, oversized `GOAL.md`, all-phases-terminal-but-
 * active, invalid reflection frontmatter in any packet) are checked against
 * the committed baseline `goals/goals-doctor.baseline.jsonc` following the
 * fallow ratchet pattern: inherited findings are advisory, new findings
 * block, and the baseline may only shrink. Advisory findings (staleness,
 * missing launchers, schema-version upgrades, unsatisfied completion gates,
 * missing supersession pointers, broken exploration back-links) never block.
 * Git-backed advisories run as single-pass log walks and degrade to a
 * skipped-with-note on shallow or unavailable history.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, O, pipe, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { diffMembership } from "../../internal/ratchet/RatchetDiff.ts";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { reflectionFileNameIsArtifact, reflectionFrontmatterIsValid } from "../Lint/ReflectionArtifact.ts";
import { GoalsGitError } from "./Goals.errors.ts";
import { decodeGoalManifest, GoalPhaseStatus, GoalStatus } from "./Goals.schemas.ts";
import { capabilityProviderRows, compileCapabilityProjection, isStrandedProviderSet } from "./Graph.projection.ts";
import {
  goalManifestPhases,
  isJsonRecord,
  listGoalPackets,
  parseGoalManifestText,
  readmeLifecycleToken,
} from "./Inventory.ts";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type { GoalManifest } from "./Goals.schemas.ts";
import type { CapabilityProjection } from "./Graph.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/Doctor");

/**
 * Repo-relative path of the committed doctor baseline.
 *
 * **Example** (Log baseline path constant)
 *
 * ```ts
 * import { GOALS_DOCTOR_BASELINE_PATH } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * console.log(GOALS_DOCTOR_BASELINE_PATH) // "goals/goals-doctor.baseline.jsonc"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOALS_DOCTOR_BASELINE_PATH = "goals/goals-doctor.baseline.jsonc";

/**
 * Hard maximum `GOAL.md` launcher size in characters.
 *
 * **Example** (Log max character limit)
 *
 * ```ts
 * import { GOAL_MD_MAX_CHARS } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * console.log(GOAL_MD_MAX_CHARS) // 4000
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_MD_MAX_CHARS = 4000;

const STALE_ACTIVE_DAYS = 21;

/**
 * Finding kinds emitted by `beep goals doctor`.
 *
 * **Example** (Check finding kind membership)
 *
 * ```ts
 * import { GoalDoctorFindingKind } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * console.log(GoalDoctorFindingKind.is["manifest-invalid"]("manifest-invalid"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalDoctorFindingKind = LiteralKit([
  "manifest-missing",
  "manifest-invalid",
  "lifecycle-mismatch",
  "readme-status-line",
  "goal-md-oversize",
  "phases-terminal-but-active",
  "reflection-frontmatter-invalid",
  "stale-active",
  "active-after-merge",
  "active-missing-goal-md",
  "schema-version-upgrade",
  "completion-gate-unsatisfied",
  "superseded-without-pointer",
  "exploration-backlink-missing",
  "packet-stream-fork",
  "packet-stream-integrity",
  "packet-status-drift",
  "packet-trace-stale",
  "packet-trace-missing",
  "packet-graduation-pending",
  "packet-fleet-duplicate-slug",
  "packet-fleet-dependency-cycle",
  "packet-fleet-unreachable",
  "packet-fleet-unmigrated-reference",
  "capability-duplicate-declaration",
  "capability-packet-id-mismatch",
  "capability-reference-provides",
  "capability-stranded",
]).pipe(
  $I.annoteSchema("GoalDoctorFindingKind", {
    description:
      "Finding kinds emitted by beep goals doctor and beep explore --check (blocking and advisory; the packet-* kinds are the explore check's stream findings).",
  })
);

/**
 * Finding kind emitted by `beep goals doctor`.
 *
 * **Example** (Type a finding kind)
 *
 * ```ts
 * import type { GoalDoctorFindingKind } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * const kind: GoalDoctorFindingKind = "lifecycle-mismatch"
 * console.log(kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalDoctorFindingKind = typeof GoalDoctorFindingKind.Type;

const GoalDoctorSeverity = LiteralKit(["blocking", "advisory"]).pipe(
  $I.annoteSchema("GoalDoctorSeverity", {
    description: "Severity of a goals-doctor finding: blocking checks ratchet against the baseline.",
  })
);

/**
 * One goals-doctor finding.
 *
 * **Details**
 *
 * `key` is the stable identity used for baseline membership; it never embeds
 * volatile detail so a finding keeps its identity across runs.
 *
 * **Example** (Make a doctor finding)
 *
 * ```ts
 * import { GoalDoctorFinding } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * const finding = GoalDoctorFinding.make({
 *   slug: "demo",
 *   kind: "readme-status-line",
 *   severity: "blocking",
 *   key: "demo readme-status-line",
 *   message: "README has no recognizable Lifecycle line.",
 * })
 * console.log(finding.key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDoctorFinding extends S.Class<GoalDoctorFinding>($I`GoalDoctorFinding`)(
  {
    slug: S.String,
    kind: GoalDoctorFindingKind,
    severity: GoalDoctorSeverity,
    key: S.String,
    message: S.String,
  },
  $I.annote("GoalDoctorFinding", {
    description: "One goals-doctor finding with a stable baseline-membership key.",
  })
) {}

class GoalsDoctorBaseline extends S.Class<GoalsDoctorBaseline>($I`GoalsDoctorBaseline`)(
  {
    schemaVersion: S.Literal("goals-doctor-baseline/v1"),
    note: S.optionalKey(S.String),
    findings: S.Array(S.String),
  },
  $I.annote("GoalsDoctorBaseline", {
    description: "Committed goals-doctor baseline: the inherited blocking-finding keys (may only shrink).",
  })
) {}

const decodeBaseline = S.decodeUnknownEffect(GoalsDoctorBaseline);
const encodeBaseline = S.encodeUnknownEffect(GoalsDoctorBaseline);
const stringifyBaseline = SchemaGetter.stringifyJson({ space: 2 });

const finding = (
  slug: string,
  kind: GoalDoctorFindingKind,
  severity: typeof GoalDoctorSeverity.Type,
  message: string,
  keySuffix = ""
): GoalDoctorFinding =>
  GoalDoctorFinding.make({
    slug,
    kind,
    severity,
    key: keySuffix === "" ? `${slug} ${kind}` : `${slug} ${kind} ${keySuffix}`,
    message,
  });

/**
 * Result of ratcheting current blocking findings against the baseline.
 *
 * **Example** (Make empty classification result)
 *
 * ```ts
 * import { GoalDoctorClassification } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * const result = GoalDoctorClassification.make({ introduced: [], inherited: [], resolved: [] })
 * console.log(result.introduced.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDoctorClassification extends S.Class<GoalDoctorClassification>($I`GoalDoctorClassification`)(
  {
    introduced: S.Array(GoalDoctorFinding),
    inherited: S.Array(GoalDoctorFinding),
    resolved: S.Array(S.String),
  },
  $I.annote("GoalDoctorClassification", {
    description: "Baseline-ratchet classification: introduced blocks, inherited stays advisory, resolved shrinks.",
  })
) {}

/**
 * Classify current blocking findings against the committed baseline keys.
 *
 * **Details**
 *
 * Pure fallow-ratchet core: `introduced` (not in the baseline) is the failure
 * signal, `inherited` stays advisory, `resolved` is the shrink-the-baseline
 * nudge.
 *
 * **Example** (Classify against empty baseline)
 *
 * ```ts
 * import { classifyGoalDoctorFindings, GoalDoctorFinding } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * const current = GoalDoctorFinding.make({
 *   slug: "demo",
 *   kind: "goal-md-oversize",
 *   severity: "blocking",
 *   key: "demo goal-md-oversize",
 *   message: "GOAL.md exceeds 4000 chars.",
 * })
 * const result = classifyGoalDoctorFindings([current], [])
 * console.log(result.introduced.length) // 1
 * ```
 *
 * @param current - Current blocking findings.
 * @param baselineKeys - Committed baseline finding keys.
 * @returns Introduced/inherited findings plus resolved baseline keys.
 * @category utilities
 * @since 0.0.0
 */
export const classifyGoalDoctorFindings: {
  (baselineKeys: ReadonlyArray<string>): (current: ReadonlyArray<GoalDoctorFinding>) => GoalDoctorClassification;
  (current: ReadonlyArray<GoalDoctorFinding>, baselineKeys: ReadonlyArray<string>): GoalDoctorClassification;
} = dual(2, (current: ReadonlyArray<GoalDoctorFinding>, baselineKeys: ReadonlyArray<string>) => {
  const diff = diffMembership({
    current: A.map(current, (item) => item.key),
    baseline: baselineKeys,
    equivalence: (left, right) => left === right,
    order: Order.String,
  });
  const introducedKeys = HashSet.fromIterable(diff.introduced);
  return GoalDoctorClassification.make({
    introduced: A.filter(current, (item) => HashSet.has(introducedKeys, item.key)),
    inherited: A.filter(current, (item) => !HashSet.has(introducedKeys, item.key)),
    resolved: diff.resolved,
  });
});

const stringAt = (value: Readonly<Record<string, unknown>>, key: string): O.Option<string> =>
  pipe(R.get(value, key), O.filter(P.isString));

const hasSupersessionPointer = (raw: Readonly<Record<string, unknown>>): boolean => {
  const topLevel = O.isSome(stringAt(raw, "supersededBy")) || O.isSome(stringAt(raw, "supersededNote"));
  const initiative = pipe(R.get(raw, "initiative"), O.filter(isJsonRecord));
  const nested = O.isSome(O.flatMap(initiative, (block) => stringAt(block, "supersededBy")));
  return topLevel || nested;
};

/**
 * Where a packet's `provenance.exploration` path points, as a goal-packet reader sees it.
 *
 * **Details**
 *
 * `escapes` is an absolute path or one that leaves the repository root; `present` and `absent` say
 * whether the contained path exists in the reader's tree.
 *
 * **Example** (Recognize a missing back-link target)
 *
 * ```ts
 * import { GoalExplorationPathState } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * console.log(GoalExplorationPathState.is.absent("absent")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalExplorationPathState = LiteralKit(["present", "absent", "escapes"]).pipe(
  $I.annoteSchema("GoalExplorationPathState", {
    description: "Whether a packet's exploration back-link path exists, is missing, or leaves the repository.",
  })
);

/**
 * Where a packet's `provenance.exploration` path points.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalExplorationPathState = typeof GoalExplorationPathState.Type;

/**
 * The packet-adjacent reads the goals packet core needs beyond its {@link GoalPacketRecord}.
 *
 * **Details**
 *
 * `beep goals doctor` reads the working filesystem through {@link makeGoalPacketFilesystemReader};
 * the knowledge doctor reads one Git tree through its own reader, so both report the same packet
 * findings from the same {@link goalPacketFindings} core. `reflectionFiles` lists the file names
 * directly under `<packetPath>/history/reflections` (empty when the directory is absent).
 *
 * @category services
 * @since 0.0.0
 */
export interface GoalPacketReader<E, R> {
  readonly explorationPath: (exploration: string) => Effect.Effect<GoalExplorationPathState, E, R>;
  readonly readReflection: (packetPath: string, file: string) => Effect.Effect<string, E, R>;
  readonly reflectionFiles: (packetPath: string) => Effect.Effect<ReadonlyArray<string>, E, R>;
}

const filesystemExplorationPath = Effect.fn("Goals.filesystemExplorationPath")(function* (exploration: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const resolvedExploration = path.resolve(repoRoot, exploration);
  const pathEscapesRepo =
    path.isAbsolute(exploration) ||
    Str.startsWith("//")(exploration) ||
    Str.startsWith("\\\\")(exploration) ||
    !isPathWithinRoot(repoRoot, resolvedExploration);
  if (pathEscapesRepo) {
    return GoalExplorationPathState.Enum.escapes;
  }
  const exists = yield* fs.exists(resolvedExploration).pipe(Effect.orElseSucceed(thunkFalse));
  return exists ? GoalExplorationPathState.Enum.present : GoalExplorationPathState.Enum.absent;
});

const filesystemReflectionFiles = Effect.fn("Goals.filesystemReflectionFiles")(function* (packetPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const reflectionsDir = path.join(packetPath, "history", "reflections");
  const reflectionsDirExists = yield* fs.exists(reflectionsDir).pipe(Effect.orElseSucceed(thunkFalse));
  return reflectionsDirExists
    ? yield* fs.readDirectory(reflectionsDir).pipe(Effect.orElseSucceed(A.empty<string>))
    : A.empty<string>();
});

const filesystemReadReflection = Effect.fn("Goals.filesystemReadReflection")(function* (
  packetPath: string,
  file: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .readFileString(path.join(packetPath, "history", "reflections", file))
    .pipe(Effect.orElseSucceed(thunkEmptyStr));
});

/**
 * Builds the goal-packet reader over the working filesystem, the reader `beep goals doctor` uses.
 *
 * **Details**
 *
 * Unreadable reflection directories and files read as empty, and an exploration back-link resolves
 * against the repository root found from the working directory.
 *
 * **Example** (Build the filesystem reader)
 *
 * ```ts
 * import { makeGoalPacketFilesystemReader } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * const reader = makeGoalPacketFilesystemReader()
 *
 * console.log(typeof reader.reflectionFiles) // "function"
 * ```
 *
 * @returns A reader whose reads need `FileSystem` and `Path`.
 * @category constructors
 * @since 0.0.0
 */
export const makeGoalPacketFilesystemReader = () => ({
  explorationPath: filesystemExplorationPath,
  readReflection: filesystemReadReflection,
  reflectionFiles: filesystemReflectionFiles,
});

const reflectionArtifactFindings = Effect.fn("Goals.reflectionArtifactFindings")(function* <E, R>(
  record: GoalPacketRecord,
  reader: GoalPacketReader<E, R>
) {
  // Reflection frontmatter must decode in ANY packet (the PR #365 YAML traps
  // hid in the completed-only gap).
  let findings = A.empty<GoalDoctorFinding>();
  const files = yield* reader.reflectionFiles(record.packetPath);
  for (const file of A.sort(A.filter(files, reflectionFileNameIsArtifact), Order.String)) {
    const raw = yield* reader.readReflection(record.packetPath, file);
    const valid = yield* reflectionFrontmatterIsValid(raw);
    if (!valid) {
      findings = A.append(
        findings,
        finding(
          record.slug,
          "reflection-frontmatter-invalid",
          "blocking",
          `history/reflections/${file} has missing or invalid ReflectionFrontmatter.`,
          file
        )
      );
    }
  }
  return findings;
});

const statusConsistencyFindings = (
  record: GoalPacketRecord,
  manifest: GoalManifest
): ReadonlyArray<GoalDoctorFinding> => {
  let findings = A.empty<GoalDoctorFinding>();
  const push = (item: GoalDoctorFinding): void => {
    findings = A.append(findings, item);
  };
  const status = manifest.initiative.status;

  if (manifest.lifecycle !== undefined && manifest.lifecycle !== status) {
    push(
      finding(
        record.slug,
        "lifecycle-mismatch",
        "blocking",
        `initiative.status "${status}" != lifecycle "${manifest.lifecycle}".`
      )
    );
  }

  const readmeToken = pipe(O.fromUndefinedOr(record.readmeText), O.flatMap(readmeLifecycleToken));
  if (O.isNone(readmeToken)) {
    push(
      finding(
        record.slug,
        "readme-status-line",
        "blocking",
        'README.md has no recognizable "Lifecycle:" status line (see goals/_template/README.md).'
      )
    );
  } else if (readmeToken.value !== status) {
    push(
      finding(
        record.slug,
        "readme-status-line",
        "blocking",
        `README Lifecycle line says "${readmeToken.value}" but the manifest says "${status}".`
      )
    );
  }

  const phases = goalManifestPhases(manifest);
  if (
    GoalStatus.is.active(status) &&
    A.isReadonlyArrayNonEmpty(phases) &&
    A.every(phases, (phase) => GoalPhaseStatus.is.complete(phase.status))
  ) {
    push(
      finding(
        record.slug,
        "phases-terminal-but-active",
        "blocking",
        `all ${A.length(phases)} phases are complete but the packet is still "active".`
      )
    );
  }

  return findings;
};

const manifestAdvisoryFindings = (
  record: GoalPacketRecord,
  manifest: GoalManifest,
  raw: Readonly<Record<string, unknown>>
): ReadonlyArray<GoalDoctorFinding> => {
  let findings = A.empty<GoalDoctorFinding>();
  const push = (item: GoalDoctorFinding): void => {
    findings = A.append(findings, item);
  };
  const status = manifest.initiative.status;

  if (GoalStatus.is.active(status) && record.goalMdChars === undefined) {
    push(finding(record.slug, "active-missing-goal-md", "advisory", "active packet has no GOAL.md launcher."));
  }

  if (manifest.schemaVersion !== "initiative-manifest/v2") {
    push(
      finding(
        record.slug,
        "schema-version-upgrade",
        "advisory",
        `manifest declares ${manifest.schemaVersion === undefined ? "no schemaVersion" : `"${manifest.schemaVersion}"`}; upgrade to "initiative-manifest/v2".`
      )
    );
  }

  if (GoalStatus.is.superseded(status) && !hasSupersessionPointer(raw)) {
    push(
      finding(
        record.slug,
        "superseded-without-pointer",
        "advisory",
        "superseded packet carries no supersededBy/supersededNote."
      )
    );
  }

  return findings;
};

const decodedManifestFindings = (
  record: GoalPacketRecord,
  manifest: GoalManifest,
  raw: Readonly<Record<string, unknown>>
): ReadonlyArray<GoalDoctorFinding> =>
  A.appendAll(statusConsistencyFindings(record, manifest), manifestAdvisoryFindings(record, manifest, raw));

const explorationBacklinkFindings = Effect.fn("Goals.explorationBacklinkFindings")(function* <E, R>(
  record: GoalPacketRecord,
  raw: Readonly<Record<string, unknown>>,
  reader: GoalPacketReader<E, R>
) {
  const provenance = pipe(R.get(raw, "provenance"), O.filter(isJsonRecord));
  const exploration = O.flatMap(provenance, (block) => stringAt(block, "exploration"));
  if (O.isNone(exploration)) {
    return A.empty<GoalDoctorFinding>();
  }
  const state = yield* reader.explorationPath(exploration.value);
  return GoalExplorationPathState.$match(state, {
    present: () => A.empty<GoalDoctorFinding>(),
    escapes: () =>
      A.of(
        finding(
          record.slug,
          "exploration-backlink-missing",
          "advisory",
          `provenance.exploration "${exploration.value}" is an invalid path; expected a path contained within the repository root.`
        )
      ),
    absent: () =>
      A.of(
        finding(
          record.slug,
          "exploration-backlink-missing",
          "advisory",
          `provenance.exploration "${exploration.value}" does not exist in the working tree.`
        )
      ),
  });
});

/**
 * The goals packet core: every packet-local goals-doctor finding of one packet, plus its decoded
 * manifest.
 *
 * **Details**
 *
 * Reflection frontmatter, launcher size, manifest presence and decoding, status consistency, the
 * manifest advisories, and the exploration back-link. Git-history advisories and capability findings
 * span packets and are computed by the caller. The reader decides where packet-adjacent files come
 * from, which is what lets the knowledge doctor list the same findings from a Git tree.
 *
 * **Example** (Check a packet with no manifest)
 *
 * ```ts
 * import { goalPacketFindings, makeGoalPacketFilesystemReader } from "@beep/repo-cli/commands/Goals/Doctor"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as Effect from "effect/Effect"
 *
 * const record = GoalPacketRecord.make({
 *   slug: "demo",
 *   packetPath: "goals/demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   readmePath: "goals/demo/README.md",
 * })
 *
 * console.log(Effect.isEffect(goalPacketFindings(record, makeGoalPacketFilesystemReader()))) // true
 * ```
 *
 * @param record - Packet surfaces read by the caller's inventory.
 * @param reader - Source of reflection files and exploration back-link targets.
 * @returns The packet's findings in emission order and its manifest when it decodes.
 * @category validation
 * @since 0.0.0
 */
export const goalPacketFindings = Effect.fn("Goals.packetFindings")(function* <E, R>(
  record: GoalPacketRecord,
  reader: GoalPacketReader<E, R>
) {
  let findings = yield* reflectionArtifactFindings(record, reader);

  if (record.goalMdChars !== undefined && record.goalMdChars > GOAL_MD_MAX_CHARS) {
    findings = A.append(
      findings,
      finding(
        record.slug,
        "goal-md-oversize",
        "blocking",
        `GOAL.md is ${record.goalMdChars} chars (hard maximum ${GOAL_MD_MAX_CHARS}).`
      )
    );
  }

  if (record.manifestText === undefined) {
    findings = A.append(
      findings,
      finding(record.slug, "manifest-missing", "blocking", "ops/manifest.json is missing.")
    );
    return { findings, manifest: O.none<GoalManifest>() };
  }
  const parsed = parseGoalManifestText(record.manifestText);
  if (O.isNone(parsed)) {
    findings = A.append(
      findings,
      finding(record.slug, "manifest-invalid", "blocking", "ops/manifest.json does not parse as JSON.")
    );
    return { findings, manifest: O.none<GoalManifest>() };
  }
  const raw = parsed.value as Readonly<Record<string, unknown>>;
  const decoded = yield* decodeGoalManifest(parsed.value).pipe(
    Effect.asSome,
    Effect.orElseSucceed(O.none<GoalManifest>)
  );
  if (O.isNone(decoded)) {
    const issue = yield* decodeGoalManifest(parsed.value).pipe(
      Effect.flip,
      Effect.map((error) => error.message),
      Effect.orElseSucceed(() => "unknown decode failure")
    );
    findings = A.append(
      findings,
      finding(
        record.slug,
        "manifest-invalid",
        "blocking",
        `ops/manifest.json does not decode as GoalManifest: ${pipe(issue, Str.replace(/\s+/g, " "), Str.slice(0, 200))}`
      )
    );
    return { findings, manifest: O.none<GoalManifest>() };
  }

  findings = A.appendAll(findings, decodedManifestFindings(record, decoded.value, raw));
  findings = A.appendAll(findings, yield* explorationBacklinkFindings(record, raw, reader));
  return { findings, manifest: O.some(decoded.value) };
});

const gitAdapter: GitCommandErrorAdapter<GoalsGitError> = {
  onSpawnFailure: (commandLine) => (cause) => GoalsGitError.new(`spawn ${commandLine}: ${String(cause)}`),
  onNonZeroExit: ({ commandLine, exitCode }) => GoalsGitError.new(`${commandLine} exited with ${exitCode}`),
  onTruncated: O.none(),
};

const gitOutputOrNone = Effect.fn("Goals.gitOutputOrNone")(function* (args: ReadonlyArray<string>) {
  return yield* runGitOutput(".", args, gitAdapter).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
});

type DoctorPacket = {
  readonly record: GoalPacketRecord;
  readonly manifest: O.Option<GoalManifest>;
  readonly raw: O.Option<Readonly<Record<string, unknown>>>;
};

// The slugs whose packet paths appear in the staleness window's git log.
const touchedSlugs = (recentPathsText: string): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    pipe(
      recentPathsText,
      Str.split("\n"),
      A.map(Str.trim),
      A.filter(Str.startsWith("goals/")),
      A.map(flow(Str.split("/"), A.get(1), O.getOrElse(thunkEmptyStr)))
    )
  );

// A squash merge's subject ends with its PR number and a merge commit's starts
// with "Merge pull request"; every other subject is an ordinary commit.
const SQUASH_SUBJECT_PATTERN = /\(#\d+\)$/;
const MERGE_COMMIT_SUBJECT_PATTERN = /^Merge pull request #\d+/;
const isMergeSubject = (subject: string): boolean =>
  SQUASH_SUBJECT_PATTERN.test(subject) || MERGE_COMMIT_SUBJECT_PATTERN.test(subject);

// Citation tokens are whole words: a slug or a "#N" reference, split on
// anything that cannot be part of either, so "#123" never matches "#1234" and
// a short slug never matches the inside of another word.
const CITATION_SEPARATOR = /[^A-Za-z0-9#-]+/;
const citationTokens = (subjects: ReadonlyArray<string>): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.flatMap(subjects, (subject) => Str.split(subject, CITATION_SEPARATOR)));

const subjectLines = (subjectsText: string): ReadonlyArray<string> =>
  pipe(subjectsText, Str.split("\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));

const recordedPullRequest = (packet: DoctorPacket): O.Option<string> =>
  pipe(
    packet.raw,
    O.flatMap((raw) => R.get(raw, "mergedPullRequest")),
    O.map((value) => `#${String(value)}`)
  );

// A subject cites the packet by its slug or by its recorded PR number, as a
// whole token.
const citedBy = (packet: DoctorPacket, tokens: HashSet.HashSet<string>): boolean =>
  HashSet.has(tokens, packet.record.slug) ||
  O.exists(recordedPullRequest(packet), (value) => HashSet.has(tokens, value));

// The completion gate keeps its looser substring reading: a packet shipped
// under a branch name such as feature/beep-<slug> is still cited, and the
// committed baseline was recorded against that reading.
const citedAnywhere = (packet: DoctorPacket, subjectsText: string): boolean =>
  Str.includes(packet.record.slug)(subjectsText) ||
  O.exists(recordedPullRequest(packet), (value) => Str.includes(value)(subjectsText));

// A statusNote or a non-empty blockedBy is the packet's own account of why it
// is still open; both staleness-shaped advisories defer to it.
const hasOpenContext = (manifest: GoalManifest): boolean =>
  manifest.statusNote !== undefined || (manifest.blockedBy !== undefined && A.length(manifest.blockedBy) > 0);

const stalenessAdvisories = (
  packets: ReadonlyArray<DoctorPacket>,
  recentPathsText: string,
  excluded: HashSet.HashSet<string>
): ReadonlyArray<GoalDoctorFinding> => {
  const touched = touchedSlugs(recentPathsText);
  let findings = A.empty<GoalDoctorFinding>();
  for (const packet of packets) {
    if (O.isNone(packet.manifest) || HashSet.has(excluded, packet.record.slug)) {
      continue;
    }
    const manifest = packet.manifest.value;
    if (
      GoalStatus.is.active(manifest.initiative.status) &&
      !HashSet.has(touched, packet.record.slug) &&
      !hasOpenContext(manifest)
    ) {
      findings = A.append(
        findings,
        finding(
          packet.record.slug,
          "stale-active",
          "advisory",
          `active packet untouched for ${STALE_ACTIVE_DAYS}+ days with no blockedBy/statusNote.`
        )
      );
    }
  }
  return findings;
};

// An active packet that a merge/squash commit already cites and that nobody
// has touched since the staleness window opened is the "shipped, never
// closed" shape: the lifecycle flip belonged in the PR that cited it. A
// statusNote or blockedBy is the packet saying it stays open on purpose, so
// it silences this advisory exactly as it silences stale-active; the plain
// stale-active advisory is suppressed for the same packet.
const activeAfterMergeAdvisories = (
  packets: ReadonlyArray<DoctorPacket>,
  subjectsText: string,
  recentPathsText: string
): ReadonlyArray<GoalDoctorFinding> => {
  const touched = touchedSlugs(recentPathsText);
  const tokens = citationTokens(A.filter(subjectLines(subjectsText), isMergeSubject));
  let findings = A.empty<GoalDoctorFinding>();
  for (const packet of packets) {
    if (O.isNone(packet.manifest)) {
      continue;
    }
    const manifest = packet.manifest.value;
    if (
      GoalStatus.is.active(manifest.initiative.status) &&
      manifest.completionGate.requiresPullRequest &&
      !hasOpenContext(manifest) &&
      !HashSet.has(touched, packet.record.slug) &&
      citedBy(packet, tokens)
    ) {
      findings = A.append(
        findings,
        finding(
          packet.record.slug,
          "active-after-merge",
          "advisory",
          `active packet is cited by a merge/squash commit and untouched for ${STALE_ACTIVE_DAYS}+ days; flip its lifecycle in a closeout PR or record the next PR in statusNote.`
        )
      );
    }
  }
  return findings;
};

const completionGateAdvisories = (
  packets: ReadonlyArray<DoctorPacket>,
  subjectsText: string
): ReadonlyArray<GoalDoctorFinding> => {
  let findings = A.empty<GoalDoctorFinding>();
  for (const packet of packets) {
    if (O.isNone(packet.manifest)) {
      continue;
    }
    const manifest = packet.manifest.value;
    if (!GoalStatus.is["completed-retained"](manifest.initiative.status) || manifest.completionGate.grandfathered) {
      continue;
    }
    if (!citedAnywhere(packet, subjectsText)) {
      findings = A.append(
        findings,
        finding(
          packet.record.slug,
          "completion-gate-unsatisfied",
          "advisory",
          "completed-retained but no merge/squash commit cites the packet (completionGate not grandfathered)."
        )
      );
    }
  }
  return findings;
};

const gitAdvisories = Effect.fn("Goals.gitAdvisories")(function* (packets: ReadonlyArray<DoctorPacket>) {
  let findings = A.empty<GoalDoctorFinding>();
  let notes = A.empty<string>();

  const shallow = yield* gitOutputOrNone(["rev-parse", "--is-shallow-repository"]);
  if (O.isNone(shallow)) {
    return {
      findings,
      notes: A.append(notes, "git history unavailable; staleness/completion-gate advisories skipped."),
    };
  }
  if (Str.trim(shallow.value) === "true") {
    return {
      findings,
      notes: A.append(notes, "shallow git checkout; staleness/completion-gate advisories skipped."),
    };
  }

  // Single-pass staleness walk: every path under goals/ touched in the window.
  const recentPaths = yield* gitOutputOrNone([
    "log",
    `--since=${STALE_ACTIVE_DAYS}.days`,
    "--name-only",
    "--format=",
    "--",
    "goals/",
  ]);
  // Single-pass completion-gate heuristic: merge/squash subjects citing the
  // packet slug or the packet's recorded PR number.
  const subjects = yield* gitOutputOrNone(["log", "--format=%s", "-n", "4000"]);

  // Shipped-but-open packets first: they take the slot the plain staleness
  // advisory would otherwise fill for the same slug.
  const afterMerge =
    O.isSome(subjects) && O.isSome(recentPaths)
      ? activeAfterMergeAdvisories(packets, subjects.value, recentPaths.value)
      : A.empty<GoalDoctorFinding>();
  findings = A.appendAll(findings, afterMerge);

  if (O.isSome(recentPaths)) {
    findings = A.appendAll(
      findings,
      stalenessAdvisories(packets, recentPaths.value, HashSet.fromIterable(A.map(afterMerge, (item) => item.slug)))
    );
  } else {
    notes = A.append(notes, "git log for staleness failed; staleness advisories skipped.");
  }

  if (O.isSome(subjects)) {
    findings = A.appendAll(findings, completionGateAdvisories(packets, subjects.value));
  } else {
    notes = A.append(notes, "git log for completion gates failed; completion-gate advisories skipped.");
  }

  return { findings, notes };
});

/**
 * Capability findings over a compiled projection (D5, D8).
 *
 * **Details**
 *
 * - `capability-duplicate-declaration` (blocking, ratcheted): a packet lists the
 *   same slug twice in `provides` or in `requires`.
 * - `capability-reference-provides` (blocking, ratcheted): a `reference` packet
 *   declares `provides`. Reference packets document; they never build.
 * - `capability-stranded` (advisory): every provider of a capability is
 *   superseded, so the superseding packet never re-declared it. One finding per
 *   superseded provider.
 *
 * Keys embed the edge and capability, so each declaration ratchets on its own.
 *
 * **Example** (An empty projection has no capability findings)
 *
 * ```ts
 * import { capabilityDoctorFindings } from "@beep/repo-cli/commands/Goals/Doctor"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(capabilityDoctorFindings(projection)) // []
 * ```
 *
 * @param projection - Capability projection compiled from the decodable manifests.
 * @returns Duplicate, reference-provides, and stranded findings.
 * @category validation
 * @since 0.0.0
 */
export const capabilityDoctorFindings = (projection: CapabilityProjection): ReadonlyArray<GoalDoctorFinding> => {
  const duplicates = A.map(projection.duplicates, (duplicate) =>
    finding(
      duplicate.packetId,
      "capability-duplicate-declaration",
      "blocking",
      `declares ${duplicate.capability} more than once in ${duplicate.edge}; list each capability once.`,
      `${duplicate.edge} ${duplicate.capability}`
    )
  );
  const perCapability = A.flatMap(projection.capabilities, (capability) => {
    const providers = capabilityProviderRows(projection, capability);
    const referenceProvides = pipe(
      providers,
      A.filter((row) => row.providerStatus === "reference"),
      A.map((row) =>
        finding(
          row.provider,
          "capability-reference-provides",
          "blocking",
          `reference packet declares provides ${capability}; reference packets never satisfy readiness, so move the declaration to the packet that builds it.`,
          capability
        )
      )
    );
    const stranded = isStrandedProviderSet(providers)
      ? A.map(providers, (row) =>
          finding(
            row.provider,
            "capability-stranded",
            "advisory",
            `${capability} is declared only by superseded packets; the superseding packet must re-declare it.`,
            capability
          )
        )
      : A.empty<GoalDoctorFinding>();
    return A.appendAll(referenceProvides, stranded);
  });
  return A.appendAll(duplicates, perCapability);
};

/**
 * Capability findings over every decodable packet manifest.
 *
 * **Details**
 *
 * The capability graph only admits a manifest whose `initiative.id` equals its
 * packet directory, the same law `goals next|explain|catalog` enforces and the
 * `goals/INDEX.md` graph applies. A manifest that breaks it is left out of the
 * projection and gets a blocking `capability-packet-id-mismatch` finding. Because
 * packet directories are unique, this also covers two packets sharing an id, so
 * the projection never sees a duplicate and the doctor never aborts.
 *
 * **Example** (No packets yield no capability findings)
 *
 * ```ts
 * import { capabilityPacketFindings } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * console.log(capabilityPacketFindings([])) // []
 * ```
 *
 * @param packets - Packet slugs with their decoded manifest, when it decoded.
 * @returns Id-mismatch findings followed by the projection's capability findings.
 * @category validation
 * @since 0.0.0
 */
export const capabilityPacketFindings = (
  packets: ReadonlyArray<{ readonly slug: string; readonly manifest: O.Option<GoalManifest> }>
): ReadonlyArray<GoalDoctorFinding> => {
  const decoded = A.getSomes(
    A.map(packets, (packet) => O.map(packet.manifest, (manifest) => ({ slug: packet.slug, manifest })))
  );
  const matchesDirectory = (entry: (typeof decoded)[number]) => entry.manifest.initiative.id === entry.slug;
  const admitted = A.filter(decoded, matchesDirectory);
  const mismatched = A.filter(decoded, (entry) => !matchesDirectory(entry));
  const mismatches = A.map(mismatched, (entry) =>
    finding(
      entry.slug,
      "capability-packet-id-mismatch",
      "blocking",
      `initiative.id ${entry.manifest.initiative.id} does not match the packet directory goals/${entry.slug}; the capability graph leaves this packet out until they agree.`,
      entry.manifest.initiative.id
    )
  );
  return A.appendAll(
    mismatches,
    capabilityDoctorFindings(compileCapabilityProjection(A.map(admitted, (entry) => entry.manifest)))
  );
};

const findingLine = (item: GoalDoctorFinding): string => `- ${item.slug} [${item.kind}] ${item.message}`;

/**
 * Run the goals doctor: collect findings, ratchet blocking ones against the
 * committed baseline, and fail on new blocking findings.
 *
 * **Example** (Verify doctor returns Effect)
 *
 * ```ts
 * import { runGoalsDoctor } from "@beep/repo-cli/commands/Goals/Doctor"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runGoalsDoctor({ writeBaseline: false })))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
const writeDoctorBaseline = Effect.fn("Goals.writeDoctorBaseline")(function* (
  blocking: ReadonlyArray<GoalDoctorFinding>
) {
  const fs = yield* FileSystem.FileSystem;
  const baseline = GoalsDoctorBaseline.make({
    schemaVersion: "goals-doctor-baseline/v1",
    note: "Inherited goals-doctor findings (advisory). New findings block. This baseline may only shrink; regenerate with bun run beep goals doctor --write-baseline after burning findings down.",
    findings: A.sort(
      A.map(blocking, (item) => item.key),
      Order.String
    ),
  });
  const encoded = yield* encodeBaseline(baseline);
  const rendered = yield* SchemaGetter.run(stringifyBaseline, O.some(encoded), {});
  yield* fs.writeFileString(GOALS_DOCTOR_BASELINE_PATH, `${O.getOrElse(rendered, thunkEmptyStr)}\n`);
  yield* Console.log(`[goals:doctor] wrote ${GOALS_DOCTOR_BASELINE_PATH} with ${A.length(blocking)} finding key(s).`);
});

const loadDoctorBaselineKeys = Effect.fn("Goals.loadDoctorBaselineKeys")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const baselineText = yield* fs
    .readFileString(GOALS_DOCTOR_BASELINE_PATH)
    .pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  if (O.isNone(baselineText)) {
    return A.empty<string>();
  }
  const parsedBaseline = parseGoalManifestText(baselineText.value);
  if (O.isNone(parsedBaseline)) {
    yield* Console.error(`[goals:doctor] ${GOALS_DOCTOR_BASELINE_PATH} does not parse as JSONC.`);
    return yield* failWithReportedExit("goals doctor: baseline unreadable.", 2);
  }
  return yield* decodeBaseline(parsedBaseline.value).pipe(
    Effect.map((baseline) => baseline.findings),
    Effect.catchTag("SchemaError", (error) =>
      Console.error(`[goals:doctor] baseline does not decode: ${error.message}`).pipe(
        Effect.andThen(failWithReportedExit("goals doctor: baseline invalid.", 2))
      )
    )
  );
});

// Prints a header and its lines on stderr, or nothing when there are no lines.
const printErrorSection = Effect.fn("Goals.printErrorSection")(function* (
  header: string,
  lines: ReadonlyArray<string>
) {
  if (A.isReadonlyArrayEmpty(lines)) {
    return;
  }
  yield* Console.error(header);
  yield* Effect.forEach(lines, (line) => Console.error(line), { discard: true });
});

const printNonFatalFindings = Effect.fn("Goals.printNonFatalFindings")(function* (input: {
  readonly notes: ReadonlyArray<string>;
  readonly advisories: ReadonlyArray<GoalDoctorFinding>;
  readonly classified: GoalDoctorClassification;
}) {
  yield* Effect.forEach(input.notes, (note) => Console.log(`[goals:doctor] note: ${note}`), { discard: true });
  yield* printErrorSection("[goals:doctor] advisories (non-fatal):", A.map(input.advisories, findingLine));
  yield* printErrorSection(
    "[goals:doctor] inherited baseline findings (non-fatal, burn down over time):",
    A.map(input.classified.inherited, findingLine)
  );
  yield* printErrorSection(
    `[goals:doctor] ${A.length(input.classified.resolved)} baseline finding(s) resolved — shrink the baseline with --write-baseline:`,
    A.map(input.classified.resolved, (key) => `- ${key}`)
  );
});

/**
 * Run the goals doctor: collect findings, ratchet blocking ones against the
 * committed baseline, and fail on new blocking findings.
 *
 * **Example** (Verify doctor returns Effect)
 *
 * ```ts
 * import { runGoalsDoctor } from "@beep/repo-cli/commands/Goals/Doctor"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runGoalsDoctor({ writeBaseline: false })))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsDoctor = Effect.fn("Goals.runGoalsDoctor")(function* (options: {
  readonly writeBaseline: boolean;
}) {
  const records = yield* listGoalPackets();
  const reader = makeGoalPacketFilesystemReader();

  const packets: Array<DoctorPacket & { readonly findings: ReadonlyArray<GoalDoctorFinding> }> = [];
  for (const record of records) {
    const result = yield* goalPacketFindings(record, reader);
    const raw = pipe(
      O.fromUndefinedOr(record.manifestText),
      O.flatMap(parseGoalManifestText),
      O.map((value) => value as Readonly<Record<string, unknown>>)
    );
    packets.push({ record, manifest: result.manifest, raw, findings: result.findings });
  }

  const advisoriesFromGit = yield* gitAdvisories(packets);
  const capabilityFindings = capabilityPacketFindings(
    A.map(packets, (packet) => ({ slug: packet.record.slug, manifest: packet.manifest }))
  );
  const allFindings = [
    ...A.flatMap(packets, (packet) => packet.findings),
    ...capabilityFindings,
    ...advisoriesFromGit.findings,
  ];
  const blocking = A.filter(allFindings, (item) => item.severity === "blocking");
  const advisories = A.filter(allFindings, (item) => item.severity === "advisory");

  if (options.writeBaseline) {
    return yield* writeDoctorBaseline(blocking);
  }

  const baselineKeys = yield* loadDoctorBaselineKeys();
  const classified = classifyGoalDoctorFindings(blocking, baselineKeys);

  yield* Console.log(
    `[goals:doctor] packets=${A.length(records)} blocking_new=${A.length(classified.introduced)} blocking_inherited=${A.length(classified.inherited)} baseline_resolved=${A.length(classified.resolved)} advisories=${A.length(advisories)}`
  );
  yield* printNonFatalFindings({ notes: advisoriesFromGit.notes, advisories, classified });

  if (A.isReadonlyArrayNonEmpty(classified.introduced)) {
    yield* Console.error("[goals:doctor] NEW blocking findings (not in baseline):");
    for (const item of classified.introduced) {
      yield* Console.error(findingLine(item));
    }
    return yield* failWithReportedExit("goals doctor: new blocking findings detected.");
  }

  yield* Console.log("[goals:doctor] OK: no new blocking findings.");
});

const writeBaselineFlag = Flag.Boolean("write-baseline").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Capture the current blocking findings as the committed baseline (may only shrink)")
);

/**
 * `bun run beep goals doctor` — packet-drift findings with a baseline ratchet.
 *
 * **Example** (Log doctor command name)
 *
 * ```ts
 * import { goalsDoctorCommand } from "@beep/repo-cli/commands/Goals/Doctor"
 *
 * console.log(goalsDoctorCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsDoctorCommand = Command.make(
  "doctor",
  { writeBaseline: writeBaselineFlag },
  Effect.fn(function* ({ writeBaseline }) {
    yield* runGoalsDoctor({ writeBaseline });
  })
).pipe(Command.withDescription("Diff goal-packet manifest claims against git/filesystem evidence (baseline ratchet)"));
