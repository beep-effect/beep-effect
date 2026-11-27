import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

const SOURCES_INLINED_BY_VITE = import.meta.glob<string>("../src/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const SOURCE: Readonly<Record<string, string>> = R.fromEntries(
  A.map(R.toEntries(SOURCES_INLINED_BY_VITE), ([key, text]) => [Str.slice("../src/".length)(key), text] as const)
);

type Read = (module: string) => O.Option<string>;

const sourceOf = (module: string): string =>
  O.getOrThrowWith(R.get(SOURCE, module), () => new Error(`no source for ${module}`));
const readSource: Read = (module) => R.get(SOURCE, module);

const withCommentsBlanked = (text: string): string =>
  pipe(text, Str.replace(/\/\*[\s\S]*?\*\//g, " "), Str.replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1"));

const SPECIFIER =
  /\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g;

const specifiersOf = (text: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(SPECIFIER)(withCommentsBlanked(text))), (match) =>
    O.toArray(O.firstSomeOf([O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2]), O.fromUndefinedOr(match[3])]))
  );

const resolveFrom = (module: string, specifier: string): string =>
  A.join(
    A.reduce(Str.split(specifier, "/"), A.dropRight(Str.split(module, "/"), 1), (path, part) =>
      part === ".." ? A.dropRight(path, 1) : part === "." ? path : A.append(path, part)
    ),
    "/"
  );

const closure = (entry: string, read: Read = readSource) => {
  const modules = MutableHashSet.empty<string>();
  const bare = MutableHashSet.empty<string>();
  let frontier: ReadonlyArray<string> = [entry];
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    frontier = A.flatMap(frontier, (module) => {
      if (MutableHashSet.has(modules, module)) return [];
      MutableHashSet.add(modules, module);
      const specifiers = specifiersOf(O.getOrThrowWith(read(module), () => new Error(`no source for ${module}`)));
      const isRelative = Str.startsWith(".");
      A.forEach(
        A.filter(specifiers, (specifier) => !isRelative(specifier)),
        (specifier) => MutableHashSet.add(bare, specifier)
      );
      return A.map(A.filter(specifiers, isRelative), (specifier) => resolveFrom(module, specifier));
    });
  }
  return { modules: A.sort(A.fromIterable(modules), Str.Order), bare: A.sort(A.fromIterable(bare), Str.Order) };
};

const isForbidden = (specifier: string): boolean =>
  /^(?:ink|react)(?:$|\/)|^@beep\/cli-kit\/ui(?:$|\/)|^@beep\/scratchpad(?:$|\/)|^@effect\/platform|^node:/.test(
    specifier
  );

const TEST_DOUBLE_MODULES: ReadonlyArray<string> = ["CliTest.ts", "TestTerminal.ts", "testing.ts"];

const offences = (entries: ReadonlyArray<string>, read: Read = readSource): ReadonlyArray<string> =>
  A.sort(
    A.flatMap(entries, (entry) => {
      const reached = closure(entry, read);
      return [
        ...A.map(A.filter(reached.bare, isForbidden), (specifier) => `${entry} reaches ${specifier}`),
        ...A.map(
          A.filter(
            reached.bare,
            (specifier) => specifier === "@beep/cli-kit" || Str.startsWith("@beep/cli-kit/")(specifier)
          ),
          (specifier) => `${entry} imports its own package as ${specifier}`
        ),
      ];
    }),
    Str.Order
  );

describe("cli-kit import boundary, read from its own source text with no file system", () => {
  it("the walker reads the real tree, or it proves nothing", () => {
    assert.isAbove(R.size(SOURCE), 50, "the glob found the sources");
    const main = closure("index.ts").modules;
    assert.include(main, "CliRuntime.ts");
    assert.include(main, "internal/renderMarkdown.ts", "a nested relative edge is followed");
    assert.includeMembers(closure("testing.ts").modules, ["CliTest.ts", "TestTerminal.ts"]);
  });

  it("nothing reachable from `.` is a test double; `./testing` reaches them", () => {
    assert.deepStrictEqual(
      A.filter(closure("index.ts").modules, (module) => A.contains(TEST_DOUBLE_MODULES, module)),
      [],
      "test utilities belong behind ./testing"
    );
  });

  it("the root and ./testing name no Ink, React, lab ./ui, platform or node: module, and never their own package", () => {
    assert.deepStrictEqual(offences(["index.ts", "testing.ts"]), []);
    assert.deepStrictEqual(
      A.filter(R.keys(SOURCE), (module) => A.some(specifiersOf(sourceOf(module)), isForbidden)),
      [],
      "no source file at all, reachable or not, names one"
    );
  });

  it("only CliLogger.ts names console, where it is a local bound to the Console service; nothing reads process", () => {
    const naming = (pattern: RegExp) =>
      A.filter(R.keys(SOURCE), (module) => pattern.test(withCommentsBlanked(sourceOf(module))));
    assert.deepStrictEqual(naming(/\bconsole\b/), ["CliLogger.ts"]);
    assert.deepStrictEqual(naming(/\bprocess\s*\./), []);
  });

  it("mutation control: a type-only, lazy or nested edge into a forbidden module is flagged", () => {
    const tree =
      (files: Readonly<Record<string, string>>): Read =>
      (module) =>
        R.get(files, module);
    const base = {
      "index.ts": 'export * from "./Cli.ts";\nexport * from "./commands/run.ts";\n',
      "commands/run.ts": 'import { helper } from "../uiHelpers.ts";\nexport const run = helper;\n',
      "uiHelpers.ts": '/** import { Box } from "ink" */\nexport const helper = 1;\n',
    };
    assert.deepStrictEqual(
      offences(["index.ts"], tree({ ...base, "Cli.ts": "export const cli = 1;\n" })),
      [],
      "a clean tree, a module that merely starts with ui and a JSDoc import are not flagged"
    );
    assert.deepStrictEqual(offences(["index.ts"], tree({ ...base, "Cli.ts": 'import type { Box } from "ink";\n' })), [
      "index.ts reaches ink",
    ]);
    assert.deepStrictEqual(
      offences(["index.ts"], tree({ ...base, "Cli.ts": 'export const lazy = () => import("@beep/cli-kit/ui");\n' })),
      ["index.ts imports its own package as @beep/cli-kit/ui", "index.ts reaches @beep/cli-kit/ui"]
    );
    assert.deepStrictEqual(
      offences(
        ["index.ts"],
        tree({
          ...base,
          "Cli.ts": "export const cli = 1;\n",
          "uiHelpers.ts": 'import "react/jsx-runtime";\nexport const helper = 1;\n',
        })
      ),
      ["index.ts reaches react/jsx-runtime"],
      "a side-effect import two relative hops away"
    );
  });

  it.effect("the main entry exports the whole presentation layer, and only testing exports the test doubles", () =>
    Effect.gen(function* () {
      const main = yield* Effect.promise(() => import("@beep/cli-kit"));
      const testing = yield* Effect.promise(() => import("@beep/cli-kit/testing"));
      assert.deepStrictEqual(A.sort(R.keys(main), Str.Order), [
        "Cancelled",
        "CliAudience",
        "CliColor",
        "CliDoc",
        "CliEnv",
        "CliExit",
        "CliFailure",
        "CliInteractive",
        "CliLinks",
        "CliLog",
        "CliLogger",
        "CliMessage",
        "CliPrompt",
        "CliRuntime",
        "CliTheme",
        "ConfigIssueRenderer",
        "Doc",
        "Fmt",
        "GithubAnnotation",
        "Glyphs",
        "NotInteractive",
        "Render",
        "SchemaIssueRenderer",
        "Status",
        "Token",
      ]);
      assert.deepStrictEqual(A.sort(R.keys(testing), Str.Order), ["CliTest", "TestTerminal"]);
    })
  );
});
