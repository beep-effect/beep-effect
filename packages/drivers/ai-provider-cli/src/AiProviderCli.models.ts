/**
 * Schema-backed payloads for Claude and Codex CLI auth probes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiProviderCliId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $AiProviderCliId.create("AiProviderCli.models");
const AiProviderCliProviderBase = LiteralKit(["claude", "codex"]);
const AiProviderCliAuthStatusBase = LiteralKit(["authenticated", "not-authenticated"]);

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
