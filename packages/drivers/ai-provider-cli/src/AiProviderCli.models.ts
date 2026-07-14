/**
 * Schema-backed payloads for Claude and Codex CLI auth probes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiProviderCliId } from "@beep/identity";
import { LiteralKit, MappedLiteralKit, SchemaUtils } from "@beep/schema";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $AiProviderCliId.create("AiProviderCli.models");
const AiProviderCliProviderBase = LiteralKit(["claude", "codex"]);
const AiProviderCliAuthStatusBase = LiteralKit(["authenticated", "not-authenticated"]);
const AiProviderCliTokenSourceBase = LiteralKit(["claude.ai", "console", "api-key", "chatgpt"]);

/**
 * Supported local AI provider CLI identifiers.
 *
 * @remarks
 * The vocabulary is intentionally limited to CLIs this driver knows how to
 * probe: Claude uses `claude auth status`, and Codex uses `codex login status`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliProvider } from "@beep/ai-provider-cli"
 *
 * const provider = S.decodeUnknownSync(AiProviderCliProvider)("claude")
 *
 * console.log(provider) // "claude"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliProvider = AiProviderCliProviderBase.pipe(
  $I.annoteSchema("AiProviderCliProvider", {
    description: "AI provider CLI names supported by the driver.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliProviderBase)
);

/**
 * Type for a supported local AI provider CLI identifier.
 *
 * @example
 * ```ts
 * import type { AiProviderCliProvider } from "@beep/ai-provider-cli"
 *
 * const provider: AiProviderCliProvider = "codex"
 *
 * console.log(provider) // "codex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliProvider = typeof AiProviderCliProvider.Type;

/**
 * Redacted authentication state inferred from a provider CLI exit code.
 *
 * @remarks
 * `authenticated` means the provider status command exited with code `0`.
 * `not-authenticated` means the command ran and returned a non-zero exit code;
 * transport and spawning failures are represented by `AiProviderCliError`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliAuthStatus } from "@beep/ai-provider-cli"
 *
 * const status = S.decodeUnknownSync(AiProviderCliAuthStatus)("authenticated")
 *
 * console.log(status) // "authenticated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliAuthStatus = AiProviderCliAuthStatusBase.pipe(
  $I.annoteSchema("AiProviderCliAuthStatus", {
    description: "Authentication state inferred from a provider CLI status command.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliAuthStatusBase)
);

/**
 * Type for the redacted provider CLI authentication state.
 *
 * @example
 * ```ts
 * import type { AiProviderCliAuthStatus } from "@beep/ai-provider-cli"
 *
 * const status: AiProviderCliAuthStatus = "not-authenticated"
 *
 * console.log(status) // "not-authenticated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliAuthStatus = typeof AiProviderCliAuthStatus.Type;

/**
 * Credential origin reported by a provider CLI status command.
 *
 * @remarks
 * Claude reports `authMethod` values such as `"claude.ai"` (subscription
 * login) and `"console"` (Anthropic Console billing). Codex reports a status
 * line naming ChatGPT (`"chatgpt"`) or an API key (`"api-key"`). Unrecognized
 * values collapse to an absent token source rather than failing the probe.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliTokenSource } from "@beep/ai-provider-cli"
 *
 * const tokenSource = S.decodeUnknownSync(AiProviderCliTokenSource)("claude.ai")
 *
 * console.log(tokenSource) // "claude.ai"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliTokenSource = AiProviderCliTokenSourceBase.pipe(
  $I.annoteSchema("AiProviderCliTokenSource", {
    description: "Credential origin reported by a provider CLI status command.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliTokenSourceBase)
);

/**
 * Type for a provider CLI credential origin.
 *
 * @example
 * ```ts
 * import type { AiProviderCliTokenSource } from "@beep/ai-provider-cli"
 *
 * const tokenSource: AiProviderCliTokenSource = "chatgpt"
 *
 * console.log(tokenSource) // "chatgpt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliTokenSource = typeof AiProviderCliTokenSource.Type;

/**
 * Reversible codec from Claude CLI `subscriptionType` values to human labels.
 *
 * @remarks
 * Decoding maps a known `subscriptionType` (for example `"max"`) to its
 * display label (`"Claude Max Subscription"`). Unknown subscription types are
 * not decodable through this codec; probe assembly falls back to the generic
 * `"Claude Subscription"` label instead of failing.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliClaudeSubscriptionLabel } from "@beep/ai-provider-cli"
 *
 * const label = S.decodeUnknownSync(AiProviderCliClaudeSubscriptionLabel)("max")
 *
 * console.log(label) // "Claude Max Subscription"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliClaudeSubscriptionLabel = MappedLiteralKit([
  ["max", "Claude Max Subscription"],
  ["pro", "Claude Pro Subscription"],
  ["team", "Claude Team Subscription"],
  ["enterprise", "Claude Enterprise Subscription"],
  ["free", "Claude Free Subscription"],
]).pipe(
  $I.annoteSchema("AiProviderCliClaudeSubscriptionLabel", {
    description: "Reversible Claude subscription type to human-readable label codec.",
  })
);

/**
 * Type for a Claude subscription display label.
 *
 * @example
 * ```ts
 * import type { AiProviderCliClaudeSubscriptionLabel } from "@beep/ai-provider-cli"
 *
 * const label: AiProviderCliClaudeSubscriptionLabel = "Claude Max Subscription"
 *
 * console.log(label) // "Claude Max Subscription"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliClaudeSubscriptionLabel = typeof AiProviderCliClaudeSubscriptionLabel.Type;

/**
 * Process exit status accepted from provider CLI status commands.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliExitCode } from "@beep/ai-provider-cli"
 *
 * const exitCode = S.decodeUnknownSync(AiProviderCliExitCode)(0)
 *
 * console.log(exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliExitCode = S.Int.check(S.isBetween({ minimum: 0, maximum: 255 })).pipe(
  $I.annoteSchema("AiProviderCliExitCode", {
    description: "Integer process exit status in the conventional 0-255 CLI range.",
  })
);

/**
 * Type for a provider CLI process exit status.
 *
 * @example
 * ```ts
 * import type { AiProviderCliExitCode } from "@beep/ai-provider-cli"
 *
 * const exitCode: AiProviderCliExitCode = 0
 *
 * console.log(exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliExitCode = typeof AiProviderCliExitCode.Type;

/**
 * Per-call process overrides for a provider CLI auth probe.
 *
 * @remarks
 * Environment values are secrets-adjacent runner inputs. They are never
 * copied into probe results, errors, logs, or spans.
 *
 * @example
 * ```ts
 * import { AiProviderCliProbeOptions } from "@beep/ai-provider-cli"
 * import * as O from "effect/Option"
 *
 * const options = AiProviderCliProbeOptions.make({
 *   env: { HOME: "/tmp/claude-home" },
 *   executable: O.some("/opt/bin/claude")
 * })
 *
 * console.log(options.executable)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliProbeOptions extends S.Class<AiProviderCliProbeOptions>($I`AiProviderCliProbeOptions`)(
  {
    env: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Environment overlay supplied only to the provider CLI child process.",
    }),
    executable: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional executable override supplied only to the provider CLI runner.",
    }),
  },
  $I.annote("AiProviderCliProbeOptions", {
    description: "Per-call executable and child-environment overrides for a provider CLI auth probe.",
  })
) {}

/**
 * Complete technical request passed to an injected provider CLI runner.
 *
 * @remarks
 * This request is an execution boundary only. Its executable and environment
 * must never be rendered into diagnostics or observable probe payloads.
 *
 * @example
 * ```ts
 * import { AiProviderCliRunRequest } from "@beep/ai-provider-cli"
 *
 * const request = AiProviderCliRunRequest.make({
 *   args: ["login", "status"],
 *   env: { CODEX_HOME: "/tmp/codex-home" },
 *   executable: "/opt/bin/codex",
 *   provider: "codex"
 * })
 *
 * console.log(request.provider) // "codex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliRunRequest extends S.Class<AiProviderCliRunRequest>($I`AiProviderCliRunRequest`)(
  {
    args: S.Array(S.String).annotateKey({
      description: "Provider-specific auth status command arguments.",
    }),
    env: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults(R.empty())).annotateKey({
      description: "Environment overlay supplied only to the child process.",
    }),
    executable: S.NonEmptyString.annotateKey({
      description: "Executable command or path used by the child process.",
    }),
    provider: AiProviderCliProvider.annotateKey({
      description: "Provider whose auth status command is being executed.",
    }),
  },
  $I.annote("AiProviderCliRunRequest", {
    description: "Technical provider CLI child-process invocation request.",
  })
) {}

/**
 * Captured provider CLI status process output.
 *
 * @remarks
 * This model is for runner boundaries and tests. Public auth probes collapse
 * the process result into a redacted status and do not expose raw stdout or
 * stderr.
 *
 * @example
 * ```ts
 * import { AiProviderCliProcessResult } from "@beep/ai-provider-cli"
 *
 * const result = AiProviderCliProcessResult.make({
 *   exitCode: 0,
 *   stderr: "",
 *   stdout: "claude auth status"
 * })
 *
 * console.log(result.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliProcessResult extends S.Class<AiProviderCliProcessResult>($I`AiProviderCliProcessResult`)(
  {
    exitCode: AiProviderCliExitCode.annotateKey({
      description: "Provider CLI process exit status.",
    }),
    stderr: S.String.annotateKey({
      description: "Redacted standard error captured from the provider CLI status command.",
    }),
    stdout: S.String.annotateKey({
      description: "Redacted standard output captured from the provider CLI status command.",
    }),
  },
  $I.annote("AiProviderCliProcessResult", {
    description: "Stdout, stderr, and exit code captured from a provider CLI status command.",
  })
) {}

/**
 * Redacted provider CLI authentication probe result.
 *
 * @remarks
 * The probe records the executable name and normalized auth status only. It
 * deliberately omits stdout, stderr, account identifiers, and token material.
 *
 * @example
 * ```ts
 * import { AiProviderCliAuthProbe } from "@beep/ai-provider-cli"
 *
 * const probe = AiProviderCliAuthProbe.make({
 *   command: "codex",
 *   provider: "codex",
 *   status: "not-authenticated"
 * })
 *
 * console.log(probe.command) // "codex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliAuthProbe extends S.Class<AiProviderCliAuthProbe>($I`AiProviderCliAuthProbe`)(
  {
    command: S.NonEmptyString.annotateKey({
      description: "Executable command used for the provider CLI status probe.",
    }),
    provider: AiProviderCliProvider.annotateKey({
      description: "Provider CLI whose auth status was probed.",
    }),
    status: AiProviderCliAuthStatus.annotateKey({
      description: "Redacted auth state inferred from the provider CLI exit status.",
    }),
  },
  $I.annote("AiProviderCliAuthProbe", {
    description: "Provider CLI auth probe result without raw account or token output.",
  })
) {}

/**
 * JSON payload printed by `claude auth status` on stdout.
 *
 * @remarks
 * Only the fields the driver consumes are modeled: `loggedIn`, `authMethod`,
 * `email`, and `subscriptionType`. Extra keys (for example `orgId` and
 * `orgName`) are deliberately ignored for data minimization. Payloads that do
 * not decode degrade the probe to the exit-code-only interpretation.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { AiProviderCliClaudeAuthStatusPayload } from "@beep/ai-provider-cli"
 *
 * const payload = AiProviderCliClaudeAuthStatusPayload.make({
 *   authMethod: O.some("claude.ai"),
 *   email: O.some("dev@example.com"),
 *   loggedIn: true,
 *   subscriptionType: O.some("max")
 * })
 *
 * console.log(payload.loggedIn) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliClaudeAuthStatusPayload extends S.Class<AiProviderCliClaudeAuthStatusPayload>(
  $I`AiProviderCliClaudeAuthStatusPayload`
)(
  {
    authMethod: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Login method reported by the Claude CLI, when present.",
    }),
    email: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Account email reported by the Claude CLI, when present.",
    }),
    loggedIn: S.Boolean.annotateKey({
      description: "Whether the Claude CLI reports an authenticated session.",
    }),
    subscriptionType: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Subscription tier identifier reported by the Claude CLI, when present.",
    }),
  },
  $I.annote("AiProviderCliClaudeAuthStatusPayload", {
    description: "Decoded stdout JSON payload from the Claude CLI auth status command.",
  })
) {}

/**
 * Rich provider CLI authentication snapshot.
 *
 * @remarks
 * Extends the boolean {@link AiProviderCliAuthProbe} with optional account
 * email, subscription display label, and credential origin. Every optional
 * field stays `Option.none()` whenever the provider CLI does not report it;
 * the snapshot never carries raw stdout, stderr, or token material.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { AiProviderCliAuthSnapshot } from "@beep/ai-provider-cli"
 *
 * const snapshot = AiProviderCliAuthSnapshot.make({
 *   email: O.some("dev@example.com"),
 *   provider: "claude",
 *   status: "authenticated",
 *   subscriptionLabel: O.some("Claude Max Subscription"),
 *   tokenSource: O.some("claude.ai")
 * })
 *
 * console.log(snapshot.status) // "authenticated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliAuthSnapshot extends S.Class<AiProviderCliAuthSnapshot>($I`AiProviderCliAuthSnapshot`)(
  {
    email: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Account email reported by the provider CLI, when available.",
    }),
    provider: AiProviderCliProvider.annotateKey({
      description: "Provider CLI whose auth status was probed.",
    }),
    status: AiProviderCliAuthStatus.annotateKey({
      description: "Redacted auth state inferred from the provider CLI status command.",
    }),
    subscriptionLabel: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Human-readable subscription or plan label, when the provider CLI reports one.",
    }),
    tokenSource: S.OptionFromOptionalKey(AiProviderCliTokenSource).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Credential origin reported by the provider CLI, when recognized.",
    }),
  },
  $I.annote("AiProviderCliAuthSnapshot", {
    description: "Rich provider CLI auth snapshot with optional account and subscription detail.",
  })
) {}
