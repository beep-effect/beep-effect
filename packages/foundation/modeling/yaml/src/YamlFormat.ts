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
import { dual, identity, pipe } from "effect/Function";
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
  wouldBeResolved11,
} from "./internal/stringifier.ts";
import { YamlStringifyOptions } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import { YamlEdit, YamlRange } from "./YamlEdit.ts";
import { YamlMap, YamlPair, YamlScalar, YamlSeq } from "./YamlNode.ts";
import type { RawDiagnostic } from "./internal/diagnostics.ts";
import type { RawDirective } from "./internal/raw-document.ts";
import type { YamlPath } from "./YamlEdit.ts";
import type { QuoteStyle, YamlNode } from "./YamlNode.ts";

const $I = $YamlId.create("YamlFormat");

const isYamlScalar = S.is(YamlScalar);
const isYamlMap = S.is(YamlMap);
const isYamlSeq = S.is(YamlSeq);
const isFiniteIndex = S.is(S.Finite);
const isStringifyDepthExceeded = S.is(StringifyDepthExceeded);

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

class NonFiniteIndex extends S.TaggedClass<NonFiniteIndex, { readonly brand: unique symbol }>($I`NonFiniteIndex`)(
  "NonFiniteIndex",
  {
    kind: NonFiniteIndexKind.pipe(
      $I.annoteKey("NonFiniteIndex.kind", { description: "The original non-finite numeric index's IEEE kind" })
    ),
  },
  $I.annote("NonFiniteIndex", {
    description:
      "Tagged representation of NaN or signed infinity in a failed modification's echoed path; only the error payload is normalized, navigation still receives the original number.",
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

const echoErrorPath = (path: YamlPath) =>
  A.map(path, (segment) =>
    P.isNumber(segment) && !isFiniteIndex(segment)
      ? NonFiniteIndex.make({ kind: nonFiniteIndexKind(segment) })
      : segment
  );

/**
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
      "Raised when `YamlFormat.modify` cannot navigate the requested path against the composed AST (a structural mismatch), the source fails to parse, the source is a multi-document stream (`MultiDocumentStream` — a path names no particular document of a stream, so modify refuses rather than guessing), or the document's directives end in a `---` line that carries content (`DirectiveCarryingDocument` — modify keeps the `%YAML`/`%TAG` prologue verbatim only up to a bare or commented `---` marker, and dropping a `%TAG` would orphan the shorthand tags that depend on it). Carries structured YamlDiagnostic entries — never a collapsed `reason` string (the structure-preserving-errors house rule). The error itself has no `code` field: read the code from the diagnostics — `error.diagnostics[0].code` is the primary failure.",
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

function omitUndefinedForOptionalKeys<T extends Record<string, unknown>>(freshLiteral: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key in freshLiteral) {
    if (freshLiteral[key] !== undefined) out[key] = freshLiteral[key];
  }
  return out;
}

const requoteTarget = (
  scalar: YamlScalar,
  quoteStyle: QuoteStyle
): { readonly quote: '"' | "'"; readonly style: "double-quoted" | "single-quoted" } =>
  fallbackQuoteStyle(P.isString(scalar.value) ? scalar.value : "", quoteStyle) === "double"
    ? { quote: '"', style: "double-quoted" }
    : { quote: "'", style: "single-quoted" };

const requoteNode: {
  (node: YamlNode, text: string, quoteStyle: QuoteStyle): YamlNode;
  (text: string, quoteStyle: QuoteStyle): (node: YamlNode) => YamlNode;
} = dual(3, (node: YamlNode, text: string, quoteStyle: QuoteStyle): YamlNode => {
  if (isYamlScalar(node)) {
    const target = requoteTarget(node, quoteStyle);
    if (O.isNone(requoteScalarText(text, node, target.quote, "escaping"))) return node;
    return YamlScalar.make({
      value: node.value,
      style: target.style,
      ...omitUndefinedForOptionalKeys({
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

const requoteDocument: {
  (doc: RawYamlDocument, text: string, options: YamlFormattingOptions | undefined): RawYamlDocument;
  (text: string, options: YamlFormattingOptions | undefined): (doc: RawYamlDocument) => RawYamlDocument;
} = dual(3, (doc: RawYamlDocument, text: string, options: YamlFormattingOptions | undefined): RawYamlDocument => {
  if (options?.requoteScalars !== true || doc.contents === null) return doc;
  return { ...doc, contents: requoteNode(doc.contents, text, options.quoteStyle ?? "single") };
});

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
    ...(preserveComments
      ? omitUndefinedForOptionalKeys({ commentBefore: doc.commentBefore, comment: doc.comment })
      : {}),
    hasDocumentStart: doc.hasDocumentStart,
    hasDocumentEnd: doc.hasDocumentEnd,
    hasDocumentStartTab: doc.hasDocumentStartTab,
  });
});

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
  const { documents, streamErrors: crossDocumentErrors } = composeAllDocuments(text, ParseOptionsInput.make({}));
  if (documents.length > 1) return formatStream(text, documents, crossDocumentErrors, options);
  const documentEvenForEmptyInput = A.getUnsafe(documents, 0);
  if (A.some(documentEvenForEmptyInput.errors, (e) => isFatalCode(e.code))) return undefined;
  if (documentEvenForEmptyInput.directives.length > 0) return undefined;

  return stringifyDocument(
    toOutputDocument(requoteDocument(documentEvenForEmptyInput, text, options), options?.preserveComments ?? true),
    StringifyOptionsInput.fromOptions(options)
  );
});

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
    const selfFramedDocuments: Array<string> = [];
    for (const [i, doc] of documents.entries()) {
      const newlineBeforeNextFramingOptions = i < documents.length - 1 ? { ...base, finalNewline: true } : base;
      selfFramedDocuments.push(
        stringifyDocument(
          toOutputDocument(requoteDocument(doc, text, options), preserveComments),
          newlineBeforeNextFramingOptions
        )
      );
    }
    return A.join(selfFramedDocuments, "");
  }
);

const jsValueToNode: {
  (value: unknown, ancestors: Array<object>, depth: number): LoweredNode;
  (ancestors: Array<object>, depth: number): (value: unknown) => LoweredNode;
} = dual(3, (value: unknown, ancestors: Array<object>, depth: number): LoweredNode => {
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

type LoweredNode = YamlScalar | YamlSeq | YamlMap;

function lowerValue(value: unknown): LoweredNode {
  return jsValueToNode(value, [], 0);
}

function lowerReplacementKeepingAnchor(previous: YamlNode | null, value: unknown): YamlNode {
  const lowered = lowerValue(value);
  const anchor = previous === null || previous._tag === "YamlAlias" ? undefined : previous.anchor;
  return anchor === undefined
    ? lowered
    : Match.valueTags(lowered, {
        YamlScalar: (node) =>
          YamlScalar.make({ value: node.value, style: node.style, anchor, offset: node.offset, length: node.length }),
        YamlSeq: (node) =>
          YamlSeq.make({ items: node.items, style: node.style, anchor, offset: node.offset, length: node.length }),
        YamlMap: (node) =>
          YamlMap.make({ items: node.items, style: node.style, anchor, offset: node.offset, length: node.length }),
      });
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

function replaceAt<T>(items: ReadonlyArray<T>, index: number, item: T): Array<T> {
  const next = [...items];
  next[index] = item;
  return next;
}

function removeAt<T>(items: ReadonlyArray<T>, index: number): Array<T> {
  const next = [...items];
  next.splice(index, 1);
  return next;
}

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
    return O.isNone(pairIndex) ? node : rebuildMap(node, removeAt(node.items, pairIndex.value));
  }
  if (O.isSome(pairIndex)) {
    const oldPair = A.getUnsafe(node.items, pairIndex.value);
    return rebuildMap(
      node,
      replaceAt(
        node.items,
        pairIndex.value,
        YamlPair.make({ key: oldPair.key, value: lowerReplacementKeepingAnchor(oldPair.value, value) })
      )
    );
  }
  const keyNode = YamlScalar.make({ value: String(segment), style: "plain", offset: 0, length: 0 });
  return rebuildMap(node, [...node.items, YamlPair.make({ key: keyNode, value: lowerValue(value) })]);
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
    return rebuildSeq(node, value === undefined ? [...node.items] : [...node.items, lowerValue(value)]);
  }
  return rebuildSeq(
    node,
    value === undefined
      ? removeAt(node.items, idx)
      : replaceAt(node.items, idx, lowerReplacementKeepingAnchor(A.getUnsafe(node.items, idx), value))
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

const collectionShell = (node: YamlMap | YamlSeq) => ({
  style: node.style,
  ...omitUndefinedForOptionalKeys({
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

function isSingleQuoteUnsafe(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const ch = Str.slice(i, i + 1)(s);
    if (ch <= "\x1f" || (ch >= "\x7f" && ch <= "\x9f")) return true;
  }
  return false;
}

const findExistingTarget: {
  (contents: YamlNode | null, path: YamlPath): RegionalTarget | undefined;
  (path: YamlPath): (contents: YamlNode | null) => RegionalTarget | undefined;
} = dual(2, (contents: YamlNode | null, path: YamlPath): RegionalTarget | undefined => {
  if (contents === null || path.length === 0) return undefined;
  return locatePath(contents, path, 0);
});

function locatePath(current: YamlNode, path: YamlPath, depth: number): RegionalTarget | undefined {
  const step = locateChild(current, path[depth]);
  if (step === undefined || depth === path.length - 1) return step;
  return step.node === null ? undefined : locatePath(step.node, path, depth + 1);
}

type RegionalTarget = { readonly node: YamlNode | null; readonly inFlow: boolean };

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
      const scalarNeverDocumentOptions = StringifyOptionsInput.make({
        ...StringifyOptionsInput.fromOptions(options),
        finalNewline: false,
        inFlow,
      });
      rendered = stringifyValue(value, scalarNeverDocumentOptions);
    }
    if (/[\n\r]/.test(rendered)) return undefined;
    return rendered;
  }
);

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

const isRegionalValue = (value: unknown): value is string | number | boolean =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

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

const isSpliceableScalar = (target: YamlNode | null): target is YamlScalar =>
  isYamlScalar(target) &&
  target.length > 0 &&
  target.tag === undefined &&
  isRegionalStyle(target.style) &&
  target.sourceMultiline !== true;

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
    if (!isRegionalValue(value) || hasDocumentShapingOptions(options)) return undefined;
    const found = findExistingTarget(doc.contents, path);
    if (found === undefined) return undefined;
    const { node: target, inFlow } = found;
    if (!isSpliceableScalar(target)) return undefined;
    const span = Str.slice(target.offset, target.offset + target.length)(text);
    const rendered = renderRegionalScalarText(target, value, inFlow, options);
    if (rendered === undefined) return undefined;
    if (rendered === span) return [];
    if (!regionalRenderPreservesValue(rendered, value, inFlow)) return undefined;
    return [{ offset: target.offset, length: target.length, content: rendered }];
  }
);

const PROLOGUE_HEAD = "^(?:(?:%[^\\n]*|[ \\t]*(?:#[^\\n]*|\\r)?)\\n)*---";

const BARE_DIRECTIVE_PROLOGUE = new RegExp(`${PROLOGUE_HEAD}[ \\t]*\\r?\\n`, "u");

const SPLIT_DIRECTIVE_PROLOGUE = new RegExp(`${PROLOGUE_HEAD}(?=[ \\t]*$|[ \\t]+#[^\\n]*(?:\\r?\\n|$))`, "u");

const directivePrologue = (text: string): string | undefined => {
  const source = Str.replace(/^\uFEFF/u, "")(text);
  return pipe(
    O.fromNullishOr(BARE_DIRECTIVE_PROLOGUE.exec(source)),
    O.map((match) => match[0]),
    O.orElse(() => O.map(O.fromNullishOr(SPLIT_DIRECTIVE_PROLOGUE.exec(source)), (match) => `${match[0]}\n`)),
    O.getOrUndefined
  );
};

const bodyAfterPrologue = (doc: RawYamlDocument, contents: YamlNode | null): RawYamlDocument => {
  const { commentBefore: _commentBefore, ...framing } = doc;
  return { ...framing, contents, hasDocumentStart: false, hasDocumentStartTab: false };
};

const declaredYamlVersion = (directives: ReadonlyArray<RawDirective>): O.Option<string> =>
  pipe(
    A.findFirst(directives, (directive) => directive.name === "YAML"),
    O.flatMap((directive) => A.head(directive.parameters))
  );

const isCoercedFreshScalar11 = (scalar: YamlScalar): boolean =>
  scalar.length === 0 &&
  scalar.tag === undefined &&
  scalar.style === "plain" &&
  P.isString(scalar.value) &&
  (scalar.value === "<<" || wouldBeResolved11(scalar.value));

const quoteFreshScalar11 = (scalar: YamlScalar, quoteStyle: QuoteStyle): YamlScalar =>
  isCoercedFreshScalar11(scalar)
    ? YamlScalar.make({
        value: scalar.value,
        style: fallbackQuoteStyle(`${scalar.value}`, quoteStyle) === "double" ? "double-quoted" : "single-quoted",
        ...omitUndefinedForOptionalKeys({ anchor: scalar.anchor }),
        offset: scalar.offset,
        length: scalar.length,
      })
    : scalar;

const quoteFreshYaml11 = (node: YamlNode, quoteStyle: QuoteStyle): YamlNode =>
  Match.valueTags(node, {
    YamlScalar: (scalar) => quoteFreshScalar11(scalar, quoteStyle),
    YamlSeq: (seq) =>
      rebuildSeq(
        seq,
        A.map(seq.items, (item) => quoteFreshYaml11(item, quoteStyle))
      ),
    YamlMap: (map) =>
      rebuildMap(
        map,
        A.map(map.items, (pair) =>
          YamlPair.make({
            key: quoteFreshYaml11(pair.key, quoteStyle),
            value: pair.value === null ? null : quoteFreshYaml11(pair.value, quoteStyle),
          })
        )
      ),
    YamlAlias: identity,
  });

const modifyRefusal = (
  text: string,
  index: ReturnType<typeof YamlDiagnostic.positionIndex>,
  path: YamlPath,
  code: "UnsupportedYamlVersion" | "DirectiveCarryingDocument",
  message: string
): YamlModificationError =>
  YamlModificationError.make({
    path: echoErrorPath(path),
    diagnostics: [YamlDiagnostic.fromRaw({ code, message, offset: 0, length: 0 }, text, index)],
  });

type WholeDocumentEdit = {
  readonly text: string;
  readonly index: ReturnType<typeof YamlDiagnostic.positionIndex>;
  readonly doc: RawYamlDocument;
  readonly path: YamlPath;
  readonly value: unknown;
  readonly options: YamlStringifyOptions | undefined;
  readonly yaml11: boolean;
};

const rewriteWholeDocument = Effect.fnUntraced(function* ({
  text,
  index,
  doc,
  path,
  value,
  options,
  yaml11,
}: WholeDocumentEdit) {
  const prologue = A.isReadonlyArrayEmpty(doc.directives) ? "" : directivePrologue(text);
  if (prologue === undefined) {
    return yield* modifyRefusal(
      text,
      index,
      path,
      "DirectiveCarryingDocument",
      "Cannot modify a document whose directive-ending --- line carries content: modify keeps the %YAML/%TAG prologue verbatim only up to a bare --- marker, and dropping a %TAG orphans the shorthand tags that depend on it"
    );
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

  const contents =
    yaml11 && newContents !== null ? quoteFreshYaml11(newContents, options?.quoteStyle ?? "single") : newContents;
  const outputDoc = prologue === "" ? { ...doc, contents } : bodyAfterPrologue(doc, contents);
  const formatted = yield* Effect.try({
    try: () => `${prologue}${stringifyDocument(outputDoc, StringifyOptionsInput.fromOptions(options))}`,
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
});

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
 * **Directive-carrying input keeps its prologue.** The stringifier does not
 * re-emit `%YAML`/`%TAG` directive lines, and re-emitting a document without
 * its `%TAG` while keeping the shorthand tags that depend on it (`!e!foo`)
 * turns a valid file into one no parser can read. So `format`/`formatToString`
 * leave such input byte-identical (no edits), and `modify`/`modifyToString`
 * keep the directive prologue — every line up to the `---` that ends it —
 * byte for byte, editing only the body after it. A document whose `---` line
 * carries content (`--- !!map`, `--- [1]`) cannot be split there and fails
 * typed with a `DirectiveCarryingDocument` diagnostic.
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
   * `single-quoted`, or `double-quoted` scalar with no tag, and
   * the replacement is a string, number, or boolean, `modify` splices
   * ONLY the target scalar's source span and emits a single edit: a string
   * into a quoted scalar keeps the original quote character, a non-string
   * renders plain (quoting it would change the resolved type), and every
   * byte outside the span — line endings included, so a CRLF document keeps
   * its CRLFs and a same-line trailing comment survives — is untouched. The
   * splice is taken only when the rendered text re-parses to exactly the
   * caller's value and renders as a single line; a no-op replacement yields
   * no edits. Anything else — removals (`value === undefined`), nulls,
   * insertions, object/array values, block or multi-line scalars, tagged
   * targets, aliases, or any document-shaping / explicit-style option
   * (`defaultScalarStyle`, `forceDefaultStyles`, `sortKeys`, `indent`,
   * `indentSequences`, `finalNewline`) — falls back to re-serialising the
   * whole document, which normalises line endings to LF, applies those
   * options, and renders the replacement in the stringifier's styles.
   * A replaced node's anchor (never its tag or comments, which describe the
   * replaced value rather than the slot) is carried onto the replacement, so
   * an alias that names it resolves to the new value instead of dangling.
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
   * **Directive prologues are kept verbatim.** A document carrying
   * `%YAML`/`%TAG` directives keeps its prologue — the directive, comment
   * and blank lines through the `---` marker that ends them — byte for byte:
   * a splice touches only its target span, and the whole-document pipeline
   * renders only the body and re-prepends the source prologue, so no `%TAG`
   * is lost from under the shorthand tags that depend on it. A comment on the
   * marker line belongs to the body, which renders it on its own line below
   * the marker, as it does for a directive-less `--- # comment`. When that
   * `---` line carries content (`--- !!map`, `--- [1]`), the body cannot be
   * split from the prologue and the pipeline fails with
   * {@link YamlModificationError} carrying a `DirectiveCarryingDocument`
   * diagnostic. A literal `%TAG` inside a scalar is content, not a directive.
   *
   * **The declared YAML version governs fresh quoting.** modify writes YAML
   * 1.2. Under a `%YAML 1.1` directive it also quotes every string it writes
   * that a YAML 1.1 reader would resolve to a non-string (`on`, `yes`,
   * `0777`, `1:30`, a date), on the splice and the whole-document path alike
   * and for inserted keys too, while source scalars keep their bytes. Any
   * other declared version fails with an `UnsupportedYamlVersion` diagnostic
   * rather than guessing its resolution rules.
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
      const version = declaredYamlVersion(doc.directives);
      if (O.isSome(version) && version.value !== "1.1" && version.value !== "1.2") {
        return yield* modifyRefusal(
          text,
          index,
          path,
          "UnsupportedYamlVersion",
          `Cannot modify a %YAML ${version.value} document: modify writes YAML 1.2, and YAML 1.1 under a %YAML 1.1 directive`
        );
      }
      const yaml11 = O.contains(version, "1.1");

      const regional = tryRegionalScalarEdit(
        text,
        doc,
        path,
        value,
        yaml11 ? YamlStringifyOptions.make({ ...options, quoteCompat: "yaml-1.1" }) : options
      );
      if (regional !== undefined) {
        return A.map(regional, (e) => YamlEdit.make(e));
      }
      return yield* rewriteWholeDocument({ text, index, doc, path, value, options, yaml11 });
    })
  );

  /**
   * Modify `text` and apply the resulting edits in one step
   * (`YamlEdit.applyAll ∘ modify`). Inherits the {@link YamlFormat.modify}
   * error channel, including the single-document contract's
   * `MultiDocumentStream` refusal and the `DirectiveCarryingDocument`
   * refusal of a directive prologue whose `---` line carries content.
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
