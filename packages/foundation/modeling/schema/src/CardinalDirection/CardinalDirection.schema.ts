/**
 * Cardinal direction literal schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("person/CardinalDirection");

/**
 * Cardinal direction literal schema.
 *
 * **Example** (Check Options includes north)
 *
 * ```ts
 * import { CardinalDirection } from "@beep/schema/CardinalDirection"
 *
 * console.log(CardinalDirection.Options.includes("north"))
 * ```
 *
 * CardinalDirection - The cardinal directions
 *
 * @category validation
 * @since 0.0.0
 */
export const CardinalDirection = LiteralKit(["north", "south", "east", "west"]).pipe(
  $I.annoteSchema("CardinalDirection", {
    description: "CardinalDirection - The cardinal directions",
  })
);
/**
 * {@inheritDoc CardinalDirection}
 * @category validation
 * @since 0.0.0
 */
export type CardinalDirection = typeof CardinalDirection.Type;

/**
 * CardinalDirectionAbbrev - The abbreviated version of the {@link CardinalDirection}
 *
 * **Example** (Check Options includes N)
 *
 * ```ts
 * import { CardinalDirectionAbbrev } from "@beep/schema/CardinalDirection"
 *
 * console.log(CardinalDirectionAbbrev.Options.includes("N"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const CardinalDirectionAbbrev = LiteralKit(["N", "S", "E", "W"]).pipe(
  $I.annoteSchema("CardinalDirectionAbbrev", {
    description: "CardinalDirectionAbbrev - The abbreviated version of the CardinalDirection",
  })
);

/**
 * {@inheritDoc CardinalDirectionAbbrev}
 * @category validation
 * @since 0.0.0
 */
export type CardinalDirectionAbbrev = typeof CardinalDirectionAbbrev.Type;

/**
 * Alias for {@link CardinalDirection} (compat export name).
 *
 * **Example** (Check a north literal)
 *
 * ```ts
 * import { Schema } from "@beep/schema/CardinalDirection"
 *
 * console.log(Schema.Options.includes("north"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Schema = CardinalDirection;

/**
 * {@inheritDoc CardinalDirection}
 * @category models
 * @since 0.0.0
 */
export type Schema = CardinalDirection;

/**
 * Alias for {@link CardinalDirectionAbbrev} (compat export name).
 *
 * **Example** (Check an N abbrev literal)
 *
 * ```ts
 * import { Abbrev } from "@beep/schema/CardinalDirection"
 *
 * console.log(Abbrev.Options.includes("N"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Abbrev = CardinalDirectionAbbrev;

/**
 * {@inheritDoc CardinalDirectionAbbrev}
 * @category models
 * @since 0.0.0
 */
export type Abbrev = CardinalDirectionAbbrev;
