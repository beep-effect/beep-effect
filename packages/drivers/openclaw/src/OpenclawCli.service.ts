/**
 * Effect service wrapping the pinned OpenClaw CLI binary.
 *
 * Every operation runs the binary hermetically (`extendEnv: false` with the
 * environment produced by `hermeticOpenclawEnv`), keeps gateway tokens in the
 * environment — never argv — and decodes stdout through tolerant schema
 * projections. Nonzero exits are modeled as results wherever the contract
 * declares them assertable outcomes (config validation, doctor findings,
 * degraded secrets reloads).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenclawId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { Context, Duration, Effect, flow, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcessSpawner } from "effect/unstable/process";
import { spawnProcessResult } from "./internal/spawn.ts";
import {
  hermeticOpenclawEnv,
  OPENCLAW_CHANNEL_PROBE_TIMEOUT,
  OPENCLAW_DOCTOR_TIMEOUT,
  OPENCLAW_HEALTH_TIMEOUT,
  OPENCLAW_RELOAD_TIMEOUT,
  OPENCLAW_SCHEMA_TIMEOUT,
  OPENCLAW_VALIDATE_TIMEOUT,
  OPENCLAW_VERSION_TIMEOUT,
} from "./Openclaw.config.ts";
import { OpenclawCommandExitError, OpenclawCommandTimeoutError, OpenclawOutputParseError } from "./Openclaw.errors.ts";
import {
  OpenclawAgentTurn,
  OpenclawChannelAccountStatus,
  OpenclawChannelHealth,
  OpenclawConfigInvalid,
  OpenclawConfigValid,
  OpenclawDiagnosticText,
  OpenclawDoctorReport,
  OpenclawGatewayHealth,
  OpenclawProcessRequest,
  OpenclawSecretsReloadDegraded,
  OpenclawSecretsReloaded,
  OpenclawSecretsReloadOutput,
  OpenclawSkillInventory,
  OpenclawTelegramSendResult,
  OpenclawVersionInfo,
} from "./Openclaw.models.ts";
import type { OpenclawCliError } from "./Openclaw.errors.ts";
import type {
  OpenclawConfigValidation,
  OpenclawInvocationContext,
  OpenclawProcessResult,
  OpenclawSecretsReload,
} from "./Openclaw.models.ts";

const $I = $OpenclawId.create("OpenclawCli.service");

/**
 * Extra driver-side wall-clock granted to `agent` turns beyond the
 * CLI-enforced `--timeout <seconds>` so the binary can report its own
 * timeout result before the driver deadline fires.
 */
const agentTurnTimeoutGrace = Duration.seconds(15);

/**
 * Tolerant projection of the plugin section in the gateway health document.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawGatewayPluginsWire extends S.Class<OpenclawGatewayPluginsWire>($I`OpenclawGatewayPluginsWire`)(
  {
    errors: S.Array(S.Unknown).pipe(SchemaUtils.withKeyDefaults([])).annotateKey({
      description: "Plugin error entries reported by the gateway.",
    }),
    loaded: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults([])).annotateKey({
      description: "Names of plugins the gateway reports as loaded.",
    }),
  },
  $I.annote("OpenclawGatewayPluginsWire", {
    description: "Tolerant wire projection of the health document plugin section.",
  })
) {}

/**
 * Tolerant wire projection of `openclaw gateway call health --json` stdout.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawGatewayHealthWire extends S.Class<OpenclawGatewayHealthWire>($I`OpenclawGatewayHealthWire`)(
  {
    channels: S.Record(S.String, OpenclawChannelHealth).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Per-channel health sections keyed by channel name.",
    }),
    ok: S.Boolean.annotateKey({
      description: "Top-level gateway health verdict.",
    }),
    plugins: S.OptionFromOptionalKey(OpenclawGatewayPluginsWire).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Plugin section of the health document, when present.",
    }),
  },
  $I.annote("OpenclawGatewayHealthWire", {
    description: "Tolerant wire projection of the authenticated health call stdout.",
  })
) {}

/**
 * Tolerant wire projection of a per-account credential probe section.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawChannelProbeWire extends S.Class<OpenclawChannelProbeWire>($I`OpenclawChannelProbeWire`)(
  {
    error: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Credential probe error text, when the probe failed.",
    }),
    ok: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Credential probe verdict, when a probe ran.",
    }),
  },
  $I.annote("OpenclawChannelProbeWire", {
    description: "Tolerant wire projection of a channel account probe section.",
  })
) {}

/**
 * Wire envelope extracting the nested probe section of an account entry.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawChannelAccountEnvelopeWire extends S.Class<OpenclawChannelAccountEnvelopeWire>(
  $I`OpenclawChannelAccountEnvelopeWire`
)(
  {
    probe: S.OptionFromOptionalKey(OpenclawChannelProbeWire).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Nested probe section of the account entry, when present.",
    }),
  },
  $I.annote("OpenclawChannelAccountEnvelopeWire", {
    description: "Wire envelope for the nested probe section of an account entry.",
  })
) {}

/**
 * Tolerant wire projection of `openclaw channels status --json` stdout.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawChannelsStatusWire extends S.Class<OpenclawChannelsStatusWire>($I`OpenclawChannelsStatusWire`)(
  {
    channelAccounts: S.Record(S.String, S.Array(S.Unknown)).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Per-channel arrays of account entries keyed by channel name.",
    }),
  },
  $I.annote("OpenclawChannelsStatusWire", {
    description: "Tolerant wire projection of the channels status document.",
  })
) {}

/**
 * Tolerant wire projection of the agent turn provider/model identity.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawAgentIdentityWire extends S.Class<OpenclawAgentIdentityWire>($I`OpenclawAgentIdentityWire`)(
  {
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Model that served the turn, when reported.",
    }),
    provider: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider that served the turn, when reported.",
    }),
  },
  $I.annote("OpenclawAgentIdentityWire", {
    description: "Tolerant wire projection of `result.meta.agentMeta`.",
  })
) {}

/**
 * Tolerant wire projection of the agent turn result metadata.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawAgentMetaWire extends S.Class<OpenclawAgentMetaWire>($I`OpenclawAgentMetaWire`)(
  {
    aborted: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Whether the run aborted before completing.",
    }),
    agentMeta: S.OptionFromOptionalKey(OpenclawAgentIdentityWire).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider/model identity of the serving agent, when reported.",
    }),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Stop reason reported for the run, when present.",
    }),
  },
  $I.annote("OpenclawAgentMetaWire", {
    description: "Tolerant wire projection of `result.meta`.",
  })
) {}

/**
 * Tolerant wire projection of one agent turn response payload.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawAgentPayloadWire extends S.Class<OpenclawAgentPayloadWire>($I`OpenclawAgentPayloadWire`)(
  {
    text: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Response payload text, when present.",
    }),
  },
  $I.annote("OpenclawAgentPayloadWire", {
    description: "Tolerant wire projection of one `result.payloads[]` entry.",
  })
) {}

/**
 * Tolerant wire projection of the agent turn result section.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawAgentResultWire extends S.Class<OpenclawAgentResultWire>($I`OpenclawAgentResultWire`)(
  {
    meta: S.OptionFromOptionalKey(OpenclawAgentMetaWire).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Run metadata of the turn result, when present.",
    }),
    payloads: S.Array(OpenclawAgentPayloadWire).pipe(SchemaUtils.withKeyDefaults([])).annotateKey({
      description: "Response payloads emitted by the turn.",
    }),
  },
  $I.annote("OpenclawAgentResultWire", {
    description: "Tolerant wire projection of the agent turn `result` section.",
  })
) {}

/**
 * Tolerant wire projection of `openclaw agent --json` stdout.
 *
 * @category models
 * @since 0.0.0
 */
class OpenclawAgentTurnWire extends S.Class<OpenclawAgentTurnWire>($I`OpenclawAgentTurnWire`)(
  {
    result: S.OptionFromOptionalKey(OpenclawAgentResultWire).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Turn result section, when present.",
    }),
    runId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Gateway run identifier, when reported.",
    }),
    status: S.NonEmptyString.annotateKey({
      description: "Turn status reported by the CLI.",
    }),
  },
  $I.annote("OpenclawAgentTurnWire", {
    description: "Tolerant wire projection of `agent --json` stdout.",
  })
) {}

const decodeAgentTurnWire = S.decodeUnknownEffect(S.fromJsonString(OpenclawAgentTurnWire));
const decodeChannelAccount = S.decodeUnknownEffect(OpenclawChannelAccountStatus);
const decodeChannelAccountEnvelope = S.decodeUnknownEffect(OpenclawChannelAccountEnvelopeWire);
const decodeChannelsStatusWire = S.decodeUnknownEffect(S.fromJsonString(OpenclawChannelsStatusWire));
const decodeGatewayHealthWire = S.decodeUnknownEffect(S.fromJsonString(OpenclawGatewayHealthWire));
const decodeJsonDocument = UnknownFromJsonString.decodeUnknownEffect;
const decodeSecretsReloadOutput = S.decodeUnknownEffect(S.fromJsonString(OpenclawSecretsReloadOutput));
const decodeSkillInventory = S.decodeUnknownEffect(S.fromJsonString(OpenclawSkillInventory));
const decodeTelegramSendResult = S.decodeUnknownEffect(S.fromJsonString(OpenclawTelegramSendResult));

const isFlagToken = Str.startsWith("-");
const firstNonBlank = (primary: string, fallback: string): string =>
  pipe(
    primary,
    O.liftPredicate(flow(Str.trim, Str.isNonEmpty)),
    O.getOrElse(() => fallback)
  );
const stderrDiagnostics = (result: OpenclawProcessResult): OpenclawDiagnosticText =>
  OpenclawDiagnosticText.decodeUnknownSync(firstNonBlank(result.stderr, result.stdout));
const stdoutDiagnostics = (result: OpenclawProcessResult): OpenclawDiagnosticText =>
  OpenclawDiagnosticText.decodeUnknownSync(firstNonBlank(result.stdout, result.stderr));

const cliTimeoutArguments = (timeoutMs: number | undefined): ReadonlyArray<string> =>
  O.match(O.fromUndefinedOr(timeoutMs), {
    onNone: A.empty<string>,
    onSome: (ms) => ["--timeout", `${ms}`],
  });

const channelArguments = (channel: string | undefined): ReadonlyArray<string> =>
  O.match(O.fromUndefinedOr(channel), {
    onNone: A.empty<string>,
    onSome: (name) => ["--channel", name],
  });

const gatewayUrlArguments = (ctx: OpenclawInvocationContext): ReadonlyArray<string> =>
  O.match(ctx.gatewayUrl, {
    onNone: A.empty<string>,
    onSome: (url) => ["--url", url],
  });

const exitFailure = (
  executable: string,
  subcommand: string,
  result: OpenclawProcessResult,
  diagnostics: O.Option<OpenclawDiagnosticText>
): OpenclawCommandExitError =>
  OpenclawCommandExitError.make({
    diagnostics,
    executable,
    exitCode: result.exitCode,
    stderrLength: Str.length(result.stderr),
    stdoutLength: Str.length(result.stdout),
    subcommand,
  });

const parseFailure =
  (executable: string, subcommand: string, stdout: string) =>
  (cause: unknown): OpenclawOutputParseError =>
    OpenclawOutputParseError.make({
      cause,
      executable,
      stdoutLength: Str.length(stdout),
      subcommand,
    });

const projectGatewayHealth = (wire: OpenclawGatewayHealthWire): OpenclawGatewayHealth =>
  OpenclawGatewayHealth.make({
    channels: wire.channels,
    ok: wire.ok,
    pluginErrorCount: NonNegativeInt.make(
      pipe(
        wire.plugins,
        O.map((plugins) => A.length(plugins.errors)),
        O.getOrElse(() => 0)
      )
    ),
    pluginsLoaded: pipe(
      wire.plugins,
      O.map((plugins) => plugins.loaded),
      O.getOrElse(A.empty<string>)
    ),
  });

const projectAgentTurn = (wire: OpenclawAgentTurnWire): OpenclawAgentTurn => {
  const meta = O.flatMap(wire.result, (result) => result.meta);
  const agentIdentity = O.flatMap(meta, (turnMeta) => turnMeta.agentMeta);
  return OpenclawAgentTurn.make({
    aborted: O.flatMap(meta, (turnMeta) => turnMeta.aborted),
    model: O.flatMap(agentIdentity, (agentMeta) => agentMeta.model),
    provider: O.flatMap(agentIdentity, (agentMeta) => agentMeta.provider),
    runId: wire.runId,
    status: wire.status,
    stopReason: O.flatMap(meta, (turnMeta) => turnMeta.stopReason),
    text: pipe(
      wire.result,
      O.flatMap((result) => A.head(result.payloads)),
      O.flatMap((payload) => payload.text)
    ),
  });
};

const toChannelAccountStatus = (entry: unknown) =>
  Effect.map(Effect.all([decodeChannelAccount(entry), decodeChannelAccountEnvelope(entry)]), ([account, envelope]) =>
    OpenclawChannelAccountStatus.make({
      ...account,
      probeError: O.flatMap(envelope.probe, (probe) => probe.error),
      probeOk: O.flatMap(envelope.probe, (probe) => probe.ok),
    })
  );

/**
 * Injectable process runner used by the OpenClaw driver services.
 *
 * The live layers back this seam with a hermetic `ChildProcessSpawner`
 * execution; tests inject deterministic runners that capture the request and
 * return canned {@link OpenclawProcessResult} values.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProcessResult } from "@beep/openclaw/Openclaw.models"
 * import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service"
 * import { Effect } from "effect"
 *
 * const runner: OpenclawCliRunner = (request) =>
 *   Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: request.executable }))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type OpenclawCliRunner = (
  request: OpenclawProcessRequest
) => Effect.Effect<OpenclawProcessResult, OpenclawCliError>;

/**
 * Runtime shape exposed by the OpenClaw CLI driver service.
 *
 * @category services
 * @since 0.0.0
 */
interface OpenclawCliShape {
  readonly agentTurn: (
    ctx: OpenclawInvocationContext,
    options: {
      readonly agentId: string;
      readonly local?: boolean | undefined;
      readonly message: string;
      readonly timeoutSeconds: number;
    }
  ) => Effect.Effect<OpenclawAgentTurn, OpenclawCliError>;
  readonly channelsStatus: (
    ctx: OpenclawInvocationContext,
    options: {
      readonly channel?: string | undefined;
      readonly probe: boolean;
      readonly timeoutMs?: number | undefined;
    }
  ) => Effect.Effect<ReadonlyArray<OpenclawChannelAccountStatus>, OpenclawCliError>;
  readonly configSchema: (ctx: OpenclawInvocationContext) => Effect.Effect<unknown, OpenclawCliError>;
  readonly configValidate: (
    ctx: OpenclawInvocationContext
  ) => Effect.Effect<OpenclawConfigValidation, OpenclawCliError>;
  readonly doctor: (ctx: OpenclawInvocationContext) => Effect.Effect<OpenclawDoctorReport, OpenclawCliError>;
  readonly gatewayHealth: (
    ctx: OpenclawInvocationContext,
    options?: { readonly timeoutMs?: number | undefined }
  ) => Effect.Effect<OpenclawGatewayHealth, OpenclawCliError>;
  readonly messageSend: (
    ctx: OpenclawInvocationContext,
    options: { readonly message: string; readonly target: string }
  ) => Effect.Effect<OpenclawTelegramSendResult, OpenclawCliError>;
  readonly secretsReload: (
    ctx: OpenclawInvocationContext,
    options?: { readonly timeoutMs?: number | undefined }
  ) => Effect.Effect<OpenclawSecretsReload, OpenclawCliError>;
  readonly skillsList: (
    ctx: OpenclawInvocationContext,
    options: { readonly agentId: string; readonly eligible: true }
  ) => Effect.Effect<OpenclawSkillInventory, OpenclawCliError>;
  readonly version: (ctx: OpenclawInvocationContext) => Effect.Effect<OpenclawVersionInfo, OpenclawCliError>;
}

const subcommandLabel = (request: OpenclawProcessRequest): string =>
  pipe(
    request.args,
    A.filter(P.not(isFlagToken)),
    A.take(2),
    A.join(" "),
    O.liftPredicate(Str.isNonEmpty),
    O.orElse(() => A.head(request.args)),
    O.getOrElse(() => request.executable)
  );

const runHermetic = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  request: OpenclawProcessRequest
): Effect.Effect<OpenclawProcessResult, OpenclawCliError> =>
  spawnProcessResult({ extendEnv: false, request, spawner, subcommand: subcommandLabel(request) });

const makeService = (runner: OpenclawCliRunner): OpenclawCliShape => {
  const execute = Effect.fnUntraced(function* (
    ctx: OpenclawInvocationContext,
    subcommand: string,
    args: ReadonlyArray<string>,
    timeout: Duration.Duration,
    stdinText?: string
  ) {
    const timeoutMs = Duration.toMillis(timeout);
    const request = OpenclawProcessRequest.make({
      args,
      env: hermeticOpenclawEnv(ctx),
      executable: ctx.binaryPath,
      stdinText: O.fromUndefinedOr(stdinText),
      timeoutMs: O.some(timeoutMs),
    });

    return yield* runner(request).pipe(
      Effect.timeout(timeout),
      Effect.catchTag("TimeoutError", () =>
        Effect.fail(
          OpenclawCommandTimeoutError.make({
            executable: ctx.binaryPath,
            subcommand,
            timeoutMs,
          })
        )
      )
    );
  });

  const version = Effect.fn("OpenclawCli.version")(function* (ctx: OpenclawInvocationContext) {
    const result = yield* execute(ctx, "--version", ["--version"], OPENCLAW_VERSION_TIMEOUT);
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "--version", result, O.some(stderrDiagnostics(result)));
    }

    return yield* Effect.fromOption(OpenclawVersionInfo.fromVersionOutput(result.stdout), () =>
      parseFailure(ctx.binaryPath, "--version", result.stdout)("Unrecognized version output line.")
    );
  });

  const configValidate = Effect.fn("OpenclawCli.configValidate")(function* (
    ctx: OpenclawInvocationContext
  ): Effect.fn.Return<OpenclawConfigValidation, OpenclawCliError> {
    const result = yield* execute(ctx, "config validate", ["config", "validate"], OPENCLAW_VALIDATE_TIMEOUT);
    return result.exitCode === 0
      ? OpenclawConfigValid.make({ _tag: "Valid", output: stdoutDiagnostics(result) })
      : OpenclawConfigInvalid.make({
          _tag: "Invalid",
          diagnostics: stderrDiagnostics(result),
          exitCode: result.exitCode,
        });
  });

  const configSchema = Effect.fn("OpenclawCli.configSchema")(function* (ctx: OpenclawInvocationContext) {
    const result = yield* execute(ctx, "config schema", ["config", "schema"], OPENCLAW_SCHEMA_TIMEOUT);
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "config schema", result, O.none());
    }

    return yield* decodeJsonDocument(result.stdout).pipe(
      Effect.mapError(parseFailure(ctx.binaryPath, "config schema", result.stdout))
    );
  });

  const doctor = Effect.fn("OpenclawCli.doctor")(function* (ctx: OpenclawInvocationContext) {
    const result = yield* execute(ctx, "doctor", ["doctor", "--non-interactive"], OPENCLAW_DOCTOR_TIMEOUT);
    return OpenclawDoctorReport.make({
      exitCode: result.exitCode,
      findings: stdoutDiagnostics(result),
    });
  });

  const secretsReload = Effect.fn("OpenclawCli.secretsReload")(function* (
    ctx: OpenclawInvocationContext,
    options: { readonly timeoutMs?: number | undefined } = {}
  ): Effect.fn.Return<OpenclawSecretsReload, OpenclawCliError> {
    const args = [
      "secrets",
      "reload",
      "--json",
      ...cliTimeoutArguments(options.timeoutMs),
      ...gatewayUrlArguments(ctx),
    ];
    const result = yield* execute(ctx, "secrets reload", args, OPENCLAW_RELOAD_TIMEOUT);
    if (result.exitCode !== 0) {
      return OpenclawSecretsReloadDegraded.make({
        _tag: "Degraded",
        diagnostics: stdoutDiagnostics(result),
        exitCode: result.exitCode,
      });
    }

    const output = yield* decodeSecretsReloadOutput(result.stdout).pipe(
      Effect.mapError(parseFailure(ctx.binaryPath, "secrets reload", result.stdout))
    );
    return OpenclawSecretsReloaded.make({ _tag: "Reloaded", warningCount: output.warningCount });
  });

  const gatewayHealth = Effect.fn("OpenclawCli.gatewayHealth")(function* (
    ctx: OpenclawInvocationContext,
    options: { readonly timeoutMs?: number | undefined } = {}
  ) {
    const args = [
      "gateway",
      "call",
      "health",
      "--json",
      ...gatewayUrlArguments(ctx),
      ...cliTimeoutArguments(options.timeoutMs),
    ];
    const result = yield* execute(ctx, "gateway call health", args, OPENCLAW_HEALTH_TIMEOUT);
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "gateway call health", result, O.none());
    }

    return yield* decodeGatewayHealthWire(result.stdout).pipe(
      Effect.mapError(parseFailure(ctx.binaryPath, "gateway call health", result.stdout)),
      Effect.map(projectGatewayHealth)
    );
  });

  const channelsStatus = Effect.fn("OpenclawCli.channelsStatus")(function* (
    ctx: OpenclawInvocationContext,
    options: {
      readonly channel?: string | undefined;
      readonly probe: boolean;
      readonly timeoutMs?: number | undefined;
    }
  ): Effect.fn.Return<ReadonlyArray<OpenclawChannelAccountStatus>, OpenclawCliError> {
    const args = [
      "channels",
      "status",
      ...channelArguments(options.channel),
      ...(options.probe ? ["--probe"] : []),
      ...cliTimeoutArguments(options.timeoutMs),
      "--json",
    ];
    const result = yield* execute(ctx, "channels status", args, OPENCLAW_CHANNEL_PROBE_TIMEOUT);
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "channels status", result, O.none());
    }

    return yield* decodeChannelsStatusWire(result.stdout).pipe(
      Effect.flatMap((document) =>
        Effect.forEach(A.flatten(R.values(document.channelAccounts)), toChannelAccountStatus)
      ),
      Effect.mapError(parseFailure(ctx.binaryPath, "channels status", result.stdout))
    );
  });

  const agentTurn = Effect.fn("OpenclawCli.agentTurn")(function* (
    ctx: OpenclawInvocationContext,
    options: {
      readonly agentId: string;
      readonly local?: boolean | undefined;
      readonly message: string;
      readonly timeoutSeconds: number;
    }
  ) {
    const args = [
      "agent",
      "--agent",
      options.agentId,
      "--message-file",
      "-",
      "--thinking",
      "off",
      "--timeout",
      `${options.timeoutSeconds}`,
      "--json",
      ...(options.local === true ? ["--local"] : []),
    ];
    const timeout = Duration.sum(Duration.seconds(options.timeoutSeconds), agentTurnTimeoutGrace);
    const result = yield* execute(ctx, "agent", args, timeout, options.message);
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "agent", result, O.none());
    }

    return yield* decodeAgentTurnWire(result.stdout).pipe(
      Effect.mapError(parseFailure(ctx.binaryPath, "agent", result.stdout)),
      Effect.map(projectAgentTurn)
    );
  });

  const skillsList = Effect.fn("OpenclawCli.skillsList")(function* (
    ctx: OpenclawInvocationContext,
    options: { readonly agentId: string; readonly eligible: true }
  ) {
    const result = yield* execute(
      ctx,
      "skills list",
      ["skills", "list", "--json", "--eligible", "--agent", options.agentId],
      OPENCLAW_VALIDATE_TIMEOUT
    );
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "skills list", result, O.none());
    }
    return yield* decodeSkillInventory(result.stdout).pipe(
      Effect.mapError(parseFailure(ctx.binaryPath, "skills list", result.stdout))
    );
  });

  const messageSend = Effect.fn("OpenclawCli.messageSend")(function* (
    ctx: OpenclawInvocationContext,
    options: { readonly message: string; readonly target: string }
  ) {
    const result = yield* execute(
      ctx,
      "message send",
      ["message", "send", "--channel", "telegram", "--target", options.target, "--message", options.message, "--json"],
      OPENCLAW_CHANNEL_PROBE_TIMEOUT
    );
    if (result.exitCode !== 0) {
      return yield* exitFailure(ctx.binaryPath, "message send", result, O.none());
    }
    return yield* decodeTelegramSendResult(result.stdout).pipe(
      Effect.mapError(parseFailure(ctx.binaryPath, "message send", result.stdout))
    );
  });

  return {
    agentTurn,
    channelsStatus,
    configSchema,
    configValidate,
    doctor,
    gatewayHealth,
    messageSend,
    secretsReload,
    skillsList,
    version,
  };
};

/**
 * Effect service for hermetic execution of the pinned OpenClaw binary.
 *
 * **Details**
 *
 * Every operation takes an {@link OpenclawInvocationContext} carrying the
 * binary path and hermetic-environment inputs. Gateway tokens are injected
 * exclusively through `ctx.extraEnv` (as `OPENCLAW_GATEWAY_TOKEN`) and never
 * appear in argv. `doctor` always runs read-only (`--non-interactive`, never
 * `--fix`); `config validate` nonzero exits and degraded secrets reloads are
 * decodable results rather than error-channel failures.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawInvocationContext, OpenclawProcessResult } from "@beep/openclaw/Openclaw.models"
 * import { OpenclawCli } from "@beep/openclaw/OpenclawCli.service"
 * import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service"
 * import { Effect } from "effect"
 *
 * const runner: OpenclawCliRunner = () =>
 *   Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: "OpenClaw 2026.7.1-2 (0790d9f)" }))
 *
 * const program = Effect.gen(function* () {
 *   const cli = yield* OpenclawCli
 *   const info = yield* cli.version(OpenclawInvocationContext.make({ binaryPath: "openclaw" }))
 *   return info.version
 * }).pipe(Effect.provide(OpenclawCli.makeLayerFromRunner(runner)))
 *
 * console.log(program)
 * ```
 *
 * @effects
 * Live layers spawn the pinned `openclaw` binary hermetically through
 * `ChildProcessSpawner`; injected-runner layers perform only the effects
 * encoded by the supplied runner.
 *
 * @category services
 * @since 0.0.0
 */
export class OpenclawCli extends Context.Service<OpenclawCli, OpenclawCliShape>()($I`OpenclawCli`) {
  /**
   * Build a live OpenClaw CLI layer backed by hermetic child processes.
   *
   * ## Example: Usage
   * ```ts
   * import { OpenclawCli } from "@beep/openclaw/OpenclawCli.service"
   *
   * const layer = OpenclawCli.makeLayer()
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (): Layer.Layer<OpenclawCli, never, ChildProcessSpawner.ChildProcessSpawner> =>
    Layer.effect(
      OpenclawCli,
      Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        return OpenclawCli.of(makeService((request) => runHermetic(spawner, request)));
      })
    );

  /**
   * Build a deterministic test layer from an injected process runner.
   *
   * ## Example: Usage
   * ```ts
   * import { OpenclawProcessResult } from "@beep/openclaw/Openclaw.models"
   * import { OpenclawCli } from "@beep/openclaw/OpenclawCli.service"
   * import type { OpenclawCliRunner } from "@beep/openclaw/OpenclawCli.service"
   * import { Effect } from "effect"
   *
   * const runner: OpenclawCliRunner = () =>
   *   Effect.succeed(OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: "" }))
   *
   * console.log(OpenclawCli.makeLayerFromRunner(runner))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromRunner = (runner: OpenclawCliRunner): Layer.Layer<OpenclawCli> =>
    Layer.succeed(OpenclawCli, OpenclawCli.of(makeService(runner)));
}
