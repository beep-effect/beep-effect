/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoUtilsId.create("JSDoc/models/ApplicableTo.model");

/**
 * **Details**
 *
 * `parameter` is a parameter nested within a callback or typedef tag. `module`
 * is an ES or CommonJS module, `file` a file-level comment, and `any` a tag that
 * can attach to anything.
 *
 * **Example** (Assert function target)
 *
 * ```ts
 * import { ApplicableTo } from "@beep/repo-utils/JSDoc/models/ApplicableTo.model"
 *
 * const target = ApplicableTo.Enum.function
 * console.log(ApplicableTo.is.function(target))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ApplicableTo = LiteralKit([
  "function",
  "method",
  "class",
  "classStaticBlock",
  "interface",
  "typeAlias",
  "enum",
  "enumMember",
  "variable",
  "constant",
  "property",
  "accessor",
  "constructor",
  "parameter",
  "signature",
  "indexSignature",
  "typeParameter",
  "tupleMember",
  "exportSpecifier",
  "identifier",
  "statement",
  "expression",
  "module",
  "namespace",
  "file",
  "event",
  "mixin",
  "any",
]).pipe(
  $I.annoteSchema("ApplicableTo", {
    description: "AST-level attachment surface for a documentation tag.",
  })
);

/**
 * JSDoc model export.
 *
 * **Example** (Constrain generic parameter)
 *
 * ```ts
 * import type { ApplicableTo } from "@beep/repo-utils/JSDoc/models/ApplicableTo.model"
 *
 * type Example = ApplicableTo
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ApplicableTo = typeof ApplicableTo.Type;
