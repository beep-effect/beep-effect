import {
  analyzeDoctestSourceForTesting,
  classifyDoctestFence,
  ParseJSDocSectionsOptions,
  parseJSDocSections,
  planConsoleRewrites,
  quotedDoctestName,
  rewriteDoctestSourceForTesting,
  validateDoctestAssertions,
} from "@beep/repo-cli/test/Docgen";
import { Effect } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";

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
