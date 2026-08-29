/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SchemaAST } from "effect";
import * as O from "effect/Option";
import type * as S from "effect/Schema";
import type { JSDocTagDefinition } from "./JSDocTagDefinition.model.ts";

/**
 * The payload type stored in the `jsDocTagMetadata` annotation key.
 *
 * **Example** (Accept payload type)
 *
 * ```ts
 * import type { JSDocTagAnnotationPayload } from "@beep/repo-utils/JSDoc/models/JSDocTagAnnotation.model"
 *
 * type Example = JSDocTagAnnotationPayload
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JSDocTagAnnotationPayload = JSDocTagDefinition;

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly jsDocTagMetadata?: JSDocTagAnnotationPayload | undefined;
    }
  }
}

/**
 * Retrieve the JSDoc tag metadata annotation from a schema, if present.
 *
 * **Example** (Read tag metadata annotation)
 *
 * ```ts
 * import { JSDocTagDefinition, make } from "@beep/repo-utils/JSDoc/models/JSDocTagDefinition.model"
 * import { getJSDocTagMetadata } from "@beep/repo-utils/JSDoc/models/JSDocTagAnnotation.model"
 * import * as O from "effect/Option"
 *
 * const meta: Omit<JSDocTagDefinition.Encoded, "_tag"> = {
 *   synonyms: [],
 *   overview: "Documents a function parameter.",
 *   tagKind: "block",
 *   specifications: ["tsdocCore"],
 *   applicableTo: ["function"],
 *   astDerivable: "partial",
 *   astDerivableNote: "Parameter names are AST-derived; prose is authored.",
 *   parameters: {
 *     syntax: "@param name - description",
 *     acceptsType: false,
 *     acceptsName: true,
 *     acceptsDescription: true
 *   },
 *   relatedTags: ["typeParam"],
 *   example: "@param input - Raw input value."
 * }
 * const tagSchema = make("param", meta)
 * const metadata = getJSDocTagMetadata(tagSchema)
 * console.log(O.getOrUndefined(metadata)?._tag)
 * ```
 *
 * @param schema - Any Effect schema.
 * @returns The JSDocTagDefinition metadata when present.
 * @category models
 * @since 0.0.0
 */
export const getJSDocTagMetadata = (schema: S.Top): O.Option<JSDocTagAnnotationPayload> =>
  O.fromUndefinedOr(SchemaAST.resolve(schema.ast)?.jsDocTagMetadata);
