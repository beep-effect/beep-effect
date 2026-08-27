/**
 * SAX-style event stream over the semantic walk of a TOML document.
 *
 * **Details**
 *
 * `TableStart` / `ArrayTableStart` / `KeyValue` events ride `analyze`'s
 * existing iterative pass (no added recursion — analyze's own header/dotted-key
 * navigation is already iterative, and this module adds only a flat second
 * pass plus a sort, never a walk of its own). Comment events — standalone
 * trivia comments and expression trailing comments — are collected by that
 * second pass over the same `TomlExpression` array and merged with the
 * semantic events by source offset, so the merged sequence streams in
 * document order.
 *
 * A `Comment` event's `offset` is the position of its `#` marker in the
 * source text. For a standalone trivia comment that is the `#` found inside
 * the trivia's raw slice; for a trailing comment it is located by searching
 * forward from the end of the value span (key-values) or the last key span
 * (headers) — the first position a `#` can legally appear, since nothing
 * between there and the comment marker can itself contain a `#` character.
 *
 * Cycle firewall: same materialization as `Toml.parse` — the engine throws
 * raw carriers (`RawTomlError`, `GuardExceeded`); this module builds the
 * typed `TomlParseError`, never letting a raw carrier escape as a defect.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Data, Effect, Stream } from "effect";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { isGuardExceeded } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { scanComment, scanNewline, scanWhitespace } from "./internal/scanner.ts";
import { analyze } from "./internal/semantic.ts";
import { TomlParseError } from "./Toml.ts";
import { TomlDiagnostic } from "./TomlDiagnostic.ts";
import type { TomlArrayTableHeader, TomlTableHeader } from "./TomlNode.ts";
import { TomlKeyValue, TomlTrivia } from "./TomlNode.ts";

/**
 * The discriminated union of TOML visitor events, in document order.
 * `TableStart` fires once for the root with `path: []` before any other
 * event, then again for every `[table]` header. `ArrayTableStart` fires for
 * every `[[array]]` header with the 0-based element `index`. `KeyValue.path`
 * includes the final key. `Comment` covers both standalone (trivia) and
 * trailing comments.
 *
 * **Gotchas**
 *
 * A `Comment` event's `offset` is the `#` marker, not the start of the
 * expression that owns the comment. Treating it as the expression start
 * highlights the wrong span. The synthetic root `TableStart` is sorted with
 * internal offset `-1` so it precedes a leading comment at offset 0.
 *
 * @see {@link TomlVisitor} for the stream that emits these events.
 * @category type-level
 * @since 0.0.0
 */
export type TomlVisitorEvent = Data.TaggedEnum<{
	TableStart: { readonly path: ReadonlyArray<string> };
	ArrayTableStart: { readonly path: ReadonlyArray<string>; readonly index: number };
	KeyValue: { readonly path: ReadonlyArray<string>; readonly node: TomlKeyValue };
	Comment: { readonly text: string; readonly offset: number };
}>;

/**
 * Constructors and matchers for the `TomlVisitorEvent` union (e.g.
 * `TomlVisitorEvent.KeyValue({ path, node })`, `TomlVisitorEvent.$is("Comment")`).
 *
 * **Example** (Construct a root table event)
 *
 * ```ts
 * import { TomlVisitorEvent } from "@beep/scratchpad/toml"
 *
 * const root = TomlVisitorEvent.TableStart({ path: [] })
 * console.log(root._tag) // "TableStart"
 * console.log(TomlVisitorEvent.$is("TableStart")(root)) // true
 * ```
 *
 * @see {@link TomlVisitor.visit} to produce these events from TOML text.
 * @category constructors
 * @since 0.0.0
 */
export const TomlVisitorEvent = Data.taggedEnum<TomlVisitorEvent>();

/** An event paired with the source offset used to sort it into document order. */
interface PositionedEvent {
	readonly offset: number;
	readonly event: TomlVisitorEvent;
}

/** Decoded trailing-comment text: the raw text after `#` with one leading space stripped (mirrors internal/parser.ts). */
const decodeCommentText = (raw: string): string => (raw.startsWith(" ") ? raw.slice(1) : raw);

/**
 * Locate the `#` starting a trailing comment already known to exist
 * (`comment !== undefined`). Search begins after the last span that can
 * itself contain a `#` character — the value span for a key-value, the last
 * key span for a header — so the first `#` found is unambiguously the
 * comment marker.
 */
const trailingCommentOffset = (
	source: string,
	expression: TomlKeyValue | TomlTableHeader | TomlArrayTableHeader,
): number => {
	if (expression instanceof TomlKeyValue) {
		return source.indexOf("#", expression.value.offset + expression.value.length);
	}
	const lastKey = expression.keyPath[expression.keyPath.length - 1];
	return source.indexOf("#", lastKey.offset + lastKey.length);
};

/** Standalone comments inside a trivia run, each positioned by its `#`'s absolute offset. */
const collectTriviaComments = (trivia: TomlTrivia): Array<PositionedEvent> => {
	const events: Array<PositionedEvent> = [];
	const text = trivia.text;
	let pos = 0;
	while (pos < text.length) {
		const i = scanWhitespace(text, pos);
		if (text.charAt(i) === "#") {
			const scanned = scanComment(text, i);
			const offset = trivia.offset + i;
			events.push({ offset, event: TomlVisitorEvent.Comment({ text: decodeCommentText(scanned.value), offset }) });
			pos = scanned.end < text.length ? scanNewline(text, scanned.end) : scanned.end;
		} else {
			// blank line
			pos = i < text.length ? scanNewline(text, i) : i;
		}
	}
	return events;
};

/**
 * Parse, run the semantic pass collecting its callbacks as positioned events,
 * collect comment events from the same expression array, then merge both by
 * offset. Throws the engine's raw carriers on malformed/adversarial input —
 * caught and materialized by the caller, exactly like `Toml.parse`.
 */
const collectEvents = (text: string): Array<TomlVisitorEvent> => {
	const expressions = parseExpressions(text);
	const positioned: Array<PositionedEvent> = [];

	analyze(expressions, {
		onTableStart: (path, header) => {
			// The root table has no header and must sort before anything else,
			// including a leading document comment at offset 0.
			positioned.push({ offset: header?.offset ?? -1, event: TomlVisitorEvent.TableStart({ path }) });
		},
		onArrayTableStart: (path, index, header) => {
			positioned.push({ offset: header.offset, event: TomlVisitorEvent.ArrayTableStart({ path, index }) });
		},
		onKeyValue: (path, node) => {
			positioned.push({ offset: node.offset, event: TomlVisitorEvent.KeyValue({ path, node }) });
		},
	});

	for (const expression of expressions) {
		if (expression instanceof TomlTrivia) {
			positioned.push(...collectTriviaComments(expression));
			continue;
		}
		if (expression.comment !== undefined) {
			const offset = trailingCommentOffset(text, expression);
			positioned.push({ offset, event: TomlVisitorEvent.Comment({ text: expression.comment, offset }) });
		}
	}

	positioned.sort((a, b) => a.offset - b.offset);
	return positioned.map((positionedEvent) => positionedEvent.event);
};

/**
 * Run `collectEvents`, materializing the engine's raw carriers into
 * {@link TomlParseError} exactly like `Toml.parse` — a lex/parse error and a
 * semantic-pass error (e.g. `DuplicateKey`) both fail the same way.
 */
const collectEventsOrFail = (text: string): Effect.Effect<Array<TomlVisitorEvent>, TomlParseError> =>
	Effect.try({
		try: () => collectEvents(text),
		catch: (defect) => {
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
		},
	});

/**
 * SAX-style TOML visitor that streams semantic events in document order.
 *
 * **Gotchas**
 *
 * Construction is eager, not on-demand: the full text is parsed, walked by
 * `analyze`, and sorted into document order up front, inside the `Effect`
 * `Stream.unwrap` runs to build the stream. `Stream.take` still short-circuits
 * consumption, but it does not skip that parse/analyze/sort pass — peeking
 * the root table of a multi-megabyte document still pays the full walk.
 * Failures are {@link TomlParseError}, including semantic `DuplicateKey`,
 * never a raw defect.
 *
 * **Example** (Collect events from a small document)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { TomlVisitor } from "@beep/scratchpad/toml"
 *
 * const events = Effect.runSync(Stream.runCollect(TomlVisitor.visit('name = "Alice"\n')))
 * console.log(events.map((event) => event._tag)) // ["TableStart", "KeyValue"]
 * ```
 *
 * @see {@link Toml.parse} for the same materialization on the value pipeline.
 * @see {@link TomlDocument} to keep the CST when you need more than events.
 * @category streams
 * @since 0.0.0
 */
export class TomlVisitor {
	private constructor() {}

	/**
	 * Create a `Stream` of `TomlVisitorEvent` from TOML text, in document
	 * order. Fails the stream with {@link TomlParseError} on the first
	 * lex/parse or semantic violation — never as an unhandled defect.
	 *
	 * **Gotchas**
	 *
	 * Construction is eager: the full parse/analyze/sort runs inside
	 * `Stream.unwrap` before any event is pulled. `Stream.take` does not avoid
	 * that pass.
	 *
	 * **Example** (Stream a comment's hash offset)
	 *
	 * ```ts
	 * import { Effect, Stream } from "effect"
	 * import { TomlVisitor, TomlVisitorEvent } from "@beep/scratchpad/toml"
	 *
	 * const events = Effect.runSync(Stream.runCollect(TomlVisitor.visit("# heading\nname = 1\n")))
	 * const comment = events.find(TomlVisitorEvent.$is("Comment"))
	 * console.log(comment?.offset) // 0
	 * console.log(comment?.text) // "heading"
	 * ```
	 *
	 * @see {@link Toml.parse} for the same typed materialization of engine carriers.
	 * @see {@link TomlDocument} to keep the CST if you need more than events.
	 */
	static visit(text: string): Stream.Stream<TomlVisitorEvent, TomlParseError> {
		return Stream.unwrap(collectEventsOrFail(text).pipe(Effect.map(Stream.fromIterable)));
	}
}
