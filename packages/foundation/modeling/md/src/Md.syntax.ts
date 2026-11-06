/**
 * Bridge from the `@beep/markdown` syntax tree to the semantic `Md.Document`.
 *
 * **Details**
 *
 * `@beep/markdown` owns parsing: positioned nodes, trivia and edits.
 * `@beep/md` owns the persisted semantic model. This module folds a parsed
 * `MarkdownDocument` into an `Md.Document` and reports, as data, everything
 * the fold could not carry: each `MdLoss` names the source node kind, the
 * reason, the source position, and where the content landed in the Md tree.
 * A pre-order source map points every Md node back at its source span.
 *
 * The fold is pure, total and synchronous. It builds the whole document as
 * plain data and admits it once, through `MdFromSyntax.make`, so construction
 * stays linear in the node count. Trivia (marker characters, fence lengths,
 * heading styles, label casing) is erased by design and never reported: the
 * Md renderer re-derives canonical style, and positions live in the source
 * map. This module is a subpath only; it is not re-exported from the package
 * root or the `Md` namespace, so importers of `@beep/md` never load the parser.
 *
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity/packages";
import { normalizeLabelText } from "@beep/markdown/internal/references";
import { unescapeString } from "@beep/markdown/internal/unescape";
import { JsonFrontmatter } from "@beep/markdown/JsonFrontmatter";
import * as Kit from "@beep/markdown/MarkdownNode";
import { TomlFrontmatter } from "@beep/markdown/TomlFrontmatter";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "@beep/utils/Array";
import { replaceWith } from "@beep/utils/Str";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Hash from "effect/Hash";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isJsonObject, projectJson } from "./internal/syntax/json.ts";
import {
  admonitionMarkerOf,
  FootnoteIdentifiers,
  isBreakTag,
  isHtmlComment,
  mathBlockBody,
  scanInlineMath,
  sourceSlice,
  subPosition,
  unescapeBackslashes,
  youtubeVideoId,
} from "./internal/syntax/recognizers.ts";
import * as Model from "./Md.model.ts";
import { CodeFenceLanguage, Document } from "./Md.model.ts";
import { DocumentSafetyPathSegment, DocumentSafetyViolation, refineSafeDocument } from "./Md.safe.ts";
import type { FrontmatterCodec } from "@beep/markdown/Frontmatter";
import type { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import type { MathSegment } from "./internal/syntax/recognizers.ts";
import type { SafeDocument } from "./Md.safe.ts";

const $I = $MdId.create("Md.syntax");

// ---------------------------------------------------------------------------
// Loss taxonomy
// ---------------------------------------------------------------------------

/**
 * Why the bridge could not carry a piece of the syntax tree unchanged.
 *
 * **Details**
 *
 * One reason per lossy or unsupported construct. Trivia is never a loss.
 * `frontmatterFormatChanged` reports that YAML or TOML frontmatter was decoded
 * into JSON: `Md.render` writes it back as a `---json` block, so comments,
 * key order styles and the original format do not survive a round trip.
 *
 * **Example** (Check a loss reason)
 *
 * ```ts
 * import { MdLossReason } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdLossReason)("htmlEscapedAsText")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdLossReason = LiteralKit([
  "htmlEscapedAsText",
  "htmlInlinedBlock",
  "htmlDropped",
  "autolinkLiteralAsText",
  "referenceUnresolved",
  "definitionUnreferenced",
  "codeLanguageDropped",
  "codeMetaDropped",
  "footnoteIdentifierRewritten",
  "footnoteDefinitionDuplicate",
  "taskCheckboxDropped",
  "admonitionTitleFlattened",
  "recognizerSkipped",
  "frontmatterInvalid",
  "frontmatterNotObject",
  "frontmatterValueCoerced",
  "frontmatterDropped",
  "frontmatterFormatChanged",
  "mdxElementUnwrapped",
  "mdxDropped",
]).pipe(
  $I.annoteSchema("MdLossReason", {
    description: "Why the Markdown syntax bridge could not carry a syntax-tree construct unchanged.",
  })
);

/**
 * Type for {@link MdLossReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdLossReason = typeof MdLossReason.Type;

/**
 * How serious a loss is: `lossy` content changed shape but survived,
 * `unsupported` content was removed.
 *
 * **Example** (Check a severity)
 *
 * ```ts
 * import { MdLossSeverity } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdLossSeverity)("unsupported")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdLossSeverity = LiteralKit(["lossy", "unsupported"]).pipe(
  $I.annoteSchema("MdLossSeverity", {
    description: "Whether a bridge loss changed content (`lossy`) or removed it (`unsupported`).",
  })
);

/**
 * Type for {@link MdLossSeverity}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdLossSeverity = typeof MdLossSeverity.Type;

const lossy = (): MdLossSeverity => MdLossSeverity.Enum.lossy;
const unsupported = (): MdLossSeverity => MdLossSeverity.Enum.unsupported;

const severityOf = MdLossReason.match({
  htmlEscapedAsText: lossy,
  htmlInlinedBlock: lossy,
  htmlDropped: unsupported,
  autolinkLiteralAsText: lossy,
  referenceUnresolved: lossy,
  definitionUnreferenced: unsupported,
  codeLanguageDropped: lossy,
  codeMetaDropped: lossy,
  footnoteIdentifierRewritten: lossy,
  footnoteDefinitionDuplicate: unsupported,
  taskCheckboxDropped: lossy,
  admonitionTitleFlattened: lossy,
  recognizerSkipped: lossy,
  frontmatterInvalid: unsupported,
  frontmatterNotObject: unsupported,
  frontmatterValueCoerced: lossy,
  frontmatterDropped: unsupported,
  frontmatterFormatChanged: lossy,
  mdxElementUnwrapped: lossy,
  mdxDropped: unsupported,
});

/**
 * One construct the bridge could not carry unchanged.
 *
 * **Details**
 *
 * `nodeKind` is the syntax-tree `type` of the source node and `position` its
 * source span. `mdPath` is where the content landed in the Md tree, or `None`
 * when it was removed; frontmatter losses land at `["frontmatter"]`. `detail`
 * carries the specifics: the dropped info string, the old and new footnote
 * identifier, or the JSON pointer of a coerced value. Severity is derived
 * from the reason by {@link lossSeverity}, never stored.
 *
 * **Example** (Make a loss)
 *
 * ```ts
 * import { Position } from "@beep/markdown/MarkdownNode"
 * import { MdLoss } from "@beep/md/Md.syntax"
 * import * as O from "effect/Option"
 *
 * const loss = MdLoss.make({
 *   reason: "codeMetaDropped",
 *   nodeKind: "code",
 *   position: Position.synthetic,
 *   mdPath: O.some(["children", 0]),
 *   detail: O.some("title=example.ts"),
 * })
 * console.log(loss.reason) // "codeMetaDropped"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdLoss extends S.Opaque<MdLoss, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MdLoss", {
    reason: MdLossReason.pipe($I.annoteKey("MdLoss.reason", { description: "Why the construct was not carried." })),
    nodeKind: Kit.MarkdownNodeKind.pipe(
      $I.annoteKey("MdLoss.nodeKind", { description: "The syntax-tree `type` of the source node." })
    ),
    position: Kit.Position,
    mdPath: DocumentSafetyPathSegment.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      $I.annoteKey("MdLoss.mdPath", {
        description: "Where the content landed in the Md document, or None when it was removed.",
      })
    ),
    detail: S.OptionFromOptionalKey(S.String).pipe(
      $I.annoteKey("MdLoss.detail", { description: "Specifics such as a dropped value or a JSON pointer." })
    ),
  }).pipe(
    $I.annoteSchema("MdLoss", {
      description: "One syntax-tree construct the Markdown bridge could not carry unchanged.",
    })
  )
) {}

/**
 * Companion types for {@link MdLoss}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdLoss {
  /**
   * The encoded (wire) shape of {@link MdLoss}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MdLoss.Encoded;
}

/**
 * The severity of a loss, derived from its reason.
 *
 * **Example** (Classify a loss)
 *
 * ```ts
 * import { Position } from "@beep/markdown/MarkdownNode"
 * import { lossSeverity, MdLoss } from "@beep/md/Md.syntax"
 * import * as O from "effect/Option"
 *
 * const loss = MdLoss.make({
 *   reason: "mdxDropped",
 *   nodeKind: "mdxjsEsm",
 *   position: Position.synthetic,
 *   mdPath: O.none(),
 *   detail: O.none(),
 * })
 * console.log(lossSeverity(loss)) // "unsupported"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const lossSeverity = (loss: MdLoss): MdLossSeverity => severityOf(loss.reason);

// ---------------------------------------------------------------------------
// Source map
// ---------------------------------------------------------------------------

/**
 * How an Md node came from the source: parsed one-to-one, produced by a
 * recognizer, merged from adjacent text nodes, or synthesized around source
 * content.
 *
 * **Example** (Check an origin)
 *
 * ```ts
 * import { MdSourceOrigin } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdSourceOrigin)("merged")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdSourceOrigin = LiteralKit(["parsed", "recognized", "merged", "synthesized"]).pipe(
  $I.annoteSchema("MdSourceOrigin", {
    description: "How an Md node was produced from the syntax tree.",
  })
);

/**
 * Type for {@link MdSourceOrigin}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdSourceOrigin = typeof MdSourceOrigin.Type;

/**
 * The source span of one Md node, stored at the node's pre-order ordinal.
 *
 * **Details**
 *
 * `descendants` counts the node's Md descendants, so a walk skips a whole
 * subtree in one step. `tag` is the Md node's `_tag` and `fingerprint` is a
 * structural hash of the node's whole subtree (its tag, its own field values
 * and its children's fingerprints, in order). {@link positionAt} recomputes
 * the fingerprint of the node it reaches and compares, so a node whose
 * content no longer matches the recorded one does not resolve.
 *
 * **Example** (Make an entry)
 *
 * ```ts
 * import { Position } from "@beep/markdown/MarkdownNode"
 * import { MdSourceEntry } from "@beep/md/Md.syntax"
 *
 * const entry = MdSourceEntry.make({
 *   position: Position.synthetic,
 *   descendants: 0,
 *   origin: "parsed",
 *   tag: "hr",
 *   fingerprint: 0,
 * })
 * console.log(entry.tag) // "hr"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSourceEntry extends S.Opaque<MdSourceEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    position: Kit.Position,
    descendants: S.Natural.pipe(
      $I.annoteKey("MdSourceEntry.descendants", { description: "Number of Md nodes below this node." })
    ),
    origin: MdSourceOrigin.pipe($I.annoteKey("MdSourceEntry.origin", { description: "How the Md node was produced." })),
    tag: S.NonEmptyString.pipe(
      $I.annoteKey("MdSourceEntry.tag", { description: "The `_tag` of the Md node the entry was recorded for." })
    ),
    fingerprint: S.Int.pipe(
      $I.annoteKey("MdSourceEntry.fingerprint", {
        description: "Structural hash of the recorded Md node's subtree: tag, field values and child fingerprints.",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdSourceEntry", {
      description: "Source span of one Md node at its pre-order ordinal.",
    })
  )
) {}

/**
 * Companion types for {@link MdSourceEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdSourceEntry {
  /**
   * The encoded (wire) shape of {@link MdSourceEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MdSourceEntry.Encoded;
}

/**
 * Pre-order source map from Md nodes to syntax-tree positions.
 *
 * **Details**
 *
 * Entry 0 is the document, then every Md node in pre-order. The map is keyed
 * by ordinal, not by path, so it costs one small record per node. It is valid
 * only for the document the bridge returned with it. {@link positionAt}
 * answers only for a node that still matches the entry recorded at its path:
 * every ancestor on the path must keep its tag and child count, and the
 * addressed node must keep its tag and its subtree fingerprint. After an
 * insert, remove, reorder or in-place edit it returns `None` for every node
 * whose content no longer matches its entry instead of a different node's
 * position.
 *
 * **Gotchas**
 *
 * Fingerprints compare values, not identity: a returned span was recorded
 * for a node structurally equal to the one at the path, not necessarily for
 * that node. Swapping two equal siblings is invisible, and so is equal
 * content below two swapped siblings that share a tag and child count (the
 * `foo` text of `# foo` and `## foo`): ancestors are checked by tag and child
 * count only. Fingerprints are 32-bit hashes, so a changed subtree also
 * matches its old entry on a hash collision. The map is
 * transient and is never persisted.
 *
 * **Example** (Use the empty map)
 *
 * ```ts
 * import { MdSourceMap } from "@beep/md/Md.syntax"
 *
 * console.log(MdSourceMap.empty.entries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdSourceMap extends S.Opaque<MdSourceMap, { readonly brand: unique symbol }>()(
  S.Struct({
    entries: S.Array(MdSourceEntry).pipe(
      $I.annoteKey("MdSourceMap.entries", { description: "Source entries in Md pre-order; entry 0 is the document." })
    ),
  }).pipe(
    $I.annoteSchema("MdSourceMap", {
      description: "Pre-order source map from Md document nodes to syntax-tree positions.",
    })
  )
) {
  static readonly empty: MdSourceMap = MdSourceMap.make({ entries: [] });
}

/**
 * Companion types for {@link MdSourceMap}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdSourceMap {
  /**
   * The encoded (wire) shape of {@link MdSourceMap}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MdSourceMap.Encoded;
}

const childrenOf = (node: unknown): ReadonlyArray<unknown> =>
  P.hasProperty(node, "children") && A.isArray(node.children) ? node.children : [];

const directChildOrdinals = (entries: ReadonlyArray<MdSourceEntry>, ordinal: number): ReadonlyArray<number> => {
  const ordinals: Array<number> = [];
  const end = ordinal + (entries[ordinal]?.descendants ?? 0);
  let next = ordinal + 1;
  while (next <= end) {
    ordinals.push(next);
    next += (entries[next]?.descendants ?? end) + 1;
  }
  return ordinals;
};

const isChildStep = (path: ReadonlyArray<DocumentSafetyPathSegment>, at: number): boolean =>
  path[at] === "children" && P.isNumber(path[at + 1]);

const tagOf = (node: unknown): string => (P.hasProperty(node, "_tag") && P.isString(node._tag) ? node._tag : "");

const fieldsOf = (node: unknown): ReadonlyArray<readonly [string, unknown]> =>
  P.isReadonlyObject(node) ? R.toEntries(node) : [];

// A field's share of its node's fingerprint, or None for an absent value.
// `None`, `false` and a missing key hash alike, so the plain data the fold
// builds and the admitted document (which fills constructor defaults such as
// `title: None` or `checked: false`) fingerprint the same.
const fieldFingerprint = (value: unknown): O.Option<number> =>
  O.isOption(value)
    ? O.map(value, Hash.hash)
    : value === false || P.isUndefined(value)
      ? O.none()
      : O.some(Hash.hash(value));

// Merkle-style: the node's own fields (order-free, as `Hash.structure` does)
// combined with its children's fingerprints in order.
const nodeFingerprint = (node: unknown, children: ReadonlyArray<number>): number => {
  let fields = Hash.string("@beep/md/MdSourceEntry");
  for (const [key, value] of fieldsOf(node)) {
    if (key !== "children") {
      fields ^= O.match(fieldFingerprint(value), {
        onNone: () => 0,
        onSome: (hash) => Hash.combine(Hash.string(key), hash),
      });
    }
  }
  return Hash.combine(Hash.optimize(fields), Hash.array(children));
};

// The fingerprint of a whole subtree, in O(subtree).
const subtreeFingerprint = (node: unknown): number =>
  nodeFingerprint(node, A.map(childrenOf(node), subtreeFingerprint));

// Every node's tag and fingerprint in pre-order, in one bottom-up pass.
const recordFingerprints = (node: unknown, out: Array<readonly [string, number]>): number => {
  const at = out.length;
  out.push([tagOf(node), 0]);
  const fingerprint = nodeFingerprint(
    node,
    A.map(childrenOf(node), (child) => recordFingerprints(child, out))
  );
  out[at] = [tagOf(node), fingerprint];
  return fingerprint;
};

// An ancestor on the walk still matches its entry when its tag and its child
// count are unchanged; any transform that adds, drops or retypes a child
// breaks that.
const matchesEntry = (entries: ReadonlyArray<MdSourceEntry>, ordinal: number, node: unknown): boolean =>
  entries[ordinal]?.tag === tagOf(node) && childrenOf(node).length === directChildOrdinals(entries, ordinal).length;

// The addressed node must also be the very subtree the entry recorded, so a
// reorder of same-shape siblings or an in-place edit yields None.
const matchesTarget = (entries: ReadonlyArray<MdSourceEntry>, ordinal: number, node: unknown): boolean =>
  matchesEntry(entries, ordinal, node) && entries[ordinal]?.fingerprint === subtreeFingerprint(node);

// One step down the path: the child's ordinal and node, or None when the
// current node no longer matches its entry or has no such child.
const descend = (
  entries: ReadonlyArray<MdSourceEntry>,
  [ordinal, node]: readonly [number, unknown],
  index: DocumentSafetyPathSegment | undefined
): O.Option<readonly [number, unknown]> =>
  matchesEntry(entries, ordinal, node) && P.isNumber(index)
    ? O.map(
        O.fromUndefinedOr(directChildOrdinals(entries, ordinal)[index]),
        (next) => [next, childrenOf(node)[index]] as const
      )
    : O.none();

const positionAtImpl = (
  map: MdSourceMap,
  document: Model.Document,
  path: ReadonlyArray<DocumentSafetyPathSegment>
): O.Option<Kit.Position> => {
  const entries = map.entries;
  let cursor: O.Option<readonly [number, unknown]> =
    entries[0]?.descendants === entries.length - 1 ? O.some([0, document]) : O.none();
  for (let at = 0; O.isSome(cursor) && isChildStep(path, at); at += 2) {
    cursor = descend(entries, cursor.value, path[at + 1]);
  }
  // The addressed node must be the recorded subtree, so a transform that only
  // touched the target (the document itself included) still yields None.
  return O.flatMap(cursor, ([ordinal, node]) =>
    matchesTarget(entries, ordinal, node) ? O.fromUndefinedOr(entries[ordinal]?.position) : O.none()
  );
};

/**
 * The source position of the Md node at a document path.
 *
 * **Details**
 *
 * The path is a `DocumentSafetyPathSegment` array such as
 * `["children", 0, "children", 2]`; a trailing field segment (`"href"`,
 * `"value"`) resolves to its node. It returns `None` when the path leaves
 * the tree, when an ancestor on the path changed its tag or child count, or
 * when the addressed node is not the subtree its entry recorded: after an
 * insert, a remove, a reorder (same-shape siblings included) or an in-place
 * edit of the node or anything below it. Ancestors are checked by tag and
 * child count only, so an edit elsewhere in the document leaves unrelated
 * nodes resolvable.
 *
 * **Gotchas**
 *
 * The walk costs O(depth × siblings) plus O(size of the addressed subtree),
 * because the subtree's fingerprint is recomputed on every call; a lookup of
 * the document itself is O(n). The check compares values, so a node equal
 * to the one recorded at its path resolves to that recorded span even when
 * it moved there: two swapped equal siblings, or equal content below two
 * swapped siblings that share a tag and child count.
 *
 * **Example** (Locate a paragraph)
 *
 * ```ts
 * import { parseResult } from "@beep/md/Md.parse"
 * import { positionAt } from "@beep/md/Md.syntax"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const bridged = Result.getOrThrow(parseResult("# Title\n\nBody"))
 * const position = positionAt(bridged.sourceMap, bridged.document, ["children", 1])
 * console.log(O.map(position, (span) => span.start.line)) // Some(3)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const positionAt: {
  (
    document: Model.Document,
    path: ReadonlyArray<DocumentSafetyPathSegment>
  ): (map: MdSourceMap) => O.Option<Kit.Position>;
  (map: MdSourceMap, document: Model.Document, path: ReadonlyArray<DocumentSafetyPathSegment>): O.Option<Kit.Position>;
} = dual(3, positionAtImpl);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * How parsed raw HTML enters the Md tree: as escaped text (the default), as
 * `RawHtml` nodes, or not at all.
 *
 * **Example** (Check an HTML policy)
 *
 * ```ts
 * import { MdHtmlPolicy } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdHtmlPolicy)("rawHtml")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdHtmlPolicy = LiteralKit(["escapeAsText", "rawHtml", "drop"]).pipe(
  $I.annoteSchema("MdHtmlPolicy", { description: "How parsed raw HTML enters the Md document." })
);

/**
 * Type for {@link MdHtmlPolicy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdHtmlPolicy = typeof MdHtmlPolicy.Type;

/**
 * How an HTML node that is exactly one comment is handled: removed (the
 * default, since comments are authoring notes and escaping them would leak
 * them into rendered text) or treated like any other HTML.
 *
 * **Example** (Check a comment policy)
 *
 * ```ts
 * import { MdHtmlCommentPolicy } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdHtmlCommentPolicy)("drop")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdHtmlCommentPolicy = LiteralKit(["drop", "asHtml"]).pipe(
  $I.annoteSchema("MdHtmlCommentPolicy", { description: "How an HTML comment node enters the Md document." })
);

/**
 * Type for {@link MdHtmlCommentPolicy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdHtmlCommentPolicy = typeof MdHtmlCommentPolicy.Type;

/**
 * How GFM autolink literals (`www.example.com`, bare URLs) are carried: as
 * links (the default) or as the literal text.
 *
 * **Example** (Check an autolink policy)
 *
 * ```ts
 * import { MdAutolinkLiteralPolicy } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdAutolinkLiteralPolicy)("text")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdAutolinkLiteralPolicy = LiteralKit(["link", "text"]).pipe(
  $I.annoteSchema("MdAutolinkLiteralPolicy", { description: "How GFM autolink literals enter the Md document." })
);

/**
 * Type for {@link MdAutolinkLiteralPolicy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdAutolinkLiteralPolicy = typeof MdAutolinkLiteralPolicy.Type;

/**
 * How a soft line break inside text is carried: as a space (the default, the
 * Md-core convention) or as a newline.
 *
 * **Example** (Check a soft-break policy)
 *
 * ```ts
 * import { MdSoftBreak } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdSoftBreak)("space")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdSoftBreak = LiteralKit(["space", "newline"]).pipe(
  $I.annoteSchema("MdSoftBreak", { description: "How a soft line break inside text enters the Md document." })
);

/**
 * Type for {@link MdSoftBreak}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdSoftBreak = typeof MdSoftBreak.Type;

/**
 * What happens to a captured frontmatter block: decoded into
 * `Document.frontmatter` (the default) or dropped.
 *
 * **Example** (Check a frontmatter policy)
 *
 * ```ts
 * import { MdFrontmatterPolicy } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdFrontmatterPolicy)("decode")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdFrontmatterPolicy = LiteralKit(["decode", "drop"]).pipe(
  $I.annoteSchema("MdFrontmatterPolicy", { description: "What happens to a captured frontmatter block." })
);

/**
 * Type for {@link MdFrontmatterPolicy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdFrontmatterPolicy = typeof MdFrontmatterPolicy.Type;

/**
 * What a frontmatter decode failure does: record a loss and continue (the
 * default) or fail the bridge with {@link MdFrontmatterError}.
 *
 * **Example** (Check a failure policy)
 *
 * ```ts
 * import { MdFrontmatterFailure } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdFrontmatterFailure)("fail")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdFrontmatterFailure = LiteralKit(["loss", "fail"]).pipe(
  $I.annoteSchema("MdFrontmatterFailure", { description: "What a frontmatter decode failure does." })
);

/**
 * Type for {@link MdFrontmatterFailure}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdFrontmatterFailure = typeof MdFrontmatterFailure.Type;

/**
 * The bridge option fields, shared by {@link MdSyntaxOptions} and the parse
 * options of `@beep/md/Md.parse`.
 *
 * **Example** (Read the option field names)
 *
 * ```ts
 * import { MdSyntaxOptionFields } from "@beep/md/Md.syntax"
 *
 * console.log("math" in MdSyntaxOptionFields) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const MdSyntaxOptionFields = {
  html: MdHtmlPolicy.pipe(
    S.withConstructorDefault(Effect.succeed(MdHtmlPolicy.Enum.escapeAsText)),
    S.withDecodingDefaultTypeKey(Effect.succeed(MdHtmlPolicy.Enum.escapeAsText)),
    $I.annoteKey("MdSyntaxOptions.html", { description: "How raw HTML enters the document; escapeAsText by default." })
  ),
  htmlComments: MdHtmlCommentPolicy.pipe(
    S.withConstructorDefault(Effect.succeed(MdHtmlCommentPolicy.Enum.drop)),
    S.withDecodingDefaultTypeKey(Effect.succeed(MdHtmlCommentPolicy.Enum.drop)),
    $I.annoteKey("MdSyntaxOptions.htmlComments", {
      description: "How HTML comment nodes are handled; drop by default.",
    })
  ),
  breakTag: SchemaUtils.BoolKeyDefaultTrue.pipe(
    $I.annoteKey("MdSyntaxOptions.breakTag", {
      description: "Whether `<br>` HTML becomes a hard break; on by default.",
    })
  ),
  admonitions: SchemaUtils.BoolKeyDefaultTrue.pipe(
    $I.annoteKey("MdSyntaxOptions.admonitions", {
      description: "Whether `> [!NOTE]` blockquotes become admonitions; on by default.",
    })
  ),
  math: SchemaUtils.BoolKeyDefaultTrue.pipe(
    $I.annoteKey("MdSyntaxOptions.math", {
      description:
        "Whether `$…$`, `$$…$$` and ```math become math nodes; on by default, and `Md.render` escapes every `$` that could open math.",
    })
  ),
  youtube: SchemaUtils.BoolKeyDefaultFalse.pipe(
    $I.annoteKey("MdSyntaxOptions.youtube", {
      description: "Whether a paragraph holding only a YouTube link becomes a YouTube embed; off by default.",
    })
  ),
  absorbEmptyTableHeader: SchemaUtils.BoolKeyDefaultTrue.pipe(
    $I.annoteKey("MdSyntaxOptions.absorbEmptyTableHeader", {
      description: "Whether an all-empty table header row becomes a header-less table; on by default.",
    })
  ),
  autolinkLiterals: MdAutolinkLiteralPolicy.pipe(
    S.withConstructorDefault(Effect.succeed(MdAutolinkLiteralPolicy.Enum.link)),
    S.withDecodingDefaultTypeKey(Effect.succeed(MdAutolinkLiteralPolicy.Enum.link)),
    $I.annoteKey("MdSyntaxOptions.autolinkLiterals", { description: "How GFM autolink literals enter the document." })
  ),
  softBreak: MdSoftBreak.pipe(
    S.withConstructorDefault(Effect.succeed(MdSoftBreak.Enum.space)),
    S.withDecodingDefaultTypeKey(Effect.succeed(MdSoftBreak.Enum.space)),
    $I.annoteKey("MdSyntaxOptions.softBreak", { description: "How soft line breaks enter text; space by default." })
  ),
  frontmatter: MdFrontmatterPolicy.pipe(
    S.withConstructorDefault(Effect.succeed(MdFrontmatterPolicy.Enum.decode)),
    S.withDecodingDefaultTypeKey(Effect.succeed(MdFrontmatterPolicy.Enum.decode)),
    $I.annoteKey("MdSyntaxOptions.frontmatter", { description: "What happens to captured frontmatter." })
  ),
  onFrontmatterFailure: MdFrontmatterFailure.pipe(
    S.withConstructorDefault(Effect.succeed(MdFrontmatterFailure.Enum.loss)),
    S.withDecodingDefaultTypeKey(Effect.succeed(MdFrontmatterFailure.Enum.loss)),
    $I.annoteKey("MdSyntaxOptions.onFrontmatterFailure", {
      description: "Whether a frontmatter decode failure is a loss or an error.",
    })
  ),
  sourceMap: SchemaUtils.BoolKeyDefaultTrue.pipe(
    $I.annoteKey("MdSyntaxOptions.sourceMap", { description: "Whether to build the source map; on by default." })
  ),
};

/**
 * Options for {@link fromMarkdownDocument}. Every field has a default, so an
 * empty object (or no options) gives the documented behaviour.
 *
 * **Example** (Resolve defaults)
 *
 * ```ts
 * import { MdSyntaxOptions } from "@beep/md/Md.syntax"
 *
 * const options = MdSyntaxOptions.make({})
 * console.log(options.html, options.math) // "escapeAsText" false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MdSyntaxOptions extends S.Opaque<MdSyntaxOptions, { readonly brand: unique symbol }>()(
  S.Struct(MdSyntaxOptionFields).pipe(
    $I.annoteSchema("MdSyntaxOptions", {
      description: "Policies and recognizer switches for the Markdown syntax bridge.",
    })
  )
) {}

/**
 * Companion types for {@link MdSyntaxOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdSyntaxOptions {
  /**
   * The plain options object the bridge accepts; every key is optional.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MdSyntaxOptions.Encoded;
}

// ---------------------------------------------------------------------------
// Results and errors
// ---------------------------------------------------------------------------

/**
 * The bridged document, the losses the bridge recorded in source order, and
 * the source map.
 *
 * **Example** (Bridge a parsed document)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument"
 * import { fromMarkdownDocument } from "@beep/md/Md.syntax"
 * import * as Result from "effect/Result"
 *
 * const parsed = Result.getOrThrow(MarkdownDocument.parseResult("Hello"))
 * const bridged = Result.getOrThrow(fromMarkdownDocument(parsed))
 * console.log(bridged.document.children.length, bridged.losses.length) // 1 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdFromSyntax extends S.Opaque<MdFromSyntax, { readonly brand: unique symbol }>()(
  S.Struct({
    document: Document,
    losses: S.Array(MdLoss).pipe(
      $I.annoteKey("MdFromSyntax.losses", { description: "Constructs not carried unchanged, in source order." })
    ),
    sourceMap: MdSourceMap,
  }).pipe(
    $I.annoteSchema("MdFromSyntax", {
      description: "An Md document bridged from a Markdown syntax tree, with its losses and source map.",
    })
  )
) {}

/**
 * Companion types for {@link MdFromSyntax}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdFromSyntax {
  /**
   * The encoded (wire) shape of {@link MdFromSyntax}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MdFromSyntax.Encoded;
}

/**
 * Why frontmatter failed the bridge: its text did not parse, or its root
 * value was not an object.
 *
 * **Example** (Check a frontmatter error reason)
 *
 * ```ts
 * import { MdFrontmatterErrorReason } from "@beep/md/Md.syntax"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MdFrontmatterErrorReason)("notObject")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MdFrontmatterErrorReason = LiteralKit(["invalid", "notObject"]).pipe(
  $I.annoteSchema("MdFrontmatterErrorReason", { description: "Why frontmatter failed the Markdown bridge." })
);

/**
 * Type for {@link MdFrontmatterErrorReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MdFrontmatterErrorReason = typeof MdFrontmatterErrorReason.Type;

/**
 * Frontmatter that could not become `Document.frontmatter`, raised only under
 * `onFrontmatterFailure: "fail"`.
 *
 * **Example** (Make a frontmatter error)
 *
 * ```ts
 * import { Position } from "@beep/markdown/MarkdownNode"
 * import { MdFrontmatterError } from "@beep/md/Md.syntax"
 *
 * const error = MdFrontmatterError.make({
 *   format: "yaml",
 *   reason: "notObject",
 *   position: Position.synthetic,
 *   cause: ["a", "list"],
 * })
 * console.log(error._tag) // "MdFrontmatterError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MdFrontmatterError extends S.TaggedError<MdFrontmatterError, { readonly brand: unique symbol }>(
  $I`MdFrontmatterError`
)(
  "MdFrontmatterError",
  {
    format: Kit.FrontmatterFormat,
    reason: MdFrontmatterErrorReason,
    position: Kit.Position,
    cause: S.Defect().pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
  },
  $I.annoteError<MdFrontmatterError>("MdFrontmatterError", {
    description: "Captured frontmatter that could not be decoded into a JSON object.",
  })
) {}

/**
 * One safety violation of a bridged document with the source position of the
 * node it names, when the path resolves through the source map.
 *
 * **Example** (Make a located violation)
 *
 * ```ts
 * import { MdLocatedViolation } from "@beep/md/Md.syntax"
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 * import * as O from "effect/Option"
 *
 * const located = MdLocatedViolation.make({
 *   violation: RawNodeSafetyViolation.make({ path: [], nodeTag: "rawHtml" }),
 *   position: O.none(),
 * })
 * console.log(located.violation._tag) // "RawNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MdLocatedViolation extends S.Opaque<MdLocatedViolation, { readonly brand: unique symbol }>()(
  S.Struct({
    violation: DocumentSafetyViolation.pipe(
      $I.annoteKey("MdLocatedViolation.violation", { description: "The safety violation." })
    ),
    position: S.OptionFromOptionalKey(Kit.Position).pipe(
      $I.annoteKey("MdLocatedViolation.position", { description: "Source span of the violating node, when known." })
    ),
  }).pipe(
    $I.annoteSchema("MdLocatedViolation", {
      description: "A document safety violation paired with its source position.",
    })
  )
) {}

/**
 * A bridged document that is not safe for editor or RPC boundaries.
 *
 * **Example** (Make an unsafe-document error)
 *
 * ```ts
 * import { MdUnsafeDocumentError } from "@beep/md/Md.syntax"
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 *
 * const error = MdUnsafeDocumentError.make({
 *   violations: [RawNodeSafetyViolation.make({ path: ["children", 0], nodeTag: "rawHtml" })],
 *   located: [],
 * })
 * console.log(error.violations.length) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MdUnsafeDocumentError extends S.TaggedError<MdUnsafeDocumentError, { readonly brand: unique symbol }>(
  $I`MdUnsafeDocumentError`
)(
  "MdUnsafeDocumentError",
  {
    violations: S.Array(DocumentSafetyViolation).check(S.isMinLength(1)),
    located: S.Array(MdLocatedViolation),
  },
  $I.annoteError<MdUnsafeDocumentError>("MdUnsafeDocumentError", {
    description: "A bridged Markdown document rejected by the user-content safety profile.",
  })
) {}

// ---------------------------------------------------------------------------
// Bridge state
// ---------------------------------------------------------------------------

class SlotPath {
  readonly parent: SlotPath | undefined;
  readonly index: number;

  constructor(parent: SlotPath | undefined, index: number) {
    this.parent = parent;
    this.index = index;
  }
}

class SourceSlot {
  readonly position: Kit.Position;
  readonly origin: MdSourceOrigin;
  descendants = 0;

  constructor(position: Kit.Position, origin: MdSourceOrigin) {
    this.position = position;
    this.origin = origin;
  }
}

class BridgeState {
  readonly slots: Array<SourceSlot> = [];
  readonly losses: Array<MdLoss> = [];
  readonly footnotes = new FootnoteIdentifiers();
  readonly seenFootnoteDefinitions = MutableHashSet.empty<string>();
  readonly referencedLabels = MutableHashSet.empty<string>();
  readonly definitions: Array<Kit.Definition> = [];

  readonly document: MarkdownDocument;
  readonly options: MdSyntaxOptions;

  constructor(document: MarkdownDocument, options: MdSyntaxOptions) {
    this.document = document;
    this.options = options;
  }
}

const pathSegments = (path: SlotPath | undefined): ReadonlyArray<DocumentSafetyPathSegment> => {
  const segments: Array<DocumentSafetyPathSegment> = [];
  for (let at = path; at !== undefined; at = at.parent) {
    segments.push(at.index, "children");
  }
  return A.reverse(segments);
};

const landed = (path: SlotPath | undefined): O.Option<ReadonlyArray<DocumentSafetyPathSegment>> =>
  O.some(pathSegments(path));

const frontmatterPath: O.Option<ReadonlyArray<DocumentSafetyPathSegment>> = O.some(["frontmatter"]);

const recordLoss = (
  state: BridgeState,
  reason: MdLossReason,
  node: { readonly type: Kit.MarkdownNodeKind; readonly position: Kit.Position },
  mdPath: O.Option<ReadonlyArray<DocumentSafetyPathSegment>>,
  detail: string
): void => {
  state.losses.push(
    MdLoss.make({ reason, nodeKind: node.type, position: node.position, mdPath, detail: O.some(detail) })
  );
};

const open = (state: BridgeState, position: Kit.Position, origin: MdSourceOrigin): number => {
  state.slots.push(new SourceSlot(position, origin));
  return state.slots.length - 1;
};

const close = (state: BridgeState, at: number): void => {
  const slot = state.slots[at];
  if (slot !== undefined) {
    slot.descendants = state.slots.length - at - 1;
  }
};

const rollback = (state: BridgeState, at: number): void => {
  state.slots.length = at;
};

const leaf = <Node>(state: BridgeState, position: Kit.Position, origin: MdSourceOrigin, node: Node): Node => {
  open(state, position, origin);
  return node;
};

const branch = <Node>(state: BridgeState, position: Kit.Position, origin: MdSourceOrigin, build: () => Node): Node => {
  const at = open(state, position, origin);
  const node = build();
  close(state, at);
  return node;
};

const slice = (state: BridgeState, position: Kit.Position): string => sourceSlice(state.document.source, position);

// ---------------------------------------------------------------------------
// Phrasing content
// ---------------------------------------------------------------------------

type PhrasingStep = (state: BridgeState, path: SlotPath) => ReadonlyArray<Model.Inline>;

// Decode only source newlines as soft breaks. A newline from an entity is
// literal text, including the spelling used to preserve escaped HTML.
const softBreak = (state: BridgeState, value: string, raw: string): string => {
  if (state.options.softBreak !== MdSoftBreak.Enum.space || !Str.includes("\n")(value)) {
    return value;
  }
  const newlines = A.flatMap(
    A.fromIterable(
      Str.matchAll(/\\[!-/:-@[-`{-~]|&(?:#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});|\n/g)(raw)
    ),
    (match) => (unescapeString(match[0]) === "\n" ? [match[0] === "\n"] : [])
  );
  let index = 0;
  return replaceWith(value, /\n/g, () => (newlines[index++] === false ? "\n" : " "));
};

const textNode = (value: string): Model.Text => Model.Text.make({ _tag: "text", value });

// Segments come from the raw slice, so a backslash-escaped `$` never
// delimits; a math piece keeps its raw TeX, and a text piece drops its
// backslash escapes to read as the decoded text it came from.
const recognizeInlineMath = (
  state: BridgeState,
  raw: string,
  segments: ReadonlyArray<MathSegment>,
  position: Kit.Position
): ReadonlyArray<Model.Inline> =>
  A.map(segments, (segment): Model.Inline => {
    const piece = Str.slice(segment.from, segment.to)(raw);
    return segment.math
      ? leaf(
          state,
          subPosition(position, raw, segment.from - 1, segment.to + 1),
          MdSourceOrigin.Enum.recognized,
          Model.InlineMath.make({
            _tag: "inlineMath",
            value: piece,
          })
        )
      : leaf(
          state,
          subPosition(position, raw, segment.from, segment.to),
          MdSourceOrigin.Enum.recognized,
          textNode(softBreak(state, unescapeString(piece), piece))
        );
  });

const hasMath = (segments: ReadonlyArray<MathSegment>): boolean => A.some(segments, (segment) => segment.math);

const runPosition = (run: A.NonEmptyReadonlyArray<Kit.Text>): Kit.Position =>
  run.length > 1
    ? Kit.Position.make({ start: A.headNonEmpty(run).position.start, end: A.lastNonEmpty(run).position.end })
    : A.headNonEmpty(run).position;

const inlineMathRun = (
  state: BridgeState,
  first: Kit.Text,
  value: string,
  position: Kit.Position,
  path: SlotPath
): O.Option<ReadonlyArray<Model.Inline>> => {
  if (!state.options.math || !Str.includes("$")(value)) {
    return O.none();
  }
  const raw = slice(state, position);
  const segments = scanInlineMath(raw);
  if (!hasMath(segments)) {
    return O.none();
  }
  // Decode entities only outside math; TeX stays raw. Container line
  // prefixes still make the reconstructed run differ from its decoded text.
  const decoded = A.join(
    A.map(segments, (segment) => {
      const piece = Str.slice(segment.from, segment.to)(raw);
      return segment.math ? `$${unescapeBackslashes(piece)}$` : unescapeString(piece);
    }),
    ""
  );
  if (decoded === value) {
    return O.some(recognizeInlineMath(state, raw, segments, position));
  }
  recordLoss(state, "recognizerSkipped", first, landed(path), "inline math spans entities or line prefixes");
  return O.none();
};

const mapTextRun = (
  state: BridgeState,
  run: A.NonEmptyReadonlyArray<Kit.Text>,
  path: SlotPath
): ReadonlyArray<Model.Inline> => {
  const value = A.join(
    A.map(run, (text) => text.value),
    ""
  );
  if (Str.isEmpty(value)) {
    return [];
  }
  const position = runPosition(run);
  const origin = run.length > 1 ? MdSourceOrigin.Enum.merged : MdSourceOrigin.Enum.parsed;
  return O.getOrElse(inlineMathRun(state, A.headNonEmpty(run), value, position, path), () => [
    leaf(state, position, origin, textNode(softBreak(state, value, slice(state, position)))),
  ]);
};

const escapedInlineHtml = (state: BridgeState, kid: Kit.PhrasingContent): boolean =>
  kid.type === "html" && headHtmlKept(state, kid.value) && !(state.options.breakTag && isBreakTag(kid.value));

const mapPhrasingChildren = (
  state: BridgeState,
  kids: ReadonlyArray<Kit.PhrasingContent>,
  parent: SlotPath | undefined,
  offset: number
): Array<Model.Inline> => {
  const out: Array<Model.Inline> = [];
  let run: Array<Kit.Text> = [];
  let mergeableText = false;
  const nextPath = (merging: boolean): SlotPath => new SlotPath(parent, offset + out.length - (merging ? 1 : 0));
  const append = (inline: Model.Inline, mergeable: boolean): void => {
    const previous = A.last(out);
    if (mergeable && mergeableText && inline._tag === "text" && O.isSome(previous) && previous.value._tag === "text") {
      const currentSlot = state.slots.pop();
      const previousSlot = state.slots.pop();
      if (currentSlot !== undefined && previousSlot !== undefined) {
        state.slots.push(
          new SourceSlot(
            Kit.Position.make({ start: previousSlot.position.start, end: currentSlot.position.end }),
            MdSourceOrigin.Enum.merged
          )
        );
      }
      out[out.length - 1] = textNode(previous.value.value + inline.value);
    } else {
      out.push(inline);
    }
    mergeableText = mergeable && inline._tag === "text";
  };
  const flush = (): void => {
    if (A.isArrayNonEmpty(run)) {
      const start = state.slots.length;
      const inlines = mapTextRun(state, run, nextPath(mergeableText));
      const slots = A.drop(state.slots, start);
      rollback(state, start);
      for (const [index, inline] of A.zip(A.range(0, inlines.length - 1), inlines)) {
        const slot = slots[index];
        if (slot !== undefined) {
          state.slots.push(slot);
        }
        append(inline, true);
      }
      run = [];
    }
  };
  for (const kid of kids) {
    if (kid.type === "text") {
      run.push(kid);
      continue;
    }
    flush();
    const mergesHtml = mergeableText && escapedInlineHtml(state, kid);
    const path = nextPath(mergesHtml);
    for (const inline of phrasingStep(kid)(state, path)) {
      append(inline, escapedInlineHtml(state, kid));
    }
  }
  flush();
  return out;
};

const phrasingChildren = (state: BridgeState, kids: ReadonlyArray<Kit.PhrasingContent>, path: SlotPath) =>
  mapPhrasingChildren(state, kids, path, 0);

const resolveDefinition = (state: BridgeState, identifier: string): O.Option<Kit.Definition> => {
  const label = normalizeLabelText(identifier);
  MutableHashSet.add(state.referencedLabels, label);
  return HashMap.get(state.document.definitions, label);
};

const unresolvedReference = (
  state: BridgeState,
  node: Kit.LinkReference | Kit.ImageReference,
  path: SlotPath
): ReadonlyArray<Model.Inline> => {
  recordLoss(state, "referenceUnresolved", node, landed(path), node.identifier);
  return [leaf(state, node.position, MdSourceOrigin.Enum.parsed, textNode(slice(state, node.position)))];
};

const htmlInline =
  (node: Kit.Html): PhrasingStep =>
  (state, path) => {
    if (state.options.breakTag && isBreakTag(node.value)) {
      return [leaf(state, node.position, MdSourceOrigin.Enum.recognized, Model.Br.make({ _tag: "br" }))];
    }
    if (state.options.htmlComments === MdHtmlCommentPolicy.Enum.drop && isHtmlComment(node.value)) {
      recordLoss(state, "htmlDropped", node, O.none(), "comment");
      return [];
    }
    return MdHtmlPolicy.match(state.options.html, {
      escapeAsText: (): ReadonlyArray<Model.Inline> => {
        recordLoss(state, "htmlEscapedAsText", node, landed(path), node.value);
        return [leaf(state, node.position, MdSourceOrigin.Enum.parsed, textNode(node.value))];
      },
      rawHtml: (): ReadonlyArray<Model.Inline> => [
        leaf(
          state,
          node.position,
          MdSourceOrigin.Enum.parsed,
          Model.RawHtml.make({ _tag: "rawHtml", value: node.value })
        ),
      ],
      drop: (): ReadonlyArray<Model.Inline> => {
        recordLoss(state, "htmlDropped", node, O.none(), node.value);
        return [];
      },
    });
  };

const isAutolinkLiteral = (raw: string): boolean =>
  Str.isNonEmpty(raw) && !Str.startsWith("[")(raw) && !Str.startsWith("<")(raw);

const linkInline =
  (node: Kit.Link): PhrasingStep =>
  (state, path) => {
    const raw = slice(state, node.position);
    if (state.options.autolinkLiterals === MdAutolinkLiteralPolicy.Enum.text && isAutolinkLiteral(raw)) {
      recordLoss(state, "autolinkLiteralAsText", node, landed(path), node.url);
      return [leaf(state, node.position, MdSourceOrigin.Enum.parsed, textNode(raw))];
    }
    return [
      branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
        Model.A.make({
          _tag: "a",
          href: node.url,
          title: O.fromUndefinedOr(node.title),
          children: phrasingChildren(state, node.children, path),
        })
      ),
    ];
  };

const referenceInline = (
  state: BridgeState,
  node: Kit.LinkReference | Kit.ImageReference,
  path: SlotPath,
  resolved: (definition: Kit.Definition) => Model.Inline
): ReadonlyArray<Model.Inline> =>
  O.match(resolveDefinition(state, node.identifier), {
    onNone: () => unresolvedReference(state, node, path),
    onSome: (definition) => [resolved(definition)],
  });

const linkReferenceInline =
  (node: Kit.LinkReference): PhrasingStep =>
  (state, path) =>
    referenceInline(state, node, path, (definition) =>
      branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
        Model.A.make({
          _tag: "a",
          href: definition.url,
          title: O.fromUndefinedOr(definition.title),
          children: phrasingChildren(state, node.children, path),
        })
      )
    );

const imageReferenceInline =
  (node: Kit.ImageReference): PhrasingStep =>
  (state, path) =>
    referenceInline(state, node, path, (definition) =>
      leaf(
        state,
        node.position,
        MdSourceOrigin.Enum.parsed,
        Model.Img.make({
          _tag: "img",
          src: definition.url,
          alt: node.alt ?? "",
          title: O.fromUndefinedOr(definition.title),
        })
      )
    );

const rewriteFootnote = (
  state: BridgeState,
  node: Kit.FootnoteReference | Kit.FootnoteDefinition,
  path: SlotPath
): string => {
  const identifier = state.footnotes.rewrite(node.identifier);
  if (identifier !== node.identifier) {
    recordLoss(state, "footnoteIdentifierRewritten", node, landed(path), `${node.identifier} -> ${identifier}`);
  }
  return identifier;
};

const phrasingStep: (node: Kit.PhrasingContent) => PhrasingStep = Match.type<Kit.PhrasingContent>().pipe(
  Match.discriminatorsExhaustive("type")({
    text:
      (node): PhrasingStep =>
      (state, path) =>
        mapTextRun(state, [node], path),
    emphasis:
      (node): PhrasingStep =>
      (state, path) => [
        branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
          Model.Em.make({
            _tag: "em",
            children: phrasingChildren(state, node.children, path),
          })
        ),
      ],
    strong:
      (node): PhrasingStep =>
      (state, path) => [
        branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
          Model.Strong.make({
            _tag: "strong",
            children: phrasingChildren(state, node.children, path),
          })
        ),
      ],
    delete:
      (node): PhrasingStep =>
      (state, path) => [
        branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
          Model.Del.make({
            _tag: "del",
            children: phrasingChildren(state, node.children, path),
          })
        ),
      ],
    inlineCode:
      (node): PhrasingStep =>
      (state) => [
        leaf(state, node.position, MdSourceOrigin.Enum.parsed, Model.Code.make({ _tag: "code", value: node.value })),
      ],
    break:
      (node): PhrasingStep =>
      (state) => [leaf(state, node.position, MdSourceOrigin.Enum.parsed, Model.Br.make({ _tag: "br" }))],
    html: htmlInline,
    link: linkInline,
    linkReference: linkReferenceInline,
    image:
      (node): PhrasingStep =>
      (state) => [
        leaf(
          state,
          node.position,
          MdSourceOrigin.Enum.parsed,
          Model.Img.make({
            _tag: "img",
            src: node.url,
            alt: node.alt ?? "",
            title: O.fromUndefinedOr(node.title),
          })
        ),
      ],
    imageReference: imageReferenceInline,
    footnoteReference:
      (node): PhrasingStep =>
      (state, path) => {
        const identifier = rewriteFootnote(state, node, path);
        return [
          leaf(
            state,
            node.position,
            MdSourceOrigin.Enum.parsed,
            Model.FootnoteReference.make({ _tag: "footnoteReference", identifier })
          ),
        ];
      },
    mdxJsxTextElement:
      (node): PhrasingStep =>
      (state, path) => {
        recordLoss(state, "mdxElementUnwrapped", node, landed(path), node.name ?? "fragment");
        return mapPhrasingChildren(state, node.children, path.parent, path.index);
      },
    mdxTextExpression:
      (node): PhrasingStep =>
      (state) => {
        recordLoss(state, "mdxDropped", node, O.none(), node.value);
        return [];
      },
  })
);

// ---------------------------------------------------------------------------
// Flow content
// ---------------------------------------------------------------------------

type FlowStep = (state: BridgeState, path: SlotPath) => ReadonlyArray<Model.Block>;

const mapFlowChildren = (
  state: BridgeState,
  kids: ReadonlyArray<Kit.FlowContent>,
  parent: SlotPath | undefined,
  offset: number
): Array<Model.Block> => {
  const out: Array<Model.Block> = [];
  for (const kid of kids) {
    for (const block of flowStep(kid)(state, new SlotPath(parent, offset + out.length))) {
      out.push(block);
    }
  }
  return out;
};

const paragraphBlock = (
  state: BridgeState,
  kids: ReadonlyArray<Kit.PhrasingContent>,
  position: Kit.Position,
  path: SlotPath
): ReadonlyArray<Model.Block> => {
  const at = open(state, position, MdSourceOrigin.Enum.parsed);
  const children = phrasingChildren(state, kids, path);
  if (A.isArrayEmpty(children)) {
    rollback(state, at);
    return [];
  }
  close(state, at);
  return [Model.P.make({ _tag: "p", children })];
};

const mathParagraph = (state: BridgeState, node: Kit.Paragraph, path: SlotPath): O.Option<ReadonlyArray<Model.Block>> =>
  pipe(
    mathBlockBody(slice(state, node.position)),
    O.flatMap((value) => {
      if (node.position.start.column !== 1) {
        recordLoss(state, "recognizerSkipped", node, landed(path), "display math inside a container");
        return O.none();
      }
      return O.some([
        leaf(state, node.position, MdSourceOrigin.Enum.recognized, Model.MathBlock.make({ _tag: "mathBlock", value })),
      ]);
    })
  );

// A YouTube block carries only the video id, so the recognizer takes a link
// whose text is its own URL and has no title (a bare or `<…>` URL, which is
// what `Md.render` writes); a link with its own text or title stays a link
// instead of losing them.
const isBareLink = (link: Kit.Link): boolean => {
  const text = link.children.length === 1 ? link.children[0] : undefined;
  return link.title === undefined && text?.type === "text" && text.value === link.url;
};

const youtubeParagraph = (node: Kit.Paragraph, state: BridgeState): O.Option<ReadonlyArray<Model.Block>> => {
  const only = node.children.length === 1 ? node.children[0] : undefined;
  return only?.type === "link" && isBareLink(only)
    ? O.map(youtubeVideoId(only.url), (videoId) => [
        leaf(state, node.position, MdSourceOrigin.Enum.recognized, Model.YouTube.make({ _tag: "youtube", videoId })),
      ])
    : O.none();
};

const paragraphFlow =
  (node: Kit.Paragraph): FlowStep =>
  (state, path) =>
    pipe(
      state.options.math ? mathParagraph(state, node, path) : O.none(),
      O.orElse(() => (state.options.youtube ? youtubeParagraph(node, state) : O.none())),
      O.getOrElse(() => paragraphBlock(state, node.children, node.position, path))
    );

// Raw HTML in an admonition head line lands in a plain-string title, so it
// follows the inline HTML policy with one difference: the title cannot carry
// raw HTML, so only `escapeAsText` keeps the markup (as text) and `rawHtml`
// drops it like `drop` does. Comments follow `htmlComments` first.
const headHtmlKept = (state: BridgeState, value: string): boolean =>
  !(state.options.htmlComments === MdHtmlCommentPolicy.Enum.drop && isHtmlComment(value)) &&
  state.options.html === MdHtmlPolicy.Enum.escapeAsText;

const recordHeadHtml = (state: BridgeState, node: Kit.Html, path: SlotPath): void => {
  if (headHtmlKept(state, node.value)) {
    recordLoss(state, "htmlEscapedAsText", node, landed(path), node.value);
  } else {
    const comment = state.options.htmlComments === MdHtmlCommentPolicy.Enum.drop && isHtmlComment(node.value);
    recordLoss(state, "htmlDropped", node, O.none(), comment ? "comment" : node.value);
  }
};

// A hard break ends the head line, and so does a `<br>` tag under `breakTag`,
// which the inline mapping recognizes as a break before any HTML policy.
const isHeadBreak = (state: BridgeState, kid: Kit.PhrasingContent): boolean =>
  kid.type === "break" || (kid.type === "html" && state.options.breakTag && isBreakTag(kid.value));

// The literal text a leaf head-line node carries: its value, or an image's
// alt text.
const leafPlainText = (node: Kit.PhrasingContent): string =>
  "value" in node ? node.value : "alt" in node ? (node.alt ?? "") : "";

// The plain text a head-line node contributes to the title, recording a loss
// for every raw HTML node inside it. A break nested in inline markup
// contributes nothing, as a nested hard break does.
const headPlainText = (state: BridgeState, path: SlotPath, node: Kit.PhrasingContent): string => {
  if (isHeadBreak(state, node)) {
    return "";
  }
  if (node.type === "html") {
    recordHeadHtml(state, node, path);
    return headHtmlKept(state, node.value) ? node.value : "";
  }
  return "children" in node
    ? A.join(
        A.map(node.children, (child) => headPlainText(state, path, child)),
        ""
      )
    : leafPlainText(node);
};

// A head-line node flattens into the title unless it is plain text or raw
// HTML the policy drops outright.
const flattensIntoTitle = (state: BridgeState, kid: Kit.PhrasingContent): boolean =>
  kid.type === "html" ? headHtmlKept(state, kid.value) : kid.type !== "text";

class AdmonitionHead {
  readonly title: string;
  readonly flattened: boolean;
  readonly remainder: ReadonlyArray<Kit.PhrasingContent>;

  constructor(title: string, flattened: boolean, remainder: ReadonlyArray<Kit.PhrasingContent>) {
    this.title = title;
    this.flattened = flattened;
    this.remainder = remainder;
  }
}

const remainderAfter = (
  text: Kit.Text,
  after: string,
  rest: ReadonlyArray<Kit.PhrasingContent>
): ReadonlyArray<Kit.PhrasingContent> =>
  Str.isEmpty(after) ? rest : [Kit.Text.make({ value: after, position: text.position }), ...rest];

const lineText = (kid: Kit.PhrasingContent, index: number, firstLine: string): string =>
  kid.type !== "text" ? "" : index === 0 ? firstLine : kid.value;

const endsHeadLine = (state: BridgeState, kid: Kit.PhrasingContent, text: string): boolean =>
  isHeadBreak(state, kid) || (kid.type === "text" && Str.includes("\n")(text));

const splitAdmonitionHead = (
  state: BridgeState,
  path: SlotPath,
  kids: ReadonlyArray<Kit.PhrasingContent>,
  firstLine: string
): AdmonitionHead => {
  const end = O.getOrElse(
    A.findFirstIndex(kids, (kid, index) => endsHeadLine(state, kid, lineText(kid, index, firstLine))),
    () => kids.length
  );
  const head = A.take(kids, end);
  const before = A.map(head, (kid, index) =>
    kid.type === "text" ? lineText(kid, index, firstLine) : headPlainText(state, path, kid)
  );
  const flattened = A.some(head, (kid) => flattensIntoTitle(state, kid));
  const ender = kids[end];
  const rest = A.drop(kids, end + 1);
  if (ender?.type !== "text") {
    return new AdmonitionHead(A.join(before, ""), flattened, rest);
  }
  const text = lineText(ender, end, firstLine);
  const newline = O.getOrElse(Str.indexOf("\n")(text), () => Str.length(text));
  return new AdmonitionHead(
    A.join([...before, Str.slice(0, newline)(text)], ""),
    flattened,
    remainderAfter(ender, Str.slice(newline + 1)(text), rest)
  );
};

const admonitionFlow = (
  state: BridgeState,
  node: Kit.Blockquote,
  path: SlotPath
): O.Option<ReadonlyArray<Model.Block>> => {
  const first = node.children[0];
  const head = first?.type === "paragraph" ? first.children[0] : undefined;
  if (first?.type !== "paragraph" || head?.type !== "text") {
    return O.none();
  }
  return pipe(
    admonitionMarkerOf(slice(state, first.position)),
    O.filter(([, marker]) => Str.startsWith(marker)(head.value)),
    O.map(([kind, marker]) => {
      const split = splitAdmonitionHead(state, path, first.children, Str.slice(Str.length(marker))(head.value));
      if (split.flattened) {
        recordLoss(state, "admonitionTitleFlattened", first, landed(path), split.title);
      }
      const title = Str.trim(split.title);
      return [
        branch(state, node.position, MdSourceOrigin.Enum.recognized, (): Model.Admonition => {
          const children: Array<Model.Block> = [];
          if (A.isReadonlyArrayNonEmpty(split.remainder)) {
            for (const block of paragraphBlock(state, split.remainder, first.position, new SlotPath(path, 0))) {
              children.push(block);
            }
          }
          for (const block of mapFlowChildren(state, A.drop(node.children, 1), path, children.length)) {
            children.push(block);
          }
          return Model.Admonition.make({
            _tag: "admonition",
            kind,
            title: Str.isEmpty(title) ? O.none() : O.some(title),
            children,
          });
        }),
      ];
    })
  );
};

const blockquoteFlow =
  (node: Kit.Blockquote): FlowStep =>
  (state, path) =>
    pipe(
      state.options.admonitions ? admonitionFlow(state, node, path) : O.none(),
      O.getOrElse(
        (): ReadonlyArray<Model.Block> => [
          branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
            Model.BlockQuote.make({
              _tag: "blockquote",
              children: mapFlowChildren(state, node.children, path, 0),
            })
          ),
        ]
      )
    );

// CommonMark code content keeps the newline that ends its last line; Md code
// values carry content without it, and `Md.render` writes the newline back.
const codeContent = Str.replace(/\r?\n$/u, "");

const codeFlow =
  (node: Kit.Code): FlowStep =>
  (state, path) => {
    const value = codeContent(node.value);
    if (node.meta !== undefined) {
      recordLoss(state, "codeMetaDropped", node, landed(path), node.meta);
    }
    if (state.options.math && node.lang === "math") {
      return [
        leaf(state, node.position, MdSourceOrigin.Enum.recognized, Model.MathBlock.make({ _tag: "mathBlock", value })),
      ];
    }
    const language = O.fromUndefinedOr(node.lang);
    const valid = O.filter(language, S.is(CodeFenceLanguage));
    if (O.isSome(language) && O.isNone(valid)) {
      recordLoss(state, "codeLanguageDropped", node, landed(path), language.value);
    }
    return [
      leaf(state, node.position, MdSourceOrigin.Enum.parsed, Model.Pre.make({ _tag: "pre", language: valid, value })),
    ];
  };

const htmlFlow =
  (node: Kit.Html): FlowStep =>
  (state, path) => {
    if (state.options.htmlComments === MdHtmlCommentPolicy.Enum.drop && isHtmlComment(node.value)) {
      recordLoss(state, "htmlDropped", node, O.none(), "comment");
      return [];
    }
    const wrapped = (reason: MdLossReason, inline: Model.Inline): ReadonlyArray<Model.Block> => {
      recordLoss(state, reason, node, landed(path), node.value);
      return [
        branch(state, node.position, MdSourceOrigin.Enum.synthesized, () =>
          Model.P.make({
            _tag: "p",
            children: [leaf(state, node.position, MdSourceOrigin.Enum.parsed, inline)],
          })
        ),
      ];
    };
    return MdHtmlPolicy.match(state.options.html, {
      escapeAsText: () => wrapped("htmlEscapedAsText", textNode(node.value)),
      rawHtml: () => wrapped("htmlInlinedBlock", Model.RawHtml.make({ _tag: "rawHtml", value: node.value })),
      drop: (): ReadonlyArray<Model.Block> => {
        recordLoss(state, "htmlDropped", node, O.none(), node.value);
        return [];
      },
    });
  };

const listItemChildren = (
  state: BridgeState,
  item: Kit.ListItem,
  tight: boolean,
  path: SlotPath
): Array<Model.ListItemChild> => {
  const out: Array<Model.ListItemChild> = [];
  for (const kid of item.children) {
    const children =
      tight && kid.type === "paragraph"
        ? mapPhrasingChildren(state, kid.children, path, out.length)
        : flowStep(kid)(state, new SlotPath(path, out.length));
    for (const child of children) {
      out.push(child);
    }
  }
  return out;
};

const isTight = (list: Kit.List, item: Kit.ListItem): boolean => list.spread !== true && item.spread !== true;

const taskListFlow = (state: BridgeState, node: Kit.List, path: SlotPath): Model.TaskList =>
  branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
    Model.TaskList.make({
      _tag: "taskList",
      children: A.map(node.children, (item, index) => {
        const itemPath = new SlotPath(path, index);
        return branch(state, item.position, MdSourceOrigin.Enum.parsed, () =>
          Model.TaskItem.make({
            _tag: "taskItem",
            checked: item.checked === true,
            children: listItemChildren(state, item, isTight(node, item), itemPath),
          })
        );
      }),
    })
  );

const listItems = (state: BridgeState, node: Kit.List, path: SlotPath): ReadonlyArray<Model.Li> =>
  A.map(node.children, (item, index) => {
    const itemPath = new SlotPath(path, index);
    if (item.checked !== undefined) {
      recordLoss(state, "taskCheckboxDropped", item, landed(itemPath), item.checked ? "checked" : "unchecked");
    }
    return branch(state, item.position, MdSourceOrigin.Enum.parsed, () =>
      Model.Li.make({
        _tag: "li",
        children: listItemChildren(state, item, isTight(node, item), itemPath),
      })
    );
  });

const listFlow =
  (node: Kit.List): FlowStep =>
  (state, path) => {
    if (node.ordered !== true && A.every(node.children, (item) => item.checked !== undefined)) {
      return [taskListFlow(state, node, path)];
    }
    return [
      branch(
        state,
        node.position,
        MdSourceOrigin.Enum.parsed,
        (): Model.Block =>
          node.ordered === true
            ? Model.Ol.make({ _tag: "ol", start: node.start ?? 1, children: listItems(state, node, path) })
            : Model.Ul.make({ _tag: "ul", children: listItems(state, node, path) })
      ),
    ];
  };

const tableRow = (state: BridgeState, row: Kit.TableRow, path: SlotPath): Model.TableRow =>
  branch(state, row.position, MdSourceOrigin.Enum.parsed, () =>
    Model.TableRow.make({
      _tag: "tableRow",
      children: A.map(row.children, (cell, index) =>
        branch(state, cell.position, MdSourceOrigin.Enum.parsed, () =>
          Model.TableCell.make({
            _tag: "tableCell",
            children: phrasingChildren(state, cell.children, new SlotPath(path, index)),
          })
        )
      ),
    })
  );

const isEmptyRow = (row: Kit.TableRow): boolean =>
  A.every(row.children, (cell) => A.isReadonlyArrayEmpty(cell.children));

const tableFlow =
  (node: Kit.Table): FlowStep =>
  (state, path) => {
    const head = node.children[0];
    const absorb = state.options.absorbEmptyTableHeader && head !== undefined && isEmptyRow(head);
    const rows = absorb ? A.drop(node.children, 1) : node.children;
    return [
      branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
        Model.Table.make({
          _tag: "table",
          align: A.map(node.align ?? [], (align) => align ?? "none"),
          headerRow: !absorb,
          children: A.map(rows, (row, index) => tableRow(state, row, new SlotPath(path, index))),
        })
      ),
    ];
  };

const footnoteDefinitionFlow =
  (node: Kit.FootnoteDefinition): FlowStep =>
  (state, path) => {
    const identifier = state.footnotes.rewrite(node.identifier);
    if (MutableHashSet.has(state.seenFootnoteDefinitions, identifier)) {
      recordLoss(state, "footnoteDefinitionDuplicate", node, O.none(), node.identifier);
      return [];
    }
    MutableHashSet.add(state.seenFootnoteDefinitions, identifier);
    rewriteFootnote(state, node, path);
    return [
      branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
        Model.FootnoteDefinition.make({
          _tag: "footnoteDefinition",
          identifier,
          children: mapFlowChildren(state, node.children, path, 0),
        })
      ),
    ];
  };

const flowStep: (node: Kit.FlowContent) => FlowStep = Match.type<Kit.FlowContent>().pipe(
  Match.discriminatorsExhaustive("type")({
    paragraph: paragraphFlow,
    heading:
      (node): FlowStep =>
      (state, path) => [
        branch(state, node.position, MdSourceOrigin.Enum.parsed, () =>
          Model.Heading.make({
            _tag: "heading",
            level: node.depth,
            children: phrasingChildren(state, node.children, path),
          })
        ),
      ],
    thematicBreak:
      (node): FlowStep =>
      (state) => [leaf(state, node.position, MdSourceOrigin.Enum.parsed, Model.Hr.make({ _tag: "hr" }))],
    blockquote: blockquoteFlow,
    code: codeFlow,
    html: htmlFlow,
    list: listFlow,
    table: tableFlow,
    definition:
      (node): FlowStep =>
      (state) => {
        state.definitions.push(node);
        return [];
      },
    footnoteDefinition: footnoteDefinitionFlow,
    mdxJsxFlowElement:
      (node): FlowStep =>
      (state, path) => {
        recordLoss(state, "mdxElementUnwrapped", node, landed(path), node.name ?? "fragment");
        return mapFlowChildren(state, node.children, path.parent, path.index);
      },
    mdxFlowExpression:
      (node): FlowStep =>
      (state) => {
        recordLoss(state, "mdxDropped", node, O.none(), node.value);
        return [];
      },
  })
);

// ---------------------------------------------------------------------------
// Frontmatter and the document
// ---------------------------------------------------------------------------

const codecFor: (format: Kit.FrontmatterFormat) => FrontmatterCodec = Kit.FrontmatterFormat.match({
  yaml: (): FrontmatterCodec => YamlFrontmatter,
  toml: (): FrontmatterCodec => TomlFrontmatter,
  json: (): FrontmatterCodec => JsonFrontmatter,
});

const frontmatterFailure = (
  state: BridgeState,
  node: Kit.Frontmatter,
  reason: MdFrontmatterErrorReason,
  cause: unknown
): Result.Result<O.Option<S.JsonObject>, MdFrontmatterError> => {
  if (state.options.onFrontmatterFailure === MdFrontmatterFailure.Enum.fail) {
    return Result.fail(MdFrontmatterError.make({ format: node.format, reason, position: node.position, cause }));
  }
  recordLoss(
    state,
    reason === "invalid" ? "frontmatterInvalid" : "frontmatterNotObject",
    node,
    O.none(),
    `${node.format} frontmatter`
  );
  return Result.succeed(O.none());
};

const frontmatterObject = (
  state: BridgeState,
  node: Kit.Frontmatter,
  value: unknown
): Result.Result<O.Option<S.JsonObject>, MdFrontmatterError> => {
  if (P.isNullish(value)) {
    return Result.succeed(O.none());
  }
  const projection = projectJson(value);
  const object = O.filter(projection.value, isJsonObject);
  if (O.isNone(object)) {
    return frontmatterFailure(state, node, "notObject", value);
  }
  // An object emptied by projection leaves no frontmatter behind, so its
  // coercions name no destination (`mdPath` None) rather than a missing field.
  const empty = R.isEmptyReadonlyRecord(object.value);
  const landing = empty ? O.none() : frontmatterPath;
  for (const coercion of projection.coercions) {
    recordLoss(state, "frontmatterValueCoerced", node, landing, `${coercion.pointer}: ${coercion.detail}`);
  }
  if (empty) {
    return Result.succeed(O.none());
  }
  if (node.format !== "json") {
    recordLoss(state, "frontmatterFormatChanged", node, frontmatterPath, `${node.format} -> json`);
  }
  return Result.succeed(object);
};

const bridgeFrontmatter = (
  state: BridgeState,
  node: Kit.Frontmatter
): Result.Result<O.Option<S.JsonObject>, MdFrontmatterError> => {
  if (state.options.frontmatter === MdFrontmatterPolicy.Enum.drop) {
    recordLoss(state, "frontmatterDropped", node, O.none(), node.format);
    return Result.succeed(O.none());
  }
  return Result.match(codecFor(node.format).decodeResult(node), {
    onFailure: (error) => frontmatterFailure(state, node, "invalid", error),
    onSuccess: (value) => frontmatterObject(state, node, value),
  });
};

const reportUnreferencedDefinitions = (state: BridgeState): void => {
  for (const definition of state.definitions) {
    const label = normalizeLabelText(definition.identifier);
    const wins = O.exists(
      HashMap.get(state.document.definitions, label),
      (winner) => winner.position.start.offset === definition.position.start.offset
    );
    if (!wins || !MutableHashSet.has(state.referencedLabels, label)) {
      recordLoss(state, "definitionUnreferenced", definition, O.none(), definition.identifier);
    }
  }
};

const byPosition = (loss: MdLoss): number => loss.position.start.offset;

// The fold opens one slot per Md node in pre-order, so the fingerprint pass
// over the finished plain document lines up with the slots ordinal by ordinal.
const sourceEntries = (state: BridgeState, document: unknown): ReadonlyArray<MdSourceEntry> => {
  const fingerprints: Array<readonly [string, number]> = [];
  recordFingerprints(document, fingerprints);
  return A.map(state.slots, (slot, ordinal) => {
    const [tag, fingerprint] = fingerprints[ordinal] ?? ["document", 0];
    return MdSourceEntry.make({
      position: slot.position,
      descendants: slot.descendants,
      origin: slot.origin,
      tag,
      fingerprint,
    });
  });
};

const finish = (state: BridgeState, frontmatter: O.Option<S.JsonObject>, children: ReadonlyArray<Model.Block>) =>
  MdFromSyntax.make({
    document: Model.Document.make({ _tag: "document", frontmatter, children }),
    losses: A.sortWith(state.losses, byPosition, N.Order),
    sourceMap: state.options.sourceMap
      ? MdSourceMap.make({
          entries: sourceEntries(state, Model.Document.make({ _tag: "document", frontmatter, children })),
        })
      : MdSourceMap.empty,
  });

const fromMarkdownDocumentImpl = (
  document: MarkdownDocument,
  options?: MdSyntaxOptions.Encoded
): Result.Result<MdFromSyntax, MdFrontmatterError> => {
  const state = new BridgeState(document, MdSyntaxOptions.make(options ?? {}));
  let frontmatter: Result.Result<O.Option<S.JsonObject>, MdFrontmatterError> = Result.succeed(O.none());
  const flow: Array<Kit.FlowContent> = [];
  for (const child of document.root.children) {
    if (child.type === "frontmatter") {
      frontmatter = bridgeFrontmatter(state, child);
    } else if (child.type === "mdxjsEsm") {
      recordLoss(state, "mdxDropped", child, O.none(), child.value);
    } else {
      flow.push(child);
    }
  }
  return Result.map(frontmatter, (decoded) => {
    const children = branch(state, document.root.position, MdSourceOrigin.Enum.parsed, () =>
      mapFlowChildren(state, flow, undefined, 0)
    );
    reportUnreferencedDefinitions(state);
    return finish(state, decoded, children);
  });
};

/**
 * Bridge a parsed `MarkdownDocument` into an `Md.Document`, with the losses
 * and the source map.
 *
 * **Details**
 *
 * The fold is total: every syntax-tree node kind maps to Md content or to an
 * `MdLoss`, never to a silent drop. It fails only when frontmatter cannot be
 * decoded and `onFrontmatterFailure` is `"fail"`. The document is admitted
 * once, at the end. YAML and TOML frontmatter decode through
 * `@beep/markdown`'s codecs and then project into JSON; every changed value
 * is a `frontmatterValueCoerced` loss addressed by a JSON pointer.
 *
 * **Example** (Bridge with losses)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument"
 * import { fromMarkdownDocument } from "@beep/md/Md.syntax"
 * import * as Result from "effect/Result"
 *
 * const parsed = Result.getOrThrow(MarkdownDocument.parseResult("<div>note</div>"))
 * const bridged = Result.getOrThrow(fromMarkdownDocument(parsed, { sourceMap: false }))
 * console.log(bridged.losses.map((loss) => loss.reason)) // ["htmlEscapedAsText"]
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const fromMarkdownDocument: {
  (options?: MdSyntaxOptions.Encoded): (document: MarkdownDocument) => Result.Result<MdFromSyntax, MdFrontmatterError>;
  (document: MarkdownDocument, options?: MdSyntaxOptions.Encoded): Result.Result<MdFromSyntax, MdFrontmatterError>;
} = dual((args) => P.hasProperty(args[0], "root"), fromMarkdownDocumentImpl);

const unlocated = DocumentSafetyViolation.isAnyOf(["HtmlProjection", "DocumentComplexity"]);

const locateViolationsImpl = (
  result: MdFromSyntax,
  violations: ReadonlyArray<DocumentSafetyViolation>
): ReadonlyArray<MdLocatedViolation> =>
  A.map(violations, (violation) =>
    MdLocatedViolation.make({
      violation,
      position: unlocated(violation) ? O.none() : positionAt(result.sourceMap, result.document, violation.path),
    })
  );

/**
 * Pair each safety violation of a bridged document with the source position
 * of the node its path names.
 *
 * **Details**
 *
 * HTML-projection paths address the projected HTML tree and complexity
 * violations have no path, so both get `None`.
 *
 * **Example** (Locate raw HTML)
 *
 * ```ts
 * import { documentSafetyIssues } from "@beep/md/Md.safe"
 * import { parseResult } from "@beep/md/Md.parse"
 * import { locateViolations } from "@beep/md/Md.syntax"
 * import * as Result from "effect/Result"
 *
 * const bridged = Result.getOrThrow(parseResult("<div>x</div>", { html: "rawHtml" }))
 * const located = locateViolations(bridged, documentSafetyIssues(bridged.document))
 * console.log(located.length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const locateViolations: {
  (violations: ReadonlyArray<DocumentSafetyViolation>): (result: MdFromSyntax) => ReadonlyArray<MdLocatedViolation>;
  (result: MdFromSyntax, violations: ReadonlyArray<DocumentSafetyViolation>): ReadonlyArray<MdLocatedViolation>;
} = dual(2, locateViolationsImpl);

/**
 * Narrow a bridged document to a `SafeDocument`, or fail with every safety
 * violation and its source position.
 *
 * **Example** (Refine a bridged document)
 *
 * ```ts
 * import { parseResult } from "@beep/md/Md.parse"
 * import { refineSafe } from "@beep/md/Md.syntax"
 * import * as Result from "effect/Result"
 *
 * const bridged = Result.getOrThrow(parseResult("Hello"))
 * console.log(Result.isSuccess(refineSafe(bridged))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const refineSafe = (result: MdFromSyntax): Result.Result<SafeDocument, MdUnsafeDocumentError> =>
  Result.mapError(refineSafeDocument(result.document), (violations) =>
    MdUnsafeDocumentError.make({ violations, located: locateViolationsImpl(result, violations) })
  );
