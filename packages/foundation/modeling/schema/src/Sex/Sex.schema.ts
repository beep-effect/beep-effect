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
 * @example
 * ```ts
 * import { Sex } from "@beep/schema/Sex"
 *
 * console.log(Sex.Options.includes("female"))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Sex = LiteralKit(["male", "female"]).pipe(
  $I.annoteSchema("Sex", {
    description: 'The sex of a person ("male" or "female").',
  })
);
/**
 * {@inheritDoc Sex}
 *
 * @example
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
 * @example
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
 * @category models
 * @since 0.0.0
 */
export type Schema = Sex;
