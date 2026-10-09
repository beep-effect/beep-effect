// The lossless document concept: TomlDocument pairs the source text with the
// parser's linear expression CST and any semantic violations as diagnostics
// data. Syntax errors fail `parse` typed; a syntactically valid but
// semantically illegal document still parses, stays editable, and refuses
// only at `toValue`.
//
// Cycle firewall: same discipline as `Toml.ts` — the engine throws raw
// carriers (`RawTomlError`, `GuardExceeded`); this module materializes
// `TomlDiagnostic` instances and the tagged `TomlParseError`. The dependency
// edge runs facade → engine only.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { analyze, buildValue } from "./internal/semantic.ts";
import { TomlParseError } from "./Toml.ts";
import { TomlDiagnostic } from "./TomlDiagnostic.ts";
import { TomlExpression } from "./TomlNode.ts";

const $I = $ScratchpadId.create("effected/toml/TomlDocument");

/**
 * Materialize an engine throw into the typed error: `RawTomlError` becomes a
 * positioned diagnostic and a `GuardExceeded` depth trip becomes a
 * `NestingDepthExceeded` diagnostic. Anything else is a genuine defect and
 * rethrows.
 */
const materializeError = (text: string, defect: unknown): TomlParseError => {
	if (isRawTomlError(defect)) {
		return TomlParseError.make({ diagnostics: [TomlDiagnostic.fromRaw(text, defect.diagnostic)] });
	}
	if (isGuardExceeded(defect)) {
		return TomlParseError.make({
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
 * linear {@link (TomlExpression:type)} CST whose spans tile the source
 * exactly, and
 * any semantic violations as {@link TomlDiagnostic} data.
 *
 * **Details**
 *
 * `parse` fails typed only on lex/parse errors; a syntactically valid but
 * semantically illegal document (say, a duplicate key) still parses with the
 * violation recorded in `diagnostics`, so the text stays inspectable and
 * editable. `stringify` reconstructs the source by concatenating expression
 * spans — that the result equals `source` is the span-bookkeeping proof, held
 * byte-exact across the full toml-test corpus. `toValue` refuses on a
 * non-empty `diagnostics`.
 *
 * Construct via {@link TomlDocument.parse}; `TomlDocument.make` is for
 * synthetic documents.
 *
 * **Example** (Preserve TOML source and decode its value)
 *
 * ```ts
 * import { TomlDocument } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const doc = yield* TomlDocument.parse('name = "Alice"\n');
 *   doc.stringify(); // 'name = "Alice"\n' — byte-exact
 *   return yield* doc.toValue(); // { name: "Alice" }
 * });
 * ```
 *
 * @public
 */
export class TomlDocument extends S.Class<TomlDocument>($I`TomlDocument`)({
	source: S.String.annotateKey({ description: "Original TOML text preserved exactly, including comments, whitespace and line endings" }),
	expressions: S.Array(TomlExpression).annotateKey({ description: "Top-level constructs and trivia in document order, with spans covering the original text exactly" }),
	diagnostics: S.Array(TomlDiagnostic).annotateKey({ description: "Semantic violations recorded during parsing that prevent conversion to a plain value" }),
}, $I.annote("TomlDocument", { description: "A parsed TOML document that never loses a byte: the `source` text, the linear (TomlExpression:type) CST whose spans tile the source exactly, and any semantic violations as TomlDiagnostic data." })) {
	/**
	 * Parse TOML text into a lossless document. Fails with
	 * {@link TomlParseError} only on lex/parse errors — including a
	 * nesting-depth bomb, which surfaces as a `NestingDepthExceeded`
	 * diagnostic, never an unhandled defect. Semantic violations do not fail:
	 * they land in `diagnostics` as data (first violation wins, so there is at
	 * most one today; the array shape is the contract).
	 *
	 * @param text - The TOML source to parse.
	 * @returns An `Effect` that succeeds with the {@link TomlDocument}, or fails
	 *   with {@link TomlParseError}.
	 */
	static readonly parse = Effect.fn("TomlDocument.parse")(function* (text: string) {
		const expressions = yield* Effect.try({
			try: () => parseExpressions(text),
			catch: (defect) => materializeError(text, defect),
		});
		const diagnostics: Array<TomlDiagnostic> = [];
		yield* Effect.try({
			try: () => analyze(expressions),
			catch: (defect) => {
				if (!isRawTomlError(defect)) {
					throw defect;
				}
				return TomlDiagnostic.fromRaw(text, defect.diagnostic);
			},
		}).pipe(Effect.catch((diagnostic) => Effect.sync(() => {
			diagnostics.push(diagnostic);
		})));
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
	 */
	static schema(): S.Codec<TomlDocument, string> {
		return S.String.pipe(
			S.decodeTo(
				S.instanceOf(TomlDocument),
				SchemaTransformation.transformEffect({
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
	 */
	toValue(): Effect.Effect<unknown, TomlParseError> {
		if (this.diagnostics.length > 0) {
			return Effect.fail(TomlParseError.make({ diagnostics: this.diagnostics }));
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
	 */
	stringify(): string {
		let out = "";
		for (const expression of this.expressions) {
			out += this.source.slice(expression.offset, expression.offset + expression.length);
		}
		return out;
	}
}
