/**
 * Pandoc JSON wire codecs for the schema-first Pandoc AST model.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.codec
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A, dual, flow, O, P, R, Struct } from "@beep/utils";
import { Effect, Match, SchemaGetter, SchemaIssue } from "effect";
import * as S from "effect/Schema";
import {
  isPandocKnownConstructorName,
  isPandocSupportedConstructorName,
  isPandocTableAlignmentConstructorName,
} from "./internal/Pandoc.registry.ts";
import {
  BlockQuote,
  BulletList,
  Code,
  CodeBlock,
  Div,
  Emph,
  Header,
  HorizontalRule,
  Image,
  LineBreak,
  Link,
  Math,
  MetaBlocks,
  MetaBool,
  MetaInlines,
  MetaList,
  MetaMap,
  MetaString,
  Note,
  OrderedList,
  PandocApiVersion,
  PandocAttr,
  PandocDocument,
  PandocKeyValue,
  PandocListNumberDelimiter,
  PandocListNumberStyle,
  PandocMathType,
  PandocTablePayload,
  PandocTarget,
  PandocUnknownConstructorWire,
  Para,
  Plain,
  SoftBreak,
  Space,
  Span,
  Str,
  Strikeout,
  Strong,
  Table,
  UnknownBlock,
  UnknownInline,
  UnknownMeta,
} from "./Pandoc.model.ts";
import { JsonPath } from "./Pandoc.report.ts";
import type { PandocBlock, PandocInline, PandocMeta, PandocMetaValue } from "./Pandoc.model.ts";
import type { JsonPath as JsonPathType } from "./Pandoc.report.ts";

const $I = $PandocAstId.create("Pandoc.codec");
type PandocConstructorContext = "block" | "inline" | "meta";

/**
 * Generic Pandoc constructor wire shape.
 *
 * **Example** (Make constructor wire)
 *
 * ```ts
 * import { PandocConstructorWire } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const wire = PandocConstructorWire.make({ c: "hello", t: "Str" })
 * console.log(wire.t) // "Str"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocConstructorWire = PandocUnknownConstructorWire.pipe(
  $I.annoteSchema("PandocConstructorWire", {
    description: "Generic exact Pandoc constructor wire shape.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Companion namespace for {@link PandocConstructorWire}.
 *
 * **Example** (Type constructor wire)
 *
 * ```ts
 * import { PandocConstructorWire } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const wire: PandocConstructorWire = PandocConstructorWire.make({ t: "Space" })
 * console.log(wire.t) // "Space"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocConstructorWire = typeof PandocConstructorWire.Type;

/**
 * Pandoc JSON document wire shape.
 *
 * **Example** (Decode empty document wire)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocJsonWire } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const decode = S.decodeUnknownSync(PandocJsonWire)
 * console.log(decode({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks: [] }).blocks.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocJsonWire extends S.Class<PandocJsonWire>($I`PandocJsonWire`)(
  {
    "pandoc-api-version": PandocApiVersion.annotateKey({
      description: "Pandoc API version tuple.",
    }),
    blocks: S.Array(S.Json).annotateKey({
      description: "Pandoc block constructor array.",
    }),
    meta: S.Record(S.String, S.Json).annotateKey({
      description: "Pandoc metadata map.",
    }),
  },
  $I.annote("PandocJsonWire", {
    description: "Pandoc JSON document wire shape.",
  })
) {}

/**
 * Companion namespace for {@link PandocJsonWire}.
 *
 * **Example** (Make empty document wire)
 *
 * ```ts
 * import { PandocJsonWire } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const wire: PandocJsonWire.Type = PandocJsonWire.make({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [],
 *   meta: {},
 * })
 * console.log(wire.blocks.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocJsonWire {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly blocks: ReadonlyArray<S.Json>;
    readonly meta: Readonly<Record<string, S.Json>>;
    readonly "pandoc-api-version": PandocApiVersion;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc JSON string codec.
 *
 * **Example** (Decode JSON string wire)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocJsonFromString } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const decode = S.decodeUnknownSync(PandocJsonFromString)
 * const wire = decode(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`)
 * console.log(wire.blocks.length) // 0
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const PandocJsonFromString = S.fromJsonString(PandocJsonWire).pipe(
  $I.annoteSchema("PandocJsonFromString", {
    description: "Pandoc JSON string codec.",
  })
);

/**
 * Runtime type for {@link PandocJsonFromString}.
 *
 * **Example** (Annotate wire type)
 *
 * ```ts
 * import type { PandocJsonFromString } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const wire: PandocJsonFromString = {
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [],
 *   meta: {},
 * }
 * console.log(wire.blocks.length) // 0
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export type PandocJsonFromString = typeof PandocJsonFromString.Type;

const PandocJsonObject = S.Record(S.String, S.Json);
const PandocJsonObjectFromString = S.fromJsonString(PandocJsonObject);

/**
 * Typed failure raised by strict or lossless Pandoc JSON decoding.
 *
 * **Example** (Catch decode error tag)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodePandocJsonStrict } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const handled = decodePandocJsonStrict(null).pipe(
 *   Effect.catchTag("PandocDecodeError", (error) => Effect.succeed(error.message))
 * )
 * Effect.runPromise(handled).then(console.log)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PandocDecodeError extends S.TaggedError<PandocDecodeError>($I`PandocDecodeError`)(
  "PandocDecodeError",
  {
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("PandocDecodeError", {
    description: "Typed failure raised when a Pandoc semantic or lossless JSON payload cannot be decoded.",
  })
) {}

/**
 * A diagnostic produced while inspecting a lossless Pandoc document.
 *
 * **Example** (Make lossless issue)
 *
 * ```ts
 * import { PandocLosslessIssue } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const issue = PandocLosslessIssue.make({
 *   constructor: "Para",
 *   context: "block",
 *   message: "Malformed block.",
 *   path: ["blocks", 0],
 * })
 * console.log(issue.pointer) // "/blocks/0"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class PandocLosslessIssue extends S.Class<PandocLosslessIssue>($I`PandocLosslessIssue`)(
  {
    constructor: S.String,
    context: S.Literals(["block", "inline", "meta"]),
    message: S.NonEmptyString,
    path: JsonPath,
  },
  $I.annote("PandocLosslessIssue", {
    description: "Diagnostic produced while inspecting a lossless Pandoc document.",
  })
) {
  get pointer(): string {
    return JsonPath.toPointer(this.path);
  }
}

/**
 * Exact raw top-level block in a lossless document.
 *
 * **Example** (Check future block shape)
 *
 * ```ts
 * import { PandocLosslessBlock } from "@beep/pandoc-ast/Pandoc.codec"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PandocLosslessBlock)({ c: [], t: "FutureBlock" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PandocLosslessBlock = S.Json.pipe(
  $I.annoteSchema("PandocLosslessBlock", {
    description: "Exact raw top-level Pandoc block retained by lossless decoding.",
  })
);

/**
 * Runtime type for {@link PandocLosslessBlock}.
 *
 * **Example** (Annotate lossless block)
 *
 * ```ts
 * import type { PandocLosslessBlock } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const block: PandocLosslessBlock = { c: "hello", t: "Str" }
 * console.log(block)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocLosslessBlock = typeof PandocLosslessBlock.Type;

/**
 * Lossless Pandoc envelope with exact raw views and recursive diagnostics.
 *
 * **Details**
 *
 * {@link wire} remains the single source used by lossless encoding. The
 * block and metadata views remain exact raw JSON and are never replaced by
 * synthetic semantic nodes.
 *
 * **Example** (Decode lossless empty document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodePandocJsonLossless } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const program = decodePandocJsonLossless({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [],
 *   meta: {},
 * })
 * Effect.runPromise(program).then((document) => console.log(document.blocks.length))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
type ExactPandocLosslessWire = Readonly<Record<string, S.Json>> & PandocJsonWire.Type;

function clonePandocJson(value: S.Json): S.Json {
  if (A.isArray(value)) {
    return A.map(value as ReadonlyArray<S.Json>, clonePandocJson);
  }
  return P.isObject(value)
    ? R.fromEntries(
        A.map(Struct.entries(value as Readonly<Record<string, S.Json>>), ([key, entry]) => [
          key,
          clonePandocJson(entry),
        ])
      )
    : value;
}

const clonePandocJsonRecord = (value: Readonly<Record<string, S.Json>>): Readonly<Record<string, S.Json>> =>
  R.fromEntries(A.map(Struct.entries(value), ([key, entry]) => [key, clonePandocJson(entry)]));

const cloneLosslessIssue = (issue: PandocLosslessIssue): PandocLosslessIssue =>
  PandocLosslessIssue.make({
    constructor: issue.constructor,
    context: issue.context,
    message: issue.message,
    path: A.fromIterable(issue.path),
  });

class PandocLosslessDocumentValue {
  readonly #proof = true;
  readonly #wire: ExactPandocLosslessWire;
  readonly #issues: ReadonlyArray<PandocLosslessIssue>;

  constructor(wire: Readonly<Record<string, S.Json>>, issues: ReadonlyArray<PandocLosslessIssue>) {
    this.#wire = clonePandocJsonRecord(wire) as ExactPandocLosslessWire;
    this.#issues = A.map(issues, cloneLosslessIssue);
  }

  static is(value: unknown): value is PandocLosslessDocumentValue {
    return P.isObject(value) && #proof in value;
  }

  get apiVersion(): PandocApiVersion {
    return A.map(this.#wire["pandoc-api-version"], (part) => part);
  }

  get blocks(): ReadonlyArray<PandocLosslessBlock> {
    return A.map(this.#wire.blocks, clonePandocJson);
  }

  get issues(): ReadonlyArray<PandocLosslessIssue> {
    return A.map(this.#issues, cloneLosslessIssue);
  }

  get meta(): Readonly<Record<string, S.Json>> {
    return clonePandocJsonRecord(this.#wire.meta);
  }

  get wire(): Readonly<Record<string, S.Json>> {
    return clonePandocJsonRecord(this.#wire);
  }
}

/**
 * Module-issued lossless Pandoc envelope.
 *
 * **Details**
 *
 * The public schema has no arbitrary constructor: decoding is the only issuer,
 * so the derived views and diagnostics cannot contradict the retained wire.
 *
 * **Example** (Validate decoded lossless document)
 *
 * ```ts
 * import {
 *   decodePandocJsonLossless,
 *   PandocLosslessDocument,
 * } from "@beep/pandoc-ast/Pandoc.codec"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const document = Effect.runSync(
 *   decodePandocJsonLossless({
 *     "pandoc-api-version": [1, 23, 1],
 *     blocks: [],
 *     meta: {},
 *   })
 * )
 *
 * console.log(S.is(PandocLosslessDocument)(document)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PandocLosslessDocument = S.declare(PandocLosslessDocumentValue.is).pipe(
  $I.annoteSchema("PandocLosslessDocument", {
    description: "Module-issued lossless Pandoc envelope with wire-derived views and diagnostics.",
  })
);

/**
 * Decoded type of {@link PandocLosslessDocument}.
 *
 * **Example** (Type decoded lossless document)
 *
 * ```ts
 * import {
 *   decodePandocJsonLossless,
 *   type PandocLosslessDocument,
 * } from "@beep/pandoc-ast/Pandoc.codec"
 * import { Effect } from "effect"
 *
 * const document: PandocLosslessDocument = Effect.runSync(
 *   decodePandocJsonLossless({
 *     "pandoc-api-version": [1, 23, 1],
 *     blocks: [],
 *     meta: {},
 *   })
 * )
 *
 * console.log(document.issues.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocLosslessDocument = typeof PandocLosslessDocument.Type;

const issuePandocLosslessDocument = (
  wire: Readonly<Record<string, S.Json>>,
  issues: ReadonlyArray<PandocLosslessIssue>
): PandocLosslessDocument => new PandocLosslessDocumentValue(wire, issues);

const AttrWire = S.Tuple([S.String, S.Array(S.String), S.Array(PandocKeyValue)]);
const TargetWire = S.Tuple([S.String, S.String]);
const HeaderPayloadWire = S.Tuple([S.Int, AttrWire, S.Array(S.Unknown)]);
const CodePayloadWire = S.Tuple([AttrWire, S.String]);
const DivPayloadWire = S.Tuple([AttrWire, S.Array(S.Unknown)]);
const LinkPayloadWire = S.Tuple([AttrWire, S.Array(S.Unknown), TargetWire]);
const NotePayloadWire = S.Array(S.Unknown);
const MathPayloadWire = S.Tuple([PandocConstructorWire, S.String]);
const OrderedListPayloadWire = S.Tuple([S.Tuple([S.Int, S.Unknown, S.Unknown]), S.Unknown]);
const BlockItemsWire = S.Unknown.pipe(S.Array, S.Array);
const TableCaptionPairWire = S.Tuple([S.Unknown.pipe(S.Array, S.NullOr), S.Array(S.Unknown)]);
const TableColumnSpecWire = S.Tuple([S.Unknown, S.Unknown]);
const TableCellWire = S.Tuple([AttrWire, S.Unknown, S.Int, S.Int, S.Array(S.Unknown)]);
const TableRowWire = S.Tuple([AttrWire, S.Array(S.Unknown)]);
const TableHeadWire = S.Tuple([AttrWire, S.Array(S.Unknown)]);
const TableBodyWire = S.Tuple([AttrWire, S.Int, S.Array(S.Unknown), S.Array(S.Unknown)]);
const LosslessTablePayloadWire = S.Tuple([AttrWire, S.Json, S.Array(S.Json), S.Json, S.Array(S.Json), S.Json]);
type AttrWireValue = Readonly<[string, ReadonlyArray<string>, ReadonlyArray<PandocKeyValue>]>;
type TargetWireValue = Readonly<[string, string]>;

const attrWireToPandoc = ([id, classes, keyValues]: AttrWireValue): PandocAttr.Encoded => ({
  classes,
  id,
  keyValues,
});

const pandocAttrToWire = (attr: PandocAttr.Encoded): AttrWireValue => [attr.id, attr.classes, attr.keyValues];

const targetWireToPandoc = ([url, title]: TargetWireValue): PandocTarget.Encoded => ({
  title,
  url,
});

const pandocTargetToWire = (target: PandocTarget.Encoded): TargetWireValue => [target.url, target.title];

const PandocAttrFromWire = AttrWire.pipe(
  S.decodeTo(PandocAttr, {
    decode: SchemaGetter.transform(attrWireToPandoc),
    encode: SchemaGetter.transform(pandocAttrToWire),
  })
);

const PandocTargetFromWire = TargetWire.pipe(
  S.decodeTo(PandocTarget, {
    decode: SchemaGetter.transform(targetWireToPandoc),
    encode: SchemaGetter.transform(pandocTargetToWire),
  })
);

const decodeConstructor = S.decodeUnknownEffect(PandocConstructorWire);
const decodeWire = S.decodeUnknownEffect(PandocJsonWire);
const decodeWireFromString = S.decodeUnknownEffect(PandocJsonFromString);
const encodeWireToString = S.encodeEffect(PandocJsonFromString);
const decodeJsonObject = S.decodeUnknownEffect(PandocJsonObject);
const decodeJsonObjectFromString = S.decodeUnknownEffect(PandocJsonObjectFromString);
const encodeJsonObjectToString = S.encodeEffect(PandocJsonObjectFromString);
const decodeString = S.decodeUnknownEffect(S.String);
const decodeFinite = S.decodeUnknownEffect(S.Finite);
const decodeAttrWire = S.decodeUnknownEffect(PandocAttrFromWire);
const decodeTargetWire = S.decodeUnknownEffect(PandocTargetFromWire);
const decodeUnknownArray = S.decodeUnknownEffect(S.Array(S.Unknown));
const decodeHeaderPayloadWire = S.decodeUnknownEffect(HeaderPayloadWire);
const decodeCodePayloadWire = S.decodeUnknownEffect(CodePayloadWire);
const decodeDivPayloadWire = S.decodeUnknownEffect(DivPayloadWire);
const decodeLinkPayloadWire = S.decodeUnknownEffect(LinkPayloadWire);
const decodeNotePayloadWire = S.decodeUnknownEffect(NotePayloadWire);
const decodeMathPayloadWire = S.decodeUnknownEffect(MathPayloadWire);
const decodeOrderedListPayloadWire = S.decodeUnknownEffect(OrderedListPayloadWire);
const decodeBlockItemsWire = S.decodeUnknownEffect(BlockItemsWire);
const decodeTablePayloadWire = S.decodeUnknownEffect(PandocTablePayload);
const decodeLosslessTablePayloadWire = S.decodeUnknownEffect(LosslessTablePayloadWire);
const decodeTableCaptionPairWire = S.decodeUnknownEffect(TableCaptionPairWire);
const decodeTableColumnSpecWire = S.decodeUnknownEffect(TableColumnSpecWire);
const decodeTableCellWire = S.decodeUnknownEffect(TableCellWire);
const decodeTableRowWire = S.decodeUnknownEffect(TableRowWire);
const decodeTableHeadWire = S.decodeUnknownEffect(TableHeadWire);
const decodeTableBodyWire = S.decodeUnknownEffect(TableBodyWire);
const decodeConstructorOption = S.decodeUnknownOption(PandocConstructorWire);
const decodeListNumberStyle = S.decodeUnknownEffect(PandocListNumberStyle);
const decodeListNumberDelimiter = S.decodeUnknownEffect(PandocListNumberDelimiter);
const decodeMathType = S.decodeUnknownOption(PandocMathType);
const decodeBoolean = S.decodeUnknownEffect(S.Boolean);
const decodeJsonArray = S.decodeUnknownEffect(S.Array(S.Json));
const decodeJsonRecord = S.decodeUnknownEffect(S.Record(S.String, S.Json));
const decodeAbsentPayload = S.decodeUnknownEffect(S.Undefined);

const decodeAndTakeT = flow(decodeConstructor, Effect.map(Struct.get("t")));

const listNumberStyleFromWire = flow(decodeAndTakeT, Effect.flatMap(decodeListNumberStyle));
const listNumberDelimiterFromWire = flow(decodeAndTakeT, Effect.flatMap(decodeListNumberDelimiter));

const attrFromWire: (input: unknown) => Effect.Effect<PandocAttr, S.SchemaError> = decodeAttrWire;

const targetFromWire: (input: unknown) => Effect.Effect<PandocTarget, S.SchemaError> = decodeTargetWire;

const decodeInlines = flow(
  decodeUnknownArray,
  Effect.flatMap((values) => Effect.forEach(values, decodeInline))
);

const decodeBlockList = flow(
  decodeUnknownArray,
  Effect.flatMap((values) => Effect.forEach(values, decodeBlock))
);

const unknownInline = (wire: PandocConstructorWire): UnknownInline => UnknownInline.make({ wire });

const unknownBlock = (wire: PandocConstructorWire): UnknownBlock => UnknownBlock.make({ wire });

const rejectKnownConstructorInContext = (
  wire: PandocConstructorWire,
  context: PandocConstructorContext
): Effect.Effect<never, S.SchemaError> =>
  Effect.fail(
    new S.SchemaError(
      new SchemaIssue.InvalidValue({
        message: `Known Pandoc constructor ${wire.t} cannot occur in ${context} context`,
      })
    )
  );

const rejectUnsupportedCurrentConstructor = (
  wire: PandocConstructorWire,
  context: PandocConstructorContext
): Effect.Effect<never, S.SchemaError> =>
  Effect.fail(
    new S.SchemaError(
      new SchemaIssue.InvalidValue({
        message: `Pandoc 1.23.1 ${context} constructor ${wire.t} is outside the strict semantic subset`,
      })
    )
  );

const rejectKnownConstructor = (
  wire: PandocConstructorWire,
  context: PandocConstructorContext
): Effect.Effect<never, S.SchemaError> =>
  isPandocSupportedConstructorName(wire.t)
    ? rejectKnownConstructorInContext(wire, context)
    : rejectUnsupportedCurrentConstructor(wire, context);

const rejectUnsupportedConstructorInSlot = (
  wire: PandocConstructorWire,
  slot: string
): Effect.Effect<never, S.SchemaError> =>
  Effect.fail(
    new S.SchemaError(
      new SchemaIssue.InvalidValue({
        message: `Unsupported Pandoc constructor ${wire.t} cannot occur in ${slot}`,
      })
    )
  );

const decodeBlockItems = (
  input: unknown
): Effect.Effect<ReadonlyArray<ReadonlyArray<PandocBlock.Type>>, S.SchemaError> =>
  Effect.flatMap(decodeUnknownArray(input), (items) => Effect.forEach(items, (item) => decodeBlockList(item)));

const decodeChildInline = (
  input: unknown,
  make: (children: ReadonlyArray<PandocInline.Type>) => PandocInline.Type
): Effect.Effect<PandocInline.Type, S.SchemaError> => Effect.map(decodeInlines(input), make);

const decodeAttributedTextInline: {
  (
    input: unknown,
    make: (attr: PandocAttr, text: string) => PandocInline.Type
  ): Effect.Effect<PandocInline.Type, S.SchemaError>;
  (
    make: (attr: PandocAttr, text: string) => PandocInline.Type
  ): (input: unknown) => Effect.Effect<PandocInline.Type, S.SchemaError>;
} = dual(
  2,
  (
    input: unknown,
    make: (attr: PandocAttr, text: string) => PandocInline.Type
  ): Effect.Effect<PandocInline.Type, S.SchemaError> =>
    Effect.flatMap(decodeCodePayloadWire(input), ([attrWire, text]) =>
      Effect.map(attrFromWire(attrWire), (attr) => make(attr, text))
    )
);

const decodeTargetInline: {
  (
    input: unknown,
    make: (attr: PandocAttr, children: ReadonlyArray<PandocInline.Type>, target: PandocTarget) => PandocInline.Type
  ): Effect.Effect<PandocInline.Type, S.SchemaError>;
  (
    make: (attr: PandocAttr, children: ReadonlyArray<PandocInline.Type>, target: PandocTarget) => PandocInline.Type
  ): (input: unknown) => Effect.Effect<PandocInline.Type, S.SchemaError>;
} = dual(
  2,
  (
    input: unknown,
    make: (attr: PandocAttr, children: ReadonlyArray<PandocInline.Type>, target: PandocTarget) => PandocInline.Type
  ): Effect.Effect<PandocInline.Type, S.SchemaError> =>
    Effect.flatMap(decodeLinkPayloadWire(input), ([attrWire, childrenWire, targetWire]) =>
      Effect.flatMap(attrFromWire(attrWire), (attr) =>
        Effect.flatMap(decodeInlines(childrenWire), (children) =>
          Effect.map(targetFromWire(targetWire), (target) => make(attr, children, target))
        )
      )
    )
);

const decodeAttributedInlineChildren: {
  (
    input: unknown,
    make: (attr: PandocAttr, children: ReadonlyArray<PandocInline.Type>) => PandocInline.Type
  ): Effect.Effect<PandocInline.Type, S.SchemaError>;
  (
    make: (attr: PandocAttr, children: ReadonlyArray<PandocInline.Type>) => PandocInline.Type
  ): (input: unknown) => Effect.Effect<PandocInline.Type, S.SchemaError>;
} = dual(
  2,
  (
    input: unknown,
    make: (attr: PandocAttr, children: ReadonlyArray<PandocInline.Type>) => PandocInline.Type
  ): Effect.Effect<PandocInline.Type, S.SchemaError> =>
    Effect.flatMap(decodeDivPayloadWire(input), ([attrWire, childrenWire]) =>
      Effect.flatMap(attrFromWire(attrWire), (attr) =>
        Effect.map(decodeInlines(childrenWire), (children) => make(attr, children))
      )
    )
);

const decodeMathInline = (wire: PandocConstructorWire): Effect.Effect<PandocInline.Type, S.SchemaError> =>
  Effect.flatMap(decodeMathPayloadWire(wire.c), ([mathTypeWire, text]) => {
    const mathType = decodeMathType(mathTypeWire.t);
    if (O.isNone(mathType)) {
      return rejectUnsupportedConstructorInSlot(mathTypeWire, "a Math type slot");
    }
    return Effect.as(
      decodeAbsentPayload(mathTypeWire.c),
      Math.make({
        mathType: mathType.value,
        text,
      })
    );
  });

const decodeInline = (input: unknown): Effect.Effect<PandocInline.Type, S.SchemaError> =>
  Effect.flatMap(decodeConstructor(input), (wire) =>
    Match.value(wire.t).pipe(
      Match.when("Str", () => Effect.map(decodeString(wire.c), (text) => Str.make({ text }))),
      Match.when("Space", () => Effect.as(decodeAbsentPayload(wire.c), Space.make())),
      Match.when("SoftBreak", () => Effect.as(decodeAbsentPayload(wire.c), SoftBreak.make())),
      Match.when("LineBreak", () => Effect.as(decodeAbsentPayload(wire.c), LineBreak.make())),
      Match.when("Emph", () => decodeChildInline(wire.c, (children) => Emph.make({ children }))),
      Match.when("Strong", () => decodeChildInline(wire.c, (children) => Strong.make({ children }))),
      Match.when("Strikeout", () => decodeChildInline(wire.c, (children) => Strikeout.make({ children }))),
      Match.when("Code", () =>
        decodeAttributedTextInline(wire.c, (attr, text) =>
          Code.make({
            attr,
            text,
          })
        )
      ),
      Match.when("Link", () =>
        decodeTargetInline(wire.c, (attr, children, target) =>
          Link.make({
            attr,
            children,
            target,
          })
        )
      ),
      Match.when("Image", () =>
        decodeTargetInline(wire.c, (attr, children, target) =>
          Image.make({
            attr,
            children,
            target,
          })
        )
      ),
      Match.when("Span", () =>
        decodeAttributedInlineChildren(wire.c, (attr, children) =>
          Span.make({
            attr,
            children,
          })
        )
      ),
      Match.when("Note", () =>
        Effect.map(Effect.flatMap(decodeNotePayloadWire(wire.c), decodeBlockList), (blocks) => Note.make({ blocks }))
      ),
      Match.when("Math", () => decodeMathInline(wire)),
      Match.orElse(() =>
        isPandocKnownConstructorName(wire.t)
          ? rejectKnownConstructor(wire, "inline")
          : Effect.succeed(unknownInline(wire))
      )
    )
  );

const decodeAttributedBlockChildren = (
  input: unknown,
  make: (attr: PandocAttr, children: ReadonlyArray<PandocBlock.Type>) => PandocBlock.Type
): Effect.Effect<PandocBlock.Type, S.SchemaError> =>
  Effect.flatMap(decodeDivPayloadWire(input), ([attrWire, childrenWire]) =>
    Effect.flatMap(attrFromWire(attrWire), (attr) =>
      Effect.map(decodeBlockList(childrenWire), (children) => make(attr, children))
    )
  );

const decodeOrderedListBlock = (payload: unknown): Effect.Effect<PandocBlock.Type, S.SchemaError> =>
  Effect.flatMap(decodeOrderedListPayloadWire(payload), ([[start, style, delimiter], itemWire]) =>
    Effect.flatMap(listNumberStyleFromWire(style), (styleValue) =>
      Effect.flatMap(listNumberDelimiterFromWire(delimiter), (delimiterValue) =>
        Effect.map(decodeBlockItems(itemWire), (items) =>
          OrderedList.make({
            delimiter: delimiterValue,
            items,
            start,
            style: styleValue,
          })
        )
      )
    )
  );

const decodeTableBlock = (payload: unknown): Effect.Effect<PandocBlock.Type, S.SchemaError> =>
  Effect.flatMap(decodeTablePayloadWire(payload), (decoded) =>
    Effect.flatMap(inspectTablePayload(decoded, []), (issues) =>
      A.isReadonlyArrayNonEmpty(issues)
        ? Effect.fail(
            new S.SchemaError(
              new SchemaIssue.InvalidValue({
                message: issues[0].message,
              })
            )
          )
        : Effect.succeed(Table.make({ payload: decoded }))
    )
  );

const decodeBlock = (input: unknown): Effect.Effect<PandocBlock.Type, S.SchemaError> =>
  Effect.flatMap(decodeConstructor(input), (wire) =>
    Match.value(wire.t).pipe(
      Match.when("Plain", () => Effect.map(decodeInlines(wire.c), (children) => Plain.make({ children }))),
      Match.when("Para", () => Effect.map(decodeInlines(wire.c), (children) => Para.make({ children }))),
      Match.when("Header", () =>
        Effect.flatMap(decodeHeaderPayloadWire(wire.c), ([level, attrWire, childrenWire]) =>
          Effect.flatMap(attrFromWire(attrWire), (attr) =>
            Effect.map(decodeInlines(childrenWire), (children) =>
              Header.make({
                attr,
                children,
                level,
              })
            )
          )
        )
      ),
      Match.when("BlockQuote", () => Effect.map(decodeBlockList(wire.c), (children) => BlockQuote.make({ children }))),
      Match.when("CodeBlock", () =>
        Effect.flatMap(decodeCodePayloadWire(wire.c), ([attrWire, text]) =>
          Effect.map(attrFromWire(attrWire), (attr) =>
            CodeBlock.make({
              attr,
              text,
            })
          )
        )
      ),
      Match.when("BulletList", () => Effect.map(decodeBlockItems(wire.c), (items) => BulletList.make({ items }))),
      Match.when("OrderedList", () => decodeOrderedListBlock(wire.c)),
      Match.when("HorizontalRule", () => Effect.as(decodeAbsentPayload(wire.c), HorizontalRule.make({}))),
      Match.when("Div", () =>
        decodeAttributedBlockChildren(wire.c, (attr, children) =>
          Div.make({
            attr,
            children,
          })
        )
      ),
      Match.when("Table", () => decodeTableBlock(wire.c)),
      Match.orElse(() =>
        isPandocKnownConstructorName(wire.t)
          ? rejectKnownConstructor(wire, "block")
          : Effect.succeed(unknownBlock(wire))
      )
    )
  );

function decodeMetaValue(input: unknown): Effect.Effect<PandocMetaValue, S.SchemaError> {
  return Effect.flatMap(decodeConstructor(input), (wire) =>
    Match.value(wire.t).pipe(
      Match.when("MetaBool", () => Effect.map(decodeBoolean(wire.c), (value) => MetaBool.make({ value }))),
      Match.when("MetaString", () => Effect.map(decodeString(wire.c), (value) => MetaString.make({ value }))),
      Match.when("MetaInlines", () => Effect.map(decodeInlines(wire.c), (children) => MetaInlines.make({ children }))),
      Match.when("MetaBlocks", () => Effect.map(decodeBlockList(wire.c), (children) => MetaBlocks.make({ children }))),
      Match.when("MetaList", () =>
        Effect.flatMap(decodeJsonArray(wire.c), (values) =>
          Effect.map(Effect.forEach(values, decodeMetaValue), (decoded) => MetaList.make({ values: decoded }))
        )
      ),
      Match.when("MetaMap", () =>
        Effect.flatMap(decodeJsonRecord(wire.c), (entries) =>
          Effect.map(
            Effect.forEach(Struct.entries(entries), ([key, value]) =>
              Effect.map(decodeMetaValue(value), (decoded) => [key, decoded] as const)
            ),
            (decoded) => MetaMap.make({ entries: R.fromEntries(decoded) })
          )
        )
      ),
      Match.orElse(() =>
        isPandocKnownConstructorName(wire.t)
          ? rejectKnownConstructor(wire, "meta")
          : Effect.succeed(UnknownMeta.make({ wire }))
      )
    )
  );
}

const decodeMeta = (input: unknown): Effect.Effect<PandocMeta, S.SchemaError> =>
  Effect.flatMap(decodeJsonRecord(input), (meta) =>
    Effect.map(
      Effect.forEach(Struct.entries(meta), ([key, value]) =>
        Effect.map(decodeMetaValue(value), (decoded) => [key, decoded] as const)
      ),
      R.fromEntries
    )
  );

const encodeAttr = pandocAttrToWire;

const encodeTarget = pandocTargetToWire;

const encodeInlines = (inlines: ReadonlyArray<PandocInline.Type>): ReadonlyArray<S.Json> =>
  A.map(inlines, encodeInline);

const encodeBlocks = (blocks: ReadonlyArray<PandocBlock.Type>): ReadonlyArray<S.Json> => A.map(blocks, encodeBlock);

const encodeBlockItems = (
  items: ReadonlyArray<ReadonlyArray<PandocBlock.Type>>
): ReadonlyArray<ReadonlyArray<S.Json>> => A.map(items, encodeBlocks);

const encodeInline: (inline: PandocInline.Type) => S.Json = Match.type<PandocInline.Type>().pipe(
  Match.tagsExhaustive({
    str: (inline) => ({
      c: inline.text,
      t: "Str",
    }),
    space: () => ({ t: "Space" }),
    softbreak: () => ({ t: "SoftBreak" }),
    linebreak: () => ({ t: "LineBreak" }),
    emph: (inline) => ({
      c: encodeInlines(inline.children),
      t: "Emph",
    }),
    strong: (inline) => ({
      c: encodeInlines(inline.children),
      t: "Strong",
    }),
    strikeout: (inline) => ({
      c: encodeInlines(inline.children),
      t: "Strikeout",
    }),
    code: (inline) => ({
      c: [encodeAttr(inline.attr), inline.text],
      t: "Code",
    }),
    link: (inline) => ({
      c: [encodeAttr(inline.attr), encodeInlines(inline.children), encodeTarget(inline.target)],
      t: "Link",
    }),
    image: (inline) => ({
      c: [encodeAttr(inline.attr), encodeInlines(inline.children), encodeTarget(inline.target)],
      t: "Image",
    }),
    span: (inline) => ({
      c: [encodeAttr(inline.attr), encodeInlines(inline.children)],
      t: "Span",
    }),
    note: (inline) => ({
      c: encodeBlocks(inline.blocks),
      t: "Note",
    }),
    math: (inline) => ({
      c: [{ t: inline.mathType }, inline.text],
      t: "Math",
    }),
    unknownInline: (inline) => inline.wire,
  })
);

const encodeBlock: (block: PandocBlock.Type) => S.Json = Match.type<PandocBlock.Type>().pipe(
  Match.tagsExhaustive({
    plain: (block) => ({
      c: encodeInlines(block.children),
      t: "Plain",
    }),
    para: (block) => ({
      c: encodeInlines(block.children),
      t: "Para",
    }),
    header: (block) => ({
      c: [block.level, encodeAttr(block.attr), encodeInlines(block.children)],
      t: "Header",
    }),
    blockquote: (block) => ({
      c: encodeBlocks(block.children),
      t: "BlockQuote",
    }),
    codeblock: (block) => ({
      c: [encodeAttr(block.attr), block.text],
      t: "CodeBlock",
    }),
    bulletlist: (block) => ({
      c: encodeBlockItems(block.items),
      t: "BulletList",
    }),
    orderedlist: (block) => ({
      c: [[block.start, { t: block.style }, { t: block.delimiter }], encodeBlockItems(block.items)],
      t: "OrderedList",
    }),
    horizontalrule: () => ({ t: "HorizontalRule" }),
    div: (block) => ({
      c: [encodeAttr(block.attr), encodeBlocks(block.children)],
      t: "Div",
    }),
    table: (block) => ({
      c: block.payload,
      t: "Table",
    }),
    unknownBlock: (block) => block.wire,
  })
);

const encodeMetaValue: (value: PandocMetaValue) => S.Json = Match.type<PandocMetaValue>().pipe(
  Match.tagsExhaustive({
    metaBool: (value) => ({ c: value.value, t: "MetaBool" }),
    metaString: (value) => ({ c: value.value, t: "MetaString" }),
    metaInlines: (value) => ({ c: encodeInlines(value.children), t: "MetaInlines" }),
    metaBlocks: (value) => ({ c: encodeBlocks(value.children), t: "MetaBlocks" }),
    metaList: (value) => ({ c: A.map(value.values, encodeMetaValue), t: "MetaList" }),
    metaMap: (value) => ({
      c: R.fromEntries(A.map(Struct.entries(value.entries), ([key, entry]) => [key, encodeMetaValue(entry)] as const)),
      t: "MetaMap",
    }),
    unknownMeta: (value) => value.wire,
  })
);

const encodeMeta = (meta: PandocMeta): Readonly<Record<string, S.Json>> =>
  R.fromEntries(A.map(Struct.entries(meta), ([key, value]) => [key, encodeMetaValue(value)] as const));

/**
 * Decodes a Pandoc JSON object into the internal schema-first document model.
 *
 * **Example** (Decode empty JSON object)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodePandocJson } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const document = Effect.runSync(decodePandocJson({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks: [] }))
 * console.log(document.blocks.length)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
const documentFromWire = (wire: PandocJsonWire): Effect.Effect<PandocDocument, S.SchemaError> =>
  Effect.flatMap(decodeMeta(wire.meta), (meta) =>
    Effect.map(decodeBlockList(wire.blocks), (blocks) =>
      PandocDocument.make({
        apiVersion: wire["pandoc-api-version"],
        blocks,
        meta,
      })
    )
  );

const decodePandocJsonInternal = flow(decodeWire, Effect.flatMap(documentFromWire));
const decodePandocJsonStringInternal = flow(decodeWireFromString, Effect.flatMap(documentFromWire));

/**
 * Strictly decodes a Pandoc JSON object into the semantic document model.
 *
 * **Details**
 *
 * Malformed payloads for known constructors fail with
 * {@link PandocDecodeError}. Future constructor names remain explicit
 * `Unknown*` semantic nodes.
 *
 * **Example** (Strict-decode empty document)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodePandocJsonStrict } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const document = Effect.runSync(
 *   decodePandocJsonStrict({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks: [] })
 * )
 * console.log(document.blocks.length) // 0
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodePandocJsonStrict = (input: unknown): Effect.Effect<PandocDocument, PandocDecodeError> =>
  decodePandocJsonInternal(input).pipe(
    Effect.mapError((cause) =>
      PandocDecodeError.make({ cause, message: "Pandoc JSON failed strict semantic decoding." })
    )
  );

/**
 * Backward-compatible alias for {@link decodePandocJsonStrict}.
 *
 * **Example** (Alias strict empty decode)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodePandocJson } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const program = decodePandocJson({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [],
 *   meta: {},
 * })
 * Effect.runPromise(program).then((document) => console.log(document.blocks.length))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodePandocJson = decodePandocJsonStrict;

/**
 * Decodes a Pandoc JSON string into the internal schema-first document model.
 *
 * **Example** (Decode empty JSON string)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const document = Effect.runSync(decodePandocJsonString(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`))
 * console.log(document.apiVersion[0])
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodePandocJsonStringStrict = (input: unknown): Effect.Effect<PandocDocument, PandocDecodeError> =>
  decodePandocJsonStringInternal(input).pipe(
    Effect.mapError((cause) =>
      PandocDecodeError.make({ cause, message: "Pandoc JSON string failed strict semantic decoding." })
    )
  );

/**
 * Backward-compatible alias for {@link decodePandocJsonStringStrict}.
 *
 * **Example** (Alias string strict decode)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const program =
 *   decodePandocJsonString(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`)
 * Effect.runPromise(program).then((document) => console.log(document.blocks.length))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodePandocJsonString = decodePandocJsonStringStrict;

type LosslessInspection = Effect.Effect<ReadonlyArray<PandocLosslessIssue>>;

const appendPath = (path: JsonPathType, ...segments: ReadonlyArray<string | number>): JsonPathType => [
  ...path,
  ...segments,
];

const malformedConstructorIssue = (
  context: PandocConstructorContext,
  constructor: string,
  path: JsonPathType,
  cause: unknown
): PandocLosslessIssue =>
  PandocLosslessIssue.make({
    constructor,
    context,
    message: `Malformed ${constructor} ${context} constructor: ${String(cause)}`,
    path,
  });

const inspectUnmatchedConstructor = (
  wire: PandocConstructorWire,
  context: PandocConstructorContext,
  path: JsonPathType
): LosslessInspection =>
  Effect.succeed(
    isPandocKnownConstructorName(wire.t)
      ? [
          PandocLosslessIssue.make({
            constructor: wire.t,
            context,
            message: isPandocSupportedConstructorName(wire.t)
              ? `Known Pandoc constructor ${wire.t} cannot occur in ${context} context`
              : `Pandoc 1.23.1 ${context} constructor ${wire.t} is outside the strict semantic subset`,
            path,
          }),
        ]
      : []
  );

const inspectUnsupportedConstructorInSlot = (
  wire: PandocConstructorWire,
  context: PandocConstructorContext,
  path: JsonPathType,
  slot: string
): LosslessInspection =>
  Effect.succeed([
    PandocLosslessIssue.make({
      constructor: wire.t,
      context,
      message: `Unsupported Pandoc constructor ${wire.t} cannot occur in ${slot}`,
      path,
    }),
  ]);

const inspectDecoded = <Value>(
  decoded: Effect.Effect<Value, S.SchemaError>,
  context: PandocConstructorContext,
  constructor: string,
  path: JsonPathType,
  onSuccess: (value: Value) => LosslessInspection = () => Effect.succeed([])
): LosslessInspection =>
  decoded.pipe(
    Effect.matchEffect({
      onFailure: (error) => Effect.succeed([malformedConstructorIssue(context, constructor, path, error)]),
      onSuccess,
    })
  );

const inspectChildren = (
  values: ReadonlyArray<unknown>,
  path: JsonPathType,
  inspect: (value: unknown, path: JsonPathType) => LosslessInspection
): LosslessInspection =>
  Effect.map(
    Effect.forEach(values, (value, index) => inspect(value, appendPath(path, index))),
    A.flatten
  );

const inspectInlineArray = (
  input: unknown,
  path: JsonPathType,
  constructor: string,
  constructorPath: JsonPathType,
  context: PandocConstructorContext = "inline"
): LosslessInspection =>
  inspectDecoded(decodeUnknownArray(input), context, constructor, constructorPath, (values) =>
    inspectChildren(values, path, inspectInline)
  );

const inspectBlockArray = (
  input: unknown,
  path: JsonPathType,
  context: PandocConstructorContext,
  constructor: string,
  constructorPath: JsonPathType
): LosslessInspection =>
  inspectDecoded(decodeUnknownArray(input), context, constructor, constructorPath, (values) =>
    inspectChildren(values, path, inspectBlock)
  );

const inspectBlockItems = (
  input: unknown,
  path: JsonPathType,
  constructor: string,
  constructorPath: JsonPathType
): LosslessInspection =>
  inspectDecoded(decodeBlockItemsWire(input), "block", constructor, constructorPath, (items) =>
    Effect.map(
      Effect.forEach(items, (item, itemIndex) => inspectChildren(item, appendPath(path, itemIndex), inspectBlock)),
      A.flatten
    )
  );

const inspectMath = (payload: unknown, path: JsonPathType): LosslessInspection =>
  inspectDecoded(decodeMathPayloadWire(payload), "inline", "Math", path, ([mathTypeWire]) => {
    const mathTypePath = appendPath(path, "c", 0);
    return O.match(decodeMathType(mathTypeWire.t), {
      onNone: () => inspectUnsupportedConstructorInSlot(mathTypeWire, "inline", mathTypePath, "a Math type slot"),
      onSome: () => inspectDecoded(decodeAbsentPayload(mathTypeWire.c), "inline", mathTypeWire.t, mathTypePath),
    });
  });

function inspectInline(input: unknown, path: JsonPathType): LosslessInspection {
  return decodeConstructor(input).pipe(
    Effect.matchEffect({
      onFailure: (error) => Effect.succeed([malformedConstructorIssue("inline", "Unknown", path, error)]),
      onSuccess: (wire) =>
        Match.value(wire.t).pipe(
          Match.when("Str", () => inspectDecoded(decodeString(wire.c), "inline", wire.t, path)),
          Match.when("Space", () => inspectDecoded(decodeAbsentPayload(wire.c), "inline", wire.t, path)),
          Match.when("SoftBreak", () => inspectDecoded(decodeAbsentPayload(wire.c), "inline", wire.t, path)),
          Match.when("LineBreak", () => inspectDecoded(decodeAbsentPayload(wire.c), "inline", wire.t, path)),
          Match.when("Emph", () => inspectInlineArray(wire.c, appendPath(path, "c"), wire.t, path)),
          Match.when("Strong", () => inspectInlineArray(wire.c, appendPath(path, "c"), wire.t, path)),
          Match.when("Strikeout", () => inspectInlineArray(wire.c, appendPath(path, "c"), wire.t, path)),
          Match.when("Code", () => inspectDecoded(decodeCodePayloadWire(wire.c), "inline", wire.t, path)),
          Match.when("Link", () =>
            inspectDecoded(decodeLinkPayloadWire(wire.c), "inline", wire.t, path, ([, children]) =>
              inspectChildren(children, appendPath(path, "c", 1), inspectInline)
            )
          ),
          Match.when("Image", () =>
            inspectDecoded(decodeLinkPayloadWire(wire.c), "inline", wire.t, path, ([, children]) =>
              inspectChildren(children, appendPath(path, "c", 1), inspectInline)
            )
          ),
          Match.when("Span", () =>
            inspectDecoded(decodeDivPayloadWire(wire.c), "inline", wire.t, path, ([, children]) =>
              inspectChildren(children, appendPath(path, "c", 1), inspectInline)
            )
          ),
          Match.when("Note", () => inspectBlockArray(wire.c, appendPath(path, "c"), "inline", wire.t, path)),
          Match.when("Math", () => inspectMath(wire.c, path)),
          Match.orElse(() => inspectUnmatchedConstructor(wire, "inline", path))
        ),
    })
  );
}

const inspectOrderedList = (payload: unknown, path: JsonPathType): LosslessInspection =>
  inspectDecoded(decodeOrderedListPayloadWire(payload), "block", "OrderedList", path, ([[, style, delimiter], items]) =>
    inspectDecoded(listNumberStyleFromWire(style), "block", "OrderedList", path, () =>
      inspectDecoded(listNumberDelimiterFromWire(delimiter), "block", "OrderedList", path, () =>
        inspectBlockItems(items, appendPath(path, "c", 1), "OrderedList", path)
      )
    )
  );

const inspectTableComponent = (
  input: unknown,
  path: JsonPathType,
  inspect: (value: unknown, path: JsonPathType) => LosslessInspection
): LosslessInspection =>
  O.match(decodeConstructorOption(input), {
    onNone: () => inspect(input, path),
    onSome: (wire) => inspectUnmatchedConstructor(wire, "block", path),
  });

const inspectTableConstructor = (
  input: unknown,
  path: JsonPathType,
  inspect: (wire: PandocConstructorWire) => LosslessInspection
): LosslessInspection => inspectDecoded(decodeConstructor(input), "block", "Table", path, inspect);

const inspectTableAlignment = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableConstructor(input, path, (wire) =>
    Match.value(wire.t).pipe(
      Match.when(isPandocTableAlignmentConstructorName, () =>
        inspectDecoded(decodeAbsentPayload(wire.c), "block", wire.t, path)
      ),
      Match.orElse(() => inspectUnmatchedConstructor(wire, "block", path))
    )
  );

const inspectTableColumnWidth = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableConstructor(input, path, (wire) =>
    Match.value(wire.t).pipe(
      Match.when("ColWidth", () => inspectDecoded(decodeFinite(wire.c), "block", wire.t, path)),
      Match.when("ColWidthDefault", () => inspectDecoded(decodeAbsentPayload(wire.c), "block", wire.t, path)),
      Match.orElse(() => inspectUnmatchedConstructor(wire, "block", path))
    )
  );

const inspectTableCaptionPair = (
  [shortCaption, longCaption]: typeof TableCaptionPairWire.Type,
  path: JsonPathType
): LosslessInspection =>
  Effect.zipWith(
    shortCaption === null ? Effect.succeed([]) : inspectChildren(shortCaption, appendPath(path, 0), inspectInline),
    inspectChildren(longCaption, appendPath(path, 1), inspectBlock),
    (shortIssues, longIssues) => [...shortIssues, ...longIssues]
  );

const inspectTableCaption = (input: unknown, path: JsonPathType): LosslessInspection =>
  O.match(decodeConstructorOption(input), {
    onNone: () =>
      inspectDecoded(decodeTableCaptionPairWire(input), "block", "Table", path, (caption) =>
        inspectTableCaptionPair(caption, path)
      ),
    onSome: (wire) => inspectUnmatchedConstructor(wire, "block", path),
  });

const inspectTableColumnSpec = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableComponent(input, path, (value, columnSpecPath) =>
    inspectDecoded(decodeTableColumnSpecWire(value), "block", "Table", columnSpecPath, ([alignment, width]) =>
      Effect.zipWith(
        inspectTableAlignment(alignment, appendPath(columnSpecPath, 0)),
        inspectTableColumnWidth(width, appendPath(columnSpecPath, 1)),
        (alignmentIssues, widthIssues) => [...alignmentIssues, ...widthIssues]
      )
    )
  );

const inspectTableCell = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableComponent(input, path, (value, cellPath) =>
    inspectDecoded(decodeTableCellWire(value), "block", "Table", cellPath, ([, alignment, , , blocks]) =>
      Effect.zipWith(
        inspectTableAlignment(alignment, appendPath(cellPath, 1)),
        inspectChildren(blocks, appendPath(cellPath, 4), inspectBlock),
        (alignmentIssues, blockIssues) => [...alignmentIssues, ...blockIssues]
      )
    )
  );

const inspectTableRow = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableComponent(input, path, (value, rowPath) =>
    inspectDecoded(decodeTableRowWire(value), "block", "Table", rowPath, ([, cells]) =>
      inspectChildren(cells, appendPath(rowPath, 1), inspectTableCell)
    )
  );

const inspectTableRows = (rows: ReadonlyArray<unknown>, path: JsonPathType): LosslessInspection =>
  inspectChildren(rows, path, inspectTableRow);

const inspectTableHeadOrFoot = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableComponent(input, path, (value, sectionPath) =>
    inspectDecoded(decodeTableHeadWire(value), "block", "Table", sectionPath, ([, rows]) =>
      inspectTableRows(rows, appendPath(sectionPath, 1))
    )
  );

const inspectTableBody = (input: unknown, path: JsonPathType): LosslessInspection =>
  inspectTableComponent(input, path, (value, bodyPath) =>
    inspectDecoded(decodeTableBodyWire(value), "block", "Table", bodyPath, ([, , headRows, bodyRows]) =>
      Effect.zipWith(
        inspectTableRows(headRows, appendPath(bodyPath, 2)),
        inspectTableRows(bodyRows, appendPath(bodyPath, 3)),
        (headIssues, bodyIssues) => [...headIssues, ...bodyIssues]
      )
    )
  );

function inspectTablePayload(payload: PandocTablePayload, path: JsonPathType): LosslessInspection {
  return Effect.map(
    Effect.all([
      inspectTableCaption(payload[1], appendPath(path, 1)),
      inspectChildren(payload[2], appendPath(path, 2), inspectTableColumnSpec),
      inspectTableHeadOrFoot(payload[3], appendPath(path, 3)),
      inspectChildren(payload[4], appendPath(path, 4), inspectTableBody),
      inspectTableHeadOrFoot(payload[5], appendPath(path, 5)),
    ]),
    A.flatten
  );
}

function inspectBlock(input: unknown, path: JsonPathType): LosslessInspection {
  return decodeConstructor(input).pipe(
    Effect.matchEffect({
      onFailure: (error) => Effect.succeed([malformedConstructorIssue("block", "Unknown", path, error)]),
      onSuccess: (wire) =>
        Match.value(wire.t).pipe(
          Match.when("Plain", () => inspectInlineArray(wire.c, appendPath(path, "c"), wire.t, path, "block")),
          Match.when("Para", () => inspectInlineArray(wire.c, appendPath(path, "c"), wire.t, path, "block")),
          Match.when("Header", () =>
            inspectDecoded(decodeHeaderPayloadWire(wire.c), "block", wire.t, path, ([, , children]) =>
              inspectChildren(children, appendPath(path, "c", 2), inspectInline)
            )
          ),
          Match.when("BlockQuote", () => inspectBlockArray(wire.c, appendPath(path, "c"), "block", wire.t, path)),
          Match.when("CodeBlock", () => inspectDecoded(decodeCodePayloadWire(wire.c), "block", wire.t, path)),
          Match.when("BulletList", () => inspectBlockItems(wire.c, appendPath(path, "c"), wire.t, path)),
          Match.when("OrderedList", () => inspectOrderedList(wire.c, path)),
          Match.when("HorizontalRule", () => inspectDecoded(decodeAbsentPayload(wire.c), "block", wire.t, path)),
          Match.when("Div", () =>
            inspectDecoded(decodeDivPayloadWire(wire.c), "block", wire.t, path, ([, children]) =>
              inspectChildren(children, appendPath(path, "c", 1), inspectBlock)
            )
          ),
          Match.when("Table", () =>
            inspectDecoded(decodeLosslessTablePayloadWire(wire.c), "block", wire.t, path, (payload) =>
              inspectTablePayload(payload, appendPath(path, "c"))
            )
          ),
          Match.orElse(() => inspectUnmatchedConstructor(wire, "block", path))
        ),
    })
  );
}

function inspectMetaValue(input: unknown, path: JsonPathType): LosslessInspection {
  return decodeConstructor(input).pipe(
    Effect.matchEffect({
      onFailure: (error) => Effect.succeed([malformedConstructorIssue("meta", "Unknown", path, error)]),
      onSuccess: (wire) =>
        Match.value(wire.t).pipe(
          Match.when("MetaBool", () => inspectDecoded(decodeBoolean(wire.c), "meta", wire.t, path)),
          Match.when("MetaString", () => inspectDecoded(decodeString(wire.c), "meta", wire.t, path)),
          Match.when("MetaInlines", () => inspectInlineArray(wire.c, appendPath(path, "c"), wire.t, path, "meta")),
          Match.when("MetaBlocks", () => inspectBlockArray(wire.c, appendPath(path, "c"), "meta", wire.t, path)),
          Match.when("MetaList", () =>
            inspectDecoded(decodeJsonArray(wire.c), "meta", wire.t, path, (values) =>
              inspectChildren(values, appendPath(path, "c"), inspectMetaValue)
            )
          ),
          Match.when("MetaMap", () =>
            inspectDecoded(decodeJsonRecord(wire.c), "meta", wire.t, path, (entries) =>
              Effect.map(
                Effect.forEach(Struct.entries(entries), ([key, value]) =>
                  inspectMetaValue(value, appendPath(path, "c", key))
                ),
                A.flatten
              )
            )
          ),
          Match.orElse(() => inspectUnmatchedConstructor(wire, "meta", path))
        ),
    })
  );
}

const inspectMeta = (meta: Readonly<Record<string, S.Json>>): LosslessInspection =>
  Effect.map(
    Effect.forEach(Struct.entries(meta), ([key, value]) => inspectMetaValue(value, ["meta", key])),
    A.flatten
  );

const decodePandocJsonLosslessInternal = (input: unknown): Effect.Effect<PandocLosslessDocument, S.SchemaError> =>
  Effect.flatMap(decodeJsonObject(input), (rawWire) =>
    Effect.flatMap(decodeWire(rawWire), (wire) =>
      Effect.flatMap(
        Effect.map(
          Effect.forEach(wire.blocks, (block, index) => inspectBlock(block, ["blocks", index])),
          A.flatten
        ),
        (blockIssues) =>
          Effect.map(inspectMeta(wire.meta), (metaIssues) =>
            issuePandocLosslessDocument(rawWire, [...blockIssues, ...metaIssues])
          )
      )
    )
  );

/**
 * Decodes Pandoc JSON while preserving the complete JSON tree exactly.
 *
 * **Details**
 *
 * Known malformed constructors stay unchanged in the retained wire and produce
 * path-located issues at the nearest complete constructor boundary; no
 * synthetic semantic node replaces them. {@link encodePandocJsonLossless}
 * always emits the original wire.
 *
 * **Example** (Lossless-decode empty document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodePandocJsonLossless } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const program = decodePandocJsonLossless({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [],
 *   meta: {},
 * })
 * Effect.runPromise(program).then((document) => console.log(document.issues.length))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodePandocJsonLossless = (input: unknown): Effect.Effect<PandocLosslessDocument, PandocDecodeError> =>
  decodePandocJsonLosslessInternal(input).pipe(
    Effect.mapError((cause) => PandocDecodeError.make({ cause, message: "Pandoc JSON failed lossless decoding." }))
  );

/**
 * Decodes a Pandoc JSON string into the exact lossless envelope.
 *
 * **Example** (Lossless-decode JSON string)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodePandocJsonStringLossless } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const program =
 *   decodePandocJsonStringLossless(`{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[]}`)
 * Effect.runPromise(program).then((document) => console.log(document.blocks.length))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodePandocJsonStringLossless = (
  input: unknown
): Effect.Effect<PandocLosslessDocument, PandocDecodeError> =>
  decodeJsonObjectFromString(input).pipe(
    Effect.flatMap(decodePandocJsonLosslessInternal),
    Effect.mapError((cause) =>
      PandocDecodeError.make({ cause, message: "Pandoc JSON string failed lossless decoding." })
    )
  );

/**
 * Encodes an internal Pandoc document model to Pandoc JSON object form.
 *
 * **Example** (Encode empty document wire)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { encodePandocJson } from "@beep/pandoc-ast/Pandoc.codec"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const wire = Effect.runSync(encodePandocJson(PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })))
 * console.log(wire.blocks.length)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePandocJson = (document: PandocDocument.Type): Effect.Effect<PandocJsonWire> =>
  Effect.succeed(
    PandocJsonWire.make({
      "pandoc-api-version": document.apiVersion,
      blocks: encodeBlocks(document.blocks),
      meta: encodeMeta(document.meta),
    })
  );

/**
 * Encodes an internal Pandoc document model to a Pandoc JSON string.
 *
 * **Example** (Encode document to string)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { encodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const text = Effect.runSync(encodePandocJsonString(PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })))
 * console.log(text.includes("pandoc-api-version"))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePandocJsonString = flow(encodePandocJson, Effect.flatMap(encodeWireToString));

/**
 * Returns the exact JSON object retained by a lossless decode.
 *
 * **Example** (Round-trip retained wire)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodePandocJsonLossless, encodePandocJsonLossless } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const input = { "pandoc-api-version": [1, 23, 1], meta: {}, blocks: [], future: true }
 * const output = Effect.runSync(
 *   decodePandocJsonLossless(input).pipe(Effect.flatMap(encodePandocJsonLossless))
 * )
 * console.log(output.future) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePandocJsonLossless = (
  document: PandocLosslessDocument
): Effect.Effect<Readonly<Record<string, S.Json>>> => Effect.succeed(document.wire);

/**
 * Encodes the exact JSON object retained by a lossless decode to text.
 *
 * **Example** (Encode retained wire string)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import {
 *   decodePandocJsonLossless,
 *   encodePandocJsonStringLossless,
 * } from "@beep/pandoc-ast/Pandoc.codec"
 *
 * const output = Effect.runSync(
 *   decodePandocJsonLossless({
 *     "pandoc-api-version": [1, 23, 1],
 *     meta: {},
 *     blocks: [],
 *   }).pipe(Effect.flatMap(encodePandocJsonStringLossless))
 * )
 * console.log(output.includes("pandoc-api-version")) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePandocJsonStringLossless = flow(encodePandocJsonLossless, Effect.flatMap(encodeJsonObjectToString));
