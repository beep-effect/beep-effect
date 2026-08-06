/**
 * Tagged failures for `beep codex findings`.
 *
 * The taxonomy is deliberately narrow: three errors, each discriminated by a
 * reason domain, rather than one class per failure mode. Every message is
 * written to be safe to print — a redaction rejection names the offending field
 * and rule, never the matched value, so surfacing an error can never become the
 * leak the scan was meant to prevent.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import { Runtime } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Codex/Findings.errors");

/**
 * Why a capture payload could not be turned into normalized records.
 *
 * **Details**
 *
 * `auth-expired` and `short-read` are the two reasons that matter operationally:
 * both mean the dashboard rendered fewer findings than exist, and both would
 * otherwise bootstrap a packet that looks like a clean scan.
 *
 * **Example** (Matching on an ingest reason)
 *
 * ```ts
 * import { CodexIngestFailureReason } from "@beep/repo-cli/commands/Codex/Findings.errors"
 *
 * console.log(CodexIngestFailureReason.is["short-read"]("short-read")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexIngestFailureReason = LiteralKit([
  "payload-unreadable",
  "payload-invalid",
  "csv-header-unsupported",
  "csv-row-malformed",
  "csv-duplicate-finding",
  "capture-date-unknown",
  "ledger-unreadable",
  "auth-expired",
  "short-read",
  "inbox-ambiguous",
  "inbox-empty",
]).pipe(
  $I.annoteSchema("CodexIngestFailureReason", {
    description: "Reason a capture payload could not be ingested.",
  })
);

/**
 * Reason an ingest attempt failed.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexIngestFailureReason = typeof CodexIngestFailureReason.Type;

/**
 * Why a packet write was refused or could not complete.
 *
 * **Example** (Matching on a write reason)
 *
 * ```ts
 * import { CodexPacketWriteFailureReason } from "@beep/repo-cli/commands/Codex/Findings.errors"
 *
 * console.log(CodexPacketWriteFailureReason.is["packet-exists"]("packet-exists")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexPacketWriteFailureReason = LiteralKit([
  "packet-exists",
  "path-escape",
  "staging-failed",
  "commit-failed",
]).pipe(
  $I.annoteSchema("CodexPacketWriteFailureReason", {
    description: "Reason a generated packet could not be written.",
  })
);

/**
 * Reason a packet write failed.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexPacketWriteFailureReason = typeof CodexPacketWriteFailureReason.Type;

/**
 * Failure raised while reading or decoding a capture payload.
 *
 * **Example** (Constructing an ingest failure)
 *
 * ```ts
 * import { CodexFindingsIngestError } from "@beep/repo-cli/commands/Codex/Findings.errors"
 *
 * const error = CodexFindingsIngestError.make({
 *   reason: "auth-expired",
 *   message: "The capture ran against a signed-out session.",
 * })
 *
 * console.log(error.reason) // "auth-expired"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodexFindingsIngestError extends TaggedErrorClass<CodexFindingsIngestError>($I`CodexFindingsIngestError`)(
  "CodexFindingsIngestError",
  {
    reason: CodexIngestFailureReason,
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("CodexFindingsIngestError", {
    description: "Failure raised while reading or decoding a Codex findings capture payload.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /**
   * Build a reason-tagged ingest failure from an upstream cause.
   *
   * **Example** (Mapping a filesystem failure)
   *
   * ```ts
   * import { CodexFindingsIngestError } from "@beep/repo-cli/commands/Codex/Findings.errors"
   *
   * const error = CodexFindingsIngestError.from(
   *   new Error("ENOENT"),
   *   "payload-unreadable",
   *   "The capture payload could not be read."
   * )
   *
   * console.log(error.reason) // "payload-unreadable"
   * ```
   *
   * @param cause - Upstream failure being wrapped.
   * @param reason - Reason domain member describing the failure.
   * @param message - Operator-facing message, free of captured values.
   * @returns The tagged error carrying the cause.
   * @category constructors
   * @since 0.0.0
   */
  static readonly from = (
    cause: unknown,
    reason: CodexIngestFailureReason,
    message: string
  ): CodexFindingsIngestError => CodexFindingsIngestError.make({ cause, message, reason });

  /**
   * Map an upstream failure channel onto a reason-tagged ingest failure.
   *
   * **Example** (Adapting an effect)
   *
   * ```ts
   * import { CodexFindingsIngestError } from "@beep/repo-cli/commands/Codex/Findings.errors"
   * import { Effect } from "effect"
   *
   * const program = Effect.fail("boom").pipe(
   *   Effect.mapError((cause) =>
   *     CodexFindingsIngestError.from(cause, "payload-invalid", "Unusable payload.")
   *   ),
   *   Effect.map(() => "ok"),
   *   Effect.orElseSucceed(() => "failed")
   * )
   *
   * console.log(Effect.runSync(program)) // "failed"
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(
    (cause: unknown, message: string): CodexFindingsIngestError =>
      CodexFindingsIngestError.make({ cause, message, reason: "payload-invalid" })
  );
}

/**
 * Failure raised when captured content carries secret-shaped or private material.
 *
 * **Gotchas**
 *
 * `surfaces` holds logical field addresses such as `findings[3].title`, paired
 * with the rule code that matched. The matched text is never carried, so this
 * error is safe to print, log, serialize to `--json`, and attach to a span.
 *
 * **Example** (Constructing a redaction rejection)
 *
 * ```ts
 * import { CodexFindingsRedactionError } from "@beep/repo-cli/commands/Codex/Findings.errors"
 *
 * const error = CodexFindingsRedactionError.make({
 *   message: "Captured content carries secret-shaped values.",
 *   surfaces: ["findings[3].title (secret-shaped-value)"],
 * })
 *
 * console.log(error.surfaces.length) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodexFindingsRedactionError extends TaggedErrorClass<CodexFindingsRedactionError>(
  $I`CodexFindingsRedactionError`
)(
  "CodexFindingsRedactionError",
  {
    message: S.String,
    surfaces: S.Array(S.String),
  },
  $I.annote("CodexFindingsRedactionError", {
    description: "Failure raised when captured content carries secret-shaped or private material.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

/**
 * Failure raised while staging or committing a generated packet.
 *
 * **Example** (Refusing to clobber an existing packet)
 *
 * ```ts
 * import { CodexPacketWriteError } from "@beep/repo-cli/commands/Codex/Findings.errors"
 *
 * const error = CodexPacketWriteError.make({
 *   reason: "packet-exists",
 *   message: "goals/codex-security-findings-2026-08-04 already exists.",
 * })
 *
 * console.log(error.reason) // "packet-exists"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodexPacketWriteError extends TaggedErrorClass<CodexPacketWriteError>($I`CodexPacketWriteError`)(
  "CodexPacketWriteError",
  {
    reason: CodexPacketWriteFailureReason,
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("CodexPacketWriteError", {
    description: "Failure raised while staging or committing a generated Codex findings packet.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /**
   * Build a reason-tagged packet write failure from an upstream cause.
   *
   * **Example** (Mapping a rename failure)
   *
   * ```ts
   * import { CodexPacketWriteError } from "@beep/repo-cli/commands/Codex/Findings.errors"
   *
   * const error = CodexPacketWriteError.from(
   *   new Error("ENOTEMPTY"),
   *   "commit-failed",
   *   "The staged packet could not be promoted."
   * )
   *
   * console.log(error.reason) // "commit-failed"
   * ```
   *
   * @param cause - Upstream failure being wrapped.
   * @param reason - Reason domain member describing the failure.
   * @param message - Operator-facing message, free of captured values.
   * @returns The tagged error carrying the cause.
   * @category constructors
   * @since 0.0.0
   */
  static readonly from = (
    cause: unknown,
    reason: CodexPacketWriteFailureReason,
    message: string
  ): CodexPacketWriteError => CodexPacketWriteError.make({ cause, message, reason });
}
