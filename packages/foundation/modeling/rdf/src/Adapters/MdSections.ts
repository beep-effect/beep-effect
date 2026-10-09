/**
 * Revision-scoped Md source identities and deterministic DOCO section folding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RdfId } from "@beep/identity/packages";
import { Block, Heading, HeadingLevel } from "@beep/md/Md.model";
import { getPoPattern, PoPattern } from "@beep/schema/PatternOntology";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DOCO_NAMESPACE } from "../Vocab/Doco.ts";
import type { Document } from "@beep/md/Md.model";

const $I = $RdfId.create("Adapters/MdSections");

/**
 * Source-block path within one immutable Md document revision.
 *
 * **Details**
 * Pair this selector with the document revision IRI. Inserting or reordering
 * source blocks requires a new revision IRI; ids survive repeated folds of
 * the same revision, including malformed heading recovery.
 *
 * **Example** (Validate a source path)
 *
 * ```ts
 * import { MdNodeId } from "@beep/rdf/Adapters/MdSections"
 * import * as S from "effect/Schema"
 * console.log(S.is(MdNodeId)("md-v1/b/2"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MdNodeId = S.TemplateLiteral(["md-v1/b/", S.Natural])
  .check(
    S.isPattern(/^md-v1\/b\/(?:0|[1-9]\d*)$/u, {
      identifier: $I`CanonicalSourcePath`,
      title: "Canonical source path",
      description: "Versioned block path with a canonical non-negative integer index.",
    })
  )
  .pipe($I.annoteSchema("MdNodeId", { description: "Zero-based source block path in an immutable Md revision." }));
/**
 * Runtime source-block path type.
 * @category type-level
 * @since 0.0.0
 */
export type MdNodeId = typeof MdNodeId.Type;

/**
 * Derives a versioned selector from a zero-based source block index.
 *
 * **Example** (Address the third source block)
 *
 * ```ts
 * import { mdNodeId } from "@beep/rdf/Adapters/MdSections"
 * console.log(mdNodeId(2)) // "md-v1/b/2"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const mdNodeId = (index: number): MdNodeId => `md-v1/b/${index}`;

/**
 * One original syntax block, preserved with its source address and PO context.
 *
 * **Example** (Retain source syntax)
 *
 * ```ts
 * import { MdSourceBlock, mdNodeId } from "@beep/rdf/Adapters/MdSections"
 * import { Heading } from "@beep/md/Md.model"
 * import * as O from "effect/Option"
 * const source = MdSourceBlock.make({ id: mdNodeId(0), node: Heading.make({ level: 1, children: [] }), pattern: O.some("block") })
 * console.log(source.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSourceBlock extends S.Class<MdSourceBlock>($I`MdSourceBlock`)(
  { kind: S.tag("source"), id: MdNodeId, node: Block, pattern: S.OptionFromOptionalKey(PoPattern) },
  $I.annote("MdSourceBlock", { description: "Original block with revision-scoped id and constructor PO context." })
) {}

/**
 * A DOCO section headed by an original Md heading and ordered nested children.
 *
 * **Example** (Read the empty section tree)
 *
 * ```ts
 * import { foldMdSections } from "@beep/rdf/Adapters/MdSections"
 * import { Document } from "@beep/md/Md.model"
 * console.log(foldMdSections(Document.make({ children: [] })).children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSection extends S.Class<MdSection>($I`MdSection`)(
  {
    kind: S.tag("section"),
    type: S.Literal(`${DOCO_NAMESPACE}Section`),
    heading: MdSourceBlock,
    level: HeadingLevel,
    children: S.Array(
      S.suspend(
        (): S.Codec<MdSection | MdSourceBlock, MdSection.Encoded | typeof MdSourceBlock.Encoded> =>
          S.Union([MdSection, MdSourceBlock])
      )
    ),
  },
  $I.annote("MdSection", { description: "DOCO section containing original source nodes in depth-first order." })
) {}
/**
 * Recursive encoded companion of the section model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdSection {
  /**
   * Plain wire shape of a nested DOCO section.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly kind: "section";
    readonly type: `${typeof DOCO_NAMESPACE}Section`;
    readonly heading: typeof MdSourceBlock.Encoded;
    readonly level: HeadingLevel;
    readonly children: ReadonlyArray<Encoded | typeof MdSourceBlock.Encoded>;
  };
}

/**
 * Non-throwing diagnostic for a skipped heading level, including the first heading.
 *
 * **Example** (Describe a skipped level)
 *
 * ```ts
 * import { MdHeadingLevelJump, mdNodeId } from "@beep/rdf/Adapters/MdSections"
 * console.log(MdHeadingLevelJump.make({ id: mdNodeId(2), previous: 1, actual: 3 }).actual)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class MdHeadingLevelJump extends S.TaggedClass<MdHeadingLevelJump>($I`MdHeadingLevelJump`)(
  "heading-level-jump",
  { id: MdNodeId, previous: S.Natural, actual: HeadingLevel },
  $I.annote("MdHeadingLevelJump", {
    description: "Missing intermediate heading level recovered without dropping syntax.",
  })
) {}

/**
 * Tagged recovery diagnostic union returned with the folded tree.
 *
 * **Example** (Recognize a heading jump)
 *
 * ```ts
 * import { MdFoldDiagnostic, MdHeadingLevelJump, mdNodeId } from "@beep/rdf/Adapters/MdSections"
 * console.log(MdFoldDiagnostic.isAnyOf(["heading-level-jump"])(MdHeadingLevelJump.make({ id: mdNodeId(0), previous: 0, actual: 3 })))
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const MdFoldDiagnostic = S.Union([MdHeadingLevelJump]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MdFoldDiagnostic", { description: "Typed recovery diagnostics accompanying the section fold." })
);
/**
 * Runtime fold diagnostic type.
 * @category type-level
 * @since 0.0.0
 */
export type MdFoldDiagnostic = typeof MdFoldDiagnostic.Type;

/**
 * Section tree and its sole diagnostic channel.
 *
 * **Example** (Fold an empty document)
 *
 * ```ts
 * import { foldMdSections } from "@beep/rdf/Adapters/MdSections"
 * import { Document } from "@beep/md/Md.model"
 * console.log(foldMdSections(Document.make({ children: [] })).diagnostics.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSectionFold extends S.Class<MdSectionFold>($I`MdSectionFold`)(
  { children: S.Array(S.Union([MdSection, MdSourceBlock])), diagnostics: S.Array(MdFoldDiagnostic) },
  $I.annote("MdSectionFold", { description: "Ordered section forest with typed recovery diagnostics." })
) {}

// Find the matching constructor through its derived guard; schema annotations
// provide context, never rhetoric inferred from a syntax tag.
const patternOf = (node: Block): O.Option<PoPattern> =>
  A.findFirst(Block.members, (member) => S.is(member)(node)).pipe(O.flatMap(getPoPattern));

const fold = (document: Document): MdSectionFold => {
  const sources = A.map(document.children, (node, index) =>
    MdSourceBlock.make({ id: mdNodeId(index), node, pattern: patternOf(node) })
  );
  let previous = 0;
  let diagnostics = A.empty<MdHeadingLevelJump>();
  for (const source of sources) {
    if (Heading.is(source.node)) {
      if (source.node.level > previous + 1)
        diagnostics = A.append(
          diagnostics,
          MdHeadingLevelJump.make({ id: source.id, previous, actual: source.node.level })
        );
      previous = source.node.level;
    }
  }
  const nest = (start: number, end: number): ReadonlyArray<MdSection | MdSourceBlock> => {
    let children = A.empty<MdSection | MdSourceBlock>();
    let cursor = start;
    while (cursor < end) {
      const sourceAt = A.get(sources, cursor);
      if (O.isNone(sourceAt)) break;
      const source = sourceAt.value;
      if (Heading.is(source.node)) {
        const level = source.node.level;
        const boundary = A.findFirstIndex(
          A.take(A.drop(sources, cursor + 1), end - cursor - 1),
          (next) => Heading.is(next.node) && next.node.level <= level
        ).pipe(
          O.map((offset) => cursor + 1 + offset),
          O.getOrElse(() => end)
        );
        children = A.append(
          children,
          MdSection.make({
            type: `${DOCO_NAMESPACE}Section`,
            heading: source,
            level,
            children: nest(cursor + 1, boundary),
          })
        );
        cursor = boundary;
      } else {
        children = A.append(children, source);
        cursor += 1;
      }
    }
    return children;
  };
  return MdSectionFold.make({ children: nest(0, A.length(sources)), diagnostics });
};

/**
 * Folds flat Md headings into nested DOCO sections without changing syntax nodes.
 *
 * **Details**
 * Each heading opens a section until the next heading of equal or lower level.
 * Missing levels emit diagnostics and attach to the nearest preceding lower
 * level. Pre-heading blocks remain at the root. Depth-first traversal yields
 * every original block exactly once, in source order.
 *
 * **Example** (Recover an initial level jump)
 *
 * ```ts
 * import { foldMdSections } from "@beep/rdf/Adapters/MdSections"
 * import { Document, Heading } from "@beep/md/Md.model"
 * const tree = foldMdSections(Document.make({ children: [Heading.make({ level: 3, children: [] })] }))
 * console.log(tree.diagnostics.length) // 1
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldMdSections = fold;
