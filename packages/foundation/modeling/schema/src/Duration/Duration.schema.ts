/**
 * Primary Effect Duration schema for the `Duration` concept module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";

/**
 * Validates values represented by Effect's runtime `Duration` type.
 *
 * **When to use**
 *
 * Use when a boundary already exchanges Effect `Duration` values.
 *
 * **Example** (Decode an Effect duration)
 *
 * ```ts
 * import * as Duration from "@beep/schema/Duration"
 * import { Duration as EffectDuration } from "effect"
 * import * as S from "effect/Schema"
 *
 * const duration = S.decodeUnknownSync(Duration.Schema)(EffectDuration.seconds(5))
 * console.log(EffectDuration.toMillis(duration))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Schema = S.Duration;

/**
 * Runtime type extracted from {@link Schema}.
 *
 * **Example** (Annotate an Effect duration)
 *
 * ```ts
 * import type { Schema as DurationValue } from "@beep/schema/Duration"
 * import { Duration } from "effect"
 *
 * const duration = Duration.seconds(5) satisfies DurationValue
 * console.log(duration)
 * ```
 *
 * @see {@link Schema} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Schema = typeof Schema.Type;

/**
 * Compatibility alias for the primary Effect Duration schema.
 *
 * **Example** (Decode through the compatibility schema)
 *
 * ```ts
 * import { Duration as EffectDuration } from "effect"
 * import { Duration } from "@beep/schema/Duration"
 * import * as S from "effect/Schema"
 *
 * const duration = S.decodeUnknownSync(Duration)(EffectDuration.millis(250))
 * console.log(EffectDuration.toMillis(duration))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Duration = Schema;

/**
 * Decoded duration type exposed under the compatibility name {@link Duration}.
 *
 * **Example** (Annotate through the compatibility type)
 *
 * ```ts
 * import type { Duration as DurationValue } from "@beep/schema/Duration"
 * import { Duration } from "effect"
 *
 * const duration = Duration.millis(250) satisfies DurationValue
 * console.log(duration)
 * ```
 *
 * @see {@link Schema} for the canonical runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export type Duration = Schema;
