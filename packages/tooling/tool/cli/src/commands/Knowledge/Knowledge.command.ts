/**
 * `beep knowledge` command definitions: the Stage-1 semantic delta and the phase-0 reference census.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { Console, Effect, Match, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import {
  KnowledgeHostPathDebtError,
  KnowledgeIntroducedFindingsError,
  KnowledgeOperationalError,
} from "./Knowledge.errors.ts";
import {
  encodeKnowledgeRefsReportJson,
  KnowledgeRefClassification,
  KnowledgeRefSurface,
  KnowledgeRefSurfaceFilter,
  knowledgeRefsLiveDebt,
} from "./Knowledge.refs.ts";
import {
  encodeKnowledgeSemanticDeltaReportJson,
  KNOWLEDGE_PROBE_DEPENDENT_KINDS,
  KnowledgeProbePolicy,
} from "./Knowledge.schemas.ts";
import { KnowledgeService, KnowledgeServiceLive } from "./Knowledge.service.ts";
import type { KnowledgeRef, KnowledgeRefObservation, KnowledgeRefsReport } from "./Knowledge.refs.ts";
import type { KnowledgeFinding, KnowledgeSemanticDeltaReport } from "./Knowledge.schemas.ts";

const baseFlag = Flag.string("base").pipe(
  Flag.withDescription("Local base ref used to resolve the merge-base; the command never fetches"),
  Flag.withDefault("origin/main")
);
const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Render the semantic delta as JSON"));
const treeFlag = Flag.string("tree").pipe(
  Flag.withDescription("Commit-ish whose tracked tree is censused; the command never fetches"),
  Flag.withDefault("HEAD")
);
const surfaceFlag = Flag.choiceWithValue("surface", [
  ["all", KnowledgeRefSurfaceFilter.Enum.all],
  ["live", KnowledgeRefSurfaceFilter.Enum.live],
  ["archival", KnowledgeRefSurfaceFilter.Enum.archival],
]).pipe(
  Flag.withDefault(KnowledgeRefSurfaceFilter.Enum.all),
  Flag.withDescription("Narrow the detailed listing; summary counts stay whole-corpus")
);
const refsJsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Render the whole census as JSON"));
const refsCheckFlag = Flag.boolean("check").pipe(
  Flag.withDescription("Fail when any live observation sits in a gated host-path class")
);

const renderFinding = (finding: KnowledgeFinding): string =>
  `  ${finding.findingId} ${finding.kind} ${finding.location.path}: ${finding.message}`;

const indentDetail = (detail: string): string =>
  A.join(
    A.map(Str.split(/\r?\n/u)(detail), (line) => `  ${line}`),
    "\n"
  );

// A skipped run must never read as a clean one, so the missing coverage is named on the same line
// as the policy rather than left for the reader to infer from absent findings, and an involuntary
// skip prints the failure that caused it right underneath.
const renderProbePolicy = (report: KnowledgeSemanticDeltaReport): string => {
  if (KnowledgeProbePolicy.is.enabled(report.probePolicy)) {
    return `probe-policy: ${report.probePolicy}`;
  }
  const line = `probe-policy: ${report.probePolicy} (not checked: ${A.join(KNOWLEDGE_PROBE_DEPENDENT_KINDS, ", ")})`;
  return O.match(report.probeSkipDetail, {
    onNone: () => line,
    onSome: (detail) => `${line}\n${indentDetail(detail)}`,
  });
};

/**
 * Renders a semantic-delta report for local human inspection.
 *
 * **Example** (Render an empty enabled report)
 *
 * ```ts
 * import { KnowledgeSemanticDeltaReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { renderKnowledgeSemanticDeltaHumanReport } from "@beep/repo-cli/test/Knowledge"
 *
 * const output = renderKnowledgeSemanticDeltaHumanReport(
 *   KnowledgeSemanticDeltaReport.make({
 *     introduced: [],
 *     resolved: [],
 *     unchanged: [],
 *     probePolicy: "enabled",
 *   })
 * )
 *
 * console.log(output.includes("introduced (0)")) // true
 * ```
 *
 * @internal
 * @param report - Paired-archive delta to format.
 * @returns A stable multiline summary of probe policy and finding buckets.
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeSemanticDeltaHumanReport = (report: KnowledgeSemanticDeltaReport): string => {
  const section = (label: string, findings: ReadonlyArray<KnowledgeFinding>): string =>
    A.join([`${label} (${A.length(findings)})`, ...A.map(findings, renderFinding)], "\n");
  return A.join(
    [
      renderProbePolicy(report),
      section("introduced", report.introduced),
      section("resolved", report.resolved),
      section("unchanged", report.unchanged),
    ],
    "\n"
  );
};

/**
 * The failure a semantic-delta report gates on, if any.
 *
 * **Details**
 *
 * This is the whole gate rule: only findings this branch introduced can fail the lane. Inherited
 * findings sit in `unchanged` — the corpus carries hundreds of them — and findings the branch fixed
 * sit in `resolved`; neither bucket is ever consulted here. Stage-1 evaluators mint `blocking`
 * findings only, so every introduced finding is a blocker.
 *
 * **Example** (A report with nothing introduced does not gate)
 *
 * ```ts
 * import { knowledgeSemanticDeltaFailure } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import { KnowledgeSemanticDeltaReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeSemanticDeltaReport.make({
 *   introduced: [],
 *   resolved: [],
 *   unchanged: [],
 *   probePolicy: "enabled",
 * })
 *
 * console.log(O.isNone(knowledgeSemanticDeltaFailure(report))) // true
 * ```
 *
 * @param report - Paired-archive delta produced for the branch under test.
 * @returns The typed failure when the branch introduced findings, `O.none()` otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const knowledgeSemanticDeltaFailure = (
  report: KnowledgeSemanticDeltaReport
): O.Option<KnowledgeIntroducedFindingsError> =>
  A.isReadonlyArrayNonEmpty(report.introduced)
    ? O.some(
        KnowledgeIntroducedFindingsError.make({
          message: `knowledge semantic-delta: ${A.length(report.introduced)} introduced blocking finding(s).`,
          introducedCount: NonNegativeInt.make(A.length(report.introduced)),
        })
      )
    : O.none();

const runSemanticDelta = Effect.fn("KnowledgeCommand.runSemanticDelta")(function* (options: {
  readonly base: string;
  readonly json: boolean;
}) {
  const knowledge = yield* KnowledgeService;
  const report = yield* knowledge.semanticDelta(options.base);
  if (options.json) {
    const json = yield* encodeKnowledgeSemanticDeltaReportJson(report).pipe(
      KnowledgeOperationalError.mapError("Failed to encode the semantic-delta JSON report.")
    );
    yield* Console.log(json);
  } else {
    yield* Console.log(renderKnowledgeSemanticDeltaHumanReport(report));
  }
  yield* O.match(knowledgeSemanticDeltaFailure(report), { onNone: () => Effect.void, onSome: Effect.fail });
});

/**
 * The `beep knowledge semantic-delta` subcommand.
 *
 * **Details**
 *
 * The report always prints — human-readable by default, one JSON line under `--json` — before the
 * exit status is decided, so a failing run still shows its findings. Introduced blocking findings
 * then fail the command; resolved and unchanged findings never do. `--base` names a purely local
 * ref: the command resolves a merge-base against it and never fetches.
 *
 * **Gotchas**
 *
 * Probe coverage is lost in two ways, and both the human report and the JSON `probePolicy` field say
 * which one happened. On a pull request from a fork the run declines to run current-checkout probes
 * against archive data (`skipped-untrusted-context`). When the probe cannot interpret merge-base
 * data, the run degrades instead of failing (`skipped-base-boot-failure`) and prints the boot failure
 * under the policy line. Read that line before treating an empty `introduced` bucket as full
 * coverage.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { knowledgeSemanticDeltaCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 *
 * console.log(knowledgeSemanticDeltaCommand.name) // "semantic-delta"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeSemanticDeltaCommand = Command.make(
  "semantic-delta",
  { base: baseFlag, json: jsonFlag },
  runSemanticDelta
).pipe(
  Command.withDescription("Report findings introduced between merge-base and HEAD archives"),
  Command.provide(KnowledgeServiceLive)
);

const TOP_DOCUMENT_COUNT = 10;

const refSubject = (ref: KnowledgeRef): string =>
  Match.value(ref).pipe(
    Match.discriminatorsExhaustive("kind")({
      "repo-path": (repoPath) => repoPath.normalized,
      "host-path": (hostPath) => `${hostPath.anchor} ${hostPath.raw}`,
      "goal-uri": (goalUri) => `repo://goal/${goalUri.slug}`,
    })
  );

const renderObservation = (observation: KnowledgeRefObservation): string => {
  const line = O.getOrElse(O.fromNullishOr(observation.location.line), () => 0);
  const column = O.getOrElse(O.fromNullishOr(observation.location.column), () => 0);
  return `  ${observation.classification} ${observation.location.path}:${line}:${column} ${refSubject(observation.ref)}`;
};

const classificationCounts = (report: KnowledgeRefsReport): ReadonlyArray<string> =>
  A.map(KnowledgeRefClassification.Options, (classification) => {
    const count = A.length(
      A.filter(report.observations, (observation) => observation.classification === classification)
    );
    return `  ${Str.padEnd(26)(classification)} ${count}`;
  });

/** Highest observation density first, then path, so the census listing is stable across runs. */
type DocumentDensity = {
  readonly documentId: string;
  readonly count: number;
};

const densityOrder: Order.Order<DocumentDensity> = Order.combine(
  Order.mapInput(Order.Number, (row: DocumentDensity) => -row.count),
  Order.mapInput(Order.String, (row: DocumentDensity) => row.documentId)
);

const topDocuments = (report: KnowledgeRefsReport): ReadonlyArray<string> =>
  pipe(
    A.groupBy(report.observations, (observation) => observation.documentId),
    R.toEntries,
    A.map(([documentId, group]): DocumentDensity => ({ documentId, count: A.length(group) })),
    A.sort(densityOrder),
    A.take(TOP_DOCUMENT_COUNT),
    A.map((row) => `  ${row.count} ${row.documentId}`)
  );

const renderRefsReport = (report: KnowledgeRefsReport, surface: KnowledgeRefSurfaceFilter): string => {
  const live = A.length(
    A.filter(report.observations, (observation) => KnowledgeRefSurface.is.live(observation.surface))
  );
  const archival = A.length(report.observations) - live;
  const listed = KnowledgeRefSurfaceFilter.is.all(surface)
    ? report.observations
    : A.filter(report.observations, (observation) => observation.surface === surface);
  return A.join(
    [
      `knowledge refs @ ${report.treeish} (${report.commit})`,
      `observations: ${A.length(report.observations)} (live ${live}, archival ${archival})`,
      `skipped: ${A.length(report.skipped)}`,
      ...A.map(report.skipped, (blob) => `  ${blob.reason} ${blob.path}`),
      "classification:",
      ...classificationCounts(report),
      "top documents:",
      ...topDocuments(report),
      `observations (${surface}) (${A.length(listed)}):`,
      ...A.map(listed, renderObservation),
    ],
    "\n"
  );
};

/**
 * The failure a checked census gates on, if any.
 *
 * **Details**
 *
 * This is the whole `--check` rule: any live observation in a gated host-path class
 * (`actionable-host-path`, `external-mirror-reference`) fails the run. Archival observations and
 * convention or pattern classes never gate, so the census can keep measuring captured history
 * while the live surface holds at zero.
 *
 * **Example** (A debt-free census does not gate)
 *
 * ```ts
 * import { knowledgeRefsCheckFailure } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import { KnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeRefsReport.make({
 *   treeish: "HEAD",
 *   commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   observations: [],
 *   skipped: [],
 * })
 *
 * console.log(O.isNone(knowledgeRefsCheckFailure(report))) // true
 * ```
 *
 * @param report - Census produced for the tree under test.
 * @returns The typed failure when live gated observations exist, `O.none()` otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const knowledgeRefsCheckFailure = (report: KnowledgeRefsReport): O.Option<KnowledgeHostPathDebtError> => {
  const debt = knowledgeRefsLiveDebt(report);
  return A.isReadonlyArrayNonEmpty(debt)
    ? O.some(
        KnowledgeHostPathDebtError.make({
          message: `knowledge refs --check: ${A.length(debt)} live host-path observation(s).`,
          liveDebtCount: NonNegativeInt.make(A.length(debt)),
        })
      )
    : O.none();
};

/**
 * Renders the `--check` section a checked census prints before its exit status is decided.
 *
 * **Example** (Render a debt-free check section)
 *
 * ```ts
 * import { KnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import { renderKnowledgeRefsCheckSection } from "@beep/repo-cli/test/Knowledge"
 *
 * const section = renderKnowledgeRefsCheckSection(
 *   KnowledgeRefsReport.make({
 *     treeish: "HEAD",
 *     commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *     observations: [],
 *     skipped: [],
 *   })
 * )
 *
 * console.log(section) // "check: 0 live gated observation(s)"
 * ```
 *
 * @internal
 * @param report - Census produced for the tree under test.
 * @returns The check headline plus one rendered line per live gated observation.
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeRefsCheckSection = (report: KnowledgeRefsReport): string => {
  const debt = knowledgeRefsLiveDebt(report);
  return A.join([`check: ${A.length(debt)} live gated observation(s)`, ...A.map(debt, renderObservation)], "\n");
};

const runRefs = Effect.fn("KnowledgeCommand.runRefs")(function* (options: {
  readonly tree: string;
  readonly surface: KnowledgeRefSurfaceFilter;
  readonly json: boolean;
  readonly check: boolean;
}) {
  const knowledge = yield* KnowledgeService;
  const report = yield* knowledge.refsTree(options.tree);
  if (options.json) {
    const json = yield* encodeKnowledgeRefsReportJson(report).pipe(
      KnowledgeOperationalError.mapError("Failed to encode the reference census JSON report.")
    );
    yield* Console.log(json);
  } else {
    yield* Console.log(renderRefsReport(report, options.surface));
  }
  if (options.check) {
    if (!options.json) {
      yield* Console.log(renderKnowledgeRefsCheckSection(report));
    }
    yield* O.match(knowledgeRefsCheckFailure(report), { onNone: () => Effect.void, onSome: Effect.fail });
  }
});

/**
 * The `beep knowledge refs` subcommand.
 *
 * **Details**
 *
 * A read-only census of every reference in the agent-facing corpus of one Git tree, resolved against
 * that tree's tracked entries rather than against the working filesystem. `--tree` accepts any
 * commit-ish and defaults to `HEAD`; no fetch ever occurs. Human output prints the whole-corpus
 * totals, the count of every one of the twelve classes including the empty ones, the highest-density
 * documents, and then the per-observation listing. `--json` emits the complete report on one line.
 *
 * **Gotchas**
 *
 * `--surface` narrows the detailed listing only — the totals and the class table stay whole-corpus,
 * and `--json` always carries every observation — so a filtered run can never be mistaken for a
 * smaller census. Without `--check` the command exits zero for every observation mix: it measures
 * the corpus and gates nothing. `--check` is the standing gate the phase-0 eyeball unlocked: after
 * the report prints, any live observation in a gated host-path class fails the run, while archival,
 * convention, and pattern classes never do.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { knowledgeRefsCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 *
 * console.log(knowledgeRefsCommand.name) // "refs"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeRefsCommand = Command.make(
  "refs",
  { tree: treeFlag, surface: surfaceFlag, json: refsJsonFlag, check: refsCheckFlag },
  runRefs
).pipe(
  Command.withDescription("Census every reference in one tracked tree; --check gates on live host-path debt"),
  Command.provide(KnowledgeServiceLive)
);

/**
 * The `beep knowledge` command family root.
 *
 * **Details**
 *
 * Running it without a subcommand lists the available knowledge-surface verifications rather than
 * scanning, so the family root stays cheap and side-effect free.
 *
 * **Example** (Reach the subcommands from the family root)
 *
 * ```ts
 * import { knowledgeCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import * as A from "effect/Array"
 *
 * const subcommands = A.flatMap(knowledgeCommand.subcommands, (group) => group.commands)
 *
 * console.log(knowledgeCommand.name) // "knowledge"
 * console.log(A.map(subcommands, (command) => command.name)) // [ "refs", "semantic-delta" ]
 * ```
 *
 * @see {@link knowledgeRefsCommand} for the read-only phase-0 census.
 * @see {@link knowledgeSemanticDeltaCommand} for the gating Stage-1 comparison.
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeCommand = Command.make("knowledge", {}, () =>
  Console.log(
    "Knowledge commands: refs [--tree <rev>] [--surface live|archival|all] [--json] [--check], semantic-delta [--base <ref>] [--json]"
  )
).pipe(
  Command.withDescription("Knowledge-surface verification commands"),
  Command.withSubcommands([knowledgeRefsCommand, knowledgeSemanticDeltaCommand])
);
