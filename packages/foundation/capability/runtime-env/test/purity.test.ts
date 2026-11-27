import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";
import { SOURCES } from "./support/sources.ts";

const withoutComments = (source: string): string => Str.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")(source);

const withoutStringLiterals = (body: string): string => Str.replace(/"(?:[^"\\\n]|\\.)*"/g, '""')(body);

const specifiers = (source: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)(source)), (match) =>
    A.fromNullishOr(match[1])
  );

const FORBIDDEN_IMPORT = /^(?:node:|@effect\/platform|@effected\/)/;

const violations = (source: string): ReadonlyArray<string> => {
  const body = withoutComments(source);
  const reads = withoutStringLiterals(body);
  return [
    ...(/\bprocess\b/.test(reads) ? ["process"] : []),
    ...(/\bconsole\s*\./.test(reads) ? ["console"] : []),
    ...(/\bstdout\s*\.\s*write\b/.test(reads) ? ["stdout-write"] : []),
    ...A.map(
      A.filter(specifiers(body), (specifier) => FORBIDDEN_IMPORT.test(specifier)),
      (specifier) => `import ${specifier}`
    ),
  ];
};

describe("env purity", () => {
  it.effect("the checker flags and spares what its controls say (positive control)", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(violations('import * as os from "node:os";\nconst a = process.env.CI;\nconsole.log(a);'), [
        "process",
        "console",
        "import node:os",
      ]);
      assert.deepStrictEqual(violations('import { NodeServices } from "@effect/platform-node";'), [
        "import @effect/platform-node",
      ]);
      assert.deepStrictEqual(
        violations("// process.env is read by the host, never here\nconst a = 1;"),
        [],
        "comment prose about process.env is not a read"
      );
      assert.deepStrictEqual(violations('import * as Effect from "effect/Effect";'), []);
      assert.deepStrictEqual(
        violations('const description = "a snapshot of the relevant process state";'),
        [],
        "a string literal that mentions a process is not a read"
      );
    })
  );

  it.effect(
    "no source file reads process, imports a node:, platform or kit module, or writes to stdout or the console",
    () =>
      Effect.sync(() => {
        const files = SOURCES.pipe(HashMap.keys, A.fromIterable, A.sort(Str.Order));
        assert.include(files, "RuntimeEnv.ts", "the scan read the real tree");
        assert.include(files, "internal/colorDepth.ts", "the scan recurses into internal/");
        assert.isAbove(files.length, 8);
        const found = SOURCES.pipe(
          HashMap.toEntries,
          A.flatMap(([file, source]) => A.map(violations(source), (violation) => `${file}: ${violation}`))
        );
        assert.deepStrictEqual(found, []);
      })
  );
});
