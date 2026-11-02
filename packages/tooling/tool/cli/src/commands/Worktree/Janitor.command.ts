/**
 * The home-residue and tmpfs janitors, registered under `beep quality` as
 * `residue-reap` and `tmpfs-reap`.
 *
 * **Details**
 *
 * Both engines clean up after worktrees and lanes, so they live with the
 * Worktree group (beep-cli-composition W1); the command paths stay under
 * `quality` so the `beep` surface is unchanged.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { jsonStringifyPretty } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { getSomesStruct } from "@beep/utils/Option";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { printLines } from "../../internal/cli/Printer.ts";
import { FleetMirrorService, FleetMirrorServiceLive } from "./Fleet.service.ts";
import { ResidueReapClass, ResidueReapReport } from "./internal/ResidueReap.schemas.ts";
import { runResidueReap } from "./internal/ResidueReap.ts";
import { ResidueTerminalLaneProbeLive } from "./internal/ResidueTerminalLaneLive.ts";
import { TmpfsReapReport } from "./internal/TmpfsReap.schemas.ts";
import { runTmpfsReap } from "./internal/TmpfsReap.ts";

const encodeUnknownResidueReapReport = S.encodeUnknownEffect(ResidueReapReport);

const encodeUnknownTmpfsReapReport = S.encodeUnknownEffect(TmpfsReapReport);

const optionalCandidateField = <Value extends string | number>(value: Value | undefined, label: string): string =>
  pipe(
    O.fromUndefinedOr(value),
    O.map((present) => ` ${label}=${present}`),
    O.getOrElse(() => "")
  );

const renderTmpfsCandidateLine = (candidate: TmpfsReapReport["candidates"][number]): string => {
  const bytes = optionalCandidateField(candidate.bytes, "bytes");
  const skip = optionalCandidateField(candidate.skipReason, "reason");
  const root = optionalCandidateField(candidate.root, "root");
  return `- ${candidate.action} class=${candidate.reapClass}${root} age=${candidate.ageHours.toFixed(1)}h refs=${candidate.refCount}${bytes}${skip} ${candidate.path}`;
};

const renderTmpfsReportLines = (report: TmpfsReapReport, apply: boolean): ReadonlyArray<string> => [
  apply
    ? "TMPFS REAP APPLY — removing only classified, idle artifacts with zero live references"
    : "TMPFS REAP DRY RUN — nothing will be removed; pass --apply to reap eligible artifacts",
  `scratch roots: ${A.join(
    O.getOrElse(O.fromUndefinedOr(report.tmpRoots), () => [report.tmpRoot]),
    ", "
  )}`,
  ...A.map(report.candidates, renderTmpfsCandidateLine),
  `totals: candidates=${A.length(report.candidates)} reaped=${report.reapedCount} reclaimed-bytes=${report.reclaimedBytes}`,
  ...A.map(report.warnings, (warning) => `warning: ${warning}`),
];

/**
 * Render the operator-facing tmpfs janitor report without running the command.
 *
 * **Example** (Render a dry-run report)
 *
 * ```ts
 * import { TmpfsReapReport } from "@beep/repo-cli/test/Worktree"
 * import { renderTmpfsReportLinesForTesting } from "@beep/repo-cli/test/Worktree"
 *
 * const report = TmpfsReapReport.make({
 *   scannedAt: "2026-08-30T12:00:00.000Z", tmpRoot: "/tmp", applied: false,
 *   candidates: [], reapedCount: 0, reclaimedBytes: 0, warnings: [],
 * })
 * console.log(renderTmpfsReportLinesForTesting(report, false)[1]) // "scratch roots: /tmp"
 * ```
 *
 * @param report - Completed janitor report to render.
 * @param apply - Whether the command was invoked in apply mode.
 * @returns Operator-facing summary, candidate, total, and warning lines.
 * @category testing
 * @since 0.0.0
 */
export const renderTmpfsReportLinesForTesting: {
  (report: TmpfsReapReport, apply: boolean): ReadonlyArray<string>;
  (apply: boolean): (report: TmpfsReapReport) => ReadonlyArray<string>;
} = dual(2, renderTmpfsReportLines);

/**
 * Dry-run-first janitor for idle artifacts under `/tmp` and a distinct absolute `TMPDIR`.
 *
 * **Example** (Reference the registered subcommand)
 *
 * ```ts
 * console.log("bun run beep quality tmpfs-reap --json")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const tmpfsReapCommand = Command.make(
  "tmpfs-reap",
  {
    apply: Flag.Boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Apply eligible removals (default: loud dry-run only)")
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Emit the encoded tmpfs-reap/v1 report as JSON")
    ),
  },
  Effect.fn(function* ({ apply, json }) {
    const report = yield* runTmpfsReap({ apply });
    if (json) {
      const encoded = yield* encodeUnknownTmpfsReapReport(report);
      yield* printLines([yield* jsonStringifyPretty(encoded)]);
      return;
    }
    yield* printLines(renderTmpfsReportLines(report, apply));
  })
).pipe(
  Command.withDescription(
    "Dry-run-first janitor for idle artifacts under /tmp and a distinct absolute TMPDIR; includes Vitest forks scratch and dangling worktree stubs"
  )
);

const renderResidueCandidateLine = (candidate: ResidueReapReport["candidates"][number]): string => {
  const age = pipe(
    O.fromUndefinedOr(candidate.ageDays),
    O.map((value) => ` age=${value.toFixed(1)}d`),
    O.getOrElse(() => " age=unknown")
  );
  const entries = optionalCandidateField(candidate.entriesScanned, "entries");
  const bytes = optionalCandidateField(candidate.bytes, "bytes");
  const skip = optionalCandidateField(candidate.skipReason, "reason");
  return `- ${candidate.action} class=${candidate.reapClass}${age}${entries}${bytes}${skip} ${candidate.path}`;
};

// Human output caps rows per class and section; the JSON report always lists every
// candidate (a single checkout's Turbo cache can hold hundreds of thousands).
const RESIDUE_ROWS_PER_CLASS = 25;

type ResidueCandidate = ResidueReapReport["candidates"][number];

type ResidueSection = readonly [string, ReadonlyArray<ResidueCandidate>];

const residueSectionLabel = (candidate: ResidueCandidate): string =>
  pipe(
    O.fromUndefinedOr(candidate.checkoutRoot),
    O.map((checkoutRoot) => `checkout: ${checkoutRoot}`),
    O.getOrElse(() => "home")
  );

const byResidueSectionLabel = Order.mapInput(Order.String, ([label]: ResidueSection) => label);

const residueSkipSummary = (skipped: ReadonlyArray<ResidueCandidate>): string =>
  pipe(
    A.groupBy(skipped, (candidate) => O.getOrElse(O.fromUndefinedOr(candidate.skipReason), () => "unknown")),
    R.toEntries,
    A.sort(byResidueSectionLabel),
    A.map(([reason, entries]) => `${reason}=${A.length(entries)}`),
    A.match({ onEmpty: () => "", onNonEmpty: (parts) => ` skip-reasons: ${A.join(parts, ", ")}` })
  );

const renderResidueClassBlock = (
  reapClass: ResidueReapReport["classes"][number],
  candidates: ReadonlyArray<ResidueCandidate>
): ReadonlyArray<string> => {
  const eligible = A.filter(candidates, (candidate) => candidate.action !== "skip");
  const skipped = A.filter(candidates, (candidate) => candidate.action === "skip");
  // Qualification views are reflink copies: a byte count would only be apparent, so none is claimed.
  const bytes =
    reapClass === "qualification-views"
      ? "eligible-bytes=apparent-only"
      : `eligible-bytes=${A.reduce(eligible, 0, (total, candidate) => total + O.getOrElse(O.fromUndefinedOr(candidate.bytes), () => 0))}`;
  const rows = A.appendAll(eligible, skipped);
  const omitted = A.length(rows) - RESIDUE_ROWS_PER_CLASS;
  return [
    `${reapClass}: candidates=${A.length(candidates)} eligible=${A.length(eligible)} skipped=${A.length(skipped)} ${bytes}${residueSkipSummary(skipped)}`,
    ...A.map(A.take(rows, RESIDUE_ROWS_PER_CLASS), renderResidueCandidateLine),
    ...(omitted > 0 ? [`... ${omitted} more ${reapClass} rows omitted; --json lists every candidate`] : []),
  ];
};

const renderResidueSection = ([label, candidates]: ResidueSection): ReadonlyArray<string> => [
  `== ${label} ==`,
  ...A.flatMap(
    A.filter(ResidueReapClass.literals, (reapClass: ResidueReapClass) =>
      A.some(candidates, (candidate) => candidate.reapClass === reapClass)
    ),
    (reapClass: ResidueReapClass) =>
      renderResidueClassBlock(
        reapClass,
        A.filter(candidates, (candidate) => candidate.reapClass === reapClass)
      )
  ),
];

const renderResidueReportLines = (report: ResidueReapReport): ReadonlyArray<string> => [
  O.match(O.fromUndefinedOr(report.mode), {
    onSome: (mode) => `RESIDUE REAP ${Str.toUpperCase(Str.replaceAll("-", " ")(mode))}`,
    onNone: () =>
      report.applied
        ? "RESIDUE REAP APPLY — removed only old, revalidated entries from closed home-residue classes"
        : "RESIDUE REAP DRY RUN — nothing will be removed; pass --apply to reap eligible entries",
  }),
  `home root: ${report.homeRoot}`,
  `repo root: ${report.repoRoot}`,
  `checkouts: ${A.length(report.checkoutRoots)}${report.fleet ? " (fleet)" : ""}`,
  `shared turbo cache: ${report.sharedTurboCacheRoot}`,
  `thresholds: default=${report.maxAgeDays}d turbo=${report.turboMaxAgeDays}d turbo-runs=${report.turboRunsMaxAgeDays}d shared-turbo=${report.sharedTurboMaxAgeDays}d shared-turbo-budget=${report.sharedTurboMaxBytes}B views-keep=${report.qualificationViewsKeep}`,
  `classes: ${A.join(report.classes, ", ")}`,
  ...pipe(
    A.groupBy(report.candidates, residueSectionLabel),
    R.toEntries,
    A.sort(byResidueSectionLabel),
    A.flatMap(renderResidueSection)
  ),
  `totals: candidates=${A.length(report.candidates)} reaped=${report.reapedCount} reclaimed-bytes=${report.reclaimedBytes}`,
  ...A.map(report.warnings, (warning) => `warning: ${warning}`),
];

/**
 * Render the operator-facing residue janitor report without running the command.
 *
 * **Example** (Render an empty dry-run report)
 *
 * ```ts
 * import { ResidueReapReport } from "@beep/repo-cli/test/Worktree"
 * import { renderResidueReportLinesForTesting } from "@beep/repo-cli/test/Worktree"
 *
 * const report = ResidueReapReport.make({
 *   scannedAt: "2026-09-03T12:00:00.000Z", homeRoot: "/home/me", repoRoot: "/repo",
 *   maxAgeDays: 30, turboMaxAgeDays: 14, turboRunsMaxAgeDays: 1,
 *   sharedTurboCacheRoot: "/home/me/.cache/beep/turbo", sharedTurboMaxAgeDays: 14,
 *   sharedTurboMaxBytes: 21474836480, qualificationViewsKeep: 2, fleet: false,
 *   checkoutRoots: ["/repo"], applied: false, classes: ["codex-sessions"],
 *   candidates: [], reapedCount: 0, reclaimedBytes: 0, warnings: [],
 * })
 * console.log(renderResidueReportLinesForTesting(report)[1]) // "home root: /home/me"
 * ```
 *
 * @param report - Completed janitor report to render.
 * @returns Operator-facing summary, candidate, total, and warning lines.
 * @category testing
 * @since 0.0.0
 */
export const renderResidueReportLinesForTesting: (report: ResidueReapReport) => ReadonlyArray<string> =
  renderResidueReportLines;

/**
 * Dry-run-first janitor for explicitly owned home-residue classes.
 *
 * **Details**
 *
 * Defaults to a non-mutating report and revalidates every apply action.
 * `--fleet` sweeps the repository-scoped classes (per-checkout Turbo cache,
 * Turbo run summaries, interrupted merged previews) in every clone and linked
 * worktree sharing this origin. The shared Turbo cache is aged, then
 * size-evicted down to `--shared-turbo-max-bytes`; qualification views keep the
 * newest `--qualification-views-keep` plus every view a receipt cites. SQLite
 * databases are never VACUUMed.
 *
 * **Example** (Reference the registered subcommand)
 *
 * ```ts
 * console.log("bun run beep quality residue-reap --json")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const residueReapCommand = Command.make(
  "residue-reap",
  {
    resume: Flag.String("resume").pipe(
      Flag.optional,
      Flag.withDescription("Resume an interrupted persisted archive run by id")
    ),
    restore: Flag.String("restore").pipe(
      Flag.optional,
      Flag.withDescription("Restore a persisted archive run by id; refuses occupied sources")
    ),
    apply: Flag.Boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Apply eligible removals or recoverable archives (default: dry run)")
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Emit the encoded residue-reap/v3 report as JSON")
    ),
    classes: Flag.Literals("classes", ResidueReapClass.literals).pipe(
      Flag.between(0, A.length(ResidueReapClass.literals)),
      Flag.withDescription("Restrict cleanup to repeatable residue classes (default: all classes)")
    ),
    maxAgeDays: Flag.Finite("max-age-days").pipe(
      Flag.withDefault(30),
      Flag.withDescription("Minimum age or idleness in days for Codex and beep-cache entries")
    ),
    turboMaxAgeDays: Flag.Finite("turbo-max-age-days").pipe(
      Flag.withDefault(14),
      Flag.withDescription("Minimum age in days for entries in each checkout's .turbo/cache")
    ),
    fleet: Flag.Boolean("fleet").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Sweep repository-scoped classes in every clone and worktree sharing this origin")
    ),
    turboRunsMaxAgeDays: Flag.Finite("turbo-runs-max-age-days").pipe(
      Flag.withDefault(1),
      Flag.withDescription("Minimum age in days for Turbo run summaries under .turbo/runs")
    ),
    sharedTurboMaxAgeDays: Flag.Finite("shared-turbo-max-age-days").pipe(
      Flag.withDefault(14),
      Flag.withDescription("Age in days past which shared Turbo cache entries are evicted regardless of size")
    ),
    sharedTurboMaxBytes: Flag.Finite("shared-turbo-max-bytes").pipe(
      Flag.withDefault(21474836480),
      Flag.withDescription("Byte budget the shared Turbo cache is evicted down to, oldest-written first")
    ),
    qualificationViewsKeep: Flag.Int("qualification-views-keep").pipe(
      Flag.withDefault(2),
      Flag.withDescription("Newest qualification dependency views always kept, besides any a receipt cites")
    ),
  },
  Effect.fn(function* ({
    apply,
    resume,
    restore,
    classes,
    fleet,
    json,
    maxAgeDays,
    qualificationViewsKeep,
    sharedTurboMaxAgeDays,
    sharedTurboMaxBytes,
    turboMaxAgeDays,
    turboRunsMaxAgeDays,
  }) {
    const checkoutRoots = fleet ? yield* (yield* FleetMirrorService).listCheckouts() : A.empty<string>();
    const report = yield* runResidueReap({
      apply,
      ...getSomesStruct({ resume, restore }),
      checkoutRoots,
      classes,
      fleet,
      maxAgeDays,
      qualificationViewsKeep,
      sharedTurboMaxAgeDays,
      sharedTurboMaxBytes,
      turboMaxAgeDays,
      turboRunsMaxAgeDays,
    });
    if (json) {
      const encoded = yield* encodeUnknownResidueReapReport(report);
      yield* printLines([yield* jsonStringifyPretty(encoded)]);
      return;
    }
    yield* printLines(renderResidueReportLines(report));
  })
).pipe(
  Command.withDescription(
    "Dry-run-first janitor for bounded Codex, Turbo, merged-preview, qualification-view, and beep cache residue"
  ),
  Command.provide(Layer.merge(FleetMirrorServiceLive, ResidueTerminalLaneProbeLive))
);
