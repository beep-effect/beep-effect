// The raw composed-document record produced by the internal composer and
// consumed by the internal stringifier. The public `YamlDocument` class (a
// `Schema.Class` carrying materialized `YamlDiagnostic` arrays) is built from
// this record by the facade; the engine never constructs public classes.

import type { YamlNode } from "../YamlNode.ts";
import type { RawDiagnostic } from "./diagnostics.ts";

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
 * @category type-level
 * @since 0.0.0
 */
export interface RawDirective {
	readonly name: string;
	readonly parameters: ReadonlyArray<string>;
}

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
 * @category type-level
 * @since 0.0.0
 */
export interface RawYamlDocument {
	readonly contents: YamlNode | null;
	readonly errors: ReadonlyArray<RawDiagnostic>;
	readonly warnings: ReadonlyArray<RawDiagnostic>;
	readonly directives: ReadonlyArray<RawDirective>;
	/**
	 * Leading document comment: own-line comments AHEAD of a `---` marker. A
	 * header with no marker, or one after the marker, belongs to the content
	 * instead — see `attachHeaderToFirstEntry` in composer/document.ts.
	 *
	 * @since 0.0.0
	 */
	readonly commentBefore?: string;
	/**
	 * Trailing document comment: own-line comments after the content (or after `...`).
	 *
	 * @since 0.0.0
	 */
	readonly comment?: string;
	readonly hasDocumentStart: boolean;
	readonly hasDocumentEnd: boolean;
	/**
	 * `true` when the `---` marker was followed by a tab in the source; the
	 * canonical stringifier emits a `...` terminator for this shape.
	 *
	 * @since 0.0.0
	 */
	readonly hasDocumentStartTab: boolean;
}
