import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import {
  ConfiguredGithubIdentity,
  fromGithubIdentity,
  GithubBudgetCredential,
  GithubClientRequest,
  GithubIdentity,
  GithubTransportFetch,
  layerGithubClientFor,
  layerGithubRepoFor,
  repoSlugFromRemote,
  selectGithubIdentity,
  toGithubIdentity,
} from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";
import { recordingFetch, scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const key = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", key.privateKey));
const banner = (edge: string) => `-----${edge} PRIVATE KEY-----`;
const pem = `${banner("BEGIN")}\n${Base64.encode(bytes)}\n${banner("END")}`;
const gh = GithubIdentity.make({
  kind: "gh-cli",
  tokenRef: O.none(),
  appId: O.none(),
  installationId: O.none(),
  privateKeyRef: O.none(),
});
const appEntry = ConfiguredGithubIdentity.cases.GithubApp.make({
  appId: "1",
  installationId: 2,
  privateKeyRef: "op://v/key/pem",
});
const app = toGithubIdentity(appEntry);
const env = (values: Readonly<Record<string, string>>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));
const selected = (values: Readonly<Record<string, string>>) => selectGithubIdentity(O.none()).pipe(env(values));
const build = (
  identity: GithubIdentity,
  script: Parameters<typeof scriptedSpawner>[0],
  fetch?: typeof globalThis.fetch
) =>
  Effect.scopedWith((scope) =>
    Layer.buildWithScope(
      layerGithubClientFor(GithubClientRequest.make({ identity, cwd: "." }), { retry: "off" }),
      scope
    )
  ).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner(script).spawner),
    Effect.provideService(GithubTransportFetch, O.fromUndefinedOr(fetch)),
    env({})
  );

describe("GitHub credential context boundaries", () => {
  it.effect("validates configured identity selection before credentials are read", () =>
    Effect.gen(function* () {
      const token = yield* selected({ BEEP_GH_TOKEN_REF: "op://v/item/token" });
      expect(token.kind).toBe("op-ref");
      const badToken = yield* Effect.flip(selected({ BEEP_GH_TOKEN_REF: "raw-token" }));
      expect(badToken.reason).toBe("op-read-failed");
      const partial = yield* Effect.flip(selected({ BEEP_GH_APP_ID: "1" }));
      expect(partial.reason).toBe("app-config");
      const invalid = yield* Effect.flip(
        selected({ BEEP_GH_APP_ID: "1", BEEP_GH_APP_INSTALLATION_ID: "oops", BEEP_GH_APP_KEY_REF: "op://v/key/pem" })
      );
      expect(invalid.reason).toBe("app-config");
      const invalidKey = yield* Effect.flip(
        selected({ BEEP_GH_APP_ID: "1", BEEP_GH_APP_INSTALLATION_ID: "2", BEEP_GH_APP_KEY_REF: "raw" })
      );
      expect(invalidKey.reason).toBe("app-config");
      const invalidId = yield* Effect.flip(
        selected({ BEEP_GH_APP_ID: "", BEEP_GH_APP_INSTALLATION_ID: "2", BEEP_GH_APP_KEY_REF: "op://v/key/pem" })
      );
      expect(invalidId.reason).toBe("app-config");
      const valid = yield* selected({
        BEEP_GH_APP_ID: "1",
        BEEP_GH_APP_INSTALLATION_ID: "2",
        BEEP_GH_APP_KEY_REF: "op://v/key/pem",
      });
      expect(valid.kind).toBe("github-app");
    })
  );

  it("round trips identity configuration and parses repository remotes", () => {
    assertSome(fromGithubIdentity(app, O.none()), appEntry);
    assertNone(fromGithubIdentity({ ...app, appId: O.none() }, O.none()));
    assertSome(fromGithubIdentity(gh, O.none()), ConfiguredGithubIdentity.cases.GhCli.make({}));
    const op = toGithubIdentity(ConfiguredGithubIdentity.cases.OpRef.make({ tokenRef: "op://v/i/t", login: "alice" }));
    assertNone(fromGithubIdentity(op, O.none()));
    const configured = fromGithubIdentity(op, O.some("alice"));
    configured.pipe(O.isSome, assertTrue);
    assertSome(repoSlugFromRemote("git@github.com:owner/repo.git"), "owner/repo");
    assertNone(repoSlugFromRemote("local"));
  });

  it.effect("keeps installation token rotation out of the physical credential context", () =>
    Effect.gen(function* () {
      const fetch = recordingFetch(() => ({
        status: 201,
        body: '{"token":"ghs_fixture","expires_at":"2099-01-01T00:00:00Z","permissions":{}}',
      }));
      const context = yield* build(app, { "op read --no-newline op://v/key/pem": { stdout: pem } }, fetch.fetch);
      assertNone(Context.get(context, GithubBudgetCredential));
      expect(typeof Context.get(context, GitHubClient).request).toBe("function");
      const failed = yield* Effect.flip(build(app, { "op read --no-newline op://v/key/pem": { stdout: "invalid" } }));
      expect(failed.reason).toBe("app-token-failed");
      for (const incomplete of [
        { ...app, appId: O.none() },
        { ...app, installationId: O.none() },
        { ...app, privateKeyRef: O.none() },
      ]) {
        const error = yield* Effect.flip(build(incomplete, {}));
        expect(error.reason).toBe("app-config");
      }
      const empty = yield* Effect.flip(build(gh, { "gh auth token": { stdout: "" } }));
      expect(empty.reason).toBe("token-unavailable");
      const exit = yield* Effect.flip(build(gh, {}));
      expect(exit.reason).toBe("token-unavailable");
    })
  );

  it.effect("resolves repo overrides and origin URLs with typed failures", () =>
    Effect.gen(function* () {
      const read = (values: Readonly<Record<string, string>>, script: Parameters<typeof scriptedSpawner>[0]) =>
        Repo.pipe(
          withLayer(layerGithubRepoFor(".")),
          env(values),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner(script).spawner)
        );
      const override = yield* read({ GH_REPO: "owner/repo" }, {});
      expect(override.owner).toBe("owner");
      const origin = yield* read({}, { "git remote get-url origin": { stdout: "https://github.com/owner/repo.git" } });
      expect(origin.repo).toBe("repo");
      const absent = yield* Effect.flip(read({}, {}));
      expect(absent.reason).toBe("repo-unknown");
      const invalid = yield* Effect.flip(read({ GH_REPO: "invalid" }, {}));
      expect(invalid.reason).toBe("repo-unknown");
      expect(A.length([override, origin])).toBe(2);
    })
  );
});

it.effect("reports credential spawn failures without exposing output and handles absent op references", () =>
  Effect.gen(function* () {
    const spawner = ScriptedSpawner.make(() => ScriptedSpawner.notFound("gh"));
    const failed = yield* Layer.build(layerGithubClientFor(GithubClientRequest.make({ identity: gh, cwd: "." }))).pipe(
      provideSpawner(spawner),
      env({}),
      Effect.scoped,
      Effect.flip
    );
    expect(failed.message).toBe("could not run gh to read a gh login token");
    const missing = yield* Effect.flip(build({ ...gh, kind: "op-ref" }, {}));
    expect(missing.reason).toBe("op-read-failed");
  })
);

it.effect("redacts credential output failures that have no exit status", () =>
  Effect.gen(function* () {
    const base = scriptedSpawner({ "gh auth token": { stdout: "fixture" } }).spawner;
    // Own double: decorates the scripted `gh auth token` answer with a stdout past the 16 MiB bound,
    // a per-spawn stream shape `ScriptedSpawner` cannot script.
    const spawner = ChildProcessSpawner.make((command) =>
      base.spawn(command).pipe(
        Effect.map((handle) => ({
          ...handle,
          stdout: Stream.make(new Uint8Array(16 * 1024 * 1024 + 1)),
        }))
      )
    );
    const failed = yield* Layer.build(layerGithubClientFor(GithubClientRequest.make({ identity: gh, cwd: "." }))).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      env({}),
      Effect.scoped,
      Effect.flip
    );
    expect(failed.message).toBe("gh did not return a gh login token (exit none)");
  })
);
