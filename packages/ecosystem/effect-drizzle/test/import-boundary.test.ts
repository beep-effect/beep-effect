/** Executable proof of the ecosystem polarity contract and dialect import DAG. */
import { describe, expect, it } from "@effect/vitest";
import { all, fnUntraced, gen, map, tryPromise } from "effect/Effect";
import { decodeUnknownEffect, Record as RecordSchema, String, Unknown } from "effect/Schema";
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isStringLiteralLike,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
} from "typescript";
import type { Node } from "typescript";

interface ModuleEdge {
  readonly file: string;
  readonly specifier: string;
}

const SourceRecord = RecordSchema(String, Unknown);
const decodeRecord = decodeUnknownEffect(SourceRecord);

const importOrExportSpecifier = (node: Node): string | undefined => {
  if (
    (isImportDeclaration(node) || isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    isStringLiteralLike(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  return undefined;
};

const importEqualsSpecifier = (node: Node): string | undefined => {
  if (
    isImportEqualsDeclaration(node) &&
    isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression !== undefined &&
    isStringLiteralLike(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text;
  }
  return undefined;
};

const callSpecifier = (node: Node): string | undefined => {
  if (!isCallExpression(node)) return undefined;
  const isDynamicImport = node.expression.kind === SyntaxKind.ImportKeyword;
  const isRequire = isIdentifier(node.expression) && node.expression.text === "require";
  const argument = node.arguments[0];
  return (isDynamicImport || isRequire) && argument !== undefined && isStringLiteralLike(argument)
    ? argument.text
    : undefined;
};

const moduleSpecifiers = (file: string, source: string): ReadonlyArray<ModuleEdge> => {
  const edges: Array<ModuleEdge> = [];
  const sourceFile = createSourceFile(file, source, ScriptTarget.Latest, true, ScriptKind.TS);
  const visit = (node: Node): void => {
    const specifier = importOrExportSpecifier(node) ?? importEqualsSpecifier(node) ?? callSpecifier(node);
    if (specifier !== undefined) edges.push({ file, specifier });
    forEachChild(node, visit);
  };
  visit(sourceFile);
  return edges;
};

const sourceEdges = (directoryUrl: URL) =>
  gen(function* () {
    const files = [...new Bun.Glob("**/*.ts").scanSync({ cwd: directoryUrl.pathname })];
    return yield* all(
      files.map((file) =>
        tryPromise(() => Bun.file(new URL(file, directoryUrl)).text()).pipe(
          map((source) => moduleSpecifiers(file, source))
        )
      ),
      { concurrency: "unbounded" }
    ).pipe(map((edges) => edges.flat()));
  });

const localModuleUrls = (current: URL, source: string): ReadonlyArray<URL> =>
  moduleSpecifiers(current.pathname, source)
    .filter(({ specifier }) => specifier.startsWith("."))
    .map(({ specifier }) => new URL(specifier, current));

const localImportClosure = (entrypoint: URL) =>
  gen(function* () {
    const pending = [entrypoint];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || visited.has(current.pathname)) continue;
      visited.add(current.pathname);
      const source = yield* tryPromise(() => Bun.file(current).text());
      pending.push(...localModuleUrls(current, source));
    }
    return [...visited];
  });

const forbiddenDialectEdges = (directory: "core" | "pg" | "sqlite", forbiddenFragments: ReadonlyArray<string>) =>
  gen(function* () {
    const edges = yield* sourceEdges(new URL(`../src/${directory}/`, import.meta.url));
    return edges.filter(({ specifier }) => forbiddenFragments.some((fragment) => specifier.includes(fragment)));
  });

describe("ecosystem import boundaries", () => {
  it.effect(
    "keeps every source module free of @beep/* edges",
    fnUntraced(function* () {
      const edges = yield* sourceEdges(new URL("../src/", import.meta.url));
      expect(edges.filter(({ specifier }) => specifier.startsWith("@beep/"))).toEqual([]);
    })
  );

  it.effect(
    "keeps runtime manifest edges free of @beep/* and forbids bundled fields",
    fnUntraced(function* () {
      const manifest = yield* decodeRecord(
        yield* tryPromise(() => Bun.file(new URL("../package.json", import.meta.url)).json())
      );
      const runtimeSections = ["dependencies", "peerDependencies", "optionalDependencies"];
      const runtimeKeys: Array<string> = [];
      const runtimeValues: Array<unknown> = [];
      for (const section of runtimeSections) {
        if (section in manifest) {
          const dependencies = yield* decodeRecord(manifest[section]);
          runtimeKeys.push(...Object.keys(dependencies));
          runtimeValues.push(...Object.values(dependencies));
        }
      }
      expect(runtimeKeys.filter((key) => key.startsWith("@beep/"))).toEqual([]);
      expect(runtimeValues.filter((value) => typeof value === "string" && value.startsWith("npm:@beep/"))).toEqual([]);
      expect(
        Object.keys(manifest).filter((key) => ["bundleddependencies", "bundledependencies"].includes(key.toLowerCase()))
      ).toEqual([]);
    })
  );
});

describe("dialect import boundaries", () => {
  it.effect(
    "keeps core independent of both dialects",
    fnUntraced(function* () {
      expect(yield* forbiddenDialectEdges("core", ["../pg", "../sqlite"])).toEqual([]);
    })
  );

  it.effect(
    "keeps PostgreSQL and SQLite as non-importing siblings",
    fnUntraced(function* () {
      const pgBackedges = yield* forbiddenDialectEdges("pg", ["../sqlite"]);
      const sqliteBackedges = yield* forbiddenDialectEdges("sqlite", ["../pg"]);
      expect([...pgBackedges, ...sqliteBackedges]).toEqual([]);
    })
  );

  it.effect(
    "keeps each dialect-local kit constructor outside its sibling graph",
    fnUntraced(function* () {
      const pg = yield* localImportClosure(new URL("../src/pg/index.ts", import.meta.url));
      const sqlite = yield* localImportClosure(new URL("../src/sqlite/index.ts", import.meta.url));
      expect(pg.some((path) => path.endsWith("/pg/kit.ts"))).toBe(true);
      expect(sqlite.some((path) => path.endsWith("/sqlite/kit.ts"))).toBe(true);
      expect(pg.some((path) => path.includes("/sqlite/"))).toBe(false);
      expect(sqlite.some((path) => path.includes("/pg/"))).toBe(false);
    })
  );
});

// Bun.build only exists under the Bun runtime; the coverage lane runs Vitest
// on Node, where this suite must skip rather than fail. Bun-driven unit runs
// keep proving bundle isolation.
const hasBunBuild = typeof Bun !== "undefined" && typeof Bun.build === "function";

describe.runIf(hasBunBuild)("bundle isolation", () => {
  it.effect(
    "drops unrelated PostgreSQL column families and SQLite from an integer import",
    fnUntraced(function* () {
      const result = yield* tryPromise(() =>
        Bun.build({
          entrypoints: [new URL("./bundle-pg-integer.consumer.ts", import.meta.url).pathname],
          format: "esm",
          minify: true,
          target: "bun",
        })
      );
      const outputs = yield* tryPromise(() => Promise.all(result.outputs.map((output) => output.text())));
      const output = outputs.join("");
      expect(result.success).toBe(true);
      expect(outputs).toHaveLength(1);
      expect(output).not.toContain("Custom-column identity must agree");
      expect(output).not.toContain("Timestamp identity must agree");
      expect(output).not.toContain("timestamp_ms");
    })
  );
});
