/**
 * Effect service for redacted Claude and Codex CLI status probes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiProviderCliId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Context, Effect, Layer, Match, Result, Stream, Tuple } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { AiProviderCliError } from "./AiProviderCli.errors.ts";
import {
  AiProviderCliAuthProbe,
  AiProviderCliAuthSnapshot,
  AiProviderCliClaudeAuthStatusPayload,
  AiProviderCliClaudeSubscriptionLabel,
  AiProviderCliProbeOptions,
  AiProviderCliProcessResult,
  AiProviderCliProvider,
  AiProviderCliRunRequest,
  AiProviderCliTokenSource,
} from "./AiProviderCli.models.ts";
import { expandTildePath } from "./AiProviderCliHome.service.ts";

const $I = $AiProviderCliId.create("AiProviderCli.service");

/**
 * Injectable process runner used by provider CLI auth probes.
 *
 * @remarks
 * The service supplies the normalized provider, executable path, and status
 * arguments. Custom runners should return captured stdout, stderr, and exit
 * code without performing auth-status interpretation themselves.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiProviderCliProcessResult, type AiProviderCliRunner } from "@beep/ai-provider-cli"
 *
 * const runner: AiProviderCliRunner = (request) =>
 *   Effect.succeed(
 *     AiProviderCliProcessResult.make({
 *       exitCode: request.provider === "claude" ? 0 : 1,
 *       stderr: "",
 *       stdout: `${request.executable} ${request.args.join(" ")}`
 *     })
 *   )
 *
 * const result = Effect.runSync(runner({
 *   args: ["auth", "status"], env: {}, executable: "claude", provider: "claude"
 * }))
 *
 * console.log(result.stdout) // "claude auth status"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type AiProviderCliRunner = (
  request: AiProviderCliRunRequest
) => Effect.Effect<AiProviderCliProcessResult, AiProviderCliError>;

/**
 * Runtime shape exposed by the provider CLI driver service.
 *
 * @category services
 * @since 0.0.0
 */
interface AiProviderCliShape {
  readonly checkAuth: (
    provider: AiProviderCliProvider,
    options?: (typeof AiProviderCliProbeOptions)["~type.make.in"]
  ) => Effect.Effect<AiProviderCliAuthProbe, AiProviderCliError>;
  readonly checkAuthSnapshot: (
    provider: AiProviderCliProvider,
    options?: (typeof AiProviderCliProbeOptions)["~type.make.in"]
  ) => Effect.Effect<AiProviderCliAuthSnapshot, AiProviderCliError>;
}

/**
 * Provider CLI executable configuration.
 *
 * @category models
 * @since 0.0.0
 */
class AiProviderCliPaths extends S.Class<AiProviderCliPaths>($I`AiProviderCliPaths`)(
  {
    claudePath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("claude")).annotateKey({
      description: "Executable command or path for Claude CLI auth probes.",
    }),
    codexPath: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("codex")).annotateKey({
      description: "Executable command or path for Codex CLI auth probes.",
    }),
  },
  $I.annote("AiProviderCliPaths", {
    description: "Configuration for the AI provider CLI executable paths",
  })
) {}

const commandFor = (
  paths: AiProviderCliPaths,
  provider: AiProviderCliProvider
): readonly [string, ReadonlyArray<string>] =>
  AiProviderCliProvider.$match(provider, {
    claude: () => [paths.claudePath, ["auth", "status"]] as const,
    codex: () => [paths.codexPath, ["login", "status"]] as const,
  });

const executableEquivalence = S.toEquivalence(S.String);

const runNative = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  request: AiProviderCliRunRequest
): Effect.Effect<AiProviderCliProcessResult, AiProviderCliError> => {
  const command = ChildProcess.make(request.executable, A.fromIterable(request.args), {
    env: request.env,
    extendEnv: true,
    // fallow-ignore-next-line code-duplication -- The approved process-hardening spec keeps output ownership inside each driver boundary.
    stdin: "ignore",
    stderr: "pipe",
    stdout: "pipe",
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
          handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );

      return AiProviderCliProcessResult.make({ exitCode, stderr, stdout });
    })
  ).pipe(
    Effect.tapError((error) =>
      Effect.logDebug("AI provider CLI process failed").pipe(
        Effect.annotateLogs({
          "ai_provider_cli.operation": "checkAuth",
          "ai_provider_cli.provider": request.provider,
          "process.error_kind": error.reason._tag,
          "process.method": error.reason.method,
          "process.module": error.reason.module,
        })
      )
    ),
    Effect.mapError(() =>
      AiProviderCliError.make({
        command: O.none(),
        message: "Failed to execute provider CLI status command.",
        operation: "checkAuth",
        provider: request.provider,
        stderr: O.some("unknown"),
      })
    )
  );
};

const decodeClaudeAuthStatus = S.decodeUnknownEffect(S.fromJsonString(AiProviderCliClaudeAuthStatusPayload));

const claudeSubscriptionLabelFor = (subscriptionType: string): string =>
  Result.getOrElse(
    S.decodeUnknownResult(AiProviderCliClaudeSubscriptionLabel)(subscriptionType),
    () =>
      // Unknown tiers keep a stable generic label instead of failing the probe.
      "Claude Subscription"
  );

const exitCodeOnlySnapshot = (
  provider: AiProviderCliProvider,
  result: AiProviderCliProcessResult
): AiProviderCliAuthSnapshot =>
  AiProviderCliAuthSnapshot.make({
    provider,
    status: result.exitCode === 0 ? "authenticated" : "not-authenticated",
  });

const claudeSnapshot = (result: AiProviderCliProcessResult): Effect.Effect<AiProviderCliAuthSnapshot> =>
  decodeClaudeAuthStatus(result.stdout).pipe(
    Effect.map((payload) =>
      AiProviderCliAuthSnapshot.make({
        email: payload.email,
        provider: "claude",
        status: payload.loggedIn ? "authenticated" : "not-authenticated",
        subscriptionLabel: O.map(payload.subscriptionType, claudeSubscriptionLabelFor),
        tokenSource: O.filter(payload.authMethod, S.is(AiProviderCliTokenSource)),
      })
    ),
    // Malformed stdout degrades to the exit-code-only probe; raw output never leaks.
    Effect.catchTag("SchemaError", () => Effect.succeed(exitCodeOnlySnapshot("claude", result)))
  );

const codexTokenSource: (stdout: string) => O.Option<AiProviderCliTokenSource> = Match.type<string>().pipe(
  Match.when(Str.includes("ChatGPT"), () => O.some(AiProviderCliTokenSource.Enum.chatgpt)),
  Match.when(Str.includes("API key"), () => O.some(AiProviderCliTokenSource.Enum["api-key"])),
  Match.orElse(O.none<AiProviderCliTokenSource>)
);

const codexSnapshot = (result: AiProviderCliProcessResult): AiProviderCliAuthSnapshot =>
  AiProviderCliAuthSnapshot.make({
    provider: "codex",
    status: result.exitCode === 0 ? "authenticated" : "not-authenticated",
    tokenSource: result.exitCode === 0 ? codexTokenSource(result.stdout) : O.none(),
  });

const makeService = (paths: AiProviderCliPaths, runner: AiProviderCliRunner): AiProviderCliShape => {
  const runProbe = Effect.fn("AiProviderCli.runProbe")(function* (
    provider: AiProviderCliProvider,
    inputOptions?: (typeof AiProviderCliProbeOptions)["~type.make.in"]
  ) {
    const [defaultExecutable, args] = commandFor(paths, provider);
    const options = AiProviderCliProbeOptions.make(inputOptions ?? {});
    const allowedExecutable = expandTildePath(defaultExecutable);
    const executable = yield* Effect.filterOrFail(
      Effect.succeed(expandTildePath(O.getOrElse(options.executable, () => defaultExecutable))),
      (candidate) => executableEquivalence(candidate, allowedExecutable),
      () =>
        AiProviderCliError.make({
          command: O.none(),
          message: "Executable override is not allowed for this provider CLI status command.",
          operation: "checkAuth",
          provider,
        })
    );
    const result = yield* runner(
      AiProviderCliRunRequest.make({
        args,
        env: options.env,
        executable,
        provider,
      })
    );

    return Tuple.make(defaultExecutable, result);
  });

  return {
    checkAuth: Effect.fn("AiProviderCli.checkAuth")(function* (provider, inputOptions) {
      const [defaultExecutable, result] = yield* runProbe(provider, inputOptions);

      return AiProviderCliAuthProbe.make({
        command: defaultExecutable,
        provider,
        status: result.exitCode === 0 ? "authenticated" : "not-authenticated",
      });
    }),
    checkAuthSnapshot: Effect.fn("AiProviderCli.checkAuthSnapshot")(function* (provider, inputOptions) {
      const [, result] = yield* runProbe(provider, inputOptions);

      return yield* AiProviderCliProvider.$match(provider, {
        claude: () => claudeSnapshot(result),
        codex: () => Effect.succeed(codexSnapshot(result)),
      });
    }),
  };
};

/**
 * Effect service for redacted Claude and Codex CLI authentication checks.
 *
 * @remarks
 * `checkAuth` maps provider-specific status commands to a stable
 * `AiProviderCliAuthProbe`. It only treats exit code `0` as authenticated; the
 * returned probe never includes raw account, token, stdout, or stderr data.
 * `checkAuthSnapshot` layers optional account email, subscription label, and
 * token source on top by schema-decoding Claude stdout JSON and classifying
 * the Codex status line; undecodable output degrades to the exit-code-only
 * interpretation instead of leaking raw output.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AiProviderCli, AiProviderCliProcessResult, type AiProviderCliRunner } from "@beep/ai-provider-cli"
 *
 * const runner: AiProviderCliRunner = (request) =>
 *   Effect.succeed(
 *     AiProviderCliProcessResult.make({
 *       exitCode: request.provider === "claude" ? 0 : 1,
 *       stderr: "",
 *       stdout: request.executable
 *     })
 *   )
 *
 * const program = Effect.gen(function* () {
 *   const cli = yield* AiProviderCli
 *   const probe = yield* cli.checkAuth("claude")
 *   return probe.status
 * }).pipe(Effect.provide(AiProviderCli.makeLayerFromRunner(runner)))
 *
 * console.log(Effect.runSync(program)) // "authenticated"
 * ```
 *
 * @effects
 * Live layers spawn `claude auth status` or `codex login status` through
 * `ChildProcessSpawner`; injected-runner layers perform only the effects
 * encoded by the supplied runner.
 *
 * @category services
 * @since 0.0.0
 */
export class AiProviderCli extends Context.Service<AiProviderCli, AiProviderCliShape>()($I`AiProviderCli`) {
  /**
   * Build a live provider CLI layer backed by native child processes.
   *
   * @example
   * ```ts
   * import { AiProviderCli } from "@beep/ai-provider-cli"
   *
   * const layer = AiProviderCli.makeLayer({
   *   claudePath: "claude",
   *   codexPath: "codex"
   * })
   *
   * console.log(layer)
   * ```
   *
   * @effects
   * Services produced by this layer spawn the configured provider CLI command
   * whenever `checkAuth` is evaluated.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    paths: (typeof AiProviderCliPaths)["~type.make.in"] = {}
  ): Layer.Layer<AiProviderCli, never, ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.effect(
      AiProviderCli,
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const providerPaths = AiProviderCliPaths.make(paths);
        return AiProviderCli.of(makeService(providerPaths, (request) => runNative(spawner, request)));
      })
    );

  /**
   * Build a deterministic test layer from an injected command runner.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import { AiProviderCli, AiProviderCliProcessResult, type AiProviderCliRunner } from "@beep/ai-provider-cli"
   *
   * const runner: AiProviderCliRunner = (request) =>
   *   Effect.succeed(
   *     AiProviderCliProcessResult.make({
   *       exitCode: request.provider === "codex" ? 0 : 1,
   *       stderr: "",
   *       stdout: ""
   *     })
   *   )
   *
   * const program = Effect.gen(function* () {
   *   const cli = yield* AiProviderCli
   *   return yield* cli.checkAuth("codex")
   * }).pipe(Effect.provide(AiProviderCli.makeLayerFromRunner(runner)))
   *
   * console.log(Effect.runSync(program).status) // "authenticated"
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromRunner = (
    runner: AiProviderCliRunner,
    paths: (typeof AiProviderCliPaths)["~type.make.in"] = {}
  ): Layer.Layer<AiProviderCli> =>
    Layer.succeed(AiProviderCli, AiProviderCli.of(makeService(AiProviderCliPaths.make(paths), runner)));
}
