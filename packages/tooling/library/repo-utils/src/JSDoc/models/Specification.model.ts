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
  // JSDoc 3.x standard (jsdoc.app)
  "jsdoc3",
  // TSDoc Core — must be supported by all TSDoc tools
  "tsdocCore",
  // TSDoc Extended — optional but standardized
  "tsdocExtended",
  // TSDoc Discretionary — syntax standardized, semantics vary
  "tsdocDiscretionary",
  // Recognized by TypeScript compiler in .js files
  "typescript",
  // Google Closure Compiler
  "closure",
  // Microsoft API Extractor / AEDoc
  "apiExtractor",
  // TypeDoc-specific extensions
  "typedoc",
  // User-defined / non-standard
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
