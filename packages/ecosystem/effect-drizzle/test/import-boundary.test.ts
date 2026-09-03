/** Executable proof of the ecosystem polarity contract and dialect import DAG. */
import { describe, expect, it } from "@effect/vitest";
import { fnUntraced, forEach, gen, map, tryPromise } from "effect/Effect";
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
import { buildBundleConsumer } from "./bundle-build.ts";
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
    return yield* forEach(
      files,
      (file) =>
        tryPromise(() => Bun.file(new URL(file, directoryUrl)).text()).pipe(
          map((source) => moduleSpecifiers(file, source))
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

describe("bundle isolation", () => {
  it.effect(
    "drops unrelated PostgreSQL column families and SQLite from an integer import",
    fnUntraced(function* () {
      const artifact = yield* tryPromise(buildBundleConsumer);
      // A vacuous stub (the Bun.build shaker failure mode) cannot pass:
      // the bundle must carry the real integer implementation.
      expect(artifact.rawBytes).toBeGreaterThan(1000);
      expect(artifact.text).toContain("integer");
      expect(artifact.text).not.toContain("Custom-column identity must agree");
      expect(artifact.text).not.toContain("Timestamp identity must agree");
      expect(artifact.text).not.toContain("timestamp_ms");
      expect(artifact.text).not.toContain("sqlite");
    })
  );
});
