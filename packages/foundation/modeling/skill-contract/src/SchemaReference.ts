/**
 * Persisted references to runtime-bound schemas.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SkillContractId.create("SchemaReference");

/**
 * Stable identity of a versioned runtime schema binding.
 *
 * **Example** (Construct a schema reference id)
 *
 * ```ts
 * import { SchemaReferenceId } from "@beep/skill-contract"
 *
 * console.log(SchemaReferenceId.make("qa.inventory/v1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SchemaReferenceId = S.NonEmptyString.pipe(
  S.brand("SchemaReferenceId"),
  $I.annoteSchema("SchemaReferenceId", {
    description: "Stable, versioned identity used to bind persisted contracts to runtime schemas.",
  })
);

/**
 * Runtime type decoded by {@link SchemaReferenceId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SchemaReferenceId = typeof SchemaReferenceId.Type;

/**
 * Persisted reference to a runtime-bound schema.
 *
 * **Details**
 *
 * Contract values persist only this identity. Consumer modules own the
 * module-local binding from the identity to a live `S.Schema` value.
 *
 * **Example** (Reference a runtime schema)
 *
 * ```ts
 * import { SchemaReference, SchemaReferenceId } from "@beep/skill-contract"
 *
 * const reference = SchemaReference.make({
 *   schemaId: SchemaReferenceId.make("qa.inventory/v1")
 * })
 * console.log(reference.schemaId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaReference extends S.Class<SchemaReference>($I`SchemaReference`)(
  { schemaId: SchemaReferenceId },
  $I.annote("SchemaReference", {
    description: "Persisted identity reference to a schema bound by a runtime consumer module.",
  })
) {}
