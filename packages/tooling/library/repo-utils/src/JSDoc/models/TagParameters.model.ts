/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { ArrayOfStrings } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("JSDoc/models/TagParameters.model");
/**
 * Structured description of what arguments a tag accepts.
 *
 * **Example** (Make TagParameters instance)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TagParameters } from "@beep/repo-utils/JSDoc/models/TagParameters.model"
 *
 * const parameters = TagParameters.make({
 *   syntax: "@param name - description",
 *   acceptsType: false,
 *   acceptsName: true,
 *   acceptsDescription: true,
 *   allowedValues: O.none()
 * })
 * console.log(parameters.acceptsName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TagParameters extends S.Class<TagParameters>($I`TagParameters`)(
  {
    /** Short syntax template for a typed parameter tag. */
    syntax: S.String.annotateKey({
      description: "Short syntax template for a typed parameter tag.",
    }),
    /** Whether a type expression is accepted/required */
    acceptsType: S.Boolean.annotateKey({
      description: "Whether a type expression is accepted/required",
    }),
    /** Whether a name/identifier is accepted/required */
    acceptsName: S.Boolean.annotateKey({
      description: "Whether a name/identifier is accepted/required",
    }),
    /** Whether free-text description is accepted */
    acceptsDescription: S.Boolean.annotateKey({
      description: "Whether free-text description is accepted",
    }),
    /** For tags with constrained values, the allowed options */
    allowedValues: S.OptionFromOptionalKey(ArrayOfStrings).annotateKey({
      description: "For tags with constrained values, the allowed options",
    }),
  },
  $I.annote("TagParameters", {
    description: "Structured description of what arguments a tag accepts",
  })
) {}
