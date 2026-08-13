/**
 * Temporary Stage B import surface for Effect Schema tagged errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";

/**
 * Create a schema-backed yieldable error with an automatically populated
 * `_tag` field.
 *
 * **Details**
 *
 * This export is the upstream `S.TaggedError` constructor. It remains only
 * while Stage B migrates the repository's plain `TaggedErrorClass`
 * declarations.
 *
 * **Example** (Fail an Effect with a tagged error)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { TaggedErrorClass } from "@beep/schema"
 *
 * class NotFound extends TaggedErrorClass<NotFound>()("NotFound", {
 *   message: S.String
 * }) {}
 *
 * const exit = Effect.runSyncExit(Effect.fail(NotFound.make({ message: "User not found" })))
 * console.log(exit._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const TaggedErrorClass = S.TaggedError;
