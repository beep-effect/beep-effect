/**
 * Package-scoped law checks: `beep lint laws`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { resolveLawsPackageScope, scanLawsPackage } from "../Laws/LawsPackage.ts";
import { NoTrackedPythonOptions } from "../Laws/NoTrackedPython.model.ts";
import { formatNoTrackedPythonFinding, runNoTrackedPython } from "../Laws/NoTrackedPython.ts";
import { TrackedShellAllowlistOptions } from "../Laws/TrackedShellAllowlist.model.ts";
import { formatTrackedShellFinding, runTrackedShellAllowlist } from "../Laws/TrackedShellAllowlist.ts";
import { resolveLintPackage } from "./internal/LintPackage.ts";

// The repository-wide laws `lint laws` runs when no package is named. Every law reports
// before the command fails, so one run lists the findings of all of them.
const repositoryLaws = Effect.gen(function* () {
  const shell = yield* runTrackedShellAllowlist(
    TrackedShellAllowlistOptions.make({ cwd: process.cwd(), strictCheck: true })
  );
  yield* Console.log(
    `lint laws: tracked-shell-allowlist; tracked_shell_files=${shell.trackedShellFiles}; findings=${shell.findings.length}`
  );
  yield* Effect.forEach(shell.findings, (finding) => Console.log(`lint laws: ${formatTrackedShellFinding(finding)}`), {
    discard: true,
  });
  const python = yield* runNoTrackedPython(NoTrackedPythonOptions.make({ cwd: process.cwd(), strictCheck: true }));
  yield* Console.log(
    `lint laws: no-tracked-python; tracked_python_files=${python.trackedPythonFiles}; findings=${python.findings.length}`
  );
  yield* Effect.forEach(
    python.findings,
    (finding) => Console.log(`lint laws: ${formatNoTrackedPythonFinding(finding)}`),
    {
      discard: true,
    }
  );
  const failed = A.getSomes([
    O.liftPredicate("tracked-shell-allowlist", () => shell.strictFailure),
    O.liftPredicate("no-tracked-python", () => python.strictFailure),
  ]);
  if (A.isReadonlyArrayNonEmpty(failed))
    return yield* failWithReportedExit(`lint laws: ${A.join(failed, ", ")} failed.`);
}).pipe(Effect.withSpan("Lint.repositoryLaws"));

/**
 * Runs the package-scoped law checks for one workspace, or the repository-wide
 * laws when no package is named.
 *
 * **Details**
 *
 * `--package <dir>` scans one workspace's TypeScript sources. Without it the
 * command runs the repository-wide `tracked-shell-allowlist` and
 * `no-tracked-python` laws over the git
 * index in check mode.
 *
 * **Example** (Inspect the subcommand name)
 *
 * ```ts
 * import { lintLawsCommand } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(lintLawsCommand.name) // laws
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintLawsCommand = Command.make(
  "laws",
  {
    package: Flag.String("package").pipe(
      Flag.withDescription("Workspace directory to scan; omit it to run the repository-wide laws"),
      Flag.optional
    ),
  },
  Effect.fn("Lint.laws")(function* ({ package: selected }) {
    if (O.isNone(selected)) return yield* repositoryLaws;
    const directory = selected.value;
    const root = yield* findRepoRoot();
    const prefix = yield* resolveLintPackage(root, directory);
    const scope = yield* resolveLawsPackageScope(root, prefix);
    if (!Str.startsWith(prefix, "packages/")) {
      yield* Console.log(`lint laws: skipping package-test-imports for ${prefix}; it only scans packages/.`);
    }
    const report = yield* scanLawsPackage(scope);
    yield* Console.log(`lint laws: ${prefix}; project_source_files=${report.projectSourceFileCount}`);
    for (const finding of report.findings) {
      yield* Console.log(`lint laws: ${finding.law}; findings=${finding.findingCount}; advisory=${finding.advisory}`);
      for (const diagnostic of finding.diagnostics) yield* Console.log(`lint laws: ${diagnostic}`);
      if (finding.strictFailure) return yield* failWithReportedExit(`lint laws: ${finding.law} failed.`);
    }
  })
).pipe(Command.withDescription("Run the package-scoped law checks, or the repository-wide laws without --package"));
