/**
 * Documentation lint: `beep lint jsdoc`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FsUtils, findRepoRoot, GlobOptions, resolveWorkspaceDirs } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A } from "@beep/utils";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { runToExit } from "../../internal/process/StepExec.ts";
import { lintPackageFlag, resolveLintPackage } from "./internal/LintPackage.ts";

// Root-only targets are every non-workspace source file; `.oxlintrc.docs.json`
// ignores tests and internals, so a target set made only of ignored files is
// "nothing to lint", not a failure.
const runDocsWorker = Effect.fn("Lint.docsWorker")(function* (
  root: string,
  targets: ReadonlyArray<string>,
  allowUnmatched: boolean
) {
  if (A.isReadonlyArrayEmpty(targets)) return;
  const path = yield* Path.Path;
  const exitCode = yield* runToExit({
    command: path.join(root, "node_modules/.bin/oxlint"),
    args: [
      "--config",
      path.join(root, ".oxlintrc.docs.json"),
      "--max-warnings=0",
      ...(allowUnmatched ? ["--no-error-on-unmatched-pattern"] : []),
      ...targets,
    ],
    cwd: root,
    extendEnv: true,
    stdio: "inherit",
  });
  if (exitCode !== 0) return yield* failWithReportedExit(`lint jsdoc: failed with exit code ${exitCode}.`, exitCode);
});

export const lintJsdocCommand = Command.make(
  "jsdoc",
  {
    package: lintPackageFlag,
    rootOnly: Flag.Boolean("root-only").pipe(Flag.withDefault(false)),
  },
  Effect.fn("Lint.jsdoc")(function* ({ package: directory, rootOnly }) {
    if (O.isSome(directory) === rootOnly) {
      return yield* failWithReportedExit("Choose exactly one of --package or --root-only.");
    }
    const root = yield* findRepoRoot();
    if (O.isSome(directory)) {
      return yield* runDocsWorker(root, [yield* resolveLintPackage(root, directory.value)], false);
    }
    const fsUtils = yield* FsUtils;
    const path = yield* Path.Path;
    const workspaces = yield* resolveWorkspaceDirs(root);
    const files = yield* fsUtils.globFiles(
      ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"],
      GlobOptions.make({
        cwd: root,
        ignore: [
          "apps/labs/**",
          "**/node_modules/**",
          "**/.context/**",
          ...A.map(
            A.fromIterable(HashMap.values(workspaces)),
            (dir) => `${normalizePath(path.relative(root, dir))}/**`
          ),
        ],
      })
    );
    yield* runDocsWorker(root, A.sort(files, Order.String), true);
  })
).pipe(Command.withDescription("Check package or non-workspace documentation with repo-owned oxlint rules"));
