import { Git, GitCommandError } from "@beep/git/Git";
import {
  analyzeDoctestSourceForTesting,
  classifyDoctestFence,
  discoverChangedDoctestFilesForTesting,
  ParseJSDocSectionsOptions,
  parseJSDocSections,
  planConsoleRewrites,
  quotedDoctestName,
  rewriteDoctestSourceForTesting,
  validateDoctestAssertions,
} from "@beep/repo-cli/test/Docgen";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";

const analyzeExample = (source: string) =>
  Effect.fromResult(analyzeDoctestSourceForTesting("packages/example/src/index.ts", source));

describe("doctest analyzer", () => {
  it.each([
    ["process-env", "process.env.HOME"],
    ["node-import", 'import "node:path"'],
    ["file-system", "FileSystem.FileSystem"],
    ["network", "fetch('https://example.com')"],
    ["child-process", "ChildProcess.make()"],
    ["bun-runtime", "Bun.file('x')"],
    ["database", "Sql.withTransaction"],
    ["external-package-import", 'import x from "react-grab"'],
    ["relative-import", 'const x = import("../x.ts")'],
    ["jsx-react", 'import React from "react"'],
  ] as const)("classifies %s impurity", (reason, code) => {
    const verdict = classifyDoctestFence(code, "ts");
    expect(verdict._tag).toBe("impure");
    if (verdict._tag === "impure") expect(verdict.reason).toBe(reason);
  });

  it("keeps Effect runners pure and separates type-only examples", () => {
    expect(classifyDoctestFence("Effect.runSync(Effect.succeed(1))", "ts")._tag).toBe("pure");
    expect(classifyDoctestFence('import type * as A from "effect/Array"\ntype B = A', "ts")._tag).toBe("typeOnly");
    expect(classifyDoctestFence('import * as S from "effect/Schema"\nconst X = S.String', "ts")._tag).toBe("pure");
  });

  it("classifies capability imports from module specifiers even when their bindings are aliased", () => {
    const verdict = classifyDoctestFence('import * as FS from "effect/FileSystem"\nFS.FileSystem', "ts");
    expect(verdict._tag).toBe("impure");
    if (verdict._tag === "impure") expect(verdict.reason).toBe("file-system");

    expect(classifyDoctestFence('export * from "effect/http/HttpClient"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "network",
    });
    expect(classifyDoctestFence('import "effect/socket"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "network",
    });
    expect(classifyDoctestFence('import "effect/process"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "child-process",
    });
    expect(classifyDoctestFence('const sql = import("@effect/sql-pg")', "ts")).toMatchObject({
      _tag: "impure",
      reason: "database",
    });
    expect(classifyDoctestFence('import "@effect/platform-node"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "node-import",
    });
    expect(classifyDoctestFence('import "bun"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "bun-runtime",
    });
  });

  it("keeps only recursively type-only namespaces runtime-vacuous", () => {
    expect(classifyDoctestFence("namespace Example { export type Value = string }", "ts")._tag).toBe("typeOnly");
    expect(classifyDoctestFence("namespace Example { export const value = 1 }", "ts")._tag).toBe("pure");
    expect(
      classifyDoctestFence("namespace Example { export namespace Nested { export const value = 1 } }", "ts")._tag
    ).toBe("pure");
    expect(classifyDoctestFence("declare namespace Example { const value: 1 }", "ts")._tag).toBe("typeOnly");
  });

  it("extracts titled Example sections without recognizing headings inside fences", () => {
    const parsed = parseJSDocSections(
      ParseJSDocSectionsOptions.make({
        commentText:
          "/** Lead.\n *\n * **Example** (Real title)\n *\n * ```ts\n * const text = `**Details**`\n * ```\n */",
      })
    );
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]?.title).toBe("Real title");
  });

  it("ignores section headings and tags inside a fence of any language", () => {
    const parsed = parseJSDocSections(
      ParseJSDocSectionsOptions.make({
        commentText:
          "/** Lead.\n *\n * **Details**\n *\n * ~~~md\n * **Example** (Quoted)\n * @since 0.0.0\n * ~~~\n *\n * @category models\n */",
      })
    );
    expect(A.map(parsed.sections, (section) => section.name)).toEqual(["Details"]);
  });

  it("masks fences with the line scanner when the Markdown parser refuses the comment", () => {
    const deep = Str.repeat(300)(">");
    const parsed = parseJSDocSections(
      ParseJSDocSectionsOptions.make({
        commentText: `/** Lead.\n *\n * **Details**\n *\n * ${deep} x\n *\n * ~~~md\n * **Example** (Quoted)\n * ~~~\n */`,
      })
    );
    expect(A.map(parsed.sections, (section) => section.name)).toEqual(["Details"]);
  });

  it("chooses a safe upstream name delimiter and rejects both delimiters", () => {
    expect(O.getOrUndefined(quotedDoctestName("Decode none"))).toBe('name="Decode none"');
    expect(O.getOrUndefined(quotedDoctestName('Decode "none"'))).toBe("name='Decode \"none\"'");
    quotedDoctestName("Decode \"none\" and 'some'").pipe(assertNone);
  });
});

describe("doctest rewrite planning", () => {
  it("plans literal-like console rewrites and normalizes Option aliases", () => {
    const code = A.join(
      [
        'import * as O from "effect/Option"',
        'console.log("ok") // "ok"',
        "console.log({ ok: true }) // { ok: true }",
        'console.log(O.some("x")) // Option.some("x")',
        'console.log("skip") // displayed prose',
      ],
      "\n"
    );
    const plans = planConsoleRewrites(code, 10);
    expect(plans).toHaveLength(3);
    expect(plans[0]).toMatchObject({ line: 11, expression: '"ok"', expectedExpression: '"ok"' });
    expect(plans[1]?.expression).toBe("({ ok: true })");
    expect(plans[2]?.expectedExpression).toBe('O.some("x")');
  });

  it("uses the real upstream transform as the assertion oracle", () => {
    validateDoctestAssertions("1 + 1 // => 2", "fixture.ts", 1).pipe(assertNone);
    validateDoctestAssertions("// => 2", "fixture.ts", 1).pipe(O.isSome, assertTrue);
    validateDoctestAssertions("let value = 1 // => 1", "fixture.ts", 1).pipe(O.isSome, assertTrue);
    validateDoctestAssertions("if (true) {\n  1 // => 1\n}", "fixture.ts", 1).pipe(assertNone);
  });

  it.effect("plans canonical metadata and rewrites without mutating the analyzed source", () =>
    Effect.gen(function* () {
      const source = A.join(
        [
          "/**",
          " * **Example** (Literal result)",
          " *",
          " * ```ts",
          " * console.log(1 + 1) // 2",
          " * ```",
          " */",
          "export const value = 2",
        ],
        "\n"
      );
      const analysis = yield* analyzeExample(source);
      expect(analysis.fences).toBe(1);
      expect(analysis.findings[0]?.kind).toBe("pure-unmarked");
      const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));
      expect(plan.expectedInfoString).toBe('ts import.meta.vitest name="Literal result"');

      const rewritten = yield* rewriteDoctestSourceForTesting("packages/example/src/index.ts", source, [plan]);
      expect(rewritten).toContain('```ts import.meta.vitest name="Literal result"');
      expect(rewritten).toContain("1 + 1 // => 2");
      expect(source).toContain("console.log(1 + 1) // 2");

      const second = yield* analyzeExample(rewritten);
      expect(second.findings).toEqual([]);
    })
  );

  it.effect("keeps a four-marker opener whole when it plans the marker rewrite", () =>
    Effect.gen(function* () {
      const fence = Str.repeat(4)("~");
      const inner = Str.repeat(3)("~");
      const source = A.join(
        [
          "/**",
          " * **Example** (Long fence)",
          " *",
          ` * ${fence}ts`,
          " * const text = `",
          ` * ${inner}`,
          " * `",
          " * console.log(text.length) // 5",
          ` * ${fence}`,
          " */",
          "export const value = 2",
        ],
        "\n"
      );
      const analysis = yield* analyzeExample(source);
      expect(analysis.fences).toBe(1);
      const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));

      const rewritten = yield* rewriteDoctestSourceForTesting("packages/example/src/index.ts", source, [plan]);
      expect(Str.split(rewritten, "\n")[3]).toBe(` * ${fence}${plan.expectedInfoString}`);
      expect((yield* analyzeExample(rewritten)).fences).toBe(1);
    })
  );

  it.effect("finds the fences of an indented member JSDoc and reports their source lines", () =>
    Effect.gen(function* () {
      const source = A.join(
        [
          "export class Box {",
          "  /**",
          "   * **Example** (Member example)",
          "   *",
          "   * ```ts",
          "   * console.log(1 + 1) // 2",
          "   * ```",
          "   */",
          "  static readonly value = 2",
          "}",
        ],
        "\n"
      );
      const analysis = yield* analyzeExample(source);
      expect(analysis.fences).toBe(1);
      expect(analysis.findings[0]?.location).toMatchObject({
        startLine: 5,
        endLine: 7,
        exampleTitle: "Member example",
      });
      expect(analysis.findings[0]?.plan?.consoleRewrites).toMatchObject([{ line: 6 }]);
    })
  );

  it.effect("retains console-only plans for canonical fences and honors leading blank lines", () =>
    Effect.gen(function* () {
      const source = A.join(
        [
          "/**",
          " * **Example** (Canonical observation)",
          " *",
          ' * ```ts import.meta.vitest name="Canonical observation"',
          " *",
          " * console.log(1 + 1) // 2",
          " * ```",
          " */",
          "export const value = 2",
        ],
        "\n"
      );
      const analysis = yield* analyzeExample(source);

      expect(analysis.findings).toHaveLength(1);
      expect(analysis.findings[0]?.kind).toBe("console-rewrite");
      const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));
      expect(plan).toMatchObject({ addMarker: false, consoleRewrites: [{ line: 6 }] });
      expect(plan).not.toHaveProperty("addName");

      const rewritten = yield* rewriteDoctestSourceForTesting("packages/example/src/index.ts", source, [plan]);
      expect(Str.split(rewritten, "\n")[5]).toBe(" * 1 + 1 // => 2");
      expect((yield* analyzeExample(rewritten)).findings).toEqual([]);
    })
  );

  it.effect("fails a comment the Markdown parser refuses instead of passing its marked fence", () =>
    Effect.gen(function* () {
      const comment = (lead: string) =>
        A.join(
          [
            "/**",
            ` * ${lead}`,
            " *",
            " * **Example** (Marked)",
            " *",
            ' * ```ts import.meta.vitest name="Marked"',
            " * process.env.HOME",
            " * ```",
            " */",
            "export const value = 2",
          ],
          "\n"
        );
      const readable = yield* analyzeExample(comment("Lead."));
      expect(A.map(readable.findings, (finding) => finding.kind)).toEqual(["marked-impure"]);

      const error = yield* Effect.flip(analyzeExample(comment(`${Str.repeat(300)(">")} deep`)));
      expect(error).toMatchObject({ _tag: "DoctestAnalysisError", file: "packages/example/src/index.ts", line: 1 });
      expect(error.message).toContain("NestingDepthExceeded");
    })
  );

  it.effect("refuses a stale rewrite plan before producing content", () =>
    Effect.gen(function* () {
      const source = A.join(
        ["/**", " * **Example** (Stale plan)", " *", " * ```ts", " * 1 + 1", " * ```", " */"],
        "\n"
      );
      const analysis = yield* analyzeExample(source);
      expect(analysis.fences).toBe(1);
      const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));
      const result = yield* Effect.exit(
        rewriteDoctestSourceForTesting("packages/example/src/index.ts", `${source}\nconst changed = true`, [plan])
      );
      expect(result._tag).toBe("Failure");
    })
  );
});

const changedSourcePaths = ["packages/example/src/existing.ts", "packages/example/src/deleted.ts"];
const changedSourceLayer = Layer.mergeAll(
  BunCrypto.layer,
  FileSystem.layerNoop({
    exists: (file) => Effect.succeed(Str.endsWith("packages/example/src/existing.ts")(file)),
  }),
  Path.layer,
  // The committed, dirty and untracked reads each list both paths; the deleted one must not survive.
  Git.layerTest({
    changedFiles: () => Effect.succeed(changedSourcePaths),
    unstagedChanges: () => Effect.succeed(changedSourcePaths),
    untrackedFiles: () => Effect.succeed([]),
  })
);

// The discovery reads fold kit failures into the analysis error's two wordings (W7b, SPEC D-19).
const failingDiscovery = (error: GitCommandError) =>
  discoverChangedDoctestFilesForTesting("/repo").pipe(
    Effect.provideService(Git, Git.makeTest({ changedFiles: () => Effect.fail(error) })),
    Effect.flip
  );

layer(changedSourceLayer, { timeout: "30 seconds" })("changed Doctest discovery", (it) => {
  it.effect("drops deleted Git paths before source analysis", () =>
    Effect.gen(function* () {
      expect(yield* discoverChangedDoctestFilesForTesting("/repo")).toEqual(["packages/example/src/existing.ts"]);
    })
  );

  it.effect("names git's exit code, or the command a git that never ran", () =>
    Effect.gen(function* () {
      const exited = yield* failingDiscovery(
        GitCommandError.make({ kind: "failed", args: ["diff"], cwd: "/repo", exitCode: 128, stderr: "fatal" })
      );
      expect(exited.message).toContain("failed with exit code 128.");
      const unspawned = yield* failingDiscovery(
        GitCommandError.make({ kind: "failed", args: ["diff"], cwd: "/repo", stderr: "", detail: "spawn ENOENT" })
      );
      expect(unspawned.message).toContain("Failed to spawn git diff");
    })
  );
});
