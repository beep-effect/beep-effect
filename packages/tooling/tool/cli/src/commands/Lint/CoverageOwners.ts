/**
 * `bun run beep lint coverage-owners`: keep the generated standards coverage
 * owner rows equal to the reader scan.
 *
 * **Details**
 *
 * The rows in `CoverageScope.ts` decide which package tests a regenerated
 * standards file selects. A pull request that adds or removes a reader in
 * another package does not select `@beep/repo-cli`, so a repo-cli test alone
 * would go red on a later, unrelated pull request. Repo Sanity runs this lint
 * on every code and docs pull request instead (`goals/hosted-setup-tax`,
 * TURB-01).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { workspaceCoverageOwnerDrift } from "../Quality/internal/CoverageScopeReaders.ts";

const ownerList = (owners: ReadonlyArray<string>): string =>
  A.isReadonlyArrayNonEmpty(owners) ? A.join(owners, ", ") : "(none)";

/**
 * Scan the workspace and fail when an owner row and the reader scan disagree.
 *
 * **Example** (Check the lint runner is an Effect function)
 *
 * ```ts
 * import { runCoverageOwnersLint } from "@beep/repo-cli/commands/Lint/CoverageOwners"
 *
 * console.log(typeof runCoverageOwnersLint) // "function"
 * ```
 *
 * @param repoRootOverride - Repository root to scan; the enclosing checkout when `None`.
 * @returns Nothing; fails with a reported exit on drift or an empty scan.
 * @category commands
 * @since 0.0.0
 */
export const runCoverageOwnersLint = Effect.fn("CoverageOwners.runCoverageOwnersLint")(function* (
  repoRootOverride: O.Option<string> = O.none()
) {
  const path = yield* Path.Path;
  const repoRoot = yield* O.match(repoRootOverride, {
    onNone: () => findRepoRoot(),
    onSome: flow(path.resolve, Effect.succeed),
  });
  const report = yield* workspaceCoverageOwnerDrift(repoRoot);
  yield* Console.log(`[coverage-owners] sources=${report.sourceCount} drift=${A.length(report.drift)}`);
  if (report.sourceCount === 0) {
    return yield* failWithReportedExit("coverage-owners: the reader scan found no workspace sources.");
  }
  if (A.isReadonlyArrayNonEmpty(report.drift)) {
    for (const row of report.drift) {
      yield* Console.error(
        `[coverage-owners] ${row.readerPath}: rows ${ownerList(row.rowOwners)}; scan ${ownerList(row.scannedOwners)}`
      );
    }
    return yield* failWithReportedExit(
      "coverage-owners: set COVERAGE_GENERATED_STANDARDS_OWNER_ROWS in CoverageScope.ts to the scanned owners."
    );
  }
});

/**
 * `bun run beep lint coverage-owners`: compare the owner rows with the reader scan.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { lintCoverageOwnersCommand } from "@beep/repo-cli/commands/Lint/CoverageOwners"
 *
 * console.log(lintCoverageOwnersCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const lintCoverageOwnersCommand = Command.make(
  "coverage-owners",
  {
    repoRoot: Flag.String("repo-root").pipe(
      Flag.withDescription("Repository root to scan (default: the enclosing checkout)"),
      Flag.optional
    ),
  },
  ({ repoRoot }) => runCoverageOwnersLint(repoRoot)
).pipe(Command.withDescription("Fail when the generated standards coverage owner rows differ from the reader scan"));
