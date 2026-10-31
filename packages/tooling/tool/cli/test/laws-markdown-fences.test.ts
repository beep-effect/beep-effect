import {
  collectMarkdownFences,
  formatMarkdownFenceFailure,
  isMarkdownFenceSurfacePath,
  MarkdownFenceDiagnostic,
  MarkdownFenceTypechecker,
  MarkdownFenceVerdict,
  mapFenceDiagnostics,
  scanMarkdownFenceFile,
  stagedFenceFileName,
  TypecheckFence,
} from "@beep/repo-cli/commands/Laws";
import { scriptFences, typescriptFences } from "@beep/repo-cli/test/Laws";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const fence = Str.repeat(3)("`");
const markdownOf = (...lines: ReadonlyArray<string>): string => A.join(lines, "\n");
const vendored = HashSet.make("shadcn");
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));
const TypecheckerLayer = MarkdownFenceTypechecker.layer.pipe(Layer.provideMerge(PlatformLayer));

const encoder = new TextEncoder();

/** A finished compiler process with fixed combined output and exit code. */
const compilerHandle = (output: string, exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    stdout: Stream.make(encoder.encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

/** Replaces only the `tsrs` spawn with a stub; git and every other command still run. */
const withStubCompiler =
  (output: string, exitCode: number) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.flatMap(Effect.service(ChildProcessSpawner.ChildProcessSpawner), (real) =>
      Effect.provideService(
        self,
        ChildProcessSpawner.ChildProcessSpawner,
        ChildProcessSpawner.make((command) =>
          ChildProcess.isStandardCommand(command) && Str.endsWith("tsrs")(command.command)
            ? Effect.succeed(compilerHandle(output, exitCode))
            : real.spawn(command)
        )
      )
    );

const checkedFence = (path: string, line: number, body: string, language: "ts" | "tsx" = "ts") =>
  TypecheckFence.make({ path, line, infoString: language, language, body, disposition: "checked" });

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

describe("Markdown fence typecheck law", () => {
  describe("fence collection", () => {
    it.effect("keeps TypeScript fences, ignores other languages, and reads the opt-out word", () =>
      Effect.sync(() => {
        const markdown = markdownOf(
          "# Guide",
          `${fence}ts`,
          "const a: number = 1",
          fence,
          `${fence}bash`,
          "echo not typescript",
          fence,
          `${fence}js`,
          "const b = 2",
          fence,
          `${fence}tsx title=view`,
          "const view = <div />",
          fence,
          `${fence}typescript skip-type-checking`,
          "partial(",
          fence,
          `${fence}ts title=skip-type-checking-demo`,
          "const c = 3",
          fence
        );

        const fences = collectMarkdownFences("docs/guide.md", markdown);

        expect(A.map(fences, (item) => [item.line, item.language, item.disposition, item.infoString])).toEqual([
          [2, "ts", "checked", "ts"],
          [11, "tsx", "checked", "tsx title=view"],
          [14, "typescript", "opt-out", "typescript skip-type-checking"],
          [17, "ts", "checked", "ts title=skip-type-checking-demo"],
        ]);
        expect(A.map(fences, (item) => item.body)).toEqual([
          "const a: number = 1\n",
          "const view = <div />\n",
          "partial(\n",
          "const c = 3\n",
        ]);
      })
    );

    it.effect("marks fences inside a docgen API reference region as generated, closed or not", () =>
      Effect.sync(() => {
        const closed = markdownOf(
          "<!-- docgen:api-reference:start -->",
          `${fence}ts`,
          "declare const generated: number",
          fence,
          "<!-- docgen:api-reference:end -->",
          `${fence}ts`,
          "const after = 1",
          fence
        );
        const unclosed = markdownOf("<!-- docgen:api-reference:start -->", `${fence}ts`, "const inside = 1", fence);

        expect(A.map(collectMarkdownFences("packages/demo/README.md", closed), (item) => item.disposition)).toEqual([
          "generated",
          "checked",
        ]);
        expect(
          pipe(
            "packages/demo/README.md",
            collectMarkdownFences(unclosed),
            A.map((item) => item.disposition)
          )
        ).toEqual(["generated"]);
      })
    );

    it.effect("reads fences inside blockquotes and list items without their container prefix", () =>
      Effect.sync(() => {
        const markdown = markdownOf(
          `> ${fence}ts`,
          "> const quoted = 1",
          `> ${fence}`,
          "",
          "- item",
          "",
          `  ${fence}tsx`,
          "  const listed = <b />",
          `  ${fence}`
        );

        expect(
          A.map(typescriptFences(markdown)[0], (item) => [item.language, item.openingLineIndex, item.code])
        ).toEqual([
          ["ts", 0, "const quoted = 1\n"],
          ["tsx", 6, "const listed = <b />\n"],
        ]);
      })
    );

    it.effect("marks container fences as not spliceable and reads their code without the prefix", () =>
      Effect.sync(() => {
        const markdown = markdownOf(
          `${fence}ts`,
          'import * as Effect from "effect"',
          fence,
          "",
          `> ${fence}ts`,
          '> import * as Option from "effect"',
          `> ${fence}`,
          "",
          "- item",
          "",
          `  ${fence}js`,
          '  import * as Schema from "effect"',
          `  ${fence}`
        );
        const [fences, warnings] = scriptFences(markdown);

        expect(warnings).toEqual([]);
        expect(A.map(fences, (item) => [item.code, item.inPlace])).toEqual([
          ['import * as Effect from "effect"\n', true],
          ['import * as Option from "effect"\n', false],
          ['import * as Schema from "effect"\n', false],
        ]);
      })
    );

    it.effect("reports a text the parser refuses instead of passing it", () =>
      Effect.sync(() => {
        const markdown = `${Str.repeat(300)(">")} ${fence}ts\nconst deep = 1\n`;
        const [fences, warnings] = typescriptFences(markdown);
        const [collected, diagnostics] = A.separate(scanMarkdownFenceFile("docs/deep.md", markdown));

        expect(fences).toEqual([]);
        expect(warnings).toHaveLength(1);
        expect(collected).toEqual([]);
        expect(A.map(diagnostics, (item) => [item.path, item.line, item.code])).toEqual([
          ["docs/deep.md", 1, "markdown-parse"],
        ]);
        expect(collectMarkdownFences("docs/deep.md", markdown)).toEqual([]);
        expect(typescriptFences("no fence here")).toEqual([[], []]);
      })
    );

    it.effect("parses four-marker and tilde fences with exact closing runs", () =>
      Effect.sync(() => {
        const four = Str.repeat(4)("`");
        const markdown = markdownOf(
          `${four}ts`,
          "/**",
          ` * ${fence}ts`,
          " * inner()",
          ` * ${fence}`,
          " */",
          four,
          "~~~mts",
          "const m = 1",
          "~~~"
        );

        expect(
          A.map(typescriptFences(markdown)[0], (item) => [item.language, item.openingLineIndex, item.codeLineIndex])
        ).toEqual([
          ["ts", 0, 1],
          ["mts", 7, 8],
        ]);
      })
    );
  });

  describe("guidance surface", () => {
    it.effect("accepts the guidance roots and rejects history, private, vendored and fixture paths", () =>
      Effect.sync(() => {
        const accepted = [
          ".patterns/testing-patterns.md",
          "standards/ARCHITECTURE.md",
          "docs/runbooks/agent-pools.md",
          ".claude/skills/yeet/SKILL.md",
          ".claude/agents/crispener.md",
          ".codex/notes.mdx",
          "AGENTS.md",
          "packages/drivers/git/AGENTS.md",
          "apps/web/CLAUDE.md",
          "packages/drivers/git/README.md",
          "apps/web/README.md",
        ];
        const rejected = [
          "goals/demo/SPEC.md",
          "explorations/demo/README.md",
          "research/2026/notes.md",
          "scratchpad/AGENTS.md",
          "docs/_internal/private.md",
          "docs/generated/api.md",
          ".claude/skills/shadcn/SKILL.md",
          ".claude/worktrees/lane/AGENTS.md",
          "packages/tooling/tool/cli/test/fixtures/demo/README.md",
          "packages/demo/node_modules/dep/README.md",
          "vendor/lib/README.md",
          ".repos/effect/README.md",
          "README.md",
          "packages/demo/CHANGELOG.md",
          "standards/diagram.svg",
        ];

        expect(A.filter(accepted, (file) => !isMarkdownFenceSurfacePath(file, vendored))).toEqual([]);
        expect(A.filter(rejected, isMarkdownFenceSurfacePath(vendored))).toEqual([]);
      })
    );
  });

  describe("diagnostic mapping", () => {
    it.effect(
      "maps staged diagnostics to Markdown lines, end-of-file ones to the last body line, and drops unknown fences",
      () =>
        Effect.sync(() => {
          const fences = [checkedFence("docs/a.md", 3, "missing()\n"), checkedFence("docs/b.md", 10, "x\ny\n")];
          const output = A.join(
            [
              "fence-0.ts(1,1): error TS2304: Cannot find name 'missing'.",
              "fence-1.ts(2,5): error TS2322: Type 'string' is not assignable to type 'number'.",
              "  continuation line of a message chain",
              "fence-1.ts(3,1): error TS1005: '}' expected.",
              "fence-9.ts(1,1): error TS2304: Cannot find name 'gone'.",
            ],
            "\n"
          );

          expect(
            A.map(mapFenceDiagnostics(fences, output), (diagnostic) => [
              diagnostic.path,
              diagnostic.line,
              diagnostic.column,
              diagnostic.code,
            ])
          ).toEqual([
            ["docs/a.md", 4, 1, "TS2304"],
            ["docs/b.md", 12, 5, "TS2322"],
            ["docs/b.md", 12, 1, "TS1005"],
          ]);
          expect(pipe(fences, mapFenceDiagnostics(""))).toEqual([]);
        })
    );

    it.effect("names staged files by language and renders failures as path:line:col", () =>
      Effect.sync(() => {
        const failedFence = checkedFence("docs/a.md", 3, "missing()\n");
        const diagnostic = MarkdownFenceDiagnostic.make({
          path: "docs/a.md",
          line: 4,
          column: 1,
          code: "TS2304",
          message: "Cannot find name 'missing'.",
        });

        expect([stagedFenceFileName(0, "ts"), pipe(3, stagedFenceFileName("tsx"))]).toEqual([
          "fence-0.ts",
          "fence-3.tsx",
        ]);
        expect(
          formatMarkdownFenceFailure(
            MarkdownFenceVerdict.cases.failed.make({ fence: failedFence, diagnostics: [diagnostic] })
          )
        ).toEqual(["docs/a.md:4:1  TS2304 Cannot find name 'missing'."]);
      })
    );
  });

  it.layer(TypecheckerLayer, { timeout: "120 seconds" })((it) => {
    describe("live typechecker", () => {
      it.effect(
        "fails with a typed compiler error, never an empty verdict, when the compiler crashes or prints unattributed errors",
        Effect.fnUntraced(function* () {
          const repoRoot = yield* findRepoRoot();
          const fences = [checkedFence("docs/a.md", 1, "export const a = 1\n")];
          const typecheckWith = (output: string, exitCode: number) =>
            Effect.gen(function* () {
              const typechecker = yield* MarkdownFenceTypechecker;
              return yield* typechecker.typecheck(repoRoot, fences);
            }).pipe(
              Effect.provideServiceEffect(MarkdownFenceTypechecker, MarkdownFenceTypechecker.make),
              withStubCompiler(output, exitCode)
            );
          const compilerFailure = (output: string, exitCode: number) =>
            typecheckWith(output, exitCode).pipe(
              Effect.catchTag("MarkdownFencesExecutionError", Effect.die),
              Effect.flip
            );
          const panic = A.join(
            A.map(A.range(1, 25), (index) => `frame ${index}`),
            "\n"
          );

          const silent = yield* compilerFailure("", 134);
          const panicked = yield* compilerFailure(`thread 'main' panicked\n${panic}\n`, 101);
          const unattributed = yield* compilerFailure("error TS5083: Cannot read file 'gone.json'.\n", 0);
          const failedFence = yield* typecheckWith("fence-0.ts(1,1): error TS2304: Cannot find name 'x'.\n", 2);

          expect([silent._tag, silent.reason, silent.exitCode, silent.outputTail]).toEqual([
            "MarkdownFencesCompilerError",
            "exit-without-diagnostics",
            134,
            "",
          ]);
          expect(silent.message).toContain("exited 134 without a fence diagnostic");
          expect([panicked.reason, panicked.exitCode]).toEqual(["exit-without-diagnostics", 101]);
          expect(A.length(Str.split("\n")(panicked.outputTail))).toBe(20);
          expect(panicked.message).toContain("frame 25");
          expect(panicked.message).not.toContain("panicked");
          expect([unattributed.reason, unattributed.exitCode]).toEqual(["unattributed-diagnostics", 0]);
          expect(A.map(failedFence, (diagnostic) => `${diagnostic.path}:${diagnostic.line}`)).toEqual(["docs/a.md:2"]);
        })
      );

      it.effect(
        "retains unattributed errors before more than 20 mapped fence diagnostics with a bounded sample and total",
        Effect.fnUntraced(function* () {
          const repoRoot = yield* findRepoRoot();
          const fences = [checkedFence("docs/a.md", 1, "export const a = 1\n")];
          const mapped = A.map(
            A.range(1, 25),
            (index) => `fence-0.ts(1,1): error TS2304: Cannot find name 'missing${index}'.`
          );
          for (const total of [1, 25]) {
            const outside = A.map(
              A.range(1, total),
              (index) =>
                `packages/source.ts(${index},1): error TS2322: Type 'string' is not assignable to type 'number'.`
            );
            const error = yield* Effect.gen(function* () {
              const typechecker = yield* MarkdownFenceTypechecker;
              return yield* typechecker.typecheck(repoRoot, fences);
            }).pipe(
              Effect.provideServiceEffect(MarkdownFenceTypechecker, MarkdownFenceTypechecker.make),
              withStubCompiler(markdownOf(...outside, ...mapped), 2),
              Effect.catchTag("MarkdownFencesExecutionError", Effect.die),
              Effect.flip
            );

            expect(error.reason).toBe("unattributed-diagnostics");
            expect(error.unattributedDiagnostics).toEqual(A.take(outside, 20));
            expect(error.unattributedDiagnosticCount).toBe(total);
            expect(error.message).toContain(outside[0]);
            expect(error.message).toContain(`${total} unattributed error TS lines`);
            expect(error.outputTail).not.toContain("packages/source.ts");
            expect(A.length(Str.split("\n")(error.outputTail))).toBe(20);
          }
        })
      );

      it.effect(
        "passes a compiling fence and fails a broken one with its Markdown path and line",
        Effect.fnUntraced(function* () {
          const repoRoot = yield* findRepoRoot();
          const typechecker = yield* MarkdownFenceTypechecker;
          const passing = checkedFence(
            "docs/pass.md",
            5,
            'import * as Effect from "effect/Effect"\nexport const program = Effect.succeed(1)\n'
          );
          const view = checkedFence("docs/view.md", 1, "export const view = <div>ok</div>\n", "tsx");
          const broken = checkedFence("docs/broken.md", 20, 'const ok = 1\nconst value: number = "text"\n');

          const diagnostics = yield* typechecker.typecheck(repoRoot, [passing, view, broken]);

          expect(
            A.map(diagnostics, (diagnostic) => `${diagnostic.path}:${diagnostic.line}:${diagnostic.code}`)
          ).toEqual(["docs/broken.md:22:TS2322"]);
        })
      );

      it.effect(
        "returns no diagnostics for no fences and fails typed when the compiler is missing or misconfigured",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const typechecker = yield* MarkdownFenceTypechecker;
          const noCompiler = yield* fs.makeTempDirectoryScoped({ prefix: "markdown-fences-no-compiler-" });
          const misconfigured = yield* fs.makeTempDirectoryScoped({ prefix: "markdown-fences-misconfigured-" });
          yield* fs.makeDirectory(path.join(misconfigured, "node_modules", ".bin"), { recursive: true });
          yield* fs.symlink(
            path.join(repoRoot, "node_modules", ".bin", "tsrs"),
            path.join(misconfigured, "node_modules", ".bin", "tsrs")
          );
          yield* fs.writeFileString(
            path.join(misconfigured, "tsconfig.json"),
            '{ "compilerOptions": { "notARealCompilerOption": true } }\n'
          );
          const fences = [checkedFence("docs/a.md", 1, "export const a = 1\n")];

          const none = yield* typechecker.typecheck(noCompiler, []);
          const missing = yield* typechecker.typecheck(noCompiler, fences).pipe(Effect.exit);
          const unattributed = yield* typechecker.typecheck(misconfigured, fences).pipe(Effect.exit);

          expect(none).toEqual([]);
          expect(failureText(missing)).toContain("Failed to run");
          expect(failureText(unattributed)).toContain("with diagnostics outside the staged fences");
        })
      );
    });
  });
});
