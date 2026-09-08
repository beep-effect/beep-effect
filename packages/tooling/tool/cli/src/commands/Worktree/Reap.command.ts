/**
 * `beep worktree reap` command wiring and report rendering.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printCommandJson } from "../../internal/cli/Json.ts";
import { WorktreeReapReport } from "./Reap.schemas.ts";
import { runWorktreeReap } from "./Reap.service.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import { WorktreeRemovalServiceLive } from "./Worktree.service.ts";

const candidateLine = (candidate: WorktreeReapReport["candidates"][number]): string => {
  const branch = O.getOrElse(candidate.branch, () => "(detached)");
  const pr = O.match(candidate.prNumber, {
    onNone: () => "",
    onSome: (number) => ` pr=#${number}`,
  });
  const idle = O.match(candidate.idleHours, {
    onNone: () => " idle=unknown",
    onSome: (hours) => ` idle=${hours.toFixed(1)}h`,
  });
  const bytes = O.match(candidate.bytes, {
    onNone: () => "",
    onSome: (value) => ` bytes=${value}`,
  });
  const skip = O.match(candidate.skipReason, {
    onNone: () => "",
    onSome: (reason) => ` skip=${reason}`,
  });
  const action = candidate.retired ? "retired" : O.isNone(candidate.skipReason) ? "eligible" : "skip";
  return `- ${action} class=${candidate.reapClass} branch=${branch}${pr}${idle}${bytes}${skip} ${candidate.path}`;
};

const reportLines = (report: WorktreeReapReport): ReadonlyArray<string> => [
  report.applied
    ? "WORKTREE REAP APPLY — archive-first retirement of fully evidenced merged PR worktrees"
    : "WORKTREE REAP DRY RUN — nothing will be retired; pass --apply to retire eligible worktrees",
  `main checkout: ${report.mainCheckout}`,
  `invoking worktree: ${report.invokingWorktree}`,
  `idle threshold: ${report.idleThresholdHours}h`,
  ...A.map(report.candidates, candidateLine),
  `totals: candidates=${A.length(report.candidates)} retired=${report.retiredCount} reclaimable-bytes=${report.reclaimableBytes} reclaimed-bytes=${report.reclaimedBytes}`,
  ...A.map(report.warnings, (warning) => `warning: ${warning}`),
];

/**
 * Render a completed worktree-reap report without executing the janitor.
 *
 * **Example** (Render an empty dry run)
 *
 * ```ts
 * import { renderWorktreeReapReportLines, WorktreeReapReport } from "@beep/repo-cli/commands/Worktree"
 *
 * const lines = renderWorktreeReapReportLines(WorktreeReapReport.make({
 *   scannedAt: "2026-09-03T12:00:00.000Z",
 *   mainCheckout: "/repo",
 *   invokingWorktree: "/repo",
 *   idleThresholdHours: 48,
 *   applied: false,
 *   candidates: [],
 *   retiredCount: 0,
 *   reclaimableBytes: 0,
 *   reclaimedBytes: 0,
 *   warnings: [],
 * }))
 * console.log(lines[0]?.includes("DRY RUN")) // true
 * ```
 *
 * @param report - Completed versioned janitor report.
 * @returns Human-readable header, rows, totals, and warnings.
 * @category formatting
 * @since 0.0.0
 */
export const renderWorktreeReapReportLines = reportLines;

/**
 * Dry-run-first registered-worktree janitor subcommand.
 *
 * **Example** (Reference the subcommand)
 *
 * ```ts
 * import { worktreeReapCommand } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(typeof worktreeReapCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const worktreeReapCommand = Command.make(
  "reap",
  {
    apply: Flag.boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Archive and retire eligible merged-PR worktrees (default: dry run)")
    ),
    json: Flag.boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Emit the encoded worktree-reap/v1 report as JSON")
    ),
    idleHours: Flag.integer("idle-hours").pipe(
      Flag.withDefault(48),
      Flag.withDescription("Minimum hours since the newest commit or HEAD-file activity")
    ),
  },
  Effect.fn(function* ({ apply, json, idleHours }) {
    yield* runWorktreeReap({ apply, idleHours }).pipe(
      Effect.flatMap(
        Effect.fn("WorktreeReap.renderReport")(function* (report) {
          if (json) {
            const encoded = yield* S.encodeUnknownEffect(WorktreeReapReport)(report);
            yield* printCommandJson(encoded).pipe(
              Effect.mapError(WorktreeCommandError.new("Failed to print the worktree-reap report as JSON."))
            );
            return;
          }
          yield* Effect.forEach(renderWorktreeReapReportLines(report), Console.log, { discard: true });
        })
      ),
      Effect.catchTag(
        "WorktreeCommandError",
        Effect.fn(function* (error) {
          yield* Console.error(`worktree reap: ${error.message}`);
          return yield* failWithReportedExit(`worktree reap: ${error.message}`);
        })
      )
    );
  })
).pipe(
  Command.withDescription(
    "Classify registered worktrees and optionally archive-retire clean, idle worktrees whose PR is merged"
  ),
  Command.provide(WorktreeRemovalServiceLive)
);
