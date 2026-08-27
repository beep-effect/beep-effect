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

import type { YamlNode } from "../YamlNode.ts";
import type { RawDiagnostic } from "./diagnostics.ts";

/**
 * A YAML directive as raw name/parameter strings (e.g. `%YAML 1.2`).
 *
 * @see {@link YamlDirective} for the public schema-backed directive class.
 * @internal
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
 * **Gotchas**
 *
 * Positions are `offset`/`length` only. The facade derives
 * `line`/`character` when materializing {@link YamlDocument}. Do not import
 * public diagnostic classes from this module.
 *
 * @see {@link RawDiagnostic} for the offset-only diagnostic record.
 * @see {@link YamlDocument} for the public class the facade materializes.
 * @internal
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
	 */
	readonly commentBefore?: string;
	/** Trailing document comment: own-line comments after the content (or after `...`). */
	readonly comment?: string;
	readonly hasDocumentStart: boolean;
	readonly hasDocumentEnd: boolean;
	/**
	 * `true` when the `---` marker was followed by a tab in the source; the
	 * canonical stringifier emits a `...` terminator for this shape.
	 */
	readonly hasDocumentStartTab: boolean;
}
