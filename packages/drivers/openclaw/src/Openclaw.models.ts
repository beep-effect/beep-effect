/**
 * CLI output, process, and probe models for the OpenClaw driver.
 *
 * Upstream CLI JSON documents are rich and version-fluid; every model here is
 * a tolerant projection that decodes only the fields the driver asserts.
 * Diagnostic text is trim-normalized and capped so no model ever carries raw
 * token-bearing process output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenclawId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { flow, identity, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OpenclawAbsolutePath, OpenclawTargetVersion } from "./OpenclawIntent.models.ts";

const $I = $OpenclawId.create("Openclaw.models");
const diagnosticTextCapLength = 2_000;
const versionLinePattern = /^OpenClaw\s+(\S+)(?:\s+\((\S+)\))?/u;
const npmShasumPattern = /^[0-9a-f]{40}$/u;
const npmIntegrityPattern = /^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/u;
const OpenclawProcessStdinBase = LiteralKit(["ignore"]);
const OpenclawSystemdActiveStateBase = LiteralKit(["active", "inactive", "failed", "activating", "deactivating"]);
const OpenclawHttpProbeStatusBase = LiteralKit(["healthy", "unreachable"]);
const OpenclawSchemaPlaceholderReasonBase = LiteralKit(["missing", "placeholder"]);
const OpenclawLiveAcceptanceStepBase = LiteralKit(["hosted-model", "local-model", "skill", "reload", "telegram"]);
const withActiveStateDecodeOption = SchemaUtils.withStatics((schema: typeof OpenclawSystemdActiveStateBase) => ({
  decodeOption: S.decodeUnknownOption(schema),
}));
const OpenclawNpmShasum = S.String.check(
  S.isPattern(npmShasumPattern, {
    identifier: "OpenclawNpmShasum",
    title: "OpenClaw npm dist shasum",
    description: "A 40-character lowercase hex npm dist shasum.",
    message: "Expected a 40-character lowercase hex shasum",
  })
);
const OpenclawNpmIntegrity = S.String.check(
  S.isPattern(npmIntegrityPattern, {
    identifier: "OpenclawNpmIntegrity",
    title: "OpenClaw npm dist integrity",
    description: "An SRI integrity string (sha256/sha384/sha512).",
    message: "Expected an SRI integrity string",
  })
);
const OpenclawAdapterVersion = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    identifier: "OpenclawAdapterVersion",
    title: "OpenClaw adapter version",
    description: "A positive render-adapter version number.",
    message: "Expected a positive adapter version",
  })
);
const OpenclawDiagnosticTextTarget = S.Trimmed.check(
  S.isMaxLength(diagnosticTextCapLength, {
    identifier: "OpenclawDiagnosticTextLength",
    title: "OpenClaw diagnostic text length",
    description: "Diagnostic text is capped at 2000 characters.",
    message: "Expected diagnostic text of at most 2000 characters",
  })
);

/**
 * Process exit status accepted from OpenClaw and systemctl invocations.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawExitCode } from "@beep/openclaw/Openclaw.models"
 *
 * const exitCode = OpenclawExitCode.make(0)
 * console.log(exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawExitCode = S.Int.check(S.isBetween({ minimum: 0, maximum: 255 })).pipe(
  $I.annoteSchema("OpenclawExitCode", {
    description: "Integer process exit status in the conventional 0-255 CLI range.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OpenclawExitCode}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawExitCode } from "@beep/openclaw/Openclaw.models"
 *
 * const exitCode: OpenclawExitCode = 1
 * console.log(exitCode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawExitCode = typeof OpenclawExitCode.Type;

/**
 * Trim-normalized redacted diagnostic text capped at 2000 characters.
 *
 * Decoding trims surrounding whitespace and truncates oversized text so
 * diagnostics never smuggle full process output (or secrets embedded in it)
 * into errors or reports.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawDiagnosticText } from "@beep/openclaw/Openclaw.models"
 *
 * const diagnostic = OpenclawDiagnosticText.fromUnknown(" secrets.reload failed\n")
 * console.log(diagnostic) // "secrets.reload failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawDiagnosticText = S.String.pipe(
  S.decodeTo(
    OpenclawDiagnosticTextTarget,
    SchemaTransformation.transform({
      decode: flow(Str.trim, Str.slice(0, diagnosticTextCapLength), Str.trim),
      encode: identity,
    })
  ),
  $I.annoteSchema("OpenclawDiagnosticText", {
    description: "Trim-normalized redacted diagnostic text capped at 2000 characters.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OpenclawDiagnosticText}.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawDiagnosticText } from "@beep/openclaw/Openclaw.models"
 *
 * const diagnostic: OpenclawDiagnosticText = OpenclawDiagnosticText.fromUnknown("Gateway did not respond")
 * console.log(diagnostic)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawDiagnosticText = typeof OpenclawDiagnosticText.Type;

/**
 * Complete technical request passed to an injected OpenClaw process runner.
 *
 * The environment is an execution boundary only — it can carry the gateway
 * token and must never be rendered into diagnostics, errors, or spans.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProcessRequest } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const request = OpenclawProcessRequest.make({
 *   args: ["config", "validate"],
 *   env: { OPENCLAW_NIX_MODE: "1", PATH: "/opt/node/bin:/usr/bin:/bin" },
 *   executable: "/opt/openclaw/node_modules/.bin/openclaw",
 *   timeoutMs: O.some(45000)
 * })
 * console.log(request.stdin) // "ignore"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawProcessRequest extends S.Class<OpenclawProcessRequest>($I`OpenclawProcessRequest`)(
  {
    args: S.Array(S.String).annotateKey({
      description: "Arguments passed to the executable; tokens never appear here.",
    }),
    env: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Hermetic environment supplied only to the child process.",
    }),
    executable: S.NonEmptyString.annotateKey({
      description: "Executable command or path used by the child process.",
    }),
    stdin: OpenclawProcessStdinBase.pipe(SchemaUtils.withKeyDefaults("ignore")).annotateKey({
      description: "Standard-input policy; defaults to ignored unless a private stdin payload is present.",
    }),
    stdinText: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Private standard-input payload supplied to the child without placing it in argv.",
    }),
    timeoutMs: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional per-invocation timeout in milliseconds.",
    }),
  },
  $I.annote("OpenclawProcessRequest", {
    description: "Technical OpenClaw child-process invocation request.",
  })
) {}

/**
 * Process output captured from an OpenClaw or systemctl command.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawProcessResult } from "@beep/openclaw/Openclaw.models"
 *
 * const result = OpenclawProcessResult.make({ exitCode: 0, stderr: "", stdout: "OpenClaw 2026.7.1-2 (0790d9f)" })
 * console.log(result.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawProcessResult extends S.Class<OpenclawProcessResult>($I`OpenclawProcessResult`)(
  {
    exitCode: OpenclawExitCode.annotateKey({
      description: "Child process exit status.",
    }),
    stderr: S.String.annotateKey({
      description: "Raw standard error captured from the child process.",
    }),
    stdout: S.String.annotateKey({
      description: "Raw standard output captured from the child process.",
    }),
  },
  $I.annote("OpenclawProcessResult", {
    description: "Stdout, stderr, and exit code captured from a driver child process.",
  })
) {}

/**
 * Version facts parsed from `openclaw --version` output.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawVersionInfo } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const info = O.getOrThrow(OpenclawVersionInfo.fromVersionOutput("OpenClaw 2026.7.1-2 (0790d9f)"))
 * console.log(info.version) // "2026.7.1-2"
 * console.log(O.getOrThrow(info.commit)) // "0790d9f"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawVersionInfo extends S.Class<OpenclawVersionInfo>($I`OpenclawVersionInfo`)(
  {
    commit: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Short git commit reported in parentheses, when present.",
    }),
    raw: S.NonEmptyString.annotateKey({
      description: "Trimmed raw version line as printed by the binary.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Version string parsed from the version line.",
    }),
  },
  $I.annote("OpenclawVersionInfo", {
    description: "Version facts parsed from `openclaw --version` output.",
  })
) {
  /**
   * Parse `openclaw --version` stdout (e.g. `OpenClaw 2026.7.1-2 (0790d9f)`).
   *
   * ## Example: Usage
   * ```ts
   * import { OpenclawVersionInfo } from "@beep/openclaw/Openclaw.models"
   * import * as O from "effect/Option"
   *
   * console.log(O.isNone(OpenclawVersionInfo.fromVersionOutput("command not found"))) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly fromVersionOutput = (output: string): O.Option<OpenclawVersionInfo> => {
    const raw = Str.trim(output);
    return O.flatMap(O.fromNullishOr(versionLinePattern.exec(raw)), (match) =>
      O.map(O.fromUndefinedOr(match[1]), (version) =>
        OpenclawVersionInfo.make({
          commit: O.fromUndefinedOr(match[2]),
          raw,
          version,
        })
      )
    );
  };
}

/**
 * Successful `openclaw config validate` outcome.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawConfigValid } from "@beep/openclaw/Openclaw.models"
 *
 * const valid = OpenclawConfigValid.make({ _tag: "Valid", output: "Config is valid" })
 * console.log(valid._tag) // "Valid"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawConfigValid extends S.Class<OpenclawConfigValid>($I`OpenclawConfigValid`)(
  {
    _tag: S.tag("Valid").annotateKey({
      description: "Discriminator for successful config validation.",
    }),
    output: OpenclawDiagnosticText.annotateKey({
      description: "Trimmed capped validator output.",
    }),
  },
  $I.annote("OpenclawConfigValid", {
    description: "Successful `config validate` outcome.",
  })
) {}

/**
 * Failed `openclaw config validate` outcome.
 *
 * A nonzero validate exit is a decodable result — negative fixtures must be
 * assertable — not an error-channel failure.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawConfigInvalid } from "@beep/openclaw/Openclaw.models"
 *
 * const invalid = OpenclawConfigInvalid.make({
 *   _tag: "Invalid",
 *   diagnostics: "Unknown top-level key: unexpected",
 *   exitCode: 1
 * })
 * console.log(invalid.exitCode) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawConfigInvalid extends S.Class<OpenclawConfigInvalid>($I`OpenclawConfigInvalid`)(
  {
    _tag: S.tag("Invalid").annotateKey({
      description: "Discriminator for failed config validation.",
    }),
    diagnostics: OpenclawDiagnosticText.annotateKey({
      description: "Trimmed capped validator diagnostics.",
    }),
    exitCode: OpenclawExitCode.annotateKey({
      description: "Nonzero validate process exit status.",
    }),
  },
  $I.annote("OpenclawConfigInvalid", {
    description: "Failed `config validate` outcome with capped diagnostics.",
  })
) {}

/**
 * Result of running `openclaw config validate`.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawConfigValid, OpenclawConfigValidation } from "@beep/openclaw/Openclaw.models"
 * import * as S from "effect/Schema"
 *
 * const outcome = OpenclawConfigValid.make({ _tag: "Valid", output: "" })
 * console.log(S.is(OpenclawConfigValidation)(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawConfigValidation = S.Union([OpenclawConfigValid, OpenclawConfigInvalid]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OpenclawConfigValidation", {
    description: "Tagged union of `config validate` outcomes.",
  })
);

/**
 * Runtime type for {@link OpenclawConfigValidation}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawConfigValidation } from "@beep/openclaw/Openclaw.models"
 * import { OpenclawConfigValid } from "@beep/openclaw/Openclaw.models"
 *
 * const outcome: OpenclawConfigValidation = OpenclawConfigValid.make({ _tag: "Valid", output: "" })
 * console.log(outcome._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawConfigValidation = typeof OpenclawConfigValidation.Type;

/**
 * Read-only `openclaw doctor --non-interactive` report.
 *
 * Doctor may exit nonzero with findings; that is a report, not a driver
 * error.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawDoctorReport } from "@beep/openclaw/Openclaw.models"
 *
 * const report = OpenclawDoctorReport.make({ exitCode: 1, findings: "Doctor config writes are disabled" })
 * console.log(report.exitCode) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawDoctorReport extends S.Class<OpenclawDoctorReport>($I`OpenclawDoctorReport`)(
  {
    exitCode: OpenclawExitCode.annotateKey({
      description: "Doctor process exit status; nonzero means findings were reported.",
    }),
    findings: OpenclawDiagnosticText.annotateKey({
      description: "Trimmed capped doctor findings text.",
    }),
  },
  $I.annote("OpenclawDoctorReport", {
    description: "Read-only doctor report with capped findings text.",
  })
) {}

/**
 * Wire projection of successful `openclaw secrets reload --json` stdout.
 *
 * The pinned binary prints exactly `{ "ok": true, "warningCount": 0 }` on
 * success.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSecretsReloadOutput } from "@beep/openclaw/Openclaw.models"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const output = Result.getOrThrow(
 *   S.decodeUnknownResult(S.fromJsonString(OpenclawSecretsReloadOutput))('{ "ok": true, "warningCount": 0 }')
 * )
 * console.log(output.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSecretsReloadOutput extends S.Class<OpenclawSecretsReloadOutput>($I`OpenclawSecretsReloadOutput`)(
  {
    ok: S.Boolean.annotateKey({
      description: "Whether the runtime snapshot swap succeeded.",
    }),
    warningCount: NonNegativeInt.annotateKey({
      description: "Number of warnings emitted during the reload.",
    }),
  },
  $I.annote("OpenclawSecretsReloadOutput", {
    description: "Tolerant projection of `secrets reload --json` stdout.",
  })
) {}

/**
 * Successful secrets reload outcome.
 *
 * **Example** (Usage)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { OpenclawSecretsReloaded } from "@beep/openclaw/Openclaw.models"
 *
 * const reloaded = OpenclawSecretsReloaded.make({ _tag: "Reloaded", warningCount: NonNegativeInt.make(0) })
 * console.log(reloaded.warningCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSecretsReloaded extends S.Class<OpenclawSecretsReloaded>($I`OpenclawSecretsReloaded`)(
  {
    _tag: S.tag("Reloaded").annotateKey({
      description: "Discriminator for successful secrets reloads.",
    }),
    warningCount: NonNegativeInt.annotateKey({
      description: "Number of warnings emitted during the reload.",
    }),
  },
  $I.annote("OpenclawSecretsReloaded", {
    description: "Successful secrets reload outcome.",
  })
) {}

/**
 * Degraded secrets reload outcome — an expected, assertable result.
 *
 * The CLI stdout only carries generic text (`secrets.reload failed`,
 * `Gateway did not respond`); the causal `SECRETS_RELOADER_DEGRADED` detail
 * lands exclusively in the gateway log, never here.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSecretsReloadDegraded } from "@beep/openclaw/Openclaw.models"
 *
 * const degraded = OpenclawSecretsReloadDegraded.make({
 *   _tag: "Degraded",
 *   diagnostics: "secrets.reload failed",
 *   exitCode: 1
 * })
 * console.log(degraded._tag) // "Degraded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSecretsReloadDegraded extends S.Class<OpenclawSecretsReloadDegraded>(
  $I`OpenclawSecretsReloadDegraded`
)(
  {
    _tag: S.tag("Degraded").annotateKey({
      description: "Discriminator for degraded secrets reloads.",
    }),
    diagnostics: OpenclawDiagnosticText.annotateKey({
      description: "Trimmed capped CLI diagnostics; causal detail lives in the gateway log.",
    }),
    exitCode: OpenclawExitCode.annotateKey({
      description: "Nonzero reload process exit status.",
    }),
  },
  $I.annote("OpenclawSecretsReloadDegraded", {
    description: "Degraded secrets reload outcome with capped CLI diagnostics.",
  })
) {}

/**
 * Result of running `openclaw secrets reload --json`.
 *
 * **Example** (Usage)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { OpenclawSecretsReload, OpenclawSecretsReloaded } from "@beep/openclaw/Openclaw.models"
 * import * as S from "effect/Schema"
 *
 * const outcome = OpenclawSecretsReloaded.make({ _tag: "Reloaded", warningCount: NonNegativeInt.make(0) })
 * console.log(S.is(OpenclawSecretsReload)(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawSecretsReload = S.Union([OpenclawSecretsReloaded, OpenclawSecretsReloadDegraded]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OpenclawSecretsReload", {
    description: "Tagged union of secrets reload outcomes.",
  })
);

/**
 * Runtime type for {@link OpenclawSecretsReload}.
 *
 * **Example** (Usage)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import type { OpenclawSecretsReload } from "@beep/openclaw/Openclaw.models"
 * import { OpenclawSecretsReloaded } from "@beep/openclaw/Openclaw.models"
 *
 * const outcome: OpenclawSecretsReload = OpenclawSecretsReloaded.make({
 *   _tag: "Reloaded",
 *   warningCount: NonNegativeInt.make(0)
 * })
 * console.log(outcome._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawSecretsReload = typeof OpenclawSecretsReload.Type;

/**
 * Per-channel health facts projected from the gateway health document.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawChannelHealth } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const channel = OpenclawChannelHealth.make({ connected: O.some(true), running: O.some(true) })
 * console.log(O.getOrThrow(channel.running)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawChannelHealth extends S.Class<OpenclawChannelHealth>($I`OpenclawChannelHealth`)(
  {
    connected: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Whether the channel reports an active upstream connection.",
    }),
    restartPending: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Whether a channel restart is pending.",
    }),
    running: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Whether the channel worker is running.",
    }),
    tokenSource: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported credential source (e.g. 'config' or 'env'), when present.",
    }),
    tokenStatus: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported credential status (e.g. 'available'), when present.",
    }),
  },
  $I.annote("OpenclawChannelHealth", {
    description: "Tolerant per-channel projection of the gateway health document.",
  })
) {}

/**
 * Normalized projection of `openclaw gateway call health --json`.
 *
 * **Example** (Usage)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { OpenclawGatewayHealth } from "@beep/openclaw/Openclaw.models"
 *
 * const health = OpenclawGatewayHealth.make({
 *   ok: true,
 *   pluginErrorCount: NonNegativeInt.make(0),
 *   pluginsLoaded: ["telegram", "ollama"]
 * })
 * console.log(health.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawGatewayHealth extends S.Class<OpenclawGatewayHealth>($I`OpenclawGatewayHealth`)(
  {
    channels: S.Record(S.String, OpenclawChannelHealth).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Per-channel health projections keyed by channel name.",
    }),
    ok: S.Boolean.annotateKey({
      description: "Top-level gateway health verdict.",
    }),
    pluginErrorCount: NonNegativeInt.annotateKey({
      description: "Number of plugin errors reported by the gateway.",
    }),
    pluginsLoaded: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults([])).annotateKey({
      description: "Names of plugins the gateway reports as loaded.",
    }),
  },
  $I.annote("OpenclawGatewayHealth", {
    description: "Normalized projection of the authenticated gateway health call.",
  })
) {}

/**
 * Per-account status projected from `openclaw channels status --probe --json`.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawChannelAccountStatus } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const account = OpenclawChannelAccountStatus.make({
 *   accountId: "default",
 *   configured: true,
 *   enabled: true,
 *   probeOk: O.some(true),
 *   running: true
 * })
 * console.log(account.accountId) // "default"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawChannelAccountStatus extends S.Class<OpenclawChannelAccountStatus>(
  $I`OpenclawChannelAccountStatus`
)(
  {
    accountId: S.NonEmptyString.annotateKey({
      description: "Channel account identifier.",
    }),
    configured: S.Boolean.annotateKey({
      description: "Whether the account has configuration present.",
    }),
    connected: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Whether the account reports an active upstream connection.",
    }),
    enabled: S.Boolean.annotateKey({
      description: "Whether the account is enabled.",
    }),
    probeError: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Credential probe error text, when the probe failed.",
    }),
    probeOk: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Credential probe verdict, when a probe was requested.",
    }),
    running: S.Boolean.annotateKey({
      description: "Whether the account worker is running.",
    }),
    tokenSource: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported credential source (e.g. 'config' or 'env'), when present.",
    }),
    tokenStatus: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported credential status (e.g. 'available'), when present.",
    }),
  },
  $I.annote("OpenclawChannelAccountStatus", {
    description: "Tolerant per-account projection of `channels status --probe --json`.",
  })
) {}

/**
 * Completed agent turn projected from `openclaw agent --json` output.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawAgentTurn } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const turn = OpenclawAgentTurn.make({
 *   aborted: O.some(false),
 *   status: "ok",
 *   stopReason: O.some("stop"),
 *   text: O.some("PONG")
 * })
 * console.log(turn.status) // "ok"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawAgentTurn extends S.Class<OpenclawAgentTurn>($I`OpenclawAgentTurn`)(
  {
    aborted: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Whether the run aborted before completing.",
    }),
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Model that served the turn, when reported.",
    }),
    provider: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider that served the turn, when reported.",
    }),
    runId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Gateway run identifier, when reported.",
    }),
    status: S.NonEmptyString.annotateKey({
      description: "Turn status reported by the CLI (e.g. 'ok').",
    }),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Stop reason reported for the run (e.g. 'stop'), when present.",
    }),
    text: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "First response payload text, when present.",
    }),
  },
  $I.annote("OpenclawAgentTurn", {
    description: "Tolerant projection of a completed `agent --json` turn.",
  })
) {}

/**
 * One entry from the pinned `skills list --json` inventory.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSkillInventoryEntry } from "@beep/openclaw"
 *
 * const skill = OpenclawSkillInventoryEntry.make({
 *   description: "Returns the fixed P3 proof sentinel.",
 *   eligible: true,
 *   name: "beep-proof-ping",
 *   source: "openclaw-workspace"
 * })
 * console.log(skill.eligible) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSkillInventoryEntry extends S.Class<OpenclawSkillInventoryEntry>($I`OpenclawSkillInventoryEntry`)(
  {
    description: S.NonEmptyString,
    eligible: S.Boolean,
    name: S.NonEmptyString,
    source: S.NonEmptyString,
  },
  $I.annote("OpenclawSkillInventoryEntry", {
    description: "Skill identity, eligibility, and source projected from the pinned CLI inventory.",
  })
) {}

/**
 * Pinned `skills list --json` output projection.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawAbsolutePath, OpenclawSkillInventory, OpenclawSkillInventoryEntry } from "@beep/openclaw"
 *
 * const inventory = OpenclawSkillInventory.make({
 *   skills: [
 *     OpenclawSkillInventoryEntry.make({
 *       description: "Returns the fixed P3 proof sentinel.",
 *       eligible: true,
 *       name: "beep-proof-ping",
 *       source: "openclaw-workspace"
 *     })
 *   ],
 *   workspaceDir: OpenclawAbsolutePath.make("/var/lib/beep/openclaw/workspace")
 * })
 * console.log(inventory.skills.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSkillInventory extends S.Class<OpenclawSkillInventory>($I`OpenclawSkillInventory`)(
  {
    skills: S.Array(OpenclawSkillInventoryEntry),
    workspaceDir: OpenclawAbsolutePath,
  },
  $I.annote("OpenclawSkillInventory", {
    description: "Workspace and skill entries returned by the pinned skills inventory command.",
  })
) {}

/**
 * Nested Telegram receipt payload emitted by the pinned message CLI.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawTelegramSendPayload } from "@beep/openclaw"
 *
 * const payload = OpenclawTelegramSendPayload.make({
 *   messageId: "telegram-message-42",
 *   ok: true
 * })
 * console.log(payload.messageId) // "telegram-message-42"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawTelegramSendPayload extends S.Class<OpenclawTelegramSendPayload>($I`OpenclawTelegramSendPayload`)(
  {
    messageId: S.NonEmptyString,
    ok: S.Literal(true),
  },
  $I.annote("OpenclawTelegramSendPayload", {
    description: "Successful Telegram plugin receipt payload.",
  })
) {}

/**
 * Sanitized successful `message send --json` result.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawTelegramSendPayload, OpenclawTelegramSendResult } from "@beep/openclaw"
 *
 * const result = OpenclawTelegramSendResult.make({
 *   action: "send",
 *   channel: "telegram",
 *   dryRun: false,
 *   handledBy: "telegram",
 *   messageId: "telegram-message-42",
 *   payload: OpenclawTelegramSendPayload.make({
 *     messageId: "telegram-message-42",
 *     ok: true
 *   })
 * })
 * console.log(result.payload.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawTelegramSendResult extends S.Class<OpenclawTelegramSendResult>($I`OpenclawTelegramSendResult`)(
  {
    action: S.Literal("send"),
    channel: S.Literal("telegram"),
    dryRun: S.Boolean,
    handledBy: S.NonEmptyString,
    messageId: S.NonEmptyString,
    payload: OpenclawTelegramSendPayload,
  },
  $I.annote("OpenclawTelegramSendResult", {
    description: "Successful Telegram message receipt without target or token data.",
  })
) {}

/**
 * One OpenAI-compatible model entry returned by a local `/models` endpoint.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLocalModelEntry } from "@beep/openclaw"
 *
 * const model = OpenclawLocalModelEntry.make({ id: "gemma3:4b" })
 * console.log(model.id) // "gemma3:4b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawLocalModelEntry extends S.Class<OpenclawLocalModelEntry>($I`OpenclawLocalModelEntry`)(
  { id: S.NonEmptyString },
  $I.annote("OpenclawLocalModelEntry", {
    description: "Configured model identifier projected from a local OpenAI-compatible endpoint.",
  })
) {}

/**
 * OpenAI-compatible local `/models` response projection.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLocalModelEntry, OpenclawLocalModels } from "@beep/openclaw"
 *
 * const models = OpenclawLocalModels.make({
 *   data: [OpenclawLocalModelEntry.make({ id: "gemma3:4b" })]
 * })
 * console.log(models.data[0]?.id) // "gemma3:4b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawLocalModels extends S.Class<OpenclawLocalModels>($I`OpenclawLocalModels`)(
  { data: S.Array(OpenclawLocalModelEntry) },
  $I.annote("OpenclawLocalModels", {
    description: "Model inventory returned by a local OpenAI-compatible `/models` endpoint.",
  })
) {}

/**
 * Acceptance sequence step names.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLiveAcceptanceStep } from "@beep/openclaw"
 *
 * console.log(OpenclawLiveAcceptanceStep.Options)
 * // ["hosted-model", "local-model", "skill", "reload", "telegram"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawLiveAcceptanceStep = OpenclawLiveAcceptanceStepBase.pipe(
  $I.annoteSchema("OpenclawLiveAcceptanceStep", {
    description: "Named P3 live acceptance sequence step.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawLiveAcceptanceStepBase)
);

/**
 * Runtime type for {@link OpenclawLiveAcceptanceStep}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawLiveAcceptanceStep } from "@beep/openclaw"
 *
 * const step: OpenclawLiveAcceptanceStep = "skill"
 * console.log(step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawLiveAcceptanceStep = typeof OpenclawLiveAcceptanceStep.Type;

/**
 * Fully decoded inputs consumed by the pure P3 acceptance coordinator.
 *
 * **Example** (Usage)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import {
 *   OpenclawAbsolutePath,
 *   OpenclawAgentTurn,
 *   OpenclawLiveAcceptanceInput,
 *   OpenclawLocalModelEntry,
 *   OpenclawLocalModels,
 *   OpenclawSecretsReloaded,
 *   OpenclawSkillInventory,
 *   OpenclawSkillInventoryEntry,
 *   OpenclawTelegramSendPayload,
 *   OpenclawTelegramSendResult
 * } from "@beep/openclaw"
 *
 * const input = OpenclawLiveAcceptanceInput.make({
 *   channelAccounts: [],
 *   hostedModelId: "legal-primary",
 *   hostedProviderId: "hosted",
 *   hostedTurn: OpenclawAgentTurn.make({ status: "ok" }),
 *   localModels: OpenclawLocalModels.make({
 *     data: [OpenclawLocalModelEntry.make({ id: "gemma3:4b" })]
 *   }),
 *   localModelId: "gemma3:4b",
 *   restoredReload: OpenclawSecretsReloaded.make({
 *     _tag: "Reloaded",
 *     warningCount: NonNegativeInt.make(0)
 *   }),
 *   skillInventory: OpenclawSkillInventory.make({
 *     skills: [
 *       OpenclawSkillInventoryEntry.make({
 *         description: "Returns the fixed P3 proof sentinel.",
 *         eligible: true,
 *         name: "beep-proof-ping",
 *         source: "openclaw-workspace"
 *       })
 *     ],
 *     workspaceDir: OpenclawAbsolutePath.make("/var/lib/beep/openclaw/workspace")
 *   }),
 *   skillTurn: OpenclawAgentTurn.make({ status: "ok" }),
 *   telegramSend: OpenclawTelegramSendResult.make({
 *     action: "send",
 *     channel: "telegram",
 *     dryRun: false,
 *     handledBy: "telegram",
 *     messageId: "telegram-message-42",
 *     payload: OpenclawTelegramSendPayload.make({
 *       messageId: "telegram-message-42",
 *       ok: true
 *     })
 *   })
 * })
 * console.log(input.localModelId) // "gemma3:4b"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawLiveAcceptanceInput extends S.Class<OpenclawLiveAcceptanceInput>($I`OpenclawLiveAcceptanceInput`)(
  {
    channelAccounts: S.Array(OpenclawChannelAccountStatus),
    hostedModelId: S.NonEmptyString,
    hostedProviderId: S.NonEmptyString,
    hostedTurn: OpenclawAgentTurn,
    localModels: OpenclawLocalModels,
    localModelId: S.NonEmptyString,
    restoredReload: OpenclawSecretsReload,
    skillInventory: OpenclawSkillInventory,
    skillTurn: OpenclawAgentTurn,
    telegramSend: OpenclawTelegramSendResult,
  },
  $I.annote("OpenclawLiveAcceptanceInput", {
    description: "Decoded hosted, local, skill, reload, and Telegram probe results.",
  })
) {}

/**
 * Successful result from the pure P3 acceptance coordinator.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLiveAcceptancePassed } from "@beep/openclaw"
 *
 * const result = OpenclawLiveAcceptancePassed.make({
 *   _tag: "Passed",
 *   steps: ["hosted-model", "local-model", "skill", "reload", "telegram"]
 * })
 * console.log(result._tag) // "Passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawLiveAcceptancePassed extends S.Class<OpenclawLiveAcceptancePassed>(
  $I`OpenclawLiveAcceptancePassed`
)(
  {
    _tag: S.tag("Passed"),
    steps: S.Array(OpenclawLiveAcceptanceStep),
  },
  $I.annote("OpenclawLiveAcceptancePassed", {
    description: "All supplied P3 acceptance assertions passed.",
  })
) {}

/**
 * Failed result from the pure P3 acceptance coordinator.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLiveAcceptanceFailed } from "@beep/openclaw"
 *
 * const result = OpenclawLiveAcceptanceFailed.make({
 *   _tag: "Failed",
 *   diagnostics: "Hosted model assertion failed.",
 *   step: "hosted-model"
 * })
 * console.log(result.step) // "hosted-model"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawLiveAcceptanceFailed extends S.Class<OpenclawLiveAcceptanceFailed>(
  $I`OpenclawLiveAcceptanceFailed`
)(
  {
    _tag: S.tag("Failed"),
    diagnostics: OpenclawDiagnosticText,
    step: OpenclawLiveAcceptanceStep,
  },
  $I.annote("OpenclawLiveAcceptanceFailed", {
    description: "One named P3 acceptance assertion failed closed.",
  })
) {}

/**
 * Tagged result returned by the pure P3 acceptance coordinator.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawLiveAcceptancePassed, OpenclawLiveAcceptanceResult } from "@beep/openclaw"
 * import * as S from "effect/Schema"
 *
 * const result = OpenclawLiveAcceptancePassed.make({
 *   _tag: "Passed",
 *   steps: ["local-model"]
 * })
 * console.log(S.is(OpenclawLiveAcceptanceResult)(result)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawLiveAcceptanceResult = S.Union([OpenclawLiveAcceptancePassed, OpenclawLiveAcceptanceFailed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OpenclawLiveAcceptanceResult", {
    description: "Passed or failed P3 live acceptance result.",
  })
);

/**
 * Runtime type for {@link OpenclawLiveAcceptanceResult}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawLiveAcceptanceResult } from "@beep/openclaw"
 * import { OpenclawLiveAcceptancePassed } from "@beep/openclaw"
 *
 * const result: OpenclawLiveAcceptanceResult = OpenclawLiveAcceptancePassed.make({
 *   _tag: "Passed",
 *   steps: ["local-model"]
 * })
 * console.log(result._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawLiveAcceptanceResult = typeof OpenclawLiveAcceptanceResult.Type;

/**
 * Invocation context shared by every OpenClaw CLI operation.
 *
 * Carries hermetic-environment inputs (paths, nix mode) and gateway
 * addressing. Gateway tokens travel only through `extraEnv`, never argv.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawInvocationContext } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const ctx = OpenclawInvocationContext.make({
 *   binaryPath: "/opt/openclaw/node_modules/.bin/openclaw",
 *   nodeBinDir: O.some("/opt/node/bin")
 * })
 * console.log(ctx.nixMode) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawInvocationContext extends S.Class<OpenclawInvocationContext>($I`OpenclawInvocationContext`)(
  {
    binaryPath: S.NonEmptyString.annotateKey({
      description: "Path of the pinned openclaw executable.",
    }),
    configPath: S.OptionFromOptionalKey(OpenclawAbsolutePath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Absolute path exported as OPENCLAW_CONFIG_PATH, when set.",
    }),
    extraEnv: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Additional environment entries; the gateway token travels here, never in argv.",
    }),
    gatewayUrl: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Gateway URL passed as --url for remote calls, when set.",
    }),
    home: S.OptionFromOptionalKey(OpenclawAbsolutePath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Isolated HOME directory for hermetic invocations, when set.",
    }),
    nixMode: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)).annotateKey({
      description: "Whether OPENCLAW_NIX_MODE=1 is exported; managed deployments keep this on.",
    }),
    nodeBinDir: S.OptionFromOptionalKey(OpenclawAbsolutePath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Pinned Node bin directory prepended to the hermetic PATH, when set.",
    }),
    stateDir: S.OptionFromOptionalKey(OpenclawAbsolutePath).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Absolute path exported as OPENCLAW_STATE_DIR, when set.",
    }),
  },
  $I.annote("OpenclawInvocationContext", {
    description: "Hermetic invocation context for OpenClaw CLI operations.",
  })
) {}

/**
 * systemd unit active states this driver recognizes.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSystemdActiveState } from "@beep/openclaw/Openclaw.models"
 *
 * console.log(OpenclawSystemdActiveState.Options)
 * // ["active", "inactive", "failed", "activating", "deactivating"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawSystemdActiveState = OpenclawSystemdActiveStateBase.pipe(
  $I.annoteSchema("OpenclawSystemdActiveState", {
    description: "Recognized systemd unit active states.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawSystemdActiveStateBase),
  withActiveStateDecodeOption
);

/**
 * Runtime type for {@link OpenclawSystemdActiveState}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawSystemdActiveState } from "@beep/openclaw/Openclaw.models"
 *
 * const state: OpenclawSystemdActiveState = "active"
 * console.log(state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawSystemdActiveState = typeof OpenclawSystemdActiveState.Type;

/**
 * Unit facts parsed from `systemctl --user show` key/value output.
 *
 * `activeState` keeps the raw reported string; {@link OpenclawSystemdUnitState.knownActiveState}
 * derives the recognized literal when the raw value is in the known domain.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSystemdUnitState } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const unit = OpenclawSystemdUnitState.make({ activeState: "active", mainPid: O.some(4242) })
 * console.log(O.getOrThrow(unit.knownActiveState)) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSystemdUnitState extends S.Class<OpenclawSystemdUnitState>($I`OpenclawSystemdUnitState`)(
  {
    activeState: S.NonEmptyString.annotateKey({
      description: "Raw ActiveState value reported by systemctl.",
    }),
    controlGroup: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported ControlGroup path, when present.",
    }),
    fragmentPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported FragmentPath unit-file location, when present.",
    }),
    mainPid: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Reported MainPID, when the unit has a main process.",
    }),
  },
  $I.annote("OpenclawSystemdUnitState", {
    description: "Unit facts parsed from `systemctl --user show` output.",
  })
) {
  /**
   * Recognized active-state literal derived from the raw `activeState`.
   *
   * @since 0.0.0
   */
  get knownActiveState(): O.Option<OpenclawSystemdActiveState> {
    return OpenclawSystemdActiveState.decodeOption(this.activeState);
  }
}

/**
 * HTTP probe verdicts for gateway liveness and readiness endpoints.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawHttpProbeStatus } from "@beep/openclaw/Openclaw.models"
 *
 * console.log(OpenclawHttpProbeStatus.Options) // ["healthy", "unreachable"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawHttpProbeStatus = OpenclawHttpProbeStatusBase.pipe(
  $I.annoteSchema("OpenclawHttpProbeStatus", {
    description: "HTTP probe verdict for a gateway endpoint.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawHttpProbeStatusBase)
);

/**
 * Runtime type for {@link OpenclawHttpProbeStatus}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawHttpProbeStatus } from "@beep/openclaw/Openclaw.models"
 *
 * const status: OpenclawHttpProbeStatus = "healthy"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawHttpProbeStatus = typeof OpenclawHttpProbeStatus.Type;

/**
 * Result of probing a gateway HTTP endpoint.
 *
 * Any 2xx response is `healthy`; transport failures and timeouts collapse to
 * `unreachable` — the probe itself never fails.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawHttpProbe } from "@beep/openclaw/Openclaw.models"
 * import * as O from "effect/Option"
 *
 * const probe = OpenclawHttpProbe.make({
 *   endpoint: "http://127.0.0.1:19031/health",
 *   httpStatus: O.some(200),
 *   status: "healthy"
 * })
 * console.log(probe.status) // "healthy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawHttpProbe extends S.Class<OpenclawHttpProbe>($I`OpenclawHttpProbe`)(
  {
    endpoint: S.NonEmptyString.annotateKey({
      description: "Probed endpoint URL.",
    }),
    httpStatus: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "HTTP status code, when a response was received.",
    }),
    status: OpenclawHttpProbeStatus.annotateKey({
      description: "Probe verdict; transport failures collapse to 'unreachable'.",
    }),
  },
  $I.annote("OpenclawHttpProbe", {
    description: "Never-failing HTTP probe result for a gateway endpoint.",
  })
) {}

/**
 * Reasons a declared extension surface is considered lossy in a schema export.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSchemaPlaceholderReason } from "@beep/openclaw/Openclaw.models"
 *
 * console.log(OpenclawSchemaPlaceholderReason.Options) // ["missing", "placeholder"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenclawSchemaPlaceholderReason = OpenclawSchemaPlaceholderReasonBase.pipe(
  $I.annoteSchema("OpenclawSchemaPlaceholderReason", {
    description: "Reason a declared extension surface is lossy in the exported schema.",
  }),
  SchemaUtils.withLiteralKitStatics(OpenclawSchemaPlaceholderReasonBase)
);

/**
 * Runtime type for {@link OpenclawSchemaPlaceholderReason}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OpenclawSchemaPlaceholderReason } from "@beep/openclaw/Openclaw.models"
 *
 * const reason: OpenclawSchemaPlaceholderReason = "missing"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenclawSchemaPlaceholderReason = typeof OpenclawSchemaPlaceholderReason.Type;

/**
 * A declared extension surface the `config schema` export cannot validate.
 *
 * Emitted by the lossy schema-export guard when the pinned binary's exported
 * JSON schema is missing a declared surface or collapses it to an
 * `additionalProperties: true` placeholder.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawSchemaPlaceholderFinding } from "@beep/openclaw/Openclaw.models"
 *
 * const finding = OpenclawSchemaPlaceholderFinding.make({ reason: "placeholder", surface: "channels.telegram" })
 * console.log(finding.surface) // "channels.telegram"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawSchemaPlaceholderFinding extends S.Class<OpenclawSchemaPlaceholderFinding>(
  $I`OpenclawSchemaPlaceholderFinding`
)(
  {
    reason: OpenclawSchemaPlaceholderReason.annotateKey({
      description: "Why the surface is lossy in the exported schema.",
    }),
    surface: S.NonEmptyString.annotateKey({
      description: "Dotted config path of the declared extension surface.",
    }),
  },
  $I.annote("OpenclawSchemaPlaceholderFinding", {
    description: "Lossy schema-export finding for a declared extension surface.",
  })
) {}

/**
 * One pinned Node/OpenClaw/adapter/fixture compatibility set.
 *
 * **Example** (Usage)
 * ```ts
 * import { OpenclawCompatibilitySet } from "@beep/openclaw/Openclaw.models"
 *
 * const set = OpenclawCompatibilitySet.make({
 *   adapterVersion: 1,
 *   nodeVersion: "24.16.0",
 *   npmIntegrity: "sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==",
 *   npmShasum: "4583b987ea7277230ce1c7b2b8535d3e219f57ac",
 *   openclawCommit: "0790d9f",
 *   openclawVersion: "2026.7.1-2"
 * })
 * console.log(set.openclawVersion) // "2026.7.1-2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenclawCompatibilitySet extends S.Class<OpenclawCompatibilitySet>($I`OpenclawCompatibilitySet`)(
  {
    adapterVersion: OpenclawAdapterVersion.annotateKey({
      description: "Render-adapter version keyed to the pinned OpenClaw version.",
    }),
    nodeVersion: S.NonEmptyString.annotateKey({
      description: "Pinned Node.js version the binary runs under.",
    }),
    npmIntegrity: OpenclawNpmIntegrity.annotateKey({
      description: "npm dist integrity (SRI) of the pinned OpenClaw package.",
    }),
    npmShasum: OpenclawNpmShasum.annotateKey({
      description: "npm dist shasum of the pinned OpenClaw package.",
    }),
    openclawCommit: S.NonEmptyString.annotateKey({
      description: "Short git commit reported by the pinned binary.",
    }),
    openclawVersion: OpenclawTargetVersion.annotateKey({
      description: "Pinned OpenClaw version string.",
    }),
  },
  $I.annote("OpenclawCompatibilitySet", {
    description: "Pinned Node/OpenClaw/adapter compatibility set.",
  })
) {}
