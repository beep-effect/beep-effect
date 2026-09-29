/**
 * UUID text carried by the Yeet and repo-run journals.
 *
 * Attempt ids, proof-job ids, and admission journal rows all persist the same
 * RFC 4122 string, so the repo CLI declares that string once here as an
 * upstream composition (`S.Trim`, `S.isNonEmpty`, `S.isUUID`) instead of each
 * module rebuilding it.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/schema/Uuid");

/**
 * Trimmed RFC 4122 UUID string persisted by Yeet attempt, proof-job, and
 * admission journal records.
 *
 * **Details**
 *
 * Decoding trims surrounding whitespace, rejects an empty string with
 * `String must not be empty`, then requires the UUID shape. Encoding writes the
 * string unchanged, so journal bytes round-trip identically.
 *
 * **Example** (Decode a padded attempt id)
 *
 * ```ts
 * import { UUID } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const attemptId = Effect.runSync(S.decodeUnknownEffect(UUID)(" 550e8400-e29b-41d4-a716-446655440000 "))
 * console.log(attemptId) // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UUID = S.Trim.check(S.isNonEmpty({ message: "String must not be empty" }), S.isUUID()).pipe(
  $I.annoteSchema("UUID", {
    description: "Trimmed RFC 4122 UUID string persisted by Yeet and repo-run journal records.",
  })
);

/**
 * Decoded type of {@link UUID}.
 *
 * @category models
 * @since 0.0.0
 */
export type UUID = typeof UUID.Type;
