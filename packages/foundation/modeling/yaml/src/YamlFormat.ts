/**
 * The formatting/modification concept: computing non-mutating edits that
 * reformat a document or change a value at a path, via the library's
 * parse → transform AST → stringify → diff pipeline.
 *
 * **Details**
 *
 * Cycle firewall: this module drives the internal engine directly
 * (`composeFirstDocumentCounted`, `stringifyDocument`) exactly as `Yaml.ts`
 * does; nothing imports `YamlFormat.ts` back.
 *
 * `format` builds its output AST from composer-bounded parsed nodes.
 * `modify`'s `jsValueToNode` rejects circular references and excessive
 * replacement depth while lowering the caller's value. The document and
 * replacement can still exceed the depth cap together, so `modify` also
 * translates `StringifyDepthExceeded` from its final stringify into a typed
 * `NestingDepthExceeded` diagnostic. Unexpected stringifier failures,
 * including `StringifyFailure`, remain defects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { composeAllDocuments, composeFirstDocumentCounted } from "./internal/composer/document.ts";
import { MAX_NESTING_DEPTH } from "./internal/composer/state.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import { computeEdits } from "./internal/diff.ts";
import { ParseOptionsInput, StringifyOptionsInput } from "./internal/options.ts";
import { RawYamlDocument } from "./internal/raw-document.ts";
import { requoteScalarText } from "./internal/requote.ts";
import {
  fallbackQuoteStyle,
  renderDoubleQuoted,
  renderSingleQuoted,
  StringifyDepthExceeded,
  stringifyDocument,
  stringifyValue,
  stripNodeComments,
} from "./internal/stringifier.ts";
import { YamlStringifyOptions } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import { YamlEdit, YamlRange } from "./YamlEdit.ts";
import { YamlMap, YamlPair, YamlScalar, YamlSeq } from "./YamlNode.ts";
import type { RawDiagnostic } from "./internal/diagnostics.ts";
import type { YamlPath } from "./YamlEdit.ts";
import type { QuoteStyle, YamlNode } from "./YamlNode.ts";

const $I = $YamlId.create("YamlFormat");

const isYamlScalar = S.is(YamlScalar);
const isYamlMap = S.is(YamlMap);
const isYamlSeq = S.is(YamlSeq);
const isFiniteIndex = S.is(S.Finite);
const isStringifyDepthExceeded = S.is(StringifyDepthExceeded);

/** A defect raised when a YAML helper invariant is violated. */
class YamlFormatInvariantFailure extends S.TaggedError<YamlFormatInvariantFailure, { readonly brand: unique symbol }>(
  $I`YamlFormatInvariantFailure`
)(
  "YamlFormatInvariantFailure",
  {
    message: S.String.pipe(
      $I.annoteKey("YamlFormatInvariantFailure.message", {
        description: "The failed invariant encountered while navigating the YAML tree.",
      })
    ),
  },
  $I.annoteError<YamlFormatInvariantFailure>("YamlFormatInvariantFailure", {
    description: "A defect raised when YAML modification encounters an inconsistent internal tree.",
  })
) {}

/**
 * A range accepted at the `format`/`formatToString`/etc. call sites: either a
 * {@link YamlRange} instance or a plain `{ offset, length }` literal (the two
 * are structurally interchangeable — only `offset`/`length` are read).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlRangeLike = YamlRange | { readonly offset: number; readonly length: number };

/**
 * Options controlling formatting behavior: every {@link YamlStringifyOptions}
 * field (derived, not hand-duplicated — including `indentSequences`,
 * `quoteStyle` and `quoteCompat`) plus
 * `preserveComments` (default `true`), `range` (restrict edits to a
 * region; the positional `range` argument of {@link YamlFormat.format} takes
 * precedence over this field) and `requoteScalars` (default `false`).
 *
 * **Details**
 *
 * `requoteScalars` makes `quoteStyle` apply to scalars **already quoted in
 * the source** on the format path — by default formatting preserves an
 * existing scalar's own quote style, and `quoteStyle` governs only quotes the
 * stringifier introduces. When enabled, a re-quote happens only when it
 * provably preserves the parsed value: single→double applies proper
 * double-quote escaping, double→single is skipped whenever the value carries
 * characters single quotes cannot express (newlines, tabs, control and other
 * non-printable characters — single-quoted style can escape nothing but
 * `'`). Under `quoteStyle` `"auto"` the target quote is chosen per scalar
 * from its value, the same way the stringifier chooses it. Plain scalars
 * stay plain, block scalars stay block, and scalars
 * carrying a tag or anchor — or spanning multiple source lines — are left
 * untouched. The option exists only where a source quote exists to re-quote:
 * it is read by {@link YamlFormat.format} / {@link YamlFormat.formatToString}
 * and is deliberately absent from `Yaml.stringify` (which serializes plain
 * values) and {@link YamlFormat.modify} (which takes a bare
 * {@link YamlStringifyOptions}).
 *
 * Construct with the validated `YamlFormattingOptions.make({ ... })` static —
 * the kit convention (never `new`). Call sites that take a
 * `YamlFormattingOptions` also accept a structurally-matching plain literal.
 *
 * **Example** (Format a mapping with indented sequence items)
 *
 * ```ts
 * import { YamlFormat, YamlFormattingOptions } from "@beep/yaml/YamlFormat";
 *
 * const options = YamlFormattingOptions.make({ indentSequences: true });
 * const formatted = YamlFormat.formatToString("key:\n- a\n- b\n", undefined, options);
 * console.log(JSON.stringify(formatted)) // "key:\n  - a\n  - b\n"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class YamlFormattingOptions extends S.Opaque<YamlFormattingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...YamlStringifyOptions.fields,
    preserveComments: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlFormattingOptions.preserveComments", {
        description: "Whether formatting retains node and document comments; defaults to true",
      })
    ),
    range: S.optionalKey(YamlRange).pipe(
      $I.annoteKey("YamlFormattingOptions.range", {
        description:
          "Source region in UTF-16 code units containing permitted formatting edits; a positional range takes precedence",
      })
    ),
    requoteScalars: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlFormattingOptions.requoteScalars", {
        description:
          "Whether formatting applies `quoteStyle` to eligible already-quoted scalars when their parsed values remain unchanged; defaults to false",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlFormattingOptions", {
      description:
        "Options controlling formatting behavior: every YamlStringifyOptions field (derived, not hand-duplicated — including `indentSequences`, `quoteStyle` and `quoteCompat`) plus `preserveComments` (default `true`), `range` (restrict edits to a region; the positional `range` argument of YamlFormat.format takes precedence over this field) and `requoteScalars` (default `false`).",
    })
  )
) {}

const NonFiniteIndexKind = LiteralKit(["NaN", "PositiveInfinity", "NegativeInfinity"]).pipe(
  $I.annoteSchema("NonFiniteIndexKind", {
    description: "Distinguishes non-finite numeric indices without admitting non-finite schema numbers.",
  })
);

/** A schema-safe echo of a non-finite path segment; navigation still receives the original number. */
class NonFiniteIndex extends S.TaggedClass<NonFiniteIndex, { readonly brand: unique symbol }>($I`NonFiniteIndex`)(
  "NonFiniteIndex",
  {
    kind: NonFiniteIndexKind.pipe(
      $I.annoteKey("NonFiniteIndex.kind", { description: "The original non-finite numeric index's IEEE kind" })
    ),
  },
  $I.annote("NonFiniteIndex", {
    description: "Tagged representation of NaN or signed infinity in a failed modification's echoed path.",
  })
) {
  override toString(): string {
    return NonFiniteIndexKind.match(this.kind, {
      NaN: () => "NaN",
      PositiveInfinity: () => "Infinity",
      NegativeInfinity: () => "-Infinity",
    });
  }
}

const nonFiniteIndexKind = Match.type<number>().pipe(
  Match.when(Number.POSITIVE_INFINITY, () => NonFiniteIndexKind.Enum.PositiveInfinity),
  Match.when(Number.NEGATIVE_INFINITY, () => NonFiniteIndexKind.Enum.NegativeInfinity),
  Match.orElse(() => NonFiniteIndexKind.Enum.NaN)
);

/** Normalize only failure payloads, preserving the caller's path and navigation semantics. */
const echoErrorPath = (path: YamlPath) =>
  A.map(path, (segment) =>
    P.isNumber(segment) && !isFiniteIndex(segment)
      ? NonFiniteIndex.make({ kind: nonFiniteIndexKind(segment) })
      : segment
  );

/**
 * Raised when `YamlFormat.modify` cannot navigate the requested path against
 * the composed AST (a structural mismatch), the source fails to parse, the
 * source is a multi-document stream (`MultiDocumentStream` — a path names no
 * particular document of a stream, so modify refuses rather than guessing),
 * or the document carries `%YAML`/`%TAG` directives
 * (`DirectiveCarryingDocument` — modify does not re-emit directive lines, and
 * dropping a `%TAG` would orphan the shorthand tags that depend on it).
 *
 * **Details**
 *
 * Carries structured {@link YamlDiagnostic} entries — never a collapsed
 * `reason` string (the structure-preserving-errors house rule). The error
 * itself has no `code` field: read the code from the diagnostics —
 * `error.diagnostics[0].code` is the primary failure.
 *
 * **Example** (Inspect a structured modification failure)
 *
 * ```ts
 * import { YamlModificationError } from "@beep/yaml/YamlFormat";
 * import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic";
 *
 * const error = YamlModificationError.make({
 *   path: ["port"],
 *   diagnostics: [YamlDiagnostic.fromRaw({
 *     code: "PathNotFound", message: "Missing port", offset: 0, length: 0,
 *   }, "")],
 * });
 * console.log(error.message) // Modification failed at path [port]: Missing port
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class YamlModificationError extends S.TaggedError<YamlModificationError, { readonly brand: unique symbol }>(
  $I`YamlModificationError`
)(
  "YamlModificationError",
  {
    path: S.Array(S.Union([S.String, S.Finite, NonFiniteIndex])).pipe(
      $I.annoteKey("YamlModificationError.path", {
        description:
          "Requested modification location, expressed as mapping keys, finite sequence indices, or tagged non-finite indices",
      })
    ),
    diagnostics: S.Array(YamlDiagnostic).pipe(
      $I.annoteKey("YamlModificationError.diagnostics", {
        description:
          "Structured failure details explaining why modification failed; the first diagnostic identifies the primary failure",
      })
    ),
  },
  $I.annoteError<YamlModificationError>("YamlModificationError", {
    description:
      "Raised when `YamlFormat.modify` cannot navigate the requested path against the composed AST (a structural mismatch), the source fails to parse, the source is a multi-document stream (`MultiDocumentStream` — a path names no particular document of a stream, so modify refuses rather than guessing), or the document carries `%YAML`/`%TAG` directives (`DirectiveCarryingDocument` — modify does not re-emit directive lines, and dropping a `%TAG` would orphan the shorthand tags that depend on it). Carries structured YamlDiagnostic entries — never a collapsed `reason` string (the structure-preserving-errors house rule). The error itself has no `code` field: read the code from the diagnostics — `error.diagnostics[0].code` is the primary failure.",
  })
) {
  /**
   * Summarizes the requested path and all diagnostic messages for display.
   *
   * **Example** (Read the display summary)
   *
   * ```ts
   * import { YamlModificationError } from "@beep/yaml/YamlFormat";
   *
   * const error = YamlModificationError.make({ path: ["port"], diagnostics: [] });
   * console.log(JSON.stringify(error.message)) // "Modification failed at path [port]: "
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const summary = pipe(
      this.diagnostics,
      A.map((d) => d.message),
      A.join("; ")
    );
    return `Modification failed at path [${pipe(this.path, A.map(String), A.join(", "))}]: ${summary}`;
  }
}

// ── Internal: navigation failure ────────────────────────────────────────────

/** Categories raised by AST navigation and replacement conversion. */
const ModifyFailureCode = LiteralKit([
  "EmptyDocument",
  "PathNotFound",
  "InvalidIndex",
  "NotNavigable",
  "CircularReference",
  "NestingDepthExceeded",
]).pipe(
  $I.annoteSchema("ModifyFailureCode", {
    description: "Failures raised while navigating the YAML AST or converting a replacement value.",
  })
);

/**
 * Thrown by the pure AST-navigation helpers on a structural mismatch.
 * `modify` catches this and materializes {@link YamlModificationError}.
 */
class ModifyFailure extends S.TaggedError<ModifyFailure, { readonly brand: unique symbol }>($I`ModifyFailure`)(
  "ModifyFailure",
  {
    code: ModifyFailureCode.pipe(
      $I.annoteKey("ModifyFailure.code", { description: "The structural or replacement-value failure category" })
    ),
    message: S.String.pipe(
      $I.annoteKey("ModifyFailure.message", {
        description: "The original navigation or replacement-value failure explanation",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("ModifyFailure.offset", {
        description: "Zero-based UTF-16 offset of the affected node, or zero for replacement values",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("ModifyFailure.length", {
        description: "UTF-16 extent of the affected node, or zero for replacement values",
      })
    ),
  },
  $I.annoteError<ModifyFailure>("ModifyFailure", {
    description:
      "Internal typed navigation failure converted into a public YamlModificationError with source diagnostics.",
  })
) {}

const isModifyFailure = S.is(ModifyFailure);

// ── Internal: options bridging ──────────────────────────────────────────────

/** Normalize a `format`-positional range and the options-bag fallback into one plain shape (or `undefined`). */
const resolveRange: {
  (
    positional: YamlRangeLike | undefined,
    fromOptions: YamlRange | undefined
  ): { readonly offset: number; readonly length: number } | undefined;
  (
    fromOptions: YamlRange | undefined
  ): (positional: YamlRangeLike | undefined) => { readonly offset: number; readonly length: number } | undefined;
} = dual(
  2,
  (
    positional: YamlRangeLike | undefined,
    fromOptions: YamlRange | undefined
  ): { readonly offset: number; readonly length: number } | undefined => {
    const range = positional ?? fromOptions;
    return range === undefined ? undefined : { offset: range.offset, length: range.length };
  }
);

/** Copy only the defined entries of `fields` — never emits an explicit `undefined` into a v4 `optionalKey` field. */
function definedFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const out: Partial<T> = {};
  // Every caller supplies a fresh object literal with own fields only.
  for (const key in fields) {
    if (fields[key] !== undefined) out[key] = fields[key];
  }
  return out;
}

// ── format: opt-in re-quoting ────────────────────────────────────────

/**
 * Walk a composed AST and flip the `style` of every scalar the shared
 * escaping-mode helper deems re-quotable to the target quote's style. The
 * stringifier then emits those scalars through the very renderers the helper
 * used to prove the replacement value-preserving, so flip-and-stringify and
 * the helper's replacement text cannot disagree. Everything the helper skips
 * — plain scalars, block scalars, tagged/anchored nodes, multi-line source
 * spans, impossible double→single escapes — keeps its node untouched, and
 * the surrounding diff keeps the edit surgical per scalar span.
 */
const requoteNode: {
  (node: YamlNode, text: string, quoteStyle: QuoteStyle): YamlNode;
  (text: string, quoteStyle: QuoteStyle): (node: YamlNode) => YamlNode;
} = dual(3, (node: YamlNode, text: string, quoteStyle: QuoteStyle): YamlNode => {
  if (isYamlScalar(node)) {
    const quote = fallbackQuoteStyle(quoteStyle, P.isString(node.value) ? node.value : "") === "double" ? '"' : "'";
    if (O.isNone(requoteScalarText(text, node, quote, "escaping"))) return node;
    return YamlScalar.make({
      value: node.value,
      style: quote === '"' ? "double-quoted" : "single-quoted",
      ...definedFields({
        commentBefore: node.commentBefore,
        comment: node.comment,
        spaceBefore: node.spaceBefore,
        raw: node.raw,
        sourceMultiline: node.sourceMultiline,
      }),
      offset: node.offset,
      length: node.length,
    });
  }
  if (isYamlMap(node)) {
    return rebuildMap(
      node,
      A.map(node.items, (pair) =>
        YamlPair.make({
          key: requoteNode(pair.key, text, quoteStyle),
          value: pair.value === null ? null : requoteNode(pair.value, text, quoteStyle),
        })
      )
    );
  }
  if (isYamlSeq(node)) {
    return rebuildSeq(node, A.map(node.items, requoteNode(text, quoteStyle)));
  }
  return node;
});

/** Apply the opt-in re-quoting pass to a composed document's contents. */
const requoteDocument: {
  (doc: RawYamlDocument, text: string, options: YamlFormattingOptions | undefined): RawYamlDocument;
  (text: string, options: YamlFormattingOptions | undefined): (doc: RawYamlDocument) => RawYamlDocument;
} = dual(3, (doc: RawYamlDocument, text: string, options: YamlFormattingOptions | undefined): RawYamlDocument => {
  if (options?.requoteScalars !== true || doc.contents === null) return doc;
  return { ...doc, contents: requoteNode(doc.contents, text, options.quoteStyle ?? "single") };
});

// ── format ───────────────────────────────────────────────────────────────────

/** Rebuild a composed document for re-emission, stripping comments when asked. */
const toOutputDocument: {
  (doc: RawYamlDocument, preserveComments: boolean): RawYamlDocument;
  (preserveComments: boolean): (doc: RawYamlDocument) => RawYamlDocument;
} = dual(2, (doc: RawYamlDocument, preserveComments: boolean): RawYamlDocument => {
  const contents = !preserveComments && doc.contents !== null ? stripNodeComments(doc.contents) : doc.contents;
  return RawYamlDocument.make({
    contents,
    errors: doc.errors,
    warnings: doc.warnings,
    directives: doc.directives,
    ...(preserveComments ? definedFields({ commentBefore: doc.commentBefore, comment: doc.comment }) : {}),
    hasDocumentStart: doc.hasDocumentStart,
    hasDocumentEnd: doc.hasDocumentEnd,
    hasDocumentStartTab: doc.hasDocumentStartTab,
  });
});

/**
 * Format a document via the parse → stringify round-trip and diff the
 * output against the source, returning `undefined` when the input has a
 * fatal parse error (never corrupt malformed input) or carries
 * `%YAML`/`%TAG` directives — `stringifyDocument` does not re-emit
 * directive lines, and dropping a `%TAG` while keeping the shorthand tags
 * that depend on it would turn a valid document into an unparseable one.
 * A multi-document stream routes to {@link formatStream}, which formats
 * every document and shares the same directive refusal.
 */
/**
 * Re-attach the source's leading byte-order mark to a whole-document
 * re-emission. The stringifier never emits a BOM (it is framing, not
 * content), so without this every `format` and whole-pipeline `modify` on a
 * BOM-prefixed file would produce a delete-at-offset-0 edit. Preserving it
 * keeps the file's encoding signature the author's business, in line with
 * the fidelity contract that leaves untouched bytes alone.
 */
const withSourceBom: {
  (text: string, formatted: string): string;
  (formatted: string): (text: string) => string;
} = dual(2, (text: string, formatted: string): string =>
  Str.startsWith("\uFEFF")(text) ? `\uFEFF${formatted}` : formatted
);

const formatDocument: {
  (text: string, options: YamlFormattingOptions | undefined): string | undefined;
  (options: YamlFormattingOptions | undefined): (text: string) => string | undefined;
} = dual(2, (text: string, options: YamlFormattingOptions | undefined): string | undefined => {
  // ONE composition serves both paths: the stream path receives the same
  // documents and stream errors rather than composing the text a second
  // time (behavior-neutral — each document keeps its single-document
  // fields, `hasDocumentStart`/`hasDocumentEnd`/`hasDocumentStartTab`).
  const { documents, streamErrors } = composeAllDocuments(text, ParseOptionsInput.make({}));
  if (documents.length > 1) return formatStream(text, documents, streamErrors, options);
  // Cross-document errors require multiple documents; the composer always
  // supplies at least one document, including for empty input.
  const doc = A.getUnsafe(documents, 0);
  if (A.some(doc.errors, (e) => isFatalCode(e.code))) return undefined;
  if (doc.directives.length > 0) return undefined;

  return stringifyDocument(
    toOutputDocument(requoteDocument(doc, text, options), options?.preserveComments ?? true),
    StringifyOptionsInput.fromOptions(options)
  );
});

/**
 * Format a multi-document stream: every document is re-emitted in order with
 * its own framing (`---`, `...`, leading/trailing comment blocks — all of
 * which `stringifyDocument` renders per document), so no document is ever
 * dropped. Receives the documents and stream errors from the ONE
 * composition {@link formatDocument} already performed. Returns `undefined`
 * — no edits — when the stream cannot be re-emitted faithfully:
 *
 * **Gotchas**
 *
 * - any document (or the stream itself) carries a fatal diagnostic, the same
 *   posture as the single-document path;
 * - any document carries `%YAML`/`%TAG` directives — `stringifyDocument`
 *   does not re-emit directive lines, and dropping a `%TAG` would change
 *   what the re-emitted document means.
 *
 * The single-document path ({@link formatDocument}) shares the directive
 * refusal: re-emitting a directive-carrying document without its directive
 * line while keeping the dependent shorthand tags produced unparseable
 * output (probe-verified downstream against an independent oracle).
 */
const formatStream: {
  (
    text: string,
    documents: ReadonlyArray<RawYamlDocument>,
    streamErrors: ReadonlyArray<RawDiagnostic>,
    options: YamlFormattingOptions | undefined
  ): string | undefined;
  (
    documents: ReadonlyArray<RawYamlDocument>,
    streamErrors: ReadonlyArray<RawDiagnostic>,
    options: YamlFormattingOptions | undefined
  ): (text: string) => string | undefined;
} = dual(
  4,
  (
    text: string,
    documents: ReadonlyArray<RawYamlDocument>,
    streamErrors: ReadonlyArray<RawDiagnostic>,
    options: YamlFormattingOptions | undefined
  ): string | undefined => {
    if (A.some(streamErrors, (e) => isFatalCode(e.code))) return undefined;
    if (A.some(documents, (d) => A.some(d.errors, (e) => isFatalCode(e.code)))) return undefined;
    if (A.some(documents, (d) => d.directives.length > 0)) return undefined;

    const preserveComments = options?.preserveComments ?? true;
    const base = StringifyOptionsInput.fromOptions(options);
    const parts: Array<string> = [];
    for (const [i, doc] of documents.entries()) {
      // The composer guarantees each later document has its own `---` or
      // follows its predecessor's `...`.
      // Every document but the last must end in a newline for the next
      // document's framing to start on its own line; the caller's
      // `finalNewline` applies only to the last document.
      const docOptions = i < documents.length - 1 ? { ...base, finalNewline: true } : base;
      parts.push(
        stringifyDocument(toOutputDocument(requoteDocument(doc, text, options), preserveComments), docOptions)
      );
    }
    return A.join(parts, "");
  }
);

// ── modify: pure AST navigation ─────────────────────────────────────────────

/**
 * Lower a plain JavaScript value into synthetic AST nodes (offset/length are
 * irrelevant — the result is immediately re-stringified).
 *
 * **Details**
 *
 * Recursive by design: an array becomes a block {@link YamlSeq} and any other
 * non-null object a block {@link YamlMap} over its own enumerable string keys,
 * matching what `Yaml.stringify` does with the same value on the value path.
 * Before this was recursive, a mapping or sequence value fell through to the
 * node stringifier's `String(value)` fallback and landed in the document as
 * the literal text `[object Object]` — a silent corruption that only surfaced
 * on the next read.
 *
 * The two conditions with no finite rendering fail typed rather than hanging
 * or overflowing the stack: a cycle raises `CircularReference` and a graph
 * deeper than `MAX_NESTING_DEPTH` raises `NestingDepthExceeded`. `ancestors` holds
 * the ancestors of the value being lowered, so a value repeated across
 * siblings (a shared, acyclic sub-object) is lowered twice rather than
 * rejected.
 */
const jsValueToNode: {
  (value: unknown, ancestors: Array<object>, depth: number): YamlNode;
  (ancestors: Array<object>, depth: number): (value: unknown) => YamlNode;
} = dual(3, (value: unknown, ancestors: Array<object>, depth: number): YamlNode => {
  if (depth > MAX_NESTING_DEPTH) {
    throw ModifyFailure.make({
      code: "NestingDepthExceeded",
      message: `Replacement value nests deeper than the maximum of ${MAX_NESTING_DEPTH}`,
      offset: 0,
      length: 0,
    });
  }
  if (A.isArray(value) || P.isObject(value)) {
    if (A.some(ancestors, (ancestor) => ancestor === value)) {
      throw ModifyFailure.make({
        code: "CircularReference",
        message: "Replacement value contains a circular reference",
        offset: 0,
        length: 0,
      });
    }
    ancestors.push(value);
    try {
      if (A.isArray(value)) {
        return YamlSeq.make({
          items: A.map(value, jsValueToNode(ancestors, depth + 1)),
          style: "block",
          offset: 0,
          length: 0,
        });
      }
      return YamlMap.make({
        items: A.map(R.keys(value), (key) =>
          YamlPair.make({
            key: YamlScalar.make({ value: key, style: "plain", offset: 0, length: 0 }),
            value: jsValueToNode(value[key], ancestors, depth + 1),
          })
        ),
        style: "block",
        offset: 0,
        length: 0,
      });
    } finally {
      ancestors.pop();
    }
  }
  return YamlScalar.make({ value, style: "plain", offset: 0, length: 0 });
});

/** Entry point for {@link jsValueToNode}: one ancestor stack per lowering. */
function lowerValue(value: unknown): YamlNode {
  return jsValueToNode(value, [], 0);
}

const modifyDocument: {
  (doc: RawYamlDocument, path: YamlPath, value: unknown): YamlNode | null;
  (path: YamlPath, value: unknown): (doc: RawYamlDocument) => YamlNode | null;
} = dual(3, (doc: RawYamlDocument, path: YamlPath, value: unknown): YamlNode | null => {
  if (path.length === 0) {
    return value === undefined ? null : lowerValue(value);
  }
  if (doc.contents === null) {
    throw ModifyFailure.make({
      code: "EmptyDocument",
      message: "Cannot navigate path in empty document",
      offset: 0,
      length: 0,
    });
  }
  return modifyNode(doc.contents, path, 0, value);
});

const modifyNode: {
  (node: YamlNode, path: YamlPath, depth: number, value: unknown): YamlNode;
  (path: YamlPath, depth: number, value: unknown): (node: YamlNode) => YamlNode;
} = dual(4, (node: YamlNode, path: YamlPath, depth: number, value: unknown): YamlNode => {
  if (isYamlMap(node)) return modifyMapNode(node, path, depth, value);
  if (isYamlSeq(node)) return modifySeqNode(node, path, depth, value);
  throw ModifyFailure.make({
    code: "NotNavigable",
    message: `Cannot navigate through ${node._tag} at segment "${String(path[depth])}"`,
    offset: node.offset,
    length: node.length,
  });
});

/** A copy of `items` with the element at `index` replaced (index-assignment semantics). */
function replaceAt<T>(items: ReadonlyArray<T>, index: number, item: T): Array<T> {
  const next = [...items];
  next[index] = item;
  return next;
}

/** A copy of `items` with the element at `index` removed (splice semantics). */
function removeAt<T>(items: ReadonlyArray<T>, index: number): Array<T> {
  const next = [...items];
  next.splice(index, 1);
  return next;
}

/** Map step of {@link modifyNode}: set/remove at the last segment, otherwise descend. */
function modifyMapNode(node: YamlMap, path: YamlPath, depth: number, value: unknown): YamlMap {
  const segment = path[depth];
  const pairIndex = A.findFirstIndex(node.items, (pair) => isYamlScalar(pair.key) && pair.key.value === segment);
  return depth === path.length - 1
    ? setMapEntry(node, segment, pairIndex, value)
    : descendMapEntry(node, pairIndex, path, depth, value);
}

function setMapEntry(
  node: YamlMap,
  segment: YamlPath[number] | undefined,
  pairIndex: O.Option<number>,
  value: unknown
): YamlMap {
  if (value === undefined) {
    return O.isNone(pairIndex) ? node : rebuildMap(node, removeAt(node.items, pairIndex.value)); // Nothing to remove when absent
  }
  const newValueNode = lowerValue(value);
  if (O.isSome(pairIndex)) {
    const oldPair = A.getUnsafe(node.items, pairIndex.value);
    // Comments live on the key and value nodes, so the key carries its
    // own through unchanged; the replacement value is a fresh node and
    // deliberately starts with no comments of its own.
    return rebuildMap(
      node,
      replaceAt(node.items, pairIndex.value, YamlPair.make({ key: oldPair.key, value: newValueNode }))
    );
  }
  // Insert new key — appends after the last pair.
  const keyNode = YamlScalar.make({ value: String(segment), style: "plain", offset: 0, length: 0 });
  return rebuildMap(node, [...node.items, YamlPair.make({ key: keyNode, value: newValueNode })]);
}

function descendMapEntry(
  node: YamlMap,
  pairIndex: O.Option<number>,
  path: YamlPath,
  depth: number,
  value: unknown
): YamlMap {
  const segment = path[depth];
  if (O.isNone(pairIndex)) {
    throw ModifyFailure.make({
      code: "PathNotFound",
      message: `Key "${String(segment)}" not found in mapping`,
      offset: node.offset,
      length: node.length,
    });
  }
  const pair = A.getUnsafe(node.items, pairIndex.value);
  if (pair.value === null) {
    throw ModifyFailure.make({
      code: "PathNotFound",
      message: `Value at key "${String(segment)}" is null`,
      offset: node.offset,
      length: node.length,
    });
  }
  const newValue = modifyNode(pair.value, path, depth + 1, value);
  return rebuildMap(node, replaceAt(node.items, pairIndex.value, YamlPair.make({ key: pair.key, value: newValue })));
}

/** Sequence step of {@link modifyNode}: validate the index, then set/remove or descend. */
function modifySeqNode(node: YamlSeq, path: YamlPath, depth: number, value: unknown): YamlSeq {
  const segment = path[depth];
  const idx = P.isNumber(segment) ? segment : Number(segment);
  if (Number.isNaN(idx) || idx < 0) {
    throw ModifyFailure.make({
      code: "InvalidIndex",
      message: `Invalid sequence index: ${String(segment)}`,
      offset: node.offset,
      length: node.length,
    });
  }
  return depth === path.length - 1 ? setSeqItem(node, idx, value) : descendSeqItem(node, idx, path, depth, value);
}

function setSeqItem(node: YamlSeq, idx: number, value: unknown): YamlSeq {
  if (idx >= node.items.length) {
    // Out of range: removal is a no-op; a value appends after the last element.
    return rebuildSeq(node, value === undefined ? [...node.items] : [...node.items, lowerValue(value)]);
  }
  return rebuildSeq(
    node,
    value === undefined ? removeAt(node.items, idx) : replaceAt(node.items, idx, lowerValue(value))
  );
}

function descendSeqItem(node: YamlSeq, idx: number, path: YamlPath, depth: number, value: unknown): YamlSeq {
  if (idx >= node.items.length) {
    throw ModifyFailure.make({
      code: "InvalidIndex",
      message: `Index ${idx} out of bounds`,
      offset: node.offset,
      length: node.length,
    });
  }
  const child = node.items[idx];
  if (child === undefined)
    throw YamlFormatInvariantFailure.make({ message: "Cannot read properties of undefined (reading '_tag')" });
  return rebuildSeq(node, replaceAt(node.items, idx, modifyNode(child, path, depth + 1, value)));
}

/** A collection's non-item fields — style, span, properties and comment triple — for a rebuild. */
const collectionShell = (node: YamlMap | YamlSeq) => ({
  style: node.style,
  ...definedFields({
    tag: node.tag,
    anchor: node.anchor,
    commentBefore: node.commentBefore,
    comment: node.comment,
    spaceBefore: node.spaceBefore,
    sourceMultiline: node.sourceMultiline,
  }),
  offset: node.offset,
  length: node.length,
});

const rebuildMap: {
  (node: YamlMap, items: ReadonlyArray<YamlPair>): YamlMap;
  (items: ReadonlyArray<YamlPair>): (node: YamlMap) => YamlMap;
} = dual(
  2,
  (node: YamlMap, items: ReadonlyArray<YamlPair>): YamlMap =>
    YamlMap.make({
      items,
      ...collectionShell(node),
    })
);

const rebuildSeq: {
  (node: YamlSeq, items: ReadonlyArray<YamlNode>): YamlSeq;
  (items: ReadonlyArray<YamlNode>): (node: YamlSeq) => YamlSeq;
} = dual(
  2,
  (node: YamlSeq, items: ReadonlyArray<YamlNode>): YamlSeq =>
    YamlSeq.make({
      items,
      ...collectionShell(node),
    })
);

// ── modify: region-confined scalar replacement ───────────────────────

/**
 * Whether a value carries characters single-quoted style cannot express (it
 * escapes only `'`): C0 controls — newline, carriage return, tab among them —
 * plus DEL and the C1 range, the same conservative set the requote helper
 * uses. A value carrying any of these keeps the whole-document pipeline
 * rather than switching quote style. Char-code based, mirroring the
 * stringifier's own control-character checks.
 */
function isSingleQuoteUnsafe(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (ch <= "\x1f" || (ch >= "\x7f" && ch <= "\x9f")) return true;
  }
  return false;
}

/**
 * Read-only navigation twin of `modifyNode`: returns the EXISTING node at
 * `path` together with whether its parent collection is flow-styled, or
 * `undefined` whenever the path does not resolve to a node (missing
 * key/index, non-navigable node, empty path, null value mid-path).
 * `undefined` sends `modify` down its normal pipeline, which owns the
 * insert/append/remove semantics and the typed navigation errors — this
 * helper never throws and never guesses.
 */
const findExistingTarget: {
  (contents: YamlNode | null, path: YamlPath): RegionalTarget | undefined;
  (path: YamlPath): (contents: YamlNode | null) => RegionalTarget | undefined;
} = dual(2, (contents: YamlNode | null, path: YamlPath): RegionalTarget | undefined => {
  if (contents === null || path.length === 0) return undefined;
  return locatePath(contents, path, 0);
});

/** Walk `path` from `depth`; a null value mid-path resolves nothing. */
function locatePath(current: YamlNode, path: YamlPath, depth: number): RegionalTarget | undefined {
  const step = locateChild(current, path[depth]);
  if (step === undefined || depth === path.length - 1) return step;
  return step.node === null ? undefined : locatePath(step.node, path, depth + 1);
}

/** An existing node located by {@link findExistingTarget}, with its parent's flow-ness. */
type RegionalTarget = { readonly node: YamlNode | null; readonly inFlow: boolean };

/** One navigation step of {@link findExistingTarget}; `undefined` when `segment` resolves nothing. */
function locateChild(current: YamlNode, segment: YamlPath[number] | undefined): RegionalTarget | undefined {
  if (isYamlMap(current)) {
    const found = A.findFirst(current.items, (p) => isYamlScalar(p.key) && p.key.value === segment);
    return O.isNone(found) ? undefined : { node: found.value.value, inFlow: current.style === "flow" };
  }
  return isYamlSeq(current) ? locateSeqChild(current, segment) : undefined;
}

function locateSeqChild(current: YamlSeq, segment: YamlPath[number] | undefined): RegionalTarget | undefined {
  const idx = P.isNumber(segment) ? segment : Number(segment);
  if (Number.isNaN(idx) || idx < 0 || idx >= current.items.length) return undefined;
  const child = current.items[idx];
  return child === undefined ? undefined : { node: child, inFlow: current.style === "flow" };
}

/**
 * Render the replacement text for a region-confined splice, or `undefined`
 * to fall back. A string keeps the target's quote style when that style can
 * express it (single-quoted escapes only `'`, so newlines/tabs/controls bail
 * out; double-quoted expresses everything); a non-string into a quoted
 * target renders through `stringifyValue` — quoting it would change the
 * resolved type — as does any plain target, so the stringifier's own
 * plain-safety rules decide whether the text needs quotes — under the
 * target's own context, so a flow indicator inside a value spliced into a
 * flow collection is quoted rather than corrupting the collection. A
 * rendering that spans lines (folding, block styles) bails out: the fast
 * path never introduces a line break inside the spliced region.
 */
const renderRegionalScalarText: {
  (
    value: string | number | boolean,
    inFlow: boolean,
    options?: YamlStringifyOptions
  ): (target: YamlScalar) => string | undefined;
  (
    target: YamlScalar,
    value: string | number | boolean,
    inFlow: boolean,
    options?: YamlStringifyOptions
  ): string | undefined;
} = dual(
  (args) => isYamlScalar(args[0]),
  (
    target: YamlScalar,
    value: string | number | boolean,
    inFlow: boolean,
    options?: YamlStringifyOptions
  ): string | undefined => {
    let rendered: string;
    if (P.isString(value) && target.style === "single-quoted") {
      if (isSingleQuoteUnsafe(value)) return undefined;
      rendered = renderSingleQuoted(value);
    } else if (P.isString(value) && target.style === "double-quoted") {
      rendered = renderDoubleQuoted(value);
    } else {
      // finalNewline: false — the splice renders a scalar, never a document.
      rendered = stringifyValue(
        value,
        StringifyOptionsInput.make({ ...StringifyOptionsInput.fromOptions(options), finalNewline: false, inFlow })
      );
    }
    if (/[\n\r]/.test(rendered)) return undefined;
    return rendered;
  }
);

/**
 * Prove the rendered text means exactly what the caller asked: re-compose a
 * one-pair probe document and compare the scalar with Effect equality and
 * its numeric zero sign.
 * The probe mirrors the target's context — `k: [rendered]` for a flow
 * parent. The renderers produce one syntactically valid scalar, and the
 * caller has already excluded line breaks, so the probe always has one
 * mapping pair and (in flow context) one sequence item. Schema decoding
 * checks those construction invariants; value drift (for example -0 rendered
 * as 0) still bails out to the whole-document pipeline.
 */
const regionalRenderPreservesValue: {
  (rendered: string, value: string | number | boolean, inFlow: boolean): boolean;
  (value: string | number | boolean, inFlow: boolean): (rendered: string) => boolean;
} = dual(3, (rendered: string, value: string | number | boolean, inFlow: boolean): boolean => {
  const probeText = inFlow ? `k: [${rendered}]\n` : `k: ${rendered}\n`;
  const { document: probeDoc } = composeFirstDocumentCounted(probeText, ParseOptionsInput.make({}));
  const contents = O.getOrThrow(S.decodeUnknownOption(YamlMap)(probeDoc.contents));
  const pair = A.getUnsafe(contents.items, 0);
  const valueNode = inFlow
    ? A.getUnsafe(O.getOrThrow(S.decodeUnknownOption(YamlSeq)(pair.value)).items, 0)
    : pair.value;
  const node = O.getOrThrow(S.decodeUnknownOption(YamlScalar)(valueNode));
  return Equal.equals(node.value, value) && (node.value !== 0 || value !== 0 || 1 / node.value === 1 / value);
});

/** Values the region-confined splice can render as one scalar. */
const isRegionalValue = (value: unknown): value is string | number | boolean =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

/**
 * Document-shaping options (sortKeys, indent, indentSequences, finalNewline)
 * and explicit style requests all steer the whole-document pipeline.
 * Silently dropping them on the fast path would change the output without
 * error, so their presence bails out to the compose → replace → re-stringify path.
 */
const hasDocumentShapingOptions = (options: YamlStringifyOptions | undefined): boolean =>
  options !== undefined &&
  (options.defaultScalarStyle !== undefined ||
    options.forceDefaultStyles === true ||
    options.sortKeys === true ||
    options.indent !== undefined ||
    options.indentSequences !== undefined ||
    options.finalNewline !== undefined);

const isRegionalStyle = (style: YamlScalar["style"]): boolean =>
  style === "plain" || style === "single-quoted" || style === "double-quoted";

/**
 * Whether `target` is a scalar whose byte range can be replaced in place: a
 * synthesised empty span (`key:` with no value) is an insertion site, not a
 * replaceable range; tags, anchors, block styles and multi-line sources keep
 * the whole-document pipeline.
 */
const isSpliceableScalar = (target: YamlNode | null): target is YamlScalar =>
  isYamlScalar(target) &&
  target.length > 0 &&
  target.tag === undefined &&
  target.anchor === undefined &&
  isRegionalStyle(target.style) &&
  target.sourceMultiline !== true;

/**
 * Attempt the region-confined scalar splice for `modify`: replace
 * only the target scalar's byte range, re-emitting its original quote
 * character and leaving line endings (and every other byte) elsewhere
 * untouched. Returns the single edit, an empty array for a no-op
 * replacement, or `undefined` when any precondition fails — the caller then
 * runs the existing compose → replace → re-stringify → diff pipeline
 * unchanged.
 */
const tryRegionalScalarEdit: {
  (
    doc: RawYamlDocument,
    path: YamlPath,
    value: unknown,
    options?: YamlStringifyOptions
  ): (text: string) => ReadonlyArray<{ offset: number; length: number; content: string }> | undefined;
  (
    text: string,
    doc: RawYamlDocument,
    path: YamlPath,
    value: unknown,
    options?: YamlStringifyOptions
  ): ReadonlyArray<{ offset: number; length: number; content: string }> | undefined;
} = dual(
  (args) => P.isString(args[0]),
  (
    text: string,
    doc: RawYamlDocument,
    path: YamlPath,
    value: unknown,
    options?: YamlStringifyOptions
  ): ReadonlyArray<{ offset: number; length: number; content: string }> | undefined => {
    // `undefined` (removal), null, and object graphs keep the full pipeline:
    // null renders as an empty scalar there (`a:` — the stringifier's own
    // convention), and splicing an empty replacement would leave a trailing
    // space instead. Document-shaping options and explicit style requests
    // steer the whole-document pipeline too.
    if (!isRegionalValue(value) || hasDocumentShapingOptions(options)) return undefined;
    const found = findExistingTarget(doc.contents, path);
    if (found === undefined) return undefined;
    const { node: target, inFlow } = found;
    if (!isSpliceableScalar(target)) return undefined;
    // The composer decorates every span containing a line break with
    // sourceMultiline, already excluded by isSpliceableScalar.
    const span = Str.slice(target.offset, target.offset + target.length)(text);
    const rendered = renderRegionalScalarText(target, value, inFlow, options);
    if (rendered === undefined) return undefined;
    if (rendered === span) return []; // no-op replace: the span already says exactly this
    if (!regionalRenderPreservesValue(rendered, value, inFlow)) return undefined;
    return [{ offset: target.offset, length: target.length, content: rendered }];
  }
);

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Formats YAML text and modifies values at a path as byte-minimal edits that
 * preserve comments and layout elsewhere. Not instantiable.
 *
 * **Gotchas**
 *
 * `format`/`formatToString` are pure and total (edit computation never fails
 * — malformed input yields no edits rather than corrupting the document).
 * `modify`/`modifyToString` carry a real error channel: navigation failures
 * against the composed AST raise {@link YamlModificationError}, which — per
 * the structure-preserving-errors house rule — carries
 * `diagnostics: ReadonlyArray<YamlDiagnostic>`, never a collapsed `reason`
 * string.
 *
 * `format`/`formatToString` handle multi-document streams whole — every
 * document is re-emitted in order with its own framing, never a silently
 * truncated stream. `modify`/`modifyToString` are **single-document**: a
 * {@link YamlPath} carries no document index, so which document of a stream
 * a path names is a rule the format does not define, and a multi-document
 * stream fails typed with a `MultiDocumentStream` diagnostic rather than
 * guessing. Parse a stream with {@link Yaml.parseAll} /
 * `Yaml.parseAllResult`.
 *
 * **Directive-carrying input is refused on every path.** The stringifier does
 * not re-emit `%YAML`/`%TAG` directive lines, and re-emitting a document
 * without its `%TAG` while keeping the shorthand tags that depend on it
 * (`!e!foo`) turns a valid file into one no parser can read. So
 * `format`/`formatToString` leave such input byte-identical (no edits), and
 * `modify`/`modifyToString` fail typed with a `DirectiveCarryingDocument`
 * diagnostic. Directive re-emission is unimplemented, and the refusal is what
 * stops the corruption.
 *
 * **Example** (Format YAML and update a value while preserving comments)
 *
 * ```ts
 * import { YamlFormat } from "@beep/yaml/YamlFormat";
 * import * as Effect from "effect/Effect";
 *
 * const formatted = YamlFormat.formatToString("a:   1\nb:\n    - x\n    - y # c\n");
 * console.log(JSON.stringify(formatted)) // "a: 1\nb:\n- x\n- y # c\n"
 *
 * const program = Effect.gen(function* () {
 *   return yield* YamlFormat.modifyToString("port: 3000 # dev\n", ["port"], 8080);
 * });
 * console.log(JSON.stringify(Effect.runSync(program))) // "port: 8080 # dev\n"
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export class YamlFormat {
  private constructor() {}

  /**
   * Compute formatting edits for a YAML document. Non-mutating — apply the
   * result with `YamlEdit.applyAll` (or use {@link YamlFormat.formatToString}).
   * Pure and total: malformed input (a fatal parse error) yields `[]` rather
   * than corrupting the document.
   *
   * **Details**
   *
   * **Multi-document streams format whole.** Input containing more than one
   * document (a `---`-separated stream — a Kubernetes manifest, a pnpm 11
   * `pnpm-lock.yaml` with a config-dependency preamble) formats every
   * document in order, re-emitting each document's own framing (`---`,
   * `...`, comment blocks); no document is ever dropped. Document detection
   * is CST-level, so a `---` inside a block scalar or quoted string is
   * content, not a document boundary. Two multi-document shapes yield `[]`
   * (untouched) because they cannot be re-emitted faithfully: a stream with
   * a fatal diagnostic in any document (the same posture as single-document
   * input) and a stream carrying `%YAML`/`%TAG` directives.
   *
   * **Directive-carrying documents yield `[]` on the single-document path
   * too.** Directive lines are not re-emitted, and dropping a `%TAG` while
   * keeping the shorthand tags that depend on it would turn a valid document
   * into an unparseable one — so a document carrying `%YAML`/`%TAG`
   * directives is left untouched. Detection is directive-token-level: a
   * literal `%TAG` inside a scalar is content and formats normally.
   *
   * The positional `range` argument takes precedence over
   * `options?.range` when both are given; either accepts a plain
   * `{ offset, length }` object as well as a {@link YamlRange} instance, so
   * callers do not need `YamlRange.make(...)` for the common case.
   *
   * Formatting preserves an existing scalar's own quote style by default —
   * `quoteStyle` governs only quotes the stringifier introduces. The opt-in
   * `options.requoteScalars` makes `quoteStyle` apply to already-quoted
   * source scalars too, re-quoting only where the parsed value is provably
   * preserved; see {@link YamlFormattingOptions} for the exact skip rules.
   *
   * A plain `<<` mapping key is preserved unquoted, keeping its merge-key
   * meaning (`tag:yaml.org,2002:merge`) — quoting it to `'<<'` would produce
   * an ordinary string key that merges nothing, changing what the document
   * means with no error raised. A key the author quoted explicitly keeps its
   * quotes, since that is a literal string key they wrote deliberately. Note
   * that {@link Yaml.stringify} is deliberately the other way round for a
   * `"<<"` key on a plain JavaScript object.
   *
   * **Example** (Apply computed formatting edits)
   *
   * ```ts
   * import { YamlFormat } from "@beep/yaml/YamlFormat";
   * import { YamlEdit } from "@beep/yaml/YamlEdit";
   *
   * const source = "a:   1\n";
   * const edits = YamlFormat.format(source);
   * console.log(JSON.stringify(YamlEdit.applyAll(source, edits))) // "a: 1\n"
   * ```
   *
   * @param text - The YAML source to format.
   * @param range - Optional sub-range; only edits fully within it are returned.
   * @param options - Optional {@link YamlFormattingOptions}.
   * @returns The edits that bring `text` to canonical shape; apply them with
   *   `YamlEdit.applyAll`. Empty when the input cannot be formatted faithfully.
   * @category formatting
   * @since 0.0.0
   */
  static readonly format: {
    (range?: YamlRangeLike, options?: YamlFormattingOptions): (text: string) => ReadonlyArray<YamlEdit>;
    (text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): ReadonlyArray<YamlEdit>;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): ReadonlyArray<YamlEdit> => {
      const formatted = formatDocument(text, options);
      if (formatted === undefined) return [];

      let edits = computeEdits(text, withSourceBom(text, formatted));

      const effectiveRange = resolveRange(range, options?.range);
      if (effectiveRange !== undefined) {
        const rangeStart = effectiveRange.offset;
        const rangeEnd = effectiveRange.offset + effectiveRange.length;
        edits = A.filter(edits, (e) => e.offset >= rangeStart && e.offset + e.length <= rangeEnd);
      }

      return A.map(edits, (e) => YamlEdit.make(e));
    }
  );

  /**
   * Format `text` and apply the resulting edits in one step
   * (`YamlEdit.applyAll ∘ format`). Pure and total.
   *
   * **Details**
   *
   * Inherits the {@link YamlFormat.format} contract: a multi-document stream
   * is formatted whole — every document re-emitted in order — and input
   * that cannot be formatted faithfully (a fatal parse error, or any
   * document — single or in a stream — carrying `%YAML`/`%TAG` directives)
   * is returned byte-identical — never a truncated first document, never a
   * document re-emitted without the directive its tags depend on.
   *
   * **Example** (Format a mapping in one step)
   *
   * ```ts
   * import { YamlFormat } from "@beep/yaml/YamlFormat";
   *
   * console.log(JSON.stringify(YamlFormat.formatToString("a:   1\n"))) // "a: 1\n"
   * ```
   *
   * @param text - The YAML source to format.
   * @param range - Optional sub-range; only edits fully within it are applied.
   * @param options - Optional {@link YamlFormattingOptions}.
   * @returns The formatted text, or `text` unchanged when it cannot be
   *   formatted faithfully.
   * @category formatting
   * @since 0.0.0
   */
  static readonly formatToString: {
    (range?: YamlRangeLike, options?: YamlFormattingOptions): (text: string) => string;
    (text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): string;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): string =>
      YamlEdit.applyAll(text, YamlFormat.format(text, range, options))
  );

  /**
   * Compute the edits that insert, replace, or remove a value at `path`.
   * Passing `value === undefined` removes the target key/element; a missing
   * insertion target appends after the last pair/element. Fails with
   * {@link YamlModificationError} on a fatal parse error or a structural
   * navigation mismatch.
   *
   * **Details**
   *
   * **`value` may be a whole object graph.** An array is written as a block
   * sequence and any other non-null object as a block mapping over its own
   * enumerable string keys, recursively — the same lowering
   * {@link Yaml.stringify} applies to the same value, so `modify` and
   * `stringify` agree on what a given JavaScript value means. For a synthesized
   * subtree (an object/array value) only the surrounding document is
   * preserved byte-for-byte; the subtree carries no comments and takes the
   * stringifier's styles.
   *
   * **Scalar replacement is region-confined and quote-preserving.**
   * When the path resolves to an existing single-line `plain`,
   * `single-quoted`, or `double-quoted` scalar with no tag or anchor, and
   * the replacement is a string, number, or boolean, `modify` splices
   * ONLY the target scalar's source span and emits a single edit: a string
   * into a quoted scalar keeps the original quote character, a non-string
   * renders plain (quoting it would change the resolved type), and every
   * byte outside the span — line endings included, so a CRLF document keeps
   * its CRLFs and a same-line trailing comment survives — is untouched. The
   * splice is taken only when the rendered text re-parses to exactly the
   * caller's value and renders as a single line; a no-op replacement yields
   * no edits. Anything else — removals (`value === undefined`), nulls,
   * insertions, object/array values, block or multi-line scalars, tagged or anchored
   * targets, or any document-shaping / explicit-style option
   * (`defaultScalarStyle`, `forceDefaultStyles`, `sortKeys`, `indent`,
   * `indentSequences`, `finalNewline`) — falls back to re-serialising the
   * whole document, which normalises line endings to LF, applies those
   * options, and renders the replacement in the stringifier's styles.
   *
   * Two replacement values have no finite rendering and fail typed rather
   * than hanging or overflowing the stack: one containing a circular
   * reference (`CircularReference`) and one nesting deeper than 256 levels
   * (`NestingDepthExceeded`).
   *
   * **Single-document contract.** A `path` carries no document index, so on
   * a multi-document stream there is no rule for which document it names —
   * `modify` fails with {@link YamlModificationError} carrying a
   * `MultiDocumentStream` diagnostic rather than guessing document 1 (and
   * unlike {@link YamlFormat.format}, which formats a stream whole because
   * formatting needs no target). Detection is CST-level: a `---` inside a
   * block scalar or quoted string is content, not a document boundary.
   *
   * **Directive-carrying documents are refused.** A document carrying
   * `%YAML`/`%TAG` directives fails with {@link YamlModificationError}
   * carrying a `DirectiveCarryingDocument` diagnostic: modify re-emits the
   * whole document and does not re-emit directive lines, so applying it
   * would drop the `%TAG` while keeping the shorthand tags that depend on
   * it — unparseable output. A typed refusal beats silent corruption;
   * directive re-emission is unimplemented, not undesired. A literal
   * `%TAG` inside a scalar is content and does not trigger the refusal.
   *
   * `options` is a bare {@link YamlStringifyOptions} — it controls only the
   * internal re-stringify step, not a range (there is no range to restrict
   * for a path-targeted modification).
   *
   * **Example** (Compute a scalar replacement edit)
   *
   * ```ts
   * import { YamlFormat } from "@beep/yaml/YamlFormat";
   * import { YamlEdit } from "@beep/yaml/YamlEdit";
   * import * as Effect from "effect/Effect";
   *
   * const source = "port: 3000 # dev\n";
   * const edits = Effect.runSync(YamlFormat.modify(source, ["port"], 8080));
   * console.log(JSON.stringify(YamlEdit.applyAll(source, edits))) // "port: 8080 # dev\n"
   * ```
   *
   * @param text - The YAML source to modify.
   * @param path - The location to insert, replace or remove.
   * @param value - The JavaScript value to write; `undefined` removes the
   *   target instead.
   * @param options - Optional {@link YamlStringifyOptions} for the
   *   re-stringify step.
   * @returns An `Effect` that succeeds with the edits to apply (via
   *   `YamlEdit.applyAll`), or fails with {@link YamlModificationError}.
   * @category utilities
   * @since 0.0.0
   */
  static readonly modify: {
    (
      path: YamlPath,
      value: unknown,
      options?: YamlStringifyOptions
    ): (text: string) => Effect.Effect<Array<YamlEdit>, YamlModificationError>;
    (
      text: string,
      path: YamlPath,
      value: unknown,
      options?: YamlStringifyOptions
    ): Effect.Effect<Array<YamlEdit>, YamlModificationError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("YamlFormat.modify")(function* (
      text: string,
      path: YamlPath,
      value: unknown,
      options?: YamlStringifyOptions
    ) {
      const index = YamlDiagnostic.positionIndex(text);
      const { document: doc, documentCount } = composeFirstDocumentCounted(text, ParseOptionsInput.make({}));
      if (documentCount > 1) {
        return yield* YamlModificationError.make({
          path: echoErrorPath(path),
          diagnostics: [
            YamlDiagnostic.fromRaw(
              {
                code: "MultiDocumentStream",
                message: `Cannot modify a multi-document stream (${documentCount} documents): modify re-emits exactly one document`,
                offset: 0,
                length: 0,
              },
              text,
              index
            ),
          ],
        });
      }
      const fatal = A.filter(doc.errors, (e) => isFatalCode(e.code));
      if (fatal.length > 0) {
        return yield* YamlModificationError.make({
          path: echoErrorPath(path),
          diagnostics: YamlDiagnostic.fromRawBatch(fatal, text, index),
        });
      }
      if (doc.directives.length > 0) {
        return yield* YamlModificationError.make({
          path: echoErrorPath(path),
          diagnostics: [
            YamlDiagnostic.fromRaw(
              {
                code: "DirectiveCarryingDocument",
                message:
                  "Cannot modify a document carrying %YAML/%TAG directives: modify does not re-emit directive lines, and dropping a %TAG orphans the shorthand tags that depend on it",
                offset: 0,
                length: 0,
              },
              text,
              index
            ),
          ],
        });
      }

      // Region-confined scalar replacement: when the target is an
      // existing single-line untagged scalar and the value is scalar-shaped,
      // splice just its span — quote style preserved, CRLFs and every other
      // byte outside the span untouched. Any precondition miss falls through
      // to the whole-document pipeline below, unchanged.
      const regional = tryRegionalScalarEdit(text, doc, path, value, options);
      if (regional !== undefined) {
        return A.map(regional, (e) => YamlEdit.make(e));
      }

      const newContents = yield* Effect.try({
        try: () => modifyDocument(doc, path, value),
        catch: (err) => {
          if (!isModifyFailure(err)) throw err;
          return YamlModificationError.make({
            path: echoErrorPath(path),
            diagnostics: [
              YamlDiagnostic.fromRaw(
                { code: err.code, message: err.message, offset: err.offset, length: err.length },
                text,
                index
              ),
            ],
          });
        },
      });

      const outputDoc: RawYamlDocument = { ...doc, contents: newContents };
      const formatted = yield* Effect.try({
        try: () => stringifyDocument(outputDoc, StringifyOptionsInput.fromOptions(options)),
        catch: (defect) => {
          if (!isStringifyDepthExceeded(defect)) throw defect;
          return YamlModificationError.make({
            path: echoErrorPath(path),
            diagnostics: [
              YamlDiagnostic.fromRaw(
                { code: "NestingDepthExceeded", message: defect.message, offset: 0, length: 0 },
                text,
                index
              ),
            ],
          });
        },
      });
      return A.map(computeEdits(text, withSourceBom(text, formatted)), (e) => YamlEdit.make(e));
    })
  );

  /**
   * Modify `text` and apply the resulting edits in one step
   * (`YamlEdit.applyAll ∘ modify`). Inherits the {@link YamlFormat.modify}
   * error channel, including the single-document contract's
   * `MultiDocumentStream` refusal and the `DirectiveCarryingDocument`
   * refusal of `%YAML`/`%TAG`-carrying documents.
   *
   * **Example** (Update a value and keep its comment)
   *
   * ```ts
   * import { YamlFormat } from "@beep/yaml/YamlFormat";
   * import * as Effect from "effect/Effect";
   *
   * const result = Effect.runSync(YamlFormat.modifyToString("port: 3000 # dev\n", ["port"], 8080));
   * console.log(JSON.stringify(result)) // "port: 8080 # dev\n"
   * ```
   *
   * @param text - The YAML source to modify.
   * @param path - The location to insert, replace or remove.
   * @param value - The JavaScript value to write; `undefined` removes the
   *   target instead.
   * @param options - Optional {@link YamlStringifyOptions} for the
   *   re-stringify step.
   * @returns An `Effect` that succeeds with the modified text, or fails with
   *   {@link YamlModificationError}.
   * @category utilities
   * @since 0.0.0
   */
  static readonly modifyToString: {
    (
      path: YamlPath,
      value: unknown,
      options?: YamlStringifyOptions
    ): (text: string) => Effect.Effect<string, YamlModificationError>;
    (
      text: string,
      path: YamlPath,
      value: unknown,
      options?: YamlStringifyOptions
    ): Effect.Effect<string, YamlModificationError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("YamlFormat.modifyToString")(function* (
      text: string,
      path: YamlPath,
      value: unknown,
      options?: YamlStringifyOptions
    ) {
      const edits = yield* YamlFormat.modify(text, path, value, options);
      return YamlEdit.applyAll(text, edits);
    })
  );
}
