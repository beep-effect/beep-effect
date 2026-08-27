/**
 * SAX-style visitor: a demand-driven `Stream` of typed events over a JSONC
 * document, enabling early termination (`Stream.take`) without building an
 * AST.
 *
 * The event union is a `Data.TaggedEnum` — serializable tagged values with
 * structural equality, consistent with the rest of the library. Malformed
 * input surfaces as `Error` events inside the union, so the stream stays
 * infallible at the type level. There is no `visitCollect`: `Stream.filter`
 * plus `Stream.runCollect` cover it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Data, Stream } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { scanErrorToCode } from "./internal/parser.ts";
import type { SyntaxKind } from "./internal/scanner.ts";
import { createScanner } from "./internal/scanner.ts";
import type { SkipCursor } from "./internal/skip.ts";
import { skipBalancedValue } from "./internal/skip.ts";
import type { JsoncParseErrorCode, JsoncParseOptions } from "./Jsonc.ts";
import type { JsoncPath, JsoncSegment } from "./JsoncNode.ts";

/**
 * The discriminated union of JSONC visitor events. Every variant carries
 * `offset` and `length`; `ObjectBegin`, `ArrayBegin`, `ObjectProperty` and
 * `LiteralValue` also carry `path` context (the location being entered).
 *
 * - `ObjectBegin` / `ObjectEnd` — an object's opening `{` / closing `}`.
 * - `ObjectProperty` — an object key, ahead of its value; `property` is the
 *   key string.
 * - `ArrayBegin` / `ArrayEnd` — an array's opening `[` / closing `]`.
 * - `LiteralValue` — a scalar value (`string`/`number`/`boolean`/`null`);
 *   `value` is the decoded JS value.
 * - `Separator` — a `,` or `:` token; `character` is which one.
 * - `Comment` — a line or block comment span.
 * - `Error` — a recovered parse error; `code` is its `JsoncParseErrorCode`.
 *
 * @see {@link JsoncVisitorEvent} for the constructors and matchers of this union.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type JsoncVisitorEvent = Data.TaggedEnum<{
	ObjectBegin: { readonly offset: number; readonly length: number; readonly path: JsoncPath };
	ObjectEnd: { readonly offset: number; readonly length: number };
	ObjectProperty: {
		readonly property: string;
		readonly offset: number;
		readonly length: number;
		readonly path: JsoncPath;
	};
	ArrayBegin: { readonly offset: number; readonly length: number; readonly path: JsoncPath };
	ArrayEnd: { readonly offset: number; readonly length: number };
	LiteralValue: { readonly value: unknown; readonly offset: number; readonly length: number; readonly path: JsoncPath };
	Separator: { readonly character: string; readonly offset: number; readonly length: number };
	Comment: { readonly offset: number; readonly length: number };
	Error: { readonly code: JsoncParseErrorCode; readonly offset: number; readonly length: number };
}>;

/**
 * Constructors and matchers for the `JsoncVisitorEvent` union (e.g.
 * `JsoncVisitorEvent.ObjectBegin({ offset, length, path })`,
 * `JsoncVisitorEvent.$is("LiteralValue")`).
 *
 * **Example** (Construct a literal-value event)
 *
 * ```ts
 * import { JsoncVisitorEvent } from "@beep/scratchpad/jsonc";
 *
 * const event = JsoncVisitorEvent.LiteralValue({
 *   value: 3000,
 *   offset: 10,
 *   length: 4,
 *   path: ["port"],
 * });
 *
 * console.log(event._tag); // "LiteralValue"
 * console.log(event.value); // 3000
 * ```
 *
 * @see {@link JsoncVisitorEvent} for the event union these constructors inhabit.
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const JsoncVisitorEvent = Data.taggedEnum<JsoncVisitorEvent>();

/**
 * SAX-style JSONC visitor statics. Not instantiable. `visit` is a lazy
 * infallible `Stream`: malformed input is in-band `Error` events, not a
 * failing Effect like {@link Jsonc.parseTree}.
 *
 * **Example** (Collect a comment and an in-band error)
 *
 * ```ts
 * import { JsoncVisitor, JsoncVisitorEvent } from "@beep/scratchpad/jsonc";
 * import { Effect, Stream } from "effect";
 *
 * const events = Effect.runSync(Stream.runCollect(JsoncVisitor.visit("{ // c\n bad }")));
 *
 * console.log(events.some(JsoncVisitorEvent.$is("Comment"))); // true
 * console.log(events.some(JsoncVisitorEvent.$is("Error"))); // true
 * ```
 *
 * @see {@link Jsonc.parseTree} when a complete tree or aggregate `JsoncParseError` is required.
 * @see {@link JsoncVisitorEvent} for the event union.
 * @public
 * @category streams
 * @since 0.0.0
 */
export class JsoncVisitor {
	private constructor() {}

	/**
	 * Create a lazy `Stream` of `JsoncVisitorEvent` from JSONC text. Events
	 * are produced on demand, so combining with `Stream.take` allows efficient
	 * partial scans of large documents.
	 *
	 * **Gotchas**
	 *
	 * Only `disallowComments` is read from {@link JsoncParseOptions};
	 * `allowTrailingComma` and `allowEmptyContent` do nothing here. Pulling the
	 * stream never fails — diagnostics are `JsoncVisitorEvent.Error`, including
	 * `NestingDepthExceeded` with an iteratively skipped subtree. Forgetting to
	 * match `Error` drops those diagnostics.
	 *
	 * @param text - The JSONC source to visit.
	 * @param options - Optional {@link JsoncParseOptions}; only comment handling
	 *   is consulted.
	 * @see {@link Jsonc.parseTree} when a complete tree or aggregate `JsoncParseError` is required.
	 * @see {@link JsoncVisitorEvent} for the event union, including in-band `Error`.
	 */
	static visit(text: string, options?: JsoncParseOptions): Stream.Stream<JsoncVisitorEvent> {
		return Stream.fromIterable(visitGen(text, options?.disallowComments ?? false));
	}
}

function* visitGen(text: string, disallowComments: boolean): Generator<JsoncVisitorEvent> {
	const scanner = createScanner(text, false);
	const path: Array<JsoncSegment> = [];
	// Current collection-nesting depth. Deeply-nested input would otherwise
	// overflow the stack via visitObject/visitArray recursion — a defect when the
	// stream is pulled. At the cap the visitor emits one in-band Error event and
	// skips the over-deep subtree iteratively (see MAX_NESTING_DEPTH).
	let depth = 0;

	// Cursor adapter for the shared iterative bracket-balance skip (see
	// internal/skip.ts). `advance` is the raw scanner.scan — not the
	// event-emitting scanNext — so nothing is emitted while a too-deep
	// container is consumed.
	const skipCursor: SkipCursor = {
		getToken: () => scanner.getToken(),
		advance: () => {
			scanner.scan();
		},
		tokenStart: () => scanner.getTokenOffset(),
		tokenEnd: () => scanner.getTokenOffset() + scanner.getTokenLength(),
	};

	// Consume a balanced container (current token is its opener) — never
	// recursing, never emitting.
	function skipDeepContainer(): void {
		skipBalancedValue(skipCursor);
	}

	function* scanNext(): Generator<JsoncVisitorEvent, SyntaxKind> {
		for (;;) {
			const t = scanner.scan();

			const code = scanErrorToCode(scanner.getTokenError());
			if (code !== undefined) {
				yield JsoncVisitorEvent.Error({
					code,
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
			}

			switch (t) {
				case "LineComment":
				case "BlockComment":
					if (disallowComments) {
						yield JsoncVisitorEvent.Error({
							code: "InvalidCommentToken",
							offset: scanner.getTokenOffset(),
							length: scanner.getTokenLength(),
						});
					} else {
						yield JsoncVisitorEvent.Comment({
							offset: scanner.getTokenOffset(),
							length: scanner.getTokenLength(),
						});
					}
					break;
				case "Trivia":
				case "LineBreak":
					break;
				default:
					return t;
			}
		}
	}

	function literalValue(kind: SyntaxKind, tokenValue: string): unknown {
		switch (kind) {
			case "String":
				return tokenValue;
			case "Number":
				return Number.parseFloat(tokenValue);
			case "True":
				return true;
			case "False":
				return false;
			case "Null":
				return null;
			default:
				return undefined;
		}
	}

	function* visitValue(): Generator<JsoncVisitorEvent, boolean> {
		const t = scanner.getToken();
		switch (t) {
			case "OpenBrace": {
				if (depth >= MAX_NESTING_DEPTH) {
					yield JsoncVisitorEvent.Error({
						code: "NestingDepthExceeded",
						offset: scanner.getTokenOffset(),
						length: scanner.getTokenLength(),
					});
					skipDeepContainer();
					return false;
				}
				depth++;
				try {
					return yield* visitObject();
				} finally {
					depth--;
				}
			}
			case "OpenBracket": {
				if (depth >= MAX_NESTING_DEPTH) {
					yield JsoncVisitorEvent.Error({
						code: "NestingDepthExceeded",
						offset: scanner.getTokenOffset(),
						length: scanner.getTokenLength(),
					});
					skipDeepContainer();
					return false;
				}
				depth++;
				try {
					return yield* visitArray();
				} finally {
					depth--;
				}
			}
			case "String":
			case "Number":
			case "True":
			case "False":
			case "Null":
				yield JsoncVisitorEvent.LiteralValue({
					value: literalValue(t, scanner.getTokenValue()),
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
					path: [...path],
				});
				yield* scanNext();
				return true;
			default: {
				yield JsoncVisitorEvent.Error({
					code: "ValueExpected",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
				// Consume the offending token so recovery always makes progress —
				// leaving it in place loops forever on inputs like `[bad]`. Container
				// closers stay put so the enclosing visit can close normally.
				if (t !== "CloseBrace" && t !== "CloseBracket" && t !== "EOF") {
					yield* scanNext();
				}
				return false;
			}
		}
	}

	function* visitObject(): Generator<JsoncVisitorEvent, boolean> {
		yield JsoncVisitorEvent.ObjectBegin({
			offset: scanner.getTokenOffset(),
			length: scanner.getTokenLength(),
			path: [...path],
		});

		yield* scanNext(); // skip {
		let needsComma = false;

		while (scanner.getToken() !== "CloseBrace" && scanner.getToken() !== "EOF") {
			if (scanner.getToken() === "Comma") {
				yield JsoncVisitorEvent.Separator({
					character: ",",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
				yield* scanNext();
				if (scanner.getToken() === "CloseBrace") {
					break; // trailing comma
				}
			} else if (needsComma) {
				yield JsoncVisitorEvent.Error({
					code: "CommaExpected",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
			}

			if (scanner.getToken() !== "String") {
				yield JsoncVisitorEvent.Error({
					code: "PropertyNameExpected",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
				yield* scanNext();
				continue;
			}

			const key = scanner.getTokenValue();
			yield JsoncVisitorEvent.ObjectProperty({
				property: key,
				offset: scanner.getTokenOffset(),
				length: scanner.getTokenLength(),
				path: [...path],
			});
			path.push(key);

			yield* scanNext(); // skip key
			if (scanner.getToken() === "Colon") {
				yield JsoncVisitorEvent.Separator({
					character: ":",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
				yield* scanNext(); // skip colon
			} else {
				yield JsoncVisitorEvent.Error({
					code: "ColonExpected",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
			}

			yield* visitValue();
			path.pop();
			needsComma = true;
		}

		if (scanner.getToken() === "CloseBrace") {
			yield JsoncVisitorEvent.ObjectEnd({
				offset: scanner.getTokenOffset(),
				length: scanner.getTokenLength(),
			});
			yield* scanNext();
		} else {
			yield JsoncVisitorEvent.Error({
				code: "CloseBraceExpected",
				offset: scanner.getTokenOffset(),
				length: scanner.getTokenLength(),
			});
		}

		return true;
	}

	function* visitArray(): Generator<JsoncVisitorEvent, boolean> {
		yield JsoncVisitorEvent.ArrayBegin({
			offset: scanner.getTokenOffset(),
			length: scanner.getTokenLength(),
			path: [...path],
		});

		yield* scanNext(); // skip [
		let index = 0;
		let needsComma = false;

		while (scanner.getToken() !== "CloseBracket" && scanner.getToken() !== "EOF") {
			if (scanner.getToken() === "Comma") {
				yield JsoncVisitorEvent.Separator({
					character: ",",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
				yield* scanNext();
				if (scanner.getToken() === "CloseBracket") {
					break; // trailing comma
				}
			} else if (needsComma) {
				yield JsoncVisitorEvent.Error({
					code: "CommaExpected",
					offset: scanner.getTokenOffset(),
					length: scanner.getTokenLength(),
				});
			}

			path.push(index);
			yield* visitValue();
			path.pop();
			index++;
			needsComma = true;
		}

		if (scanner.getToken() === "CloseBracket") {
			yield JsoncVisitorEvent.ArrayEnd({
				offset: scanner.getTokenOffset(),
				length: scanner.getTokenLength(),
			});
			yield* scanNext();
		} else {
			yield JsoncVisitorEvent.Error({
				code: "CloseBracketExpected",
				offset: scanner.getTokenOffset(),
				length: scanner.getTokenLength(),
			});
		}

		return true;
	}

	yield* scanNext();
	if (scanner.getToken() !== "EOF") {
		yield* visitValue();
		if (scanner.getToken() !== "EOF") {
			yield JsoncVisitorEvent.Error({
				code: "EndOfFileExpected",
				offset: scanner.getTokenOffset(),
				length: scanner.getTokenLength(),
			});
		}
	}
}
