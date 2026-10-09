/**
 * The S0 verbatim copy of goal section 6: upstream source, tests and fixtures
 * into the lab, import rewrites, carried documentation, per-module tsconfig,
 * dependency registration, and the ledger row.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AlreadyCopied, ManifestInvalid, UnexpectedDependency, UpstreamMissing } from "./Audit.errors.ts";
import { type CatalogEntry, catalogEntry, isIgnoredUpstreamDep } from "./Catalog.ts";
import { type KitExports, readExportFacets, rewriteSpecifiers, type SpecifierResolver, tsExtension } from "./Exports.ts";
import { assembleKnowledge, moduleTsconfig, okfLinks, readmeSkeleton, scanVendorNotices } from "./Knowledge.ts";
import { type ExportEntry, LedgerRow, MODULE_NAMES, type ModuleName, NewDep } from "./Ledger.schema.ts";
import { updateRow } from "./LedgerStore.ts";
import { labPaths, type RunnerConfig, upstreamPaths } from "./Paths.ts";

const $I = $ScratchpadId.create("effected/runner/Copy");

const JsonObjectText = S.fromJsonString(S.JsonObject, { space: 2 });
const decodeJsonObject = S.decodeUnknownEffect(JsonObjectText);
const encodeJsonObject = S.encodeEffect(JsonObjectText);

/**
 * Reads a JSON object file, failing typed when it is absent or malformed.
 *
 * **Example** (Read a manifest)
 *
 * ```ts
 * import { readJsonObject } from "@beep/scratchpad/effected/runner/Copy"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readJsonObject("/repo/package.json", "package.json"))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readJsonObject = Effect.fn("Copy.readJsonObject")(function* (absolute: string, label: string) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(absolute))) {
    return yield* ManifestInvalid.make({ path: label, detail: "file does not exist" });
  }
  const text = yield* fs.readFileString(absolute);
  return yield* decodeJsonObject(text).pipe(
    Effect.mapError((issue) => ManifestInvalid.make({ path: label, detail: String(issue) }))
  );
});

const isStringRecord = S.is(S.Record(S.String, S.String));
const isString = S.is(S.String);

const stringRecord = (value: unknown): Readonly<Record<string, string>> => (isStringRecord(value) ? value : {});

/**
 * The `exports` map of every upstream kit package that has one, keyed by
 * `@effected/<m>`; subpaths map to their `./src/...` file.
 *
 * **Example** (Load the kit exports)
 *
 * ```ts
 * import { readKitExports } from "@beep/scratchpad/effected/runner/Copy"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = readKitExports(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readKitExports = Effect.fn("Copy.readKitExports")(function* (config: RunnerConfig) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* Effect.forEach(MODULE_NAMES, Effect.fnUntraced(function* (module) {
      const file = path.join(config.upstreamRoot, upstreamPaths(module).packageJson);
      if (!(yield* fs.exists(file))) {
        return O.none<readonly [string, HashMap.HashMap<string, string>]>();
      }
      const manifest = yield* readJsonObject(file, upstreamPaths(module).packageJson);
      const exportsMap = HashMap.fromIterable(
        A.filter(R.toEntries(stringRecord(manifest.exports)), ([subpath]) => subpath !== "./package.json")
      );
      return O.some([`@effected/${module}`, exportsMap] as const);
    })
  );
  const kitExports: KitExports = HashMap.fromIterable(A.getSomes(entries));
  return kitExports;
});

const UPSTREAM_SRC = /^packages\/([^/]+)\/src\/(.*)$/;
const UPSTREAM_TEST = /^packages\/([^/]+)\/__test__\/(.*)$/;

/**
 * The lab (repo-relative) path of an upstream-relative source or test path,
 * or none for paths outside a kit package.
 *
 * **Example** (Map an upstream path)
 *
 * ```ts
 * import { mapUpstreamToLab } from "@beep/scratchpad/effected/runner/Copy"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(mapUpstreamToLab("packages/glob/src/Glob.ts"))) // "scratchpad/effected/glob/Glob.ts"
 * console.log(O.getOrNull(mapUpstreamToLab("packages/glob/__test__/Glob.test.ts"))) // "scratchpad/test/glob/Glob.test.ts"
 * console.log(O.isNone(mapUpstreamToLab("okf/project.md"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const mapUpstreamToLab = (upstreamRelative: string): O.Option<string> => {
  const src = UPSTREAM_SRC.exec(upstreamRelative);
  if (src !== null) return O.some(`scratchpad/effected/${src[1]}/${src[2]}`);
  const test = UPSTREAM_TEST.exec(upstreamRelative);
  if (test !== null) return O.some(`scratchpad/test/${test[1]}/${test[2]}`);
  return O.none();
};

const dotRelative = (relative: string): string => (Str.startsWith(".")(relative) ? relative : `./${relative}`);

/**
 * The specifier resolver for one copied file (section 5.2), built on the
 * pure upstream-to-lab path mapping.
 *
 * **Example** (Resolve a sibling kit import)
 *
 * ```ts
 * import { makeResolver } from "@beep/scratchpad/effected/runner/Copy"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import { BunServices } from "@effect/platform-bun"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const program = makeResolver(
 *   RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }),
 *   "/up/packages/walker/src/Walker.ts",
 *   "scratchpad/effected/walker/Walker.ts",
 *   HashMap.empty()
 * ).pipe(Effect.provide(BunServices.layer))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeResolver = Effect.fn("Copy.makeResolver")(function* (
  config: RunnerConfig,
  upstreamFile: string,
  labFile: string,
  kitExports: KitExports
) {
  const path = yield* Path.Path;
  const labDir = path.dirname(path.join(config.repoRoot, labFile));
  const toLabRelative = (upstreamAbsolute: string): O.Option<string> =>
    O.map(mapUpstreamToLab(path.relative(config.upstreamRoot, upstreamAbsolute)), (labTarget) =>
      tsExtension(dotRelative(path.relative(labDir, path.join(config.repoRoot, labTarget))))
    );
  const resolver: SpecifierResolver = {
    resolveRelative: (specifier) => toLabRelative(path.resolve(path.dirname(upstreamFile), specifier)),
    resolveKit: (dep, subpath) =>
      O.flatMap(
        O.flatMap(HashMap.get(kitExports, `@effected/${dep}`), (exportsMap) => HashMap.get(exportsMap, subpath)),
        (file) => toLabRelative(path.join(config.upstreamRoot, "packages", dep, file))
      ),
  };
  return resolver;
});

const isTsFile = (file: string): boolean => Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file);

/**
 * Repo-relative TypeScript files under a repo-relative directory, sorted.
 *
 * **Example** (List a module's sources)
 *
 * ```ts
 * import { listTsFiles } from "@beep/scratchpad/effected/runner/Copy"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(listTsFiles("/repo", "scratchpad/effected/jsonc"))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const listTsFiles = Effect.fn("Copy.listTsFiles")(function* (repoRoot: string, directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, directory);
  if (!(yield* fs.exists(absolute))) {
    return A.empty<string>();
  }
  const entries = yield* fs.readDirectory(absolute, { recursive: true });
  const files = yield* Effect.forEach(A.filter(entries, isTsFile), (entry) =>
    Effect.map(fs.stat(path.join(absolute, entry)), (info) =>
      info.type === "File" ? O.some(`${directory}/${entry}`) : O.none<string>()
    )
  );
  return A.sort(A.getSomes(files), Order.String);
});

const rewriteTree = Effect.fn("Copy.rewriteTree")(function* (
  config: RunnerConfig,
  labDir: string,
  upstreamDir: string,
  kitExports: KitExports
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* listTsFiles(config.repoRoot, labDir);
  yield* Effect.forEach(files, Effect.fnUntraced(function* (labFile) {
      const inside = path.relative(labDir, labFile);
      const upstreamFile = path.join(config.upstreamRoot, upstreamDir, inside);
      const resolver = yield* makeResolver(config, upstreamFile, labFile, kitExports);
      const absolute = path.join(config.repoRoot, labFile);
      const before = yield* fs.readFileString(absolute);
      const after = rewriteSpecifiers(before, resolver);
      if (after !== before) {
        yield* fs.writeFileString(absolute, after);
      }
    })
  );
  return files.length;
});

const fixturesBytes = Effect.fn("Copy.fixturesBytes")(function* (repoRoot: string, testDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, testDir);
  if (!(yield* fs.exists(absolute))) return 0;
  const entries = yield* fs.readDirectory(absolute, { recursive: true });
  const sizes = yield* Effect.forEach(
    A.filter(entries, (entry) => Str.includes("fixtures/")(`${entry}/`) || Str.startsWith("fixtures")(entry)),
    (entry) => Effect.map(fs.stat(path.join(absolute, entry)), (info) => (info.type === "File" ? Number(info.size) : 0))
  );
  return A.reduce(sizes, 0, (total, size) => total + size);
});

const CATALOG_LINE = /^(\s*)"?([^"\s:]+)"?:\s*(\S.*)$/;

/**
 * Every `name: spec` pair under a pnpm `catalog:`/`catalogs:` block, flattened
 * across named catalogs (first occurrence wins).
 *
 * **Example** (Flatten catalogs)
 *
 * ```ts
 * import { parseCatalogSpecs } from "@beep/scratchpad/effected/runner/Copy"
 * import * as HashMap from "effect/HashMap"
 *
 * const specs = parseCatalogSpecs("catalogs:\n  effect:\n    effect: ^4.0.0\n  build:\n    typescript: ^6.0.0\n")
 * console.log(HashMap.get(specs, "typescript")) // some("^6.0.0")
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseCatalogSpecs = (text: string): HashMap.HashMap<string, string> => {
  let inside = false;
  let specs = HashMap.empty<string, string>();
  for (const line of Str.split("\n")(text)) {
    if (/^catalogs?:\s*$/.test(line)) {
      inside = true;
      continue;
    }
    if (/^\S/.test(line)) {
      inside = false;
      continue;
    }
    if (!inside) continue;
    const match = CATALOG_LINE.exec(line);
    if (match === null) continue;
    const name = match[2] ?? "";
    const spec = Str.trim(match[3] ?? "");
    if (spec.length > 0 && !HashMap.has(specs, name)) {
      specs = HashMap.set(specs, name, spec);
    }
  }
  return specs;
};

const resolveSpec = Effect.fn("Copy.resolveSpec")(function* (
  config: RunnerConfig,
  module: ModuleName,
  name: string,
  upstreamSpec: string,
  upstreamCatalog: HashMap.HashMap<string, string>,
  rootCatalog: Readonly<Record<string, string>>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (R.has(rootCatalog, name)) return "catalog:";
  if (!Str.startsWith("catalog:")(upstreamSpec)) return upstreamSpec;
  const fromCatalog = HashMap.get(upstreamCatalog, name);
  if (O.isSome(fromCatalog)) return fromCatalog.value;
  for (const candidate of [
    path.join(config.upstreamCheckout, "packages", module, "node_modules", name, "package.json"),
    path.join(config.upstreamCheckout, "node_modules", name, "package.json"),
  ]) {
    if (yield* fs.exists(candidate)) {
      const manifest = yield* readJsonObject(candidate, candidate);
      if (isString(manifest.version)) return `^${manifest.version}`;
    }
  }
  return yield* ManifestInvalid.make({ path: upstreamPaths(module).packageJson, detail: `cannot resolve ${upstreamSpec} for ${name}` });
});

const classifyDeps = Effect.fn("Copy.classifyDeps")(function* (
  config: RunnerConfig,
  module: ModuleName,
  entry: CatalogEntry,
  manifest: Readonly<Record<string, unknown>>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspaceFile = path.join(config.upstreamRoot, "pnpm-workspace.yaml");
  const upstreamCatalog = (yield* fs.exists(workspaceFile))
    ? parseCatalogSpecs(yield* fs.readFileString(workspaceFile))
    : HashMap.empty<string, string>();
  const rootManifest = yield* readJsonObject(path.join(config.repoRoot, "package.json"), "package.json");
  const rootCatalog = stringRecord(rootManifest.catalog);
  const collect = (field: string, allowed: ReadonlyArray<string>, kind: "runtime" | "dev") =>
    Effect.forEach(R.toEntries(stringRecord(manifest[field])), Effect.fnUntraced(function* ([name, spec]) {
        if (Str.startsWith("@effected/")(name) || isIgnoredUpstreamDep(name)) return O.none<NewDep>();
        if (!A.contains(allowed, name)) {
          return yield* UnexpectedDependency.make({ module, name, field });
        }
        const resolved = yield* resolveSpec(config, module, name, spec, upstreamCatalog, rootCatalog);
        return O.some(NewDep.make({ name, kind, spec: resolved, replacement: null }));
      })
    );
  const runtime = yield* collect("dependencies", entry.runtimeDeps, "runtime");
  const peers = yield* collect("peerDependencies", entry.runtimeDeps, "runtime");
  // A peer dependency is usually installed for development too; it is already
  // registered as runtime above, and the dedupe below keeps that entry.
  const dev = yield* collect("devDependencies", [...entry.oracleDeps, ...entry.runtimeDeps], "dev");
  return A.dedupeWith(A.getSomes([...runtime, ...peers, ...dev]), (a, b) => a.name === b.name);
});

const sortedRecord = (record: Readonly<Record<string, string>>): Record<string, string> =>
  R.fromEntries(A.sort(R.toEntries(record), Order.mapInput(Order.String, ([key]: readonly [string, string]) => key)));

/**
 * Registers new dependencies in `scratchpad/package.json`, keeping each
 * dependency map sorted; existing specs are left alone.
 *
 * **Example** (Register an oracle dependency)
 *
 * ```ts
 * import { registerDeps } from "@beep/scratchpad/effected/runner/Copy"
 * import { NewDep } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import * as Effect from "effect/Effect"
 *
 * const program = registerDeps("/repo", [NewDep.make({ name: "minimatch", kind: "dev", spec: "^10.2.5", replacement: null })])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const registerDeps = Effect.fn("Copy.registerDeps")(function* (repoRoot: string, deps: ReadonlyArray<NewDep>) {
  if (A.isReadonlyArrayEmpty(deps)) return 0;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, "scratchpad", "package.json");
  const manifest = yield* readJsonObject(file, "scratchpad/package.json");
  let added = 0;
  const apply = (field: string, kind: "runtime" | "dev"): Record<string, string> => {
    const existing = stringRecord(manifest[field]);
    const next = A.reduce(
      A.filter(deps, (dep) => dep.kind === kind),
      existing,
      (acc, dep) => {
        if (R.has(acc, dep.name)) return acc;
        added += 1;
        return R.set(acc, dep.name, dep.spec);
      }
    );
    return sortedRecord(next);
  };
  const updated = {
    ...manifest,
    dependencies: apply("dependencies", "runtime"),
    devDependencies: apply("devDependencies", "dev"),
  };
  const text = yield* encodeJsonObject(updated).pipe(
    Effect.mapError((issue) => ManifestInvalid.make({ path: "scratchpad/package.json", detail: String(issue) }))
  );
  yield* fs.writeFileString(file, `${text}\n`);
  return added;
});

/**
 * Entry files of a module as `[entry, upstreamFile]` pairs: `.` plus every
 * subpath export, from the upstream manifest.
 *
 * **Example** (List upstream entries)
 *
 * ```ts
 * import { upstreamEntries } from "@beep/scratchpad/effected/runner/Copy"
 * import * as Effect from "effect/Effect"
 *
 * const program = upstreamEntries("/up", "memfs")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const upstreamEntries = Effect.fn("Copy.upstreamEntries")(function* (upstreamRoot: string, module: ModuleName) {
  const path = yield* Path.Path;
  const manifest = yield* readJsonObject(
    path.join(upstreamRoot, upstreamPaths(module).packageJson),
    upstreamPaths(module).packageJson
  );
  const exportsMap = A.filter(
    R.toEntries(stringRecord(manifest.exports)),
    ([subpath, file]) => subpath !== "./package.json" && Str.startsWith("./src/")(file)
  );
  const entries: ReadonlyArray<readonly [entry: string, srcRelative: string]> = A.map(
    exportsMap,
    ([subpath, file]) => [subpath, Str.slice("./src/".length)(file)] as const
  );
  return A.isReadonlyArrayEmpty(entries) ? [[".", "index.ts"] as const] : entries;
});

/**
 * Reads the expected export facets of every upstream entry of a module.
 *
 * **Example** (Read the contract of a module)
 *
 * ```ts
 * import { expectedExports } from "@beep/scratchpad/effected/runner/Copy"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(expectedExports("/up", "glob"))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const expectedExports = Effect.fn("Copy.expectedExports")(function* (upstreamRoot: string, module: ModuleName) {
  const path = yield* Path.Path;
  const entries = yield* upstreamEntries(upstreamRoot, module);
  const facets: ReadonlyArray<ExportEntry> = A.flatMap(entries, ([entry, srcRelative]) =>
    readExportFacets(path.join(upstreamRoot, upstreamPaths(module).srcDir, srcRelative), entry)
  );
  return facets;
});

/**
 * What one copy produced, for the transcript and the ledger note.
 *
 * **Example** (Describe a copy)
 *
 * ```ts
 * import { CopyReport } from "@beep/scratchpad/effected/runner/Copy"
 *
 * const report = CopyReport.make({ module: "glob", sourceFiles: 3, testFiles: 2, fixturesBytes: 0, exportsExpected: 4, newDeps: ["minimatch"], notices: 1 })
 * console.log(report.sourceFiles) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CopyReport extends S.Class<CopyReport>($I`CopyReport`)(
  {
    module: S.String,
    sourceFiles: S.Int,
    testFiles: S.Int,
    fixturesBytes: S.Int,
    exportsExpected: S.Int,
    newDeps: S.Array(S.String),
    notices: S.Int,
  },
  $I.annote("CopyReport", { description: "Counts from one verbatim copy." })
) {}

/**
 * What `carry` wrote for one module.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CarryReport {
  readonly knowledgeSections: number;
  readonly wroteReadme: boolean;
  readonly wroteLicense: boolean;
}

/**
 * Writes the carried documentation surfaces of D4 for one module: always
 * reassembles `KNOWLEDGE.md`; writes `LICENSE`, the adapted `README.md` and the
 * section 5.3 tsconfig only when the lab does not have them, so an existing
 * port's edited README survives.
 *
 * **Example** (Carry the docs of a module)
 *
 * ```ts
 * import { carryDocs } from "@beep/scratchpad/effected/runner/Copy"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" })
 * console.log(Effect.isEffect(carryDocs(config, "glob", { effectedCommit: "abc", notices: [] }))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const carryDocs = Effect.fn("Copy.carryDocs")(function* (
  config: RunnerConfig,
  module: ModuleName,
  provenance: { readonly effectedCommit: string; readonly notices: ReadonlyArray<string> }
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const up = upstreamPaths(module);
  const lab = labPaths(module);
  const readOptional = Effect.fn("Copy.readOptional")(function* (relative: string) {
    const absolute = path.join(config.upstreamRoot, relative);
    return (yield* fs.exists(absolute)) ? O.some(yield* fs.readFileString(absolute)) : O.none<string>();
  });
  const labFile = (name: string) => path.join(config.repoRoot, lab.sourceDir, name);
  const manifest = yield* readJsonObject(path.join(config.upstreamRoot, up.packageJson), up.packageJson);
  const license = yield* readOptional(up.license);
  const writeLicense = O.isSome(license) && !(yield* fs.exists(labFile("LICENSE")));
  if (writeLicense && O.isSome(license)) {
    yield* fs.writeFileString(labFile("LICENSE"), license.value);
  }
  const writeReadme = !(yield* fs.exists(labFile("README.md")));
  if (writeReadme) {
    const readme = O.getOrElse(yield* readOptional(up.readme), () => `# @effected/${module}\n`);
    yield* fs.writeFileString(
      labFile("README.md"),
      readmeSkeleton(readme, {
        module,
        packageName: isString(manifest.name) ? manifest.name : `@effected/${module}`,
        version: isString(manifest.version) ? manifest.version : "unknown",
        commit: provenance.effectedCommit,
        hasLicense: O.isSome(license),
        notices: provenance.notices,
      })
    );
  }
  const claudeMd = O.getOrElse(yield* readOptional(up.claudeMd), () => "");
  const sections = yield* Effect.forEach([up.claudeMd, ...okfLinks(module, claudeMd)], (relative) =>
    Effect.map(readOptional(relative), (content) => ({ path: relative, content }))
  );
  yield* fs.writeFileString(
    labFile("KNOWLEDGE.md"),
    assembleKnowledge({ module, commit: provenance.effectedCommit }, sections)
  );
  if (!(yield* fs.exists(path.join(config.repoRoot, lab.tsconfig)))) {
    yield* fs.writeFileString(path.join(config.repoRoot, lab.tsconfig), moduleTsconfig(module));
  }
  const report: CarryReport = {
    knowledgeSections: sections.length,
    wroteReadme: writeReadme,
    wroteLicense: writeLicense,
  };
  return report;
});

/**
 * Header notices of every source file of a lab module (README attribution
 * leads).
 *
 * **Example** (Collect notices)
 *
 * ```ts
 * import { collectNotices } from "@beep/scratchpad/effected/runner/Copy"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(collectNotices("/repo", "scratchpad/effected/jsonc"))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const collectNotices = Effect.fn("Copy.collectNotices")(function* (repoRoot: string, sourceDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* listTsFiles(repoRoot, sourceDir);
  const notices = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(repoRoot, file)), (text) => scanVendorNotices(file, text))
  );
  return A.flatten(notices);
});

/**
 * Copies one module from upstream into the lab (S0) and fills its ledger row.
 *
 * **Details**
 *
 * Refuses when the lab already holds the module. Fixtures travel inside the
 * test tree byte-exact; every `.ts` file is rewritten per section 5.2 using
 * upstream path resolution, so nested test directories and subpath exports
 * resolve without pattern tables.
 *
 * **Example** (Copy a module)
 *
 * ```ts
 * import { copyModule } from "@beep/scratchpad/effected/runner/Copy"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = copyModule(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "glob", "abc")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const copyModule = Effect.fn("Copy.copyModule")(function* (
  config: RunnerConfig,
  module: ModuleName,
  effectedCommit: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const up = upstreamPaths(module);
  const lab = labPaths(module);
  const entry = yield* O.match(catalogEntry(module), {
    onNone: () => UpstreamMissing.make({ path: `catalog entry for ${module}` }),
    onSome: Effect.succeed,
  });
  const upstreamSrc = path.join(config.upstreamRoot, up.srcDir);
  if (!(yield* fs.exists(upstreamSrc))) {
    return yield* UpstreamMissing.make({ path: up.srcDir });
  }
  const labSrc = path.join(config.repoRoot, lab.sourceDir);
  if (yield* fs.exists(labSrc)) {
    return yield* AlreadyCopied.make({ module, path: lab.sourceDir });
  }
  const kitExports = yield* readKitExports(config);
  yield* fs.copy(upstreamSrc, labSrc, { preserveTimestamps: true });
  const sourceFiles = yield* rewriteTree(config, lab.sourceDir, up.srcDir, kitExports);
  const upstreamTest = path.join(config.upstreamRoot, up.testDir);
  let testFiles = 0;
  if (yield* fs.exists(upstreamTest)) {
    yield* fs.copy(upstreamTest, path.join(config.repoRoot, lab.testDir), { preserveTimestamps: true });
    testFiles = yield* rewriteTree(config, lab.testDir, up.testDir, kitExports);
  }
  const bytes = yield* fixturesBytes(config.repoRoot, lab.testDir);
  const notices = yield* collectNotices(config.repoRoot, lab.sourceDir);
  yield* carryDocs(config, module, { effectedCommit, notices });
  const manifest = yield* readJsonObject(path.join(config.upstreamRoot, up.packageJson), up.packageJson);
  const newDeps = yield* classifyDeps(config, module, entry, manifest);
  yield* registerDeps(config.repoRoot, newDeps);
  const exportsExpected = yield* expectedExports(config.upstreamRoot, module);
  yield* updateRow(config, module, (row) =>
    Effect.succeed(
      LedgerRow.make({
        ...row,
        status: "in-progress",
        upstreamPaths: { src: up.srcDir, test: up.testDir },
        exportsExpected,
        newDeps,
        fixturesBytes: bytes,
      })
    )
  );
  return CopyReport.make({
    module,
    sourceFiles,
    testFiles,
    fixturesBytes: bytes,
    exportsExpected: exportsExpected.length,
    newDeps: A.map(newDeps, (dep) => dep.name),
    notices: notices.length,
  });
});

/**
 * Fills a ledger row from upstream without copying files: the wave-0
 * retrofit path for modules already in the lab.
 *
 * **Example** (Register an existing lab module)
 *
 * ```ts
 * import { registerExisting } from "@beep/scratchpad/effected/runner/Copy"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = registerExisting(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "jsonc")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const registerExisting = Effect.fn("Copy.registerExisting")(function* (config: RunnerConfig, module: ModuleName) {
  const path = yield* Path.Path;
  const up = upstreamPaths(module);
  const lab = labPaths(module);
  const entry = yield* O.match(catalogEntry(module), {
    onNone: () => UpstreamMissing.make({ path: `catalog entry for ${module}` }),
    onSome: Effect.succeed,
  });
  const manifest = yield* readJsonObject(path.join(config.upstreamRoot, up.packageJson), up.packageJson);
  const newDeps = yield* classifyDeps(config, module, entry, manifest);
  const exportsExpected = yield* expectedExports(config.upstreamRoot, module);
  const bytes = yield* fixturesBytes(config.repoRoot, lab.testDir);
  return yield* updateRow(config, module, (row) =>
    Effect.succeed(
      LedgerRow.make({
        ...row,
        status: row.status === "pending" ? "in-progress" : row.status,
        upstreamPaths: { src: up.srcDir, test: up.testDir },
        exportsExpected,
        newDeps,
        fixturesBytes: bytes,
      })
    )
  );
});
