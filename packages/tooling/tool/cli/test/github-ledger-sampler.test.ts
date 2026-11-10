import { GitHubClient } from "@beep/github/GitHubClient";
import {
  ConfiguredGithubIdentity,
  DEFAULT_COMMAND_LABEL,
  GithubBudgetIdentity,
  GithubBudgetLedger,
  GithubCalibrationOptions,
  GithubIdentityError,
  GithubIdentityLabel,
  GithubIdentityRegistry,
  GithubLedgerRow,
  GithubLedgerStore,
  GithubRateLimitSampler,
  GithubRateLimitSamplerOptions,
  GithubTransportFetch,
  HostLabel,
  LedgerRange,
  layerGithubBudgetLedger,
  layerGithubIdentityRegistryLive,
  layerGithubLedgerStoreLive,
  layerGithubLedgerStoreMemory,
  layerGithubRateLimitSampler,
  makeGithubLedgerStoreMemory,
  SampleBucket,
  tokenHashLabel,
} from "@beep/repo-cli/test/SharedInternals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { recordingFetch, scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";
import type { SampleOutcome } from "@beep/repo-cli/test/SharedInternals";

const encodeJson = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const toJson = (value: unknown): string => Result.getOrElse(encodeJson(value), () => "null");

const host = HostLabel.make("hub");
const alice = GithubIdentityLabel.make("user:alice");
const bob = GithubIdentityLabel.make("user:bob");
const appLabel = GithubIdentityLabel.make("app:1/2");

const bucket = (used: number, reset = 1_800_000_000) => ({ limit: 5000, used, remaining: 5000 - used, reset });

// A GitHub-shaped body: a valid extra bucket, an unknown bucket and a malformed known one.
const rateLimitBody = (coreUsed: number) =>
  toJson({
    resources: {
      core: bucket(coreUsed),
      graphql: bucket(40),
      search: { limit: 30, used: 1, remaining: 29, reset: 1_800_000_000 },
      novel_bucket: bucket(1),
      code_search: "oops",
    },
    rate: bucket(coreUsed),
  });

const rateLimitFetch = (coreUsed: (call: number) => number = () => 7) => {
  let call = 0;
  return recordingFetch((path) => {
    call += 1;
    return path === "/rate_limit"
      ? { status: 200, body: rateLimitBody(coreUsed(call)) }
      : { status: 404, body: toJson({ message: "not scripted" }) };
  });
};

const tokenClient = (fetch: typeof globalThis.fetch) =>
  GitHubClient.layerFromToken({ token: Redacted.make("fixture-token"), fetch });

const GH_CLI = ConfiguredGithubIdentity.cases.GhCli.make({});
const OP_REF = ConfiguredGithubIdentity.cases.OpRef.make({ tokenRef: "op://vault/bot/token", login: "bob" });
const APP = ConfiguredGithubIdentity.cases.GithubApp.make({
  appId: "1",
  installationId: 2,
  privateKeyRef: "op://vault/app/key",
});

interface StubEntry {
  readonly client: Layer.Layer<GitHubClient, GithubIdentityError>;
  readonly entry: ConfiguredGithubIdentity;
  readonly label: GithubIdentityLabel;
}

const stubRegistry = (entries: A.NonEmptyReadonlyArray<StubEntry>) => {
  const built: Array<string> = [];
  const find = (entry: ConfiguredGithubIdentity) =>
    A.findFirst(entries, (stub) => stub.entry._tag === entry._tag).pipe(
      O.getOrThrowWith(() => new Error(`unscripted entry ${entry._tag}`))
    );
  const layer = Layer.succeed(
    GithubIdentityRegistry,
    GithubIdentityRegistry.of({
      configured: Effect.succeed(A.map(entries, (stub) => stub.entry)),
      labelOf: Effect.fnUntraced(function* (entry) {
        return find(entry).label;
      }),
      clientFor: (entry) =>
        entry._tag === "GithubApp"
          ? Layer.effect(GitHubClient, Effect.die("an App client must never be built by sampleAll"))
          : Layer.unwrap(Effect.sync(() => built.push(entry._tag)).pipe(Effect.as(find(entry).client))),
    })
  );
  return { layer, built };
};

const samplerOver = (
  registry: Layer.Layer<GithubIdentityRegistry>,
  store: Layer.Layer<GithubLedgerStore> = layerGithubLedgerStoreMemory
) =>
  layerGithubRateLimitSampler(GithubRateLimitSamplerOptions.make({ host })).pipe(
    Layer.provideMerge(Layer.mergeAll(registry, layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(store))))
  );

const allRows = GithubLedgerStore.use((store) =>
  store.rows(LedgerRange.make({ from: DateTime.makeUnsafe(-1), to: DateTime.makeUnsafe(10 * 3_600_000) }))
);

const samplesOf = (rows: ReadonlyArray<GithubLedgerRow>) => A.filter(rows, GithubLedgerRow.guards.Sample);

const tags = (outcomes: ReadonlyArray<SampleOutcome>) => A.map(outcomes, (outcome) => outcome._tag);

describe("GithubRateLimitSampler.sampleAll", () => {
  it.effect("samples two configured identities, one Sample row and one latest file each", () =>
    Effect.gen(function* () {
      const aliceFetch = rateLimitFetch();
      const bobFetch = rateLimitFetch();
      const registry = stubRegistry([
        { entry: GH_CLI, label: alice, client: tokenClient(aliceFetch.fetch) },
        { entry: OP_REF, label: bob, client: tokenClient(bobFetch.fetch) },
      ]);
      yield* Effect.gen(function* () {
        const sampler = yield* GithubRateLimitSampler;
        const outcomes = yield* sampler.sampleAll("timer");
        expect(tags(outcomes)).toStrictEqual(["Sampled", "Sampled"]);
        const rows = yield* allRows;
        const samples = samplesOf(rows);
        expect(A.map(samples, (row) => [row.identity, row.trigger, row.selfCost])).toStrictEqual([
          ["user:alice", "timer", "confirmed-free"],
          ["user:bob", "timer", "confirmed-free"],
        ]);
        const latest = yield* GithubLedgerStore.use((store) => store.latestSamples);
        expect(A.map(latest, (row) => row.identity).sort()).toStrictEqual(["user:alice", "user:bob"]);
        expect([aliceFetch.count(), bobFetch.count()]).toStrictEqual([2, 2]);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );

  it.effect("skips an App entry before building its client and spends 2 reads per non-App identity", () =>
    Effect.gen(function* () {
      const aliceFetch = rateLimitFetch();
      const registry = stubRegistry([
        { entry: GH_CLI, label: alice, client: tokenClient(aliceFetch.fetch) },
        { entry: APP, label: appLabel, client: Layer.effect(GitHubClient, Effect.die("never")) },
      ]);
      yield* Effect.gen(function* () {
        const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer"));
        expect(outcomes[1]).toMatchObject({ _tag: "Skipped", identity: "app:1/2", reason: "app-needs-live-client" });
        expect(registry.built).toStrictEqual(["GhCli"]);
        expect(aliceFetch.count()).toBe(2);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );

  it.effect("reports a failing client as Failed and still samples the other identity", () =>
    Effect.gen(function* () {
      const aliceFetch = rateLimitFetch();
      const registry = stubRegistry([
        { entry: GH_CLI, label: alice, client: tokenClient(aliceFetch.fetch) },
        {
          entry: OP_REF,
          label: bob,
          client: Layer.effect(
            GitHubClient,
            Effect.fail(GithubIdentityError.make({ reason: "op-read-failed", message: "op did not return a token" }))
          ),
        },
      ]);
      yield* Effect.gen(function* () {
        const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("manual"));
        expect(tags(outcomes)).toStrictEqual(["Sampled", "Failed"]);
        expect(outcomes[1]).toMatchObject({ entry: "OpRef", identity: O.some(bob) });
        expect(outcomes[1]?._tag === "Failed" ? outcomes[1].detail : "").toContain("op-read-failed");
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );

  it.effect("keeps core, graphql and known decodable buckets and drops the rest", () =>
    Effect.gen(function* () {
      const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(rateLimitFetch().fetch) }]);
      yield* Effect.gen(function* () {
        yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("manual"));
        const rows = yield* allRows;
        const samples = samplesOf(rows);
        expect(A.map(samples[0]?.buckets ?? [], (entry) => entry.resource)).toStrictEqual([
          "core",
          "graphql",
          "search",
        ]);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );

  it.effect("marks a pair whose core.used moved between the reads as unconfirmed", () =>
    Effect.gen(function* () {
      // A concurrent request on the same client lands between the two reads.
      const moving = rateLimitFetch((call) => 7 + call);
      const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(moving.fetch) }]);
      yield* Effect.gen(function* () {
        const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("manual"));
        expect(outcomes[0]).toMatchObject({ _tag: "Sampled", selfCost: "unconfirmed" });
        const rows = yield* allRows;
        const samples = samplesOf(rows);
        expect(samples[0]?.buckets[0]?.used).toBe(9);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );

  it.effect("gives lease-held while another process holds a fresh lease, with no request", () =>
    Effect.gen(function* () {
      const aliceFetch = rateLimitFetch();
      const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(aliceFetch.fetch) }]);
      yield* Effect.gen(function* () {
        const store = yield* GithubLedgerStore;
        const outcomes = yield* Effect.scoped(
          Effect.andThen(
            store.acquireSamplerLease(alice),
            GithubRateLimitSampler.use((s) => s.sampleAll("timer"))
          )
        );
        expect(outcomes[0]).toMatchObject({ _tag: "Skipped", reason: "lease-held" });
        expect(aliceFetch.count()).toBe(0);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );

  it.effect("re-checks the due time after winning the lease", () =>
    Effect.gen(function* () {
      const aliceFetch = rateLimitFetch();
      const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(aliceFetch.fetch) }]);
      // Another process sampled while this one waited for the lease.
      const racedStore = Layer.effect(
        GithubLedgerStore,
        Effect.map(makeGithubLedgerStoreMemory, (store) =>
          GithubLedgerStore.of({
            ...store,
            acquireSamplerLease: Effect.fnUntraced(function* (identity) {
              yield* store.writeLatestSample(
                GithubLedgerRow.cases.Sample.make({
                  at: DateTime.makeUnsafe(0),
                  host,
                  command: DEFAULT_COMMAND_LABEL,
                  identity,
                  trigger: "timer",
                  selfCost: "confirmed-free",
                  buckets: [
                    SampleBucket.make({
                      resource: "core",
                      limit: 5000,
                      used: 1,
                      remaining: 4999,
                      resetAt: DateTime.makeUnsafe(1000),
                    }),
                  ],
                })
              );
              return true;
            }),
          })
        )
      );
      yield* Effect.gen(function* () {
        const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer"));
        expect(outcomes[0]).toMatchObject({ _tag: "Skipped", reason: "not-due" });
        expect(aliceFetch.count()).toBe(0);
      }).pipe(withLayer(samplerOver(registry.layer, racedStore)));
    })
  );
});

describe("GithubRateLimitSampler.sampleIfDue", () => {
  it.effect("samples an App identity through a live client with exactly two /rate_limit reads", () =>
    Effect.gen(function* () {
      const appFetch = rateLimitFetch();
      const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(rateLimitFetch().fetch) }]);
      yield* Effect.gen(function* () {
        const sampler = yield* GithubRateLimitSampler;
        const appClient = Layer.merge(
          tokenClient(appFetch.fetch),
          Layer.succeed(GithubBudgetIdentity, O.some(appLabel))
        );
        const first = yield* sampler.sampleIfDue("monitor").pipe(withLayer(appClient));
        expect(first).toMatchObject({ _tag: "Sampled", identity: "app:1/2" });
        expect(A.map(appFetch.calls, (call) => call.path)).toStrictEqual(["/rate_limit", "/rate_limit"]);
        const second = yield* sampler.sampleIfDue("monitor").pipe(withLayer(appClient));
        expect(second).toMatchObject({ _tag: "Skipped", reason: "not-due" });
        expect(appFetch.count()).toBe(2);
        const rows = yield* allRows;
        const samples = samplesOf(rows);
        expect(A.map(samples, (row) => [row.identity, row.trigger])).toStrictEqual([["app:1/2", "monitor"]]);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );
});

describe("GithubRateLimitSampler.calibrate", () => {
  it.effect("writes one Calibration row per pair with one REST and one GraphQL request each", () =>
    Effect.gen(function* () {
      const calls = recordingFetch((path) =>
        path === "/rate_limit"
          ? { status: 200, body: rateLimitBody(7) }
          : {
              status: 200,
              body: toJson({
                data: {
                  rateLimit: { limit: 5000, used: 41, remaining: 4959, resetAt: "2027-01-15T08:00:00Z", cost: 1 },
                },
              }),
            }
      );
      const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(calls.fetch) }]);
      yield* Effect.gen(function* () {
        const rows = yield* GithubRateLimitSampler.use((sampler) =>
          sampler.calibrate(GithubCalibrationOptions.make({ pairs: 2, spacing: Duration.zero }))
        );
        expect(A.map(rows, (row) => [row.identity, row.restUsed, row.graphqlUsed, row.graphqlCost])).toStrictEqual([
          ["user:alice", 40, 41, 1],
          ["user:alice", 40, 41, 1],
        ]);
        const persistedRows = yield* allRows;
        const persisted = A.filter(persistedRows, GithubLedgerRow.guards.Calibration);
        expect(persisted).toHaveLength(2);
        expect(A.map(calls.calls, (call) => call.path)).toStrictEqual([
          "/rate_limit",
          "/graphql",
          "/rate_limit",
          "/graphql",
        ]);
      }).pipe(withLayer(samplerOver(registry.layer)));
    })
  );
});

describe("GithubRateLimitSampler over the file store", () => {
  it.layer(NodeServices.layer)((it) => {
    it.effect("lets exactly one of two concurrent reclaimers take a stale lease", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-lease-" });
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const lock = path.join(root, "sampler", "user_alice.lock");
          yield* fs.makeDirectory(path.dirname(lock), { recursive: true });
          yield* fs.writeFileString(lock, "lease\n");
          // The lease file dates from 1970; the clock reads ten minutes later.
          yield* fs.utimes(lock, 1, 1);
          yield* TestClock.setTime(10 * 60_000);
          const results = yield* Effect.all(
            [Effect.scoped(store.acquireSamplerLease(alice)), Effect.scoped(store.acquireSamplerLease(alice))],
            { concurrency: 2 }
          );
          expect(A.filter(results, (won) => won)).toHaveLength(1);
        }).pipe(
          withLayer(layerGithubLedgerStoreLive),
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: root })
          )
        );
      })
    );
  });
});

describe("GithubIdentityRegistry live", () => {
  const fixtureToken = `ghp_${Str.repeat(3)("Z9y8X7w6V5")}qrstuv`;
  const neverFetch = recordingFetch(() => ({ status: 500, body: "{}" }));

  const configuredWith = Effect.fnUntraced(function* (alias: GithubIdentityLabel) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-registry-" });
    const { spawner } = scriptedSpawner({
      "gh config get -h github.com user": { stdout: "alice\n" },
      "op read --no-newline op://vault/bot/token": { stdout: fixtureToken },
    });
    const hash = yield* tokenHashLabel(Redacted.make(fixtureToken)).pipe(withLayer(Digest.layerWebCrypto));
    const ledger = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreMemory));
    return yield* Effect.gen(function* () {
      yield* GithubBudgetLedger.use((value) => value.recordAlias(hash, alias));
      return yield* GithubIdentityRegistry.use((registry) => registry.configured);
    }).pipe(
      withLayer(layerGithubIdentityRegistryLive(root).pipe(Layer.provideMerge(ledger))),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.provideService(GithubTransportFetch, O.some(neverFetch.fetch)),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({
          BEEP_GH_TOKEN_REF: "op://vault/bot/token",
          BEEP_GITHUB_IDENTITIES_FILE: path.join(root, "absent.json"),
        })
      )
    );
  });

  it.layer(NodeServices.layer)((it) => {
    it.effect("always samples the env-selected identity alongside the gh login", () =>
      Effect.gen(function* () {
        const configured = yield* configuredWith(bob);
        expect(A.map(configured, (entry) => entry._tag)).toStrictEqual(["OpRef", "GhCli"]);
        expect(configured[0]).toMatchObject({ tokenRef: "op://vault/bot/token", login: "bob" });
        expect(neverFetch.count()).toBe(0);
      })
    );

    it.effect("keeps one entry when the env identity and the gh login share a label", () =>
      Effect.gen(function* () {
        const configured = yield* configuredWith(alice);
        expect(configured).toHaveLength(1);
      })
    );
  });
});
