/**
 * Bun.Glob shim census (roadmap PR R2a, W4-p).
 *
 * R2a moves the `GlobShim.match` predicate in the root `vitest.setup.ts` from `picomatch` to `@beep/glob`
 * `GlobPattern` (`dot: true`). The committed census `research/glob-shim-census-r2a.json` records, for every
 * pattern the repo hands to `new Bun.Glob(...)`, the vitest include globs and a few semantics probes, the set
 * of paths each engine matched over one universe: every git-tracked path, each of its ancestor directories,
 * and the same paths relative to every tracked `package.json` directory that contains them. Each side is a
 * count, a sha256 of the newline-joined sorted list, and the list itself when it holds at most `fullListMax`
 * entries. The `before` (picomatch) side was taken once, before the dependency left the root, by the scratch
 * run described in `research/glob-shim-census-r2a.md`; this script recomputes the `after` side with the kit on
 * the current tree and compares it with the record, pattern by pattern.
 *
 * The comparison is meaningful only on the tree the census names: a different tree changes the universe, and
 * the script says so instead of comparing the sets.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/glob-shim-census.ts [--census <path>] [--out <report.json>]
 *
 * Exit code 1 when the universe or any pattern's matched set differs from the record.
 */
import * as NodeCrypto from "node:crypto";
import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const repoRoot = process.cwd();
const argv = process.argv.slice(2);
const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(argv, (arg) => arg === flag),
    (index) => A.get(argv, index + 1)
  );
const censusPath = O.getOrElse(
  flagValue("--census"),
  () => "goals/effected-promotion/research/glob-shim-census-r2a.json"
);

const CensusSide = S.Struct({
  count: S.Number,
  sha256: S.String,
  matched: S.optionalKey(S.Array(S.String)),
  sample: S.optionalKey(S.Struct({ first: S.Array(S.String), last: S.Array(S.String) })),
});
const CensusPattern = S.Struct({
  pattern: S.String,
  origin: S.String,
  identical: S.Boolean,
  before: CensusSide,
  after: CensusSide,
});
const Census = S.Struct({
  schemaVersion: S.Literal("glob-shim-census/v1"),
  pr: S.String,
  tree: S.String,
  universe: S.Struct({ definition: S.String, count: S.Number, sha256: S.String }),
  fullListMax: S.Number,
  patterns: S.Array(CensusPattern),
});
const decodeCensus = S.decodeUnknownEffect(S.fromJsonString(Census));

const sha256 = (lines: ReadonlyArray<string>): string =>
  NodeCrypto.createHash("sha256").update(A.join(lines, "\n")).digest("hex");

const gitLines = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return A.filter(yield* spawner.lines(ChildProcess.make("git", [...args], { cwd: repoRoot })), Str.isNonEmpty);
});

// NUL-separated so paths with characters git would otherwise quote come back verbatim.
const trackedPaths = Effect.fnUntraced(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const output = yield* spawner.string(ChildProcess.make("git", ["ls-files", "-z"], { cwd: repoRoot }));
  return A.filter(Str.split("\0")(output), Str.isNonEmpty);
});

// The census universe: tracked paths and their ancestor directories, repo-relative, then the same paths
// relative to each tracked package.json directory that contains them. Sorted and unique.
const buildUniverse = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const tracked = yield* trackedPaths();
  const universe = MutableHashSet.empty<string>();
  const addWithAncestors = (relative: string): void => {
    MutableHashSet.add(universe, relative);
    let directory = path.dirname(relative);
    while (directory !== "." && Str.isNonEmpty(directory) && !MutableHashSet.has(universe, directory)) {
      MutableHashSet.add(universe, directory);
      directory = path.dirname(directory);
    }
  };
  A.forEach(tracked, addWithAncestors);
  const packageDirectories = pipe(
    tracked,
    A.filter((file) => path.basename(file) === "package.json" && !Str.includes("node_modules/")(file)),
    A.map(path.dirname),
    A.filter((directory) => directory !== ".")
  );
  A.forEach(packageDirectories, (directory) => {
    const prefix = `${directory}/`;
    A.forEach(tracked, (file) => {
      if (Str.startsWith(prefix)(file)) addWithAncestors(Str.slice(prefix.length)(file));
    });
  });
  return A.sort(Str.Order)(A.fromIterable(universe));
});

const globShimOptions = GlobPatternOptions.make({ dot: true });

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const census = yield* decodeCensus(yield* fs.readFileString(censusPath));
  const tree = A.join(yield* gitLines(["rev-parse", "HEAD"]), "");
  const candidates = yield* buildUniverse();
  const universeSha = sha256(candidates);
  const universeMatches = universeSha === census.universe.sha256 && candidates.length === census.universe.count;

  const patterns = yield* Effect.forEach(census.patterns, (record) =>
    Effect.gen(function* () {
      const pattern = yield* GlobPattern.compile(record.pattern, globShimOptions);
      const matched = A.filter(candidates, (candidate) => pattern.matches(candidate));
      const sha = sha256(matched);
      const identical = sha === record.after.sha256 && matched.length === record.after.count;
      return {
        pattern: record.pattern,
        recorded: { count: record.after.count, sha256: record.after.sha256 },
        recomputed: { count: matched.length, sha256: sha },
        identical,
        ...(matched.length <= census.fullListMax ? { matched } : {}),
      };
    })
  );
  const identicalPatterns = A.filter(patterns, (entry) => entry.identical).length;
  const gates = { universe: universeMatches, patterns: identicalPatterns === patterns.length };
  const report = {
    tool: "goals/effected-promotion/ops/glob-shim-census.ts",
    census: censusPath,
    censusTree: census.tree,
    tree,
    engine: { name: "@beep/glob GlobPattern", options: { dot: true } },
    universe: {
      recorded: { count: census.universe.count, sha256: census.universe.sha256 },
      recomputed: { count: candidates.length, sha256: universeSha },
      identical: universeMatches,
    },
    summary: {
      patterns: patterns.length,
      identical: identicalPatterns,
      differing: patterns.length - identicalPatterns,
    },
    gates,
    patterns,
  };
  const json = JSON.stringify(report, null, 2);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });
  yield* Console.error(
    universeMatches
      ? `universe ${candidates.length} paths matches the census; patterns identical ${identicalPatterns}/${patterns.length}`
      : `universe differs from the census (${census.tree} vs ${tree}): ${census.universe.count} recorded, ${candidates.length} now; the per-pattern comparison below is not a parity verdict`
  );
  if (!(gates.universe && gates.patterns)) process.exitCode = 1;
});

NodeRuntime.runMain(
  Layer.build(NodeServices.layer).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
