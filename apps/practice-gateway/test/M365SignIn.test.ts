import { M365AuthorizationRequest } from "@beep/m365";
import {
  M365_TOKEN_CACHE_SEGMENTS,
  M365SignIn,
  makeDpapiTokenCache,
  openLoopbackSignIn,
} from "@beep/practice-gateway/M365SignIn";
import { SystemBrowser } from "@beep/practice-gateway/SystemBrowser";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { m365NotConfigured, settingsLayer } from "./fixtures.ts";

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);
const layerTimeout = "30 seconds";

// A browser that plays Microsoft: it follows the authorization URL straight
// to the loopback redirect with the given answer.
const answeringBrowser = (answer: (state: string) => Record<string, string>) =>
  Layer.effect(
    SystemBrowser,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return SystemBrowser.of({
        open: Effect.fn("AnsweringBrowser.open")(function* (authUrl: string) {
          const url = new URL(authUrl);
          const redirect = new URL(url.searchParams.get("redirect_uri") ?? "");
          for (const [key, value] of Object.entries(answer(url.searchParams.get("state") ?? ""))) {
            redirect.searchParams.set(key, value);
          }
          yield* client.get(redirect.toString()).pipe(
            Effect.flatMap((response) => response.text),
            Effect.orDie
          );
        }),
      });
    })
  ).pipe(Layer.provide(FetchHttpClient.layer));

const authorize = (answer: (state: string) => Record<string, string>) =>
  Effect.gen(function* () {
    const loopback = yield* openLoopbackSignIn;
    expect(loopback.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const authUrl = `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?state=s-1&redirect_uri=${encodeURIComponent(loopback.redirectUri)}`;
    const code = yield* loopback
      .authorizer(M365AuthorizationRequest.make({ authUrl, redirectUri: loopback.redirectUri }))
      .pipe(Effect.option);
    return { code, problem: yield* loopback.problem };
  }).pipe(provideScopedLayer(answeringBrowser(answer)));

describe("loopback authorizer", () => {
  it.effect("captures the authorization code from the redirect", () =>
    Effect.gen(function* () {
      const { code, problem } = yield* authorize((state) => ({ code: "auth-code-1", state }));
      assertSome(code, "auth-code-1");
      assertNone(problem);
    })
  );

  it.effect("reports a declined consent in plain language", () =>
    Effect.gen(function* () {
      const { code, problem } = yield* authorize((state) => ({ error: "access_denied", state }));
      assertNone(code);
      assertSome(
        O.map(problem, (failure) => failure.message),
        "Access to Microsoft 365 was not approved in the browser, so nothing was connected."
      );
    })
  );

  it.effect("refuses a redirect whose state does not match", () =>
    Effect.gen(function* () {
      const { code, problem } = yield* authorize(() => ({ code: "auth-code-2", state: "forged" }));
      assertNone(code);
      assertSome(
        O.map(problem, (failure) => failure.message),
        "The Microsoft sign-in answer did not match this request. Try again."
      );
    })
  );
});

const tempDataDir = FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix: "practice-gateway-m365-" }));

describe("DPAPI token cache", () => {
  it.layer(Layer.merge(Platform, WindowsSecretStore.layerMemory), { timeout: layerTimeout })("on disk", (it) => {
    it.effect("loads nothing before the first sign-in and round-trips the cache", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        const file = path.join(yield* tempDataDir, ...M365_TOKEN_CACHE_SEGMENTS);
        const cache = yield* makeDpapiTokenCache(file);
        assertNone(yield* cache.load);
        yield* cache.save('{"Account":{}}');
        assertSome(yield* cache.load, '{"Account":{}}');
        expect(yield* fs.exists(`${file}.tmp`)).toBe(false);
      })
    );
  });
});

const signInLayer = (options: { readonly clientId?: string; readonly secrets: boolean }) =>
  Layer.unwrap(
    tempDataDir.pipe(
      Effect.map((dataDir) =>
        M365SignIn.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              settingsLayer({ dataDir, ...(options.clientId === undefined ? {} : { m365ClientId: options.clientId }) }),
              answeringBrowser(() => ({})),
              options.secrets ? WindowsSecretStore.layerMemory : Layer.empty
            )
          )
        )
      )
    )
  ).pipe(Layer.provide(Platform));

describe("M365SignIn", () => {
  it.layer(signInLayer({ secrets: true }), { timeout: layerTimeout })("without an app id", (it) => {
    it.effect("is not configured, and sign-in says so", () =>
      Effect.gen(function* () {
        const signIn = yield* M365SignIn;
        expect((yield* Effect.flip(signIn.connection)).message).toBe(m365NotConfigured);
        expect((yield* Effect.flip(signIn.signIn)).message).toBe(m365NotConfigured);
      })
    );
  });

  it.layer(signInLayer({ clientId: "client-1", secrets: false }), { timeout: layerTimeout })(
    "without the Windows secret store",
    (it) => {
      it.effect("refuses to keep tokens", () =>
        Effect.gen(function* () {
          const failure = yield* Effect.flip(M365SignIn.use((signIn) => signIn.connection));
          expect(failure.message).toContain("protected storage");
        })
      );
    }
  );

  it.layer(signInLayer({ clientId: "client-1", secrets: true }), { timeout: layerTimeout })("configured", (it) => {
    it.effect("connects to the organizations tenant with the configured app id", () =>
      Effect.gen(function* () {
        const connection = yield* M365SignIn.use((signIn) => signIn.connection);
        expect(connection.config.clientId).toBe("client-1");
        expect(connection.config.tenantId).toBe("organizations");
        assertNone(yield* connection.tokenCache.load);
      })
    );
  });
});
