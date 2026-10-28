/**
 * `@beep/repo-tsconfig` adoption parity for `quality check-census` (3-A5).
 *
 * `Quality/CheckCensus.ts` read three tsconfig projections by hand through
 * `jsonc-parser` and local schemas: the package `tsconfig.json` `references`,
 * the `tsconfig.check.json` `include` / `exclude` selection, and each
 * referenced project's own `compilerOptions.outDir` (defaulting to `dist`).
 * 3-A5 moves them onto `TsconfigLoader.load` and
 * `TsconfigLoader.compilerOptions`. This script keeps a frozen copy of the
 * legacy readers and compares, for every census package of the live repo:
 *
 * - the synthesized reference-keeping overlay text (`tsconfig.__census.json`);
 * - the declaration index each reference resolves to (`<outDir>/index.d.ts`).
 *
 * Every difference is listed; the run fails on any.
 *
 * With `--normalize-census <report.json>` it instead prints a census report
 * (`quality check-census --output-json`) with its timing and timestamp keys
 * (and the timing-derived gate `checkTime` verdict) removed, as one JSON
 * document, so a before/after pair can be compared byte for byte. Rows for a
 * package whose own source changed between the runs differ legitimately.
 *
 * Usage (from the repo root, after `bun install`):
 *
 *   bun goals/effected-promotion/ops/check-census-adoption-parity.ts [--out <report.json>]
 *   bun goals/effected-promotion/ops/check-census-adoption-parity.ts --normalize-census <report.json>
 */

import { selectCheckCensusPackages } from "@beep/repo-cli/commands/Quality/CheckCensus";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { FsUtilsLive, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse as parseJsonc } from "jsonc-parser";

const TOOL = "goals/effected-promotion/ops/check-census-adoption-parity.ts";
const OVERLAY_COMPILER_OPTIONS = {
  composite: false,
  incremental: false,
  declaration: false,
  declarationMap: false,
  emitDeclarationOnly: false,
  noEmit: true,
};

class CheckCensusParityFailed extends Data.TaggedError("CheckCensusParityFailed")<{ readonly reason: string }> {}

// --- frozen legacy readers (CheckCensus.ts before 3-A5) ------------------------

const LegacyReferences = S.Struct({ references: S.Array(S.Struct({ path: S.String })).pipe(S.optionalKey) });
const LegacyOutDir = S.Struct({
  compilerOptions: S.Struct({ outDir: S.optionalKey(S.String) }).pipe(S.optionalKey),
});
const LegacySelection = S.Struct({
  include: S.Array(S.String).pipe(S.optionalKey),
  exclude: S.Array(S.String).pipe(S.optionalKey),
});

const readJsonc = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return parseJsonc(yield* fs.readFileString(file));
});

const legacyReferences = Effect.fnUntraced(function* (packageDir: string) {
  const path = yield* Path.Path;
  const decoded = yield* S.decodeUnknownEffect(LegacyReferences)(
    yield* readJsonc(path.join(packageDir, "tsconfig.json"))
  );
  return decoded.references ?? A.empty();
});

const legacySelection = Effect.fnUntraced(function* (packageDir: string) {
  const path = yield* Path.Path;
  return yield* S.decodeUnknownEffect(LegacySelection)(yield* readJsonc(path.join(packageDir, "tsconfig.check.json")));
});

const legacyDeclarationIndex = Effect.fnUntraced(function* (tsconfigPath: string) {
  const path = yield* Path.Path;
  const decoded = yield* S.decodeUnknownEffect(LegacyOutDir)(yield* readJsonc(tsconfigPath));
  const outDir = decoded.compilerOptions?.outDir ?? "dist";
  return path.resolve(path.dirname(tsconfigPath), outDir, "index.d.ts");
});

// --- adopted readers (CheckCensus.ts after 3-A5) -------------------------------

const kitReferences = Effect.fnUntraced(function* (packageDir: string) {
  const path = yield* Path.Path;
  const doc = yield* TsconfigLoader.load(path.join(packageDir, "tsconfig.json"));
  return A.map(doc.references ?? A.empty(), (reference) => ({ path: reference.path }));
});

const kitSelection = Effect.fnUntraced(function* (packageDir: string) {
  const path = yield* Path.Path;
  const doc = yield* TsconfigLoader.load(path.join(packageDir, "tsconfig.check.json"));
  return {
    ...(P.isUndefined(doc.include) ? {} : { include: doc.include }),
    ...(P.isUndefined(doc.exclude) ? {} : { exclude: doc.exclude }),
  };
});

const kitDeclarationIndex = Effect.fnUntraced(function* (tsconfigPath: string) {
  const path = yield* Path.Path;
  const options = yield* TsconfigLoader.compilerOptions(tsconfigPath);
  const outDir = options.outDir ?? "dist";
  return path.resolve(path.dirname(tsconfigPath), outDir, "index.d.ts");
});

// --- shared census mechanics ---------------------------------------------------

const referencedTsconfigPath = Effect.fnUntraced(function* (packageDir: string, reference: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(packageDir, reference);
  const stat = yield* fs.stat(resolved).pipe(Effect.option);
  return O.isSome(stat) && stat.value.type === "Directory" ? path.join(resolved, "tsconfig.json") : resolved;
});

const overlayText = Effect.fnUntraced(function* (
  repoRoot: string,
  packageDir: string,
  selection: object,
  references: ReadonlyArray<{ readonly path: string }>
) {
  const path = yield* Path.Path;
  return yield* jsonStringifyPretty({
    extends: "./tsconfig.json",
    ...selection,
    references,
    compilerOptions: { ...OVERLAY_COMPILER_OPTIONS, rootDir: path.relative(packageDir, repoRoot) },
  });
});

const comparePackage = Effect.fnUntraced(function* (repoRoot: string, name: string, dir: string) {
  const path = yield* Path.Path;
  const legacyRefs = yield* legacyReferences(dir);
  const kitRefs = yield* kitReferences(dir);
  const legacyOverlay = yield* overlayText(repoRoot, dir, yield* legacySelection(dir), legacyRefs);
  const kitOverlay = yield* overlayText(repoRoot, dir, yield* kitSelection(dir), kitRefs);
  const declarations = yield* Effect.forEach(legacyRefs, (reference) =>
    Effect.gen(function* () {
      const tsconfigPath = yield* referencedTsconfigPath(dir, reference.path);
      return {
        reference: reference.path,
        legacy: path.relative(repoRoot, yield* legacyDeclarationIndex(tsconfigPath)),
        kit: path.relative(repoRoot, yield* kitDeclarationIndex(tsconfigPath)),
      };
    })
  );
  return {
    name,
    references: legacyRefs.length,
    overlayAgrees: legacyOverlay === kitOverlay,
    overlayDiff: legacyOverlay === kitOverlay ? O.none<string>() : O.some(`legacy=${legacyOverlay} kit=${kitOverlay}`),
    declarationDiffs: A.filter(declarations, (row) => row.legacy !== row.kit),
  };
});

// --- census normalization ------------------------------------------------------

// `*Ms` and `*At` are durations and timestamps; the gate's `checkTime` verdict
// (`within` / `slower` / `faster`) is derived from wall-clock check time.
const isTimingKey = (key: string): boolean => key === "checkTime" || Str.endsWith("Ms")(key) || Str.endsWith("At")(key);

const stripTiming = (value: unknown): unknown => {
  if (A.isArray(value)) {
    return A.map(value, stripTiming);
  }
  if (P.isObject(value)) {
    return pipe(
      R.filter(value as Record<string, unknown>, (_, key) => !isTimingKey(key)),
      R.map(stripTiming)
    );
  }
  return value;
};

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

const gitHead = (repoRoot: string): O.Option<string> => {
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repoRoot });
  return pipe(
    O.some(result.stdout.toString().trim()),
    O.filter((text) => result.exitCode === 0 && /^[0-9a-f]{40}$/.test(text))
  );
};

const normalizeCensus = Effect.fnUntraced(function* (reportPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const parsed: unknown = JSON.parse(yield* fs.readFileString(reportPath));
  yield* Console.log(yield* jsonStringifyPretty(stripTiming(parsed)));
});

const parity = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const packages = yield* selectCheckCensusPackages(repoRoot, O.none());
  const rows = yield* Effect.forEach(packages, (pkg) => comparePackage(repoRoot, pkg.name, pkg.dir), {
    concurrency: 8,
  });
  const overlayDiffs = A.filterMap(rows, (row) => O.map(row.overlayDiff, (diff) => `${row.name}: ${diff}`));
  const declarationDiffs = A.flatMap(rows, (row) =>
    A.map(row.declarationDiffs, (diff) => `${row.name}: ${diff.reference} legacy=${diff.legacy} kit=${diff.kit}`)
  );
  const ok = A.isReadonlyArrayEmpty(overlayDiffs) && A.isReadonlyArrayEmpty(declarationDiffs);
  const report = {
    schemaVersion: 1,
    ...O.match(gitHead(repoRoot), { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    tool: TOOL,
    generatedAt: DateTime.formatIso(yield* DateTime.now),
    packages: rows.length,
    references: A.reduce(rows, 0, (sum, row) => sum + row.references),
    overlaysAgree: A.filter(rows, (row) => row.overlayAgrees).length,
    overlayDiffs,
    declarationDiffs,
    ok,
  };
  const encoded = yield* jsonStringifyPretty(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) => fs.writeFileString(out, `${encoded}\n`),
  });
  yield* Console.log(
    `${report.packages} census packages, ${report.references} references: ${report.overlaysAgree} overlays agree, ${overlayDiffs.length} overlay diffs, ${declarationDiffs.length} declaration-index diffs`
  );
  if (!ok) {
    return yield* new CheckCensusParityFailed({ reason: "the adopted readers disagree with the legacy readers" });
  }
});

const program = Effect.fn("CheckCensusAdoptionParity.main")(function* () {
  const repoRoot = process.cwd();
  return yield* O.match(flagValue("--normalize-census"), {
    onNone: () => parity(repoRoot),
    onSome: normalizeCensus,
  });
});

program().pipe(Effect.provide(Layer.provideMerge(FsUtilsLive, NodeServices.layer)), NodeRuntime.runMain);
