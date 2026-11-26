import { $YamlId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { YamlNode } from "../YamlNode.ts";
import { RawDiagnostic } from "./diagnostics.ts";

const $I = $YamlId.create("internal/raw-document");

/**
 * **Example** (Represent a version directive)
 *
 * ```ts
 * import { RawDirective } from "@beep/yaml/internal/raw-document"
 * const directive = RawDirective.make({ name: "YAML", parameters: ["1.2"] })
 * console.log(directive.parameters[0]) // 1.2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RawDirective extends S.Opaque<RawDirective, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(
      $I.annoteKey("RawDirective.name", { description: "The directive name without its leading percent marker." })
    ),
    parameters: S.Array(S.String).pipe(
      $I.annoteKey("RawDirective.parameters", { description: "The directive's parameters in source order." })
    ),
  }).pipe(
    $I.annoteSchema("RawDirective", {
      description: "A plain YAML directive represented by its raw name and parameter strings.",
    })
  )
) {}

/**
 * A composed YAML document with raw, offset-based diagnostics.
 *
 * **Example** (Represent an empty document)
 *
 * ```ts
 * import { RawYamlDocument } from "@beep/yaml/internal/raw-document"
 * const document = RawYamlDocument.make({
 *   contents: null, errors: [], warnings: [], directives: [],
 *   hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false
 * })
 * console.log(document.contents) // null
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RawYamlDocument extends S.Opaque<RawYamlDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    contents: S.NullOr(YamlNode).pipe(
      $I.annoteKey("RawYamlDocument.contents", {
        description: "The composed root node, or null for an empty document.",
      })
    ),
    errors: S.Array(RawDiagnostic).pipe(
      $I.annoteKey("RawYamlDocument.errors", { description: "Raw parse errors in reporting order." })
    ),
    warnings: S.Array(RawDiagnostic).pipe(
      $I.annoteKey("RawYamlDocument.warnings", { description: "Raw recoverable warnings in reporting order." })
    ),
    directives: S.Array(RawDirective).pipe(
      $I.annoteKey("RawYamlDocument.directives", { description: "The document directives in source order." })
    ),
    /**
     * Leading document comment: own-line comments AHEAD of a `---` marker. A
     * header with no marker, or one after the marker, belongs to the content
     * instead — see `attachHeaderToFirstEntry` in composer/document.ts.
     *
     * @since 0.0.0
     */
    commentBefore: S.optionalKey(S.String).pipe(
      $I.annoteKey("RawYamlDocument.commentBefore", {
        description: "Own-line comments preceding the document-start marker.",
      })
    ),
    /**
     * Trailing document comment: own-line comments after the content (or after `...`).
     *
     * @since 0.0.0
     */
    comment: S.optionalKey(S.String).pipe(
      $I.annoteKey("RawYamlDocument.comment", {
        description: "Own-line comments following the content or document-end marker.",
      })
    ),
    hasDocumentStart: S.Boolean.pipe(
      $I.annoteKey("RawYamlDocument.hasDocumentStart", {
        description: "Whether the source contains an explicit document-start marker.",
      })
    ),
    hasDocumentEnd: S.Boolean.pipe(
      $I.annoteKey("RawYamlDocument.hasDocumentEnd", {
        description: "Whether the source contains an explicit document-end marker.",
      })
    ),
    /**
     * `true` when the `---` marker was followed by a tab in the source; the
     * canonical stringifier emits a `...` terminator for this shape.
     *
     * @since 0.0.0
     */
    hasDocumentStartTab: S.Boolean.pipe(
      $I.annoteKey("RawYamlDocument.hasDocumentStartTab", {
        description: "Whether a tab followed the document-start marker, requiring a terminator when stringified.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RawYamlDocument", {
      description: "A plain composed document consumed by the engine and materialized by the public facade.",
    })
  )
) {}
