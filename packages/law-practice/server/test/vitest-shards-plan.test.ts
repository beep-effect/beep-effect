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

const plannedShardIndexRestatedFromVitestShared = (
  plan: { readonly shards: ReadonlyArray<ReadonlyArray<string>> },
  file: string
): O.Option<number> =>
  A.findFirstIndex(plan.shards, (entries) => A.contains(entries, file)).pipe(O.map((index) => index + 1));
const relativeImportPattern = /from "(\.\.?\/[A-Za-z0-9_./-]+\.ts)"/gu;
const clockSubstitutePattern = /makeCitationNative(?:Manual|Sleep|Wall)Clock|TestClock/u;
const nativeSpawnerFixtures = "test/CitationNativeSpawner.fixtures.ts";

const checkedInTestAndFixtureSources: HashMap.HashMap<string, string> = pipe(
  import.meta.glob<string>(["./**/*.test.ts", "./**/*.test.tsx", "./**/*.fixtures.ts"], {
    eager: true,
    import: "default",
    query: "?raw",
  }),
  R.toEntries,
  A.map(([file, text]) => [`test/${Str.slice(Str.length("./"))(file)}`, text] as const),
  HashMap.fromIterable
);

const vitestConfigText = pipe(
  import.meta.glob<string>("../vitest.config.ts", { eager: true, import: "default", query: "?raw" }),
  R.values,
  A.join("")
);

const packageRootSegment = "packages/law-practice/server/";
const selfFileMissedByOwnGlob = pipe(
  Str.indexOf(packageRootSegment)(import.meta.url),
  O.map((index) => Str.slice(index + Str.length(packageRootSegment))(import.meta.url)),
  O.getOrElse(() => import.meta.url)
);

const testFiles = pipe(
  HashMap.keys(checkedInTestAndFixtureSources),
  A.fromIterable,
  A.append(selfFileMissedByOwnGlob),
  A.filter((file) => Str.endsWith(".test.ts")(file) || Str.endsWith(".test.tsx")(file)),
  A.sort(Order.String)
);

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

// decision: native-wallclock-vitest-project
const nativeWallclockUnitFiles = (sources: HashMap.HashMap<string, string>): ReadonlyArray<string> =>
  pipe(
    HashMap.keys(sources),
    A.fromIterable,
    A.filter(Str.endsWith(".test.ts")),
    A.filter((file) => !Str.startsWith("test/integration/")(file)),
    A.filter((file) => {
      const closure = fixtureClosure(sources, file);
      const spawnsRealNativeWorkers = HashSet.has(closure, nativeSpawnerFixtures);
      const clockInstalledOutsideSpawnerFixtures = pipe(
        A.fromIterable(closure),
        A.some(
          (member) =>
            member !== nativeSpawnerFixtures &&
            clockSubstitutePattern.test(O.getOrElse(HashMap.get(sources, member), () => ""))
        )
      );
      return spawnsRealNativeWorkers && !clockInstalledOutsideSpawnerFixtures;
    }),
    A.sort(Order.String)
  );

const INTEGRATION_GLOB = "test/integration/**/*.test.{ts,tsx}";

describe("law-practice-server shard plan", () => {
  it("names every unit test file exactly once and nothing else", () => {
    const unit = A.filter(testFiles, (file) => !Str.startsWith("test/integration/")(file));
    const planned = A.flatten(shardPlan.shards);
    strictEqual(
      A.length(planned),
      HashSet.size(HashSet.fromIterable(planned)),
      "disjoint: a file is planned into at most one shard"
    );
    deepStrictEqual(
      A.difference(planned, unit),
      [],
      "stale plan entries: a removed file is never collected, but the plan estimate no longer matches what the shard runs"
    );
    const unplanned = A.difference(unit, planned);
    expect(
      A.length(unplanned),
      `${A.length(unplanned)} unit file(s) not in vitest.shards.json (hash-sharded until "beep ci partitions rebalance --write --run <id>" refreshes the plan): ${A.join(unplanned, ", ")}`
    ).toBeLessThan(A.length(unit) / 10);
    strictEqual(A.length(shardPlan.estimatedMilliseconds), A.length(shardPlan.shards));
    expect(A.every(shardPlan.shards, A.isReadonlyArrayNonEmpty)).toBe(true);
    for (const file of planned) {
      const index = O.getOrElse(plannedShardIndexRestatedFromVitestShared(shardPlan, file), () => 0);
      expect(index, "a planned file resolves to a one-based shard; 0 means not planned").toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(A.length(shardPlan.shards));
    }
    assertNone(plannedShardIndexRestatedFromVitestShared(shardPlan, "test/integration/CitationEngineCorpus.test.ts"));
  });

  it("keeps the native-wallclock project equal to the unit files that spawn workers on the real clock plus every integration file", () => {
    const derived = nativeWallclockUnitFiles(checkedInTestAndFixtureSources);
    const declared = pipe(
      Str.match(/const nativeWallclockSuites = \[([\s\S]*?)\];/u)(vitestConfigText),
      O.flatMapNullishOr((match) => match[1]),
      O.map((body) => A.map(A.fromIterable(Str.matchAll(/"([^"]+)"/gu)(body)), (match) => match[1] ?? "")),
      O.getOrElse(() => A.empty<string>()),
      A.sort(Order.String)
    );
    assertTrue(A.contains(declared, INTEGRATION_GLOB), "every integration file is capped wholesale");
    deepStrictEqual(
      A.filter(declared, (entry) => entry !== INTEGRATION_GLOB),
      derived,
      "the unit entries must match the derivation exactly"
    );
    expect(A.length(derived)).toBeGreaterThan(0);
  });
});
