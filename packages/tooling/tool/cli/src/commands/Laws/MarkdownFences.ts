/**
 * Repo-local Markdown TypeScript fence typecheck law.
 *
 * **Details**
 *
 * Every TypeScript fence (`ts`, `tsx`, `typescript`, `mts`, `cts`) on the
 * guidance surface is written to its own module under `.beep/` and compiled
 * once with the repository's `tsrs` against the root `tsconfig.json`, so
 * `@beep/*` and `effect/*` imports resolve to the workspace's real packages.
 * Each compiler diagnostic is mapped back to its Markdown path and line.
 *
 * The guidance surface is the git-tracked Markdown under `.patterns/`,
 * `standards/`, `docs/` (minus `docs/_internal/` and `docs/generated/`),
 * `.claude/skills/` (minus vendored skills recorded in `skills-lock.json`),
 * `.claude/agents/` and `.codex/`, every regular `AGENTS.md` and `CLAUDE.md`,
 * and the `README.md` of every package and app. Goal, exploration and
 * research packets, scratchpads, vendored trees and test fixtures are never
 * on it.
 *
 * A fence whose info string carries docgen's `skip-type-checking` token is a
 * reviewed opt-out. A fence inside a `docgen:api-reference` region is
 * rendered by docgen from source JSDoc that docgen already typechecks, so it
 * is not compiled again. A checked fence containing `@ts-expect-error` or
 * `@ts-nocheck` fails, because either directive would hide it from the check;
 * a negative example proves its failure with `@ts-expect-error` instead.
 *
 * A diagnostic the compiler reports past a fence's last body line (an
 * unclosed `{`, `(`, string or template is reported at end of file) is
 * attributed to that last line, so no diagnostic of a staged fence is dropped.
 *
 * A compiler run is a verdict only when every `error TS` line it prints maps
 * to a staged fence and, on a nonzero exit, at least one does. Otherwise the
 * law fails with a `MarkdownFencesCompilerError` naming the exit code and the
 * last 20 output lines: `exit-without-diagnostics` for a nonzero exit with no
 * fence diagnostic (a crash, kill or panic), `unattributed-diagnostics` for an
 * error line outside the staged fences, whatever the exit code. A crash
 * therefore never reports `failed=0`. Unattributed failures also retain the
 * first 20 unattributed `error TS` lines and their total count, so later fence
 * diagnostics cannot hide the offending output.
 *
 * **Gotchas**
 *
 * The compiler reports no semantic diagnostic while any staged fence has a
 * syntax error, so fix syntax failures first and re-run. The Effect
 * language-service lint diagnostics are switched off for staged fences; the
 * law checks that an example compiles, not its style.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SKIP_TYPE_CHECKING_FENCE_METADATA } from "@beep/repo-docgen/Core";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunk0 } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { runCaptured } from "../../internal/process/StepExec.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { readSkillsLockDocument } from "../Skills/internal/LockFile.ts";
import { messageGitErrorAdapter, scanTrackedTextFiles } from "./internal/TrackedTextFiles.ts";
import { typescriptFences } from "./internal/TypeScriptFences.ts";
import { MarkdownFencesCompilerError, MarkdownFencesExecutionError } from "./Laws.errors.ts";
import {
  MarkdownFence,
  MarkdownFenceDiagnostic,
  MarkdownFenceLanguage,
  MarkdownFencesSummary,
  MarkdownFenceVerdict,
} from "./MarkdownFences.model.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { MarkdownFencesCompilerFailureReason } from "./Laws.errors.ts";
import type { MarkdownFenceDisposition, MarkdownFencesOptions } from "./MarkdownFences.model.ts";

const $I = $RepoCliId.create("commands/Laws/MarkdownFences");

/** Opening and closing markers of the README region docgen renders from source JSDoc. */
const DOCGEN_REGION_START = "<!-- docgen:api-reference:start -->";
const DOCGEN_REGION_END = "<!-- docgen:api-reference:end -->";

const MARKDOWN_EXTENSIONS = [".md", ".mdx"] as const;
const SURFACE_PREFIXES = [
  ".patterns/",
  "standards/",
  "docs/",
  ".claude/skills/",
  ".claude/agents/",
  ".codex/",
] as const;
const README_PREFIXES = ["packages/", "apps/"] as const;
const GUIDANCE_FILE_NAMES = ["AGENTS.md", "CLAUDE.md"] as const;
const EXCLUDED_PREFIXES = [
  "docs/_internal/",
  "docs/generated/",
  "goals/",
  "explorations/",
  "research/",
  "scratchpad/",
  "vendor/",
  ".repos/",
] as const;
const EXCLUDED_SEGMENTS = ["/node_modules/", "/test/fixtures/", "/.claude/worktrees/"] as const;
const SKILLS_PREFIX = ".claude/skills/";

/** Staged module names are `fence-<index>.ts(x)`; `tsc --pretty false` prints diagnostics as `file(line,col): error TSn: message`. */
const DIAGNOSTIC_PATTERN = /^fence-(\d+)\.tsx?\((\d+),(\d+)\): error (TS\d+): (.*)$/gmu;
const ERROR_LINE_PATTERN = /error TS\d+:/u;
/** Lines of compiler output carried by a compiler failure. */
const OUTPUT_TAIL_LINES = 20;
const UNATTRIBUTED_DIAGNOSTIC_LIMIT = 20;
const TRAILING_NEWLINE_PATTERN = /\n$/u;
/** Directives that would silently exempt a staged fence from the check. */
const SUPPRESSION_PATTERN = /@ts-(?:nocheck|ignore)\b/gu;

const decodeLanguage = S.decodeUnknownOption(MarkdownFenceLanguage);
const byLocation = Order.combine(
  Order.mapInput(Order.String, (fence: MarkdownFence) => fence.path),
  Order.mapInput(Order.Number, (fence: MarkdownFence) => fence.line)
);

const hasPrefix = (file: string, prefixes: ReadonlyArray<string>): boolean =>
  A.some(prefixes, (prefix) => Str.startsWith(prefix)(file));

const bodyLineCount = (fence: MarkdownFence): number =>
  A.length(Str.split("\n")(Str.replace(TRAILING_NEWLINE_PATTERN, "")(fence.body)));

const baseName = (file: string): string => A.lastNonEmpty(Str.split("/")(file));

const skillName = (file: string): string => A.headNonEmpty(Str.split("/")(Str.slice(Str.length(SKILLS_PREFIX))(file)));

/**
 * Whether a repository-relative path is on the Markdown fence guidance surface.
 *
 * **Example** (Classify guidance and history paths)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { isMarkdownFenceSurfacePath } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * const vendored = HashSet.make("shadcn")
 * console.log(isMarkdownFenceSurfacePath("standards/ARCHITECTURE.md", vendored)) // true
 * console.log(isMarkdownFenceSurfacePath("packages/demo/README.md", vendored)) // true
 * console.log(isMarkdownFenceSurfacePath("goals/demo/SPEC.md", vendored)) // false
 * console.log(isMarkdownFenceSurfacePath(".claude/skills/shadcn/SKILL.md", vendored)) // false
 * ```
 *
 * @param file - Repository-relative path.
 * @param vendoredSkills - Names of the skills `skills-lock.json` records as vendored.
 * @returns `true` when the law compiles the file's TypeScript fences.
 * @category predicates
 * @since 0.0.0
 */
export const isMarkdownFenceSurfacePath: {
  (vendoredSkills: HashSet.HashSet<string>): (file: string) => boolean;
  (file: string, vendoredSkills: HashSet.HashSet<string>): boolean;
} = dual(
  2,
  (file: string, vendoredSkills: HashSet.HashSet<string>): boolean =>
    A.some(MARKDOWN_EXTENSIONS, (extension) => Str.endsWith(extension)(file)) &&
    !hasPrefix(file, EXCLUDED_PREFIXES) &&
    !A.some(EXCLUDED_SEGMENTS, (segment) => Str.includes(segment)(`/${file}`)) &&
    !(Str.startsWith(SKILLS_PREFIX)(file) && HashSet.has(vendoredSkills, skillName(file))) &&
    (hasPrefix(file, SURFACE_PREFIXES) ||
      A.contains(GUIDANCE_FILE_NAMES, baseName(file)) ||
      (hasPrefix(file, README_PREFIXES) && baseName(file) === "README.md"))
);

const docgenRegionLines = (content: string): ReadonlyArray<readonly [start: number, end: number]> => {
  const lines = Str.split("\n")(content);
  const starts = A.filter(A.range(0, A.length(lines) - 1), (index) =>
    pipe(A.getUnsafe(lines, index), Str.includes(DOCGEN_REGION_START))
  );
  return A.map(starts, (start) => [
    start,
    pipe(
      A.findFirstIndex(A.drop(lines, start), Str.includes(DOCGEN_REGION_END)),
      O.match({ onNone: () => A.length(lines), onSome: (offset) => start + offset })
    ),
  ]);
};

const dispositionOf = (
  infoString: string,
  openingLineIndex: number,
  regions: ReadonlyArray<readonly [start: number, end: number]>
): MarkdownFenceDisposition =>
  A.some(regions, ([start, end]) => openingLineIndex > start && openingLineIndex < end)
    ? "generated"
    : A.contains(Str.split(/\s+/u)(Str.toLowerCase(infoString)), SKIP_TYPE_CHECKING_FENCE_METADATA)
      ? "opt-out"
      : "checked";

/**
 * Collect the TypeScript fences of one Markdown text with their dispositions.
 *
 * **Details**
 *
 * Non-TypeScript fences are ignored. The opt-out token must be a whole
 * info-string word, so `ts skip-type-checking` opts out and a title that
 * merely contains the phrase does not.
 *
 * **Example** (Collect a checked and an opted-out fence)
 *
 * ```ts
 * import { collectMarkdownFences } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * const fence = "`".repeat(3)
 * const markdown = [`${fence}ts`, "const a = 1", fence, `${fence}ts skip-type-checking`, "partial(", fence].join("\n")
 *
 * console.log(collectMarkdownFences("docs/demo.md", markdown).map((item) => item.disposition)) // ["checked", "opt-out"]
 * ```
 *
 * @param file - Repository-relative Markdown path recorded on each fence.
 * @param content - Markdown text.
 * @returns Fences in source order.
 * @category utilities
 * @since 0.0.0
 */
export const collectMarkdownFences: {
  (content: string): (file: string) => ReadonlyArray<MarkdownFence>;
  (file: string, content: string): ReadonlyArray<MarkdownFence>;
} = dual(2, (file: string, content: string): ReadonlyArray<MarkdownFence> => {
  const regions = docgenRegionLines(content);
  return A.getSomes(
    A.map(typescriptFences(content), (fence) =>
      O.map(decodeLanguage(fence.language), (language) =>
        MarkdownFence.make({
          path: file,
          line: fence.openingLineIndex + 1,
          infoString: fence.infoString,
          language,
          body: fence.code,
          disposition: dispositionOf(fence.infoString, fence.openingLineIndex, regions),
        })
      )
    )
  );
});

class LanguageServicePlugin extends S.Opaque<LanguageServicePlugin, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    diagnostics: S.Boolean,
  }).pipe(
    $I.annoteSchema("LanguageServicePlugin", {
      description:
        "Language-service plugin entry that switches the Effect plugin's lint diagnostics off for staged fences.",
    })
  )
) {}

class FenceCompilerOptions extends S.Opaque<FenceCompilerOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    noEmit: S.Boolean,
    composite: S.Boolean,
    incremental: S.Boolean,
    tsBuildInfoFile: S.Null,
    noUnusedLocals: S.Boolean,
    noUnusedParameters: S.Boolean,
    moduleDetection: S.tag("force"),
    plugins: S.Array(LanguageServicePlugin),
  }).pipe(
    $I.annoteSchema("FenceCompilerOptions", {
      description: "Compiler option overrides for the staged Markdown fence project.",
    })
  )
) {}

class FenceProjectConfig extends S.Opaque<FenceProjectConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    extends: S.String,
    files: S.Array(S.String),
    include: S.Array(S.String),
    compilerOptions: FenceCompilerOptions,
  }).pipe(
    $I.annoteSchema("FenceProjectConfig", {
      description: "The tsconfig that compiles staged Markdown fences against the root workspace config.",
    })
  )
) {}

const FenceProjectConfigJson = JsonStringCodec(FenceProjectConfig);

/**
 * Staged file name of the fence at `index`.
 *
 * **Example** (Name a tsx fence)
 *
 * ```ts
 * import { stagedFenceFileName } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * console.log(stagedFenceFileName(7, "tsx")) // "fence-7.tsx"
 * ```
 *
 * @param index - Position of the fence in the checked list.
 * @param language - The fence's language word.
 * @returns `fence-<index>.tsx` for `tsx` fences and `fence-<index>.ts` otherwise.
 * @category utilities
 * @since 0.0.0
 */
export const stagedFenceFileName: {
  (language: MarkdownFenceLanguage): (index: number) => string;
  (index: number, language: MarkdownFenceLanguage): string;
} = dual(
  2,
  (index: number, language: MarkdownFenceLanguage): string => `fence-${index}${language === "tsx" ? ".tsx" : ".ts"}`
);

/**
 * Map `tsc --pretty false` output for staged fences back to Markdown diagnostics.
 *
 * **Details**
 *
 * Body line `n` of the fence opened on Markdown line `l` is Markdown line
 * `l + n`. A diagnostic past the last body line, where the compiler reports an
 * unclosed bracket, string or template at end of file, maps to the last body
 * line. A diagnostic whose staged index names no fence is dropped; the
 * caller compares the error count against the mapped count.
 *
 * **Example** (Map a missing-name diagnostic)
 *
 * ```ts
 * import { MarkdownFence } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 * import { mapFenceDiagnostics } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * const fence = MarkdownFence.make({
 *   path: "docs/demo.md",
 *   line: 3,
 *   infoString: "ts",
 *   language: "ts",
 *   body: "missing()",
 *   disposition: "checked",
 * })
 * const [diagnostic] = mapFenceDiagnostics([fence], "fence-0.ts(1,1): error TS2304: Cannot find name 'missing'.")
 *
 * console.log(`${diagnostic?.path}:${diagnostic?.line}`) // "docs/demo.md:4"
 * ```
 *
 * @param fences - The checked fences in staged order.
 * @param output - Compiler output.
 * @returns Diagnostics in output order.
 * @category utilities
 * @since 0.0.0
 */
export const mapFenceDiagnostics: {
  (output: string): (fences: ReadonlyArray<MarkdownFence>) => ReadonlyArray<MarkdownFenceDiagnostic>;
  (fences: ReadonlyArray<MarkdownFence>, output: string): ReadonlyArray<MarkdownFenceDiagnostic>;
} = dual(
  2,
  (fences: ReadonlyArray<MarkdownFence>, output: string): ReadonlyArray<MarkdownFenceDiagnostic> =>
    A.getSomes(
      A.map(A.fromIterable(Str.matchAll(DIAGNOSTIC_PATTERN)(output)), ([, index, line, column, code, message]) =>
        O.map(A.get(fences, Number(index)), (fence) =>
          MarkdownFenceDiagnostic.make({
            path: fence.path,
            line: fence.line + Num.min(Number(line), bodyLineCount(fence)),
            column: Number(column),
            code: `${code}`,
            message: `${message}`,
          })
        )
      )
    )
);

/**
 * The compile step of the Markdown fence law.
 *
 * **Details**
 *
 * `typecheck` stages each fence as its own module inside the repository,
 * compiles the set once, and returns the diagnostics mapped back to Markdown
 * lines. Its live layer removes the staging directory when it finishes.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { MarkdownFenceTypechecker } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * console.log(MarkdownFenceTypechecker.layer !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MarkdownFenceTypechecker extends Context.Service<
  MarkdownFenceTypechecker,
  {
    readonly typecheck: (
      repoRoot: string,
      fences: ReadonlyArray<MarkdownFence>
    ) => Effect.Effect<
      ReadonlyArray<MarkdownFenceDiagnostic>,
      MarkdownFencesExecutionError | MarkdownFencesCompilerError
    >;
  }
>()($I`MarkdownFenceTypechecker`) {
  /**
   * Builds the live typechecker from the file system, path, crypto and process
   * spawner in the current context.
   *
   * **Details**
   *
   * The service captures that context once, so a test that replaces the
   * process spawner before building it stubs the compiler run.
   *
   * **Example** (Build the typechecker in place)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { MarkdownFenceTypechecker } from "@beep/repo-cli/commands/Laws/MarkdownFences"
   *
   * console.log(Effect.isEffect(MarkdownFenceTypechecker.make)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make: Effect.Effect<
    MarkdownFenceTypechecker["Service"],
    never,
    SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > = Effect.gen(function* () {
    const context = yield* Effect.context<
      SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
    >();
    return MarkdownFenceTypechecker.of({
      typecheck: Effect.fn("MarkdownFenceTypechecker.typecheck")(function* (repoRoot, fences) {
        return yield* typecheckStaged(repoRoot, fences).pipe(Effect.provideContext(context));
      }),
    });
  });

  /**
   * Live typechecker over the repository's `tsrs`, the file system and the process spawner.
   *
   * **Example** (Provide the live typechecker)
   *
   * ```ts
   * import * as Layer from "effect/Layer"
   * import { MarkdownFenceTypechecker } from "@beep/repo-cli/commands/Laws/MarkdownFences"
   *
   * console.log(Layer.isLayer(MarkdownFenceTypechecker.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    MarkdownFenceTypechecker,
    never,
    SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(MarkdownFenceTypechecker, MarkdownFenceTypechecker.make);
}

const typecheckStaged = Effect.fnUntraced(function* (
  repoRoot: string,
  fences: ReadonlyArray<MarkdownFence>
): Effect.fn.Return<
  ReadonlyArray<MarkdownFenceDiagnostic>,
  MarkdownFencesExecutionError | MarkdownFencesCompilerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (A.isReadonlyArrayEmpty(fences)) {
    return A.empty();
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stagingRoot = path.join(repoRoot, ".beep");
  yield* fs
    .makeDirectory(stagingRoot, { recursive: true })
    .pipe(MarkdownFencesExecutionError.mapError(`Failed to create ${stagingRoot}`));
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const directory = yield* fs
        .makeTempDirectoryScoped({ directory: stagingRoot, prefix: "markdown-fences-" })
        .pipe(MarkdownFencesExecutionError.mapError("Failed to create the fence staging directory"));
      const files = A.map(fences, (fence, index) => stagedFenceFileName(index, fence.language));
      yield* Effect.forEach(
        A.zip(files, fences),
        ([file, fence]) =>
          fs
            .writeFileString(path.join(directory, file), `${fence.body}\n`)
            .pipe(MarkdownFencesExecutionError.mapError(`Failed to stage ${fence.path}:${fence.line}`)),
        { discard: true }
      );
      const config = yield* FenceProjectConfigJson.encode(
        FenceProjectConfig.make({
          extends: path.relative(directory, path.join(repoRoot, "tsconfig.json")),
          files,
          include: A.empty(),
          compilerOptions: FenceCompilerOptions.make({
            noEmit: true,
            composite: false,
            incremental: false,
            tsBuildInfoFile: null,
            noUnusedLocals: false,
            noUnusedParameters: false,
            moduleDetection: "force",
            plugins: [LanguageServicePlugin.make({ name: "@effect/language-service", diagnostics: false })],
          }),
        })
      ).pipe(MarkdownFencesExecutionError.mapError("Failed to encode the fence tsconfig"));
      yield* fs
        .writeFileString(path.join(directory, "tsconfig.json"), config)
        .pipe(MarkdownFencesExecutionError.mapError("Failed to write the fence tsconfig"));
      const compiler = path.join(repoRoot, "node_modules", ".bin", "tsrs");
      const step = yield* runCaptured({
        command: compiler,
        args: ["--noEmit", "--pretty", "false", "-p", "tsconfig.json"],
        cwd: directory,
        source: "merge",
      }).pipe(MarkdownFencesExecutionError.mapError(`Failed to run ${compiler}`));
      const diagnostics = mapFenceDiagnostics(fences, step.output);
      const outputLines = Str.split("\n")(Str.trimEnd(step.output));
      const errorLines = A.filter(outputLines, (line) => ERROR_LINE_PATTERN.test(line));
      const unattributedErrorLines = A.filter(errorLines, (line) =>
        A.isReadonlyArrayEmpty(mapFenceDiagnostics(fences, line))
      );
      const unattributedDiagnostics = A.take(unattributedErrorLines, UNATTRIBUTED_DIAGNOSTIC_LIMIT);
      const unattributedDiagnosticCount = A.length(unattributedErrorLines);
      const unattributedDetail = A.isReadonlyArrayEmpty(unattributedDiagnostics)
        ? ""
        : `\n${unattributedDiagnosticCount} unattributed error TS lines (first ${UNATTRIBUTED_DIAGNOSTIC_LIMIT}):\n${A.join(unattributedDiagnostics, "\n")}`;
      const outputTail = A.join(A.takeRight(outputLines, OUTPUT_TAIL_LINES), "\n");
      const compilerFailure = (reason: MarkdownFencesCompilerFailureReason, detail: string) =>
        MarkdownFencesCompilerError.make({
          reason,
          exitCode: step.exitCode,
          outputTail,
          unattributedDiagnostics,
          unattributedDiagnosticCount,
          message: `${compiler} exited ${step.exitCode} ${detail}.${unattributedDetail}\nLast ${OUTPUT_TAIL_LINES} output lines:\n${outputTail}`,
        });
      if (A.length(errorLines) !== A.length(diagnostics)) {
        return yield* compilerFailure("unattributed-diagnostics", "with diagnostics outside the staged fences");
      }
      if (step.exitCode !== 0 && A.isReadonlyArrayEmpty(diagnostics)) {
        return yield* compilerFailure(
          "exit-without-diagnostics",
          "without a fence diagnostic (a crash, kill or panic is not a verdict)"
        );
      }
      return diagnostics;
    })
  );
});

const suppressionDiagnostics = (fence: MarkdownFence): ReadonlyArray<MarkdownFenceDiagnostic> =>
  A.flatMap(Str.split("\n")(fence.body), (text, index) =>
    A.map(A.fromIterable(Str.matchAll(SUPPRESSION_PATTERN)(text)), (match) =>
      MarkdownFenceDiagnostic.make({
        path: fence.path,
        line: fence.line + index + 1,
        column: O.getOrElse(O.fromNullishOr(match.index), thunk0) + 1,
        code: "fence-suppression",
        message: `${match[0]} hides the fence from the check; use @ts-expect-error for a negative example or the ${SKIP_TYPE_CHECKING_FENCE_METADATA} opt-out.`,
      })
    )
  );

const verdictsFor = (
  fences: ReadonlyArray<MarkdownFence>,
  diagnostics: ReadonlyArray<MarkdownFenceDiagnostic>
): ReadonlyArray<MarkdownFenceVerdict> => {
  const byFence = A.groupBy(diagnostics, (diagnostic) => diagnostic.path);
  return A.map(fences, (fence): MarkdownFenceVerdict => {
    if (fence.disposition !== "checked") {
      return MarkdownFenceVerdict.cases.skipped.make({ fence });
    }
    const end = fence.line + bodyLineCount(fence);
    const own = A.appendAll(
      suppressionDiagnostics(fence),
      A.filter(
        O.getOrElse(R.get(byFence, fence.path), A.empty<MarkdownFenceDiagnostic>),
        (diagnostic) => diagnostic.line > fence.line && diagnostic.line <= end
      )
    );
    return A.isReadonlyArrayNonEmpty(own)
      ? MarkdownFenceVerdict.cases.failed.make({ fence, diagnostics: own })
      : MarkdownFenceVerdict.cases.passed.make({ fence });
  });
};

/**
 * Render one failed fence as `path:line:col  TSn message` report lines.
 *
 * **Example** (Format a failed verdict)
 *
 * ```ts
 * import { MarkdownFence, MarkdownFenceDiagnostic, MarkdownFenceVerdict } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 * import { formatMarkdownFenceFailure } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * const fence = MarkdownFence.make({
 *   path: "docs/demo.md",
 *   line: 3,
 *   infoString: "ts",
 *   language: "ts",
 *   body: "missing()",
 *   disposition: "checked",
 * })
 * const diagnostic = MarkdownFenceDiagnostic.make({
 *   path: "docs/demo.md",
 *   line: 4,
 *   column: 1,
 *   code: "TS2304",
 *   message: "Cannot find name 'missing'.",
 * })
 *
 * console.log(formatMarkdownFenceFailure(MarkdownFenceVerdict.cases.failed.make({ fence, diagnostics: [diagnostic] })))
 * // ["docs/demo.md:4:1  TS2304 Cannot find name 'missing'."]
 * ```
 *
 * @param failure - A failed verdict.
 * @returns One line per diagnostic.
 * @category utilities
 * @since 0.0.0
 */
export const formatMarkdownFenceFailure = (
  failure: typeof MarkdownFenceVerdict.cases.failed.Type
): ReadonlyArray<string> =>
  A.map(
    failure.diagnostics,
    (diagnostic) =>
      `${diagnostic.path}:${diagnostic.line}:${diagnostic.column}  ${diagnostic.code} ${diagnostic.message}`
  );

const countBy = (fences: ReadonlyArray<MarkdownFence>, disposition: MarkdownFenceDisposition): number =>
  A.length(A.filter(fences, (fence) => fence.disposition === disposition));

/**
 * Run the Markdown fence typecheck law over the guidance surface.
 *
 * **Details**
 *
 * Reads `skills-lock.json` for the vendored skills, lists the git-tracked
 * regular files, keeps the guidance surface, collects every TypeScript
 * fence, and compiles the `checked` ones through
 * {@link MarkdownFenceTypechecker}.
 *
 * **Example** (Count failing fences)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MarkdownFencesOptions } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 * import { MarkdownFenceTypechecker, runMarkdownFences } from "@beep/repo-cli/commands/Laws/MarkdownFences"
 *
 * const program = runMarkdownFences(MarkdownFencesOptions.make({ cwd: process.cwd(), strictCheck: true })).pipe(
 *   Effect.map((summary) => summary.failures.length),
 *   Effect.provide(MarkdownFenceTypechecker.layer)
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location and strictness.
 * @returns Effect with the fence counts and failed verdicts.
 * @category utilities
 * @since 0.0.0
 */
export const runMarkdownFences = Effect.fn("MarkdownFences.runMarkdownFences")(function* (
  options: MarkdownFencesOptions
): Effect.fn.Return<
  MarkdownFencesSummary,
  MarkdownFencesExecutionError | MarkdownFencesCompilerError,
  | SecureRandom.SecureRandom
  | Digest.Digest
  | MarkdownFenceTypechecker
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    MarkdownFencesExecutionError.mapError("Failed to locate the repository root")
  );
  const { document } = yield* readSkillsLockDocument(repoRoot).pipe(
    MarkdownFencesExecutionError.mapError("Failed to read skills-lock.json")
  );
  const vendoredSkills = HashSet.fromIterable(R.keys(R.filter(document.skills, (entry) => entry._tag === "vendored")));
  const isOffSurface = (file: string): boolean =>
    !(isMarkdownFenceSurfacePath(file, vendoredSkills) && Str.startsWith(options.pathPrefix)(file));
  const scan = yield* scanTrackedTextFiles({
    cwd: repoRoot,
    gitErrors: messageGitErrorAdapter(MarkdownFencesExecutionError.new),
    mapError: MarkdownFencesExecutionError.mapError,
    isSkipped: isOffSurface,
    scan: collectMarkdownFences,
  });
  const fences = A.sort(scan.findings, byLocation);
  const checked = A.filter(fences, (fence) => fence.disposition === "checked");
  const typechecker = yield* MarkdownFenceTypechecker;
  const diagnostics = yield* typechecker.typecheck(repoRoot, checked);
  const failures = A.filter(verdictsFor(fences, diagnostics), MarkdownFenceVerdict.guards.failed);
  return MarkdownFencesSummary.make({
    scannedFiles: scan.scannedFiles,
    fenceFiles: A.length(A.dedupe(A.map(fences, (fence) => fence.path))),
    fences: A.length(fences),
    checkedFences: A.length(checked),
    optOutFences: countBy(fences, "opt-out"),
    generatedFences: countBy(fences, "generated"),
    failures,
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(failures),
  });
});
