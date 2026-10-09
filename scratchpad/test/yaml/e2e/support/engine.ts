// This engine adapter is an internal test helper with a direct-call contract.
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as P from "effect/Predicate";
import { buildAnchorMap, getNodeValue } from "../../../../effected/yaml/internal/composer/anchors.ts";
import { composeAllDocuments, composeFirstDocument } from "../../../../effected/yaml/internal/composer/document.ts";
import type { RawDiagnostic } from "../../../../effected/yaml/internal/diagnostics.ts";
import { isFatalCode } from "../../../../effected/yaml/internal/diagnostics.ts";
import type { ParseOptionsInput, StringifyOptionsInput } from "../../../../effected/yaml/internal/options.ts";
import type { RawYamlDocument } from "../../../../effected/yaml/internal/raw-document.ts";
import { stringifyDocument as stringifyRawDocument, stringifyValue } from "../../../../effected/yaml/internal/stringifier.ts";
import type { YamlNode } from "../../../../effected/yaml/YamlNode.ts";
import { dual } from "effect/Function";

export { buildAnchorMap, getNodeValue };

/** Raw aggregate parse failure (the facade will materialize YamlParseError). */
export interface RawParseFailure {
	readonly errors: ReadonlyArray<RawDiagnostic>;
}

/** v3 `parseDocument` semantics: fail when any fatal-code diagnostic exists. */
export function parseDocument(text: string, options?: ParseOptionsInput): Effect.Effect<RawYamlDocument, RawParseFailure>;
export function parseDocument(options?: ParseOptionsInput): (text: string) => Effect.Effect<RawYamlDocument, RawParseFailure>;
export function parseDocument(...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]): Effect.Effect<RawYamlDocument, RawParseFailure> | ((text: string) => Effect.Effect<RawYamlDocument, RawParseFailure>) {
	return dual<
		(...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]) => Effect.Effect<RawYamlDocument, RawParseFailure> | ((text: string) => Effect.Effect<RawYamlDocument, RawParseFailure>),
		(text: string, options?: ParseOptionsInput) => Effect.Effect<RawYamlDocument, RawParseFailure>
	>((args) => P.isString(args[0]), function parseDocument(text: string, options?: ParseOptionsInput): Effect.Effect<RawYamlDocument, RawParseFailure> {
	return Effect.suspend(() => {
		const doc = composeFirstDocument(text, options);
		const fatal = doc.errors.filter((e) => isFatalCode(e.code));
		return fatal.length > 0 ? Effect.fail({ errors: fatal }) : Effect.succeed(doc);
	});
})(...args);
}

/** v3 `parseAllDocuments` semantics: stream-level InvalidDirective + per-doc fatals. */
export function parseAllDocuments(text: string, options?: ParseOptionsInput): Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>;
export function parseAllDocuments(options?: ParseOptionsInput): (text: string) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>;
export function parseAllDocuments(...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]): Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure> | ((text: string) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>) {
	return dual<
		(...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure> | ((text: string) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>),
		(text: string, options?: ParseOptionsInput) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>
	>((args) => P.isString(args[0]), function parseAllDocuments(text: string, options?: ParseOptionsInput): Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure> {
	return Effect.suspend(() => {
		const { documents, streamErrors } = composeAllDocuments(text, options);
		const fatal = [
			...streamErrors.filter((e) => e.code === "InvalidDirective"),
			...documents.flatMap((d) => d.errors.filter((e) => isFatalCode(e.code))),
		];
		return fatal.length > 0 ? Effect.fail({ errors: fatal }) : Effect.succeed(documents);
	});
})(...args);
}

/** v3 `parse` semantics: single-doc value parse with DuplicateKey promotion. */
export function parse(text: string, options?: ParseOptionsInput): Effect.Effect<unknown, RawParseFailure>;
export function parse(options?: ParseOptionsInput): (text: string) => Effect.Effect<unknown, RawParseFailure>;
export function parse(...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]): Effect.Effect<unknown, RawParseFailure> | ((text: string) => Effect.Effect<unknown, RawParseFailure>) {
	return dual<
		(...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]) => Effect.Effect<unknown, RawParseFailure> | ((text: string) => Effect.Effect<unknown, RawParseFailure>),
		(text: string, options?: ParseOptionsInput) => Effect.Effect<unknown, RawParseFailure>
	>((args) => P.isString(args[0]), function parse(text: string, options?: ParseOptionsInput): Effect.Effect<unknown, RawParseFailure> {
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
			const anchors = MutableHashMap.empty<string, YamlNode>();
			return Effect.succeed(getNodeValue(doc.contents, anchors));
		}),
	);
})(...args);
}

/** Sync stringify of a plain value (engine `stringifyValue`). */
export function stringify(...[value, options]: [value: unknown, options?: StringifyOptionsInput]): string {
	return stringifyValue(value, options);
}

/** Sync stringify of a raw composed document. */
export function stringifyDocument(doc: RawYamlDocument, options?: StringifyOptionsInput): string;
export function stringifyDocument(options?: StringifyOptionsInput): (doc: RawYamlDocument) => string;
export function stringifyDocument(...args: [doc: RawYamlDocument, options?: StringifyOptionsInput | undefined] | [options?: StringifyOptionsInput | undefined]): string | ((doc: RawYamlDocument) => string) {
	return dual<
		(...args: [doc: RawYamlDocument, options?: StringifyOptionsInput | undefined] | [options?: StringifyOptionsInput | undefined]) => string | ((doc: RawYamlDocument) => string),
		(doc: RawYamlDocument, options?: StringifyOptionsInput) => string
	>((args) => args.length >= 2 || (args[0] !== undefined && "contents" in args[0]), function stringifyDocument(doc: RawYamlDocument, options?: StringifyOptionsInput): string {
	return stringifyRawDocument(doc, options);
})(...args);
}
