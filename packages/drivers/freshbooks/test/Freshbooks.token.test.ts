import {
  FreshbooksAuth,
  FreshbooksConfigInput,
  FreshbooksStoredToken,
  FreshbooksTokenStore,
  makeFreshbooksAuthLayer,
} from "@beep/freshbooks";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { Cause, Context, Effect, Layer, Redacted, Ref } from "effect";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type { FreshbooksError } from "@beep/freshbooks";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

/**
 * A mock FreshBooks OAuth token server that enforces single-use refresh
 * tokens: a refresh presenting anything other than the currently-valid refresh
 * token is rejected with 401, exactly as FreshBooks does. It counts how many
 * network refreshes actually happened so the serialization proof can assert a
 * single owner performed the rotation.
 */
type TokenServerShape = {
  readonly refreshCount: Effect.Effect<number>;
  readonly currentRefresh: Effect.Effect<string>;
  readonly handle: (request: HttpClientRequest.HttpClientRequest) => Effect.Effect<Response>;
};

class TokenServer extends Context.Service<TokenServer, TokenServerShape>()(
  "@beep/freshbooks/test/Freshbooks.token.test/TokenServer"
) {}

const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { "content-type": "application/json" }, status });

const decodeBody = (request: HttpClientRequest.HttpClientRequest): Record<string, string> => {
  const body = request.body;
  if (body._tag !== "Uint8Array") {
    return {};
  }
  return JSON.parse(new TextDecoder().decode(body.body)) as Record<string, string>;
};

const TokenServerLayer = (initialRefresh: string): Layer.Layer<TokenServer> =>
  Layer.effect(
    TokenServer,
    Effect.gen(function* () {
      const refreshRef = yield* Ref.make(initialRefresh);
      const countRef = yield* Ref.make(0);
      let issued = 0;

      return TokenServer.of({
        refreshCount: Ref.get(countRef),
        currentRefresh: Ref.get(refreshRef),
        handle: Effect.fn("TokenServer.handle")(function* (request) {
          const payload = decodeBody(request);
          if (payload.grant_type === "refresh_token") {
            const valid = yield* Ref.get(refreshRef);
            if (payload.refresh_token !== valid) {
              return jsonResponse({ error: "invalid_grant" }, 401);
            }
            yield* Ref.update(countRef, (n) => n + 1);
          }
          issued += 1;
          const nextRefresh = `refresh-${issued}`;
          yield* Ref.set(refreshRef, nextRefresh);
          return jsonResponse({
            access_token: `access-${issued}`,
            token_type: "Bearer",
            expires_in: 43_200,
            refresh_token: nextRefresh,
            scope: "user:profile:read",
          });
        }),
      });
    })
  );

const MockHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const server = yield* TokenServer;
    return HttpClient.make((request) =>
      Effect.map(server.handle(request), (response) => HttpClientResponse.fromWeb(request, response))
    );
  })
);

const config = FreshbooksConfigInput.make({
  clientId: "test-client-id",
  clientSecret: Redacted.make("test-client-secret"),
  redirectUri: "https://localhost:8443/callback",
});

// A token already past expiry (epoch 0), forcing a refresh on first access.
const expiredToken = FreshbooksStoredToken.make({
  accessToken: Redacted.make("access-0"),
  refreshToken: Redacted.make("refresh-0"),
  expiresAt: 0,
});

// A token valid far into the future: `accessToken` reuses it, but an explicit
// `refresh` must still rotate it (revoked-before-expiry recovery).
const freshToken = FreshbooksStoredToken.make({
  accessToken: Redacted.make("access-0"),
  refreshToken: Redacted.make("refresh-0"),
  expiresAt: 4_102_444_800_000,
});

const AuthLayer = (
  initial: FreshbooksStoredToken
): Layer.Layer<FreshbooksAuth | FreshbooksTokenStore | TokenServer, FreshbooksError> =>
  makeFreshbooksAuthLayer(config).pipe(
    Layer.provideMerge(FreshbooksTokenStore.layerMemory(initial)),
    Layer.provide(MockHttpClientLayer),
    Layer.provideMerge(TokenServerLayer("refresh-0"))
  );

describe("@beep/freshbooks token rotation", () => {
  layer(AuthLayer(expiredToken))((it) => {
    it.effect(
      "serializes concurrent refreshes to a single owner (one network refresh)",
      Effect.fnUntraced(function* () {
        const auth = yield* FreshbooksAuth;
        const server = yield* TokenServer;

        // 25 fibers demand a token at once; the seeded token is expired.
        const tokens = yield* Effect.all(
          A.makeBy(25, () => auth.accessToken),
          { concurrency: "unbounded" }
        );

        const count = yield* server.refreshCount;
        expect(count).toBe(1);

        // Every fiber observed the same rotated access token.
        const values = tokens.map(Redacted.value);
        expect(A.every(values, (value) => value === "access-1")).toBe(true);
      })
    );

    it.effect(
      "persists the rotated single-use token before releasing",
      Effect.fnUntraced(function* () {
        const auth = yield* FreshbooksAuth;
        const store = yield* FreshbooksTokenStore;
        const server = yield* TokenServer;

        yield* auth.accessToken;

        const stored = yield* store.read;
        const currentRefresh = yield* server.currentRefresh;
        expect(stored._tag).toBe("Some");
        if (stored._tag === "Some") {
          // The persisted refresh token matches the server's now-valid one:
          // the old refresh token is consumed and gone.
          expect(Redacted.value(stored.value.refreshToken)).toBe(currentRefresh);
          expect(Redacted.value(stored.value.refreshToken)).not.toBe("refresh-0");
          // Under the deterministic TestClock (now = 0), expiry is exactly
          // now + expires_in(43200s) in millis.
          expect(stored.value.expiresAt).toBe(43_200_000);
        }
      })
    );

    it.effect(
      "reuses a still-fresh token without a network refresh",
      Effect.fnUntraced(function* () {
        const auth = yield* FreshbooksAuth;
        const server = yield* TokenServer;

        yield* auth.accessToken; // triggers the single rotation
        const first = yield* server.refreshCount;
        yield* auth.accessToken; // token now fresh — no network call
        yield* auth.accessToken;
        const second = yield* server.refreshCount;

        expect(first).toBe(1);
        expect(second).toBe(1);
      })
    );
  });

  const EmptyStoreAuthLayer = makeFreshbooksAuthLayer(config).pipe(
    Layer.provideMerge(FreshbooksTokenStore.layerMemory()),
    Layer.provide(MockHttpClientLayer),
    Layer.provideMerge(TokenServerLayer("refresh-0"))
  );

  layer(EmptyStoreAuthLayer)((it) => {
    it.effect(
      "fails with a token-refresh error when no token has been granted",
      Effect.fnUntraced(function* () {
        const auth = yield* FreshbooksAuth;
        const exit = yield* Effect.exit(auth.accessToken);

        expect(exit._tag).toBe("Failure");
        if (exit._tag === "Failure") {
          const error = Cause.findErrorOption(exit.cause);
          expect(error._tag).toBe("Some");
          if (error._tag === "Some") {
            expect(error.value.reason).toBe("token refresh");
          }
        }
      })
    );
  });

  layer(AuthLayer(freshToken))((it) => {
    it.effect(
      "forces a rotation on explicit refresh even when the stored token is still fresh",
      Effect.fnUntraced(function* () {
        const auth = yield* FreshbooksAuth;
        const server = yield* TokenServer;

        // accessToken reuses the fresh token without a network refresh.
        yield* auth.accessToken;
        expect(yield* server.refreshCount).toBe(0);

        // An explicit refresh rotates it anyway (revoked-before-expiry case).
        const rotated = yield* auth.refresh;
        expect(yield* server.refreshCount).toBe(1);
        expect(Redacted.value(rotated)).toBe("access-1");
      })
    );
  });
});
