/**
 * Person sex literal schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("Sex");

/**
 * The sex of a person ("male" or "female").
 *
 * **Example** (Check female in Options)
 *
 * ```ts
 * import { Sex } from "@beep/schema/Sex"
 *
 * console.log(Sex.Options.includes("female"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Sex = LiteralKit(["male", "female"]).pipe(
  $I.annoteSchema("Sex", {
    description: 'The sex of a person ("male" or "female").',
  })
);
/**
 * {@inheritDoc Sex}
 *
 * **Example** (Assign female Sex type)
 *
 * ```ts
 * import { Sex } from "@beep/schema/Sex"
 *
 * const sex: Sex = "female"
 * console.log(Sex.Options.includes(sex))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type Sex = typeof Sex.Type;

/**
 * {@inheritDoc Sex}
 *
 * **Example** (Check Schema Options includes)
 *
 * ```ts
 * import { Schema } from "@beep/schema/Sex"
 *
 * console.log(Schema.Options.includes("female"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Schema = Sex;

/**
 * {@inheritDoc Sex}
 *
 * **Example** (Type Schema as female)
 *
 * ```ts
 * import type { Schema } from "@beep/schema/Sex"
 *
 * const sex: Schema = "female"
 * console.log(sex)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema = Sex;
