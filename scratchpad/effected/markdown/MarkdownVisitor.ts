// SAX-style tree visitor: a demand-driven `Stream` of enter/exit events over
// a parsed markdown tree, enabling early termination (`Stream.take`) without
// materializing the full event sequence.
//
// Sibling contract (yaml/toml precedent): the event union is a
// `Data.TaggedEnum` with a `taggedEnum` constructor const, and the statics
// class exposes a single `visit`. One recorded deviation: the yaml and toml
// visitors take TEXT and parse internally, because their event source is the
// parse itself; this visitor walks an ALREADY-PARSED tree, which is what lets it stay infallible
// at the type level with no parse-error channel. Consumers compose
// `Markdown.parse` (or `Mdast.fromMdast`) with `MarkdownVisitor.visit`.
//
// Guard posture: a tree this package's own parser produced can never exceed
// `MAX_NESTING_DEPTH` (the parse guard refuses deeper input), but a decoded
// foreign tree (`Mdast.fromMdast`) can. Mirroring stringify — which fails
// typed on the same tree — the walk surfaces the trip deliberately as a
// terminal `Error` event carrying a `NestingDepthExceeded` diagnostic and
// ends, never a defect and never a stream failure (the yaml visitor's
// diagnostics-as-events precedent).

import * as Data from "effect/Data";
import * as Stream from "effect/Stream";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { MarkdownDiagnostic } from "./MarkdownDiagnostic.ts";
import type { MarkdownPath } from "./MarkdownEdit.ts";
import type { MarkdownNode, Root } from "./MarkdownNode.ts";

/**
 * The discriminated union of markdown visitor events, in document pre-order.
 * `Enter` fires when the walk reaches a node, `Exit` when it leaves — for a
 * leaf the two fire back to back. Every variant carries `path` (child
 * indexes from the root; the root's own path is empty) and `depth`
 * (zero-based; the root is 0). `Error` is terminal: it carries the
 * depth-guard diagnostic for a decoded foreign tree nested past
 * `MAX_NESTING_DEPTH` and nothing follows it.
 *
 * @public
 */
export type MarkdownVisitorEvent = Data.TaggedEnum<{
	Enter: { readonly node: MarkdownNode; readonly path: MarkdownPath; readonly depth: number };
	Exit: { readonly node: MarkdownNode; readonly path: MarkdownPath; readonly depth: number };
	Error: { readonly diagnostic: MarkdownDiagnostic; readonly path: MarkdownPath; readonly depth: number };
}>;

/**
 * Constructors and matchers for the `MarkdownVisitorEvent` union (e.g.
 * `MarkdownVisitorEvent.Enter({ node, path, depth })`,
 * `MarkdownVisitorEvent.$is("Exit")`).
 *
 * @public
 */
export const MarkdownVisitorEvent = Data.taggedEnum<MarkdownVisitorEvent>();

/**
 * Walks a parsed markdown tree as a lazy `Stream` of `Enter`/`Exit` events in
 * document pre-order. Not instantiable.
 *
 * @example
 * ```ts
 * import { Markdown, MarkdownVisitor, MarkdownVisitorEvent } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 *
 * const program = Effect.gen(function* () {
 *   const root = yield* Markdown.parse("# Hi\n\ntext\n");
 *   return yield* MarkdownVisitor.visit(root).pipe(
 *     Stream.filter(MarkdownVisitorEvent.$is("Enter")),
 *     Stream.map((event) => event.node.type),
 *     Stream.runCollect,
 *   );
 *   // => ["root", "heading", "text", "paragraph", "text"]
 * });
 * ```
 *
 * @public
 */
export class MarkdownVisitor {
	private constructor() {}

	/**
	 * Create a lazy `Stream` of `MarkdownVisitorEvent` walking `root` in
	 * document pre-order: `Enter` and `Exit` for every node including the
	 * root and every leaf. Events are produced on demand, so combining with
	 * `Stream.take` allows efficient partial scans without walking the rest
	 * of the tree.
	 *
	 * @remarks
	 * Infallible at the type level. A tree produced by `Markdown.parse` can
	 * never trip the walk's depth guard — the parser refuses deeper input —
	 * but a decoded foreign tree (`Mdast.fromMdast`) can; the trip surfaces
	 * as a terminal `MarkdownVisitorEvent` `Error` event carrying a
	 * `NestingDepthExceeded` {@link MarkdownDiagnostic}, mirroring the typed
	 * failure `Markdown.stringify` produces for the same tree.
	 *
	 * @param root - The tree to walk.
	 * @returns A lazy `Stream` of `MarkdownVisitorEvent`, infallible at the type
	 *   level.
	 */
	static visit(root: Root): Stream.Stream<MarkdownVisitorEvent> {
		return Stream.fromIterable(walkIterable(root));
	}
}

/** Lazy per-subscription iterable so each run of the stream walks afresh. */
function walkIterable(root: Root): Iterable<MarkdownVisitorEvent> {
	return {
		[Symbol.iterator]() {
			return walk(root)[Symbol.iterator]();
		},
	};
}

function* walk(root: Root): Generator<MarkdownVisitorEvent> {
	yield* walkNode(root, [], 0);
}

function* walkNode(node: MarkdownNode, path: MarkdownPath, depth: number): Generator<MarkdownVisitorEvent> {
	if (depth > MAX_NESTING_DEPTH) {
		// Zero-based diagnostic line/character derived from the node's own
		// 1-based position (there is no source text in a tree walk); foreign
		// sentinel positions collapse to 0,0.
		yield MarkdownVisitorEvent.Error({
			diagnostic: MarkdownDiagnostic.make({
				code: "NestingDepthExceeded",
				message: `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH}, actual ${depth}`,
				offset: node.position.start.offset,
				length: Math.max(0, node.position.end.offset - node.position.start.offset),
				line: Math.max(0, node.position.start.line - 1),
				character: Math.max(0, node.position.start.column - 1),
			}),
			path,
			depth,
		});
		return;
	}

	yield MarkdownVisitorEvent.Enter({ node, path, depth });

	if ("children" in node) {
		const children = node.children;
		for (let index = 0; index < children.length; index++) {
			const child = children[index];
			if (child === undefined) continue;
			const events = walkNode(child, [...path, index], depth + 1);
			for (const event of events) {
				yield event;
				if (event._tag === "Error") {
					// Terminal: abort the whole walk, mirroring stringify's
					// whole-operation typed failure.
					return;
				}
			}
		}
	}

	yield MarkdownVisitorEvent.Exit({ node, path, depth });
}
