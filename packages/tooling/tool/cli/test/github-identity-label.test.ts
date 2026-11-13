import { GitHubClient } from "@beep/github/GitHubClient";
import { RateLimitSink } from "@beep/github/Resilience";
import {
  ConfiguredGithubIdentity,
  GithubBudgetIdentity,
  GithubBudgetLedger,
  GithubClientRequest,
  GithubConfiguredIdentities,
  GithubIdentity,
  GithubIdentityLabel,
  GithubLedgerStore,
  GithubTransportFetch,
  ghSpawnCredential,
  ghSpawnIdentity,
  LedgerRange,
  layerGithubBudgetLedger,
  layerGithubClientFor,
  layerGithubLedgerStoreLive,
  layerGithubLedgerStoreMemory,
  readGithubIdentityConfig,
  resolveGithubIdentityLabel,
  tokenHashLabel,
} from "@beep/repo-cli/test/SharedInternals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { rateLimitHeaders, recordingFetch, scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";

const alice = GithubIdentityLabel.make("user:alice");
const bob = GithubIdentityLabel.make("user:bob");

// A fixture token in GitHub's format; it never leaves this process.
const FIXTURE_TOKEN = `ghp_${Str.repeat(2)("Fixture0Token1")}abcdefgh`;

const ghIdentity = GithubIdentity.make({
  kind: "gh-cli",
  tokenRef: O.none(),
  appId: O.none(),
  installationId: O.none(),
  privateKeyRef: O.none(),
});

const opIdentity = GithubIdentity.make({
  kind: "op-ref",
  tokenRef: O.some("op://vault/bot/token"),
  appId: O.none(),
  installationId: O.none(),
  privateKeyRef: O.none(),
});

const userReply = (login: string, status = 200) =>
  recordingFetch((path) =>
    path === "/user"
      ? {
          status,
          body: status === 200 ? `{"login":"${login}"}` : `{"message":"Bad credentials"}`,
          headers: rateLimitHeaders({ remaining: 4990, used: 10, resource: "core" }),
        }
      : { status: 200, body: "{}", headers: rateLimitHeaders({ remaining: 4989, used: 11, resource: "core" }) }
  );

const buildClient = Effect.fnUntraced(function* (options: {
  readonly identity: GithubIdentity;
  readonly script: Readonly<Record<string, { readonly stdout: string }>>;
  readonly env?: Readonly<Record<string, string>>;
  readonly fetch: ReturnType<typeof recordingFetch>;
}) {
  const { spawner, spawned } = scriptedSpawner(options.script);
  const context = yield* Layer.build(
    layerGithubClientFor(GithubClientRequest.make({ identity: options.identity, cwd: "." }), { retry: "off" })
  ).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    Effect.provideService(GithubTransportFetch, O.some(options.fetch.fetch)),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(options.env ?? {}))
  );
  return { label: Context.get(context, GithubBudgetIdentity), client: Context.get(context, GitHubClient), spawned };
});

const hashOf = (token: string) => tokenHashLabel(Redacted.make(token)).pipe(withLayer(Digest.layerWebCrypto));

const memoryLedger = layerGithubBudgetLedger().pipe(Layer.provideMerge(layerGithubLedgerStoreMemory));

describe("GitHub identity labels", () => {
  it.effect("labels the gh login from local config and records its token alias, with no request", () =>
    Effect.gen(function* () {
      const fetch = userReply("alice");
      const built = yield* buildClient({
        identity: ghIdentity,
        script: {
          "gh auth token": { stdout: FIXTURE_TOKEN },
          "gh config get -h github.com user": { stdout: "alice\n" },
        },
        fetch,
      });
      assertSome(built.label, alice);
      expect(fetch.count()).toBe(0);
      const ledger = yield* GithubBudgetLedger;
      const aliases = yield* ledger.aliases;
      const hash = yield* hashOf(FIXTURE_TOKEN);
      expect(aliases.aliases[hash]).toBe("user:alice");
    }).pipe(withLayer(memoryLedger))
  );

  it.effect("uses a known alias when GH_TOKEN overrides the gh login", () =>
    Effect.gen(function* () {
      const ledger = yield* GithubBudgetLedger;
      const hash = yield* hashOf(FIXTURE_TOKEN);
      yield* ledger.recordAlias(hash, alice);
      const fetch = userReply("someone-else");
      const built = yield* buildClient({
        identity: ghIdentity,
        script: { "gh auth token": { stdout: FIXTURE_TOKEN } },
        env: { GH_TOKEN: "set" },
        fetch,
      });
      assertSome(built.label, alice);
      expect(fetch.count()).toBe(0);
      assertFalse(A.contains(built.spawned, "gh config get -h github.com user"));
    }).pipe(withLayer(memoryLedger))
  );

  it.effect("makes exactly one GET /user for an unknown token, then reuses the alias", () =>
    Effect.gen(function* () {
      const fetch = userReply("bob");
      const script = { "op read --no-newline op://vault/bot/token": { stdout: FIXTURE_TOKEN } };
      const first = yield* buildClient({ identity: opIdentity, script, fetch });
      assertSome(first.label, bob);
      expect(fetch.count()).toBe(1);
      const second = yield* buildClient({ identity: opIdentity, script, fetch });
      assertSome(second.label, bob);
      expect(fetch.count()).toBe(1);
    }).pipe(withLayer(memoryLedger))
  );

  it.effect("degrades to the token hash when GET /user fails or gh's login is malformed", () =>
    Effect.gen(function* () {
      const fetch = userReply("bob", 401);
      const built = yield* buildClient({
        identity: ghIdentity,
        script: {
          "gh auth token": { stdout: FIXTURE_TOKEN },
          "gh config get -h github.com user": { stdout: "-not a login-" },
        },
        fetch,
      });
      const hash = yield* hashOf(FIXTURE_TOKEN);
      assertSome(built.label, hash);
      assertTrue(Str.startsWith("token:")(hash));
    }).pipe(withLayer(memoryLedger))
  );

  it.effect("labels an App and a configured op-ref without any request", () =>
    Effect.gen(function* () {
      const app = yield* resolveGithubIdentityLabel({
        kind: "github-app",
        tokenRef: O.none(),
        appId: O.some("12"),
        installationId: O.some(34),
        token: O.none(),
        cwd: ".",
        transport: {},
      });
      assertSome(app, GithubIdentityLabel.make("app:12/34"));
      const fetch = userReply("unused");
      const configured = yield* resolveGithubIdentityLabel({
        kind: "op-ref",
        tokenRef: O.some("op://vault/bot/token"),
        appId: O.none(),
        installationId: O.none(),
        token: O.some(Redacted.make(FIXTURE_TOKEN)),
        cwd: ".",
        transport: { fetch: fetch.fetch },
      }).pipe(
        Effect.provideService(
          GithubConfiguredIdentities,
          Effect.succeed([
            ConfiguredGithubIdentity.cases.OpRef.make({ tokenRef: "op://vault/bot/token", login: "beep-bot" }),
          ])
        )
      );
      assertSome(configured, GithubIdentityLabel.make("user:beep-bot"));
      expect(fetch.count()).toBe(0);
    }).pipe(
      withLayer(Layer.merge(memoryLedger, Digest.layerWebCrypto)),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner({}).spawner),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
    )
  );

  it.effect("resolves nothing and spawns no gh config read without a ledger", () =>
    Effect.gen(function* () {
      const fetch = userReply("alice");
      const built = yield* buildClient({
        identity: ghIdentity,
        script: { "gh auth token": { stdout: FIXTURE_TOKEN } },
        fetch,
      });
      assertNone(built.label);
      expect(built.spawned).toStrictEqual(["gh auth token"]);
      expect(fetch.count()).toBe(0);
    })
  );

  it.effect("labels gh children with the env token gh spends before its hosts.yml login", () =>
    Effect.gen(function* () {
      const { spawner, spawned } = scriptedSpawner({ "gh config get -h github.com user": { stdout: "alice\n" } });
      const labelWith = (env: Readonly<Record<string, string>>) =>
        ghSpawnIdentity(".").pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
          withLayer(Digest.layerWebCrypto)
        );
      const hash = yield* hashOf(FIXTURE_TOKEN);
      const fromGhToken = yield* labelWith({ GH_TOKEN: FIXTURE_TOKEN });
      const fromGithubToken = yield* labelWith({ GITHUB_TOKEN: FIXTURE_TOKEN });
      expect([fromGhToken, fromGithubToken]).toStrictEqual([hash, hash]);
      expect(spawned).toStrictEqual([]);
      const fromLogin = yield* labelWith({ GH_TOKEN: "" });
      expect(fromLogin).toBe(alice);
      expect(spawned).toStrictEqual(["gh config get -h github.com user"]);
    })
  );

  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    it.effect("rejects a raw token in identities.json with reason config", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: "github-identities-" });
        const file = path.join(dir, "identities.json");
        yield* fs.writeFileString(
          file,
          `{"schemaVersion":"github-identities/v1","identities":[{"_tag":"OpRef","tokenRef":"${FIXTURE_TOKEN}","login":"bot"}]}`
        );
        const error = yield* Effect.flip(
          readGithubIdentityConfig.pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ BEEP_GITHUB_IDENTITIES_FILE: file })
            )
          )
        );
        expect(error.reason).toBe("config");
        expect(pipe(error.detail, Str.includes(FIXTURE_TOKEN))).toBe(false);
      })
    );

    it.effect("records labelled transport rows and writes no secret through the client seam", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-seam-" });
        const fetch = userReply("alice");
        yield* Effect.gen(function* () {
          const ledger = yield* GithubBudgetLedger;
          const built = yield* buildClient({
            identity: ghIdentity,
            script: {
              "gh auth token": { stdout: FIXTURE_TOKEN },
              "gh config get -h github.com user": { stdout: "alice" },
            },
            env: { BEEP_GITHUB_LEDGER_STATE_ROOT: root },
            fetch,
          }).pipe(Effect.provideService(RateLimitSink, ledger.sink));
          yield* built.client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
          const store = yield* GithubLedgerStore;
          const now = yield* DateTime.now;
          const rows = yield* store.rows(
            LedgerRange.make({ from: DateTime.subtract(now, { hours: 1 }), to: DateTime.add(now, { hours: 1 }) })
          );
          expect(A.map(rows, (row) => `${row._tag}|${row.identity}`)).toStrictEqual(["Transport|user:alice"]);
        }).pipe(
          withLayer(layerGithubBudgetLedger().pipe(Layer.provideMerge(layerGithubLedgerStoreLive))),
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: root })
          )
        );
        expect(A.map(fetch.calls, (call) => call.authorization)).toStrictEqual([`token ${FIXTURE_TOKEN}`]);
        const files = yield* fs.readDirectory(root, { recursive: true });
        const texts = yield* Effect.forEach(
          A.filter(files, (file) => Str.endsWith(".json")(file) || Str.endsWith(".jsonl")(file)),
          (file) => fs.readFileString(path.join(root, file))
        );
        const all = A.join(texts, "\n");
        expect(A.length(texts)).toBeGreaterThan(0);
        expect(pipe(all, Str.includes(FIXTURE_TOKEN))).toBe(false);
        expect(/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|Bearer/.test(all)).toBe(false);
        expect(pipe(all, Str.includes(root))).toBe(false);
      })
    );
  });
});

it.effect("fingerprints only gh's selected environment token", () =>
  Effect.gen(function* () {
    const read = (env: Readonly<Record<string, string>>) =>
      ghSpawnCredential.pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)));
    const missing = yield* read({});
    assertNone(missing);
    const selected = yield* read({ GH_TOKEN: FIXTURE_TOKEN, GITHUB_TOKEN: "ignored" });
    const fallback = yield* read({ GH_TOKEN: "", GITHUB_TOKEN: FIXTURE_TOKEN });
    const hash = yield* hashOf(FIXTURE_TOKEN);
    assertSome(selected, Str.slice(6)(hash));
    assertSome(fallback, Str.slice(6)(hash));
  })
);
