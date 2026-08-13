/**
 * Typed failure payloads for Claude and Codex CLI auth probes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiProviderCliId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { AiProviderCliExitCode, AiProviderCliProvider } from "./AiProviderCli.models.ts";

const $I = $AiProviderCliId.create("AiProviderCli.errors");

/**
 * Redacted technical failure from a provider CLI status probe.
 *
 * **Gotchas**
 *
 * The error keeps the provider, operation, command, and optional process
 * details needed for diagnostics. Callers should continue treating stdout and
 * stderr as redacted diagnostic text, not as a stable account-status API.
 *
 * **Example** (Constructing AiProviderCliError with make)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AiProviderCliError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliError.make({
 *   command: O.some("claude"),
 *   exitCode: O.some(127),
 *   message: "Failed to execute provider CLI status command.",
 *   operation: "checkAuth",
 *   provider: "claude",
 *   stderr: O.some("command not found")
 * })
 *
 * console.log(error.operation) // "checkAuth"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiProviderCliError extends S.TaggedError<AiProviderCliError>($I`AiProviderCliError`)(
  "AiProviderCliError",
  {
    command: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Executable command used for the provider CLI status probe, when available.",
    }),
    exitCode: S.OptionFromOptionalKey(AiProviderCliExitCode).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider CLI process exit status, when the process returned one.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Redacted human-readable failure summary.",
    }),
    operation: S.NonEmptyString.annotateKey({
      description: "Driver operation that emitted the failure.",
    }),
    provider: AiProviderCliProvider.annotateKey({
      description: "Provider CLI whose auth status probe failed.",
    }),
    stderr: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Redacted standard error captured from the provider CLI status command, when available.",
    }),
    stdout: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Redacted standard output captured from the provider CLI status command, when available.",
    }),
  },
  $I.annote("AiProviderCliError", {
    description: "Redacted technical failure emitted by Claude or Codex CLI status probes.",
  })
) {}
