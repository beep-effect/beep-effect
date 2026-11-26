/**
 * SAX-style tree visitor: a demand-driven `Stream` of enter/exit events over
 * a parsed markdown tree, enabling early termination (`Stream.take`) without
 * materializing the full event sequence.
 *
 * **Details**
 *
 * Sibling contract (jsonc precedent): the event union is an `S.TaggedUnion`
 * of three tagged structs, and the statics class exposes a single `visit`.
 * The walk builds events as plain values of the union's type: a case `make`
 * would validate (and copy) the event's whole node subtree, which costs
 * O(n·depth) over a walk. One recorded deviation: the yaml and toml
 * visitors take TEXT and parse internally, because their event source is the
 * parse itself; this visitor walks an ALREADY-PARSED tree, which is what lets it stay infallible
 * at the type level with no parse-error channel. Consumers compose
 * `Markdown.parse` (or `Mdast.fromMdast`) with `MarkdownVisitor.visit`.
 *
 * Guard posture: a tree this package's own parser produced can never exceed
 * `MAX_NESTING_DEPTH` (the parse guard refuses deeper input), but a decoded
 * foreign tree (`Mdast.fromMdast`) can. Mirroring stringify — which fails
 * typed on the same tree — the walk surfaces the trip deliberately as a
 * terminal `Error` event carrying a `NestingDepthExceeded` diagnostic and
 * ends, never a defect and never a stream failure (the yaml visitor's
 * diagnostics-as-events precedent).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { MarkdownDiagnostic } from "./MarkdownDiagnostic.ts";
import { MarkdownPath } from "./MarkdownEdit.ts";
import { MarkdownNode } from "./MarkdownNode.ts";
import type { Root } from "./MarkdownNode.ts";

const $I = $MarkdownId.create("MarkdownVisitor");

const eventPath = MarkdownPath.pipe(
  $I.annoteKey("MarkdownVisitorEvent.path", {
    description: "Child indexes from the root to the visited node; the root's own path is empty",
  })
);

const eventDepth = S.Finite.pipe(
  $I.annoteKey("MarkdownVisitorEvent.depth", {
    description: "Zero-based nesting depth of the visited node; the root is 0",
  })
);

const eventNode = S.suspend(() => MarkdownNode).pipe(
  $I.annoteKey("MarkdownVisitorEvent.node", { description: "The tree node the walk entered or left" })
);

/**
 * The discriminated union of markdown visitor events, in document pre-order.
 * `Enter` fires when the walk reaches a node, `Exit` when it leaves — for a
 * leaf the two fire back to back. Every variant carries `path` (child
 * indexes from the root; the root's own path is empty) and `depth`
 * (zero-based; the root is 0). `Error` is terminal: it carries the
 * depth-guard diagnostic for a decoded foreign tree nested past
 * `MAX_NESTING_DEPTH` and nothing follows it.
 *
 * **Details**
 *
 * The cases are `MarkdownVisitorEvent.cases.Enter`, `.Exit` and `.Error`;
 * `MarkdownVisitorEvent.guards` narrows a value to one case and
 * `MarkdownVisitorEvent.match` folds over all three. The walk hands out its
 * nodes by reference — it builds each event as a plain value of this type
 * rather than through a case `make`, which would validate and copy the
 * node's whole subtree per event.
 *
 * **Example** (Match a visitor exit event)
 *
 * ```ts
 * import { MarkdownVisitorEvent } from "@beep/markdown/MarkdownVisitor"
 * import { Root } from "@beep/markdown/MarkdownNode"
 *
 * const event = MarkdownVisitorEvent.cases.Exit.make({ node: Root.make({ children: [] }), path: [], depth: 0 })
 * console.log(MarkdownVisitorEvent.guards.Exit(event)) // true
 * console.log(MarkdownVisitorEvent.guards.Enter(event)) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownVisitorEvent = S.TaggedUnion({
  Enter: { node: eventNode, path: eventPath, depth: eventDepth },
  Exit: { node: eventNode, path: eventPath, depth: eventDepth },
  Error: {
    diagnostic: MarkdownDiagnostic.pipe(
      $I.annoteKey("MarkdownVisitorEvent.Error.diagnostic", {
        description:
          "The NestingDepthExceeded diagnostic for a decoded foreign tree nested past the walk's depth guard",
      })
    ),
    path: eventPath,
    depth: eventDepth,
  },
}).pipe(
  $I.annoteSchema("MarkdownVisitorEvent", {
    description:
      "One event of a markdown tree walk in document pre-order: entering a node, leaving it, or the terminal depth-guard error.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownVisitorEvent = typeof MarkdownVisitorEvent.Type;

/**
 * Walks a parsed markdown tree as a lazy `Stream` of `Enter`/`Exit` events in
 * document pre-order. Not instantiable.
 *
 * **Example** (Collect node types from visitor enter events)
 *
 * ```ts
 * import { Markdown } from "@beep/markdown/Markdown"
 * import { MarkdownVisitor, MarkdownVisitorEvent } from "@beep/markdown/MarkdownVisitor"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const program = Effect.gen(function* () {
 *   const root = yield* Markdown.parse("# Hi\n\ntext\n")
 *   return yield* MarkdownVisitor.visit(root).pipe(
 *     Stream.filter(MarkdownVisitorEvent.guards.Enter),
 *     Stream.map((event) => event.node.type),
 *     Stream.runCollect,
 *   )
 * })
 * console.log(await Effect.runPromise(program)) // ["root", "heading", "text", "paragraph", "text"]
 * ```
 *
 * @public
 * @category streams
 * @since 0.0.0
 */
export abstract class MarkdownVisitor {
  /**
   * Create a lazy `Stream` of `MarkdownVisitorEvent` walking `root` in
   * document pre-order: `Enter` and `Exit` for every node including the
   * root and every leaf. Events are produced on demand, so combining with
   * `Stream.take` allows efficient partial scans without walking the rest
   * of the tree.
   *
   * **Details**
   *
   * Infallible at the type level. A tree produced by `Markdown.parse` can
   * never trip the walk's depth guard — the parser refuses deeper input —
   * but a decoded foreign tree (`Mdast.fromMdast`) can; the trip surfaces
   * as a terminal `MarkdownVisitorEvent` `Error` event carrying a
   * `NestingDepthExceeded` {@link MarkdownDiagnostic}, mirroring the typed
   * failure `Markdown.stringify` produces for the same tree.
   *
   * **Example** (Visit an empty document)
   *
   * ```ts
   * import { MarkdownVisitor, MarkdownVisitorEvent } from "@beep/markdown/MarkdownVisitor"
   * import { Mdast } from "@beep/markdown/Mdast"
   * import * as Effect from "effect/Effect"
   * import * as Stream from "effect/Stream"
   *
   * const root = Effect.runSync(Mdast.fromMdast({ type: "root", children: [] }))
   * const program = MarkdownVisitor.visit(root).pipe(
   *   Stream.filter(MarkdownVisitorEvent.guards.Enter),
   *   Stream.map((event) => event.node.type),
   *   Stream.runCollect,
   * )
   * console.log(await Effect.runPromise(program)) // ["root"]
   * ```
   *
   * @param root - The tree to walk.
   * @returns A lazy `Stream` of `MarkdownVisitorEvent`, infallible at the type
   *   level.
   * @category streams
   * @since 0.0.0
   */
  static visit(root: Root): Stream.Stream<MarkdownVisitorEvent> {
    return Stream.fromIterable(rewalkingIterable(root));
  }
}

function rewalkingIterable(root: Root): Iterable<MarkdownVisitorEvent> {
  return {
    [Symbol.iterator]() {
      return walkNode(root, [], 0);
    },
  };
}

const childrenOf = (node: MarkdownNode): ReadonlyArray<MarkdownNode> => ("children" in node ? node.children : []);

const depthExceeded = (node: MarkdownNode, path: MarkdownPath, depth: number): MarkdownVisitorEvent => ({
  _tag: "Error",
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

type WalkAborted = boolean;

function* walkNode(
  node: MarkdownNode,
  path: MarkdownPath,
  depth: number
): Generator<MarkdownVisitorEvent, WalkAborted> {
  if (depth > MAX_NESTING_DEPTH) {
    yield depthExceeded(node, path, depth);
    return true;
  }
  yield { _tag: "Enter", node, path, depth };
  if (yield* walkChildren(node, path, depth)) {
    return true;
  }
  yield { _tag: "Exit", node, path, depth };
  return false;
}

function* walkChildren(
  node: MarkdownNode,
  path: MarkdownPath,
  depth: number
): Generator<MarkdownVisitorEvent, WalkAborted> {
  const children = childrenOf(node);
  for (let index = 0; index < children.length; index += 1) {
    if (yield* walkNode(A.getUnsafe(children, index), A.append(path, index), depth + 1)) {
      return true;
    }
  }
  return false;
}
