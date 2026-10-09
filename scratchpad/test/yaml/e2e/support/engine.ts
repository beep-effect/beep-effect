/**
 * Facade-shaped adapter over the internal engine, used by the compliance
 * harness while the public `Yaml` facade is being built. Reproduces the v3
 * `parse`/`parseDocument`/`parseAllDocuments` wrapper semantics exactly:
 * fatal-code filtering (now via the single `isFatalCode` predicate),
 * DuplicateKey promotion under `uniqueKeys`, and incremental anchor
 * resolution for value extraction.
 */

import { Effect } from "effect";
import { buildAnchorMap, getNodeValue } from "../../../../effected/yaml/internal/composer/anchors.ts";
import { composeAllDocuments, composeFirstDocument } from "../../../../effected/yaml/internal/composer/document.ts";
import type { RawDiagnostic } from "../../../../effected/yaml/internal/diagnostics.ts";
import { isFatalCode } from "../../../../effected/yaml/internal/diagnostics.ts";
import type { ParseOptionsInput, StringifyOptionsInput } from "../../../../effected/yaml/internal/options.ts";
import type { RawYamlDocument } from "../../../../effected/yaml/internal/raw-document.ts";
import { stringifyDocument as stringifyRawDocument, stringifyValue } from "../../../../effected/yaml/internal/stringifier.ts";
import type { YamlNode } from "../../../../effected/yaml/YamlNode.ts";

export { buildAnchorMap, getNodeValue };

/** Raw aggregate parse failure (the facade will materialize YamlParseError). */
export interface RawParseFailure {
	readonly errors: ReadonlyArray<RawDiagnostic>;
}

/** v3 `parseDocument` semantics: fail when any fatal-code diagnostic exists. */
export function parseDocument(
	text: string,
	options?: ParseOptionsInput,
): Effect.Effect<RawYamlDocument, RawParseFailure> {
	return Effect.suspend(() => {
		const doc = composeFirstDocument(text, options);
		const fatal = doc.errors.filter((e) => isFatalCode(e.code));
		return fatal.length > 0 ? Effect.fail({ errors: fatal }) : Effect.succeed(doc);
	});
}

/** v3 `parseAllDocuments` semantics: stream-level InvalidDirective + per-doc fatals. */
export function parseAllDocuments(
	text: string,
	options?: ParseOptionsInput,
): Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure> {
	return Effect.suspend(() => {
		const { documents, streamErrors } = composeAllDocuments(text, options);
		const fatal = [
			...streamErrors.filter((e) => e.code === "InvalidDirective"),
			...documents.flatMap((d) => d.errors.filter((e) => isFatalCode(e.code))),
		];
		return fatal.length > 0 ? Effect.fail({ errors: fatal }) : Effect.succeed(documents);
	});
}

/** v3 `parse` semantics: single-doc value parse with DuplicateKey promotion. */
export function parse(text: string, options?: ParseOptionsInput): Effect.Effect<unknown, RawParseFailure> {
	const uniqueKeys = options?.uniqueKeys ?? true;
	return parseDocument(text, options).pipe(
		Effect.flatMap((doc) => {
			if (uniqueKeys) {
				const dupErrors = doc.warnings.filter((w) => w.code === "DuplicateKey");
				if (dupErrors.length > 0) {
					return Effect.fail({ errors: dupErrors });
				}
			}
			// Use an empty map so getNodeValue registers anchors incrementally,
			// ensuring aliases resolve to the most recent anchor at the point of use.
			const anchors = new Map<string, YamlNode>();
			return Effect.succeed(getNodeValue(doc.contents, anchors));
		}),
	);
}

/** Sync stringify of a plain value (engine `stringifyValue`). */
export function stringify(value: unknown, options?: StringifyOptionsInput): string {
	return stringifyValue(value, options);
}

/** Sync stringify of a raw composed document. */
export function stringifyDocument(doc: RawYamlDocument, options?: StringifyOptionsInput): string {
	return stringifyRawDocument(doc, options);
}
