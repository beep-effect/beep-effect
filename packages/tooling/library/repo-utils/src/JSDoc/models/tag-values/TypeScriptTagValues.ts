/**
 * TypeScript-specific tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { empty } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/TypeScriptTagValues");

/**
 * Schema-backed value for a parsed `overload` tag occurrence: marks a function overload signature.
 *
 * @example
 * ```ts
 * import { OverloadValue } from "@beep/repo-utils/JSDoc/models/tag-values/TypeScriptTagValues"
 *
 * const tag = OverloadValue.make({})
 * const tagName: "overload" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class OverloadValue extends S.TaggedClass<OverloadValue>($I`OverloadValue`)(
  "overload",
  empty,
  $I.annote("OverloadValue", {
    description: "Occurrence shape for @overload — marks a function overload signature.",
  })
) {}
