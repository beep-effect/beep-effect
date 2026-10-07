/**
 * The five runner gates of goal section 8: parity, check, lint, test and
 * docgen, each a verbatim-reproducible command sequence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { type GateName, GateFailed } from "./Audit.errors.ts";
import { listTsFiles, upstreamEntries } from "./Copy.ts";
import { type ExportEntry, exportKindCovers, type ModuleName, type AuditTarget } from "./Ledger.schema.ts";
import { foreignSpecifierLines, readExportFacets, scanUnsafeAssertions, type UnsafeAssertion } from "./Exports.ts";
import { isModuleTarget, labPaths, type RunnerConfig, upstreamPaths } from "./Paths.ts";
import { heavy, runInherited } from "./Process.ts";

const $I = $ScratchpadId.create("effected/runner/Gates");

/**
 * Prints the one-line verdict of a gate.
 *
 * **Example** (Print a verdict)
 *
 * ```ts
 * import { verdict } from "@beep/scratchpad/effected/runner/Gates"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(verdict("yaml", "check", 0))) // true
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const verdict = (target: AuditTarget, gate: GateName, exitCode: number): Effect.Effect<void> =>
  Console.log(`[effected] ${target} ${gate}: ${exitCode === 0 ? "ok" : `red (exit ${exitCode})`}`);

const gateExit = Effect.fn("Gates.gateExit")(function* (target: AuditTarget, gate: GateName, exitCode: number) {
  yield* verdict(target, gate, exitCode);
  if (exitCode !== 0) {
    return yield* GateFailed.make({ target, gate, exitCode, problems: [] });
  }
});

/**
 * Every repo-relative TypeScript file a target owns: its source tree, its
 * extra sources, and its test tree.
 *
 * **Example** (List a target's files)
 *
 * ```ts
 * import { targetFiles } from "@beep/scratchpad/effected/runner/Gates"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(targetFiles("/repo", "jsonc"))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const targetFiles = Effect.fn("Gates.targetFiles")(function* (repoRoot: string, target: AuditTarget) {
  const lab = labPaths(target);
  const sources = yield* listTsFiles(repoRoot, lab.sourceDir);
  const tests = yield* listTsFiles(repoRoot, lab.testDir);
  return [...sources, ...lab.extraSources, ...tests];
});

/**
 * What the parity gate found.
 *
 * **Example** (Inspect a report)
 *
 * ```ts
 * import { ParityReport } from "@beep/scratchpad/effected/runner/Gates"
 *
 * const report = ParityReport.make({ expected: [], actual: [], added: [], problems: [], unsafe: [] })
 * console.log(report.problems.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParityReport extends S.Class<ParityReport>($I`ParityReport`)(
  {
    expected: S.Array(S.Struct({ name: S.String, kind: S.String, entry: S.String })),
    actual: S.Array(S.Struct({ name: S.String, kind: S.String, entry: S.String })),
    added: S.Array(S.Struct({ name: S.String, kind: S.String, entry: S.String })),
    problems: S.Array(S.String),
    unsafe: S.Array(S.String),
  },
  $I.annote("ParityReport", { description: "Expected versus actual exports, additions, problems and D15 findings." })
) {}

const describe = (entry: ExportEntry): string => `${entry.entry} ${entry.name} (${entry.kind})`;

/**
 * The parity gate: every upstream export name present with covering facets,
 * no `@effected/*` specifier left, and (when `strict`) zero D15 assertions.
 *
 * **Example** (Run parity for a module)
 *
 * ```ts
 * import { parity } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = parity(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc", true)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category gates
 * @since 0.0.0
 */
export const parity = Effect.fn("Gates.parity")(function* (config: RunnerConfig, module: ModuleName, strict: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lab = labPaths(module);
  const entries = yield* upstreamEntries(config.upstreamRoot, module);
  const expected: ReadonlyArray<ExportEntry> = A.flatMap(entries, ([entry, srcRelative]) =>
    readExportFacets(path.join(config.upstreamRoot, upstreamPaths(module).srcDir, srcRelative), entry)
  );
  const actualPerEntry = yield* Effect.forEach(entries, ([entry, srcRelative]) =>
    Effect.gen(function* () {
      const file = path.join(config.repoRoot, lab.sourceDir, srcRelative);
      if (!(yield* fs.exists(file))) {
        return { entry, facets: A.empty<ExportEntry>(), missingFile: O.some(`${lab.sourceDir}/${srcRelative}`) };
      }
      return { entry, facets: readExportFacets(file, entry), missingFile: O.none<string>() };
    })
  );
  const actual = A.flatMap(actualPerEntry, (result) => result.facets);
  const find = (haystack: ReadonlyArray<ExportEntry>, needle: ExportEntry): O.Option<ExportEntry> =>
    A.findFirst(haystack, (candidate) => candidate.entry === needle.entry && candidate.name === needle.name);
  const missingFiles = A.map(A.getSomes(A.map(actualPerEntry, (result) => result.missingFile)), (file) => `missing entry file ${file}`);
  const missing = A.filterMap(expected, (entry) =>
    O.isNone(find(actual, entry)) ? O.some(`missing export ${describe(entry)}`) : O.none()
  );
  const mismatched = A.filterMap(expected, (entry) =>
    O.match(find(actual, entry), {
      onNone: () => O.none<string>(),
      onSome: (found) =>
        exportKindCovers(found.kind, entry.kind)
          ? O.none<string>()
          : O.some(`kind mismatch ${describe(entry)}: lab exports ${found.kind}`),
    })
  );
  const added = A.filter(actual, (entry) => O.isNone(find(expected, entry)));
  const files = yield* targetFiles(config.repoRoot, module);
  const foreign = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(config.repoRoot, file)), (text) => foreignSpecifierLines(file, text))
  );
  const foreignProblems = A.map(A.flatten(foreign), (line) => `@effected specifier at ${line}`);
  const unsafe: ReadonlyArray<UnsafeAssertion> = scanUnsafeAssertions(
    A.map(files, (file) => [path.join(config.repoRoot, file), file] as const)
  );
  const unsafeLines = A.map(unsafe, (finding) => finding.render());
  const problems = [
    ...missingFiles,
    ...missing,
    ...mismatched,
    ...foreignProblems,
    ...(strict ? A.map(unsafeLines, (line) => `unsafe assertion ${line}`) : []),
  ];
  const report = ParityReport.make({
    expected: A.map(expected, (entry) => ({ name: entry.name, kind: entry.kind, entry: entry.entry })),
    actual: A.map(actual, (entry) => ({ name: entry.name, kind: entry.kind, entry: entry.entry })),
    added: A.map(added, (entry) => ({ name: entry.name, kind: entry.kind, entry: entry.entry })),
    problems,
    unsafe: unsafeLines,
  });
  yield* Console.log(
    `[effected] ${module} parity: ${expected.length} expected, ${actual.length} actual, ${added.length} added, ${unsafeLines.length} unsafe assertion(s)${strict ? "" : " (advisory before S1)"}`
  );
  if (A.isNonEmptyReadonlyArray(problems)) {
    yield* verdict(module, "parity", 1);
    return yield* GateFailed.make({ target: module, gate: "parity", exitCode: 1, problems });
  }
  yield* verdict(module, "parity", 0);
  return report;
});

/**
 * The check gate: tsgo (TypeScript plus Effect diagnostics) on the target's
 * tsconfig, admitted through `beep-heavy`.
 *
 * **Example** (Run the check gate)
 *
 * ```ts
 * import { check } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(check(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category gates
 * @since 0.0.0
 */
export const check = Effect.fn("Gates.check")(function* (config: RunnerConfig, target: AuditTarget) {
  const exitCode = yield* runInherited(
    heavy({
      command: "bun",
      args: ["run", "--cwd", "scratchpad", "tsgo", "-p", `effected/${target}/tsconfig.json`, "--noEmit", "--pretty", "false"],
      cwd: config.repoRoot,
    })
  );
  yield* gateExit(target, "check", exitCode);
});

const LAWS = ["effect-imports", "effect-fn", "terse-effect", "native-runtime"] as const;

/**
 * The lint gate: oxlint over the target's directories, then the four beep
 * laws over its expanded file list.
 *
 * **Example** (Run the lint gate)
 *
 * ```ts
 * import { lint } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(lint(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category gates
 * @since 0.0.0
 */
export const lint = Effect.fn("Gates.lint")(function* (config: RunnerConfig, target: AuditTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lab = labPaths(target);
  const directories = yield* Effect.filter([lab.sourceDir, ...lab.extraSources, lab.testDir], (directory) =>
    fs.exists(path.join(config.repoRoot, directory))
  );
  const oxlint = yield* runInherited({
    command: "bunx",
    args: ["--no-install", "oxlint", "--quiet", "--disable-nested-config", ...directories],
    cwd: config.repoRoot,
  });
  if (oxlint !== 0) {
    return yield* gateExit(target, "lint", oxlint);
  }
  const files = yield* targetFiles(config.repoRoot, target);
  const include = A.join(files, ",");
  for (const law of LAWS) {
    const exitCode = yield* runInherited({
      command: "bun",
      args: ["run", "beep", "laws", law, "--check", "--include", include],
      cwd: config.repoRoot,
    });
    if (exitCode !== 0) {
      yield* Console.log(`[effected] ${target} lint: law ${law} red`);
      return yield* gateExit(target, "lint", exitCode);
    }
  }
  yield* gateExit(target, "lint", 0);
});

/**
 * The test gate: Node vitest through the shared effected config, with the
 * module's behaviour tests only when measuring coverage (so documentation
 * examples do not inflate covered paths, the proven jsonl recipe).
 *
 * **Example** (Run the test gate)
 *
 * ```ts
 * import { test } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(test(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc", false))) // true
 * ```
 *
 * @category gates
 * @since 0.0.0
 */
export const test = Effect.fn("Gates.test")(function* (config: RunnerConfig, target: AuditTarget, coverage: boolean) {
  const lab = labPaths(target);
  const exitCode = yield* runInherited(
    heavy({
      command: "bunx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "scratchpad/vitest.effected.config.ts",
        ...(coverage ? [lab.testDir, "--coverage"] : []),
      ],
      cwd: config.repoRoot,
      env: { EFFECTED_MODULE: target },
    })
  );
  yield* gateExit(target, "test", exitCode);
});

const TEMPLATE_PATH = "scratchpad/docgen.effected.template.json";

/**
 * Writes `scratchpad/docgen.<target>.json` from the shared template.
 *
 * **Example** (Materialize a docgen config)
 *
 * ```ts
 * import { writeDocgenConfig } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(writeDocgenConfig(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const writeDocgenConfig = Effect.fn("Gates.writeDocgenConfig")(function* (config: RunnerConfig, target: AuditTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const template = yield* fs.readFileString(path.join(config.repoRoot, TEMPLATE_PATH));
  yield* fs.writeFileString(path.join(config.repoRoot, labPaths(target).docgenConfig), Str.replaceAll("__MODULE__", target)(template));
});

/**
 * The docgen gate: materialize the config, run docgen with every enforcement
 * flag on, then the repo's doctest verifier scoped to the target.
 *
 * **Example** (Run the docgen gate)
 *
 * ```ts
 * import { docgen } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(docgen(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category gates
 * @since 0.0.0
 */
export const docgen = Effect.fn("Gates.docgen")(function* (config: RunnerConfig, target: AuditTarget) {
  yield* writeDocgenConfig(config, target);
  const generated = yield* runInherited(
    heavy({
      command: "bun",
      args: ["run", "--cwd", "scratchpad", "docgen", "--config-file", `docgen.${target}.json`],
      cwd: config.repoRoot,
    })
  );
  if (generated !== 0) {
    return yield* gateExit(target, "docgen", generated);
  }
  const verified = yield* runInherited({
    command: "bun",
    args: ["run", "beep", "docgen", "doctest", "verify", "--include", `${labPaths(target).sourceDir}/**/*.ts`],
    cwd: config.repoRoot,
  });
  yield* gateExit(target, "docgen", verified);
});

/**
 * Which gates `audit` runs for a target at a stage: parity is strict from S1,
 * docgen joins from S2, coverage from S3; the runner runs every gate but
 * parity.
 *
 * **Example** (Plan the gates of a stage)
 *
 * ```ts
 * import { gatePlan } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(gatePlan("yaml", 3)) // { parity: true, strict: true, docgen: true, coverage: true }
 * console.log(gatePlan("runner", 0)) // { parity: false, strict: true, docgen: true, coverage: false }
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const gatePlan = (
  target: AuditTarget,
  stage: number
): { readonly parity: boolean; readonly strict: boolean; readonly docgen: boolean; readonly coverage: boolean } =>
  isModuleTarget(target)
    ? { parity: true, strict: stage >= 1, docgen: stage >= 2, coverage: stage >= 3 }
    : { parity: false, strict: true, docgen: true, coverage: false };
