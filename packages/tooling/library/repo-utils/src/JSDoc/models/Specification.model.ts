/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoUtilsId.create("JSDoc/models/Specification.model");

/**
 * Enumerates canonical standards that define a documentation tag.
 *
 * **Details**
 *
 * `jsdoc3` is the JSDoc 3.x standard (jsdoc.app). `tsdocCore` tags must be
 * supported by every TSDoc tool, `tsdocExtended` tags are optional but
 * standardized, and `tsdocDiscretionary` tags have standardized syntax but
 * tool-specific semantics. `typescript` names the tags the TypeScript compiler
 * recognizes in `.js` files, `closure` the Google Closure Compiler,
 * `apiExtractor` Microsoft API Extractor (AEDoc) and `typedoc` TypeDoc's own
 * extensions. `custom` marks a user-defined, non-standard tag.
 *
 * **Example** (Check tsdocCore specification)
 *
 * ```ts
 * import { Specification } from "@beep/repo-utils/JSDoc/models/Specification.model"
 *
 * const source = Specification.Enum.tsdocCore
 * console.log(Specification.is.tsdocCore(source))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Specification = LiteralKit([
  "jsdoc3",
  "tsdocCore",
  "tsdocExtended",
  "tsdocDiscretionary",
  "typescript",
  "closure",
  "apiExtractor",
  "typedoc",
  "custom",
]).pipe(
  $I.annoteSchema("Specification", {
    description: "Which specification(s) define this tag",
  })
);

/**
 * Union of canonical documentation standards represented by {@link Specification}.
 *
 * **Example** (Accept Specification type)
 *
 * ```ts
 * import type { Specification } from "@beep/repo-utils/JSDoc/models/Specification.model"
 *
 * type Example = Specification
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Specification = typeof Specification.Type;
