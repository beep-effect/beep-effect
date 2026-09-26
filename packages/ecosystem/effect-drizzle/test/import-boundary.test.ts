/** Executable proof of the ecosystem polarity contract and dialect import DAG. */
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import { fnUntraced, forEach, gen, map, tryPromise, withSpan } from "effect/Effect";
import { decodeUnknownEffect, Record as RecordSchema, String, Unknown } from "effect/Schema";
import * as Str from "effect/String";
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

const sourceEdges = (directoryUrl: URL, requiredFile: string) =>
  gen(function* () {
    const files = [...new Bun.Glob("**/*.ts").scanSync({ cwd: directoryUrl.pathname })];
    expect(files).toContain(requiredFile);
    return yield* forEach(
      files,
      (file) =>
        tryPromise(() => Bun.file(new URL(file, directoryUrl)).text()).pipe(
          withSpan("EffectDrizzle.boundary.read", { attributes: { file } }),
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

const workspaceEdges = (edges: ReadonlyArray<ModuleEdge>) =>
  A.filter(edges, ({ specifier }) => Str.startsWith("@beep/")(specifier));

const dialectEdges = (edges: ReadonlyArray<ModuleEdge>, forbiddenFragments: ReadonlyArray<string>) =>
  A.filter(edges, ({ specifier }) => A.some(forbiddenFragments, (fragment) => Str.includes(fragment)(specifier)));

const dialectEntrypoints = { core: "model.ts", pg: "index.ts", sqlite: "index.ts" };

const forbiddenDialectEdges = (directory: "core" | "pg" | "sqlite", forbiddenFragments: ReadonlyArray<string>) =>
  gen(function* () {
    const edges = yield* sourceEdges(
      new URL(`../src/${directory}/`, import.meta.url),
      dialectEntrypoints[directory]
    ).pipe(withSpan("EffectDrizzle.boundary.scan", { attributes: { tree: directory } }));
    return dialectEdges(edges, forbiddenFragments);
  });

describe("boundary scanner controls", () => {
  it("detects forbidden edges in each supported module syntax", () => {
    const source = `
      import { value } from "@beep/forbidden-import";
      export { value } from "@beep/forbidden-export";
      import legacy = require("@beep/forbidden-equals");
      void import("@beep/forbidden-dynamic");
      require("@beep/forbidden-require");
      import { pg } from "../pg/index.ts";
      export { sqlite } from "../sqlite/index.ts";
      import { allowed } from "effect/Effect";
    `;
    const edges = moduleSpecifiers("boundary-control.ts", source);
    expect(A.map(workspaceEdges(edges), ({ specifier }) => specifier)).toEqual([
      "@beep/forbidden-import",
      "@beep/forbidden-export",
      "@beep/forbidden-equals",
      "@beep/forbidden-dynamic",
      "@beep/forbidden-require",
    ]);
    expect(A.map(dialectEdges(edges, ["../pg", "../sqlite"]), ({ specifier }) => specifier)).toEqual([
      "../pg/index.ts",
      "../sqlite/index.ts",
    ]);
  });
});

describe("ecosystem import boundaries", () => {
  it.effect(
    "keeps every source module free of @beep/* edges",
    fnUntraced(function* () {
      const edges = yield* sourceEdges(new URL("../src/", import.meta.url), "index.ts").pipe(
        withSpan("EffectDrizzle.boundary.scan", { attributes: { tree: "src" } })
      );
      expect(workspaceEdges(edges)).toEqual([]);
    })
  );

  it.effect(
    "keeps runtime manifest edges free of @beep/* and forbids bundled fields",
    fnUntraced(function* () {
      const manifest = yield* decodeRecord(
        yield* tryPromise(() => Bun.file(new URL("../package.json", import.meta.url)).json()).pipe(
          withSpan("EffectDrizzle.boundary.manifest")
        )
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
      const artifact = yield* tryPromise(buildBundleConsumer).pipe(withSpan("EffectDrizzle.boundary.build"));
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
