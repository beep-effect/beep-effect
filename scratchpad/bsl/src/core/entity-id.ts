/** Dialect-neutral structural contract for EntityId schema statics. */
import { hasProperty } from "effect/Predicate";
import { NonEmptyString, annotate, declare, is } from "effect/Schema";

type EntityIdLikeShape = {
  readonly tableName: string;
  readonly entityType: string;
};

const isNonEmptyString = is(NonEmptyString);

/**
 * Structural statics carried by dialect-free EntityId schemas.
 *
 * **Example** (Recognize EntityId statics)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { isEntityIdLike } from "./entity-id.ts"
 *
 * const UserId = Object.assign(Int.annotate({ identifier: "UserId" }), {
 *   tableName: "user",
 *   entityType: "User"
 * })
 * console.log(isEntityIdLike(UserId)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdLike = declare<EntityIdLikeShape>(
  (input): input is EntityIdLikeShape =>
    hasProperty(input, "tableName") &&
    isNonEmptyString(input.tableName) &&
    hasProperty(input, "entityType") &&
    isNonEmptyString(input.entityType),
).pipe(
  annotate({
    identifier: "@beep/effect-drizzle/EntityIdLike",
    description: "Static identity metadata carried by an EntityId schema.",
  }),
);

/**
 * Decoded structural statics recognized by {@link EntityIdLike}.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdLike = typeof EntityIdLike.Type;

/**
 * Test unknown input for EntityId schema statics.
 *
 * **Example** (Reject an ordinary schema)
 *
 * ```ts
 * import { String } from "effect/Schema"
 * import { isEntityIdLike } from "./entity-id.ts"
 *
 * console.log(isEntityIdLike(String)) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isEntityIdLike = is(EntityIdLike);
