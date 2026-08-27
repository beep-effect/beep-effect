/**
 * Lossless TOML document: source text paired with the linear expression CST
 * and any semantic violations as diagnostic data.
 *
 * **Details**
 *
 * Syntax errors fail `parse` typed; a syntactically valid but semantically
 * illegal document still parses, stays editable, and refuses only at
 * `toValue`. Cycle firewall: same discipline as `Toml.ts` — the engine throws
 * raw carriers (`RawTomlError`, `GuardExceeded`); this module materializes
 * {@link TomlDiagnostic} instances and the tagged {@link TomlParseError}. The
 * dependency edge runs facade → engine only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { analyze, buildValue } from "./internal/semantic.ts";
import { TomlParseError } from "./Toml.ts";
import { TomlDiagnostic } from "./TomlDiagnostic.ts";
import { TomlExpression } from "./TomlNode.ts";

const $I = $ScratchpadId.create("toml/TomlDocument");

/**
 * Materialize an engine throw into the typed error: `RawTomlError` becomes a
 * positioned diagnostic and a `GuardExceeded` depth trip becomes a
 * `NestingDepthExceeded` diagnostic. Anything else is a genuine defect and
 * rethrows.
 */
const materializeError = (text: string, defect: unknown): TomlParseError => {
	if (isRawTomlError(defect)) {
		return new TomlParseError({ diagnostics: [TomlDiagnostic.fromRaw(text, defect.diagnostic)] });
	}
	if (isGuardExceeded(defect)) {
		return new TomlParseError({
			diagnostics: [
				TomlDiagnostic.fromRaw(text, {
					code: "NestingDepthExceeded",
					message: defect.message,
					offset: defect.offset,
					length: 0,
				}),
			],
		});
	}
	throw defect;
};

/**
 * A parsed TOML document that never loses a byte: the `source` text, the
 * linear {@link TomlExpression} CST whose spans tile the source exactly, and
 * any semantic violations as {@link TomlDiagnostic} data.
 *
 * **Details**
 *
 * `parse` fails typed only on lex/parse errors; a syntactically valid but
 * semantically illegal document (say, a duplicate key) still parses with the
 * violation recorded in `diagnostics`, so the text stays inspectable and
 * editable. `stringify` reconstructs the source by concatenating expression
 * spans — that the result equals `source` is the span-bookkeeping proof, held
 * byte-exact across the full toml-test corpus. Construct via
 * {@link TomlDocument.parse}; `TomlDocument.make` is for synthetic documents.
 *
 * **Gotchas**
 *
 * Semantic violations are data on the document, not `parse` failures.
 * {@link TomlDocument.toValue} is the semantic gate: it refuses on a
 * non-empty `diagnostics`. Callers who `yield* TomlDocument.parse(text)` and
 * assume the document is semantically valid will only fail later at `toValue`.
 *
 * **Example** (Round-trip source and materialize the value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { TomlDocument } from "@beep/scratchpad/toml"
 *
 * const doc = Effect.runSync(TomlDocument.parse('name = "Alice"\n'))
 * console.log(doc.stringify()) // 'name = "Alice"\n'
 * console.log(Effect.runSync(doc.toValue())) // { name: "Alice" }
 *
 * const dup = Effect.runSync(TomlDocument.parse("a = 1\na = 2\n"))
 * console.log(dup.diagnostics[0]?.code) // "DuplicateKey"
 * ```
 *
 * @see {@link Toml.parse} for fail-fast value decode that rejects the first semantic error.
 * @see {@link TomlFormat} for span-preserving edits against this CST.
 * @category models
 * @since 0.0.0
 */
export class TomlDocument extends Schema.Class<TomlDocument>($I`TomlDocument`)(
	{
		source: Schema.String,
		expressions: Schema.Array(TomlExpression),
		diagnostics: Schema.Array(TomlDiagnostic),
	},
	$I.annote("TomlDocument", {
		description: "A lossless TOML document pairing source text with a span-tiling CST and semantic diagnostics.",
	}),
) {
	/**
	 * Parse TOML text into a lossless document. Fails with
	 * {@link TomlParseError} only on lex/parse errors — including a
	 * nesting-depth bomb, which surfaces as a `NestingDepthExceeded`
	 * diagnostic, never an unhandled defect. Semantic violations do not fail:
	 * they land in `diagnostics` as data (first violation wins, so there is at
	 * most one today; the array shape is the contract).
	 *
	 * @see {@link Toml.parse} for fail-fast value decode that rejects semantic errors immediately.
	 */
	static readonly parse = Effect.fn("TomlDocument.parse")(function* (text: string) {
		const expressions = yield* Effect.try({
			try: () => parseExpressions(text),
			catch: (defect) => materializeError(text, defect),
		});
		const diagnostics: Array<TomlDiagnostic> = [];
		try {
			analyze(expressions);
		} catch (defect) {
			if (!isRawTomlError(defect)) {
				throw defect;
			}
			diagnostics.push(TomlDiagnostic.fromRaw(text, defect.diagnostic));
		}
		return TomlDocument.make({ source: text, expressions, diagnostics });
	});

	/**
	 * A `Schema<TomlDocument, string>` decoding TOML text into a full document
	 * (source, expressions, diagnostics) and encoding a document back to its
	 * byte-exact text.
	 *
	 * Schema-producing: each call returns a fresh schema whose derivation
	 * caches are not shared across calls; bind the result to a `const` on hot
	 * paths.
	 *
	 * **Example** (Decode a document schema)
	 *
	 * ```ts
	 * import { Effect } from "effect"
	 * import * as S from "effect/Schema"
	 * import { TomlDocument } from "@beep/scratchpad/toml"
	 *
	 * const schema = TomlDocument.schema()
	 * const doc = Effect.runSync(S.decodeUnknownEffect(schema)('name = "Alice"\n'))
	 * console.log(doc.stringify()) // 'name = "Alice"\n'
	 * ```
	 */
	static schema(): Schema.Codec<TomlDocument, string> {
		return Schema.String.pipe(
			Schema.decodeTo(
				Schema.instanceOf(TomlDocument),
				SchemaTransformation.transformOrFail({
					decode: (input: string) =>
						TomlDocument.parse(input).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input)),
						),
					encode: (doc: TomlDocument) => Effect.succeed(doc.stringify()),
				}),
			),
		);
	}

	/**
	 * Materialize the document's plain JavaScript value. Fails with
	 * {@link TomlParseError} carrying the stored `diagnostics` when the parse
	 * recorded semantic violations; otherwise builds the value from the
	 * expression list (already validated, so the defensive materialization
	 * wrapper is belt-and-suspenders).
	 *
	 * **Example** (Refuse a duplicate-key document)
	 *
	 * ```ts
	 * import { Effect, Result } from "effect"
	 * import { TomlDocument } from "@beep/scratchpad/toml"
	 *
	 * const doc = Effect.runSync(TomlDocument.parse("a = 1\na = 2\n"))
	 * const outcome = Effect.runSync(Effect.result(doc.toValue()))
	 * console.log(Result.isFailure(outcome) && outcome.failure._tag) // "TomlParseError"
	 * ```
	 *
	 * @see {@link Toml.parse} for fail-fast value decode that never yields a diagnostic-bearing document.
	 */
	toValue(): Effect.Effect<unknown, TomlParseError> {
		if (this.diagnostics.length > 0) {
			return Effect.fail(new TomlParseError({ diagnostics: this.diagnostics }));
		}
		return Effect.try({
			try: () => buildValue(this.expressions),
			catch: (defect) => materializeError(this.source, defect),
		});
	}

	/**
	 * Reconstruct the document text by concatenating each expression's source
	 * span in order. The expression spans tile the source exactly, so the
	 * result equals `source` byte-for-byte — the round-trip contract this
	 * class exists to prove. Pure and total.
	 *
	 * **Example** (Prove span tiling)
	 *
	 * ```ts
	 * import { Effect } from "effect"
	 * import { TomlDocument } from "@beep/scratchpad/toml"
	 *
	 * const source = 'name = "Alice"\n'
	 * const doc = Effect.runSync(TomlDocument.parse(source))
	 * console.log(doc.stringify() === source) // true
	 * ```
	 */
	stringify(): string {
		let out = "";
		for (const expression of this.expressions) {
			out += this.source.slice(expression.offset, expression.offset + expression.length);
		}
		return out;
	}
}
