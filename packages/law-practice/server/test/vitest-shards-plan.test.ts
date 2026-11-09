import * as NodeURL from "node:url";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import shardPlan from "../vitest.shards.json" with { type: "json" };

const packageRoot = NodeURL.fileURLToPath(new URL("../", import.meta.url));
/** The sequencer's lookup (root `vitest.sequencer.ts`), restated here because the test tsconfig stops at the package root. */
const plannedShardIndex = (
  plan: { readonly shards: ReadonlyArray<ReadonlyArray<string>> },
  file: string
): O.Option<number> =>
  A.findFirstIndex(plan.shards, (entries) => A.contains(entries, file)).pipe(O.map((index) => index + 1));
const relativeImportPattern = /from "(\.\.?\/[A-Za-z0-9_./-]+\.ts)"/gu;
const clockSubstitutePattern = /makeCitationNative(?:Manual|Sleep|Wall)Clock|TestClock/u;
const nativeSpawnerFixtures = "test/CitationNativeSpawner.fixtures.ts";

const testFiles = Effect.fn("ShardPlanTest.testFiles")(function* (include: string) {
  const fs = yield* FileSystem.FileSystem;
  const files = yield* fs.glob(include, { root: packageRoot });
  return A.sort(
    A.map(files, (file) => Str.replaceAll("\\", "/")(file)),
    Order.String
  );
});

/** Every test and fixture source under `test/`, keyed by package-relative path. */
const testSources = Effect.fn("ShardPlanTest.testSources")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* testFiles("test/**/*.ts");
  const entries = yield* Effect.forEach(files, (file) =>
    fs.readFileString(path.join(packageRoot, file)).pipe(Effect.map((text) => [file, text] as const))
  );
  return HashMap.fromIterable(entries);
});

/** The fixture closure of one test file: itself plus every `*.fixtures.ts` it reaches. */
const fixtureClosure = (sources: HashMap.HashMap<string, string>, file: string): HashSet.HashSet<string> => {
  const visit = (seen: HashSet.HashSet<string>, current: string): HashSet.HashSet<string> => {
    if (HashSet.has(seen, current) || !HashMap.has(sources, current)) return seen;
    const text = O.getOrElse(HashMap.get(sources, current), () => "");
    const imports = pipe(
      A.fromIterable(Str.matchAll(relativeImportPattern)(text)),
      A.map((match) => resolveRelative(current, match[1] ?? "")),
      A.filter(Str.endsWith(".fixtures.ts"))
    );
    return A.reduce(imports, HashSet.add(seen, current), visit);
  };
  return visit(HashSet.empty(), file);
};

const resolveRelative = (from: string, specifier: string): string => {
  const segments = A.dropRight(Str.split("/")(from), 1);
  const resolved = A.reduce(Str.split("/")(specifier), segments, (acc, segment) =>
    segment === "." ? acc : segment === ".." ? A.dropRight(acc, 1) : A.append(acc, segment)
  );
  return A.join(resolved, "/");
};

/**
 * A file asserts against the real wall clock when its closure spawns real native workers and no
 * file in the closure (the spawner fixtures aside, which define the substitutes) installs a clock.
 */
const nativeWallclockFiles = (sources: HashMap.HashMap<string, string>): ReadonlyArray<string> =>
  pipe(
    HashMap.keys(sources),
    A.fromIterable,
    A.filter(Str.endsWith(".test.ts")),
    A.filter((file) => {
      const closure = fixtureClosure(sources, file);
      const spawns = HashSet.has(closure, nativeSpawnerFixtures);
      const controlled = pipe(
        A.fromIterable(closure),
        A.some(
          (member) =>
            member !== nativeSpawnerFixtures &&
            clockSubstitutePattern.test(O.getOrElse(HashMap.get(sources, member), () => ""))
        )
      );
      return spawns && !controlled;
    }),
    A.sort(Order.String)
  );

it.layer(NodeServices.layer)("law-practice-server shard plan", (it) => {
  it.effect("names every unit test file exactly once and nothing else", () =>
    Effect.gen(function* () {
      const all = yield* testFiles("test/**/*.test.{ts,tsx}");
      // The coverage producer excludes `test/integration/**`; the integration lane is unsharded.
      const unit = A.filter(all, (file) => !Str.startsWith("test/integration/")(file));
      const planned = A.flatten(shardPlan.shards);
      // Disjoint: a file is planned into at most one shard.
      strictEqual(A.length(planned), HashSet.size(HashSet.fromIterable(planned)));
      // No stale entries: every planned file still exists (a removed file would never be collected,
      // but a stale plan hides that the estimate no longer matches what the shard runs).
      deepStrictEqual(A.difference(planned, unit), []);
      // Union: a file the plan does not know (added after the source run) falls back to Vitest's
      // hash shard until `beep ci partitions rebalance --write --run <id>` refreshes the plan.
      const unplanned = A.difference(unit, planned);
      if (A.isReadonlyArrayNonEmpty(unplanned)) {
        yield* Effect.logInfo(
          `[shard-plan] ${A.length(unplanned)} unit file(s) not in vitest.shards.json: ${A.join(unplanned, ", ")}`
        );
      }
      expect(A.length(unplanned)).toBeLessThan(A.length(unit) / 10);
      strictEqual(A.length(shardPlan.estimatedMilliseconds), A.length(shardPlan.shards));
      expect(A.every(shardPlan.shards, A.isReadonlyArrayNonEmpty)).toBe(true);
      for (const file of planned) {
        const index = plannedShardIndex(shardPlan, file);
        assertTrue(O.isSome(index));
        expect(O.getOrElse(index, () => 0)).toBeGreaterThanOrEqual(1);
        expect(O.getOrElse(index, () => 0)).toBeLessThanOrEqual(A.length(shardPlan.shards));
      }
      assertNone(plannedShardIndex(shardPlan, "test/integration/CitationEngineCorpus.test.ts"));
    })
  );

  it.effect("keeps the native-wallclock project equal to the files that spawn workers on the real clock", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const sources = yield* testSources();
      const derived = nativeWallclockFiles(sources);
      const config = yield* fs.readFileString(path.join(packageRoot, "vitest.config.ts"));
      const declared = pipe(
        Str.match(/const nativeWallclockSuites = \[([\s\S]*?)\];/u)(config),
        O.flatMapNullishOr((match) => match[1]),
        O.map((body) => A.map(A.fromIterable(Str.matchAll(/"([^"]+)"/gu)(body)), (match) => match[1] ?? "")),
        O.getOrElse(() => A.empty<string>()),
        A.sort(Order.String)
      );
      deepStrictEqual(declared, derived);
      expect(A.length(derived)).toBeGreaterThan(0);
    })
  );
});
