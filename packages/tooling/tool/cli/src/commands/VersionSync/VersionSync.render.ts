/**
 * Report rendering service for version-sync output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Console, Context, Effect, Layer } from "effect";
import * as O from "effect/Option";
import { VersionCategoryReport, VersionCategoryStatusMatch, VersionSyncModeMatch } from "./VersionSync.schemas.js";
import type {
  VersionCategoryReport as VersionCategoryReportValue,
  VersionCategoryStatus as VersionCategoryStatusValue,
  VersionSyncMode as VersionSyncModeValue,
  VersionSyncReport,
} from "./VersionSync.schemas.js";

const $I = $RepoCliId.create("commands/VersionSync/VersionSync.render");

/**
 * Service contract for rendering a version-sync report to console.
 *
 * @example
 * ```ts
 * import type { ReportRendererServiceShape } from "@beep/repo-cli/commands/VersionSync/VersionSync.render"
 *
 * const example: ReportRendererServiceShape | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export type ReportRendererServiceShape = {
  readonly renderCategoryReport: (report: VersionCategoryReportValue) => Effect.Effect<void>;
  readonly renderReport: (report: VersionSyncReport, mode: VersionSyncModeValue) => Effect.Effect<void>;
};

/**
 * Service tag for report rendering.
 *
 * @example
 * ```ts
 * import { ReportRendererService } from "@beep/repo-cli/commands/VersionSync/VersionSync.render"
 *
 * console.log(typeof ReportRendererService !== "undefined") // true
 * ```
 * @category ports
 * @since 0.0.0
 */
export class ReportRendererService extends Context.Service<ReportRendererService, ReportRendererServiceShape>()(
  $I`ReportRendererService`
) {}

const renderCategoryLabel = (report: VersionCategoryReportValue): string =>
  VersionCategoryReport.match(report, {
    bun: () => "Bun Runtime",
    node: () => "Node.js Runtime",
    docker: () => "Docker Images",
    biome: () => "Biome Schema",
    effect: () => "Effect Catalog",
  });

const renderStatusLabel = (status: VersionCategoryStatusValue): string =>
  VersionCategoryStatusMatch(status, {
    ok: () => "OK",
    drift: () => "DRIFT",
    unpinned: () => "UNPINNED",
    error: () => "ERROR",
  });

const renderCategoryReport: ReportRendererServiceShape["renderCategoryReport"] = Effect.fn(function* (report) {
  yield* Console.log(`\n${renderCategoryLabel(report)}:`);

  yield* O.match(report.latest, {
    onNone: () => Effect.void,
    onSome: (latest) => Console.log(`  Latest: ${latest}`),
  });

  const hasItems = yield* A.match(report.items, {
    onEmpty: () => Effect.succeed(false),
    onNonEmpty: (items) =>
      Effect.forEach(items, (item) => {
        const arrow = Str.equivalence(item.current, item.expected) ? "" : ` -> ${item.expected}`;
        return Console.log(`  ${item.file} ${item.field}: ${item.current}${arrow}`);
      }).pipe(Effect.as(true)),
  });

  if (!hasItems && report.status === "ok" && O.isNone(report.error)) {
    yield* Console.log("  Status: OK (no drift)");
    return;
  }

  yield* Console.log(`  Status: ${renderStatusLabel(report.status)}`);

  yield* O.match(report.error, {
    onNone: () => Effect.void,
    onSome: (error) => Console.log(`  Error: ${error}`),
  });
});

const renderModeLabel = (mode: VersionSyncModeValue): string =>
  VersionSyncModeMatch(mode, {
    check: () => "Check",
    "dry-run": () => "Dry Run",
    write: () => "Write",
  });

const renderReport: ReportRendererServiceShape["renderReport"] = Effect.fn(function* (report, mode) {
  yield* Console.log(`\nVersion Sync Report (${renderModeLabel(mode)})`);
  yield* Console.log("===================");

  for (const category of report.categories) {
    yield* renderCategoryReport(category);
  }

  if (!report.hasDrift) {
    yield* Console.log("\nAll versions are in sync.");
    return;
  }

  yield* VersionSyncModeMatch(mode, {
    check: () => Console.log("\nRun `beep version-sync --write` to apply fixes."),
    "dry-run": () => Console.log("\nRun `beep version-sync --write` to apply these changes."),
    write: () => Effect.void,
  });
});

/**
 * Live layer for report rendering.
 *
 * @example
 * ```ts
 * import { ReportRendererServiceLive } from "@beep/repo-cli/commands/VersionSync/VersionSync.render"
 *
 * console.log(typeof ReportRendererServiceLive !== "undefined") // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const ReportRendererServiceLive = Layer.succeed(
  ReportRendererService,
  ReportRendererService.of({
    renderCategoryReport,
    renderReport,
  })
);
