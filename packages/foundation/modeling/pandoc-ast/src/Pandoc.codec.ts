/**
 * Pandoc JSON wire codecs for the schema-first Pandoc AST model.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.codec
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import { A, dual, flow, O, P, Struct } from "@beep/utils";
import { Effect, Match, SchemaGetter } from "effect";
import * as S from "effect/Schema";
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
  Note,
  OrderedList,
  PandocApiVersion,
  PandocAttr,
  PandocDocument,
  PandocKeyValue,
  PandocListNumberDelimiter,
  PandocListNumberStyle,
  PandocMathType,
  PandocMeta,
  PandocTarget,
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
} from "./Pandoc.model.ts";
import type { PandocBlock, PandocInline } from "./Pandoc.model.ts";

const $I = $PandocAstId.create("Pandoc.codec");

/**
 * Generic Pandoc constructor wire shape.
 *
 * @category models
 * @since 0.0.0
 */
export class PandocConstructorWire extends S.Class<PandocConstructorWire>($I`PandocConstructorWire`)(
  {
    c: S.optionalKey(S.Unknown).annotateKey({
      description: "Optional Pandoc constructor payload.",
    }),
    t: S.String.annotateKey({
      description: "Pandoc constructor tag.",
    }),
  },
  $I.annote("PandocConstructorWire", {
    description: "Generic Pandoc constructor wire shape.",
  })
) {}

/**
 * Companion namespace for {@link PandocConstructorWire}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocConstructorWire {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly c?: unknown;
    readonly t: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc JSON document wire shape.
 *
 * @example
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
    blocks: S.Array(S.Unknown).annotateKey({
      description: "Pandoc block constructor array.",
    }),
    meta: PandocMeta.annotateKey({
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
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocJsonWire {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly blocks: ReadonlyArray<unknown>;
    readonly meta: PandocMeta;
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
 * @category codecs
 * @since 0.0.0
 */
export type PandocJsonFromString = typeof PandocJsonFromString.Type;

const AttrWire = S.Tuple([S.String, S.Array(S.String), S.Array(PandocKeyValue)]);
const TargetWire = S.Tuple([S.String, S.String]);
const HeaderPayloadWire = S.Tuple([S.Int, AttrWire, S.Array(S.Unknown)]);
const CodePayloadWire = S.Tuple([AttrWire, S.String]);
const DivPayloadWire = S.Tuple([AttrWire, S.Array(S.Unknown)]);
const LinkPayloadWire = S.Tuple([AttrWire, S.Array(S.Unknown), TargetWire]);
const NotePayloadWire = S.Array(S.Unknown);
const MathPayloadWire = S.Tuple([PandocConstructorWire, S.String]);
const OrderedListPayloadWire = S.Tuple([S.Tuple([S.Int, S.Unknown, S.Unknown]), S.Unknown]);
const TableCaptionWithShortWire = S.Tuple([S.Array(S.Unknown).pipe(S.NullOr), S.Array(S.Unknown)]);
const TableCaptionWire = S.Union([TableCaptionWithShortWire, S.Array(S.Unknown), PandocConstructorWire]);
const TableHeadOrFootWire = S.Union([S.Tuple([AttrWire, S.Array(S.Unknown)]), S.Array(S.Unknown)]);
const TablePayloadWire = S.Tuple([
  AttrWire,
  TableCaptionWire,
  S.Array(S.Unknown),
  TableHeadOrFootWire,
  S.Array(S.Unknown),
  TableHeadOrFootWire,
]);

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
const decodeString = S.decodeUnknownEffect(S.String);
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
const decodeTablePayloadWire = S.decodeUnknownEffect(TablePayloadWire);
const decodeTableCaptionWithShortWire = S.decodeUnknownEffect(TableCaptionWithShortWire);
const decodeListNumberStyle = S.decodeUnknownEffect(PandocListNumberStyle);
const decodeListNumberDelimiter = S.decodeUnknownEffect(PandocListNumberDelimiter);
const decodeMathType = S.decodeUnknownOption(PandocMathType);

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

const unknownInline: {
  (constructor: string, payload: unknown): UnknownInline;
  (payload: unknown): (constructor: string) => UnknownInline;
} = dual(
  2,
  (constructor: string, payload: unknown): UnknownInline =>
    UnknownInline.make({
      constructor,
      payload,
    })
);

const unknownBlock: {
  (constructor: string, payload: unknown): UnknownBlock;
  (payload: unknown): (constructor: string) => UnknownBlock;
} = dual(
  2,
  (constructor: string, payload: unknown): UnknownBlock =>
    UnknownBlock.make({
      constructor,
      payload,
    })
);

const decodeBlockListOrUnknown = flow(
  decodeUnknownArray,
  Effect.flatMap((values) => Effect.forEach(values, decodeBlock))
);

const decodeBlockItemOrUnknown = (input: unknown): Effect.Effect<ReadonlyArray<PandocBlock.Type>> => {
  const malformed = [unknownBlock("MalformedListItem", input)];
  return decodeUnknownArray(input).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed(malformed),
      onSuccess: (values) => Effect.forEach(values, decodeBlock).pipe(Effect.orElseSucceed(() => malformed)),
    })
  );
};

const decodeBlockItemsOrUnknown = (
  input: unknown
): Effect.Effect<ReadonlyArray<ReadonlyArray<PandocBlock.Type>>, S.SchemaError> => {
  const malformed = () => Effect.succeed([[unknownBlock("MalformedListItem", input)]]);

  return decodeUnknownArray(input).pipe(
    Effect.matchEffect({
      onFailure: malformed,
      onSuccess: (items) => Effect.forEach(items, decodeBlockItemOrUnknown),
    })
  );
};

const captionInlinesFromBlock: (block: PandocBlock.Type) => ReadonlyArray<PandocInline.Type> =
  Match.type<PandocBlock.Type>().pipe(
    Match.tagsExhaustive({
      plain: (block) => block.children,
      para: (block) => block.children,
      header: (block) => block.children,
      blockquote: (block) => A.flatMap(block.children, captionInlinesFromBlock),
      codeblock: (block) => A.of(Str.make({ text: block.text })),
      bulletlist: (block) => A.flatMap(A.flatten(block.items), captionInlinesFromBlock),
      orderedlist: (block) => A.flatMap(A.flatten(block.items), captionInlinesFromBlock),
      horizontalrule: A.emptyReadonly<never>,
      div: (block) => A.flatMap(block.children, captionInlinesFromBlock),
      table: (block) => block.caption,
      unknownBlock: A.emptyReadonly<never>,
    })
  );

const captionInlinesFromBlocks = (blocks: ReadonlyArray<PandocBlock.Type>): ReadonlyArray<PandocInline.Type> =>
  A.flatMap(blocks, captionInlinesFromBlock);

const captionFromBlocksWire = (input: unknown): Effect.Effect<ReadonlyArray<PandocInline.Type>, S.SchemaError> =>
  Effect.map(decodeBlockList(input), captionInlinesFromBlocks);

const captionFromLegacyWire = (input: unknown): Effect.Effect<ReadonlyArray<PandocInline.Type>, S.SchemaError> =>
  decodeTableCaptionWithShortWire(input).pipe(
    Effect.matchEffect({
      onFailure: () => captionFromBlocksWire(input),
      onSuccess: ([shortCaptionWire, longCaptionWire]) =>
        Effect.flatMap(
          // crispen: shortCaption stays `array | null` (not S.OptionFromNullOr) — decodeTablePayloadWire
          // re-feeds this decoded tuple back through captionFromWire, so Option-ifying the wire schema
          // would break that re-decode. Absorb once the double-decode is removed.
          P.isNull(shortCaptionWire) ? Effect.succeed([]) : decodeInlines(shortCaptionWire),
          (shortCaption) =>
            Effect.map(captionFromBlocksWire(longCaptionWire), (longCaption) =>
              A.length(shortCaption) > 0 ? shortCaption : longCaption
            )
        ),
    })
  );

const captionFromWire = (input: unknown): Effect.Effect<ReadonlyArray<PandocInline.Type>, S.SchemaError> =>
  decodeConstructor(input).pipe(
    Effect.matchEffect({
      onFailure: () => captionFromLegacyWire(input),
      onSuccess: (wire) => (wire.t === "TableCaption" ? captionFromLegacyWire(wire.c) : captionFromLegacyWire(input)),
    })
  );

const captionFromWireOrEmpty = (input: unknown): Effect.Effect<ReadonlyArray<PandocInline.Type>> =>
  captionFromWire(input).pipe(Effect.orElseSucceed(A.emptyReadonly));

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

const decodeMathInline = (payload: unknown): Effect.Effect<PandocInline.Type, S.SchemaError> =>
  decodeMathPayloadWire(payload).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed(unknownInline("Math", payload)),
      onSuccess: ([mathTypeWire, text]) =>
        O.match(decodeMathType(mathTypeWire.t), {
          onNone: () => Effect.succeed(unknownInline("Math", payload)),
          onSome: PandocMathType.$match({
            DisplayMath: (mathType) =>
              Effect.succeed(
                Math.make({
                  mathType,
                  text,
                })
              ),
            InlineMath: (mathType) =>
              Effect.succeed(
                Math.make({
                  mathType,
                  text,
                })
              ),
          }),
        }),
    })
  );

const decodeInline = (input: unknown): Effect.Effect<PandocInline.Type, S.SchemaError> =>
  Effect.flatMap(decodeConstructor(input), (wire) =>
    Match.value(wire.t).pipe(
      Match.when("Str", () => Effect.map(decodeString(wire.c), (text) => Str.make({ text }))),
      Match.when("Space", () => Effect.succeed(Space.make())),
      Match.when("SoftBreak", () => Effect.succeed(SoftBreak.make())),
      Match.when("LineBreak", () => Effect.succeed(LineBreak.make())),
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
        Effect.map(Effect.flatMap(decodeNotePayloadWire(wire.c), decodeBlockListOrUnknown), (blocks) =>
          Note.make({ blocks })
        )
      ),
      Match.when("Math", () => decodeMathInline(wire.c)),
      Match.orElse(() => Effect.succeed(unknownInline(wire.t, wire.c)))
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
  decodeOrderedListPayloadWire(payload).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed(unknownBlock("OrderedList", payload)),
      onSuccess: ([[start, style, delimiter], itemWire]) =>
        Effect.flatMap(listNumberStyleFromWire(style), (styleValue) =>
          Effect.flatMap(listNumberDelimiterFromWire(delimiter), (delimiterValue) =>
            Effect.map(decodeBlockItemsOrUnknown(itemWire), (items) =>
              OrderedList.make({
                delimiter: delimiterValue,
                items,
                start,
                style: styleValue,
              })
            )
          )
        ).pipe(Effect.orElseSucceed(() => unknownBlock("OrderedList", payload))),
    })
  );

const decodeTableBlock = (payload: unknown): Effect.Effect<PandocBlock.Type, S.SchemaError> =>
  decodeTablePayloadWire(payload).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.succeed(unknownBlock("Table", payload)),
      onSuccess: ([attrWire, captionWire]) =>
        Effect.flatMap(attrFromWire(attrWire), (attr) =>
          Effect.map(captionFromWireOrEmpty(captionWire), (caption) =>
            Table.make({
              attr,
              caption,
              payload,
            })
          )
        ),
    })
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
      Match.when("BulletList", () =>
        Effect.map(decodeBlockItemsOrUnknown(wire.c), (items) => BulletList.make({ items }))
      ),
      Match.when("OrderedList", () => decodeOrderedListBlock(wire.c)),
      Match.when("HorizontalRule", () => Effect.succeed(HorizontalRule.make({}))),
      Match.when("Div", () =>
        decodeAttributedBlockChildren(wire.c, (attr, children) =>
          Div.make({
            attr,
            children,
          })
        )
      ),
      Match.when("Table", () => decodeTableBlock(wire.c)),
      Match.orElse(() => Effect.succeed(unknownBlock(wire.t, wire.c)))
    )
  );

const encodeAttr = pandocAttrToWire;

const encodeTarget = pandocTargetToWire;

const encodeInlines = (inlines: ReadonlyArray<PandocInline.Type>): ReadonlyArray<unknown> =>
  A.map(inlines, encodeInline);

const encodeBlocks = (blocks: ReadonlyArray<PandocBlock.Type>): ReadonlyArray<unknown> => A.map(blocks, encodeBlock);

const encodeBlockItems = (
  items: ReadonlyArray<ReadonlyArray<PandocBlock.Type>>
): ReadonlyArray<ReadonlyArray<unknown>> => A.map(items, encodeBlocks);

const encodeInline = Match.type<PandocInline.Type>().pipe(
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
    unknownInline: (inline) => ({
      c: inline.payload,
      t: inline.constructor,
    }),
  })
);

const encodeBlock = Match.type<PandocBlock.Type>().pipe(
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
    unknownBlock: (block) => ({
      c: block.payload,
      t: block.constructor,
    }),
  })
);

/**
 * Decodes a Pandoc JSON object into the internal schema-first document model.
 *
 * @example
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
export const decodePandocJson = flow(
  decodeWire,
  Effect.flatMap((wire) =>
    Effect.map(decodeBlockList(wire.blocks), (blocks) =>
      PandocDocument.make({
        apiVersion: wire["pandoc-api-version"],
        blocks,
        meta: wire.meta,
      })
    )
  )
);

/**
 * Decodes a Pandoc JSON string into the internal schema-first document model.
 *
 * @example
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
export const decodePandocJsonString = flow(decodeWireFromString, Effect.flatMap(decodePandocJson));

/**
 * Encodes an internal Pandoc document model to Pandoc JSON object form.
 *
 * @example
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
      meta: document.meta,
    })
  );

/**
 * Encodes an internal Pandoc document model to a Pandoc JSON string.
 *
 * @example
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
