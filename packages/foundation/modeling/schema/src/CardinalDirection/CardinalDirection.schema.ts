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
 *
 * **Example** (Type-check north direction)
 *
 * ```ts
 * import { CardinalDirection } from "@beep/schema/CardinalDirection"
 *
 * const direction: CardinalDirection = "north"
 * console.log(CardinalDirection.Options.includes(direction))
 * ```
 *
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
 *
 * **Example** (Type-check N abbreviation)
 *
 * ```ts
 * import { CardinalDirectionAbbrev } from "@beep/schema/CardinalDirection"
 *
 * const abbrev: CardinalDirectionAbbrev = "N"
 * console.log(CardinalDirectionAbbrev.Options.includes(abbrev))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type CardinalDirectionAbbrev = typeof CardinalDirectionAbbrev.Type;

/**
 * {@inheritDoc CardinalDirection}
 *
 * **Example** (Check Schema Options includes)
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
 *
 * **Example** (Assign Schema type north)
 *
 * ```ts
 * import type { Schema } from "@beep/schema/CardinalDirection"
 *
 * const direction: Schema = "north"
 * console.log(direction)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema = CardinalDirection;

/**
 * {@inheritDoc CardinalDirectionAbbrev}
 *
 * **Example** (Check Abbrev Options includes)
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
 *
 * **Example** (Assign Abbrev type N)
 *
 * ```ts
 * import type { Abbrev } from "@beep/schema/CardinalDirection"
 *
 * const abbrev: Abbrev = "N"
 * console.log(abbrev)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Abbrev = CardinalDirectionAbbrev;
