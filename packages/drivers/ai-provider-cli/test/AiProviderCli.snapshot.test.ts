import * as NodeOS from "node:os";
import {
  AiProviderCli,
  AiProviderCliAuthSnapshot,
  AiProviderCliError,
  AiProviderCliProbeOptions,
  AiProviderCliProcessResult,
  expandTildePath,
} from "@beep/ai-provider-cli";
import * as HostPath from "@beep/utils/Path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Logger, Ref, References, Result } from "effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import type { AiProviderCliRunRequest } from "@beep/ai-provider-cli";

const encodeAiProviderCliAuthSnapshotResult = S.encodeResult(AiProviderCliAuthSnapshot);
const isAiProviderCliError = S.is(AiProviderCliError);

const claudeLoggedInStdout = `{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "apiProvider": "firstParty",
  "email": "dev@example.com",
  "orgId": "11111111-1111-1111-1111-111111111111",
  "orgName": "Example Org",
  "subscriptionType": "max"
}`;

describe("@beep/ai-provider-cli auth snapshots", () => {
  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: claudeLoggedInStdout }))
    )
  )("decodes a logged-in Claude status payload into a rich snapshot", (it) => {
    it.effect(
      "decodes a logged-in Claude status payload into a rich snapshot",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("claude");

        expect(snapshot.provider).toBe("claude");
        expect(snapshot.status).toBe("authenticated");
        expect(snapshot.email).toEqual(O.some("dev@example.com"));
        expect(snapshot.subscriptionLabel).toEqual(O.some("Claude Max Subscription"));
        expect(snapshot.tokenSource).toEqual(O.some("claude.ai"));
      })
    );
  });

  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(
        AiProviderCliProcessResult.make({
          exitCode: 0,
          stderr: "",
          stdout: `{"loggedIn": true, "authMethod": "claude.ai", "subscriptionType": "galactic"}`,
        })
      )
    )
  )("maps unknown Claude subscription types to the generic label", (it) => {
    it.effect(
      "maps unknown Claude subscription types to the generic label",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("claude");

        expect(snapshot.status).toBe("authenticated");
        expect(snapshot.subscriptionLabel).toEqual(O.some("Claude Subscription"));
      })
    );
  });

  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(AiProviderCliProcessResult.make({ exitCode: 1, stderr: "", stdout: `{"loggedIn": false}` }))
    )
  )("reports a logged-out Claude CLI as not authenticated with no account detail", (it) => {
    it.effect(
      "reports a logged-out Claude CLI as not authenticated with no account detail",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("claude");

        expect(snapshot.status).toBe("not-authenticated");
        expect(snapshot.email).toEqual(O.none());
        expect(snapshot.subscriptionLabel).toEqual(O.none());
        expect(snapshot.tokenSource).toEqual(O.none());
      })
    );
  });

  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: "definitely not json" }))
    )
  )("degrades malformed Claude stdout to the exit-code-only interpretation", (it) => {
    it.effect(
      "degrades malformed Claude stdout to the exit-code-only interpretation",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("claude");

        expect(snapshot.status).toBe("authenticated");
        expect(snapshot.email).toEqual(O.none());
        expect(snapshot.subscriptionLabel).toEqual(O.none());
        expect(snapshot.tokenSource).toEqual(O.none());
      })
    );
  });

  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: "Logged in using ChatGPT" }))
    )
  )("classifies the Codex ChatGPT status line as a chatgpt token source", (it) => {
    it.effect(
      "classifies the Codex ChatGPT status line as a chatgpt token source",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("codex");

        expect(snapshot.provider).toBe("codex");
        expect(snapshot.status).toBe("authenticated");
        expect(snapshot.email).toEqual(O.none());
        expect(snapshot.subscriptionLabel).toEqual(O.none());
        expect(snapshot.tokenSource).toEqual(O.some("chatgpt"));
      })
    );
  });

  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: "Logged in using an API key" }))
    )
  )("classifies the Codex API key status line as an api-key token source", (it) => {
    it.effect(
      "classifies the Codex API key status line as an api-key token source",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("codex");

        expect(snapshot.status).toBe("authenticated");
        expect(snapshot.tokenSource).toEqual(O.some("api-key"));
      })
    );
  });

  it.layer(
    AiProviderCli.makeLayerFromRunner(() =>
      Effect.succeed(AiProviderCliProcessResult.make({ exitCode: 1, stderr: "Not logged in", stdout: "" }))
    )
  )("reports a Codex non-zero exit as not authenticated with no token source", (it) => {
    it.effect(
      "reports a Codex non-zero exit as not authenticated with no token source",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;
        const snapshot = yield* providerCli.checkAuthSnapshot("codex");

        expect(snapshot.status).toBe("not-authenticated");
        expect(snapshot.tokenSource).toEqual(O.none());
      })
    );
  });

  describe("transport failure", () => {
    const failure = AiProviderCliError.make({
      command: O.some("claude"),
      message: "Failed to execute provider CLI status command.",
      operation: "checkAuth",
      provider: "claude",
    });
    it.layer(AiProviderCli.makeLayerFromRunner(() => Effect.fail(failure)))((it) => {
      it.effect(
        "propagates transport failures as AiProviderCliError",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.gen(function* () {
            const providerCli = yield* AiProviderCli;
            return yield* providerCli.checkAuthSnapshot("claude");
          }).pipe(Effect.flip);

          expect(error._tag).toBe("AiProviderCliError");
          expect(error.provider).toBe("claude");
        })
      );
    });
  });

  describe("native failure diagnostics", () => {
    const executable = "/nonexistent/claude-secret-path";
    const secret = "AI_PROVIDER_SECRET_MARKER";
    const annotations: Array<Record<string, unknown>> = [];
    const logger = Logger.make<unknown, void>((options) => {
      annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
    });
    const failingSpawnerLayer = Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() =>
        Effect.fail(
          PlatformError.systemError({
            _tag: "NotFound",
            cause: new Error(secret),
            method: "spawn",
            module: "ChildProcess",
            pathOrDescriptor: executable,
          })
        )
      )
    );
    const nativeLayer = AiProviderCli.makeLayer({ claudePath: executable }).pipe(Layer.provide(failingSpawnerLayer));
    const testLayer = Layer.mergeAll(
      nativeLayer,
      Logger.layer([logger]),
      Layer.succeed(References.MinimumLogLevel, "Debug")
    );

    it.layer(testLayer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "logs safe process diagnostics before translating native failures",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.gen(function* () {
            const providerCli = yield* AiProviderCli;
            return yield* providerCli.checkAuth(
              "claude",
              AiProviderCliProbeOptions.make({ env: { TEST_AI_PROVIDER_SECRET: secret } })
            );
          }).pipe(Effect.flip);

          expect(error._tag).toBe("AiProviderCliError");
          expect(error.command).toEqual(O.none());
          expect(error.stderr).toEqual(O.some("unknown"));
          expect(error.message).not.toContain(secret);
          expect(error.message).not.toContain(executable);
          expect(annotations).toEqual([
            {
              "ai_provider_cli.operation": "checkAuth",
              "ai_provider_cli.provider": "claude",
              "process.error_kind": "NotFound",
              "process.method": "spawn",
              "process.module": "ChildProcess",
            },
          ]);
        })
      );
    });
  });

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

    expect(Result.getOrThrow(encodeAiProviderCliAuthSnapshotResult(fullSnapshot))).toEqual({
      email: "dev@example.com",
      provider: "claude",
      status: "authenticated",
      subscriptionLabel: "Claude Max Subscription",
      tokenSource: "claude.ai",
    });
    expect(Result.getOrThrow(encodeAiProviderCliAuthSnapshotResult(minimalSnapshot))).toEqual({
      provider: "codex",
      status: "not-authenticated",
    });
  });
});

describe("@beep/ai-provider-cli executable overrides", () => {
  it("expands Windows-style tilde prefixes with host path semantics", () => {
    expect(expandTildePath("~\\bin\\claude")).toBe(HostPath.join(NodeOS.homedir(), "bin\\claude"));
  });

  describe("expands a tilde executable override before it reaches the runner", () => {
    const lastRunRequest = Ref.makeUnsafe<O.Option<AiProviderCliRunRequest>>(O.none());
    const CapturingLayer = AiProviderCli.makeLayerFromRunner(
      (request) =>
        Ref.set(lastRunRequest, O.some(request)).pipe(
          Effect.as(AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: claudeLoggedInStdout }))
        ),
      { claudePath: "~/bin/claude" }
    );
    it.layer(CapturingLayer)((it) => {
      it.effect(
        "expands a tilde executable override before it reaches the runner",
        Effect.fnUntraced(function* () {
          yield* Ref.set(lastRunRequest, O.none());
          const providerCli = yield* AiProviderCli;
          yield* providerCli.checkAuthSnapshot(
            "claude",
            AiProviderCliProbeOptions.make({ executable: O.some("~/bin/claude") })
          );
          const request = O.getOrThrow(yield* Ref.get(lastRunRequest));
          expect(request.executable).toBe(HostPath.join(NodeOS.homedir(), "bin/claude"));
        })
      );
    });
  });

  describe("rejects an off-allowlist executable before invoking the runner", () => {
    const runnerInvoked = Ref.makeUnsafe(false);
    const CapturingLayer = AiProviderCli.makeLayerFromRunner((request) =>
      Ref.set(runnerInvoked, true).pipe(
        Effect.as(AiProviderCliProcessResult.make({ exitCode: 0, stderr: "", stdout: request.executable }))
      )
    );
    it.layer(CapturingLayer)((it) => {
      it.effect(
        "rejects an off-allowlist executable before invoking the runner",
        Effect.fnUntraced(function* () {
          yield* Ref.set(runnerInvoked, false);
          const error = yield* Effect.gen(function* () {
            const providerCli = yield* AiProviderCli;
            return yield* providerCli.checkAuthSnapshot(
              "claude",
              AiProviderCliProbeOptions.make({ executable: O.some("/tmp/arbitrary-executable") })
            );
          }).pipe(Effect.flip);

          expect(isAiProviderCliError(error)).toBe(true);
          expect(yield* Ref.get(runnerInvoked)).toBe(false);
        })
      );
    });
  });
});
