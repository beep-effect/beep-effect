/**
 * Shared JSON rendering helpers for repo-cli command adapters.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CauseTaggedError } from "@beep/schema";
import { Console, Effect } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/Json");
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

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
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { encodeCommandJson } from "@beep/repo-cli/internal/cli/Json"
 *
 * const encoded = Effect.runSync(encodeCommandJson({ ok: true }))
 *
 * console.log(encoded)
 * ```
 * @category rendering
 * @since 0.0.0
 */
const encodeCommandJson = Effect.fn("RepoCli.Json.encodeCommandJson")(function* (
  value: unknown
): Effect.fn.Return<string, CliJsonError> {
  return yield* encodeJson(value).pipe(CliJsonError.mapError("Failed to encode command JSON output."));
});

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
  yield* Console.log(yield* encodeCommandJson(value));
});
