/**
 * The parsed-document concept: YamlDocument (root AST node plus
 * errors/warnings-as-data, directives and document framing) and
 * YamlDirective.
 *
 * **Details**
 *
 * The recoverable-parse design lives here: non-fatal diagnostics surface as
 * data on `errors`/`warnings` while fatal ones fail `parse`/`parseAll` with a
 * typed `YamlParseError`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { composeAllDocuments, composeFirstDocument } from "./internal/composer/document.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import { ParseOptionsInput, StringifyOptionsInput } from "./internal/options.ts";
import { RawDirective, RawYamlDocument } from "./internal/raw-document.ts";
import { StringifyDepthExceeded, StringifyFailure, stringifyDocument } from "./internal/stringifier.ts";
import { YamlParseError, YamlStringifyError } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import { YamlNode } from "./YamlNode.ts";
import type { YamlParseOptions, YamlStringifyOptions } from "./Yaml.ts";
import type { YamlNode as YamlNodeType } from "./YamlNode.ts";

const isStringifyFailure = S.is(StringifyFailure);
const isStringifyDepthExceeded = S.is(StringifyDepthExceeded);

const $I = $YamlId.create("YamlDocument");

/**
 * **Example** (Construct a YAML version directive)
 *
 * ```ts
 * import { YamlDirective } from "@beep/yaml/YamlDocument"
 *
 * const directive = YamlDirective.make({ name: "YAML", parameters: ["1.2"] })
 * console.log(directive.parameters[0]) // 1.2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlDirective extends S.Opaque<YamlDirective, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(
      $I.annoteKey("YamlDirective.name", {
        description: "Directive identifier without the leading `%`, such as `YAML`, `TAG`, or a reserved directive",
      })
    ),
    parameters: S.Array(S.String).pipe(
      $I.annoteKey("YamlDirective.parameters", {
        description:
          "Ordered whitespace-separated arguments following the directive identifier, excluding any trailing comment",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlDirective", {
      description:
        'A YAML directive appearing before a document (e.g. `%YAML 1.2` or `%TAG ! tag:example.com,2000:`). `"YAML"` and `"TAG"` are the YAML 1.2 spec-defined directives; any other name is a reserved directive preserved for round-trip fidelity.',
    })
  )
) {}

/**
 * **Details**
 *
 * `commentBefore` is a header block sitting AHEAD of a `---` marker; `comment`
 * is the trailing block after the content or the `...` marker. A header with
 * no marker, or one after the marker, belongs to the content rather than the
 * document — it leads the root node, or the first entry when there is no
 * marker to separate it from the item stream.
 *
 * Construct via `YamlDocument.parse` / `parseAll`; `YamlDocument.make` is for
 * synthetic documents.
 *
 * **Example** (Parse a YAML document and inspect recovered errors)
 *
 * ```ts
 * import { YamlDocument } from "@beep/yaml/YamlDocument"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const doc = yield* YamlDocument.parse("# header\nname: Alice\n")
 *   return doc.errors.length; // 0 — no recovered errors
 * })
 * console.log(Effect.runSync(program)) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlDocument extends S.Class<YamlDocument, { readonly brand: unique symbol }>($I`YamlDocument`)(
  {
    contents: S.NullOr(S.suspend((): typeof YamlNode => YamlNode)).pipe(
      $I.annoteKey("YamlDocument.contents", { description: "Root YAML syntax node, or `null` for an empty document" })
    ),
    errors: S.Array(YamlDiagnostic).pipe(
      $I.annoteKey("YamlDocument.errors", {
        description:
          "Error diagnostics retained during document composition; successful parsing retains only non-fatal errors",
      })
    ),
    warnings: S.Array(YamlDiagnostic).pipe(
      $I.annoteKey("YamlDocument.warnings", { description: "Warning diagnostics retained during document composition" })
    ),
    directives: S.Array(YamlDirective).pipe(
      $I.annoteKey("YamlDocument.directives", {
        description:
          "Ordered directives preceding the document, including YAML version, tag declarations, and reserved directives",
      })
    ),
    commentBefore: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlDocument.commentBefore", {
        description: "Document header comment block preceding the `---` marker",
      })
    ),
    comment: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlDocument.comment", {
        description: "Trailing document comment block after the contents or `...` marker",
      })
    ),
    hasDocumentStart: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlDocument.hasDocumentStart", {
        description: "Whether the document has an explicit `---` start marker; absence means `false`",
      })
    ),
    hasDocumentEnd: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlDocument.hasDocumentEnd", {
        description: "Whether the document has an explicit `...` end marker; absence means `false`",
      })
    ),
    hasDocumentStartTab: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlDocument.hasDocumentStartTab", {
        description:
          "Whether a tab immediately followed the source `---` marker, prompting a terminator during canonical stringification",
      })
    ),
  },
  $I.annote("YamlDocument", {
    description:
      "A parsed YAML document: the root (YamlNode:type) (or `null` when empty), recovered `errors` and `warnings` as YamlDiagnostic data, the YamlDirective list, the optional document-level comments and the `---`/`...` framing flags (absent flags read as `false`).",
  })
) {
  /**
   * Parse a single YAML document, keeping the full AST, directives and
   * recovered diagnostics. Fails with the aggregate {@link YamlParseError}
   * when any fatal-code diagnostic is present; non-fatal diagnostics are
   * data on the returned document.
   *
   * **Example** (Parse one document with its framing)
   *
   * ```ts
   * import { YamlDocument } from "@beep/yaml/YamlDocument"
   * import * as Effect from "effect/Effect"
   *
   * const document = Effect.runSync(YamlDocument.parse("---\nname: Alice\n"))
   * console.log(document.hasDocumentStart) // true
   * ```
   *
   * @param text - The YAML source to parse.
   * @param options - Optional {@link YamlParseOptions}; defaults apply for
   *   omitted fields.
   * @returns An `Effect` that succeeds with the {@link YamlDocument}, or fails
   *   with {@link YamlParseError}.
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse: {
    (options?: YamlParseOptions): (text: string) => Effect.Effect<YamlDocument, YamlParseError>;
    (text: string, options?: YamlParseOptions): Effect.Effect<YamlDocument, YamlParseError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("YamlDocument.parse")(function* (text: string, options?: YamlParseOptions) {
      const index = YamlDiagnostic.positionIndex(text);
      const raw = composeFirstDocument(text, ParseOptionsInput.fromOptions(options));
      const fatal = A.filter(raw.errors, (e) => isFatalCode(e.code));
      if (fatal.length > 0) {
        return yield* YamlParseError.make({
          diagnostics: YamlDiagnostic.fromRawBatch(fatal, text, index),
          input: text,
        });
      }
      return fromRawDocument(raw, text, index);
    })
  );

  /**
   * Parse a multi-document YAML stream into one {@link YamlDocument} per
   * document. Any fatal diagnostic in any document — or a stream-level
   * directive-placement error — fails the whole Effect.
   *
   * **Example** (Parse a two document stream)
   *
   * ```ts
   * import { YamlDocument } from "@beep/yaml/YamlDocument"
   * import * as Effect from "effect/Effect"
   *
   * const documents = Effect.runSync(YamlDocument.parseAll("---\na: 1\n---\nb: 2\n"))
   * console.log(documents.length) // 2
   * ```
   *
   * @param text - The YAML stream to parse.
   * @param options - Optional {@link YamlParseOptions}; defaults apply for
   *   omitted fields.
   * @returns An `Effect` that succeeds with one {@link YamlDocument} per
   *   document, or fails with {@link YamlParseError}.
   * @category parsing
   * @since 0.0.0
   */
  static readonly parseAll: {
    (options?: YamlParseOptions): (text: string) => Effect.Effect<Array<YamlDocument>, YamlParseError>;
    (text: string, options?: YamlParseOptions): Effect.Effect<Array<YamlDocument>, YamlParseError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("YamlDocument.parseAll")(function* (text: string, options?: YamlParseOptions) {
      const index = YamlDiagnostic.positionIndex(text);
      const { documents, streamErrors } = composeAllDocuments(text, ParseOptionsInput.fromOptions(options));
      const fatal = [
        ...A.filter(streamErrors, (e) => isFatalCode(e.code)),
        ...A.flatMap(documents, (d) => A.filter(d.errors, (e) => isFatalCode(e.code))),
      ];
      if (fatal.length > 0) {
        return yield* YamlParseError.make({
          diagnostics: YamlDiagnostic.fromRawBatch(fatal, text, index),
          input: text,
        });
      }
      return A.map(documents, fromRawDocument(text, index));
    })
  );

  /**
   * A `Schema<YamlDocument, string>` decoding YAML text into a full
   * document (AST, directives, diagnostics) and encoding a document back to
   * YAML text.
   *
   * **Details**
   *
   * Schema-producing: each call returns a fresh schema whose derivation
   * caches are not shared across calls; bind the result to a `const` on hot
   * paths.
   *
   * **Example** (Decode YAML through a document codec)
   *
   * ```ts
   * import { YamlDocument } from "@beep/yaml/YamlDocument"
   * import * as S from "effect/Schema"
   *
   * const schema = YamlDocument.schema()
   * const document = S.decodeUnknownSync(schema)("name: Alice\n")
   * console.log(document.errors.length) // 0
   * ```
   *
   * @param options - Optional {@link YamlParseOptions} applied on decode.
   * @returns A `Schema.Codec<YamlDocument, string>`.
   * @category schemas
   * @since 0.0.0
   */
  static schema(options?: YamlParseOptions): S.Codec<YamlDocument, string> {
    return S.String.pipe(
      S.decodeTo(
        S.instanceOf(YamlDocument),
        SchemaTransformation.transformEffect({
          decode: (input: string) =>
            YamlDocument.parse(input, options).pipe(
              Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input))
            ),
          encode: (doc: YamlDocument) =>
            doc
              .stringify()
              .pipe(Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, doc))),
        })
      )
    );
  }

  /**
   * Stringify this document (contents, directives and framing) as YAML.
   * Fails with {@link YamlStringifyError} on circular references introduced
   * into a synthetic AST (`CircularReference`) or on a synthetic AST nested
   * deeper than the stringifier's recursion budget (`NestingDepthExceeded`)
   * — both surface through the typed error channel rather than as an
   * unhandled stack-overflow defect.
   *
   * **Gotchas**
   *
   * `YamlStringifyOptions.lineWidth` is not honored here: column-based
   * scalar folding exists only on the value path, through the entry points
   * that accept stringify options ({@link Yaml.stringify} and
   * {@link Yaml.stringifyResult}). The
   * document/node path threads `lineWidth` into its render context but
   * never reads it, so long scalars are emitted unfolded regardless of the
   * option. Callers that need folding should render the plain value
   * instead — `Yaml.stringify(doc.toValue(), options)` — at the cost of
   * the document-level framing and styles this path preserves.
   *
   * **Example** (Render document framing as YAML)
   *
   * ```ts
   * import { YamlDocument } from "@beep/yaml/YamlDocument"
   * import * as Effect from "effect/Effect"
   *
   * const document = Effect.runSync(YamlDocument.parse("---\nname: Alice\n"))
   * console.log(JSON.stringify(Effect.runSync(document.stringify()))) // "---\nname: Alice\n"
   * ```
   *
   * @param options - Optional {@link YamlStringifyOptions}; defaults apply for
   *   omitted fields.
   * @returns An `Effect` that succeeds with the YAML text, or fails with
   *   {@link YamlStringifyError}.
   * @category serialization
   * @since 0.0.0
   */
  stringify(options?: YamlStringifyOptions): Effect.Effect<string, YamlStringifyError> {
    return Effect.try({
      try: () => stringifyDocument(toRawDocument(this), StringifyOptionsInput.fromOptions(options)),
      catch: (defect) => {
        if (isStringifyFailure(defect)) {
          return YamlStringifyError.make({
            diagnostics: [
              YamlDiagnostic.make({
                code: "CircularReference",
                message: defect.reason,
                offset: 0,
                length: 0,
                line: 0,
                character: 0,
              }),
            ],
            value: this,
          });
        }
        if (isStringifyDepthExceeded(defect)) {
          return YamlStringifyError.make({
            diagnostics: [
              YamlDiagnostic.make({
                code: "NestingDepthExceeded",
                message: defect.message,
                offset: 0,
                length: 0,
                line: 0,
                character: 0,
              }),
            ],
            value: this,
          });
        }
        throw defect;
      },
    });
  }

  /**
   * Reconstruct the plain JavaScript value of this document's contents,
   * resolving anchors and aliases. `null` for an empty document. Pure and
   * total.
   *
   * **Example** (Read the value of an empty document)
   *
   * ```ts
   * import { YamlDocument } from "@beep/yaml/YamlDocument"
   *
   * const document = YamlDocument.make({
   *   contents: null, errors: [], warnings: [], directives: []
   * })
   * console.log(document.toValue()) // null
   * ```
   *
   * @category destructors
   * @since 0.0.0
   */
  toValue(): unknown {
    if (this.contents === null) return null;
    const anchors = MutableHashMap.empty<string, YamlNodeType>();
    return this.contents.toValue(anchors);
  }
}

/**
 * Materialize a raw engine document into the public class — including
 * documents whose diagnostics are fatal, which `YamlDocument.parse` refuses.
 * The lint layer builds its context through this so linting runs on
 * malformed input; it is NOT a second public parse entry point (not
 * re-exported from the package index).
 *
 * **Example** (Materialize a raw empty document)
 *
 * ```ts
 * import { documentFromRaw } from "@beep/yaml/YamlDocument"
 *
 * const document = documentFromRaw({
 *   contents: null, errors: [], warnings: [], directives: [],
 *   hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false
 * }, "")
 * console.log(document.contents) // null
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const documentFromRaw: {
  (raw: RawYamlDocument, text: string): YamlDocument;
  (text: string): (raw: RawYamlDocument) => YamlDocument;
} = dual(2, (raw: RawYamlDocument, text: string): YamlDocument => fromRawDocument(raw, text));

const fromRawDocument: {
  (text: string, index?: ReturnType<typeof YamlDiagnostic.positionIndex>): (raw: RawYamlDocument) => YamlDocument;
  (raw: RawYamlDocument, text: string, index?: ReturnType<typeof YamlDiagnostic.positionIndex>): YamlDocument;
} = dual(
  (args) => P.isObjectKeyword(args[0]),
  (
    raw: RawYamlDocument,
    text: string,
    index: ReturnType<typeof YamlDiagnostic.positionIndex> = YamlDiagnostic.positionIndex(text)
  ): YamlDocument =>
    YamlDocument.make({
      contents: raw.contents,
      errors: YamlDiagnostic.fromRawBatch(raw.errors, text, index),
      warnings: YamlDiagnostic.fromRawBatch(raw.warnings, text, index),
      directives: A.map(raw.directives, (d) => YamlDirective.make({ name: d.name, parameters: d.parameters })),
      ...O.getSomesStruct({ commentBefore: O.fromUndefinedOr(raw.commentBefore) }),
      ...O.getSomesStruct({ comment: O.fromUndefinedOr(raw.comment) }),
      hasDocumentStart: raw.hasDocumentStart,
      hasDocumentEnd: raw.hasDocumentEnd,
      hasDocumentStartTab: raw.hasDocumentStartTab,
    })
);

function toRawDocument(doc: YamlDocument): RawYamlDocument {
  return RawYamlDocument.make({
    contents: doc.contents,
    errors: [],
    warnings: [],
    directives: A.map(doc.directives, (d) => RawDirective.make({ name: d.name, parameters: d.parameters })),
    ...O.getSomesStruct({ commentBefore: O.fromUndefinedOr(doc.commentBefore) }),
    ...O.getSomesStruct({ comment: O.fromUndefinedOr(doc.comment) }),
    hasDocumentStart: doc.hasDocumentStart ?? false,
    hasDocumentEnd: doc.hasDocumentEnd ?? false,
    hasDocumentStartTab: doc.hasDocumentStartTab ?? false,
  });
}
