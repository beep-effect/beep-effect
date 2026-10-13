// The raw composed-document record produced by the internal composer and
// consumed by the internal stringifier. The public `YamlDocument` class (a
// `Schema.Class` carrying materialized `YamlDiagnostic` arrays) is built from
// this record by the facade; the engine never constructs public classes.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { YamlNode } from "../YamlNode.ts";
import { RawDiagnostic } from "./diagnostics.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/raw-document");

/**
 * A YAML directive as raw name/parameter strings (e.g. `%YAML 1.2`).
 *
 * **Example** (Represent a version directive)
 *
 * ```ts
 * import type { RawDirective } from "@beep/scratchpad/effected/yaml/internal/raw-document"
 * const directive: RawDirective = { name: "YAML", parameters: ["1.2"] }
 * console.log(directive.parameters[0]) // 1.2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawDirective = S.Struct({
	name: S.String.annotate({ description: "The directive name without its leading percent marker." }),
	parameters: S.Array(S.String).annotate({ description: "The directive's parameters in source order." }),
}).pipe($I.annoteSchema("RawDirective", { description: "A plain YAML directive represented by its raw name and parameter strings." }));

/**
 * The structural directive type described by {@link RawDirective}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawDirective = typeof RawDirective.Type;

/**
 * A composed YAML document with raw, offset-based diagnostics.
 *
 * **Example** (Represent an empty document)
 *
 * ```ts
 * import type { RawYamlDocument } from "@beep/scratchpad/effected/yaml/internal/raw-document"
 * const document: RawYamlDocument = {
 *   contents: null, errors: [], warnings: [], directives: [],
 *   hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false
 * }
 * console.log(document.contents) // null
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawYamlDocument = S.Struct({
	contents: S.NullOr(YamlNode).annotate({ description: "The composed root node, or null for an empty document." }),
	errors: S.Array(RawDiagnostic).annotate({ description: "Raw parse errors in reporting order." }),
	warnings: S.Array(RawDiagnostic).annotate({ description: "Raw recoverable warnings in reporting order." }),
	directives: S.Array(RawDirective).annotate({ description: "The document directives in source order." }),
	/**
	 * Leading document comment: own-line comments AHEAD of a `---` marker. A
	 * header with no marker, or one after the marker, belongs to the content
	 * instead — see `attachHeaderToFirstEntry` in composer/document.ts.
	 *
	 * @since 0.0.0
	 */
	commentBefore: S.optionalKey(S.String).annotate({ description: "Own-line comments preceding the document-start marker." }),
	/**
	 * Trailing document comment: own-line comments after the content (or after `...`).
	 *
	 * @since 0.0.0
	 */
	comment: S.optionalKey(S.String).annotate({ description: "Own-line comments following the content or document-end marker." }),
	hasDocumentStart: S.Boolean.annotate({ description: "Whether the source contains an explicit document-start marker." }),
	hasDocumentEnd: S.Boolean.annotate({ description: "Whether the source contains an explicit document-end marker." }),
	/**
	 * `true` when the `---` marker was followed by a tab in the source; the
	 * canonical stringifier emits a `...` terminator for this shape.
	 *
	 * @since 0.0.0
	 */
	hasDocumentStartTab: S.Boolean.annotate({ description: "Whether a tab followed the document-start marker, requiring a terminator when stringified." }),
}).pipe($I.annoteSchema("RawYamlDocument", { description: "A plain composed document consumed by the engine and materialized by the public facade." }));

/**
 * The structural document type described by {@link RawYamlDocument}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawYamlDocument = typeof RawYamlDocument.Type;
