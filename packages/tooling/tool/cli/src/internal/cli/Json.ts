/**
 * Shared JSON rendering helpers for repo-cli command adapters.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CauseTaggedError } from "@beep/schema";
import { Console, Effect, Result } from "effect";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";

const $I = $RepoCliId.create("internal/cli/Json");
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const encodeJsonResult = S.encodeUnknownResult(S.UnknownFromJsonString);

/**
 * Default `jsonc.format` options shared by repo-cli pretty JSON renderers.
 *
 * **Example** (Read the shared indent width)
 *
 * ```ts
 * import { DEFAULT_JSON_FORMATTING_OPTIONS } from "@beep/repo-cli/internal/cli/Json"
 *
 * console.log(DEFAULT_JSON_FORMATTING_OPTIONS.tabSize) // 2
 * ```
 *
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
 * **Example** (Guard a payload before pretty-rendering it)
 *
 * ```ts
 * import { DEFAULT_JSON_PRETTY_MAX_LENGTH } from "@beep/repo-cli/internal/cli/Json"
 *
 * const encoded = `{"ok":true}`
 *
 * console.log(encoded.length > DEFAULT_JSON_PRETTY_MAX_LENGTH) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_JSON_PRETTY_MAX_LENGTH = 500_000;

/**
 * Failure raised when a command cannot encode a machine-readable JSON payload.
 *
 * **Example** (Wrap an encode failure)
 *
 * ```ts
 * import { CliJsonError } from "@beep/repo-cli/internal/cli/Json"
 *
 * const error = CliJsonError.new("Failed to encode JSON")("boom")
 *
 * console.log(error)
 * ```
 *
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
 * **Example** (Encode a payload and tag the failure)
 *
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
 *
 * @category formatting
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
 * **Example** (Pretty-render an encoded payload)
 *
 * ```ts
 * import { renderPrettyCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const pretty = renderPrettyCommandJson(`{"ok":true}`)
 *
 * console.log(pretty === `{\n  "ok": true\n}\n`) // true
 * ```
 *
 * **Example** (Leave an oversized payload single-line)
 *
 * ```ts
 * import { renderPrettyCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const encoded = `{"ok":true}`
 * const capped = renderPrettyCommandJson(encoded, { maxLength: 1 })
 *
 * console.log(capped === `${encoded}\n`) // true, over the cap so left single-line
 * ```
 *
 * @category formatting
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
 * Encode a JSON-compatible value and pretty-render it with a trailing newline.
 *
 * **When to use**
 *
 * Use when a plain string-building call site needs canonical pretty JSON and
 * already knows its input is encodable, so an Effect-returning encoder would
 * only add ceremony.
 *
 * **Gotchas**
 *
 * The encode failure is rethrown instead of being surfaced on an error channel;
 * pass values the JSON codec accepts, or reach for {@link encodeCommandJson}.
 *
 * **Example** (Render a canonical lock-file body)
 *
 * ```ts
 * import { formatJsonValue } from "@beep/repo-cli/internal/cli/Json"
 *
 * const text = formatJsonValue({ ok: true })
 *
 * console.log(text === `{\n  "ok": true\n}\n`) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatJsonValue = (value: unknown): string =>
  renderPrettyCommandJson(Result.getOrThrow(encodeJsonResult(value)));

/**
 * Encode and print an arbitrary JSON-compatible command payload.
 *
 * **Example** (Print a machine-readable command result)
 *
 * ```ts
 * import { printCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const program = printCommandJson({ ok: true })
 *
 * console.log(program)
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const printCommandJson = Effect.fn("RepoCli.Json.printCommandJson")(function* (
  value: unknown
): Effect.fn.Return<void, CliJsonError> {
  yield* Console.log(
    yield* encodeCommandJson(value).pipe(CliJsonError.mapError("Failed to encode command JSON output."))
  );
});
