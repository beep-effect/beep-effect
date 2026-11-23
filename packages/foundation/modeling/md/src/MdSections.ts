/**
 * Revision-scoped Md source identities and deterministic DOCO section folding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $MdId } from "@beep/identity/packages";
import { iri } from "@beep/identity/Registry";
import { getPoPattern, PoPattern } from "@beep/schema/PatternOntology";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Block, Heading, HeadingLevel } from "./Md.model.ts";
import type { Document } from "./Md.model.ts";

const $I = $MdId.create("MdSections");

const docoSection = iri("doco:Section");

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
 * import { MdNodeId } from "@beep/md/MdSections"
 * import * as S from "effect/Schema"
 * console.log(S.is(MdNodeId)("md-v1/b/2"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MdNodeId = S.TemplateLiteral(["md-v1/b/", S.Natural])
  .check(
    S.isPattern(
      /^md-v1\/b\/(?:0|[1-9]\d*)$/u,
      $I.annote("CanonicalSourcePath", {
        title: "Canonical source path",
        description: "Versioned block path with a canonical non-negative integer index.",
      })
    )
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
 * import { mdNodeId } from "@beep/md/MdSections"
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
 * import { MdSourceBlock, mdNodeId } from "@beep/md/MdSections"
 * import { Heading } from "@beep/md/Md.model"
 * import * as O from "effect/Option"
 * const source = MdSourceBlock.make({ id: mdNodeId(0), node: Heading.make({ level: 1, children: [] }), pattern: O.some("block") })
 * console.log(source.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSourceBlock extends S.Opaque<MdSourceBlock, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("source"), id: MdNodeId, node: Block, pattern: S.OptionFromOptionalKey(PoPattern) }).pipe(
    $I.annoteSchema("MdSourceBlock", {
      description: "Original block with revision-scoped id and constructor PO context.",
    })
  )
) {}

/**
 * A DOCO section headed by an original Md heading and ordered nested children.
 *
 * **Example** (Read the empty section tree)
 *
 * ```ts
 * import { foldMdSections } from "@beep/md/MdSections"
 * import { Document } from "@beep/md/Md.model"
 * console.log(foldMdSections(Document.make({ children: [] })).children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSection extends S.Opaque<MdSection, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("section"),
    type: S.tag(docoSection),
    heading: MdSourceBlock,
    level: HeadingLevel,
    children: S.Array(
      S.suspend(
        (): S.Codec<MdSection | MdSourceBlock, MdSection.Encoded | typeof MdSourceBlock.Encoded> =>
          S.Union([MdSection, MdSourceBlock])
      )
    ),
  }).pipe(
    $I.annoteSchema("MdSection", { description: "DOCO section containing original source nodes in depth-first order." })
  )
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
    readonly type: typeof docoSection;
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
 * import { MdHeadingLevelJump, mdNodeId } from "@beep/md/MdSections"
 * console.log(MdHeadingLevelJump.make({ id: mdNodeId(2), previous: 1, actual: 3 }).actual)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class MdHeadingLevelJump extends S.Opaque<MdHeadingLevelJump, { readonly brand: unique symbol }>()(
  S.TaggedStruct("heading-level-jump", { id: MdNodeId, previous: S.Natural, actual: HeadingLevel }).pipe(
    $I.annoteSchema("MdHeadingLevelJump", {
      description: "Missing intermediate heading level recovered without dropping syntax.",
    })
  )
) {}

/**
 * Tagged recovery diagnostic union returned with the folded tree.
 *
 * **Example** (Recognize a heading jump)
 *
 * ```ts
 * import { MdFoldDiagnostic, MdHeadingLevelJump, mdNodeId } from "@beep/md/MdSections"
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
 * import { foldMdSections } from "@beep/md/MdSections"
 * import { Document } from "@beep/md/Md.model"
 * console.log(foldMdSections(Document.make({ children: [] })).diagnostics.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSectionFold extends S.Opaque<MdSectionFold, { readonly brand: unique symbol }>()(
  S.Struct({ children: S.Array(S.Union([MdSection, MdSourceBlock])), diagnostics: S.Array(MdFoldDiagnostic) }).pipe(
    $I.annoteSchema("MdSectionFold", { description: "Ordered section forest with typed recovery diagnostics." })
  )
) {}

const constructorPatternOf = (node: Block): O.Option<PoPattern> =>
  A.findFirst(Block.members, (member) => S.is(member)(node)).pipe(O.flatMap(getPoPattern));

const fold = (document: Document): MdSectionFold => {
  const sources = A.map(document.children, (node, index) =>
    MdSourceBlock.make({ id: mdNodeId(index), node, pattern: constructorPatternOf(node) })
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
  const nest = (blocks: ReadonlyArray<MdSourceBlock>): ReadonlyArray<MdSection | MdSourceBlock> => {
    let children = A.empty<MdSection | MdSourceBlock>();
    let rest = blocks;
    while (A.isReadonlyArrayNonEmpty(rest)) {
      const source = A.headNonEmpty(rest);
      const tail = A.tailNonEmpty(rest);
      if (Heading.is(source.node)) {
        const level = source.node.level;
        const [body, after] = A.span(tail, (next) => !(Heading.is(next.node) && next.node.level <= level));
        children = A.append(
          children,
          MdSection.make({
            type: docoSection,
            heading: source,
            level,
            children: nest(body),
          })
        );
        rest = after;
      } else {
        children = A.append(children, source);
        rest = tail;
      }
    }
    return children;
  };
  return MdSectionFold.make({ children: nest(sources), diagnostics });
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
 * import { foldMdSections } from "@beep/md/MdSections"
 * import { Document, Heading } from "@beep/md/Md.model"
 * const tree = foldMdSections(Document.make({ children: [Heading.make({ level: 3, children: [] })] }))
 * console.log(tree.diagnostics.length) // 1
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldMdSections = fold;
