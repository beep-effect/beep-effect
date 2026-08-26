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
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Sink, Stream } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const encoder = new TextEncoder();

const changedFilesHandle = (output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

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
    expect(classifyDoctestFence('import type { A } from "effect"\ntype B = A', "ts")._tag).toBe("typeOnly");
    expect(classifyDoctestFence('import * as S from "effect/Schema"\nconst X = S.String', "ts")._tag).toBe("pure");
  });

  it("classifies capability imports from module specifiers even when their bindings are aliased", () => {
    const verdict = classifyDoctestFence('import * as FS from "effect/FileSystem"\nFS.FileSystem', "ts");
    expect(verdict._tag).toBe("impure");
    if (verdict._tag === "impure") expect(verdict.reason).toBe("file-system");

    expect(classifyDoctestFence('export * from "effect/unstable/http/HttpClient"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "network",
    });
    expect(classifyDoctestFence('import "effect/unstable/socket"', "ts")).toMatchObject({
      _tag: "impure",
      reason: "network",
    });
    expect(classifyDoctestFence('import "effect/unstable/process"', "ts")).toMatchObject({
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

  it("chooses a safe upstream name delimiter and rejects both delimiters", () => {
    expect(O.getOrUndefined(quotedDoctestName("Decode none"))).toBe('name="Decode none"');
    expect(O.getOrUndefined(quotedDoctestName('Decode "none"'))).toBe("name='Decode \"none\"'");
    expect(O.isNone(quotedDoctestName("Decode \"none\" and 'some'"))).toBe(true);
  });
});

describe("doctest rewrite planning", () => {
  it("plans literal-like console rewrites and normalizes Option aliases", () => {
    const code = [
      'import * as O from "effect/Option"',
      'console.log("ok") // "ok"',
      "console.log({ ok: true }) // { ok: true }",
      'console.log(O.some("x")) // Option.some("x")',
      'console.log("skip") // displayed prose',
    ].join("\n");
    const plans = planConsoleRewrites(code, 10);
    expect(plans).toHaveLength(3);
    expect(plans[0]).toMatchObject({ line: 11, expression: '"ok"', expectedExpression: '"ok"' });
    expect(plans[1]?.expression).toBe("({ ok: true })");
    expect(plans[2]?.expectedExpression).toBe('O.some("x")');
  });

  it("uses the real upstream transform as the assertion oracle", () => {
    expect(O.isNone(validateDoctestAssertions("1 + 1 // => 2", "fixture.ts", 1))).toBe(true);
    expect(O.isSome(validateDoctestAssertions("// => 2", "fixture.ts", 1))).toBe(true);
    expect(O.isSome(validateDoctestAssertions("let value = 1 // => 1", "fixture.ts", 1))).toBe(true);
    expect(O.isNone(validateDoctestAssertions("if (true) {\n  1 // => 1\n}", "fixture.ts", 1))).toBe(true);
  });

  it("plans canonical metadata and rewrites without mutating the analyzed source", () => {
    const source = [
      "/**",
      " * **Example** (Literal result)",
      " *",
      " * ```ts",
      " * console.log(1 + 1) // 2",
      " * ```",
      " */",
      "export const value = 2",
    ].join("\n");
    const analysis = analyzeDoctestSourceForTesting("packages/example/src/index.ts", source);
    expect(analysis.fences).toBe(1);
    expect(analysis.findings[0]?.kind).toBe("pure-unmarked");
    const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));
    expect(plan.expectedInfoString).toBe('ts import.meta.vitest name="Literal result"');

    const rewritten = Effect.runSync(rewriteDoctestSourceForTesting("packages/example/src/index.ts", source, [plan]));
    expect(rewritten).toContain('```ts import.meta.vitest name="Literal result"');
    expect(rewritten).toContain("1 + 1 // => 2");
    expect(source).toContain("console.log(1 + 1) // 2");

    const second = analyzeDoctestSourceForTesting("packages/example/src/index.ts", rewritten);
    expect(second.findings).toEqual([]);
  });

  it("retains console-only plans for canonical fences and honors leading blank lines", () => {
    const source = [
      "/**",
      " * **Example** (Canonical observation)",
      " *",
      ' * ```ts import.meta.vitest name="Canonical observation"',
      " *",
      " * console.log(1 + 1) // 2",
      " * ```",
      " */",
      "export const value = 2",
    ].join("\n");
    const analysis = analyzeDoctestSourceForTesting("packages/example/src/index.ts", source);

    expect(analysis.findings).toHaveLength(1);
    expect(analysis.findings[0]?.kind).toBe("console-rewrite");
    const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));
    expect(plan).toMatchObject({ addMarker: false, consoleRewrites: [{ line: 6 }] });
    expect(plan).not.toHaveProperty("addName");

    const rewritten = Effect.runSync(rewriteDoctestSourceForTesting("packages/example/src/index.ts", source, [plan]));
    expect(Str.split(rewritten, "\n")[5]).toBe(" * 1 + 1 // => 2");
    expect(analyzeDoctestSourceForTesting("packages/example/src/index.ts", rewritten).findings).toEqual([]);
  });

  it("refuses a stale rewrite plan before producing content", () => {
    const source = ["/**", " * **Example** (Stale plan)", " *", " * ```ts", " * 1 + 1", " * ```", " */"].join("\n");
    const analysis = analyzeDoctestSourceForTesting("packages/example/src/index.ts", source);
    expect(analysis.fences).toBe(1);
    const plan = O.getOrThrow(O.fromUndefinedOr(analysis.findings[0]?.plan));
    const result = Effect.runSyncExit(
      rewriteDoctestSourceForTesting("packages/example/src/index.ts", `${source}\nconst changed = true`, [plan])
    );
    expect(result._tag).toBe("Failure");
  });
});

const changedSourcePaths = ["packages/example/src/existing.ts", "packages/example/src/deleted.ts"];
const changedSourceLayer = Layer.mergeAll(
  FileSystem.layerNoop({
    exists: (file) => Effect.succeed(Str.endsWith("packages/example/src/existing.ts")(file)),
  }),
  Path.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("expected a standard Git command");
      return Effect.succeed(changedFilesHandle(A.join(changedSourcePaths, "\n")));
    })
  )
);

layer(changedSourceLayer)("changed Doctest discovery", (it) => {
  it.effect("drops deleted Git paths before source analysis", () =>
    Effect.gen(function* () {
      expect(yield* discoverChangedDoctestFilesForTesting("/repo")).toEqual(["packages/example/src/existing.ts"]);
    })
  );
});
