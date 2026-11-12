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
  GithubLedgerError,
  GithubLedgerRow,
  GithubLedgerStore,
  GithubRateLimitSampler,
  GithubRateLimitSamplerOptions,
  GithubRateLimitWire,
  GithubTransportFetch,
  HostLabel,
  LedgerRange,
  layerGithubBudgetLedger,
  layerGithubIdentityRegistryLive,
  layerGithubLedgerStoreLive,
  layerGithubLedgerStoreMemory,
  layerGithubRateLimitSampler,
  makeGithubLedgerStoreMemory,
  recordRateLimitRead,
  SampleBucket,
  tokenHashLabel,
} from "@beep/repo-cli/test/SharedInternals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
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
        const failed = outcomes[1];
        assertTrue(failed?._tag === "Failed");
        expect(failed.entry).toBe("OpRef");
        assertSome(failed.identity, bob);
        expect(failed.detail).toContain("op-read-failed");
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

  it.effect("fails a hung identity after 60 s and still samples the next one", () =>
    Effect.gen(function* () {
      const bobFetch = rateLimitFetch();
      const registry = stubRegistry([
        { entry: GH_CLI, label: alice, client: Layer.effect(GitHubClient, Effect.never) },
        { entry: OP_REF, label: bob, client: tokenClient(bobFetch.fetch) },
      ]);
      yield* Effect.gen(function* () {
        const running = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer")).pipe(
          Effect.forkChild
        );
        yield* TestClock.adjust(Duration.seconds(61));
        const outcomes = yield* Fiber.join(running);
        expect(tags(outcomes)).toStrictEqual(["Failed", "Sampled"]);
        const hung = outcomes[0];
        assertTrue(hung?._tag === "Failed");
        expect(hung.detail).toContain("did not finish");
        expect(bobFetch.count()).toBe(2);
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

const decodeRateLimitWire = S.decodeUnknownEffect(GithubRateLimitWire);
const monitorWire = decodeRateLimitWire({ resources: { core: bucket(9), graphql: bucket(40) } });
const memoryLedger = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreMemory));

describe("recordRateLimitRead", () => {
  it.effect("records a free /rate_limit read as one sample row for the client's identity", () =>
    Effect.gen(function* () {
      const wire = yield* monitorWire;
      yield* recordRateLimitRead(wire, "monitor-pause").pipe(
        withLayer(Layer.succeed(GithubBudgetIdentity, O.some(alice)))
      );
      const rows = yield* allRows;
      expect(A.map(samplesOf(rows), (row) => [row.identity, row.trigger, row.command])).toStrictEqual([
        ["user:alice", "monitor-pause", DEFAULT_COMMAND_LABEL],
      ]);
    }).pipe(withLayer(memoryLedger))
  );

  it.effect("writes nothing when the client carries no budget label", () =>
    Effect.gen(function* () {
      const wire = yield* monitorWire;
      yield* recordRateLimitRead(wire, "monitor-pause");
      const rows = yield* allRows;
      expect(samplesOf(rows)).toStrictEqual([]);
    }).pipe(withLayer(memoryLedger))
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
  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
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

    it.effect("keeps a reclaimer's lease when the holder it replaced releases late", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-lease-owner-" });
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const lock = path.join(root, "sampler", "user_alice.lock");
          const slow = yield* Scope.make();
          const reclaimer = yield* Scope.make();
          const first = yield* store.acquireSamplerLease(alice).pipe(Scope.provide(slow));
          assertTrue(first);
          // The slow holder overran the staleness bound, so a second process reclaims the lease.
          yield* fs.utimes(lock, 1, 1);
          yield* TestClock.setTime(10 * 60_000);
          const reclaimed = yield* store.acquireSamplerLease(alice).pipe(Scope.provide(reclaimer));
          assertTrue(reclaimed);
          yield* Scope.close(slow, Exit.void);
          const keptAfterLateRelease = yield* fs.exists(lock);
          assertTrue(keptAfterLateRelease);
          const third = yield* Effect.scoped(store.acquireSamplerLease(alice));
          assertFalse(third);
          yield* Scope.close(reclaimer, Exit.void);
          const keptAfterOwnRelease = yield* fs.exists(lock);
          assertFalse(keptAfterOwnRelease);
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

  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
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

const retryOffClient = (fetch: typeof globalThis.fetch) =>
  GitHubClient.layerFromToken({ token: Redacted.make("fixture-token"), fetch, retry: "off" });

const labelledClient = (fetch: typeof globalThis.fetch, label: GithubIdentityLabel) =>
  Layer.merge(retryOffClient(fetch), Layer.succeed(GithubBudgetIdentity, O.some(label)));

const failedOf = (outcome: SampleOutcome | undefined) => {
  assertTrue(outcome?._tag === "Failed");
  return outcome;
};

describe("GithubRateLimitSampler failure outcomes", () => {
  const registry = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(rateLimitFetch().fetch) }]);

  it.effect("fails a client that carries no budget label without a request", () =>
    Effect.gen(function* () {
      const calls = rateLimitFetch();
      const outcome = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleIfDue("monitor")).pipe(
        withLayer(retryOffClient(calls.fetch))
      );
      const failed = failedOf(outcome);
      expect([failed.entry, failed.detail]).toStrictEqual(["GhCli", "the client carries no budget label"]);
      assertNone(failed.identity);
      expect(calls.count()).toBe(0);
    }).pipe(withLayer(samplerOver(registry.layer)))
  );

  it.effect("names GitHub's status when a user identity's read is refused", () =>
    Effect.gen(function* () {
      const refused = recordingFetch(() => ({ status: 500, body: toJson({ message: "boom" }) }));
      const outcome = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleIfDue("monitor")).pipe(
        withLayer(labelledClient(refused.fetch, alice))
      );
      const failed = failedOf(outcome);
      expect(failed.entry).toBe("GhCli");
      assertSome(failed.identity, alice);
      expect(failed.detail).toMatch(/^github \S+ on GET \/rate_limit \(500\)$/);
    }).pipe(withLayer(samplerOver(registry.layer)))
  );

  it.effect("omits the status when the failure carries none", () =>
    Effect.gen(function* () {
      // A body that does not decode fails with no HTTP status attached.
      const garbled = recordingFetch(() => ({ status: 200, body: toJson({ resources: "none" }) }));
      const outcome = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleIfDue("monitor")).pipe(
        withLayer(labelledClient(garbled.fetch, alice))
      );
      const failed = failedOf(outcome);
      expect(failed.detail).toBe("github decode on GET /rate_limit");
    }).pipe(withLayer(samplerOver(registry.layer)))
  );

  it.effect("reports a store failure as a ledger detail", () =>
    Effect.gen(function* () {
      const brokenStore = Layer.effect(
        GithubLedgerStore,
        Effect.map(makeGithubLedgerStoreMemory, (store) =>
          GithubLedgerStore.of({
            ...store,
            acquireSamplerLease: Effect.fnUntraced(function* () {
              return yield* GithubLedgerError.make({ reason: "write", detail: "disk full" });
            }),
          })
        )
      );
      const calls = rateLimitFetch();
      const failing = stubRegistry([{ entry: GH_CLI, label: alice, client: tokenClient(calls.fetch) }]);
      const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer")).pipe(
        withLayer(samplerOver(failing.layer, brokenStore))
      );
      expect(failedOf(outcomes[0]).detail).toBe("ledger write: disk full");
      expect(calls.count()).toBe(0);
    })
  );

  it.effect("reports a client that dies as a died sample", () =>
    Effect.gen(function* () {
      const dying = stubRegistry([
        { entry: GH_CLI, label: alice, client: Layer.effect(GitHubClient, Effect.die("client defect")) },
      ]);
      const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer")).pipe(
        withLayer(samplerOver(dying.layer))
      );
      const failed = failedOf(outcomes[0]);
      expect([failed.entry, failed.detail]).toStrictEqual(["GhCli", "the sample died"]);
      assertSome(failed.identity, alice);
    })
  );

  it.effect("fails an App entry whose ids make no label, without building a client", () =>
    Effect.gen(function* () {
      const unlabelledApp = ConfiguredGithubIdentity.cases.GithubApp.make({
        appId: "not-numeric",
        installationId: 2,
        privateKeyRef: "op://vault/app/key",
      });
      const apps = stubRegistry([{ entry: unlabelledApp, label: appLabel, client: Layer.empty as never }]);
      const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer")).pipe(
        withLayer(samplerOver(apps.layer))
      );
      const failed = failedOf(outcomes[0]);
      expect([failed.entry, failed.detail]).toStrictEqual(["GithubApp", "the App entry has no label"]);
      assertNone(failed.identity);
      expect(apps.built).toStrictEqual([]);
    })
  );

  it.effect("fails an entry whose label cannot be read, without building its client", () =>
    Effect.gen(function* () {
      const built: Array<string> = [];
      const unlabelled = Layer.succeed(
        GithubIdentityRegistry,
        GithubIdentityRegistry.of({
          configured: Effect.succeed([OP_REF]),
          labelOf: Effect.fnUntraced(function* () {
            return yield* GithubIdentityError.make({ reason: "op-read-failed", message: "op is locked" });
          }),
          clientFor: () => Layer.unwrap(Effect.sync(() => built.push("OpRef")).pipe(Effect.as(Layer.empty as never))),
        })
      );
      const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("manual")).pipe(
        withLayer(samplerOver(unlabelled))
      );
      const failed = failedOf(outcomes[0]);
      expect([failed.entry, failed.detail]).toStrictEqual(["OpRef", "identity op-read-failed: op is locked"]);
      assertNone(failed.identity);
      expect(built).toStrictEqual([]);
    })
  );

  it.effect("samples the gh login alone when the configured list cannot be read", () =>
    Effect.gen(function* () {
      const calls = rateLimitFetch();
      const sampled: Array<string> = [];
      const unreadable = Layer.succeed(
        GithubIdentityRegistry,
        GithubIdentityRegistry.of({
          configured: Effect.fail(GithubLedgerError.make({ reason: "config", detail: "identities.json is invalid" })),
          labelOf: Effect.fnUntraced(function* (entry) {
            sampled.push(entry._tag);
            return alice;
          }),
          clientFor: () => tokenClient(calls.fetch),
        })
      );
      const outcomes = yield* GithubRateLimitSampler.use((sampler) => sampler.sampleAll("timer")).pipe(
        withLayer(samplerOver(unreadable))
      );
      expect(tags(outcomes)).toStrictEqual(["Sampled"]);
      expect(sampled).toStrictEqual(["GhCli"]);
      expect(calls.count()).toBe(2);
    })
  );

  it.effect("fails calibration when GraphQL answers with errors", () =>
    Effect.gen(function* () {
      const calls = recordingFetch((path) =>
        path === "/rate_limit"
          ? { status: 200, body: rateLimitBody(7) }
          : { status: 200, body: toJson({ data: null, errors: [{ message: "rateLimit is unavailable" }] }) }
      );
      const calibrating = stubRegistry([{ entry: GH_CLI, label: alice, client: retryOffClient(calls.fetch) }]);
      const error = yield* Effect.flip(
        GithubRateLimitSampler.use((sampler) =>
          sampler.calibrate(GithubCalibrationOptions.make({ pairs: 1, spacing: Duration.zero }))
        ).pipe(withLayer(samplerOver(calibrating.layer)))
      );
      expect(error._tag).toBe("GitHubError");
      const persisted = yield* allRows.pipe(withLayer(layerGithubLedgerStoreMemory));
      expect(persisted).toStrictEqual([]);
    })
  );
});

describe("GithubIdentityRegistry live labelling", () => {
  const fixtureToken = `ghp_${Str.repeat(3)("Q1w2E3r4T5")}abcdef`;

  const registryWith = Effect.fnUntraced(function* (options: {
    readonly env: Readonly<Record<string, string>>;
    readonly script: Readonly<Record<string, { readonly stdout: string }>>;
    readonly user?: string;
    readonly identities?: ReadonlyArray<unknown>;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-registry-labels-" });
    const identitiesFile = path.join(root, "identities.json");
    if (options.identities !== undefined) {
      yield* fs.writeFileString(
        identitiesFile,
        toJson({ schemaVersion: "github-identities/v1", identities: options.identities })
      );
    }
    const { spawner, spawned } = scriptedSpawner(options.script);
    const users = recordingFetch((requestPath) =>
      requestPath === "/user" && options.user !== undefined
        ? { status: 200, body: toJson({ login: options.user }) }
        : { status: 401, body: toJson({ message: "Bad credentials" }) }
    );
    const ledger = layerGithubBudgetLedger({ host }).pipe(Layer.provideMerge(layerGithubLedgerStoreMemory));
    const result = yield* Effect.gen(function* () {
      const registry = yield* GithubIdentityRegistry;
      const configured = yield* registry.configured;
      const ghLabel = yield* registry.labelOf(GH_CLI).pipe(Effect.option);
      return { configured, ghLabel };
    }).pipe(
      withLayer(layerGithubIdentityRegistryLive(root).pipe(Layer.provideMerge(ledger))),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      Effect.provideService(GithubTransportFetch, O.some(users.fetch)),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ BEEP_GITHUB_IDENTITIES_FILE: identitiesFile, ...options.env })
      )
    );
    return { ...result, spawned, userLookups: users.count() };
  });

  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    it.effect("labels the gh entry from its token when GH_TOKEN overrides gh's own login", () =>
      Effect.gen(function* () {
        const result = yield* registryWith({
          env: { GH_TOKEN: fixtureToken },
          script: { "gh auth token": { stdout: fixtureToken } },
          user: "carol",
        });
        expect(A.map(result.configured, (entry) => entry._tag)).toStrictEqual(["GhCli"]);
        assertSome(result.ghLabel, GithubIdentityLabel.make("user:carol"));
        expect(A.some(result.spawned, Str.startsWith("gh config"))).toBe(false);
        expect(result.userLookups).toBe(1);
      })
    );

    it.effect("keeps the gh entry under a placeholder key when no environment identity or label resolves", () =>
      Effect.gen(function* () {
        // A lone App id is a configuration error, so the environment selects nothing.
        const result = yield* registryWith({ env: { BEEP_GH_APP_ID: "1" }, script: {} });
        expect(A.map(result.configured, (entry) => entry._tag)).toStrictEqual(["GhCli"]);
        assertNone(result.ghLabel);
        expect(result.spawned).toContain("gh config get -h github.com user");
        expect(result.spawned).toContain("gh auth token");
      })
    );

    it.effect("takes an env token reference's login from the configured file without reading the token", () =>
      Effect.gen(function* () {
        const result = yield* registryWith({
          env: { BEEP_GH_TOKEN_REF: "op://vault/bot/token" },
          script: { "gh config get -h github.com user": { stdout: "alice\n" } },
          identities: [
            { _tag: "GithubApp", appId: "1", installationId: 2, privateKeyRef: "op://vault/app/key" },
            { _tag: "OpRef", tokenRef: "op://vault/other/token", login: "carol" },
            { _tag: "OpRef", tokenRef: "op://vault/bot/token", login: "bob" },
          ],
        });
        expect(A.map(result.configured, (entry) => entry._tag)).toStrictEqual(["GithubApp", "OpRef", "OpRef", "GhCli"]);
        expect(result.configured[2]).toMatchObject({ tokenRef: "op://vault/bot/token", login: "bob" });
        expect(A.some(result.spawned, Str.startsWith("op read"))).toBe(false);
        assertSome(result.ghLabel, alice);
      })
    );

    it.effect("drops an env token reference whose token resolves to no login", () =>
      Effect.gen(function* () {
        const result = yield* registryWith({
          env: { BEEP_GH_TOKEN_REF: "op://vault/bot/token" },
          script: {
            "gh config get -h github.com user": { stdout: "alice\n" },
            "op read --no-newline op://vault/bot/token": { stdout: fixtureToken },
          },
        });
        expect(A.map(result.configured, (entry) => entry._tag)).toStrictEqual(["GhCli"]);
        expect(result.spawned).toContain("op read --no-newline op://vault/bot/token");
        expect(result.userLookups).toBe(1);
      })
    );
  });
});
