/**
 * `beep knowledge` command definitions: the Stage-1 semantic delta and the phase-0 reference census.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isCi } from "../../internal/cli/EnvConfig.ts";
import {
  KnowledgeHostPathDebtError,
  KnowledgeIntroducedFindingsError,
  KnowledgeMintContextRefusal,
  KnowledgeOperationalError,
} from "./Knowledge.errors.ts";
import {
  encodeKnowledgeRefsReportJson,
  isKnowledgeRefQuietClassification,
  KnowledgeRefClassification,
  KnowledgeRefQuietClassification,
  KnowledgeRefSurface,
  KnowledgeRefSurfaceFilter,
  knowledgeRefsLiveDebt,
} from "./Knowledge.refs.ts";
import {
  encodeKnowledgeSemanticDeltaReportJson,
  KNOWLEDGE_PROBE_DEPENDENT_KINDS,
  KnowledgeFindingKind,
  KnowledgeProbePolicy,
} from "./Knowledge.schemas.ts";
import { KnowledgeService, KnowledgeServiceLive } from "./Knowledge.service.ts";
import { isKnowledgeGovernanceKind, knowledgeDoctorGateFailure } from "./KnowledgeDoctor.baseline.ts";
import { encodeKnowledgeLeasesReportJson, knowledgeLeaseWarnings } from "./KnowledgeDoctor.leases.ts";
import {
  KNOWLEDGE_MINT_BRANCH,
  KnowledgeDoctorCiMode,
  knowledgeMintPullRequestRefusals,
  readKnowledgeMintPullRequest,
} from "./KnowledgeDoctor.mint.ts";
import { encodeKnowledgeDoctorReportJson, KnowledgeSpanClass } from "./KnowledgeDoctor.schemas.ts";
import {
  KnowledgeDoctor,
  KnowledgeDoctorCheckOptions,
  KnowledgeDoctorLeasesOptions,
  KnowledgeDoctorLive,
  KnowledgeDoctorMintOptions,
} from "./KnowledgeDoctor.service.ts";
import type { KnowledgeRef, KnowledgeRefObservation, KnowledgeRefsReport } from "./Knowledge.refs.ts";
import type { KnowledgeFinding, KnowledgeFindingId, KnowledgeSemanticDeltaReport } from "./Knowledge.schemas.ts";
import type { KnowledgeLeasesReport } from "./KnowledgeDoctor.leases.ts";
import type { KnowledgeMintOutcome } from "./KnowledgeDoctor.mint.ts";
import type {
  KnowledgeCauseGroup,
  KnowledgeDoctorRatchet,
  KnowledgeDoctorReport,
  KnowledgeRootAttribution,
} from "./KnowledgeDoctor.schemas.ts";

const baseFlag = Flag.String("base").pipe(
  Flag.withDescription("Local base ref used to resolve the merge-base; the command never fetches"),
  Flag.withDefault("origin/main")
);
const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the semantic delta as JSON")
);
const treeFlag = Flag.String("tree").pipe(
  Flag.withDescription("Commit-ish whose tracked tree is censused; the command never fetches"),
  Flag.withDefault("HEAD")
);
const surfaceFlag = Flag.ChoiceWithValue("surface", [
  ["all", KnowledgeRefSurfaceFilter.Enum.all],
  ["live", KnowledgeRefSurfaceFilter.Enum.live],
  ["archival", KnowledgeRefSurfaceFilter.Enum.archival],
]).pipe(
  Flag.withDefault(KnowledgeRefSurfaceFilter.Enum.all),
  Flag.withDescription("Narrow the detailed listing; summary counts stay whole-corpus")
);
const refsJsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the whole census as JSON")
);
const refsVerboseFlag = Flag.Boolean("verbose").pipe(
  Flag.withDefault(false),
  Flag.withDescription("List every skipped blob and every informational-class observation instead of per-class counts")
);
const refsCheckFlag = Flag.Boolean("check").pipe(
  Flag.withDefault(false),
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
          introducedCount: S.Natural.make(A.length(report.introduced)),
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
    Match.discriminator("kind")("repo-path", (repoPath) => repoPath.normalized),
    Match.discriminator("kind")("host-path", (hostPath) => `${hostPath.anchor} ${hostPath.raw}`),
    Match.discriminator("kind")("goal-uri", (goalUri) => `repo://goal/${goalUri.slug}`),
    Match.exhaustive
  );

const renderObservation = (observation: KnowledgeRefObservation): string => {
  const line = O.getOrElse(O.fromNullishOr(observation.location.line), () => 0);
  const column = O.getOrElse(O.fromNullishOr(observation.location.column), () => 0);
  return `  ${observation.classification} ${observation.location.path}:${line}:${column} ${refSubject(observation.ref)}`;
};

const classificationCounts = (report: KnowledgeRefsReport): ReadonlyArray<string> =>
  A.map(KnowledgeRefClassification.literals, (classification) => {
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

const OMITTED_HINT = "row(s) omitted (--verbose lists them)";
/** Fold label for the skipped-blob rows; distinct from the `skipped:` header total on purpose. */
const SKIPPED_FOLD_LABEL = "skipped-blobs";

// Per-class row counts of the quiet observations in one listing, keyed by quiet class.
const quietClassCounts = (
  observations: ReadonlyArray<KnowledgeRefObservation>
): HashMap.HashMap<KnowledgeRefQuietClassification, number> =>
  pipe(
    observations,
    A.map((observation) => observation.classification),
    A.map(O.liftPredicate(isKnowledgeRefQuietClassification)),
    A.getSomes,
    A.reduce(HashMap.empty<KnowledgeRefQuietClassification, number>(), (counts, classification) =>
      HashMap.modifyAt(
        counts,
        classification,
        flow(
          O.getOrElse(() => 0),
          (count) => O.some(count + 1)
        )
      )
    )
  );

// One omitted-count line per quiet class with rows in the listing, in classification-domain order.
const quietClassLines = (observations: ReadonlyArray<KnowledgeRefObservation>): ReadonlyArray<string> => {
  const counts = quietClassCounts(observations);
  return A.getSomes(
    A.map(KnowledgeRefQuietClassification.literals, (classification) =>
      O.map(HashMap.get(counts, classification), (count) => `  ${classification}: ${count} ${OMITTED_HINT}`)
    )
  );
};

// The skipped-blob rows, or one omitted-count line standing in for them when the listing is quiet.
const skippedLines = (report: KnowledgeRefsReport, options: { readonly verbose: boolean }): ReadonlyArray<string> =>
  Match.value(options.verbose).pipe(
    Match.when(true, () => A.map(report.skipped, (blob) => `  ${blob.reason} ${blob.path}`)),
    Match.when(false, () =>
      A.isReadonlyArrayNonEmpty(report.skipped)
        ? [`  ${SKIPPED_FOLD_LABEL}: ${A.length(report.skipped)} ${OMITTED_HINT}`]
        : []
    ),
    Match.exhaustive
  );

/**
 * Renders a reference census with informational rows summarized unless verbose output is requested.
 *
 * **Details**
 *
 * The surface filter narrows the listing only; summary counts remain whole-corpus. The listing
 * header counts every observation in the requested surface, including the rows it folds. Without
 * `--verbose`, rows in a quiet class ({@link KnowledgeRefQuietClassification}) and the skipped-blob
 * rows collapse to one `<class>: N row(s) omitted` line per non-empty class (the skipped fold is
 * labelled `skipped-blobs` so it never reads as the `skipped:` header total); rows in every other
 * class always print, so a broken target is never hidden behind a count. Which rows the `--check`
 * gate decides on is unaffected: it reads the report, never this listing.
 *
 * **Example** (Render an empty census)
 *
 * ```ts
 * import { renderKnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import { KnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 *
 * const report = KnowledgeRefsReport.make({
 *   treeish: "HEAD",
 *   commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   observations: [],
 *   skipped: [],
 * })
 * console.log(renderKnowledgeRefsReport(report, "all", { verbose: false }))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeRefsReport: {
  (surface: KnowledgeRefSurfaceFilter, options: { readonly verbose: boolean }): (report: KnowledgeRefsReport) => string;
  (report: KnowledgeRefsReport, surface: KnowledgeRefSurfaceFilter, options: { readonly verbose: boolean }): string;
} = dual(
  3,
  (report: KnowledgeRefsReport, surface: KnowledgeRefSurfaceFilter, options: { readonly verbose: boolean }): string => {
    const live = A.length(
      A.filter(report.observations, (observation) => KnowledgeRefSurface.is.live(observation.surface))
    );
    const archival = A.length(report.observations) - live;
    const listed = KnowledgeRefSurfaceFilter.is.all(surface)
      ? report.observations
      : A.filter(report.observations, (observation) => observation.surface === surface);
    const visible = options.verbose
      ? listed
      : A.filter(listed, (observation) => !isKnowledgeRefQuietClassification(observation.classification));
    return A.join(
      [
        `knowledge refs @ ${report.treeish} (${report.commit})`,
        `observations: ${A.length(report.observations)} (live ${live}, archival ${archival})`,
        `skipped: ${A.length(report.skipped)}`,
        ...skippedLines(report, options),
        "classification:",
        ...classificationCounts(report),
        "top documents:",
        ...topDocuments(report),
        `observations (${surface}) (${A.length(listed)}):`,
        ...A.map(visible, renderObservation),
        ...(options.verbose ? [] : quietClassLines(listed)),
      ],
      "\n"
    );
  }
);

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
          liveDebtCount: S.Natural.make(A.length(debt)),
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

/**
 * Prints the `--check` section unless JSON is requested, then fails when live host-path debt exists.
 *
 * **Example** (A debt-free report does not fail)
 *
 * ```ts
 * import { applyKnowledgeRefsCheck } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import { KnowledgeRefsReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.refs"
 * import * as Effect from "effect/Effect";
 * const report = KnowledgeRefsReport.make({
 *   treeish: "HEAD",
 *   commit: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   observations: [],
 *   skipped: [],
 * })
 *
 * console.log(Effect.isEffect(applyKnowledgeRefsCheck(report, { json: true }))) // true
 * ```
 *
 * @internal
 * @param report - Census produced for the tree under test.
 * @param options - `json` skips the human check section because JSON already carried the census.
 * @returns An effect that logs the section and fails on live gated observations.
 * @category use-cases
 * @since 0.0.0
 */
export const applyKnowledgeRefsCheck = Effect.fn("KnowledgeCommand.applyRefsCheck")(function* (
  report: KnowledgeRefsReport,
  options: { readonly json: boolean }
) {
  if (!options.json) {
    yield* Console.log(renderKnowledgeRefsCheckSection(report));
  }
  yield* O.match(knowledgeRefsCheckFailure(report), { onNone: () => Effect.void, onSome: Effect.fail });
});

const runRefs = Effect.fn("KnowledgeCommand.runRefs")(function* (options: {
  readonly tree: string;
  readonly surface: KnowledgeRefSurfaceFilter;
  readonly json: boolean;
  readonly check: boolean;
  readonly verbose: boolean;
}) {
  const knowledge = yield* KnowledgeService;
  const report = yield* knowledge.refsTree(options.tree);
  if (options.json) {
    const json = yield* encodeKnowledgeRefsReportJson(report).pipe(
      KnowledgeOperationalError.mapError("Failed to encode the reference census JSON report.")
    );
    yield* Console.log(json);
  } else {
    yield* Console.log(renderKnowledgeRefsReport(report, options.surface, { verbose: options.verbose }));
  }
  if (options.check) {
    yield* applyKnowledgeRefsCheck(report, { json: options.json });
  }
});

const knowledgeRefsRewriteCommand = Command.make(
  "rewrite",
  { dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)) },
  Effect.fn("Knowledge.refsRewrite")(function* ({ dryRun }) {
    const service = yield* KnowledgeService;
    const report = yield* service.rewriteRefs(dryRun);
    yield* Console.log(
      `knowledge-refs-rewrite: ${report.applied} applied, ${report.skipped} already-applied${dryRun ? " (dry run)" : ""}`
    );
    for (const failure of report.failures) yield* Console.error(`FAIL ${failure}`);
    if (report.failures.length > 0)
      return yield* KnowledgeOperationalError.make({
        message: "Knowledge reference rewrite drift; failed files were preserved.",
      });
  })
).pipe(Command.withDescription("Apply reviewed exact-count reference rewrites to the working tree"));

/**
 * The `beep knowledge refs` subcommand.
 *
 * **Details**
 *
 * A read-only census of every reference in the agent-facing corpus of one Git tree, resolved against
 * that tree's tracked entries rather than against the working filesystem. `--tree` accepts any
 * commit-ish and defaults to `HEAD`; no fetch ever occurs. Human output prints the whole-corpus
 * totals, the count of every one of the twelve classes including the empty ones, the highest-density
 * documents, and then the per-observation listing. Rows in an informational class (`verified`,
 * `archival-provenance`, `audit-pattern-literal`, and the documented home and temp conventions) and
 * the skipped-blob rows collapse to one `<class>: N row(s) omitted` line each unless `--verbose` is
 * set; every other class always lists its rows. `--json` emits the complete report on one line.
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
  { tree: treeFlag, surface: surfaceFlag, json: refsJsonFlag, check: refsCheckFlag, verbose: refsVerboseFlag },
  runRefs
).pipe(
  Command.withDescription("Census every reference in one tracked tree; --check gates on live host-path debt"),
  Command.withSubcommands([knowledgeRefsRewriteCommand]),
  Command.provide(KnowledgeServiceLive)
);

const doctorReportFlag = Flag.Boolean("report").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the read-only report: reads no baseline, writes nothing, exits 0 on findings")
);
const doctorJsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the whole doctor report, every finding included, as one JSON line")
);

// One line per finding kind present, in finding-kind domain order.
const doctorKindCounts = (report: KnowledgeDoctorReport): ReadonlyArray<string> =>
  A.getSomes(
    A.map(KnowledgeFindingKind.literals, (kind) =>
      pipe(
        A.length(A.filter(report.findings, (row) => row.finding.kind === kind)),
        O.liftPredicate((count) => count > 0),
        O.map((count) => `  ${Str.padEnd(34)(kind)} ${count}`)
      )
    )
  );

const renderAttribution = (attribution: KnowledgeRootAttribution): string =>
  pipe(
    attribution.repairTarget,
    O.map((target) => ` -> ${target}`),
    O.getOrElse(() => ""),
    (repair) =>
      ` ${attribution.change} ${attribution.removedPath} in ${Str.slice(0, 10)(attribution.commit)} "${attribution.subject}"${repair}`
  );

// One blocking root: its group and the split of its dependents by severity.
interface BlockingRoot {
  readonly advisory: number;
  readonly blocking: number;
  readonly group: KnowledgeCauseGroup;
}

// The per-root number counts blocking findings only (a blocking delegated root and its blocking
// dependents), so the lines add up to the headline; advisory dependents are named beside it.
const renderRoot = ({ advisory, blocking, group }: BlockingRoot): string =>
  `  ${Str.padStart(6)(`${blocking}`)} ${group.causeKey} [${group.rootOrigin}]${pipe(
    group.attribution,
    O.map(renderAttribution),
    O.getOrElse(() => "")
  )}${advisory > 0 ? ` (+${advisory} advisory)` : ""}`;

// Roots with the most blocking findings (root included) first; ties read in cause-key order.
const rootListingOrder: Order.Order<BlockingRoot> = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (root: BlockingRoot) => root.blocking)),
  Order.mapInput(Order.String, (root: BlockingRoot) => root.group.causeKey)
);

// A group is blocking when its delegated root or any dependent is a blocking finding.
const blockingRoots = (report: KnowledgeDoctorReport): ReadonlyArray<BlockingRoot> => {
  const blockingIds = HashSet.fromIterable(
    A.map(
      A.filter(report.findings, (row) => row.finding.severity === "blocking"),
      (row) => row.finding.findingId
    )
  );
  const isBlocking = (id: KnowledgeFindingId) => HashSet.has(blockingIds, id);
  // A blocking delegated root counts toward its own line, so the lines sum to the headline.
  const roots = A.map(report.groups, (group): BlockingRoot => {
    const dependents = A.length(A.filter(group.dependents, isBlocking));
    return {
      group,
      blocking: dependents + (O.exists(group.root, isBlocking) ? 1 : 0),
      advisory: A.length(group.dependents) - dependents,
    };
  });
  return A.filter(roots, (root) => root.blocking > 0);
};

const rootSummary = (report: KnowledgeDoctorReport): string => {
  const delegated = A.length(A.filter(report.groups, (group) => group.rootOrigin === "delegated"));
  const attributed = A.length(A.filter(report.groups, (group) => O.isSome(group.attribution)));
  return `cause groups (${A.length(report.groups)}; delegated ${delegated}; attributed ${attributed}; history ${report.rootHistory}):`;
};

/**
 * Renders a knowledge-doctor report for local human inspection.
 *
 * **Details**
 *
 * The headline names the tree, the per-class span totals (with how many `verified` spans failed, since
 * `verified` means checked at the tree, not passed), the unchecked option tokens, and the per-kind
 * finding totals. Blocking findings are shown as their causal roots, one line per cause group with
 * its blocking count (a blocking delegated root plus its blocking dependents, advisory dependents
 * named beside it), origin, and authoring commit,
 * most blocking findings first; advisory-only groups (the unclassified worklist) fold into one
 * count line, because `--json` carries every row, followed by the worklist's counts per evaluator
 * and its ten densest documents.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { KnowledgeDoctorReport, KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import { renderKnowledgeDoctorHumanReport } from "@beep/repo-cli/test/Knowledge"
 * import * as O from "effect/Option"
 *
 * const output = renderKnowledgeDoctorHumanReport(
 *   KnowledgeDoctorReport.make({
 *     treeish: "HEAD",
 *     tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *     mode: "report",
 *     spanCounts: KnowledgeSpanCounts.make({
 *       verified: 0,
 *       "generated-example": 0,
 *       "historical-with-commit": 0,
 *       unclassified: 0,
 *     }),
 *     uncheckedOptionCount: 0,
 *     rootHistory: "available",
 *     groups: [],
 *     findings: [],
 *     ratchet: O.none(),
 *   })
 * )
 *
 * console.log(output.includes("blocking findings (0)")) // true
 * ```
 *
 * @internal
 * @param report - Doctor report to format.
 * @returns A stable multiline summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeDoctorHumanReport = (report: KnowledgeDoctorReport): string => {
  const blocking = A.length(A.filter(report.findings, (row) => row.finding.severity === "blocking"));
  const roots = A.sort(blockingRoots(report), rootListingOrder);
  const advisory = A.length(report.findings) - blocking;
  return A.join(
    [
      `knowledge doctor --report @ ${report.treeish} (${report.tree})`,
      "spans:",
      ...A.map(
        KnowledgeSpanClass.literals,
        (spanClass) => `  ${Str.padEnd(24)(spanClass)} ${report.spanCounts[spanClass]}`
      ),
      verifiedNote(report),
      `unchecked options: ${report.uncheckedOptionCount}`,
      `findings (${A.length(report.findings)}):`,
      ...doctorKindCounts(report),
      rootSummary(report),
      `blocking findings (${blocking}) under ${A.length(roots)} root(s):`,
      ...A.map(roots, renderRoot),
      ...(advisory > 0 ? [`advisory findings: ${advisory} ${OMITTED_DOCTOR_HINT}`] : []),
      ...unclassifiedWorklist(report),
    ],
    "\n"
  );
};

const OMITTED_DOCTOR_HINT = "row(s) omitted (--json lists them)";
const UNCLASSIFIED_DOCUMENT_LIMIT = 10;

// Count pairs sorted by count descending, then key, so the listing reads the same on every run.
const countPairOrder: Order.Order<readonly [string, number]> = Order.combine(
  Order.flip(Order.mapInput(Order.Number, ([, count]: readonly [string, number]) => count)),
  Order.mapInput(Order.String, ([key]: readonly [string, number]) => key)
);

const countBy = (keys: ReadonlyArray<string>): ReadonlyArray<readonly [string, number]> =>
  A.sort(
    A.fromIterable(
      A.reduce(keys, HashMap.empty<string, number>(), (counts, key) =>
        HashMap.set(counts, key, O.getOrElse(HashMap.get(counts, key), () => 0) + 1)
      )
    ),
    countPairOrder
  );

// The K9 burn-down worklist by evaluator and by document (risk 3 of the C PR 2b verdict).
const unclassifiedWorklist = (report: KnowledgeDoctorReport): ReadonlyArray<string> => {
  const rows = A.filter(report.findings, (row) => row.finding.kind === "unclassified-reference-span");
  return A.match(rows, {
    onEmpty: () => [],
    onNonEmpty: (unclassified) => [
      `unclassified by evaluator: ${A.join(
        A.map(
          countBy(A.map(unclassified, (row) => O.getOrElse(row.evaluator, () => "none"))),
          ([evaluator, count]) => `${evaluator} ${count}`
        ),
        ", "
      )}`,
      `unclassified top documents (${UNCLASSIFIED_DOCUMENT_LIMIT}):`,
      ...A.map(
        A.take(countBy(A.map(unclassified, (row) => row.finding.location.path)), UNCLASSIFIED_DOCUMENT_LIMIT),
        ([path, count]) => `  ${Str.padStart(6)(`${count}`)} ${path}`
      ),
    ],
  });
};

// "verified" counts spans checked at the tree, failing ones included (risk 4 of the C PR 2b verdict).
const verifiedNote = (report: KnowledgeDoctorReport): string =>
  `  (verified = checked at the tree, not passed: ${A.length(
    A.filter(report.findings, (row) => row.spanClass === "verified" && row.origin === "owned")
  )} of them failed)`;

const doctorAcceptMintFlag = Flag.Boolean("accept-mint").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "CI-only: admit the mint App's baseline-only PR when mintedAt is an ancestor and the baseline re-mints byte for byte"
  )
);
const doctorBaseFlag = Flag.String("base").pipe(
  Flag.withDescription("Local base ref; its merge-base anchors the seal guard, leases, and promotions (never fetched)"),
  Flag.withDefault("origin/main")
);
const leasesJsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the lease report as one JSON line (yeet's verify step reads it)")
);

const renderRatchetRows = (
  report: KnowledgeDoctorReport,
  entries: KnowledgeDoctorRatchet["introduced"]
): ReadonlyArray<string> => {
  const byId = HashMap.fromIterable(A.map(report.findings, (row) => [row.finding.findingId, row] as const));
  return A.getSomes(
    A.map(entries, (entry) =>
      O.map(
        HashMap.get(byId, entry.findingId),
        (row) => `  ${row.finding.kind} ${row.finding.location.path}: ${row.finding.message}`
      )
    )
  );
};

/**
 * Renders a checked knowledge-doctor report: the ratchet buckets, introduced findings, and governance
 * findings.
 *
 * **Details**
 *
 * Introduced findings (promoted kinds with no baseline key or effective lease) and governance
 * findings (`baseline-tamper`, lease violations, expired leases) are listed one per line, since each
 * blocks; pending, inherited, leased, and resolved buckets print as counts.
 *
 * **Example** (A read-only report has no ratchet section)
 *
 * ```ts
 * import { KnowledgeDoctorReport, KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import { renderKnowledgeDoctorCheckReport } from "@beep/repo-cli/test/Knowledge"
 * import * as O from "effect/Option"
 *
 * const output = renderKnowledgeDoctorCheckReport(
 *   KnowledgeDoctorReport.make({
 *     treeish: "HEAD",
 *     tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *     mode: "report",
 *     spanCounts: KnowledgeSpanCounts.make({
 *       verified: 0,
 *       "generated-example": 0,
 *       "historical-with-commit": 0,
 *       unclassified: 0,
 *     }),
 *     uncheckedOptionCount: 0,
 *     rootHistory: "available",
 *     groups: [],
 *     findings: [],
 *     ratchet: O.none(),
 *   })
 * )
 *
 * console.log(output.includes("no ratchet")) // true
 * ```
 *
 * @internal
 * @param report - A checked doctor report.
 * @returns A stable multiline summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeDoctorCheckReport = (report: KnowledgeDoctorReport): string =>
  O.match(report.ratchet, {
    onNone: () => `knowledge doctor @ ${report.treeish} (${report.tree}): no ratchet (read-only report)`,
    onSome: (ratchet) => {
      const governance = A.filter(report.findings, (row) => isKnowledgeGovernanceKind(row.finding.kind));
      return A.join(
        [
          `knowledge doctor @ ${report.tree} vs ${ratchet.baseRef} (merge-base ${ratchet.mergeBase}); baseline minted at ${ratchet.mintedAt}`,
          `promoted kinds: ${A.isReadonlyArrayEmpty(ratchet.promotedKinds) ? "none (every kind is report-only)" : A.join(ratchet.promotedKinds, ", ")}`,
          `inherited ${A.length(ratchet.inherited)}, leased ${A.length(ratchet.leased)}, pending ${A.length(
            ratchet.pending
          )} (report-only kinds), resolved ${A.length(ratchet.resolved)}`,
          `introduced (${A.length(ratchet.introduced)}):`,
          ...renderRatchetRows(report, ratchet.introduced),
          `governance (${A.length(governance)}):`,
          ...A.map(governance, (row) => `  ${row.finding.kind} ${row.finding.location.path}: ${row.finding.message}`),
          ...A.map(ratchet.identityRejected, (line) => `identity sidecar mapping rejected: ${line}`),
        ],
        "\n"
      );
    },
  });

/**
 * Renders a lease report for local human inspection.
 *
 * **Example** (No leases)
 *
 * ```ts
 * import { KnowledgeLeasesReport } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import { renderKnowledgeLeasesReport } from "@beep/repo-cli/test/Knowledge"
 * import * as DateTime from "effect/DateTime"
 *
 * const output = renderKnowledgeLeasesReport(
 *   KnowledgeLeasesReport.make({
 *     tree: "1111111111111111111111111111111111111111",
 *     mergeBase: "2222222222222222222222222222222222222222",
 *     now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 *     leases: [],
 *   })
 * )
 *
 * console.log(output.includes("0 lease(s)")) // true
 * ```
 *
 * @internal
 * @param report - The lease report.
 * @returns A count line plus one line per lease that needs attention.
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeLeasesReport = (report: KnowledgeLeasesReport): string =>
  A.join(
    [
      `knowledge doctor leases @ ${report.tree} (merge-base ${report.mergeBase}): ${A.length(report.leases)} lease(s)`,
      ...knowledgeLeaseWarnings(report),
    ],
    "\n"
  );

// C8 condition (i): `--accept-mint` applies only in CI, to the mint App's pull request from the mint
// branch of this repository. The command checks it itself instead of trusting its caller.
const mintPullRequestReasons = Effect.gen(function* () {
  const ci = yield* isCi;
  const reasons = knowledgeMintPullRequestRefusals(yield* readKnowledgeMintPullRequest());
  return ci ? reasons : A.prepend(reasons, "CI is not true; --accept-mint is CI-only.");
});

const requireMintPullRequest = Effect.gen(function* () {
  const reasons = yield* mintPullRequestReasons;
  if (A.isReadonlyArrayNonEmpty(reasons)) {
    yield* Console.error(
      A.join(
        A.map(reasons, (reason) => `  ${reason}`),
        "\n"
      )
    );
    return yield* KnowledgeMintContextRefusal.make({
      message: `knowledge doctor --accept-mint: C8 condition (i) fails (${A.length(reasons)} reason(s)).`,
      reasons,
    });
  }
});

const runDoctorCheck = Effect.fn("KnowledgeCommand.runDoctorCheck")(function* (options: {
  readonly base: string;
  readonly acceptMint: boolean;
  readonly json: boolean;
}) {
  if (options.acceptMint) {
    yield* requireMintPullRequest;
  }
  const doctor = yield* KnowledgeDoctor;
  const report = yield* doctor.check(
    KnowledgeDoctorCheckOptions.make({
      baseRef: options.base,
      acceptMint: options.acceptMint,
      now: yield* DateTime.now,
    })
  );
  if (options.json) {
    const json = yield* encodeKnowledgeDoctorReportJson(report).pipe(
      KnowledgeOperationalError.mapError("Failed to encode the knowledge doctor JSON report.")
    );
    yield* Console.log(json);
  } else {
    yield* Console.log(renderKnowledgeDoctorCheckReport(report));
  }
  yield* O.match(knowledgeDoctorGateFailure(report), { onNone: () => Effect.void, onSome: Effect.fail });
});

const runDoctor = Effect.fn("KnowledgeCommand.runDoctor")(function* (options: {
  readonly report: boolean;
  readonly tree: string;
  readonly json: boolean;
  readonly base: string;
  readonly acceptMint: boolean;
}) {
  if (!options.report) {
    return yield* runDoctorCheck(options);
  }
  const doctor = yield* KnowledgeDoctor;
  const report = yield* doctor.report(options.tree);
  if (options.json) {
    const json = yield* encodeKnowledgeDoctorReportJson(report).pipe(
      KnowledgeOperationalError.mapError("Failed to encode the knowledge doctor JSON report.")
    );
    yield* Console.log(json);
  } else {
    yield* Console.log(renderKnowledgeDoctorHumanReport(report));
  }
});

const knowledgeDoctorVerifyMintCommand = Command.make(
  "verify-mint",
  {},
  Effect.fn("KnowledgeCommand.verifyMint")(function* () {
    const doctor = yield* KnowledgeDoctor;
    const minted = yield* doctor.verifyMint;
    yield* Console.log(
      `knowledge doctor verify-mint: the committed baseline reproduces at ${minted.mintedAt} (${A.length(minted.entries)} entries).`
    );
  })
).pipe(Command.withDescription("Re-mint the committed baseline at its mintedAt and byte-compare"));

const doctorMintAtFlag = Flag.String("at").pipe(
  Flag.withDescription("Commit-ish to mint; --write requires it to be HEAD"),
  Flag.withDefault("HEAD")
);
const doctorMintWriteFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "CI-only: write goals/knowledge-doctor.baseline.jsonc when the mint changes it (clean checkout, HEAD minted, on --base)"
  )
);

/**
 * Renders one mint outcome: the minted commit, entry counts per named group, and what was written.
 *
 * **Details**
 *
 * The output never carries the file text: the mint workflow writes the file itself, and a dry run is
 * a preview, not a way to hand-author the sealed baseline.
 *
 * **Example** (A dry run of an empty first seal)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_BASELINE_NOTE, KnowledgeDoctorBaseline } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeMintOutcome } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.mint"
 * import { renderKnowledgeMintOutcome } from "@beep/repo-cli/test/Knowledge"
 *
 * const output = renderKnowledgeMintOutcome(
 *   KnowledgeMintOutcome.make({
 *     baseline: KnowledgeDoctorBaseline.make({
 *       mintedAt: "1111111111111111111111111111111111111111",
 *       note: KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *       entries: [],
 *     }),
 *     text: "{}\n",
 *     changed: true,
 *   }),
 *   false
 * )
 *
 * console.log(output.includes("dry run")) // true
 * ```
 *
 * @internal
 * @param outcome - Entry counts per group and whether the minted text differs from the committed baseline.
 * @param write - Whether the run was allowed to write.
 * @returns A stable multiline summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderKnowledgeMintOutcome: {
  (write: boolean): (outcome: KnowledgeMintOutcome) => string;
  (outcome: KnowledgeMintOutcome, write: boolean): string;
} = dual(2, (outcome: KnowledgeMintOutcome, write: boolean): string =>
  A.join(
    [
      `knowledge doctor mint @ ${outcome.baseline.mintedAt}: ${A.length(outcome.baseline.entries)} sealed entr(ies)`,
      ...A.map(
        countBy(A.map(outcome.baseline.entries, (entry) => entry.group)),
        ([group, count]) => `  ${Str.padStart(6)(`${count}`)} ${group}`
      ),
      Match.value({ write, changed: outcome.changed }).pipe(
        Match.when(
          { changed: false },
          () => "unchanged: the committed baseline already holds these entries; nothing written"
        ),
        Match.when({ write: true }, () => "written: goals/knowledge-doctor.baseline.jsonc"),
        Match.orElse(() => "dry run: the baseline would change; nothing written (the mint workflow passes --write)")
      ),
    ],
    "\n"
  )
);

const knowledgeDoctorMintCommand = Command.make(
  "mint",
  { at: doctorMintAtFlag, base: doctorBaseFlag, write: doctorMintWriteFlag },
  Effect.fn("KnowledgeCommand.mint")(function* (options) {
    const doctor = yield* KnowledgeDoctor;
    const outcome = yield* doctor
      .mintFile(KnowledgeDoctorMintOptions.make({ at: options.at, baseRef: options.base, write: options.write }))
      .pipe(
        Effect.catchTags({
          KnowledgeMintRefusal: (refusal) =>
            Console.error(
              A.join(
                A.map(refusal.refused, (id) => `  refused ${id}`),
                "\n"
              )
            ).pipe(Effect.andThen(Effect.fail(refusal))),
          KnowledgeMintContextRefusal: (refusal) =>
            Console.error(
              A.join(
                A.map(refusal.reasons, (reason) => `  ${reason}`),
                "\n"
              )
            ).pipe(Effect.andThen(Effect.fail(refusal))),
        })
      );
    yield* Console.log(renderKnowledgeMintOutcome(outcome, options.write));
  })
).pipe(
  Command.withDescription(
    "Mint the sealed baseline at a default-branch commit; refuses to launder, and only --write in CI writes the file"
  )
);

const knowledgeDoctorCiCommand = Command.make(
  "ci",
  { base: doctorBaseFlag },
  Effect.fn("KnowledgeCommand.ci")(function* (options) {
    const doctor = yield* KnowledgeDoctor;
    const mode = yield* doctor.ciMode(options.base);
    if (mode === KnowledgeDoctorCiMode.Enum.report) {
      yield* Console.log(
        "knowledge doctor ci: no sealed baseline at the merge-base and none touched; read-only report."
      );
      return yield* runDoctor({ report: true, tree: "HEAD", json: false, base: options.base, acceptMint: false });
    }
    const reasons = yield* mintPullRequestReasons;
    yield* Console.log(
      A.isReadonlyArrayEmpty(reasons)
        ? `knowledge doctor ci: gate with --accept-mint (the mint App's pull request from ${KNOWLEDGE_MINT_BRANCH}).`
        : A.join(
            [
              "knowledge doctor ci: gate; baseline changes are baseline-tamper unless the CI mint opened this branch:",
              ...A.map(reasons, (reason) => `  ${reason}`),
            ],
            "\n"
          )
    );
    return yield* runDoctorCheck({ base: options.base, acceptMint: A.isReadonlyArrayEmpty(reasons), json: false });
  })
).pipe(
  Command.withDescription(
    "Quality-lane form: the read-only report until the merge-base is sealed or the branch touches the seal, then the gate"
  )
);

const knowledgeDoctorLeasesCommand = Command.make(
  "leases",
  { base: doctorBaseFlag, json: leasesJsonFlag },
  Effect.fn("KnowledgeCommand.leases")(function* (options) {
    const doctor = yield* KnowledgeDoctor;
    const report = yield* doctor.leases(
      KnowledgeDoctorLeasesOptions.make({ baseRef: options.base, now: yield* DateTime.now })
    );
    if (options.json) {
      const json = yield* encodeKnowledgeLeasesReportJson(report).pipe(
        KnowledgeOperationalError.mapError("Failed to encode the knowledge doctor lease report.")
      );
      yield* Console.log(json);
    } else {
      yield* Console.log(renderKnowledgeLeasesReport(report));
    }
  })
).pipe(Command.withDescription("List debt leases: active, expiring within 7 days, expired, and rule violations"));

/**
 * The `beep knowledge doctor` subcommand.
 *
 * **Details**
 *
 * `--report` is the phase-0 form: it classifies every reference-shaped span in the knowledge corpus
 * of one tracked tree, evaluates live spans with the witness-bearing paths and commands evaluators,
 * and prints the result. It reads no baseline, writes nothing, gates nothing, and exits 0 whatever
 * it finds. `--tree` accepts any commit-ish (default `HEAD`); no fetch ever occurs.
 *
 * Without `--report` the command is the gate: it scans `HEAD`, classifies every baselineable finding
 * against the sealed baseline (introduced, pending, inherited, leased, resolved), runs the seal
 * guard against the merge-base with `--base`, evaluates the debt leases, and fails on introduced or
 * governance findings. `--accept-mint` checks C8 condition (i) itself: CI, the mint branch, and the
 * mint App as the pull request author. `mint` is the only writer of the sealed baseline (`--write`,
 * CI-only); `verify-mint` re-mints the committed baseline at its `mintedAt` and byte-compares; `ci`
 * is the quality-lane form, report-only until the merge-base is sealed or the branch touches the
 * seal; `leases [--json]` lists the leases without scanning the corpus.
 *
 * **Gotchas**
 *
 * Until the CI mint opens the first sealed baseline the gate refuses with the same message it always
 * has, and every kind stays report-only until its promotion row lands. Human output folds advisory
 * findings into a count; `--json` keeps every finding.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { knowledgeDoctorCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 *
 * console.log(knowledgeDoctorCommand.name) // "doctor"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeDoctorCommand = Command.make(
  "doctor",
  {
    report: doctorReportFlag,
    tree: treeFlag,
    json: doctorJsonFlag,
    base: doctorBaseFlag,
    acceptMint: doctorAcceptMintFlag,
  },
  runDoctor
).pipe(
  Command.withDescription(
    "Classify and check every knowledge reference span; --report is read-only, the bare form gates on the sealed baseline"
  ),
  Command.withSubcommands([
    knowledgeDoctorMintCommand,
    knowledgeDoctorVerifyMintCommand,
    knowledgeDoctorCiCommand,
    knowledgeDoctorLeasesCommand,
  ]),
  Command.provide(KnowledgeDoctorLive)
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
 * console.log(A.map(subcommands, (command) => command.name)) // [ "refs", "semantic-delta", "doctor" ]
 * ```
 *
 * @see {@link knowledgeRefsCommand} for the read-only phase-0 census.
 * @see {@link knowledgeSemanticDeltaCommand} for the gating Stage-1 comparison.
 * @see {@link knowledgeDoctorCommand} for the read-only Stage-2 span report.
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeCommand = Command.make("knowledge", {}, () =>
  Console.log(
    "Knowledge commands: refs [--tree <rev>] [--surface live|archival|all] [--json] [--check] [--verbose], semantic-delta [--base <ref>] [--json], doctor [--report [--tree <rev>]] [--base <ref>] [--json], doctor mint [--at <rev>] [--write], doctor verify-mint, doctor ci [--base <ref>], doctor leases [--json]"
  )
).pipe(
  Command.withDescription("Knowledge-surface verification commands"),
  Command.withSubcommands([knowledgeRefsCommand, knowledgeSemanticDeltaCommand, knowledgeDoctorCommand])
);
