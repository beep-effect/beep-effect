/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";

/**
 * Internal identity composer.
 *
 * **Example** (Compose entity identifier)
 *
 * ```ts
 * import { $I } from "../../src/EntitySchema/EntitySchema.shared.ts"
 *
 * const identifier = $I`ExampleEntity`
 * console.log(identifier)
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const $I = $SchemaId.create("EntitySchema");
/**
 * Annotation key used to attach a schema's entity definition metadata.
 *
 * **Example** (Log definition annotation key)
 *
 * ```ts
 * import { DefinitionAnnotationKey } from "../../src/EntitySchema/EntitySchema.shared.ts"
 *
 * console.log(DefinitionAnnotationKey)
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const DefinitionAnnotationKey = "@beep/schema/EntitySchema/definition" as const;
