/**
 * Recognizes EntityId schemas through their stable structural metadata.
 *
 * Dialect model factories use these statics to derive integer storage and
 * automatic references without importing an application identity package.
 *
 * @since 0.0.0
 */
import { hasProperty } from "effect/Predicate";
import { annotate, declare, is, NonEmptyString } from "effect/Schema";

type EntityIdLikeShape = {
  readonly tableName: string;
  readonly entityType: string;
};

const isNonEmptyString = is(NonEmptyString);

/**
 * Structural statics carried by dialect-free EntityId schemas in public inference.
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdLike = declare<EntityIdLikeShape>(
  (input): input is EntityIdLikeShape =>
    hasProperty(input, "tableName") &&
    isNonEmptyString(input.tableName) &&
    hasProperty(input, "entityType") &&
    isNonEmptyString(input.entityType)
).pipe(
  annotate({
    identifier: "@beep/effect-drizzle/EntityIdLike",
    description: "Static identity metadata carried by an EntityId schema.",
  })
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
 * @category guards
 * @since 0.0.0
 */
export const isEntityIdLike = is(EntityIdLike);
