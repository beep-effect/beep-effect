/**
 * Raw composed-document records produced by the internal composer.
 *
 * The public `YamlDocument` class (a `Schema.Class` carrying materialized
 * `YamlDiagnostic` arrays) is built from this record by the facade; the
 * engine never constructs public classes, keeping the import arrow
 * facade → engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import { YamlNode } from "../YamlNode.ts";
import { RawDiagnostic } from "./diagnostics.ts";

const $I = $ScratchpadId.create("yaml/internal/raw-document");

/**
 * A YAML directive as raw name/parameter strings (e.g. `%YAML 1.2`).
 *
 * **Example** (Guard a raw directive)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RawDirective } from "@beep/scratchpad/yaml/internal/raw-document"
 *
 * console.log(S.is(RawDirective)({ name: "YAML", parameters: ["1.2"] })) // true
 * ```
 *
 * @see {@link YamlDirective} for the public schema-backed directive class.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const RawDirective = Schema.Struct({
	name: Schema.String,
	parameters: Schema.Array(Schema.String),
}).pipe(
	$I.annoteSchema("RawDirective", {
		description: "Internal YAML directive represented by its name and raw parameter strings.",
	}),
);

export type RawDirective = typeof RawDirective.Type;

/**
 * A composed YAML document with raw, offset-based diagnostics.
 *
 * **Gotchas**
 *
 * Positions are `offset`/`length` only. The facade derives
 * `line`/`character` when materializing {@link YamlDocument}. Do not import
 * public diagnostic classes from this module.
 *
 * **Example** (Guard an empty raw document)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RawYamlDocument } from "@beep/scratchpad/yaml/internal/raw-document"
 *
 * console.log(S.is(RawYamlDocument)({
 *   contents: null,
 *   errors: [],
 *   warnings: [],
 *   directives: [],
 *   hasDocumentStart: false,
 *   hasDocumentEnd: false,
 *   hasDocumentStartTab: false,
 * })) // true
 * ```
 *
 * @see {@link RawDiagnostic} for the offset-only diagnostic record.
 * @see {@link YamlDocument} for the public class the facade materializes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const RawYamlDocument = Schema.Struct({
	contents: Schema.NullOr(YamlNode),
	errors: Schema.Array(RawDiagnostic),
	warnings: Schema.Array(RawDiagnostic),
	directives: Schema.Array(RawDirective),
	/**
	 * Leading document comment: own-line comments AHEAD of a `---` marker. A
	 * header with no marker, or one after the marker, belongs to the content
	 * instead — see `attachHeaderToFirstEntry` in composer/document.ts.
	 */
	commentBefore: Schema.optionalKey(Schema.String),
	/** Trailing document comment: own-line comments after the content (or after `...`). */
	comment: Schema.optionalKey(Schema.String),
	hasDocumentStart: Schema.Boolean,
	hasDocumentEnd: Schema.Boolean,
	/**
	 * `true` when the `---` marker was followed by a tab in the source; the
	 * canonical stringifier emits a `...` terminator for this shape.
	 */
	hasDocumentStartTab: Schema.Boolean,
}).pipe(
	$I.annoteSchema("RawYamlDocument", {
		description: "Internal composed YAML document with raw diagnostics, directives, framing and optional comments.",
	}),
);

export type RawYamlDocument = typeof RawYamlDocument.Type;
