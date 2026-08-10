/**
 * Subprocess execution of repo-local docgen for workspace packages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunk0, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, flow, Path, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { runCaptured } from "../../../internal/process/StepExec.ts";
import { DocgenGenerationResult, isDocgenWorkspacePackage } from "../Docgen.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { DocgenWorkspacePackage } from "../Docgen.schemas.ts";

const DOCS_MODULES_SEGMENTS = ["docs", "modules"] as const;

const stringFromUnknown = (value: unknown): string => {
  if (P.isString(value)) {
    return value;
  }
  if (P.isError(value)) {
    return value.message;
  }
  return `${value}`;
};

type RunDocgenForPackageOptions = {
  readonly include?: ReadonlyArray<string>;
};

const isRunDocgenForPackageDataFirst = (args: IArguments): boolean =>
  (args.length === 1 && isDocgenWorkspacePackage(args[0])) || args.length === 2;

const runDocgenForPackageEffect = Effect.fn("DocgenOperations.runDocgenForPackage")(
  function* (targetPackage: DocgenWorkspacePackage, options?: RunDocgenForPackageOptions) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repoRoot = yield* findRepoRoot(targetPackage.absolutePath);
    const docgenEntrypoint = path.join(repoRoot, "packages", "tooling", "tool", "docgen", "src", "bin.ts");
    const include = options?.include ?? A.empty<string>();
    const args: ReadonlyArray<string> = [
      "run",
      docgenEntrypoint,
      ...(A.isReadonlyArrayEmpty(include) ? A.empty<string>() : ["--include", A.join(include, ",")]),
    ];
    const result = yield* runCaptured({
      command: "bun",
      args,
      cwd: targetPackage.absolutePath,
      source: "all",
      trim: true,
    }).pipe(
      Effect.result,
      Effect.map(
        Result.match({
          onFailure: (cause) => ({
            output: pipe(cause, stringFromUnknown, Str.trim),
            exitCode: 1,
          }),
          onSuccess: (value) => ({
            output: value.output,
            exitCode: value.exitCode,
          }),
        })
      )
    );

    if (result.exitCode !== 0) {
      return DocgenGenerationResult.make({
        packageName: targetPackage.name,
        packagePath: targetPackage.relativePath,
        success: false,
        error: `docgen exited with code ${result.exitCode}`,
        ...(Str.isEmpty(result.output) ? {} : { output: result.output }),
      });
    }

    const docsModulesDir = path.join(targetPackage.absolutePath, ...DOCS_MODULES_SEGMENTS);
    const moduleCount = yield* fs.exists(docsModulesDir).pipe(
      Effect.orElseSucceed(thunkFalse),
      Effect.flatMap(
        Effect.fnUntraced(function* (exists) {
          return yield* exists
            ? fs
                .readDirectory(docsModulesDir)
                .pipe(Effect.map(flow(A.filter(Str.endsWith(".md")), A.length)), Effect.orElseSucceed(thunk0))
            : Effect.succeed(0);
        })
      )
    );

    return DocgenGenerationResult.make({
      packageName: targetPackage.name,
      packagePath: targetPackage.relativePath,
      success: true,
      moduleCount,
      ...(result.output.length === 0 ? {} : { output: result.output }),
    });
  },
  (effect, targetPackage) =>
    effect.pipe(
      Effect.result,
      Effect.map(
        Result.match({
          onFailure: (cause) =>
            DocgenGenerationResult.make({
              packageName: targetPackage.name,
              packagePath: targetPackage.relativePath,
              success: false,
              error: "docgen execution failed before completion",
              output: pipe(cause, stringFromUnknown, Str.trim),
            }),
          onSuccess: (result) => result,
        })
      )
    )
);

/**
 * Runs the repo-local `@beep/repo-docgen` implementation for one workspace package.
 *
 * **Example** (Run package docgen with includes)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { runDocgenForPackage } from "@beep/repo-cli/commands/Docgen/internal/RunDocgen"
 * import { DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * const target = DocgenWorkspacePackage.make({
 *   name: "@beep/example",
 *   relativePath: "packages/example",
 *   absolutePath: "/repo/packages/example",
 *   docsOutputPath: "docs/generated/example",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: false,
 *   status: "configured-not-generated",
 * })
 *
 * const effect = runDocgenForPackage(target, { include: ["src/index.ts"] })
 * console.log(Effect.isEffect(effect))
 * ```
 *
 * @param targetPackage - Workspace package to run through docgen.
 * @param options - Optional focused include globs forwarded to repo-docgen.
 * @returns Generation result including command output and module count.
 * @category utilities
 * @since 0.0.0
 */
export const runDocgenForPackage: {
  (
    targetPackage: DocgenWorkspacePackage,
    options?: RunDocgenForPackageOptions
  ): Effect.Effect<
    DocgenGenerationResult,
    DocgenGenerationResult,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner
  >;
  (
    options: RunDocgenForPackageOptions
  ): (
    targetPackage: DocgenWorkspacePackage
  ) => Effect.Effect<
    DocgenGenerationResult,
    DocgenGenerationResult,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner
  >;
} = dual(isRunDocgenForPackageDataFirst, runDocgenForPackageEffect);
