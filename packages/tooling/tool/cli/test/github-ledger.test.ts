import { RateLimitObservation, RateLimitSnapshot } from "@beep/github/Resilience";
import {
  anchorsOf,
  BucketKey,
  BucketReading,
  BucketReadingJson,
  configStringOption,
  GhSpawnObservation,
  GITHUB_LEDGER_MAX_LINE_BYTES,
  GithubBudgetLedger,
  GithubIdentityConfigJson,
  GithubIdentityLabel,
  GithubLedgerCommand,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  GithubLedgerRow,
  GithubLedgerRowJson,
  GithubLedgerStore,
  HostLabel,
  hourOf,
  IdentityAliases,
  IdentityAliasesJson,
  identityOfObservation,
  LedgerHourRollup,
  LedgerHourRollupJson,
  LedgerRange,
  LedgerSummary,
  LedgerSummaryJson,
  LedgerWindow,
  LedgerWindowJson,
  lanesOf,
  layerGithubBudgetLedger,
  layerGithubLedgerStoreLive,
  layerGithubLedgerStoreMemory,
  makeGithubLedgerStoreLive,
  makeGithubLedgerStoreMemory,
  nominalCostOf,
  normalizeOperation,
  OperationCost,
  operationCostsOf,
  readingOfTransport,
  reserveOf,
  SampleBucket,
  windowsOf,
} from "@beep/repo-cli/test/SharedInternals";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { withLayer } from "./support/GithubLedgerFakes.ts";
import type { GitHubRateLimitResource } from "@beep/github/Resilience";

const T0 = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-10T14:00:00.000Z"));
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const at = (offsetMillis: number) => DateTime.makeUnsafe(T0 + offsetMillis);
const host = HostLabel.make("hub");
const alice = GithubIdentityLabel.make("user:alice");
const app = GithubIdentityLabel.make("app:1/2");
const tokenLabel = GithubIdentityLabel.make("token:aaaaaaaaaaaa");
const beep = GithubLedgerCommandLabel.make("beep");
const monitor = GithubLedgerCommandLabel.make("yeet monitor");
const key = (identity: GithubIdentityLabel, resource: GitHubRateLimitResource) =>
  BucketKey.make({ identity, resource });

const observation = (options: {
  readonly at: DateTime.Utc;
  readonly budgetLabel?: string;
  readonly credential?: RateLimitObservation["credential"];
  readonly operation?: string;
  readonly kind?: RateLimitObservation["kind"];
  readonly status?: number;
  readonly outcome?: RateLimitObservation["outcome"];
  readonly resource?: GitHubRateLimitResource;
  readonly remaining?: number;
  readonly used?: number;
  readonly reset?: number;
}) =>
  RateLimitObservation.make({
    snapshot: RateLimitSnapshot.make({
      remaining: options.remaining ?? 4000,
      limit: 5000,
      resetEpochSeconds: options.reset ?? (T0 + HOUR) / 1000,
      resource: options.resource ?? "core",
      used: O.fromUndefinedOr(options.used),
    }),
    budgetLabel: O.fromUndefinedOr(options.budgetLabel),
    credential: options.credential ?? "token",
    operation: options.operation ?? "GET /repos/o/r/pulls",
    kind: options.kind ?? "rest",
    status: options.status ?? 200,
    outcome: options.outcome ?? "ok",
    at: options.at,
  });

const transportRow = (options: {
  readonly at: DateTime.Utc;
  readonly identity?: GithubIdentityLabel;
  readonly resource?: GitHubRateLimitResource;
  readonly kind?: "rest" | "graphql";
  readonly operation?: string;
  readonly used: number;
  readonly reset?: number;
  readonly pid?: number;
  readonly command?: GithubLedgerCommandLabel;
  readonly nominalCost?: number;
}) =>
  GithubLedgerRow.cases.Transport.make({
    at: options.at,
    host,
    command: options.command ?? beep,
    identity: options.identity ?? alice,
    resource: options.resource ?? "graphql",
    kind: options.kind ?? "graphql",
    operation: options.operation ?? "PullRequestThreads",
    status: 200,
    outcome: "ok",
    limit: 5000,
    remaining: 5000 - options.used,
    used: O.some(options.used),
    resetAt: DateTime.makeUnsafe(options.reset ?? T0 + HOUR),
    nominalCost: options.nominalCost ?? 1,
    pid: options.pid ?? 100,
  });

const sampleRow = (options: {
  readonly at: DateTime.Utc;
  readonly identity?: GithubIdentityLabel;
  readonly used: number;
  readonly reset?: number;
  readonly resource?: GitHubRateLimitResource;
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
        resource: options.resource ?? "core",
        limit: 5000,
        used: options.used,
        remaining: 5000 - options.used,
        resetAt: DateTime.makeUnsafe(options.reset ?? T0 + HOUR),
      }),
    ],
  });

const reading = (options: {
  readonly key: BucketKey;
  readonly remaining: number;
  readonly asOf: number;
  readonly reset?: number;
  readonly basis?: "transport" | "sample";
}) =>
  BucketReading.make({
    key: options.key,
    limit: 5000,
    remaining: options.remaining,
    used: O.some(5000 - options.remaining),
    resetAt: DateTime.makeUnsafe(options.reset ?? T0 + HOUR),
    asOf: DateTime.makeUnsafe(options.asOf),
    basis: options.basis ?? "transport",
  });

const UnknownJson = S.fromJsonString(S.Unknown);
const memoryLedger = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreMemory));

const withStateRoot =
  (root: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(
      effect,
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: root })
    );

const liveLedger = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreLive));

describe("GithubLedger schemas", () => {
  it("normalizes operations to parameter-free routes", () => {
    expect(normalizeOperation("GET /repos/o/r/rules/branches/main")).toBe(
      "GET /repos/{owner}/{repo}/rules/branches/{name}"
    );
    expect(normalizeOperation("GET /repos/o/r/actions/runs/123456/jobs")).toBe(
      "GET /repos/{owner}/{repo}/actions/runs/{id}/jobs"
    );
    expect(normalizeOperation(`GET /repos/o/r/commits/${Str.repeat(40)("a")}`)).toBe(
      "GET /repos/{owner}/{repo}/commits/{sha}"
    );
    expect(normalizeOperation("GET /repos/{owner}/{repo}/pulls?per_page=100")).toBe("GET /repos/{owner}/{repo}/pulls");
    expect(normalizeOperation("PullRequestThreads")).toBe("PullRequestThreads");
    expect(normalizeOperation("query PullRequestThreads")).toBe("query PullRequestThreads");
  });

  it.effect("round-trips every persisted document through its JSON codec", () =>
    Effect.gen(function* () {
      const window = LedgerWindow.make({
        key: key(alice, "core"),
        lane: 0,
        from: at(0),
        to: at(5 * MINUTE),
        anchor: "sample",
        sameEpoch: true,
        delta: 12,
        crossesReset: false,
        resetLowerBound: 0,
        attributedNominal: 9,
        ghSpawns: 1,
      });
      const rollup = LedgerHourRollup.make({
        hour: at(0),
        host,
        complete: true,
        cells: [],
        keys: [],
        operationCosts: [OperationCost.make({ operation: "PullRequestThreads", points: 5, observations: 3 })],
        windows: [window],
      });
      const summary = LedgerSummary.make({
        generatedAt: at(0),
        spenders: [],
        unattributedLastHour: [],
        lastRowAt: O.some(at(1)),
      });
      const readingValue = reading({ key: key(alice, "graphql"), remaining: 4000, asOf: T0 });
      const aliases = IdentityAliases.make({ aliases: { "token:aaaaaaaaaaaa": alice } });
      const roundTrip = <A, I extends string>(codec: S.Codec<A, I>, value: A) =>
        S.encodeEffect(codec)(value).pipe(Effect.flatMap(S.decodeEffect(codec)));
      const value1 = yield* roundTrip(LedgerWindowJson, window);
      expect(value1).toStrictEqual(window);
      const value2 = yield* roundTrip(LedgerHourRollupJson, rollup);
      expect(value2).toStrictEqual(rollup);
      const value3 = yield* roundTrip(LedgerSummaryJson, summary);
      expect(value3).toStrictEqual(summary);
      const value4 = yield* roundTrip(BucketReadingJson, readingValue);
      expect(value4).toStrictEqual(readingValue);
      const value5 = yield* roundTrip(IdentityAliasesJson, aliases);
      expect(value5).toStrictEqual(aliases);
      const row = transportRow({ at: at(0), used: 5 });
      const value6 = yield* roundTrip(GithubLedgerRowJson, row);
      expect(value6).toStrictEqual(row);
    })
  );

  it.effect("rejects a raw token in identities.json", () =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(UnknownJson)({
        schemaVersion: "github-identities/v1",
        identities: [{ _tag: "OpRef", tokenRef: `ghp_${Str.repeat(36)("x")}`, login: "alice" }],
      });
      const exit = yield* Effect.exit(S.decodeEffect(GithubIdentityConfigJson)(text));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it("fixes nominal costs at record time", () => {
    expect(nominalCostOf({ status: 304, outcome: "not-modified", operation: "GET /x" })).toBe(0);
    expect(nominalCostOf({ status: 200, outcome: "ok", operation: "GET /rate_limit" })).toBe(0);
    expect(nominalCostOf({ status: 403, outcome: "rate-limited", operation: "GET /x" })).toBe(0);
    expect(nominalCostOf({ status: 403, outcome: "secondary-limited", operation: "GET /x" })).toBe(1);
    expect(nominalCostOf({ status: 200, outcome: "ok", operation: "PullRequestThreads" })).toBe(1);
  });

  it("composes row identities from credential and label", () => {
    const aliases = IdentityAliases.make({ aliases: { "token:aaaaaaaaaaaa": alice } });
    const label = (budgetLabel: string | undefined, credential: RateLimitObservation["credential"]) =>
      identityOfObservation(
        observation({ at: at(0), credential, ...(budgetLabel === undefined ? {} : { budgetLabel }) }),
        aliases
      );
    expect(label(undefined, "unauthenticated")).toBe("anonymous");
    expect(label("app:1/2", "app-jwt")).toBe("app:1/2/jwt");
    expect(label("user:alice", "app-jwt")).toBe("unresolved");
    expect(label("token:aaaaaaaaaaaa", "token")).toBe("user:alice");
    expect(label("app:1/2", "token")).toBe("app:1/2");
    expect(label("ghp_secret", "token")).toBe("unresolved");
    expect(label(undefined, "token")).toBe("unresolved");
  });
});

describe("GithubLedger codecs", () => {
  it.effect.prop(
    "round-trips any persisted row and bucket reading through its JSON codec",
    [Arbitrary.schema(GithubLedgerRow), Arbitrary.schema(BucketReading)],
    Effect.fnUntraced(function* ([row, bucket]) {
      const rowText = yield* S.encodeEffect(GithubLedgerRowJson)(row);
      const rowBack = yield* S.decodeEffect(GithubLedgerRowJson)(rowText);
      const rowAgain = yield* S.encodeEffect(GithubLedgerRowJson)(rowBack);
      expect(rowAgain).toBe(rowText);
      const bucketText = yield* S.encodeEffect(BucketReadingJson)(bucket);
      const bucketBack = yield* S.decodeEffect(BucketReadingJson)(bucketText);
      const bucketAgain = yield* S.encodeEffect(BucketReadingJson)(bucketBack);
      expect(bucketAgain).toBe(bucketText);
    }),
    { arbitrary: fcRuns(24) }
  );
});

describe("GithubLedger reserve", () => {
  const now = DateTime.makeUnsafe(T0 + 10 * MINUTE);
  const graphqlAlice = key(alice, "graphql");

  it("is Below under ceil(15%) and Clear at it", () => {
    const below = reserveOf({ now, admitGraphqlSamples: false })(graphqlAlice, [
      reading({ key: graphqlAlice, remaining: 749, asOf: T0 + 9 * MINUTE }),
    ]);
    const clear = reserveOf({ now, admitGraphqlSamples: false })(graphqlAlice, [
      reading({ key: graphqlAlice, remaining: 750, asOf: T0 + 9 * MINUTE }),
    ]);
    expect(below.state._tag).toBe("Below");
    expect(clear.state._tag).toBe("Clear");
  });

  it("is unknown when stale, rolled over, missing or uncalibrated", () => {
    const signal = (readings: ReadonlyArray<BucketReading>, admit = false, target = graphqlAlice) =>
      reserveOf({ now, admitGraphqlSamples: admit })(target, readings).state;
    expect(signal([reading({ key: graphqlAlice, remaining: 100, asOf: T0 - MINUTE })])).toMatchObject({
      _tag: "Unknown",
      reason: "stale",
    });
    expect(
      signal([reading({ key: graphqlAlice, remaining: 100, asOf: T0 + 9 * MINUTE, reset: T0 + 5 * MINUTE })])
    ).toMatchObject({ _tag: "Unknown", reason: "window-reset" });
    expect(signal([])).toMatchObject({ _tag: "Unknown", reason: "no-reading" });
    const sampled = [reading({ key: graphqlAlice, remaining: 100, asOf: T0 + 9 * MINUTE, basis: "sample" })];
    expect(signal(sampled)).toMatchObject({ _tag: "Unknown", reason: "uncalibrated" });
    expect(signal(sampled, true)).toMatchObject({ _tag: "Below" });
  });

  it("never mixes two identities", () => {
    const readings = [
      reading({ key: graphqlAlice, remaining: 10, asOf: T0 + 9 * MINUTE }),
      reading({ key: key(app, "graphql"), remaining: 4000, asOf: T0 + 9 * MINUTE }),
    ];
    expect(reserveOf({ now, admitGraphqlSamples: false })(graphqlAlice, readings).state._tag).toBe("Below");
    expect(reserveOf({ now, admitGraphqlSamples: false })(key(app, "graphql"), readings).state._tag).toBe("Clear");
  });
});

describe("GithubLedger windows", () => {
  const coreAlice = key(alice, "core");

  it("keeps an idle bucket in one lane and flags a real reset with a peak-bounded lower bound", () => {
    const idle = [
      sampleRow({ at: at(0), used: 0, reset: T0 + HOUR }),
      sampleRow({ at: at(5 * MINUTE), used: 0, reset: T0 + HOUR + 5 * MINUTE }),
      sampleRow({ at: at(10 * MINUTE), used: 4, reset: T0 + HOUR + 10 * MINUTE }),
    ];
    expect(lanesOf(anchorsOf({ key: coreAlice, rows: idle, admitGraphqlSamples: false })).length).toBe(1);
    expect(
      A.some(windowsOf({ key: coreAlice, rows: idle, admitGraphqlSamples: false }), (window) => window.crossesReset)
    ).toBe(false);

    const jitter = [
      sampleRow({ at: at(0), used: 10, reset: T0 + HOUR }),
      sampleRow({ at: at(5 * MINUTE), used: 20, reset: T0 + HOUR + 3000 }),
    ];
    expect(lanesOf(anchorsOf({ key: coreAlice, rows: jitter, admitGraphqlSamples: false })).length).toBe(1);

    const reset = [
      sampleRow({ at: at(0), used: 100, reset: T0 + 10 * MINUTE }),
      transportRow({ at: at(4 * MINUTE), resource: "core", kind: "rest", used: 130, reset: T0 + 10 * MINUTE + 2000 }),
      sampleRow({ at: at(15 * MINUTE), used: 7, reset: T0 + 70 * MINUTE }),
    ];
    const [window] = windowsOf({ key: coreAlice, rows: reset, admitGraphqlSamples: false });
    expect(window?.crossesReset).toBe(true);
    expect(window?.resetLowerBound).toBe(7 + 30);
  });

  it("telescopes an hour instead of summing floored deltas, and counts a window in the hour of its end", () => {
    const rows = [
      sampleRow({ at: at(0), used: 100 }),
      sampleRow({ at: at(5 * MINUTE), used: 140 }),
      sampleRow({ at: at(10 * MINUTE), used: 137 }),
      sampleRow({ at: at(15 * MINUTE), used: 147 }),
      sampleRow({ at: at(HOUR + 5 * MINUTE), used: 150 }),
    ];
    const windows = windowsOf({ key: coreAlice, rows, admitGraphqlSamples: false });
    const first = hourOf({ hour: at(0), key: coreAlice, rows, windows, costs: [] });
    assertSome(first.fleetUsed, 47);
    const second = hourOf({ hour: at(HOUR), key: coreAlice, rows, windows, costs: [] });
    assertSome(second.fleetUsed, 3);
  });

  it("estimates GraphQL operation cost as the minimum same-process delta", () => {
    const rows = [
      transportRow({ at: at(0), used: 10, operation: "Other" }),
      transportRow({ at: at(1000), used: 17 }),
      transportRow({ at: at(2000), used: 22 }),
      transportRow({ at: at(3000), used: 31 }),
      transportRow({ at: at(1500), used: 18, pid: 200, operation: "Lonely" }),
      transportRow({ at: at(2500), used: 40, pid: 300, operation: "Lonely" }),
    ];
    const costs = operationCostsOf(rows);
    const pointsOf = (operation: string) =>
      A.findFirst(costs, (cost) => cost.operation === operation).pipe(O.map((cost) => cost.points));
    assertSome(pointsOf("PullRequestThreads"), 5);
    assertSome(pointsOf("Lonely"), 1);
  });

  it("attributes estimated points, gh spawns and the unattributed remainder", () => {
    const rows = [
      sampleRow({ at: at(0), used: 100 }),
      transportRow({
        at: at(MINUTE),
        resource: "core",
        kind: "rest",
        used: 101,
        operation: "GET /a",
        command: monitor,
      }),
      transportRow({
        at: at(2 * MINUTE),
        resource: "core",
        kind: "rest",
        used: 102,
        operation: "GET /b",
        command: monitor,
      }),
      GithubLedgerRow.cases.GhSpawn.make({
        at: at(3 * MINUTE),
        host,
        command: monitor,
        identity: alice,
        subcommand: "run view",
        resource: "core",
        exitCode: 0,
        durationMillis: 10,
      }),
      sampleRow({ at: at(5 * MINUTE), used: 110 }),
    ];
    const windows = windowsOf({ key: coreAlice, rows, admitGraphqlSamples: false });
    const hour = hourOf({ hour: at(0), key: coreAlice, rows, windows, costs: operationCostsOf(rows) });
    assertSome(hour.fleetUsed, 10);
    expect(hour.estimatedPoints).toBe(2);
    expect(hour.ghEstimated).toBe(1);
    assertSome(hour.unattributed, 7);
    expect(hour.overAttributed).toBe(false);
    expect(A.map(hour.byCommand, (spend) => [spend.command, spend.requests, spend.ghSpawns])).toStrictEqual([
      ["yeet monitor", 2, 1],
    ]);
  });
});

describe("GithubBudgetLedger over memory", () => {
  it.layer(memoryLedger, { timeout: "30 seconds" })((it) => {
    it.effect("records a transport row with the requesting fiber's command", () =>
      Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const store = yield* GithubLedgerStore;
        yield* ledger
          .recordTransport(
            observation({
              at: at(MINUTE),
              budgetLabel: "user:alice",
              operation: "GET /repos/o/r/actions/runs/42",
              used: 1000,
              remaining: 4000,
            })
          )
          .pipe(Effect.provideService(GithubLedgerCommand, monitor));
        const rows = yield* store.rows(LedgerRange.make({ from: at(0), to: at(HOUR) }));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          _tag: "Transport",
          host: "hub",
          command: "yeet monitor",
          identity: "user:alice",
          resource: "core",
          operation: "GET /repos/{owner}/{repo}/actions/runs/{id}",
          limit: 5000,
          remaining: 4000,
          nominalCost: 1,
        });
        assertSome(rows[0]?._tag === "Transport" ? rows[0].used : O.none(), 1000);
      })
    );

    it.effect("records a rate-limited attempt at nominal cost 0", () =>
      Effect.gen(function* () {
        const ledger = yield* GithubBudgetLedger;
        const store = yield* GithubLedgerStore;
        yield* ledger.recordTransport(
          observation({
            at: at(2 * HOUR),
            budgetLabel: "user:alice",
            status: 403,
            outcome: "rate-limited",
            remaining: 0,
          })
        );
        const rows = yield* store.rows(LedgerRange.make({ from: at(2 * HOUR - 1), to: at(2 * HOUR) }));
        expect(A.map(rows, (row) => (row._tag === "Transport" ? row.nominalCost : -1))).toStrictEqual([0]);
      })
    );
  });

  it.layer(memoryLedger, { timeout: "30 seconds" })((it) => {
    it.effect("joins token-hash rows to their owner once the alias exists", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(T0 + 2 * MINUTE);
        const ledger = yield* GithubBudgetLedger;
        const store = yield* GithubLedgerStore;
        yield* ledger.recordTransport(
          observation({ at: at(MINUTE), budgetLabel: tokenLabel, kind: "graphql", resource: "graphql", remaining: 100 })
        );
        yield* ledger.recordAlias(tokenLabel, alice);
        const signal = yield* ledger.reserve(key(alice, "graphql"));
        expect(signal.state._tag).toBe("Below");
        yield* ledger.recordTransport(
          observation({ at: at(MINUTE + 1000), budgetLabel: tokenLabel, kind: "graphql", resource: "graphql" })
        );
        const rows = yield* store.rows(LedgerRange.make({ from: at(0), to: at(HOUR) }));
        expect(A.map(rows, (row) => row.identity)).toStrictEqual(["token:aaaaaaaaaaaa", "user:alice"]);
      })
    );
  });

  it.effect("absorbs a failing store and a dying store on the write side", () =>
    Effect.gen(function* () {
      const base = yield* makeGithubLedgerStoreMemory;
      const failing = Layer.succeed(GithubLedgerStore, {
        ...base,
        append: Effect.fnUntraced(function* () {
          return yield* GithubLedgerError.make({ reason: "write", detail: "read-only" });
        }),
      });
      const dying = Layer.succeed(GithubLedgerStore, {
        ...base,
        append: Effect.fnUntraced(function* () {
          return yield* Effect.die("boom");
        }),
      });
      const record = Effect.fnUntraced(function* (store: Layer.Layer<GithubLedgerStore>) {
        return yield* GithubBudgetLedger.use((ledger) =>
          ledger.recordTransport(observation({ at: at(0), budgetLabel: "user:alice" }))
        ).pipe(withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provide(store))), Effect.exit);
      });
      const exits = yield* Effect.forEach([failing, dying], record);
      expect(A.map(exits, Exit.isSuccess)).toStrictEqual([true, true]);
    })
  );

  it.effect("rejects a row over the line cap and keeps the largest legitimate sample under it", () =>
    Effect.gen(function* () {
      const store = yield* GithubLedgerStore;
      const resources: A.NonEmptyReadonlyArray<GitHubRateLimitResource> = [
        "core",
        "graphql",
        "search",
        "code_search",
        "source_import",
        "integration_manifest",
        "code_scanning_upload",
        "code_scanning_autofix",
        "actions_runner_registration",
        "scim",
        "dependency_snapshots",
        "dependency_sbom",
        "audit_log",
        "audit_log_streaming",
        "copilot_usage_records",
      ];
      const big = 9_999_999_999;
      const largest = GithubLedgerRow.cases.Sample.make({
        at: at(0),
        host: HostLabel.make(Str.repeat(63)("h")),
        command: GithubLedgerCommandLabel.make(`${Str.repeat(32)("a")} ${Str.repeat(32)("b")} ${Str.repeat(32)("c")}`),
        identity: GithubIdentityLabel.make(`user:${Str.repeat(39)("z")}`),
        trigger: "monitor-pause",
        selfCost: "confirmed-free",
        buckets: A.map(resources, (resource) =>
          SampleBucket.make({ resource, limit: big, used: big, remaining: big, resetAt: at(0) })
        ),
      });
      const line = yield* S.encodeEffect(GithubLedgerRowJson)(largest);
      expect(new TextEncoder().encode(line).length).toBeLessThan(GITHUB_LEDGER_MAX_LINE_BYTES);
      yield* store.append(largest);
      const huge = GithubLedgerRow.cases.Sample.make({
        ...largest,
        buckets: A.flatMap(A.range(1, 4), () => largest.buckets),
      });
      const error = yield* Effect.flip(store.append(huge));
      expect(error.reason).toBe("write");
    }).pipe(withLayer(layerGithubLedgerStoreMemory))
  );

  it.effect("reads the raw hours once per prune however many hours are still incomplete", () =>
    Effect.gen(function* () {
      const base = yield* makeGithubLedgerStoreMemory;
      const reads = yield* Ref.make(0);
      const counting = Layer.succeed(GithubLedgerStore, {
        ...base,
        rows: Effect.fn("GithubLedgerTest.countingRows")(function* (range) {
          yield* Ref.update(reads, (count) => count + 1);
          return yield* base.rows(range);
        }),
      });
      // A graphql anchor in each of five hours with no rollup yet; the last has no later anchor.
      yield* Effect.forEach(
        A.range(0, 4),
        (hour) => base.append(transportRow({ at: at(hour * HOUR + MINUTE), used: 10 + hour })),
        { discard: true }
      );
      yield* TestClock.setTime(T0 + 5 * HOUR + 20 * MINUTE);
      yield* GithubBudgetLedger.use((ledger) => ledger.prune).pipe(
        withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provide(counting)))
      );
      // One read for the hours' context, one for the summary's last hour.
      const readCount = yield* Ref.get(reads);
      expect(readCount).toBe(2);
      const first = yield* base.readRollup(at(0));
      assertSome(
        O.map(first, (rollup) => rollup.complete),
        true
      );
      const last = yield* base.readRollup(at(4 * HOUR));
      assertNone(last);
    })
  );

  it.effect("judges graphql calibration from the calibration file, never from raw rows", () =>
    Effect.gen(function* () {
      const base = yield* makeGithubLedgerStoreMemory;
      const latestOnly = Layer.succeed(GithubLedgerStore, {
        ...base,
        rows: Effect.fn("GithubLedgerTest.rawRowsRead")(function* () {
          return yield* Effect.die("the read side read raw rows");
        }),
        rowHours: Effect.die("the read side listed raw hours"),
      });
      yield* TestClock.setTime(T0 + MINUTE);
      yield* base.writeLatestSample(sampleRow({ at: at(0), used: 100, resource: "graphql" }));
      const signalOf = GithubBudgetLedger.use((ledger) => ledger.reserve(key(alice, "graphql"))).pipe(
        withLayer(layerGithubBudgetLedger({ host }).pipe(Layer.provide(latestOnly)))
      );
      const before = yield* signalOf;
      expect(before.state).toMatchObject({ _tag: "Unknown", reason: "uncalibrated" });
      yield* Effect.forEach(
        A.range(1, 6),
        (index) =>
          base.appendCalibration(
            GithubLedgerRow.cases.Calibration.make({
              at: at(-index * HOUR),
              host,
              identity: alice,
              restUsed: 100,
              restRemaining: 4900,
              restResetAt: at(HOUR),
              graphqlUsed: 104,
              graphqlRemaining: 4896,
              graphqlResetAt: at(HOUR),
              graphqlCost: 1,
              spanMillis: 150,
            })
          ),
        { discard: true }
      );
      const after = yield* signalOf;
      expect(after.state._tag).toBe("Clear");
    })
  );
});

describe("GithubLedger file store", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })((it) => {
    it.effect("writes private files, partitions by hour and skips torn lines", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-" });
        yield* Effect.gen(function* () {
          const store = yield* makeGithubLedgerStoreLive;
          yield* store.append(transportRow({ at: at(59 * MINUTE + 59_900), used: 1 }));
          yield* store.append(transportRow({ at: at(HOUR), used: 2 }));
          yield* store.writeLatestTransport(readingOfTransport(transportRow({ at: at(0), used: 1 })));
          yield* store.writeAlias(tokenLabel, alice);
          const files = yield* fs.readDirectory(path.join(root, "rows"));
          expect(A.sort(files, Str.Order)).toStrictEqual(["2026-11-10T14.jsonl", "2026-11-10T15.jsonl"]);
          const rowsMode = (yield* fs.stat(path.join(root, "rows"))).mode & 0o777;
          const fileMode = (yield* fs.stat(path.join(root, "rows", "2026-11-10T14.jsonl"))).mode & 0o777;
          const aliasMode = (yield* fs.stat(path.join(root, "aliases.json"))).mode & 0o777;
          expect([rowsMode, fileMode, aliasMode]).toStrictEqual([0o700, 0o600, 0o600]);
          yield* fs.writeFileString(path.join(root, "rows", "2026-11-10T14.jsonl"), '{"_tag":"Transp\n', { flag: "a" });
          const rows = yield* store.rows(LedgerRange.make({ from: at(-1), to: at(2 * HOUR) }));
          expect(rows).toHaveLength(2);
          const value7 = yield* store.readAliases;
          expect(value7).toStrictEqual(IdentityAliases.make({ aliases: { "token:aaaaaaaaaaaa": alice } }));
        }).pipe(withStateRoot(root));
      })
    );

    it.effect("maps a state-dir ConfigError to reason state-dir with the cause", () =>
      Effect.gen(function* () {
        const store = yield* makeGithubLedgerStoreLive;
        const error = yield* Effect.flip(store.append(transportRow({ at: at(0), used: 1 })));
        expect(error.reason).toBe("state-dir");
        expect(error.cause).toBeDefined();
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    );

    it.effect("keeps 1,000 lines whole from two concurrent fibers", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-fibers-" });
        yield* Effect.gen(function* () {
          const store = yield* makeGithubLedgerStoreLive;
          const writer = (pid: number) =>
            Effect.forEach(
              A.range(1, 500),
              (index) => store.append(transportRow({ at: at(index), used: index, pid })),
              {
                discard: true,
              }
            );
          yield* Effect.all([writer(1), writer(2)], { concurrency: 2 });
          const rows = yield* store.rows(LedgerRange.make({ from: at(-1), to: at(HOUR - 1) }));
          expect(rows).toHaveLength(1000);
        }).pipe(withStateRoot(root));
      })
    );

    it.effect("keeps 1,000 lines whole from two child processes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-procs-" });
        const line = yield* S.encodeEffect(GithubLedgerRowJson)(transportRow({ at: at(MINUTE), used: 1 }));
        const file = path.join(root, "rows", "2026-11-10T14.jsonl");
        yield* fs.makeDirectory(path.dirname(file), { recursive: true });
        const fixture = path.join(import.meta.dirname, "fixtures", "github-ledger-append-child.mjs");
        const child = () =>
          Effect.scoped(
            spawner.spawn(ChildProcess.make(process.execPath, [fixture, file, line, "500"])).pipe(
              Effect.flatMap((handle) =>
                Effect.all([handle.all.pipe(Stream.decodeText(), Stream.mkString), handle.exitCode], {
                  concurrency: "unbounded",
                })
              )
            )
          );
        const results = yield* Effect.all([child(), child()], { concurrency: 2 });
        expect(A.map(results, ([, code]) => code)).toStrictEqual([0, 0]);
        yield* Effect.gen(function* () {
          const store = yield* makeGithubLedgerStoreLive;
          const rows = yield* store.rows(LedgerRange.make({ from: at(0), to: at(HOUR - 1) }));
          expect(rows).toHaveLength(1000);
        }).pipe(withStateRoot(root));
      })
    );

    it.effect(
      "rolls up an hour once it is ripe, rewrites idle rollups, never rewrites a complete one, and applies retention",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-rollup-" });
          yield* Effect.gen(function* () {
            const ledger = yield* GithubBudgetLedger;
            const store = yield* GithubLedgerStore;
            yield* TestClock.setTime(T0 - 3 * 24 * HOUR - 2 * HOUR);
            yield* store.append(sampleRow({ at: DateTime.makeUnsafe(T0 - 3 * 24 * HOUR - 2 * HOUR), used: 1 }));
            yield* store.append(sampleRow({ at: at(5 * MINUTE), used: 10 }));
            yield* store.append(sampleRow({ at: at(50 * MINUTE), used: 20 }));
            yield* TestClock.setTime(T0 + HOUR + 10 * MINUTE);
            yield* ledger.prune;
            const value8 = yield* store.readRollup(at(0));
            assertNone(value8);
            yield* TestClock.setTime(T0 + 3 * HOUR);
            yield* ledger.prune;
            const idle = yield* store.readRollup(at(0));
            assertSome(
              O.map(idle, (rollup) => rollup.complete),
              false
            );
            yield* store.append(sampleRow({ at: at(3 * HOUR + MINUTE), used: 25 }));
            yield* TestClock.setTime(T0 + 3 * HOUR + 2 * MINUTE);
            yield* ledger.prune;
            const complete = yield* store.readRollup(at(0));
            assertSome(
              O.map(complete, (rollup) => rollup.complete),
              true
            );
            const file = path.join(root, "rollups", "2026-11-10T14.json");
            const before = yield* fs.readFileString(file);
            yield* store.append(sampleRow({ at: at(55 * MINUTE), used: 21 }));
            yield* ledger.prune;
            const value9 = yield* fs.readFileString(file);
            expect(value9).toBe(before);
            const hours = yield* store.rowHours;
            assertFalse(A.some(hours, (hour) => DateTime.toEpochMillis(hour) < T0 - 72 * HOUR));
            const summary = yield* ledger.summary;
            summary.pipe(O.isSome, assertTrue);
          }).pipe(withLayer(liveLedger), withStateRoot(root));
        })
    );

    it.effect("answers the read side from latest files with no resolution", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-read-" });
        yield* TestClock.setTime(T0 + MINUTE);
        yield* Effect.gen(function* () {
          const store = yield* makeGithubLedgerStoreLive;
          yield* store.writeLatestTransport(reading({ key: key(alice, "graphql"), remaining: 4000, asOf: T0 }));
          yield* store.writeLatestSample(sampleRow({ at: at(0), identity: app, used: 3 }));
        }).pipe(withStateRoot(root));
        // A fresh ledger in another "process": nothing in memory, a spawner that fails on use.
        yield* Effect.gen(function* () {
          const ledger = yield* GithubBudgetLedger;
          const latest = yield* ledger.latest(key(alice, "graphql"));
          assertSome(
            O.map(latest, (value) => value.remaining),
            4000
          );
          const reserves = yield* ledger.reserves;
          expect(
            A.map(reserves, (signal) => `${signal.key.identity}|${signal.key.resource}|${signal.state._tag}`)
          ).toStrictEqual(["user:alice|graphql|Clear", "app:1/2|core|Clear"]);
          const value10 = yield* ledger.summary;
          assertNone(value10);
          const value11 = yield* ledger.hours(LedgerRange.make({ from: at(0), to: at(MINUTE) }));
          expect(value11).toHaveLength(1);
        }).pipe(
          withLayer(liveLedger),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            ChildProcessSpawner.make(() => Effect.die("the read side must not spawn"))
          ),
          withStateRoot(root)
        );
      })
    );

    it.effect("drops latest readings older than 24 h and calibration pairs older than 7 days on prune", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-latest-" });
        yield* TestClock.setTime(T0);
        yield* Effect.gen(function* () {
          const ledger = yield* GithubBudgetLedger;
          const store = yield* GithubLedgerStore;
          // A reviewer App seen once a day ago, and the identity in use now.
          yield* store.writeLatestTransport(reading({ key: key(app, "core"), remaining: 4000, asOf: T0 - 25 * HOUR }));
          yield* store.writeLatestTransport(reading({ key: key(alice, "core"), remaining: 4000, asOf: T0 - MINUTE }));
          yield* store.writeLatestSample(sampleRow({ at: at(-25 * HOUR), identity: tokenLabel, used: 3 }));
          yield* store.writeLatestSample(sampleRow({ at: at(-MINUTE), used: 3 }));
          const pair = (offset: number) =>
            GithubLedgerRow.cases.Calibration.make({
              at: at(offset),
              host,
              identity: alice,
              restUsed: 100,
              restRemaining: 4900,
              restResetAt: at(HOUR),
              graphqlUsed: 104,
              graphqlRemaining: 4896,
              graphqlResetAt: at(HOUR),
              graphqlCost: 1,
              spanMillis: 150,
            });
          yield* store.appendCalibration(pair(-8 * 24 * HOUR));
          yield* store.appendCalibration(pair(-HOUR));
          yield* ledger.prune;
          const transports = yield* store.latestTransport;
          expect(A.map(transports, (value) => value.key.identity)).toStrictEqual(["user:alice"]);
          const samples = yield* store.latestSamples;
          expect(A.map(samples, (value) => value.identity)).toStrictEqual(["user:alice"]);
          const pairs = yield* store.calibrations;
          expect(A.map(pairs, (value) => DateTime.toEpochMillis(value.at))).toStrictEqual([T0 - HOUR]);
          const mode = (yield* fs.stat(path.join(root, "calibration.jsonl"))).mode & 0o777;
          expect(mode).toBe(0o600);
        }).pipe(withLayer(liveLedger), withStateRoot(root));
      })
    );

    it.effect("leaves no secret, home path or machine id in any ledger file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-secrets-" });
        const token = `ghp_${Str.repeat(3)("A1b2C3d4E5")}abcdef`;
        yield* Effect.gen(function* () {
          const ledger = yield* GithubBudgetLedger;
          yield* ledger.recordTransport(observation({ at: at(0), budgetLabel: tokenLabel }));
          yield* ledger.recordTransport(
            observation({ at: at(1000), budgetLabel: "user:alice", kind: "graphql", resource: "graphql" })
          );
          yield* ledger.recordSample(sampleRow({ at: at(2000), used: 5 }));
          yield* ledger.recordAlias(tokenLabel, alice);
          yield* ledger.ghSink.record(
            GhSpawnObservation.make({
              args: ["api", "repos/o/r/rules/branches/main"],
              exitCode: 0,
              durationMillis: 3,
              at: at(3000),
            })
          );
          yield* TestClock.setTime(T0 + 4 * HOUR);
          yield* ledger.prune;
        }).pipe(withLayer(liveLedger), withStateRoot(root));
        const files = yield* fs.readDirectory(root, { recursive: true });
        const texts = yield* Effect.forEach(
          A.filter(files, (file) => Str.endsWith(".json")(file) || Str.endsWith(".jsonl")(file)),
          (file) => fs.readFileString(path.join(root, file))
        );
        const all = A.join(texts, "\n");
        expect(all.length).toBeGreaterThan(0);
        expect(pipe(all, Str.includes(token))).toBe(false);
        expect(/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|Bearer/.test(all)).toBe(false);
        expect(pipe(all, Str.includes(root))).toBe(false);
        expect(pipe(all, Str.includes("repos/o/r/rules"))).toBe(false);
        const home = yield* configStringOption("HOME");
        expect(O.exists(home, (value) => pipe(all, Str.includes(value)))).toBe(false);
        const machineId = yield* fs.readFileString("/etc/machine-id").pipe(
          Effect.map(Str.trim),
          Effect.orElseSucceed(() => "")
        );
        if (Str.isNonEmpty(machineId)) expect(pipe(all, Str.includes(machineId))).toBe(false);
      })
    );
  });
});
