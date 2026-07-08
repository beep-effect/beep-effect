/**
 * Shared JSON rendering helpers for repo-cli command adapters.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CauseTaggedError } from "@beep/schema";
import { Console, Effect } from "effect";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";

const $I = $RepoCliId.create("internal/cli/Json");
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

/**
 * Default `jsonc.format` options shared by repo-cli pretty JSON renderers.
 *
 * @example
 * ```ts
 * import { DEFAULT_JSON_FORMATTING_OPTIONS } from "@beep/repo-cli/internal/cli/Json"
 *
 * console.log(DEFAULT_JSON_FORMATTING_OPTIONS.tabSize) // 2
 * ```
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_JSON_FORMATTING_OPTIONS: jsonc.FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
};

/**
 * Default byte cap above which pretty JSON rendering is skipped.
 *
 * Encoded payloads longer than this are returned single-line with a trailing
 * newline instead of being handed to `jsonc.format`, which degrades badly on
 * very large documents.
 *
 * @example
 * ```ts
 * import { DEFAULT_JSON_PRETTY_MAX_LENGTH } from "@beep/repo-cli/internal/cli/Json"
 *
 * console.log(DEFAULT_JSON_PRETTY_MAX_LENGTH) // 500000
 * ```
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_JSON_PRETTY_MAX_LENGTH = 500_000;

/**
 * Failure raised when a command cannot encode a machine-readable JSON payload.
 *
 * @example
 * ```ts
 * import { CliJsonError } from "@beep/repo-cli/internal/cli/Json"
 *
 * const error = CliJsonError.new("Failed to encode JSON")("boom")
 *
 * console.log(error)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CliJsonError extends CauseTaggedError<CliJsonError>($I`CliJsonError`)(
  "CliJsonError",
  {},
  $I.annote("CliJsonError", {
    description: "Failure raised when a repo-cli command cannot encode a JSON payload.",
  })
) {}

/**
 * Encode an arbitrary JSON-compatible command payload for terminal output.
 *
 * The encode failure is left on the error channel unmapped so each caller can
 * attach its own tagged error (for example `CliJsonError.mapError(...)` or
 * `DomainError.newCause(...)`) without this module picking a winner.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { CliJsonError, encodeCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const encoded = Effect.runSync(
 *   encodeCommandJson({ ok: true }).pipe(CliJsonError.mapError("Failed to encode command JSON output."))
 * )
 *
 * console.log(encoded) // {"ok":true}
 * ```
 * @category rendering
 * @since 0.0.0
 */
export const encodeCommandJson = Effect.fn("RepoCli.Json.encodeCommandJson")(function* (
  value: unknown
): Effect.fn.Return<string, S.SchemaError> {
  return yield* encodeJson(value);
});

/**
 * Pretty-render an already-encoded JSON string with a size guard.
 *
 * Reproduces the `jsonc.format` + `applyEdits` renderer copied across the
 * package: when `maxLength` is supplied and the encoded payload exceeds it, the
 * input is returned single-line with a trailing newline; otherwise it is
 * reformatted with the supplied (or default) formatting options. Callers keep
 * their own encode step and error strategy, so the output stays byte-identical
 * to each hand-rolled copy.
 *
 * @example
 * ```ts
 * import { renderPrettyCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const pretty = renderPrettyCommandJson(`{"ok":true}`)
 *
 * console.log(pretty === `{\n  "ok": true\n}\n`) // true
 * ```
 * @example
 * ```ts
 * import { DEFAULT_JSON_PRETTY_MAX_LENGTH, renderPrettyCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const encoded = `{"ok":true}`
 * const capped = renderPrettyCommandJson(encoded, { maxLength: 1 })
 *
 * console.log(capped === `${encoded}\n`) // true, over the cap so left single-line
 * console.log(DEFAULT_JSON_PRETTY_MAX_LENGTH) // 500000
 * ```
 * @category rendering
 * @since 0.0.0
 */
export const renderPrettyCommandJson = (
  encoded: string,
  options?: {
    readonly maxLength?: number;
    readonly formattingOptions?: jsonc.FormattingOptions;
  }
): string => {
  const maxLength = options?.maxLength;
  if (maxLength !== undefined && encoded.length > maxLength) {
    return `${encoded}\n`;
  }
  const edits = jsonc.format(encoded, undefined, options?.formattingOptions ?? DEFAULT_JSON_FORMATTING_OPTIONS);
  return `${jsonc.applyEdits(encoded, edits)}\n`;
};

/**
 * Encode and print an arbitrary JSON-compatible command payload.
 *
 * @example
 * ```ts
 * import { printCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const program = printCommandJson({ ok: true })
 *
 * console.log(program)
 * ```
 * @category rendering
 * @since 0.0.0
 */
export const printCommandJson = Effect.fn("RepoCli.Json.printCommandJson")(function* (
  value: unknown
): Effect.fn.Return<void, CliJsonError> {
  yield* Console.log(
    yield* encodeCommandJson(value).pipe(CliJsonError.mapError("Failed to encode command JSON output."))
  );
});
