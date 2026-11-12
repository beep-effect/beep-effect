import { RateLimitObservation, RateLimitSnapshot } from "@beep/github/Resilience";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { writePrivateFile } from "@beep/repo-cli/test/Palantiri";
import {
  BucketKey,
  ConfiguredGithubIdentity,
  commandLabelOf,
  emptyIdentityAliases,
  epochsOf,
  GithubBudgetLedger,
  GithubConfiguredIdentities,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  GithubLedgerRow,
  GithubLedgerStore,
  GithubRateLimitSampler,
  ghSpawnFieldsOf,
  ghSpawnIdentity,
  HostLabel,
  hostLabelOf,
  hourOf,
  LedgerAnchor,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreMemory,
  makeGithubLedgerStoreMemory,
  normalizeOperation,
  OperationCost,
  readGithubIdentityConfig,
  resolveGithubIdentityLabel,
  rollupOf,
  SampleBucket,
  sourceOfRow,
  summaryOf,
  tokenHashLabel,
  UNRESOLVED_IDENTITY,
  withGithubLedger,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as TestClock from "effect/testing/TestClock";
import { scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";
import type { GitHubRateLimitResource, RateLimitOutcome } from "@beep/github/Resilience";

const T0 = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-10T14:00:00.000Z"));
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const at = (offsetMillis: number) => DateTime.makeUnsafe(T0 + offsetMillis);
const host = HostLabel.make("hub");
const alice = GithubIdentityLabel.make("user:alice");
const token = GithubIdentityLabel.make("token:aaaaaaaaaaaa");
const beep = GithubLedgerCommandLabel.make("beep");
const monitor = GithubLedgerCommandLabel.make("yeet monitor");
const coreAlice = BucketKey.make({ identity: alice, resource: "core" });

const transport = (options: {
  readonly at: DateTime.Utc;
  readonly used: number;
  readonly command: GithubLedgerCommandLabel;
  readonly nominalCost: number;
  readonly outcome?: RateLimitOutcome;
  readonly resource?: GitHubRateLimitResource;
}) =>
  GithubLedgerRow.cases.Transport.make({
    at: options.at,
    host,
    command: options.command,
    identity: alice,
    resource: options.resource ?? "core",
    kind: options.resource === "graphql" ? "graphql" : "rest",
    operation: options.resource === "graphql" ? "PullRequestThreads" : "GET /repos/{owner}/{repo}/pulls",
    status: options.outcome === "rate-limited" ? 403 : 200,
    outcome: options.outcome ?? "ok",
    limit: 5000,
    remaining: 5000 - options.used,
    used: O.some(options.used),
    resetAt: at(HOUR),
    nominalCost: options.nominalCost,
    pid: 100,
  });

const sample = (options: {
  readonly at: DateTime.Utc;
  readonly used: number;
  readonly reset: number;
  readonly identity?: GithubIdentityLabel;
}) =>
  GithubLedgerRow.cases.Sample.make({
    at: options.at,
    host,
    command: beep,
    identity: options.identity ?? alice,
    trigger: "timer",
    selfCost: "confirmed-free",
    buckets: [
      SampleBucket.make({
        resource: "core",
        limit: 5000,
        used: options.used,
        remaining: 5000 - options.used,
        resetAt: at(options.reset),
      }),
    ],
  });

const calibration = GithubLedgerRow.cases.Calibration.make({
  at: at(15 * MINUTE),
  host,
  identity: alice,
  restUsed: 100,
  restRemaining: 4900,
  restResetAt: at(HOUR),
  graphqlUsed: 104,
  graphqlRemaining: 4896,
  graphqlResetAt: at(HOUR),
  graphqlCost: 3,
  spanMillis: 150,
});

// Two same-epoch windows on either side of a reset-crossing window, three
// transports split across two commands (one free, one rate limited) and a
// calibration pairing.
const crossingRows = [
  sample({ at: at(5 * MINUTE), used: 100, reset: HOUR }),
  transport({ at: at(6 * MINUTE), used: 101, command: beep, nominalCost: 1, outcome: "rate-limited" }),
  transport({ at: at(7 * MINUTE), used: 101, command: monitor, nominalCost: 0 }),
  transport({ at: at(8 * MINUTE), used: 102, command: monitor, nominalCost: 1 }),
  sample({ at: at(10 * MINUTE), used: 200, reset: HOUR }),
  calibration,
  sample({ at: at(20 * MINUTE), used: 50, reset: 2 * HOUR }),
  sample({ at: at(30 * MINUTE), used: 80, reset: 2 * HOUR }),
];

const crossingRollup = (complete: boolean) =>
  rollupOf({ hour: at(0), host, complete, rows: crossingRows, admitGraphqlSamples: () => false });

const observation = (options: { readonly at: DateTime.Utc; readonly remaining: number }) =>
  RateLimitObservation.make({
    snapshot: RateLimitSnapshot.make({
      remaining: options.remaining,
      limit: 5000,
      resetEpochSeconds: (T0 + HOUR) / 1000,
      resource: "core",
      used: O.some(5000 - options.remaining),
    }),
    budgetLabel: O.some("user:alice"),
    credential: "token",
    operation: "GET /repos/o/r/pulls",
    kind: "rest",
    status: 200,
    outcome: "ok",
    at: options.at,
  });

const ledgerOver = (store: GithubLedgerStore["Service"]) =>
  withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provide(Layer.succeed(GithubLedgerStore, store))));

const isolatedEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

const identityConfigText =
  '{"schemaVersion":"github-identities/v1","identities":[{"_tag":"OpRef","tokenRef":"op://vault/bot/token","login":"beep-bot"}]}';

const anchor = (offset: number, used: number, reset: number) =>
  LedgerAnchor.make({ at: at(offset), used, resetAt: at(reset), anchor: "sample" });

describe("GithubLedger reducers", () => {
  it("splits anchors into epochs at a reset", () => {
    const first = anchor(0, 10, HOUR);
    const second = anchor(MINUTE, 20, HOUR);
    const afterReset = anchor(2 * MINUTE, 5, 2 * HOUR);
    expect(epochsOf([first, second, afterReset])).toStrictEqual([[first, second], [afterReset]]);
  });

  it("rolls up an hour whose windows cross a reset between two same-epoch runs", () => {
    const rollup = crossingRollup(true);
    const hours = A.map(rollup.keys, (hour) => ({
      key: hour.key,
      fleetUsed: hour.fleetUsed,
      fleetUsedIsLowerBound: hour.fleetUsedIsLowerBound,
      estimatedPoints: hour.estimatedPoints,
      unattributed: hour.unattributed,
    }));
    // 100 + 30 telescoped across the two runs, plus the 50 seen after the reset.
    expect(hours).toStrictEqual([
      {
        key: coreAlice,
        fleetUsed: O.some(180),
        fleetUsedIsLowerBound: true,
        estimatedPoints: 2,
        unattributed: O.some(178),
      },
    ]);
    // Equal points, so the busier command sorts first.
    const byCommand = A.flatMap(rollup.keys, (hour) =>
      A.map(hour.byCommand, (spend) => [spend.command, spend.requests, spend.estimatedPoints])
    );
    expect(byCommand).toEqual([
      ["yeet monitor", 2, 1],
      ["beep", 1, 1],
    ]);
    const cells = A.map(rollup.cells, (cell) => [
      cell.source,
      cell.resource,
      cell.command,
      cell.nominal,
      cell.rateLimited,
    ]);
    expect(cells).toContainEqual(["transport", "core", "beep", 1, 1]);
    expect(cells).toContainEqual(["transport", "core", "yeet monitor", 1, 0]);
    expect(cells).toContainEqual(["calibration", "graphql", "beep", 3, 0]);
  });

  it("summarizes the last complete hour's unattributed spend", () => {
    const summary = summaryOf({ now: at(HOUR), rows: crossingRows, lastComplete: O.some(crossingRollup(true)) });
    deepStrictEqual(
      A.map(summary.unattributedLastHour, (entry) => [entry.key, entry.unattributed]),
      [[coreAlice, O.some(178)]]
    );
    assertSome(summary.lastRowAt, at(30 * MINUTE));
  });

  it("prices a graphql transport at its nominal cost until its operation has a measured cost", () => {
    const graphqlKey = BucketKey.make({ identity: alice, resource: "graphql" });
    const rows = [transport({ at: at(MINUTE), used: 10, command: beep, nominalCost: 1, resource: "graphql" })];
    const unpriced = hourOf({ hour: at(0), key: graphqlKey, rows, windows: [], costs: [] });
    expect(unpriced.estimatedPoints).toBe(1);
    const priced = hourOf({
      hour: at(0),
      key: graphqlKey,
      rows,
      windows: [],
      costs: [OperationCost.make({ operation: "PullRequestThreads", points: 5, observations: 3 })],
    });
    expect(priced.estimatedPoints).toBe(5);
  });

  it("derives gh spawn subcommands and buckets from argv", () => {
    const fields = (args: ReadonlyArray<string>) => {
      const derived = ghSpawnFieldsOf(args);
      return [derived.subcommand, derived.resource];
    };
    expect(fields([])).toStrictEqual(["unknown", "unknown"]);
    expect(fields(["api", "graphql", "-f", "query=x"])).toStrictEqual(["api graphql", "graphql"]);
    expect(fields(["api", "--paginate", "search/issues"])).toStrictEqual(["api rest", "search"]);
    expect(fields(["api", "/repos/o/r/pulls"])).toStrictEqual(["api rest", "core"]);
    expect(fields(["api"])).toStrictEqual(["api rest", "core"]);
    expect(fields(["pr", "view", "12"])).toStrictEqual(["pr view", "graphql"]);
    expect(fields(["run", "--json"])).toStrictEqual(["run", "core"]);
    expect(fields(["auth", "status"])).toStrictEqual(["auth status", "unknown"]);
    expect(fields(["Weird"])).toStrictEqual(["unknown", "unknown"]);
  });
});

describe("GithubLedger schemas", () => {
  it("labels a hostname by its short lowercase name, else unknown-host", () => {
    expect(hostLabelOf("Hub.example.com")).toBe("hub");
    expect(hostLabelOf("")).toBe("unknown-host");
    expect(hostLabelOf("_bad_")).toBe("unknown-host");
  });

  it("bounds a long route at eight segments", () => {
    expect(normalizeOperation("GET /a/b/c/d/e/f/g/h/i/j?page=2")).toBe("GET /a/b/c/d/e/f/g/h/…");
  });

  it("names each row's source", () => {
    expect(A.map(crossingRows, sourceOfRow)).toStrictEqual([
      "sample",
      "transport",
      "transport",
      "transport",
      "sample",
      "calibration",
      "sample",
      "sample",
    ]);
  });
});

describe("GithubBudgetLedger service", () => {
  it.effect("keeps the newer reading and throttles the latest-file write for an out-of-order transport", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      yield* TestClock.setTime(T0 + 3 * MINUTE);
      const latest = yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        yield* ledger.recordTransport(observation({ at: at(2 * MINUTE), remaining: 4800 }));
        yield* ledger.recordTransport(observation({ at: at(MINUTE), remaining: 4900 }));
        // A distinct, older sample reading of the same bucket competes in the sort.
        yield* ledger.recordSample(sample({ at: at(MINUTE / 2), used: 50, reset: HOUR }));
        return yield* ledger.latest(coreAlice);
      }).pipe(ledgerOver(store));
      assertSome(
        O.map(latest, (reading) => [reading.remaining, reading.asOf]),
        [4800, at(2 * MINUTE)]
      );
      const written = yield* store.latestTransport;
      expect(A.map(written, (reading) => reading.remaining)).toStrictEqual([4800]);
    })
  );

  it.effect("reads an empty alias map when the alias file cannot be read", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      const aliases = yield* GithubBudgetLedger.use((ledger) => ledger.aliases).pipe(
        ledgerOver({
          ...store,
          readAliases: Effect.fail(GithubLedgerError.make({ reason: "read", detail: "unreadable aliases" })),
        })
      );
      expect(aliases).toStrictEqual(emptyIdentityAliases);
    })
  );

  it.effect("stores a sample under its token's resolved user and finds its time by either label", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      const found = yield* Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        yield* ledger.recordAlias(token, alice);
        yield* ledger.recordSample(sample({ at: at(MINUTE), used: 10, reset: HOUR, identity: token }));
        return [yield* ledger.lastSampleAt(token), yield* ledger.lastSampleAt(alice)] as const;
      }).pipe(ledgerOver(store));
      const samples = yield* store.latestSamples;
      expect(A.map(samples, (row) => row.identity)).toStrictEqual([alice]);
      assertSome(found[0], at(MINUTE));
      assertSome(found[1], at(MINUTE));
    })
  );

  it.effect("summarizes the previous hour only when its stored rollup is complete", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(T0 + HOUR + 30 * MINUTE);
      const summarize = Effect.fnUntraced(function* (complete: boolean) {
        const store = yield* makeGithubLedgerStoreMemory;
        yield* store.writeRollup(crossingRollup(complete));
        yield* GithubBudgetLedger.use((ledger) => ledger.prune).pipe(ledgerOver(store));
        const summary = yield* store.readSummary;
        return O.map(summary, (value) => A.map(value.unattributedLastHour, (entry) => entry.unattributed));
      });
      const complete = yield* summarize(true);
      assertSome(complete, [O.some(178)]);
      const incomplete = yield* summarize(false);
      assertSome(incomplete, []);
    })
  );
});

const identitiesFs = Layer.mergeAll(
  MemoryFileSystem.layerWith({
    "/config/beep/github/identities.json": identityConfigText,
    "/identities/valid.json": identityConfigText,
    "/identities/invalid.json": "{not json",
  }),
  Path.layer
);

describe("GitHub identity configuration", () => {
  it.layer(identitiesFs, { timeout: "30 seconds" })((it) => {
    it.effect("reads identities.json from the XDG config home", () =>
      Effect.gen(function* () {
        const identities = yield* readGithubIdentityConfig.pipe(isolatedEnv({ XDG_CONFIG_HOME: "/config" }));
        expect(identities).toStrictEqual([
          ConfiguredGithubIdentity.cases.OpRef.make({ tokenRef: "op://vault/bot/token", login: "beep-bot" }),
        ]);
      })
    );

    it.effect("fails with reason read when the identities path is not a file", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          readGithubIdentityConfig.pipe(isolatedEnv({ BEEP_GITHUB_IDENTITIES_FILE: "/config/beep/github" }))
        );
        expect(error.reason).toBe("read");
      })
    );
  });
});

describe("GitHub identity labels", () => {
  it.effect("labels gh children unresolved without an env token or a gh login", () =>
    Effect.gen(function* () {
      const { spawner, spawned } = scriptedSpawner({});
      const label = yield* ghSpawnIdentity(".").pipe(
        withLayer(Digest.layerWebCrypto),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        isolatedEnv({})
      );
      expect(label).toBe(UNRESOLVED_IDENTITY);
      expect(spawned).toStrictEqual(["gh config get -h github.com user"]);
      const fromEnv = yield* ghSpawnIdentity(".").pipe(
        withLayer(Digest.layerWebCrypto),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        isolatedEnv({ GITHUB_TOKEN: "fixture-env-token" })
      );
      const hash = yield* tokenHashLabel(Redacted.make("fixture-env-token")).pipe(withLayer(Digest.layerWebCrypto));
      expect(fromEnv).toBe(hash);
      expect(A.length(spawned)).toBe(1);
    })
  );

  it.effect("labels an incomplete App and a tokenless identity unresolved", () =>
    Effect.gen(function* () {
      const input = {
        tokenRef: O.none(),
        appId: O.some("12"),
        installationId: O.none(),
        token: O.none(),
        cwd: ".",
        transport: {},
      };
      const app = yield* resolveGithubIdentityLabel({ ...input, kind: "github-app" });
      assertSome(app, UNRESOLVED_IDENTITY);
      const tokenless = yield* resolveGithubIdentityLabel({ ...input, kind: "op-ref" });
      assertSome(tokenless, UNRESOLVED_IDENTITY);
    }).pipe(
      withLayer(
        Layer.merge(
          layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreMemory)),
          Digest.layerWebCrypto
        )
      ),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner({}).spawner),
      isolatedEnv({})
    )
  );
});

const deepRoot = Command.make("beep").pipe(
  Command.withSubcommands([
    Command.make("a").pipe(
      Command.withSubcommands([
        Command.make("b").pipe(
          Command.withSubcommands([Command.make("c").pipe(Command.withSubcommands([Command.make("d")]))])
        ),
      ])
    ),
  ])
);

describe("GithubLedgerRoot", () => {
  it("skips root flags, stops at --, and keeps at most three names", () => {
    expect(commandLabelOf(deepRoot, ["-v", "a", "b", "c", "d"])).toBe("a b c");
    expect(commandLabelOf(deepRoot, ["--", "a"])).toBe("beep");
    expect(commandLabelOf(deepRoot, ["--log-level", "debug", "a", "b"])).toBe("a b");
  });

  const rootServices = Layer.mergeAll(
    identitiesFs,
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner({}).spawner)
  );

  it.layer(rootServices, { timeout: "30 seconds" })((it) => {
    const probe = Effect.gen(function* () {
      const sampler = yield* Effect.serviceOption(GithubRateLimitSampler);
      const identities = yield* Effect.flatten(GithubConfiguredIdentities);
      return { sampled: O.isSome(sampler), identities: A.map(identities, (entry) => entry._tag) };
    });
    const memoryLedger = layerGithubBudgetLedger({ host }).pipe(Layer.provide(layerGithubLedgerStoreMemory));
    const run = (file: string) =>
      probe.pipe(
        withGithubLedger({ argv: ["a"], root: deepRoot, layer: memoryLedger }),
        isolatedEnv({ BEEP_GITHUB_IDENTITIES_FILE: file })
      );

    it.effect("binds a sampler-less ledger and reads configured identities, empty when unreadable", () =>
      Effect.gen(function* () {
        const configured = yield* run("/identities/valid.json");
        expect(configured).toStrictEqual({ sampled: false, identities: ["OpRef"] });
        const unreadable = yield* run("/identities/invalid.json");
        expect(unreadable).toStrictEqual({ sampled: false, identities: [] });
      })
    );
  });
});

const failingRename = MemoryFileSystem.layerFaulty({
  rename: (from) =>
    Effect.fail(
      PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "rename",
        pathOrDescriptor: from,
      })
    ),
}).pipe(Layer.provide(MemoryFileSystem.layerWith({})));

describe("writePrivateFile", () => {
  it.layer(Layer.merge(MemoryFileSystem.layerWith({}), Path.layer), { timeout: "30 seconds" })((it) => {
    it.effect("writes an owner-only file in an owner-only directory", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* writePrivateFile("/state/palantiri/hot.json", "{}");
        const written = yield* fs.readFileString("/state/palantiri/hot.json");
        expect(written).toBe("{}");
        const file = yield* fs.stat("/state/palantiri/hot.json");
        const directory = yield* fs.stat("/state/palantiri");
        expect([file.mode & 0o777, directory.mode & 0o777]).toStrictEqual([0o600, 0o700]);
        const entries = yield* fs.readDirectory("/state/palantiri");
        expect(entries).toStrictEqual(["hot.json"]);
      })
    );
  });

  it.layer(Layer.merge(failingRename, Path.layer), { timeout: "30 seconds" })((it) => {
    it.effect("removes its temporary file when the rename fails", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const error = yield* Effect.flip(writePrivateFile("/state/palantiri/hot.json", "{}"));
        expect(error.reason._tag).toBe("PermissionDenied");
        const entries = yield* fs.readDirectory("/state/palantiri");
        expect(entries).toStrictEqual([]);
      })
    );
  });
});
