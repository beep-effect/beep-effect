/**
 * Package-scoped law checks: `beep lint laws`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { resolveLawsPackageScope, scanLawsPackage } from "../Laws/LawsPackage.ts";
import { resolveLintPackage } from "./internal/LintPackage.ts";

export const lintLawsCommand = Command.make(
  "laws",
  {
    package: Flag.String("package"),
  },
  Effect.fn("Lint.laws")(function* ({ package: directory }) {
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
).pipe(Command.withDescription("Run the package-scoped law checks"));
