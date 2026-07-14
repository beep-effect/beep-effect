import {
  AiProviderCli,
  AiProviderCliAuthSnapshot,
  AiProviderCliError,
  AiProviderCliProcessResult,
} from "@beep/ai-provider-cli";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { AiProviderCliProvider } from "@beep/ai-provider-cli";

const claudeLoggedInStdout = `{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "apiProvider": "firstParty",
  "email": "dev@example.com",
  "orgId": "11111111-1111-1111-1111-111111111111",
  "orgName": "Example Org",
  "subscriptionType": "max"
}`;

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const snapshotWith = (provider: AiProviderCliProvider, result: AiProviderCliProcessResult) =>
  Effect.gen(function* () {
    const providerCli = yield* AiProviderCli;
    return yield* providerCli.checkAuthSnapshot(provider);
  }).pipe(provideScopedLayer(AiProviderCli.makeLayerFromRunner(() => Effect.succeed(result))));

describe("@beep/ai-provider-cli auth snapshots", () => {
  it.effect(
    "decodes a logged-in Claude status payload into a rich snapshot",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "claude",
        AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: claudeLoggedInStdout })
      );

      expect(snapshot.provider).toBe("claude");
      expect(snapshot.status).toBe("authenticated");
      expect(snapshot.email).toEqual(O.some("dev@example.com"));
      expect(snapshot.subscriptionLabel).toEqual(O.some("Claude Max Subscription"));
      expect(snapshot.tokenSource).toEqual(O.some("claude.ai"));
    })
  );

  it.effect(
    "maps unknown Claude subscription types to the generic label",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "claude",
        AiProviderCliProcessResult.make({
          exitCode: 0,
          stderr: "",
          stdout: `{"loggedIn": true, "authMethod": "claude.ai", "subscriptionType": "galactic"}`,
        })
      );

      expect(snapshot.status).toBe("authenticated");
      expect(snapshot.subscriptionLabel).toEqual(O.some("Claude Subscription"));
    })
  );

  it.effect(
    "reports a logged-out Claude CLI as not authenticated with no account detail",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "claude",
        AiProviderCliProcessResult.make({ exitCode: 1, stderr: "", stdout: `{"loggedIn": false}` })
      );

      expect(snapshot.status).toBe("not-authenticated");
      expect(snapshot.email).toEqual(O.none());
      expect(snapshot.subscriptionLabel).toEqual(O.none());
      expect(snapshot.tokenSource).toEqual(O.none());
    })
  );

  it.effect(
    "degrades malformed Claude stdout to the exit-code-only interpretation",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "claude",
        AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: "definitely not json" })
      );

      expect(snapshot.status).toBe("authenticated");
      expect(snapshot.email).toEqual(O.none());
      expect(snapshot.subscriptionLabel).toEqual(O.none());
      expect(snapshot.tokenSource).toEqual(O.none());
    })
  );

  it.effect(
    "classifies the Codex ChatGPT status line as a chatgpt token source",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "codex",
        AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: "Logged in using ChatGPT" })
      );

      expect(snapshot.provider).toBe("codex");
      expect(snapshot.status).toBe("authenticated");
      expect(snapshot.email).toEqual(O.none());
      expect(snapshot.subscriptionLabel).toEqual(O.none());
      expect(snapshot.tokenSource).toEqual(O.some("chatgpt"));
    })
  );

  it.effect(
    "classifies the Codex API key status line as an api-key token source",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "codex",
        AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: "Logged in using an API key" })
      );

      expect(snapshot.status).toBe("authenticated");
      expect(snapshot.tokenSource).toEqual(O.some("api-key"));
    })
  );

  it.effect(
    "reports a Codex non-zero exit as not authenticated with no token source",
    Effect.fnUntraced(function* () {
      const snapshot = yield* snapshotWith(
        "codex",
        AiProviderCliProcessResult.make({ exitCode: 1, stderr: "Not logged in", stdout: "" })
      );

      expect(snapshot.status).toBe("not-authenticated");
      expect(snapshot.tokenSource).toEqual(O.none());
    })
  );

  it.effect(
    "propagates transport failures as AiProviderCliError",
    Effect.fnUntraced(function* () {
      const failure = AiProviderCliError.make({
        command: O.some("claude"),
        message: "Failed to execute provider CLI status command.",
        operation: "checkAuth",
        provider: "claude",
      });
      const error = yield* Effect.gen(function* () {
        const providerCli = yield* AiProviderCli;
        return yield* providerCli.checkAuthSnapshot("claude");
      }).pipe(provideScopedLayer(AiProviderCli.makeLayerFromRunner(() => Effect.fail(failure))), Effect.flip);

      expect(error._tag).toBe("AiProviderCliError");
      expect(error.provider).toBe("claude");
    })
  );

  it("keeps the encoded snapshot wire shape byte-identical", () => {
    const fullSnapshot = AiProviderCliAuthSnapshot.make({
      email: O.some("dev@example.com"),
      provider: "claude",
      status: "authenticated",
      subscriptionLabel: O.some("Claude Max Subscription"),
      tokenSource: O.some("claude.ai"),
    });
    const minimalSnapshot = AiProviderCliAuthSnapshot.make({
      provider: "codex",
      status: "not-authenticated",
    });

    expect(Result.getOrThrow(S.encodeResult(AiProviderCliAuthSnapshot)(fullSnapshot))).toEqual({
      email: "dev@example.com",
      provider: "claude",
      status: "authenticated",
      subscriptionLabel: "Claude Max Subscription",
      tokenSource: "claude.ai",
    });
    expect(Result.getOrThrow(S.encodeResult(AiProviderCliAuthSnapshot)(minimalSnapshot))).toEqual({
      provider: "codex",
      status: "not-authenticated",
    });
  });
});
