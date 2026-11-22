import {
  CodeDecisionProblemKind,
  decisionPointers,
  formatCodeDecisionProblem,
  parseCodeDecision,
  runCodeDecisionCheck,
  runCodeDecisionFor,
  testCallTitles,
  topLevelDeclarationNames,
} from "@beep/repo-cli/commands/Decisions";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import { NodeTestLayer } from "./support/CommandTest.ts";

const SOURCE = A.join(
  [
    "const hidden = 1;",
    "export function shown(): number {",
    "  return hidden;",
    "}",
    "// decision: raw-ddl",
    "export const x = shown();",
    "",
  ],
  "\n"
);

const TEST_SOURCE = A.join(
  [
    'import { describe, it } from "vitest";',
    'const decoy = "not a title";',
    'describe("guard", () => {',
    '  it.effect("refuses dashes", () => decoy);',
    "});",
    "",
  ],
  "\n"
);

const decisionFile = (frontmatter: ReadonlyArray<string>, body = "Raw DDL stays.\n\nRejected: drizzle-kit."): string =>
  A.join(["---", ...frontmatter, "---", "", body, ""], "\n");

const VALID_FRONTMATTER = [
  "title: Raw DDL for the disposable bundle",
  "date: 2026-11-21",
  "reversal: Generate the bundle DDL with drizzle-kit.",
  "governs:",
  "  - src/a.ts#hidden",
  "  - src/a.ts#shown",
  "enforcedBy:",
  "  - test/a.test.ts#refuses dashes",
  "  - lint:beep/no-comments",
];

const BASE_FILES: Readonly<Record<string, string>> = {
  "bun.lock": "",
  "package.json": "{}\n",
  "packages/demo/package.json": '{ "name": "@beep/demo" }\n',
  "packages/demo/src/a.ts": SOURCE,
  "packages/demo/test/a.test.ts": TEST_SOURCE,
  "packages/demo/decisions/2026-11-21-raw-ddl.md": decisionFile(VALID_FRONTMATTER),
};

const runGit = Effect.fn("DecisionsTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const makeCheckout = Effect.fn("DecisionsTest.makeCheckout")(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "decisions-check-" });
  yield* Effect.forEach(
    R.toEntries(files),
    Effect.fnUntraced(function* ([file, text]) {
      yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
      yield* fs.writeFileString(path.join(root, file), text);
    }),
    { concurrency: 1, discard: true }
  );
  yield* runGit(root, ["init", "--quiet"]);
  yield* runGit(root, ["add", "."]);
  return root;
});

const kinds = (problems: ReadonlyArray<{ readonly kind: string }>): ReadonlyArray<string> =>
  A.map(problems, (entry) => entry.kind);

it.layer(NodeTestLayer, { timeout: "60 seconds" })((it) => {
  describe("beep decisions", () => {
    it.effect("reads top-level declarations, test call titles and pointer comments from the AST", () =>
      Effect.sync(() => {
        const names = topLevelDeclarationNames(
          "a.ts",
          "const a = 1\nfunction b() { const nested = 2 }\nclass C {}\ninterface D {}\ntype E = 1\nenum F {}\n"
        );
        expect(A.sort(A.fromIterable(names), (left: string, right: string) => (left < right ? -1 : 1))).toEqual([
          "C",
          "D",
          "E",
          "F",
          "a",
          "b",
        ]);
        const titles = testCallTitles("a.test.ts", TEST_SOURCE);
        assertTrue(HashSet.has(titles, "guard"));
        assertTrue(HashSet.has(titles, "refuses dashes"));
        expect(HashSet.has(titles, "not a title")).toBe(false);
        const pointers = decisionPointers(
          "src/b.ts",
          A.join(
            [
              "// decision: kept-one",
              'const s = "// decision: in-string";',
              "const t = 1; // decision: trailing",
              "  // decision: Not A Slug",
              "export const u = { // decision: after-brace",
              "  // decision: inside-object",
              "};",
              "",
            ],
            "\n"
          )
        );
        expect(A.map(pointers, (pointer) => [pointer.line, pointer.slug])).toEqual([
          [1, "kept-one"],
          [6, "inside-object"],
        ]);
      })
    );

    it.effect(
      "passes a valid decision whose anchors, enforcers and pointer resolve",
      Effect.fnUntraced(function* () {
        const root = yield* makeCheckout(BASE_FILES);
        const report = yield* runCodeDecisionCheck(root);
        expect(A.map(report.problems, formatCodeDecisionProblem)).toEqual([]);
        expect(report.decisions).toBe(1);
        expect(report.unenforced).toBe(0);
        expect(report.pointers).toBe(1);
      })
    );

    it.effect(
      "rejects an unresolved governs anchor and an enforcer that is a string literal but not a call title",
      Effect.fnUntraced(function* () {
        const root = yield* makeCheckout({
          ...BASE_FILES,
          "packages/demo/decisions/2026-11-21-raw-ddl.md": decisionFile([
            "title: Raw DDL for the disposable bundle",
            "date: 2026-11-21",
            "reversal: Generate the bundle DDL with drizzle-kit.",
            "governs: [src/a.ts#missing, src/gone.ts#hidden]",
            "enforcedBy: [test/a.test.ts#not a title]",
          ]),
        });
        const report = yield* runCodeDecisionCheck(root);
        expect(kinds(report.problems)).toEqual([
          CodeDecisionProblemKind.Enum["unresolved-anchor"],
          CodeDecisionProblemKind.Enum["unresolved-anchor"],
          CodeDecisionProblemKind.Enum["unresolved-enforcer"],
        ]);
        expect(report.problems[0]?.message).toContain('has no a top-level declaration named "missing"');
        expect(report.problems[1]?.message).toContain("packages/demo/src/gone.ts is not a tracked file");
      })
    );

    it.effect(
      "rejects an excess frontmatter key, an over-long body and a fenced body",
      Effect.fnUntraced(function* () {
        const file = "packages/demo/decisions/2026-11-21-raw-ddl.md";
        const excess = yield* parseCodeDecision(file, "packages/demo", decisionFile([...VALID_FRONTMATTER, "pr: 1"]));
        const long = yield* parseCodeDecision(
          file,
          "packages/demo",
          decisionFile(
            VALID_FRONTMATTER,
            A.join(
              A.makeBy(13, (index) => `Line ${index}.`),
              "\n"
            )
          )
        );
        const fenced = yield* parseCodeDecision(
          file,
          "packages/demo",
          decisionFile(VALID_FRONTMATTER, "Raw DDL.\n```ts\nconst x = 1\n```")
        );
        const ok = yield* parseCodeDecision(file, "packages/demo", decisionFile(VALID_FRONTMATTER));
        expect(Result.isFailure(excess) ? excess.failure.message : "").toContain(
          "outside CodeDecisionFrontmatter: pr "
        );
        expect(Result.isFailure(long) ? long.failure.message : "").toContain("at most 12 lines");
        expect(Result.isFailure(fenced) ? fenced.failure.message : "").toContain("without code fences");
        ok.pipe(Result.isSuccess, assertTrue);

        const root = yield* makeCheckout({
          ...BASE_FILES,
          [file]: decisionFile([...VALID_FRONTMATTER, "pr: 1"]),
        });
        const report = yield* runCodeDecisionCheck(root);
        expect(kinds(report.problems)).toEqual([CodeDecisionProblemKind.Enum["invalid-file"]]);
        expect(report.decisions).toBe(0);
      })
    );

    it.effect(
      "rejects a pointer whose slug names no decision file in the owning package",
      Effect.fnUntraced(function* () {
        const root = yield* makeCheckout({
          ...BASE_FILES,
          "packages/other/package.json": '{ "name": "@beep/other" }\n',
          "packages/other/src/b.ts": "// decision: raw-ddl\nexport const y = 1;\n",
          "packages/demo/src/c.ts": "export const z = 1;\n\n// decision: no-such-file\nexport const w = z;\n",
        });
        const report = yield* runCodeDecisionCheck(root);
        expect(A.map(report.problems, formatCodeDecisionProblem)).toEqual([
          "packages/demo/src/c.ts:3  unresolved-pointer: decision: no-such-file names no tracked packages/demo/decisions/<YYYY-MM-DD>-no-such-file.md.",
          "packages/other/src/b.ts:1  unresolved-pointer: decision: raw-ddl names no tracked packages/other/decisions/<YYYY-MM-DD>-raw-ddl.md.",
        ]);
        expect(report.pointers).toBe(3);
      })
    );

    it.effect(
      "counts decisions with an empty enforcedBy and rejects a decisions directory outside a package root",
      Effect.fnUntraced(function* () {
        const root = yield* makeCheckout({
          ...BASE_FILES,
          "packages/demo/decisions/2026-11-22-prose-only.md": decisionFile([
            "title: Prose only",
            "date: 2026-11-22",
            "reversal: Delete the file.",
            "governs: [src/a.ts#x]",
            "enforcedBy: []",
          ]),
          "packages/demo/src/decisions/2026-11-22-nested.md": decisionFile(VALID_FRONTMATTER),
        });
        const report = yield* runCodeDecisionCheck(root);
        expect(kinds(report.problems)).toEqual([CodeDecisionProblemKind.Enum["misplaced-file"]]);
        expect(report.decisions).toBe(2);
        expect(report.unenforced).toBe(1);
      })
    );

    it.effect(
      "lists the decisions governing a file or a declaration",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const root = yield* makeCheckout(BASE_FILES);
        const byFile = yield* runCodeDecisionFor(root, ["packages/demo/src/a.ts"]);
        const byDeclaration = yield* runCodeDecisionFor(path.join(root, "packages/demo"), ["src/a.ts#shown"]);
        const unrelated = yield* runCodeDecisionFor(root, ["packages/demo/src/a.ts#x", "packages/demo/test/a.test.ts"]);
        expect(A.map(byFile, (match) => `${match.title}  ${match.file}`)).toEqual([
          "Raw DDL for the disposable bundle  packages/demo/decisions/2026-11-21-raw-ddl.md",
        ]);
        expect(A.map(byDeclaration, (match) => match.anchors)).toEqual([["src/a.ts#shown"]]);
        expect(unrelated).toEqual([]);
      })
    );
  });
});
