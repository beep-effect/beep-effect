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
import { Console, Effect, FileSystem, HashSet, Order, Path, SchemaGetter } from "effect";
import { dual, flow } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { diffMembership } from "../../internal/ratchet/RatchetDiff.ts";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { reflectionFileNameIsArtifact, reflectionFrontmatterIsValid } from "../Lint/ReflectionArtifact.ts";
import { GoalsGitError } from "./Goals.errors.ts";
import { decodeGoalManifest, GoalPhaseStatus, GoalStatus } from "./Goals.schemas.ts";
import {
  goalManifestPhases,
  isJsonRecord,
  listGoalPackets,
  parseGoalManifestText,
  readmeLifecycleToken,
} from "./Inventory.ts";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type { GoalManifest } from "./Goals.schemas.ts";
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
  "packet-fleet-duplicate-slug",
  "packet-fleet-dependency-cycle",
  "packet-fleet-unreachable",
  "packet-fleet-unmigrated-reference",
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

const reflectionArtifactFindings = Effect.fn("Goals.reflectionArtifactFindings")(function* (record: GoalPacketRecord) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Reflection frontmatter must decode in ANY packet (the PR #365 YAML traps
  // hid in the completed-only gap).
  const reflectionsDir = path.join(record.packetPath, "history", "reflections");
  const reflectionsDirExists = yield* fs.exists(reflectionsDir).pipe(Effect.orElseSucceed(thunkFalse));
  if (!reflectionsDirExists) {
    return A.empty<GoalDoctorFinding>();
  }
  let findings = A.empty<GoalDoctorFinding>();
  const files = yield* fs.readDirectory(reflectionsDir).pipe(Effect.orElseSucceed(A.empty<string>));
  for (const file of A.sort(A.filter(files, reflectionFileNameIsArtifact), Order.String)) {
    const raw = yield* fs.readFileString(path.join(reflectionsDir, file)).pipe(Effect.orElseSucceed(thunkEmptyStr));
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

const explorationBacklinkFindings = Effect.fn("Goals.explorationBacklinkFindings")(function* (
  record: GoalPacketRecord,
  raw: Readonly<Record<string, unknown>>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const provenance = pipe(R.get(raw, "provenance"), O.filter(isJsonRecord));
  const exploration = O.flatMap(provenance, (block) => stringAt(block, "exploration"));
  if (O.isNone(exploration)) {
    return A.empty<GoalDoctorFinding>();
  }
  const repoRoot = yield* findRepoRoot();
  const resolvedExploration = path.resolve(repoRoot, exploration.value);
  const pathEscapesRepo =
    path.isAbsolute(exploration.value) ||
    Str.startsWith("//")(exploration.value) ||
    Str.startsWith("\\\\")(exploration.value) ||
    !isPathWithinRoot(repoRoot, resolvedExploration);
  if (pathEscapesRepo) {
    return A.of(
      finding(
        record.slug,
        "exploration-backlink-missing",
        "advisory",
        `provenance.exploration "${exploration.value}" is an invalid path; expected a path contained within the repository root.`
      )
    );
  }
  const exists = yield* fs.exists(resolvedExploration).pipe(Effect.orElseSucceed(thunkFalse));
  if (exists) {
    return A.empty<GoalDoctorFinding>();
  }
  return A.of(
    finding(
      record.slug,
      "exploration-backlink-missing",
      "advisory",
      `provenance.exploration "${exploration.value}" does not exist in the working tree.`
    )
  );
});

const packetFindings = Effect.fn("Goals.packetFindings")(function* (record: GoalPacketRecord) {
  let findings = yield* reflectionArtifactFindings(record);

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
  findings = A.appendAll(findings, yield* explorationBacklinkFindings(record, raw));
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

const stalenessAdvisories = (
  packets: ReadonlyArray<DoctorPacket>,
  recentPathsText: string
): ReadonlyArray<GoalDoctorFinding> => {
  const touched = HashSet.fromIterable(
    pipe(
      recentPathsText,
      Str.split("\n"),
      A.map(Str.trim),
      A.filter(Str.startsWith("goals/")),
      A.map(flow(Str.split("/"), A.get(1), O.getOrElse(thunkEmptyStr)))
    )
  );
  let findings = A.empty<GoalDoctorFinding>();
  for (const packet of packets) {
    if (O.isNone(packet.manifest)) {
      continue;
    }
    const manifest = packet.manifest.value;
    const hasContext =
      manifest.statusNote !== undefined || (manifest.blockedBy !== undefined && A.length(manifest.blockedBy) > 0);
    if (GoalStatus.is.active(manifest.initiative.status) && !HashSet.has(touched, packet.record.slug) && !hasContext) {
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
    const prNumber = pipe(
      packet.raw,
      O.flatMap((raw) => R.get(raw, "mergedPullRequest")),
      O.map((value) => `#${String(value)}`)
    );
    const cited =
      Str.includes(packet.record.slug)(subjectsText) ||
      (O.isSome(prNumber) && Str.includes(prNumber.value)(subjectsText));
    if (!cited) {
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
  if (O.isSome(recentPaths)) {
    findings = A.appendAll(findings, stalenessAdvisories(packets, recentPaths.value));
  } else {
    notes = A.append(notes, "git log for staleness failed; staleness advisories skipped.");
  }

  // Single-pass completion-gate heuristic: merge/squash subjects citing the
  // packet slug or the packet's recorded PR number.
  const subjects = yield* gitOutputOrNone(["log", "--format=%s", "-n", "4000"]);
  if (O.isSome(subjects)) {
    findings = A.appendAll(findings, completionGateAdvisories(packets, subjects.value));
  } else {
    notes = A.append(notes, "git log for completion gates failed; completion-gate advisories skipped.");
  }

  return { findings, notes };
});

const findingLine = (item: GoalDoctorFinding): string => `- ${item.slug} [${item.kind}] ${item.message}`;

/**
 * Run the goals doctor: collect findings, ratchet blocking ones against the
 * committed baseline, and fail on new blocking findings.
 *
 * **Example** (Verify doctor returns Effect)
 *
 * ```ts
 * import { runGoalsDoctor } from "@beep/repo-cli/commands/Goals/Doctor"
 * import { Effect } from "effect"
 *
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
  const rendered = yield* stringifyBaseline.run(O.some(encoded), {});
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

const printNonFatalFindings = Effect.fn("Goals.printNonFatalFindings")(function* (input: {
  readonly notes: ReadonlyArray<string>;
  readonly advisories: ReadonlyArray<GoalDoctorFinding>;
  readonly classified: GoalDoctorClassification;
}) {
  for (const note of input.notes) {
    yield* Console.log(`[goals:doctor] note: ${note}`);
  }

  if (A.isReadonlyArrayNonEmpty(input.advisories)) {
    yield* Console.error("[goals:doctor] advisories (non-fatal):");
    for (const item of input.advisories) {
      yield* Console.error(findingLine(item));
    }
  }

  if (A.isReadonlyArrayNonEmpty(input.classified.inherited)) {
    yield* Console.error("[goals:doctor] inherited baseline findings (non-fatal, burn down over time):");
    for (const item of input.classified.inherited) {
      yield* Console.error(findingLine(item));
    }
  }

  if (A.isReadonlyArrayNonEmpty(input.classified.resolved)) {
    yield* Console.error(
      `[goals:doctor] ${A.length(input.classified.resolved)} baseline finding(s) resolved — shrink the baseline with --write-baseline:`
    );
    for (const key of input.classified.resolved) {
      yield* Console.error(`- ${key}`);
    }
  }
});

/**
 * Run the goals doctor: collect findings, ratchet blocking ones against the
 * committed baseline, and fail on new blocking findings.
 *
 * **Example** (Verify doctor returns Effect)
 *
 * ```ts
 * import { runGoalsDoctor } from "@beep/repo-cli/commands/Goals/Doctor"
 * import { Effect } from "effect"
 *
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

  const packets: Array<DoctorPacket & { readonly findings: ReadonlyArray<GoalDoctorFinding> }> = [];
  for (const record of records) {
    const result = yield* packetFindings(record);
    const raw = pipe(
      O.fromUndefinedOr(record.manifestText),
      O.flatMap(parseGoalManifestText),
      O.map((value) => value as Readonly<Record<string, unknown>>)
    );
    packets.push({ record, manifest: result.manifest, raw, findings: result.findings });
  }

  const advisoriesFromGit = yield* gitAdvisories(packets);
  const allFindings = [...A.flatMap(packets, (packet) => packet.findings), ...advisoriesFromGit.findings];
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

const writeBaselineFlag = Flag.boolean("write-baseline").pipe(
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
