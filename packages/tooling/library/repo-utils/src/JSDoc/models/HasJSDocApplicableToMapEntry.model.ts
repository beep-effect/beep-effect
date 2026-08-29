/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ApplicableTo } from "./ApplicableTo.model.ts";

const $I = $RepoUtilsId.create("JSDoc/models/HasJSDocApplicableToMapEntry.model");

/**
 * One mapping row from a TypeScript `HasJSDoc` member name to an
 * `ApplicableTo` classification.
 *
 * @category models
 * @since 0.0.0
 */
const fields = { member: S.String } as const;
/**
 * JSDoc model export.
 *
 * **Example** (Make applicable map entry)
 *
 * ```ts
 * import { HasJSDocApplicableToMapEntry } from "@beep/repo-utils/JSDoc/models/HasJSDocApplicableToMapEntry.model"
 *
 * const entry = HasJSDocApplicableToMapEntry.make({
 *   applicableTo: "function",
 *   member: "getJsDocs"
 * })
 * console.log(entry.member)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HasJSDocApplicableToMapEntry = ApplicableTo.toTaggedUnion("applicableTo")({
  function: fields,
  method: fields,
  class: fields,
  classStaticBlock: fields,
  interface: fields,
  typeAlias: fields,
  enum: fields,
  enumMember: fields,
  variable: fields,
  constant: fields,
  property: fields,
  accessor: fields,
  constructor: fields,
  parameter: fields, // nested within @callback/@typedef
  signature: fields,
  indexSignature: fields,
  typeParameter: fields,
  tupleMember: fields,
  exportSpecifier: fields,
  identifier: fields,
  statement: fields,
  expression: fields,
  module: fields, // ES module or CJS module
  namespace: fields,
  file: fields, // file-level comment
  event: fields,
  mixin: fields,
  any: fields, // can attach to anything
}).pipe(
  $I.annoteSchema("HasJSDocApplicableToMapEntry", {
    description: "One mapping row from a TypeScript `HasJSDoc` member name to an `ApplicableTo` classification.",
  })
);
