import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import shardPlan from "../vitest.shards.json" with { type: "json" };

/** The sequencer's lookup (root `vitest.shared.ts`), restated here because the test tsconfig stops at the package root. */
const plannedShardIndex = (
  plan: { readonly shards: ReadonlyArray<ReadonlyArray<string>> },
  file: string
): O.Option<number> =>
  A.findFirstIndex(plan.shards, (entries) => A.contains(entries, file)).pipe(O.map((index) => index + 1));
const relativeImportPattern = /from "(\.\.?\/[A-Za-z0-9_./-]+\.ts)"/gu;
const clockSubstitutePattern = /makeCitationNative(?:Manual|Sleep|Wall)Clock|TestClock/u;
const nativeSpawnerFixtures = "test/CitationNativeSpawner.fixtures.ts";

/**
 * Every test and fixture source under `test/`, keyed by package-relative path. Vite inlines the
 * checked-in sources at transform time (`test/support/vite-env.d.ts`); `fixtureClosure` follows only
 * `*.fixtures.ts` imports, so tests and fixtures are the whole closure.
 */
const testSources: HashMap.HashMap<string, string> = pipe(
  import.meta.glob<string>(["./**/*.test.ts", "./**/*.test.tsx", "./**/*.fixtures.ts"], {
    eager: true,
    import: "default",
    query: "?raw",
  }),
  R.toEntries,
  A.map(([file, text]) => [`test/${Str.slice(Str.length("./"))(file)}`, text] as const),
  HashMap.fromIterable
);

/** The package's `vitest.config.ts` text, which declares the native-wallclock project. */
const vitestConfig = pipe(
  import.meta.glob<string>("../vitest.config.ts", { eager: true, import: "default", query: "?raw" }),
  R.values,
  A.join("")
);

/** This module's package-relative path, read from its own URL so a rename cannot leave it stale. */
const packageRootSegment = "packages/law-practice/server/";
const selfFile = pipe(
  Str.indexOf(packageRootSegment)(import.meta.url),
  O.map((index) => Str.slice(index + Str.length(packageRootSegment))(import.meta.url)),
  O.getOrElse(() => import.meta.url)
);

/**
 * Every test file under `test/`, sorted. Vite's glob never matches the importing module, so this
 * file (which spawns nothing and imports no fixtures) is added back from its own URL.
 */
const testFiles = pipe(
  HashMap.keys(testSources),
  A.fromIterable,
  A.append(selfFile),
  A.filter((file) => Str.endsWith(".test.ts")(file) || Str.endsWith(".test.tsx")(file)),
  A.sort(Order.String)
);

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
 * A unit file keeps the worker cap when its closure spawns real native workers and no file in the
 * closure (the spawner fixtures aside, which define the substitutes) installs a clock. Integration
 * files are capped wholesale (their canonical replays run `extractDeadline` on the real clock).
 */
const nativeWallclockUnitFiles = (sources: HashMap.HashMap<string, string>): ReadonlyArray<string> =>
  pipe(
    HashMap.keys(sources),
    A.fromIterable,
    A.filter(Str.endsWith(".test.ts")),
    A.filter((file) => !Str.startsWith("test/integration/")(file)),
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

const INTEGRATION_GLOB = "test/integration/**/*.test.{ts,tsx}";

describe("law-practice-server shard plan", () => {
  it("names every unit test file exactly once and nothing else", () => {
    // The coverage producer excludes `test/integration/**`; the integration lane is unsharded.
    const unit = A.filter(testFiles, (file) => !Str.startsWith("test/integration/")(file));
    const planned = A.flatten(shardPlan.shards);
    // Disjoint: a file is planned into at most one shard.
    strictEqual(A.length(planned), HashSet.size(HashSet.fromIterable(planned)));
    // No stale entries: every planned file still exists (a removed file would never be collected,
    // but a stale plan hides that the estimate no longer matches what the shard runs).
    deepStrictEqual(A.difference(planned, unit), []);
    // Union: a file the plan does not know (added after the source run) falls back to Vitest's
    // hash shard until `beep ci partitions rebalance --write --run <id>` refreshes the plan.
    const unplanned = A.difference(unit, planned);
    expect(
      A.length(unplanned),
      `${A.length(unplanned)} unit file(s) not in vitest.shards.json: ${A.join(unplanned, ", ")}`
    ).toBeLessThan(A.length(unit) / 10);
    strictEqual(A.length(shardPlan.estimatedMilliseconds), A.length(shardPlan.shards));
    expect(A.every(shardPlan.shards, A.isReadonlyArrayNonEmpty)).toBe(true);
    for (const file of planned) {
      // A planned file resolves to a one-based shard inside the plan (0 would mean "not planned").
      const index = O.getOrElse(plannedShardIndex(shardPlan, file), () => 0);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(A.length(shardPlan.shards));
    }
    assertNone(plannedShardIndex(shardPlan, "test/integration/CitationEngineCorpus.test.ts"));
  });

  it("keeps the native-wallclock project equal to the unit files that spawn workers on the real clock plus every integration file", () => {
    const derived = nativeWallclockUnitFiles(testSources);
    const declared = pipe(
      Str.match(/const nativeWallclockSuites = \[([\s\S]*?)\];/u)(vitestConfig),
      O.flatMapNullishOr((match) => match[1]),
      O.map((body) => A.map(A.fromIterable(Str.matchAll(/"([^"]+)"/gu)(body)), (match) => match[1] ?? "")),
      O.getOrElse(() => A.empty<string>()),
      A.sort(Order.String)
    );
    // Every integration file is capped wholesale; the unit entries must match the derivation exactly.
    assertTrue(A.contains(declared, INTEGRATION_GLOB));
    deepStrictEqual(
      A.filter(declared, (entry) => entry !== INTEGRATION_GLOB),
      derived
    );
    expect(A.length(derived)).toBeGreaterThan(0);
  });
});
