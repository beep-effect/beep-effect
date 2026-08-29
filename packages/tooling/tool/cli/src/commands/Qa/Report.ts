/**
 * The `beep qa report` re-render.
 *
 * Reporting owns no state: it reads `session.json`, the witness log, and the
 * sidecar extraction plan, then rewrites `report.md`. Running it twice on an
 * unchanged round produces an identical file, which is what makes it safe to
 * re-run after hand-editing a session manifest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SessionStore } from "@beep/qa-capture";
import { Effect, FileSystem, Path } from "effect";
import { printLines } from "../../internal/cli/Printer.ts";
import { extractionPlanPath, readExtractionPlan, resolveRoundLayout } from "./Extract.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { renderRoundReport } from "./Qa.render.ts";
import { readEventLog } from "./Qa.session.ts";
import type { QaReportOptions } from "./Qa.schemas.ts";

/**
 * Re-render a round's `report.md` from its session manifest.
 *
 * **Example** (Re-render session report)
 *
 * ```ts
 * import { runQaReport } from "@beep/repo-cli/commands/Qa/Report"
 * import { QaReportOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = runQaReport("/repo", QaReportOptions.make({ session: O.none() }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaReport = Effect.fn("QaReport.run")(function* (
  cwd: string,
  options: QaReportOptions
): Effect.fn.Return<string, QaCommandError, FileSystem.FileSystem | Path.Path | SessionStore> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const layout = yield* resolveRoundLayout(cwd, options.session);
  const manifest = yield* store
    .readSessionManifest(layout)
    .pipe(QaCommandError.mapError(`qa report could not read ${layout.sessionPath}.`));
  const eventLog = yield* readEventLog(layout.eventsPath);
  const plan = yield* readExtractionPlan(extractionPlanPath(path, layout));

  const report = renderRoundReport(manifest, eventLog, plan);
  yield* fs
    .writeFileString(layout.reportPath, report)
    .pipe(QaCommandError.mapError(`qa report could not write ${layout.reportPath}.`));
  yield* printLines([`qa report: round ${layout.round} -> ${layout.reportPath}`]);
  return report;
});
