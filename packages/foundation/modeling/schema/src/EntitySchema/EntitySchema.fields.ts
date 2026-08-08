/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type * as S from "effect/Schema";
import type * as Model from "../Model/index.ts";
import type * as VariantSchema from "../VariantSchema/index.ts";
/**
 * Selected-row schema field map attached to entity definitions.
 *
 * **Example** (Declare selected-row fields)
 *
 * ```ts
 * import type { Fields } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const fields: Fields = { id: S.String }
 * console.log(Object.keys(fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Fields = Readonly<Record<string, S.Top>>;

/**
 * Explicit variant field accepted by {@link ClassFactory}.
 *
 * **Example** (Satisfy variant field input)
 *
 * ```ts
 * import type { EntityVariantFieldInput } from "@beep/schema/EntitySchema"
 * import * as Model from "@beep/schema/Model"
 * import * as S from "effect/Schema"
 *
 * const field = Model.Field({
 *   select: S.String,
 *   insert: S.String,
 *   update: S.String,
 *   json: S.String,
 *   jsonCreate: S.String,
 *   jsonUpdate: S.String
 * }) satisfies EntityVariantFieldInput
 * console.log(S.isSchema(field.schemas.select))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityVariantFieldInput = VariantSchema.Field.Any & {
  readonly schemas: VariantSchema.Field.ConfigWithKeys<Model.Variant> & {
    readonly select: S.Top;
  };
};

/**
 * Field input accepted by {@link ClassFactory}.
 *
 * **Example** (Satisfy simple field input)
 *
 * ```ts
 * import type { EntityFieldInput } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const field = S.String satisfies EntityFieldInput
 * console.log(S.isSchema(field))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityFieldInput = S.Top | EntityVariantFieldInput;

/**
 * Entity field input map accepted by {@link ClassFactory}.
 *
 * **Example** (Satisfy field input map)
 *
 * ```ts
 * import type { EntityFieldInputs } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * const fields = { name: S.String } satisfies EntityFieldInputs
 * console.log(S.isSchema(fields.name))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityFieldInputs = Readonly<Record<string, EntityFieldInput>>;

/**
 * Extract the selected-row schema from one entity field input.
 *
 * **Example** (Extract selected-row schema)
 *
 * ```ts
 * import type { SelectedFieldOf } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * type Selected = SelectedFieldOf<typeof S.String>
 * const selected = S.String satisfies Selected
 * console.log(S.isSchema(selected))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SelectedFieldOf<Field extends EntityFieldInput> = Field extends {
  readonly schemas: {
    readonly select: infer Select extends S.Top;
  };
}
  ? Select
  : Field extends S.Top
    ? Field
    : never;

/**
 * Extract selected-row schemas from an entity field input map.
 *
 * **Example** (Extract selected field map)
 *
 * ```ts
 * import type { SelectedFieldsOf } from "@beep/schema/EntitySchema"
 * import * as S from "effect/Schema"
 *
 * type Selected = SelectedFieldsOf<{ readonly name: typeof S.String }>
 * const fields = { name: S.String } satisfies Selected
 * console.log(S.isSchema(fields.name))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SelectedFieldsOf<FieldMap extends EntityFieldInputs> = {
  readonly [K in keyof FieldMap]: SelectedFieldOf<FieldMap[K]>;
};
