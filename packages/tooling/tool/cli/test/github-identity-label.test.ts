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
      expect(built.label).toStrictEqual(O.some("user:alice"));
      expect(fetch.count()).toBe(0);
      const ledger = yield* GithubBudgetLedger;
      const aliases = yield* ledger.aliases;
      const hash = yield* hashOf(FIXTURE_TOKEN);
      expect(aliases.aliases[hash]).toBe("user:alice");
    }).pipe(withLayer(memoryLedger), Effect.scoped)
  );

  it.effect("uses a known alias when GH_TOKEN overrides the gh login", () =>
    Effect.gen(function* () {
      const ledger = yield* GithubBudgetLedger;
      const hash = yield* hashOf(FIXTURE_TOKEN);
      yield* ledger.recordAlias(hash, GithubIdentityLabel.make("user:alice"));
      const fetch = userReply("someone-else");
      const built = yield* buildClient({
        identity: ghIdentity,
        script: { "gh auth token": { stdout: FIXTURE_TOKEN } },
        env: { GH_TOKEN: "set" },
        fetch,
      });
      expect(built.label).toStrictEqual(O.some("user:alice"));
      expect(fetch.count()).toBe(0);
      expect(A.contains(built.spawned, "gh config get -h github.com user")).toBe(false);
    }).pipe(withLayer(memoryLedger), Effect.scoped)
  );

  it.effect("makes exactly one GET /user for an unknown token, then reuses the alias", () =>
    Effect.gen(function* () {
      const fetch = userReply("bob");
      const script = { "op read --no-newline op://vault/bot/token": { stdout: FIXTURE_TOKEN } };
      const first = yield* buildClient({ identity: opIdentity, script, fetch });
      expect(first.label).toStrictEqual(O.some("user:bob"));
      expect(fetch.count()).toBe(1);
      const second = yield* buildClient({ identity: opIdentity, script, fetch });
      expect(second.label).toStrictEqual(O.some("user:bob"));
      expect(fetch.count()).toBe(1);
    }).pipe(withLayer(memoryLedger), Effect.scoped)
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
      expect(built.label).toStrictEqual(O.some(hash));
      expect(Str.startsWith("token:")(hash)).toBe(true);
    }).pipe(withLayer(memoryLedger), Effect.scoped)
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
      expect(app).toStrictEqual(O.some("app:12/34"));
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
      expect(configured).toStrictEqual(O.some("user:beep-bot"));
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
      expect(built.label).toStrictEqual(O.none());
      expect(built.spawned).toStrictEqual(["gh auth token"]);
      expect(fetch.count()).toBe(0);
    }).pipe(Effect.scoped)
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
