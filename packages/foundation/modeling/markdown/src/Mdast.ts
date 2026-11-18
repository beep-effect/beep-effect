/**
 * The remark-ecosystem interop boundary: projection between this package's
 * node classes and plain mdast JSON. The emission conventions are documented on
 * the exported `Mdast` class.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as MutableList from "effect/MutableList";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";
import { unescapeString } from "./internal/unescape.ts";
import { FrontmatterFormat, Position, Root } from "./MarkdownNode.ts";
import type { MdxJsxAttributeContent } from "./MarkdownMdx.ts";
import type { FlowContent, Frontmatter, List, MarkdownNode, PhrasingContent } from "./MarkdownNode.ts";

const $I = $MarkdownId.create("Mdast");

const MdastTag = S.Struct({
  type: S.String.pipe($I.annoteKey("MdastNode.type", { description: "The mdast node type tag" })),
});

/**
 * A plain mdast node: a `type` tag plus whatever fields that type carries.
 *
 * **Details**
 *
 * Deliberately loose — plain-object mdast is a foreign, structurally-typed
 * contract; the precise shapes live in the mdast specification, and
 * {@link Mdast.fromMdast} is the checked way back into typed nodes.
 *
 * **Example** (Validate a plain mdast node)
 *
 * ```ts
 * import { MdastNode } from "@beep/markdown/Mdast";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MdastNode)({ type: "text", value: "hi" })) // true
 * console.log(S.is(MdastNode)({ value: "hi" })) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MdastNode = S.StructWithRest(MdastTag, [S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("MdastNode", {
    description: "A plain mdast node: a `type` tag plus whatever fields that type carries.",
  })
);

/**
 * The plain mdast node shape.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MdastNode = typeof MdastNode.Type;

/**
 * Indicates that foreign mdast input failed to decode into the package's
 * node classes.
 *
 * **Details**
 *
 * `issue` carries the **structured** schema failure — at runtime a
 * `SchemaIssue.Issue` tree, reachable through `_tag` and nested `issues` —
 * never a stringified rendering. It is typed `unknown` because core exposes
 * no `Schema` for `Issue`; narrow it with the `SchemaIssue` module.
 *
 * **Example** (Inspect a decode error message)
 *
 * ```ts
 * import { MdastDecodeError } from "@beep/markdown/Mdast"
 *
 * const error = MdastDecodeError.make({ issue: { _tag: "InvalidType" } })
 * console.log(error.message) // mdast input failed to decode into markdown nodes
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class MdastDecodeError extends S.TaggedError<MdastDecodeError, { readonly brand: unique symbol }>(
  $I`MdastDecodeError`
)(
  "MdastDecodeError",
  {
    /** The structured schema issue. Never a string. */
    issue: S.Defect().pipe(
      $I.annoteKey("MdastDecodeError.issue", { description: "The structured schema issue. Never a string." })
    ),
  },
  $I.annoteError<MdastDecodeError>("MdastDecodeError", {
    description: "Indicates that foreign mdast input failed to decode into the package's node classes.",
  })
) {
  /**
   * Provides a stable summary while the structured failure remains available in `issue`.
   *
   * **Example** (Read the stable failure summary)
   *
   * ```ts
   * import { MdastDecodeError } from "@beep/markdown/Mdast"
   *
   * const error = MdastDecodeError.make({ issue: { _tag: "InvalidType" } })
   * console.log(error.message) // mdast input failed to decode into markdown nodes
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  override get message(): string {
    return "mdast input failed to decode into markdown nodes";
  }
}

/** The zero-width sentinel position synthesized for foreign nodes. */
const sentinelPosition = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

const projectPosition = (position: Position): Record<string, unknown> => ({
  start: { line: position.start.line, column: position.start.column, offset: position.start.offset },
  end: { line: position.end.line, column: position.end.column, offset: position.end.offset },
});

type AnyNode = Root | Frontmatter | FlowContent | PhrasingContent | MarkdownNode;

const projectChildren = (children: ReadonlyArray<AnyNode>): Array<Record<string, unknown>> =>
  A.map(children, (child) => projectNode(child));

// This package's Code.value carries its final line terminator (the engine's
// convention); mdast-util-from-markdown stores the value
// without it and lets renderers re-add it. The projection translates: strip
// one carried LF going out, restore it coming back in. A preceding CR is
// content and must survive both projection and stringify.
const stripFinalLineEnding = (value: string): string => (Str.endsWith("\n")(value) ? Str.slice(0, -1)(value) : value);

// mdast's Association rules that `label` is a *parsed* value — character
// escapes and character references decoded — while this package's nodes keep
// the label as written in source (the stringify layer depends on that). The
// projection decodes at the boundary; identifiers stay source-form per the
// same mixin.
const projectLabel = (label: string | undefined): Record<string, unknown> =>
  label === undefined ? {} : { label: unescapeString(label) };

// mdast's List.spread means "a blank line separates two of the list's
// items" — narrower than this package's List.spread fidelity field, which
// records CommonMark looseness (a blank line between items OR between the
// blocks inside one item; the rendering contract). The between-items reading
// is recomputable from item positions, so the projection derives it instead
// of forwarding the looseness bit. Synthetic item positions cannot encode
// those gaps, so foreign positionless lists keep their admitted spread bit.
const equivalentPosition = S.toEquivalence(Position);
const listSpread = (node: List): boolean => {
  const positioned = A.filter(node.children, (item) => !equivalentPosition(item.position, Position.synthetic));
  // A fully positioned singleton still has no between-item gap, even when
  // its internal blocks make it loose. Only missing positions need fallback.
  if (positioned.length === 0 || (positioned.length < 2 && positioned.length < node.children.length)) {
    return node.spread ?? false;
  }
  for (const [current, next] of A.zip(positioned, A.drop(positioned, 1))) {
    if (next.position.start.line - current.position.end.line >= 2) {
      return true;
    }
  }
  return false;
};

// One arm per node type. Field order mirrors mdast-util-from-markdown's
// emission for readability of test diffs; deep equality does not depend on it.
const projectNode: (node: AnyNode) => MdastNode = Match.type<AnyNode>()
  .pipe(
    Match.discriminator("type")("root", (node) => ({
      type: "root",
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")(
      "paragraph",
      "blockquote",
      "emphasis",
      "strong",
      "delete",
      "tableRow",
      "tableCell",
      (node) => ({
        type: node.type,
        children: projectChildren(node.children),
        position: projectPosition(node.position),
      })
    ),
    Match.discriminator("type")("heading", (node) => ({
      type: "heading",
      depth: node.depth,
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("text", (node) => ({
      type: "text",
      value: node.value,
      ...O.getSomesStruct({ escapeStyle: O.fromUndefinedOr(node.escapeStyle) }),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("html", "inlineCode", (node) => ({
      type: node.type,
      value: node.value,
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("break", "thematicBreak", (node) => ({
      type: node.type,
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("code", (node) => ({
      type: "code",
      lang: node.lang ?? null,
      meta: node.meta ?? null,
      value: stripFinalLineEnding(node.value),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("link", (node) => ({
      type: "link",
      title: node.title ?? null,
      url: node.url,
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("image", (node) => ({
      type: "image",
      title: node.title ?? null,
      url: node.url,
      alt: node.alt ?? "",
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("linkReference", (node) => ({
      type: "linkReference",
      children: projectChildren(node.children),
      position: projectPosition(node.position),
      ...projectLabel(node.label),
      identifier: node.identifier,
      referenceType: node.referenceType,
    }))
  )
  .pipe(
    Match.discriminator("type")("imageReference", (node) => ({
      type: "imageReference",
      alt: node.alt ?? "",
      position: projectPosition(node.position),
      ...projectLabel(node.label),
      identifier: node.identifier,
      referenceType: node.referenceType,
    })),
    Match.discriminator("type")("definition", (node) => ({
      type: "definition",
      identifier: node.identifier,
      ...projectLabel(node.label),
      title: node.title ?? null,
      url: node.url,
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("footnoteReference", (node) => ({
      type: "footnoteReference",
      identifier: node.identifier,
      ...projectLabel(node.label),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("footnoteDefinition", (node) => ({
      type: "footnoteDefinition",
      identifier: node.identifier,
      ...projectLabel(node.label),
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("list", (node) => ({
      type: "list",
      ordered: node.ordered ?? false,
      start: node.start ?? null,
      spread: listSpread(node),
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("listItem", (node) => ({
      type: "listItem",
      spread: node.spread ?? false,
      checked: node.checked ?? null,
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("table", (node) => ({
      type: "table",
      align: node.align === undefined ? null : [...node.align],
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("frontmatter", (node) => ({
      type: node.format,
      value: node.value,
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("mdxJsxFlowElement", "mdxJsxTextElement", (node) => ({
      type: node.type,
      name: node.name,
      attributes: A.map(node.attributes, (attribute) => projectMdxAttribute(attribute)),
      children: projectChildren(node.children),
      position: projectPosition(node.position),
    })),
    Match.discriminator("type")("mdxFlowExpression", "mdxTextExpression", "mdxjsEsm", (node) => ({
      type: node.type,
      value: node.value,
      position: projectPosition(node.position),
    })),
    Match.exhaustive
  );

// mdast-util-mdx spells a bare attribute's value as explicit `null` (its
// parser writes it, "as it serializes in JSON"), and puts NO position on an
// attribute value expression — both mirrored here so the output deep-equals
// the reference utilities' trees.
const projectMdxAttribute = (attribute: MdxJsxAttributeContent): Record<string, unknown> => {
  if (attribute.type === "mdxJsxExpressionAttribute") {
    return {
      type: "mdxJsxExpressionAttribute",
      value: attribute.value,
      position: projectPosition(attribute.position),
    };
  }
  const value = attribute.value;
  return {
    type: "mdxJsxAttribute",
    name: attribute.name,
    value:
      value === undefined || value === null
        ? null
        : P.isString(value)
          ? value
          : { type: "mdxJsxAttributeValueExpression", value: value.value },
    position: projectPosition(attribute.position),
  };
};

/** Membership follows the format schema rather than a second vocabulary. */
const isFrontmatterFormat = S.is(FrontmatterFormat);

/**
 * Fields admitted per foreign node type, beyond `type`/`position`/`children`.
 * Unknown fields (`data`, custom extensions) are dropped at the boundary;
 * `null` values on optional fields normalize to absence per unist's
 * null-equals-absent convention.
 */
const admittedFields: Readonly<Record<string, ReadonlyArray<string>>> = {
  root: [],
  paragraph: [],
  blockquote: [],
  emphasis: [],
  strong: [],
  delete: [],
  tableRow: [],
  tableCell: [],
  break: [],
  thematicBreak: [],
  // `escapeStyle` is this package's emitter instruction, not spec mdast,
  // but it is the one extra a plain tree must be able to carry in: a
  // consumer building mdast for `Markdown.stringify` has no decoded node to
  // set it on until after admission.
  text: ["value", "escapeStyle"],
  html: ["value"],
  inlineCode: ["value"],
  heading: ["depth"],
  code: ["value", "lang", "meta"],
  link: ["url", "title"],
  image: ["url", "title", "alt"],
  linkReference: ["identifier", "label", "referenceType"],
  imageReference: ["identifier", "label", "referenceType", "alt"],
  definition: ["identifier", "label", "url", "title"],
  footnoteReference: ["identifier", "label"],
  footnoteDefinition: ["identifier", "label"],
  list: ["ordered", "start", "spread"],
  listItem: ["spread", "checked"],
  table: ["align"],
  mdxFlowExpression: ["value"],
  mdxTextExpression: ["value"],
  mdxjsEsm: ["value"],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value);

const completePoint = (
  value: unknown
): value is { readonly line: number; readonly column: number; readonly offset: number } =>
  isRecord(value) && P.isNumber(value.line) && P.isNumber(value.column) && P.isNumber(value.offset);

const normalizePosition = (value: unknown): Record<string, unknown> => {
  if (isRecord(value) && completePoint(value.start) && completePoint(value.end)) {
    const start = value.start;
    const end = value.end;
    return {
      start: { line: start.line, column: start.column, offset: start.offset },
      end: { line: end.line, column: end.column, offset: end.offset },
    };
  }
  return sentinelPosition;
};

// Root depth is zero. This admission budget protects both recursive
// normalization and Schema decoding; it is deliberately independent of the
// visitor's 256-level traversal guard, so deeper foreign trees remain usable.
const maxForeignTreeDepth = 512;

/** One pending admission step: a foreign value, its depth and its ancestor chain. */
type AdmissionFrame = readonly [unknown, number, ReadonlyArray<object>];

const depthLimitExceeded = (depth: number): MdastDecodeError =>
  MdastDecodeError.make({
    issue: new SchemaIssue.InvalidValue(
      { message: `Foreign mdast depth exceeds the admission limit of ${maxForeignTreeDepth}.` },
      { depth, maxDepth: maxForeignTreeDepth },
      { reportInput: true }
    ),
  });

const isJsxElementType = (type: string): boolean => type === "mdxJsxFlowElement" || type === "mdxJsxTextElement";

// Follow exactly the child edges normalization recurses into. Literal
// frontmatter and unknown kinds are shallow admissions; their foreign
// extension fields cannot increase the normalized tree's depth.
const followsChildren = (type: string): boolean =>
  !isFrontmatterFormat(type) && (R.has(admittedFields, type) || isJsxElementType(type));

/** Check one frame, queueing its children; `Some` carries the failure that ends admission. */
const admitFrame = (
  frame: AdmissionFrame,
  pending: MutableList.MutableList<AdmissionFrame>
): O.Option<MdastDecodeError> => {
  const [value, depth, ancestors] = frame;
  if (depth > maxForeignTreeDepth) {
    return O.some(depthLimitExceeded(depth));
  }
  if (!isRecord(value) || !P.isString(value.type)) {
    return O.none();
  }
  if (A.some(ancestors, (ancestor) => ancestor === value)) {
    return MdastDecodeError.makeOption({
      issue: new SchemaIssue.InvalidValue({ message: "A foreign mdast node cannot contain an ancestor as a child." }),
    });
  }
  if (followsChildren(value.type) && A.isArray(value.children)) {
    const stack = A.append(ancestors, value);
    MutableList.prependAll(
      pending,
      A.map(value.children, (child): AdmissionFrame => [child, depth + 1, stack])
    );
  }
  return O.none();
};

const admitForeignTree = (input: unknown): Result.Result<unknown, MdastDecodeError> => {
  const pending = MutableList.make<AdmissionFrame>();
  MutableList.append(pending, [input, 0, []]);
  for (let frame = MutableList.take(pending); frame !== MutableList.Empty; frame = MutableList.take(pending)) {
    const failure = admitFrame(frame, pending);
    if (O.isSome(failure)) {
      return Result.fail(failure.value);
    }
  }
  return Result.succeed(input);
};

const normalizeChildren = (children: unknown): Result.Result<unknown, MdastDecodeError> =>
  A.isArray(children) ? Result.all(A.map(children, normalizeNode)) : Result.succeed(children);

// Association labels arrive decoded; shield literal escapes and entities
// before storing the source spelling consumed once by projectLabel.
const admitField = (field: string, raw: unknown): unknown =>
  field === "label" && P.isString(raw) ? Str.replaceAll(/[\\&]/g, "\\$&")(raw) : raw;

// The whitelisted fields of one node, dropping nulls on optional ones.
const admittedEntries = (value: Record<string, unknown>, admitted: ReadonlyArray<string>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};
  for (const field of admitted) {
    const raw = value[field];
    if (raw !== undefined && raw !== null) {
      normalized[field] = admitField(field, raw);
    }
  }
  return normalized;
};

// Restore the engine's carried-terminator convention on code values (the
// inverse of toMdast's strip).
const restoreCodeTerminator = (type: string, value: unknown): unknown =>
  type === "code" && P.isString(value) && value !== "" ? `${value}\n` : value;

const normalizeAdmitted = (
  type: string,
  value: Record<string, unknown>,
  admitted: ReadonlyArray<string>
): Result.Result<unknown, MdastDecodeError> => {
  const fields = admittedEntries(value, admitted);
  const withValue = R.has(fields, "value") ? { ...fields, value: restoreCodeTerminator(type, fields.value) } : fields;
  const position = normalizePosition(value.position);
  return A.isArray(value.children)
    ? Result.map(normalizeChildren(value.children), (children) => ({ type, ...withValue, children, position }))
    : Result.succeed({ type, ...withValue, position });
};

// The JSX elements need their own admission: a `null` name is meaningful
// (a fragment) so the null-equals-absent normalization must not touch it,
// and the attributes array carries nested attribute nodes whose positions
// (and value-expression positions) need the same sentinel synthesis as
// tree nodes. `data.estree` is dropped like every foreign `data` field.
// `name`, `attributes` and `children` pass through verbatim when they do
// not match the oracle contract (`string | null`, an array, an array) —
// a number name, an `attributes: {}`, a string `children` all reach the
// schema and fail the decode typed rather than being coerced and
// silently losing input, like every other malformed recognized field.
const normalizeJsxElement = (type: string, value: Record<string, unknown>): Result.Result<unknown, MdastDecodeError> =>
  Result.map(normalizeChildren(value.children), (children) => ({
    type,
    name: value.name,
    attributes: A.isArray(value.attributes) ? A.map(value.attributes, normalizeMdxAttribute) : value.attributes,
    children,
    position: normalizePosition(value.position),
  }));

// Normalize one foreign node: admit whitelisted fields (dropping nulls on
// optional ones), synthesize sentinel positions, map frontmatter literal
// types onto the Frontmatter capture shape, and recurse into children.
// Unrecognized types pass through shallowly so schema decoding reports them
// as typed failures rather than this walk throwing.
const normalizeNode = (value: unknown): Result.Result<unknown, MdastDecodeError> => {
  if (!isRecord(value) || !P.isString(value.type)) {
    return Result.succeed(value);
  }
  const type = value.type;
  if (isFrontmatterFormat(type)) {
    return Result.succeed({
      type: "frontmatter",
      format: type,
      value: value.value,
      position: normalizePosition(value.position),
    });
  }
  if (isJsxElementType(type)) {
    return normalizeJsxElement(type, value);
  }
  return O.match(R.get(admittedFields, type), {
    onNone: () => Result.succeed(value),
    onSome: (admitted) => normalizeAdmitted(type, value, admitted),
  });
};

// A value-expression attribute value rebuilt with only its contract fields;
// a string or null value passes through (both spellings are the contract).
const normalizeAttributeValue = (raw: unknown): unknown =>
  isRecord(raw) && raw.type === "mdxJsxAttributeValueExpression"
    ? { type: "mdxJsxAttributeValueExpression", value: raw.value, position: normalizePosition(raw.position) }
    : raw;

// One foreign JSX attribute node: positions synthesized like tree nodes.
const normalizeMdxAttribute = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }
  if (value.type === "mdxJsxExpressionAttribute") {
    return { type: "mdxJsxExpressionAttribute", value: value.value, position: normalizePosition(value.position) };
  }
  if (value.type !== "mdxJsxAttribute") {
    return value;
  }
  return {
    type: "mdxJsxAttribute",
    name: value.name,
    position: normalizePosition(value.position),
    ...(value.value === undefined ? {} : { value: normalizeAttributeValue(value.value) }),
  };
};

const decodeRoot = S.decodeUnknownResult(Root);

/**
 * Projects parsed markdown trees to plain mdast JSON and admits foreign mdast
 * back into this package's node classes, for interop with the remark
 * ecosystem.
 *
 * **Details**
 *
 * `Mdast.toMdast` projects a parsed {@link Root} to plain spec-valid mdast
 * objects — fidelity extras stripped, optional fields spelled the way
 * `mdast-util-from-markdown@2.0.3` spells them (explicit `null`/`false` where
 * the reference utility emits them), so the output deep-equals what the
 * remark ecosystem produces and consumes: `list.ordered`/`start`/`spread` and
 * `listItem.spread`/`checked` are always explicit (`null` for unknown
 * `start`/`checked`), `code.lang`/`meta` and every `title` are explicit
 * `null` when absent, and `image.alt`/`imageReference.alt` are always
 * strings. Under unist's null-equals-absent convention for optional fields
 * this stays spec-valid mdast. GFM shapes follow the same convention from
 * `mdast-util-gfm`; the frontmatter capture projects to mdast's `yaml`/`toml`
 * literal nodes, and a `json` capture projects to a `json`-typed literal node
 * per the `mdast-util-frontmatter` custom-preset convention (presets name the
 * node type after the language).
 *
 * `Mdast.fromMdast` admits foreign plain mdast back into the package's Schema
 * node classes, synthesizing zero-width sentinel positions where unist leaves
 * them optional.
 *
 * **Example** (Round-trip a markdown tree through plain mdast)
 *
 * ```ts
 * import { Markdown } from "@beep/markdown/Markdown";
 * import { Mdast } from "@beep/markdown/Mdast";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const root = yield* Markdown.parse("# Hello\n");
 *   const plain = Mdast.toMdast(root); // plain mdast JSON
 *   return yield* Mdast.fromMdast(plain); // back to node classes
 * });
 * console.log(Effect.runSync(program).type) // root
 * ```
 *
 * @public
 * @category interop
 * @since 0.0.0
 */
export class Mdast {
  /**
   * Project a parsed {@link Root} to plain mdast JSON.
   *
   * **Details**
   *
   * Total and pure: every tree the parser or {@link Mdast.fromMdast}
   * produces projects without failure. Fidelity extras are stripped;
   * optional mdast fields are spelled the way `mdast-util-from-markdown`
   * spells them, so the output deep-equals the reference utility's trees
   * (the vendored interop corpus pins this). The frontmatter capture
   * projects to a `yaml`/`toml`/`json` literal node.
   *
   * **Example** (Project a positionless foreign root)
   *
   * ```ts
   * import { Mdast } from "@beep/markdown/Mdast"
   * import * as Effect from "effect/Effect"
   *
   * const root = Effect.runSync(Mdast.fromMdast({ type: "root", children: [] }))
   * console.log(Mdast.toMdast(root).type) // root
   * ```
   *
   * @param root - The parsed document tree.
   * @returns A plain mdast `root` object with unist positions.
   * @category interop
   * @since 0.0.0
   */
  static toMdast(root: Root): MdastNode {
    return projectNode(root);
  }

  /**
   * Decode foreign plain mdast into the package's node classes,
   * synchronously, as a `Result`. The pure primitive twin of
   * {@link Mdast.fromMdast}.
   *
   * **Gotchas**
   *
   * unist makes positions optional and this package's classes require
   * them, so missing or incomplete positions are synthesized as the
   * zero-width sentinel (line 1, column 1, offset 0) — clearly synthetic
   * and inert for rendering. Trees carrying sentinel positions serve
   * tree-level workflows (stringify, the visitor, projection back out),
   * not offset-splice editing, whose offsets must come from a real parse.
   * `null` values on optional fields normalize to absence per unist's
   * null-equals-absent convention; foreign `data` and other unrecognized
   * fields are dropped at the boundary; `yaml`/`toml`/`json` literal nodes
   * decode into the {@link Frontmatter} capture. Unknown node types fail
   * typed.
   *
   * Admission first checks child edges iteratively, rejecting ancestor cycles
   * and depths above 512 (root depth 0) with a structured
   * `SchemaIssue.InvalidValue` in {@link MdastDecodeError}, before recursive
   * normalization or schema decoding. Shared acyclic subtrees are accepted.
   * This stack-safety budget is separate from the visitor's 256-level guard;
   * foreign trees beyond that traversal limit can still decode successfully.
   *
   * **This package's fidelity fields are among the fields dropped**, because
   * they are not spec mdast. A `fenceChar`, `headingStyle`, `markerChar` or
   * `delimiter` set on the tree BEFORE admission is silently discarded, and
   * the node then serializes with the canonical default — set them on the
   * decoded nodes this returns instead. The drop is correct (the boundary
   * admits spec mdast and nothing else) but it is silent, which is why it is
   * called out here.
   *
   * **One exception: `escapeStyle` on a `text` node is admitted.** It
   * records no source spelling; it is the caller's instruction to the
   * emitter (`"literal"` writes the value verbatim, see {@link Text}), so a
   * plain tree built for `Markdown.stringify` can carry it straight in. A
   * value outside `"canonical" | "literal"` fails the decode typed.
   *
   * **Example** (Reject an unknown node type)
   *
   * ```ts
   * import { Mdast } from "@beep/markdown/Mdast"
   * import * as Result from "effect/Result"
   *
   * const decoded = Mdast.fromMdastResult({ type: "unknown" })
   * console.log(Result.isFailure(decoded)) // true
   * ```
   *
   * @param input - A plain mdast tree, typically a `root`.
   * @returns A `Result` succeeding with the decoded {@link Root}, or
   *   failing with {@link MdastDecodeError} carrying the structured issue.
   * @category decoding
   * @since 0.0.0
   */
  static fromMdastResult(input: unknown): Result.Result<Root, MdastDecodeError> {
    return Result.flatMap(Result.flatMap(admitForeignTree(input), normalizeNode), (normalized) =>
      Result.mapError(decodeRoot(normalized), (error) => MdastDecodeError.make({ issue: error.issue }))
    );
  }

  /**
   * Decode foreign plain mdast into the package's node classes. Defined in
   * terms of {@link Mdast.fromMdastResult} — synchronous callers can use
   * that variant directly.
   *
   * **Example** (Admit a root with synthetic positions)
   *
   * ```ts
   * import { Mdast } from "@beep/markdown/Mdast"
   * import * as Effect from "effect/Effect"
   *
   * const root = Effect.runSync(Mdast.fromMdast({ type: "root", children: [] }))
   * console.log(root.position.start.offset) // 0
   * ```
   *
   * @param input - A plain mdast tree, typically a `root`.
   * @returns An `Effect` that succeeds with the decoded {@link Root}, or
   *   fails with {@link MdastDecodeError}.
   * @category decoding
   * @since 0.0.0
   */
  static readonly fromMdast = Effect.fn("Mdast.fromMdast")((input: unknown) =>
    Effect.fromResult(Mdast.fromMdastResult(input))
  );
}
