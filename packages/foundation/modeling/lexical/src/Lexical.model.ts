/**
 * Schema-first models of Lexical's serialized editor state.
 *
 * The node tree is modeled as a tagged union discriminated on Lexical's own
 * `type` key. House style: `S.Class` hierarchies via `.extend`, tags only on
 * concrete leaf classes, nullish wire values captured as `O.Option` at the
 * schema boundary, and hand-written `Type`/`Encoded` interfaces in merged
 * namespaces (required to break TS inference cycles through the recursive
 * `children`).
 *
 * The package has zero runtime `lexical` imports; Lexical devDependencies
 * support compatibility checks in the unit tests.
 *
 * @packageDocumentation \@beep/lexical-schema/Lexical.model
 * @since 0.0.0
 */

// cspell:word youtu
import { $LexicalSchemaId } from "@beep/identity/packages";
import * as Md from "@beep/md/Md.model";
import { Defect, LiteralKit, MappedLiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import { Effect, Result, SchemaGetter, Struct } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { hasStrictNodeChildren, isStrictLexicalNode } from "./internal/conformance/Lexical.strict-invariants.ts";
import { legacyYouTubeVideoId, sanitizeInlineStyle, sanitizeStyleValue, sanitizeUrl } from "./Lexical.normalize.ts";
import type { CodeFenceLanguage as MdCodeFenceLanguage } from "@beep/md/Md.model";
import type * as R from "effect/Record";
import type * as AST from "effect/SchemaAST";

const $I = $LexicalSchemaId.create("Lexical.model");
type MdYouTubeVideoId = typeof Md.YouTubeVideoId.Type;

const strictSemanticParseOptions = {
  onExcessProperty: "error",
} satisfies AST.ParseOptions;

const artifactRefIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u;
const decodeYouTubeVideoId = S.decodeUnknownEffect(Md.YouTubeVideoId);

const CodeNodeLanguage = S.OptionFromOptionalNullOr(S.String).pipe(
  S.decodeTo(S.Option(Md.CodeFenceLanguage), {
    decode: SchemaGetter.transform((language) => O.flatMap(language, Md.CodeFenceLanguage.decodeOption)),
    encode: SchemaGetter.transform((language) => language),
  }),
  $I.annoteSchema("CodeNodeLanguage", {
    description:
      "Optional serialized Lexical code language; legacy non-conforming strings decode to None while valid languages remain branded.",
  })
);

const LexicalListStart = NonNegativeInt.pipe(
  S.decodeTo(PosInt, {
    decode: SchemaGetter.transform((value) => PosInt.make(value === 0 ? 1 : value)),
    encode: SchemaGetter.transform((value) => NonNegativeInt.make(value)),
  }),
  $I.annoteSchema("LexicalListStart", {
    description: "Positive Lexical list start with legacy zero values normalized to one during serialized JSON decode.",
  })
);

const LexicalListItemValue = PosInt.pipe(
  $I.annoteSchema("LexicalListItemValue", {
    description: "Positive Lexical list-item ordinal; zero values are rejected to preserve sibling ordering.",
  })
);

const YouTubeVideoIdFromLegacyInput = S.String.pipe(
  S.decodeTo(Md.YouTubeVideoId, {
    decode: SchemaGetter.transformOrFail((value) =>
      decodeYouTubeVideoId(legacyYouTubeVideoId(value)).pipe(Effect.mapError((error) => error.issue))
    ),
    encode: SchemaGetter.transform((value) => value),
  }),
  $I.annoteSchema("YouTubeVideoIdFromLegacyInput", {
    description:
      "Bare YouTube video id; legacy watch, embed, shorts, and youtu.be URLs decode to their canonical 11-character id.",
  })
);

/**
 * Serialized Lexical node version accepted by this package.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNodeVersion } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(LexicalNodeVersion)(1)
 * Result.isSuccess(result) && result.success === 1 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LexicalNodeVersion = S.Literal(1).pipe(
  $I.annoteSchema("LexicalNodeVersion", {
    description: "Serialized Lexical node version currently written by built-in v1 nodes.",
  })
);

/**
 * Type for {@link LexicalNodeVersion}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import type { LexicalNodeVersion } from "@beep/lexical-schema/Lexical.model"
 *
 * const version: LexicalNodeVersion = 1
 * version // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LexicalNodeVersion = typeof LexicalNodeVersion.Type;

const TextFormatBitMapping = MappedLiteralKit([
  ["bold", 1],
  ["italic", 2],
  ["strikethrough", 4],
  ["underline", 8],
  ["code", 16],
  ["subscript", 32],
  ["superscript", 64],
  ["highlight", 128],
  ["lowercase", 256],
  ["uppercase", 512],
  ["capitalize", 1024],
] as const);

/**
 * Lexical TextFormatType flag values.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TextFormatBits } from "@beep/lexical-schema/Lexical.model"
 *
 * TextFormatBits.bold // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextFormatBits = TextFormatBitMapping.From.Enum;

/**
 * Reusable literal domain for individual Lexical text format bits.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TextFormatBit } from "@beep/lexical-schema/Lexical.model"
 *
 * TextFormatBit.Options[0] // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextFormatBit = LiteralKit(TextFormatBitMapping.To.Options).pipe(
  $I.annoteSchema("TextFormatBit", {
    description: "One Lexical TextFormatType bit value.",
  })
);

/**
 * Type for {@link TextFormatBit}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import type { TextFormatBit } from "@beep/lexical-schema/Lexical.model"
 *
 * const bit: TextFormatBit = 1
 * bit // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextFormatBit = typeof TextFormatBit.Type;

/**
 * Bitwise union of every known Lexical text-format bit.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TEXT_FORMAT_MASK_ALL } from "@beep/lexical-schema/Lexical.model"
 *
 * (TEXT_FORMAT_MASK_ALL & 1) === 1 // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TEXT_FORMAT_MASK_ALL = A.reduce(TextFormatBit.Options, 0, (mask, bit) => mask | bit);

const TextFormatMaskBase = NonNegativeInt.check(
  S.isLessThanOrEqualTo(TEXT_FORMAT_MASK_ALL, {
    identifier: $I`TextFormatMaskKnownBitsCheck`,
    title: "Text Format Mask",
    description: "A Lexical text format bitmask containing only known TextFormatType bits.",
    message: "Text format mask must contain only known Lexical TextFormatType bits.",
  })
).pipe(
  S.brand("TextFormatMask"),
  $I.annoteSchema("TextFormatMask", {
    description: "Non-negative Lexical TextFormatType bitmask containing only known formatting bits.",
  })
);

/**
 * Branded Lexical TextFormatType bitmask.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TextFormatMask } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TextFormatMask)(3)
 * Result.isSuccess(result) && result.success === 3 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextFormatMask = TextFormatMaskBase;

/**
 * Type for {@link TextFormatMask}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { TextFormatMask } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (mask: TextFormatMask) => mask
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextFormatMask = typeof TextFormatMask.Type;

/**
 * Returns whether a Lexical text-format mask contains a specific flag.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { hasTextFormat, TextFormatMask } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TextFormatMask)(3)
 * Result.isSuccess(result) && hasTextFormat(result.success, 1) // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasTextFormat: {
  (bit: TextFormatBit): (format: TextFormatMask) => boolean;
  (format: TextFormatMask, bit: TextFormatBit): boolean;
} = dual(2, (format: TextFormatMask, bit: TextFormatBit): boolean => (format & bit) === bit);

/**
 * Adds a Lexical text-format bit and rebrands the resulting valid mask.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { withTextFormat, TextFormatMask } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TextFormatMask)(1)
 * Result.isSuccess(result) && withTextFormat(result.success, 2) === 3 // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withTextFormat: {
  (bit: TextFormatBit): (format: TextFormatMask) => TextFormatMask;
  (format: TextFormatMask, bit: TextFormatBit): TextFormatMask;
} = dual(2, (format: TextFormatMask, bit: TextFormatBit): TextFormatMask => TextFormatMask.make(format | bit));

const TextDetailBitMapping = MappedLiteralKit([
  ["directionless", 1],
  ["unmergeable", 2],
] as const);

/**
 * Lexical TextDetailType flag values.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TextDetailBits } from "@beep/lexical-schema/Lexical.model"
 *
 * TextDetailBits.directionless // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextDetailBits = TextDetailBitMapping.From.Enum;

/**
 * Reusable literal domain for individual Lexical text detail bits.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TextDetailBit } from "@beep/lexical-schema/Lexical.model"
 *
 * TextDetailBit.Options[0] // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextDetailBit = LiteralKit(TextDetailBitMapping.To.Options).pipe(
  $I.annoteSchema("TextDetailBit", {
    description: "One Lexical TextDetailType bit value.",
  })
);

/**
 * Type for {@link TextDetailBit}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import type { TextDetailBit } from "@beep/lexical-schema/Lexical.model"
 *
 * const bit: TextDetailBit = 1
 * bit // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextDetailBit = typeof TextDetailBit.Type;

/**
 * Bitwise union of every known Lexical text-detail bit.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TEXT_DETAIL_MASK_ALL } from "@beep/lexical-schema/Lexical.model"
 *
 * (TEXT_DETAIL_MASK_ALL & 1) === 1 // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TEXT_DETAIL_MASK_ALL = A.reduce(TextDetailBit.Options, 0, (mask, bit) => mask | bit);

const TextDetailMaskBase = NonNegativeInt.check(
  S.isLessThanOrEqualTo(TEXT_DETAIL_MASK_ALL, {
    identifier: $I`TextDetailMaskKnownBitsCheck`,
    title: "Text Detail Mask",
    description: "A Lexical text detail bitmask containing only known TextDetailType bits.",
    message: "Text detail mask must contain only known Lexical TextDetailType bits.",
  })
).pipe(
  S.brand("TextDetailMask"),
  $I.annoteSchema("TextDetailMask", {
    description: "Non-negative Lexical TextDetailType bitmask containing only known detail bits.",
  })
);

/**
 * Branded Lexical TextDetailType bitmask.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TextDetailMask } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TextDetailMask)(1)
 * Result.isSuccess(result) && result.success === 1 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextDetailMask = TextDetailMaskBase;

/**
 * Type for {@link TextDetailMask}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { TextDetailMask } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (mask: TextDetailMask) => mask
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextDetailMask = typeof TextDetailMask.Type;

/**
 * Non-negative Lexical indentation depth.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalIndentDepth } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(LexicalIndentDepth)(2)
 * Result.isSuccess(result) && result.success === 2 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LexicalIndentDepth = NonNegativeInt.pipe(
  S.brand("LexicalIndentDepth"),
  $I.annoteSchema("LexicalIndentDepth", {
    description: "Non-negative Lexical indentation depth.",
  })
);

/**
 * Type for {@link LexicalIndentDepth}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { LexicalIndentDepth } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (depth: LexicalIndentDepth) => depth
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LexicalIndentDepth = typeof LexicalIndentDepth.Type;

/**
 * Lexical table cell header-state bitmask.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TableCellHeaderState } from "@beep/lexical-schema/Lexical.model"
 *
 * TableCellHeaderState.Options // => [0, 1, 2, 3]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TableCellHeaderState = LiteralKit([0, 1, 2, 3]).pipe(
  $I.annoteSchema("TableCellHeaderState", {
    description: "Lexical table cell header-state bitmask: 0 none, 1 row, 2 column, 3 both.",
  })
);

/**
 * Type for {@link TableCellHeaderState}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import type { TableCellHeaderState } from "@beep/lexical-schema/Lexical.model"
 *
 * const state: TableCellHeaderState = 3
 * state // => 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableCellHeaderState = typeof TableCellHeaderState.Type;

/**
 * Positive span count for merged Lexical table cells.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TableCellSpan } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TableCellSpan)(2)
 * Result.isSuccess(result) && result.success === 2 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TableCellSpan = PosInt.pipe(
  S.brand("TableCellSpan"),
  $I.annoteSchema("TableCellSpan", {
    description: "Positive row or column span for a Lexical table cell.",
  })
);

/**
 * Type for {@link TableCellSpan}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { TableCellSpan } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (span: TableCellSpan) => span
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableCellSpan = typeof TableCellSpan.Type;

/**
 * Non-negative pixel-like table dimension emitted by Lexical table nodes.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TableDimension } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TableDimension)(120)
 * Result.isSuccess(result) && result.success === 120 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TableDimension = NonNegativeInt.pipe(
  S.brand("TableDimension"),
  $I.annoteSchema("TableDimension", {
    description: "Non-negative table dimension emitted by Lexical table nodes.",
  })
);

/**
 * Type for {@link TableDimension}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { TableDimension } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (dimension: TableDimension) => dimension
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableDimension = typeof TableDimension.Type;

/**
 * Package-owned artifact reference id used by `artifact-ref` decorator nodes.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { ArtifactRefId } from "@beep/lexical-schema/Lexical.model"
 *
 * console.log(ArtifactRefId.fromUnknown("artifact-123"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArtifactRefId = S.NonEmptyString.check(
  S.isPattern(artifactRefIdPattern, {
    identifier: $I`ArtifactRefIdPatternCheck`,
    title: "Artifact Reference ID",
    description: "An artifact id that can be embedded in the artifact:// Markdown projection.",
    message:
      "Artifact reference id must start with an alphanumeric character and contain only alphanumerics, _, ., :, or -.",
  })
).pipe(
  $I.annoteSchema("ArtifactRefId", {
    description: "Non-empty artifact reference id accepted by package-owned Lexical artifact-ref nodes.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ArtifactRefId}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { ArtifactRefId } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (id: ArtifactRefId) => id
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArtifactRefId = typeof ArtifactRefId.Type;

/**
 * `ElementFormatType` from lexical.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ElementFormat } from "@beep/lexical-schema/Lexical.model"
 *
 * ElementFormat.is.center("center") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ElementFormat = LiteralKit(["left", "start", "center", "right", "end", "justify", ""]).pipe(
  $I.annoteSchema("ElementFormat", {
    description:
      "Lexical element alignment token used by block-level nodes; the empty string preserves Lexical's default alignment sentinel.",
  })
);

/**
 * Type for {@link ElementFormat}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { ElementFormat } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (format: ElementFormat) => format
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ElementFormat = typeof ElementFormat.Type;

/**
 * Text direction token from lexical.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Direction } from "@beep/lexical-schema/Lexical.model"
 *
 * Direction.is.ltr("ltr") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Direction = LiteralKit(["ltr", "rtl"]).pipe(
  $I.annoteSchema("Direction", {
    description: "Lexical text direction token for left-to-right and right-to-left element layout.",
  })
);

/**
 * Type for {@link Direction}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { Direction } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (direction: Direction) => direction
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Direction = typeof Direction.Type;

/**
 * `TextModeType` from lexical.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TextMode } from "@beep/lexical-schema/Lexical.model"
 *
 * TextMode.is.normal("normal") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextMode = LiteralKit(["normal", "token", "segmented"]).pipe(
  $I.annoteSchema("TextMode", {
    description: "Lexical text node editability mode: normal text, indivisible token text, or segmented text.",
  })
);

/**
 * Type for {@link TextMode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { TextMode } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (mode: TextMode) => mode
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextMode = typeof TextMode.Type;

/**
 * `HeadingTagType` from `@lexical/rich-text`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { HeadingTag } from "@beep/lexical-schema/Lexical.model"
 *
 * HeadingTag.is.h1("h1") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeadingTag = LiteralKit(["h1", "h2", "h3", "h4", "h5", "h6"]).pipe(
  $I.annoteSchema("HeadingTag", {
    description: "Heading level tag for Lexical heading nodes.",
  })
);

/**
 * Type for {@link HeadingTag}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { HeadingTag } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (tag: HeadingTag) => tag
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HeadingTag = typeof HeadingTag.Type;

/**
 * `ListType` from `@lexical/list`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ListType } from "@beep/lexical-schema/Lexical.model"
 *
 * ListType.is.bullet("bullet") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ListType = LiteralKit(["number", "bullet", "check"]).pipe(
  $I.annoteSchema("ListType", {
    description: "List semantics for Lexical list nodes: ordered, unordered, or checkbox list.",
  })
);

/**
 * Type for {@link ListType}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { ListType } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (listType: ListType) => listType
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListType = typeof ListType.Type;

/**
 * `ListNodeTagType` from `@lexical/list`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ListTag } from "@beep/lexical-schema/Lexical.model"
 *
 * ListTag.is.ul("ul") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ListTag = LiteralKit(["ul", "ol"]).pipe(
  $I.annoteSchema("ListTag", {
    description: "HTML list tag rendered for a Lexical list node.",
  })
);

/**
 * Type for {@link ListTag}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { ListTag } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (tag: ListTag) => tag
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListTag = typeof ListTag.Type;

const SafeInlineStyleType = S.String.check(
  S.makeFilter((value) => value === sanitizeInlineStyle(value), {
    identifier: $I`SafeInlineStyleFixedPointCheck`,
    title: "Safe Inline Style",
    description: "A canonical inline CSS declaration list accepted unchanged by the Lexical sanitizer.",
    message: "Expected an inline style already normalized by the Lexical safe-style policy.",
  })
);

/**
 * Serialized Lexical inline CSS, sanitized at the schema boundary on both
 * decode and encode so that neither persisted untrusted state nor re-encoded
 * viewer/composer state can carry attacker-controlled CSS into the DOM.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { SafeInlineStyle } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(SafeInlineStyle)("position:fixed;color:red")
 * Result.isSuccess(result) && result.success === "color: red" // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SafeInlineStyle = S.String.pipe(
  S.decodeTo(SafeInlineStyleType, {
    decode: SchemaGetter.transform(sanitizeInlineStyle),
    encode: SchemaGetter.transform(sanitizeInlineStyle),
  }),
  $I.annoteSchema("SafeInlineStyle", {
    description:
      "Serialized Lexical inline CSS restricted to an allowlist of safe presentation properties; positioning, stacking, animation, transforms, and URL/function-bearing values are stripped on decode and encode.",
    // The sanitizer runs on both decode and encode, so only its fixed points
    // survive a round-trip. Projecting the generator through the (idempotent)
    // sanitizer keeps schema-derived arbitraries on those fixed points and the
    // round-trip total without weakening the boundary guard itself.
    toArbitrary: () => (fc) => fc.string().map(sanitizeInlineStyle),
  })
);

/**
 * Type for {@link SafeInlineStyle}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { SafeInlineStyle } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (style: SafeInlineStyle) => style
 * console.log(accept)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SafeInlineStyle = typeof SafeInlineStyle.Type;

const SafeStyleValueType = S.String.check(
  S.makeFilter((value) => value === sanitizeStyleValue(value), {
    identifier: $I`SafeStyleValueFixedPointCheck`,
    title: "Safe Style Value",
    description: "A canonical single CSS value accepted unchanged by the Lexical sanitizer.",
    message: "Expected a CSS value already normalized by the Lexical safe-style policy.",
  })
);

/**
 * Serialized Lexical single CSS value (table cell `backgroundColor` /
 * `verticalAlign`) sanitized at the schema boundary so the bare-value sink
 * cannot smuggle extra declarations or URL/function constructs into the DOM.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { SafeStyleValue } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(SafeStyleValue)("red; position: fixed")
 * Result.isSuccess(result) && result.success === "" // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SafeStyleValue = S.String.pipe(
  S.decodeTo(SafeStyleValueType, {
    decode: SchemaGetter.transform(sanitizeStyleValue),
    encode: SchemaGetter.transform(sanitizeStyleValue),
  }),
  $I.annoteSchema("SafeStyleValue", {
    description:
      "Serialized Lexical single CSS value restricted to a safe form; multi-declaration, URL-bearing, and function-call values are stripped on decode and encode.",
    // See SafeInlineStyle: keep schema-derived arbitraries on the sanitizer's
    // (idempotent) fixed points so the encode/decode round-trip stays total.
    toArbitrary: () => (fc) => fc.string().map(sanitizeStyleValue),
  })
);

/**
 * Type for {@link SafeStyleValue}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { SafeStyleValue } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (value: SafeStyleValue) => value
 * console.log(accept)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SafeStyleValue = typeof SafeStyleValue.Type;

const SafeUrlType = S.String.check(
  S.makeFilter((value) => value === sanitizeUrl(value), {
    identifier: $I`SafeUrlFixedPointCheck`,
    title: "Safe URL",
    description: "A canonical browser URL destination accepted unchanged by the shared Md URL policy.",
    message: "Expected a URL already normalized by the shared browser-safe URL policy.",
  })
);

/**
 * Serialized Lexical link URL sanitized at the schema boundary before an
 * untrusted editor state reaches an anchor `href` sink.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { SafeUrl } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(SafeUrl)("javascript:alert(1)")
 * Result.isSuccess(result) && result.success === "#" // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SafeUrl = S.String.pipe(
  S.decodeTo(SafeUrlType, {
    decode: SchemaGetter.transform(sanitizeUrl),
    encode: SchemaGetter.transform(sanitizeUrl),
  }),
  $I.annoteSchema("SafeUrl", {
    description:
      "Serialized Lexical link target sanitized to safe URL destinations; active script/data protocols and disallowed absolute protocols collapse to a harmless fragment.",
    toArbitrary: () => (fc) => fc.string().map(sanitizeUrl),
  })
);

/**
 * Type for {@link SafeUrl}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { SafeUrl } from "@beep/lexical-schema/Lexical.model"
 *
 * const accept = (url: SafeUrl) => url
 * console.log(accept)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type SafeUrl = typeof SafeUrl.Type;

/**
 * Mirrors `SerializedLexicalNode`. The `type` discriminant is added by each
 * concrete subclass via `S.tag(...)`. `"$"` is `NODE_STATE_KEY`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { BaseNode } from "@beep/lexical-schema/Lexical.model"
 *
 * BaseNode.name // => "BaseNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaseNode extends S.Class<BaseNode>($I`BaseNode`)(
  {
    version: LexicalNodeVersion.pipe(
      SchemaUtils.withConstantDefault(1),
      S.annotateKey({
        description: "Serialized Lexical node schema version; Lexical currently writes version 1 for built-in nodes.",
      })
    ),
    $: S.Record(S.String, S.Json).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Optional NODE_STATE_KEY payload containing JSON-valued persisted Lexical NodeState keyed by state name.",
      })
    ),
  },
  $I.annote("BaseNode", {
    description: "Schema base for every serialized Lexical node, including versioning and optional NodeState metadata.",
  })
) {}

/**
 * Companion namespace for {@link BaseNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { BaseNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<BaseNode.Type, S.SchemaError> = S.decodeUnknownResult(BaseNode)({ version: 1 })
 * console.log(Result.isSuccess(result) && result.success.version === 1) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace BaseNode {
  /**
   * Companion decoded type for {@link BaseNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type {
    readonly $: O.Option<R.ReadonlyRecord<string, S.Json>>;
    readonly version: LexicalNodeVersion;
  }

  /**
   * Companion encoded type for {@link BaseNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly $?: R.ReadonlyRecord<string, S.Json>;
    readonly version: number;
  }
}

/**
 * `children` is mutually recursive with the union of all node schemas, so we
 * tie the knot with `S.suspend`. The annotation must only mention the
 * hand-written namespace types — referencing the classes here would make
 * every class's base expression circular.
 */
const NodeChildren = S.Array(S.suspend((): S.Codec<LexicalNode.Type, LexicalNode.Encoded> => RawLexicalNode)).pipe(
  $I.annoteSchema("NodeChildren", {
    description:
      "Ordered recursive child list decoded through the structural RawLexicalNode union; the public LexicalNode schema applies the parent-child grammar.",
  })
);

/**
 * Mirrors `SerializedElementNode`.
 *
 * `textFormat`/`textStyle` stay optional here (as on `SerializedElementNode`)
 * even though Lexical 0.45 narrows them to required on paragraph nodes — the
 * schema package owns the persisted contract and must not couple to one
 * Lexical release's wire shape.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ElementNode } from "@beep/lexical-schema/Lexical.model"
 *
 * ElementNode.name // => "ElementNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ElementNode extends BaseNode.extend<ElementNode>($I`ElementNode`)(
  {
    children: NodeChildren.annotateKey({
      description:
        "Child nodes in document order, structurally decoded without applying the public LexicalNode parent-child grammar.",
    }),
    direction: S.OptionFromNullOr(Direction).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional text direction decoded from Lexical's nullable direction field.",
      })
    ),
    format: ElementFormat.pipe(
      SchemaUtils.withConstantDefault<ElementFormat>(""),
      S.annotateKey({ description: "Block alignment format token applied to the element." })
    ),
    indent: LexicalIndentDepth.pipe(
      SchemaUtils.withConstantDefault<number>(0),
      S.annotateKey({ description: "Lexical indentation depth for nested block layout." })
    ),
    textFormat: TextFormatMask.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional TextFormatType bitmask applied to newly inserted text within the element.",
      })
    ),
    textStyle: SafeInlineStyle.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Optional CSS style applied to newly inserted text within the element, sanitized to an allowlist of safe presentation properties.",
      })
    ),
  },
  $I.annote("ElementNode", {
    description: "Schema base shared by Lexical element (container) nodes.",
  })
) {}

/**
 * Companion namespace for {@link ElementNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ElementNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<ElementNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(ElementNode)({ version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.children.length === 0) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ElementNode {
  /**
   * Companion decoded type for {@link ElementNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends BaseNode.Type {
    readonly children: ReadonlyArray<LexicalNode.Type>;
    readonly direction: O.Option<Direction>;
    readonly format: ElementFormat;
    readonly indent: LexicalIndentDepth;
    readonly textFormat: O.Option<TextFormatMask>;
    readonly textStyle: O.Option<string>;
  }

  /**
   * Companion encoded type for {@link ElementNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends BaseNode.Encoded {
    readonly children: ReadonlyArray<LexicalNode.Encoded>;
    readonly direction: null | Direction;
    readonly format: ElementFormat;
    readonly indent: number;
    readonly textFormat?: number;
    readonly textStyle?: string;
  }
}

/**
 * Mirrors `SerializedTextNode` minus the discriminant. Tags can only be
 * introduced on concrete classes (overriding a parent's `S.tag` literal in
 * `.extend` would intersect `{type: "tab"} & {type: "text"}` into `never`),
 * so lexical's `TabNode extends TextNode` becomes two siblings of TextBase.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TextBase } from "@beep/lexical-schema/Lexical.model"
 *
 * TextBase.name // => "TextBase"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextBase extends BaseNode.extend<TextBase>($I`TextBase`)(
  {
    detail: TextDetailMask.annotateKey({ description: "TextDetailType bitmask." }),
    format: TextFormatMask.annotateKey({
      description: "TextFormatType bitmask (bold=1, italic=2, strikethrough=4, code=16).",
    }),
    mode: TextMode.annotateKey({ description: "Text node mode." }),
    style: SafeInlineStyle.annotateKey({
      description: "Inline CSS style, sanitized to an allowlist of safe presentation properties.",
    }),
    text: S.String.annotateKey({ description: "The text content." }),
  },
  $I.annote("TextBase", { description: "Schema base shared by text-like Lexical leaf nodes." })
) {}

/**
 * Companion namespace for {@link TextBase}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TextBase } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<TextBase.Type, S.SchemaError> = S.decodeUnknownResult(TextBase)({
 *   version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "hi"
 * })
 * console.log(Result.isSuccess(result) && result.success.text === "hi") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TextBase {
  /**
   * Companion decoded type for {@link TextBase}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends BaseNode.Type {
    readonly detail: TextDetailMask;
    readonly format: TextFormatMask;
    readonly mode: TextMode;
    readonly style: string;
    readonly text: string;
  }

  /**
   * Companion encoded type for {@link TextBase}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends BaseNode.Encoded {
    readonly detail: number;
    readonly format: number;
    readonly mode: TextMode;
    readonly style: string;
    readonly text: string;
  }
}

/**
 * Mirrors `SerializedTextNode`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TextNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TextNode)({
 *   type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "Hello"
 * })
 * Result.isSuccess(result) && result.success.text === "Hello" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextNode extends TextBase.extend<TextNode>($I`TextNode`)(
  {
    type: S.tag("text"),
  },
  $I.annote("TextNode", { description: "A serialized Lexical text leaf node." })
) {}

/**
 * Companion namespace for {@link TextNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TextNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<TextNode.Type, S.SchemaError> = S.decodeUnknownResult(TextNode)({
 *   type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "Hello"
 * })
 * console.log(Result.isSuccess(result) && result.success.text === "Hello") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TextNode {
  /**
   * Companion decoded type for {@link TextNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends TextBase.Type {
    readonly type: "text";
  }

  /**
   * Companion encoded type for {@link TextNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends TextBase.Encoded {
    readonly type: "text";
  }
}

/**
 * Mirrors `SerializedTabNode`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TabNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(TabNode)({
 *   type: "tab", version: 1, detail: 2, format: 0, mode: "normal", style: "", text: "\t"
 * })
 * Result.isSuccess(result) && result.success.type === "tab" // => true
 * ```
 *
 * @invariant Strict tab nodes store exactly `"\t"`, use normal mode, and carry Lexical's unmergeable detail bit.
 * @see {@link https://github.com/facebook/lexical/blob/ffe90924bd55b5d450c88de0f9f1c8b228c4a221/packages/lexical/src/nodes/LexicalTabNode.ts | Pinned Lexical TabNode source} for the upstream serialized shape.
 * @category models
 * @since 0.0.0
 */
export class TabNode extends TextBase.extend<TabNode>($I`TabNode`)(
  {
    type: S.tag("tab"),
    detail: S.Literal(2).pipe(S.brand("TextDetailMask")),
    mode: S.Literal("normal"),
    text: S.Literal("\t"),
  },
  $I.annote("TabNode", {
    description: "A serialized Lexical tab leaf node with canonical tab text, mode, and unmergeable detail.",
  })
) {}

/**
 * Companion namespace for {@link TabNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TabNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<TabNode.Type, S.SchemaError> = S.decodeUnknownResult(TabNode)({
 *   type: "tab", version: 1, detail: 2, format: 0, mode: "normal", style: "", text: "\t"
 * })
 * console.log(Result.isSuccess(result) && result.success.type === "tab") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TabNode {
  /**
   * Companion decoded type for {@link TabNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends TextBase.Type {
    readonly detail: TextDetailMask & 2;
    readonly mode: "normal";
    readonly text: "\t";
    readonly type: "tab";
  }

  /**
   * Companion encoded type for {@link TabNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends TextBase.Encoded {
    readonly detail: 2;
    readonly mode: "normal";
    readonly text: "\t";
    readonly type: "tab";
  }
}

/**
 * Mirrors `SerializedLineBreakNode`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LineBreakNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(LineBreakNode)({ type: "linebreak", version: 1 })
 * Result.isSuccess(result) && result.success.type === "linebreak" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineBreakNode extends BaseNode.extend<LineBreakNode>($I`LineBreakNode`)(
  {
    type: S.tag("linebreak"),
  },
  $I.annote("LineBreakNode", { description: "A serialized Lexical line-break leaf node." })
) {}

/**
 * Companion namespace for {@link LineBreakNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LineBreakNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<LineBreakNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(LineBreakNode)({ type: "linebreak", version: 1 })
 * console.log(Result.isSuccess(result) && result.success.type === "linebreak") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LineBreakNode {
  /**
   * Companion decoded type for {@link LineBreakNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends BaseNode.Type {
    readonly type: "linebreak";
  }

  /**
   * Companion encoded type for {@link LineBreakNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends BaseNode.Encoded {
    readonly type: "linebreak";
  }
}

/**
 * Mirrors `SerializedRootNode`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { RootNode } from "@beep/lexical-schema/Lexical.model"
 *
 * RootNode.name // => "RootNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootNode extends ElementNode.extend<RootNode>($I`RootNode`)(
  {
    type: S.tag("root"),
  },
  $I.annote("RootNode", { description: "The serialized Lexical document root element." })
) {}

/**
 * Companion namespace for {@link RootNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { RootNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<RootNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(RootNode)({ type: "root", version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.type === "root") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RootNode {
  /**
   * Companion decoded type for {@link RootNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly type: "root";
  }

  /**
   * Companion encoded type for {@link RootNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly type: "root";
  }
}

/**
 * Mirrors `SerializedParagraphNode`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ParagraphNode } from "@beep/lexical-schema/Lexical.model"
 *
 * ParagraphNode.name // => "ParagraphNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParagraphNode extends ElementNode.extend<ParagraphNode>($I`ParagraphNode`)(
  {
    type: S.tag("paragraph"),
  },
  $I.annote("ParagraphNode", { description: "A serialized Lexical paragraph element node." })
) {}

/**
 * Companion namespace for {@link ParagraphNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ParagraphNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<ParagraphNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(ParagraphNode)({ type: "paragraph", version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.type === "paragraph") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ParagraphNode {
  /**
   * Companion decoded type for {@link ParagraphNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly type: "paragraph";
  }

  /**
   * Companion encoded type for {@link ParagraphNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly type: "paragraph";
  }
}

/**
 * Mirrors `SerializedHeadingNode` from `@lexical/rich-text`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { HeadingNode } from "@beep/lexical-schema/Lexical.model"
 *
 * HeadingNode.name // => "HeadingNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeadingNode extends ElementNode.extend<HeadingNode>($I`HeadingNode`)(
  {
    type: S.tag("heading"),
    tag: HeadingTag.annotateKey({ description: "Heading level tag." }),
  },
  $I.annote("HeadingNode", { description: "A serialized Lexical heading element node." })
) {}

/**
 * Companion namespace for {@link HeadingNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { HeadingNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<HeadingNode.Type, S.SchemaError> = S.decodeUnknownResult(HeadingNode)({
 *   type: "heading", version: 1, children: [], tag: "h1"
 * })
 * console.log(Result.isSuccess(result) && result.success.tag === "h1") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HeadingNode {
  /**
   * Companion decoded type for {@link HeadingNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly tag: HeadingTag;
    readonly type: "heading";
  }

  /**
   * Companion encoded type for {@link HeadingNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly tag: HeadingTag;
    readonly type: "heading";
  }
}

/**
 * Mirrors `SerializedQuoteNode` from `@lexical/rich-text`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { QuoteNode } from "@beep/lexical-schema/Lexical.model"
 *
 * QuoteNode.name // => "QuoteNode"
 * ```
 *
 * @see {@link https://github.com/facebook/lexical/blob/ffe90924bd55b5d450c88de0f9f1c8b228c4a221/packages/lexical-rich-text/src/index.ts | Pinned Lexical QuoteNode source} for the upstream serialized shape.
 * @category models
 * @since 0.0.0
 */
export class QuoteNode extends ElementNode.extend<QuoteNode>($I`QuoteNode`)(
  {
    type: S.tag("quote"),
    shadowRoot: S.OptionFromOptional(S.Boolean).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Whether this quote is a multi-block shadow-root region rather than a legacy inline quote.",
      })
    ),
  },
  $I.annote("QuoteNode", {
    description: "A serialized Lexical quote whose optional shadow-root mode controls its child grammar.",
  })
) {}

/**
 * Companion namespace for {@link QuoteNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { QuoteNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<QuoteNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(QuoteNode)({ type: "quote", version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.type === "quote") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace QuoteNode {
  /**
   * Companion decoded type for {@link QuoteNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly shadowRoot: O.Option<boolean>;
    readonly type: "quote";
  }

  /**
   * Companion encoded type for {@link QuoteNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly shadowRoot?: boolean | undefined;
    readonly type: "quote";
  }
}

const ListNodeFields = S.Struct({
  type: S.tag("list"),
  listType: ListType.annotateKey({ description: "List semantics." }),
  start: LexicalListStart.annotateKey({ description: "Starting number for ordered lists." }),
  tag: ListTag.annotateKey({ description: "HTML list tag." }),
})
  .check(
    S.makeFilter(
      ({ listType, tag }) =>
        ListType.$match(listType, {
          number: () => ListTag.is.ol(tag),
          bullet: () => ListTag.is.ul(tag),
          check: () => ListTag.is.ul(tag),
        }),
      {
        identifier: $I`ListNodeTagCheck`,
        title: "Canonical List Node Tag",
        description: "Checks that the serialized list tag is the canonical tag derived from its list semantics.",
        message: "Expected number lists to use ol and bullet or check lists to use ul.",
      }
    )
  )
  .pipe(
    $I.annoteSchema("ListNodeFields", {
      description: "Serialized Lexical list fields whose tag agrees with the list semantics.",
    })
  );

/**
 * Mirrors `SerializedListNode` from `@lexical/list`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ListNode } from "@beep/lexical-schema/Lexical.model"
 *
 * ListNode.name // => "ListNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ListNode extends ElementNode.extend<ListNode>($I`ListNode`)(
  ListNodeFields,
  $I.annote("ListNode", { description: "A serialized Lexical list element node." })
) {
  /**
   * Type guard narrowing an arbitrary Lexical node to a list node.
   *
   * @category guards
   * @since 0.0.0
   */
  static readonly is = S.is(ListNode);
}

/**
 * Companion namespace for {@link ListNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ListNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<ListNode.Type, S.SchemaError> = S.decodeUnknownResult(ListNode)({
 *   type: "list", version: 1, children: [], listType: "bullet", start: 1, tag: "ul"
 * })
 * console.log(Result.isSuccess(result) && result.success.tag === "ul") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ListNode {
  /**
   * Companion decoded type for {@link ListNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly listType: ListType;
    readonly start: PosInt;
    readonly tag: ListTag;
    readonly type: "list";
  }

  /**
   * Companion encoded type for {@link ListNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly listType: ListType;
    readonly start: number;
    readonly tag: ListTag;
    readonly type: "list";
  }
}

const ListNodeValueFields = ListNode.mapFields(Struct.omit(["type", "listType", "tag"])).fields;

/**
 * Flat list-node payload variants keyed by their semantic list type.
 *
 * **Details**
 *
 * This additive payload view keeps the existing flat `ListNode` wire and
 * constructor shape. Its case constructors derive the canonical HTML tag for
 * each list type, and the resulting payload is passed to {@link ListNode} to
 * retain the class schema's nominal identity and recursive checks.
 *
 * **Example** (Construct a canonical numbered list)
 *
 * ```ts import.meta.vitest name="Construct a canonical numbered list"
 * import { ListNode, ListNodeValue } from "@beep/lexical-schema/Lexical.model"
 * import { PosInt } from "@beep/schema"
 *
 * const payload = ListNodeValue.cases.number.make({ children: [], start: PosInt.make(1) })
 * const node = ListNode.make(payload)
 *
 * node.listType // => "number"
 * node.tag // => "ol"
 * ```
 *
 * @invariant Numbered lists use `ol`; bullet and check lists use `ul`.
 * @see {@link https://github.com/facebook/lexical/blob/ffe90924bd55b5d450c88de0f9f1c8b228c4a221/packages/lexical-list/src/LexicalListNode.ts | Pinned Lexical ListNode source} for the upstream list-type-to-tag derivation.
 * @category models
 * @since 0.0.0
 */
export const ListNodeValue = ListType.toTaggedUnion("listType")({
  number: {
    ...ListNodeValueFields,
    tag: S.tag("ol"),
  },
  bullet: {
    ...ListNodeValueFields,
    tag: S.tag("ul"),
  },
  check: {
    ...ListNodeValueFields,
    tag: S.tag("ul"),
  },
}).pipe(
  $I.annoteSchema("ListNodeValue", {
    description: "Flat Lexical list-node payload variants whose HTML tag is determined by their semantic list type.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime payload represented by {@link ListNodeValue}.
 *
 * @see {@link ListNodeValue} for case constructors, guards, and exhaustive matching.
 * @category models
 * @since 0.0.0
 */
export type ListNodeValue = typeof ListNodeValue.Type;

/**
 * Mirrors `SerializedListItemNode` from `@lexical/list` — `checked` is
 * `boolean | undefined` on the wire.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { ListItemNode } from "@beep/lexical-schema/Lexical.model"
 *
 * ListItemNode.name // => "ListItemNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ListItemNode extends ElementNode.extend<ListItemNode>($I`ListItemNode`)(
  {
    type: S.tag("listitem"),
    checked: S.OptionFromOptional(S.Boolean).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Checkbox state for check lists; absent otherwise.",
      })
    ),
    value: LexicalListItemValue.annotateKey({ description: "Ordinal value within the list." }),
  },
  $I.annote("ListItemNode", { description: "A serialized Lexical list-item element node." })
) {
  /**
   * Type guard narrowing an arbitrary Lexical node to a list-item node.
   *
   * @category guards
   * @since 0.0.0
   */
  static readonly is = S.is(ListItemNode);
}

/**
 * Companion namespace for {@link ListItemNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ListItemNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<ListItemNode.Type, S.SchemaError> = S.decodeUnknownResult(ListItemNode)({
 *   type: "listitem", version: 1, children: [], value: 1
 * })
 * console.log(Result.isSuccess(result) && result.success.value === 1) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ListItemNode {
  /**
   * Companion decoded type for {@link ListItemNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly checked: O.Option<boolean>;
    readonly type: "listitem";
    readonly value: PosInt;
  }

  /**
   * Companion encoded type for {@link ListItemNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly checked?: boolean | undefined;
    readonly type: "listitem";
    readonly value: number;
  }
}

/**
 * Mirrors `SerializedLinkNode` from `@lexical/link`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { LinkNode } from "@beep/lexical-schema/Lexical.model"
 *
 * LinkNode.name // => "LinkNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkNode extends ElementNode.extend<LinkNode>($I`LinkNode`)(
  {
    type: S.tag("link"),
    url: SafeUrl.annotateKey({ description: "The link target URL, sanitized before it reaches an anchor href." }),
    rel: S.OptionFromOptionalNullOr(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional anchor rel attribute." })
    ),
    target: S.OptionFromOptionalNullOr(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional anchor target attribute." })
    ),
    title: S.OptionFromOptionalNullOr(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional anchor title attribute." })
    ),
  },
  $I.annote("LinkNode", { description: "A serialized Lexical hyperlink element node." })
) {}

/**
 * Companion namespace for {@link LinkNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LinkNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<LinkNode.Type, S.SchemaError> = S.decodeUnknownResult(LinkNode)({
 *   type: "link", version: 1, children: [], url: "https://example.com"
 * })
 * console.log(Result.isSuccess(result) && result.success.url === "https://example.com") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LinkNode {
  /**
   * Companion decoded type for {@link LinkNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly rel: O.Option<string>;
    readonly target: O.Option<string>;
    readonly title: O.Option<string>;
    readonly type: "link";
    readonly url: string;
  }

  /**
   * Companion encoded type for {@link LinkNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly rel?: string | null | undefined;
    readonly target?: string | null | undefined;
    readonly title?: string | null | undefined;
    readonly type: "link";
    readonly url: string;
  }
}

/**
 * Mirrors `SerializedCodeNode` from `@lexical/code` — `language` is
 * `string | null | undefined` on the wire.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { CodeNode } from "@beep/lexical-schema/Lexical.model"
 *
 * CodeNode.name // => "CodeNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeNode extends ElementNode.extend<CodeNode>($I`CodeNode`)(
  {
    type: S.tag("code"),
    language: CodeNodeLanguage.pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional code-fence language identifier.",
      })
    ),
    theme: S.OptionFromOptional(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional code highlight theme." })
    ),
  },
  $I.annote("CodeNode", { description: "A serialized Lexical fenced code-block element node." })
) {}

/**
 * Companion namespace for {@link CodeNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { CodeNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<CodeNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(CodeNode)({ type: "code", version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.type === "code") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CodeNode {
  /**
   * Companion decoded type for {@link CodeNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly language: O.Option<MdCodeFenceLanguage>;
    readonly theme: O.Option<string>;
    readonly type: "code";
  }

  /**
   * Companion encoded type for {@link CodeNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly language?: string | null | undefined;
    readonly theme?: string | undefined;
    readonly type: "code";
  }
}

/**
 * Net-new decorator block node owned by this package: a reference to a
 * runtime artifact, rendered as a chip in the editor and round-tripped to
 * `@beep/md` as a paragraph wrapping an `artifact://` link.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ArtifactRefNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(ArtifactRefNode)({
 *   type: "artifact-ref", version: 1, artifactId: "artifact-123"
 * })
 * Result.isSuccess(result) && result.success.artifactId === "artifact-123" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactRefNode extends BaseNode.extend<ArtifactRefNode>($I`ArtifactRefNode`)(
  {
    type: S.tag("artifact-ref"),
    artifactId: ArtifactRefId.annotateKey({ description: "Identifier of the referenced runtime artifact." }),
    label: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional human-readable label; defaults to the artifact id when absent.",
      })
    ),
  },
  $I.annote("ArtifactRefNode", { description: "A serialized block-level reference to a runtime artifact." })
) {}

/**
 * Companion namespace for {@link ArtifactRefNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ArtifactRefNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<ArtifactRefNode.Type, S.SchemaError> = S.decodeUnknownResult(ArtifactRefNode)({
 *   type: "artifact-ref", version: 1, artifactId: "artifact-123"
 * })
 * console.log(Result.isSuccess(result) && result.success.artifactId === "artifact-123") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ArtifactRefNode {
  /**
   * Companion decoded type for {@link ArtifactRefNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends BaseNode.Type {
    readonly artifactId: ArtifactRefId;
    readonly label: O.Option<string>;
    readonly type: "artifact-ref";
  }

  /**
   * Companion encoded type for {@link ArtifactRefNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends BaseNode.Encoded {
    readonly artifactId: string;
    readonly label?: string;
    readonly type: "artifact-ref";
  }
}

/**
 * Package-owned YouTube decorator block node.
 *
 * Mirrors the serialized shape used by the editor runtime:
 * `{ type: "youtube", videoID, format }`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { YouTubeNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(YouTubeNode)({
 *   type: "youtube", version: 1, videoID: "M7lc1UVf-VE", format: ""
 * })
 * Result.isSuccess(result) && result.success.videoID === "M7lc1UVf-VE" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YouTubeNode extends BaseNode.extend<YouTubeNode>($I`YouTubeNode`)(
  {
    type: S.tag("youtube"),
    videoID: YouTubeVideoIdFromLegacyInput.annotateKey({
      description: "The bare YouTube video id rendered by the decorator block.",
    }),
    format: ElementFormat.pipe(
      SchemaUtils.withConstantDefault<ElementFormat>(""),
      S.annotateKey({ description: "Block alignment format token applied to the embed." })
    ),
  },
  $I.annote("YouTubeNode", { description: "A serialized YouTube decorator block node." })
) {}

/**
 * Companion namespace for {@link YouTubeNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { YouTubeNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<YouTubeNode.Type, S.SchemaError> = S.decodeUnknownResult(YouTubeNode)({
 *   type: "youtube", version: 1, videoID: "M7lc1UVf-VE", format: ""
 * })
 * console.log(Result.isSuccess(result) && result.success.videoID === "M7lc1UVf-VE") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace YouTubeNode {
  /**
   * Companion decoded type for {@link YouTubeNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends BaseNode.Type {
    readonly format: ElementFormat;
    readonly type: "youtube";
    readonly videoID: MdYouTubeVideoId;
  }

  /**
   * Companion encoded type for {@link YouTubeNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends BaseNode.Encoded {
    readonly format: ElementFormat;
    readonly type: "youtube";
    readonly videoID: string;
  }
}

/**
 * Serialized table cell node from `@lexical/table`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TableCellNode } from "@beep/lexical-schema/Lexical.model"
 *
 * TableCellNode.name // => "TableCellNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableCellNode extends ElementNode.extend<TableCellNode>($I`TableCellNode`)(
  {
    type: S.tag("tablecell"),
    headerState: TableCellHeaderState.annotateKey({
      description: "TableCellHeaderState bitmask: 0 none, 1 row header, 2 column header, 3 both.",
    }),
    colSpan: TableCellSpan.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional colspan for merged table cells." })
    ),
    rowSpan: TableCellSpan.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional rowspan for merged table cells." })
    ),
    width: TableDimension.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional cell width emitted by Lexical table nodes." })
    ),
    backgroundColor: SafeStyleValue.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional cell background color emitted by Lexical table nodes, sanitized to a safe CSS value.",
      })
    ),
    verticalAlign: SafeStyleValue.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional vertical alignment emitted by Lexical table nodes, sanitized to a safe CSS value.",
      })
    ),
  },
  $I.annote("TableCellNode", { description: "A serialized Lexical table cell element node." })
) {
  /**
   * Type guard narrowing an arbitrary Lexical node to a table cell node.
   *
   * @category guards
   * @since 0.0.0
   */
  static readonly is = S.is(TableCellNode);
}

/**
 * Companion namespace for {@link TableCellNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TableCellNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<TableCellNode.Type, S.SchemaError> = S.decodeUnknownResult(TableCellNode)({
 *   type: "tablecell", version: 1, children: [], headerState: 0
 * })
 * console.log(Result.isSuccess(result) && result.success.headerState === 0) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableCellNode {
  /**
   * Companion decoded type for {@link TableCellNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly backgroundColor: O.Option<string>;
    readonly colSpan: O.Option<TableCellSpan>;
    readonly headerState: TableCellHeaderState;
    readonly rowSpan: O.Option<TableCellSpan>;
    readonly type: "tablecell";
    readonly verticalAlign: O.Option<string>;
    readonly width: O.Option<TableDimension>;
  }

  /**
   * Companion encoded type for {@link TableCellNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly backgroundColor?: string | null | undefined;
    readonly colSpan?: number | undefined;
    readonly headerState: TableCellHeaderState;
    readonly rowSpan?: number | undefined;
    readonly type: "tablecell";
    readonly verticalAlign?: string | undefined;
    readonly width?: number | undefined;
  }
}

/**
 * Serialized table row node from `@lexical/table`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TableRowNode } from "@beep/lexical-schema/Lexical.model"
 *
 * TableRowNode.name // => "TableRowNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableRowNode extends ElementNode.extend<TableRowNode>($I`TableRowNode`)(
  {
    type: S.tag("tablerow"),
    height: TableDimension.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional row height emitted by Lexical table nodes." })
    ),
  },
  $I.annote("TableRowNode", { description: "A serialized Lexical table row element node." })
) {
  /**
   * Type guard narrowing an arbitrary Lexical node to a table row node.
   *
   * @category guards
   * @since 0.0.0
   */
  static readonly is = S.is(TableRowNode);
}

/**
 * Companion namespace for {@link TableRowNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TableRowNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<TableRowNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(TableRowNode)({ type: "tablerow", version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.type === "tablerow") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableRowNode {
  /**
   * Companion decoded type for {@link TableRowNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly height: O.Option<TableDimension>;
    readonly type: "tablerow";
  }

  /**
   * Companion encoded type for {@link TableRowNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly height?: number | undefined;
    readonly type: "tablerow";
  }
}

/**
 * Serialized table node from `@lexical/table`.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { TableNode } from "@beep/lexical-schema/Lexical.model"
 *
 * TableNode.name // => "TableNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableNode extends ElementNode.extend<TableNode>($I`TableNode`)(
  {
    type: S.tag("table"),
    colWidths: S.Array(TableDimension).pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional table column widths emitted by Lexical table nodes." })
    ),
    rowStriping: S.Boolean.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional row-striping flag emitted by Lexical table nodes." })
    ),
    frozenColumnCount: NonNegativeInt.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional number of frozen columns emitted by Lexical table nodes." })
    ),
    frozenRowCount: NonNegativeInt.pipe(
      S.OptionFromOptional,
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional number of frozen rows emitted by Lexical table nodes." })
    ),
  },
  $I.annote("TableNode", { description: "A serialized Lexical table element node." })
) {}

/**
 * Companion namespace for {@link TableNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TableNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<TableNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(TableNode)({ type: "table", version: 1, children: [] })
 * console.log(Result.isSuccess(result) && result.success.type === "table") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableNode {
  /**
   * Companion decoded type for {@link TableNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends ElementNode.Type {
    readonly colWidths: O.Option<ReadonlyArray<TableDimension>>;
    readonly frozenColumnCount: O.Option<NonNegativeInt>;
    readonly frozenRowCount: O.Option<NonNegativeInt>;
    readonly rowStriping: O.Option<boolean>;
    readonly type: "table";
  }

  /**
   * Companion encoded type for {@link TableNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends ElementNode.Encoded {
    readonly colWidths?: ReadonlyArray<number> | undefined;
    readonly frozenColumnCount?: number | undefined;
    readonly frozenRowCount?: number | undefined;
    readonly rowStriping?: boolean | undefined;
    readonly type: "table";
  }
}

// Element recursion decodes through this structural union once; the exported
// schema below performs the recursive parent-child check over the decoded tree.
const RawLexicalNode = S.Union([
  // leaves
  TextNode,
  TabNode,
  LineBreakNode,
  ArtifactRefNode,
  YouTubeNode,
  // elements
  RootNode,
  ParagraphNode,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  TableNode,
  TableRowNode,
  TableCellNode,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("RawLexicalNode", {
    description: "Internal structural union used to decode recursive Lexical children before tree validation.",
    parseOptions: strictSemanticParseOptions,
  })
);

/**
 * The strict tagged union of all v1 serialized Lexical nodes, discriminated by
 * Lexical's own `type` key and validated against the recursive child grammar.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(LexicalNode)({ type: "linebreak", version: 1 })
 * Result.isSuccess(result) && result.success.type === "linebreak" // => true
 * ```
 *
 * @invariant Quote children are block-compatible only in shadow-root mode; legacy quote children are inline-only.
 * @category models
 * @since 0.0.0
 */
export const LexicalNode = RawLexicalNode.check(
  S.makeFilter(isStrictLexicalNode, {
    identifier: $I`StrictLexicalNodeTreeCheck`,
    title: "Strict Lexical Node",
    description:
      "A serialized Lexical node whose recursive child topology follows the supported v1 grammar, with a non-empty document root.",
    message: "Expected every Lexical node to appear under a compatible v1 parent and root nodes to be non-empty.",
  })
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("LexicalNode", {
    description:
      "The strict tagged union of v1 serialized Lexical nodes, including recursive parent-child grammar and non-empty root validation.",
    parseOptions: strictSemanticParseOptions,
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded type of the strict v1 serialized Lexical node union.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { LexicalNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const nodeType = (node: LexicalNode) => node.type
 * console.log(nodeType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LexicalNode = typeof LexicalNode.Type;

/**
 * Companion namespace for {@link LexicalNode}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<LexicalNode.Type, S.SchemaError> =
 *   S.decodeUnknownResult(LexicalNode)({ type: "linebreak", version: 1 })
 * console.log(Result.isSuccess(result) && result.success.type === "linebreak") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LexicalNode {
  /**
   * Companion decoded type for {@link LexicalNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type =
    | TextNode.Type
    | TabNode.Type
    | LineBreakNode.Type
    | ArtifactRefNode.Type
    | YouTubeNode.Type
    | RootNode.Type
    | ParagraphNode.Type
    | HeadingNode.Type
    | QuoteNode.Type
    | ListNode.Type
    | ListItemNode.Type
    | LinkNode.Type
    | CodeNode.Type
    | TableNode.Type
    | TableRowNode.Type
    | TableCellNode.Type;

  /**
   * Companion encoded type for {@link LexicalNode}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded =
    | TextNode.Encoded
    | TabNode.Encoded
    | LineBreakNode.Encoded
    | ArtifactRefNode.Encoded
    | YouTubeNode.Encoded
    | RootNode.Encoded
    | ParagraphNode.Encoded
    | HeadingNode.Encoded
    | QuoteNode.Encoded
    | ListNode.Encoded
    | ListItemNode.Encoded
    | LinkNode.Encoded
    | CodeNode.Encoded
    | TableNode.Encoded
    | TableRowNode.Encoded
    | TableCellNode.Encoded;
}

const StrictRootNode = RootNode.check(
  S.makeFilter((node) => A.isReadonlyArrayNonEmpty(node.children) && hasStrictNodeChildren(node), {
    identifier: $I`StrictRootNodeTreeCheck`,
    title: "Strict Root Node",
    description: "A non-empty serialized Lexical root whose recursive child topology follows the supported v1 grammar.",
    message: "Expected at least one root child and every Lexical node to appear under a compatible v1 parent.",
  })
);

/**
 * Models the strict runtime-compatible subset of `SerializedEditorState`.
 *
 * **Details**
 *
 * Use {@link SerializedEditorStateWire} when persistence or migration must
 * retain runtime-incompatible wire, including an empty root.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(SerializedEditorState)({
 *   root: {
 *     type: "root", version: 1, direction: null, format: "", indent: 0,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   }
 * })
 * Result.isSuccess(result) && result.success.root.type === "root" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SerializedEditorState extends S.Class<SerializedEditorState>($I`SerializedEditorState`)(
  {
    root: StrictRootNode.annotateKey({ description: "The non-empty strict v1 document root node." }),
  },
  $I.annote("SerializedEditorState", {
    description: "The runtime-compatible serialized Lexical editor state envelope with a non-empty root.",
    parseOptions: strictSemanticParseOptions,
  })
) {
  /**
   * Soft-decodes an unknown serialized editor-state payload.
   *
   * **Example** (Use the lexical model)
   *
   * ```ts import.meta.vitest name="Use the lexical model"
   * import * as O from "effect/Option"
   * import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model"
   *
   * const state = SerializedEditorState.decodeOption({
   *   root: {
   *     type: "root", version: 1, direction: null, format: "", indent: 0,
   *     children: [{
   *       type: "paragraph", version: 1, children: [],
   *       direction: null, format: "", indent: 0
   *     }]
   *   }
   * })
   * O.isSome(state) // => true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeOption: {
    (input: unknown, options?: AST.ParseOptions): O.Option<SerializedEditorState>;
    (options?: AST.ParseOptions): (input: unknown) => O.Option<SerializedEditorState>;
  } = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownOption(SerializedEditorState));
}

/**
 * Companion namespace for {@link SerializedEditorState}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model"
 *
 * const result: Result.Result<SerializedEditorState.Type, S.SchemaError> =
 *   S.decodeUnknownResult(SerializedEditorState)({
 *     root: {
 *       type: "root", version: 1, direction: null, format: "", indent: 0,
 *       children: [{
 *         type: "paragraph", version: 1, children: [],
 *         direction: null, format: "", indent: 0
 *       }]
 *     }
 *   })
 * console.log(Result.isSuccess(result) && result.success.root.type === "root") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SerializedEditorState {
  /**
   * Companion decoded type for {@link SerializedEditorState}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type {
    readonly root: RootNode.Type;
  }

  /**
   * Companion encoded type for {@link SerializedEditorState}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly root: RootNode.Encoded;
  }
}

/**
 * JSON-only wire node that retains unknown node types, versions, and fields.
 *
 * **Details**
 *
 * This is a persistence and migration shape, not a render-safe semantic node.
 * Decode through {@link decodeEditorStateStrict} before using values in editor
 * behavior or DOM adapters. `StructWithRest` is intentional here: Effect
 * schema classes accept closed `Struct` fields and cannot retain arbitrary
 * future keys. Replacing this open wire object with a class would discard
 * unknown fields, versions, or `"$"` NodeState and violate lossless identity.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNodeWire } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = S.decodeUnknownEffect(LexicalNodeWire)({
 *   type: "future-node", version: 7, pluginData: { enabled: true },
 * })
 * Effect.runPromise(program).then((node) => console.log(node.type))
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const LexicalNodeWire = S.StructWithRest(
  S.Struct({
    children: S.optionalKey(S.Json),
    type: S.String,
    version: S.Int,
  }),
  [S.Record(S.String, S.Json)]
).pipe(
  $I.annoteSchema("LexicalNodeWire", {
    description: "JSON-only Lexical node wire preserving unknown types, versions, and fields exactly.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link LexicalNodeWire}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { LexicalNodeWire } from "@beep/lexical-schema/Lexical.model"
 *
 * const node: LexicalNodeWire = { type: "future-node", version: 2 }
 * console.log(node.type)
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export type LexicalNodeWire = typeof LexicalNodeWire.Type;

/**
 * Companion opaque JSON types for {@link LexicalNodeWire}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { LexicalNodeWire } from "@beep/lexical-schema/Lexical.model"
 *
 * const children: LexicalNodeWire.Type["children"] = { futureShape: true }
 * console.log(children)
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export declare namespace LexicalNodeWire {
  /**
   * Decoded opaque wire node.
   *
   * @category serialization
   * @since 0.0.0
   */
  export type Type = LexicalNodeWire;

  /**
   * Encoded opaque wire node.
   *
   * @category serialization
   * @since 0.0.0
   */
  export type Encoded = S.Codec.Encoded<typeof LexicalNodeWire>;
}

/**
 * Lossless JSON-only editor-state envelope.
 *
 * **Details**
 *
 * This is deliberately an open `StructWithRest`, not a class model. Both the
 * envelope and root may carry future extension fields, while root `children`
 * must remain an array of open {@link LexicalNodeWire} values. A closed class
 * would discard top-level or root extensions and break exact wire identity.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { SerializedEditorStateWire } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = S.decodeUnknownEffect(SerializedEditorStateWire)({
 *   root: { type: "root", version: 3, children: [], plugin: "future" },
 *   editorExtension: { enabled: true },
 * })
 * Effect.runPromise(program).then((state) => console.log(state.root.version))
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const SerializedEditorStateWire = S.StructWithRest(
  S.Struct({
    root: S.StructWithRest(
      S.Struct({
        children: S.Array(LexicalNodeWire),
        type: S.Literal("root"),
        version: S.Int,
      }),
      [S.Record(S.String, S.Json)]
    ),
  }),
  [S.Record(S.String, S.Json)]
).pipe(
  $I.annoteSchema("SerializedEditorStateWire", {
    description: "Lossless JSON-only editor-state envelope retaining top-level and recursive extension fields.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link SerializedEditorStateWire}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import type { SerializedEditorStateWire } from "@beep/lexical-schema/Lexical.model"
 *
 * const state: SerializedEditorStateWire = { root: { type: "root", version: 1, children: [] } }
 * console.log(state.root.type)
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export type SerializedEditorStateWire = typeof SerializedEditorStateWire.Type;

/**
 * Lossless editor-state wire codec over a JSON string.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { EditorStateWireFromJson } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = S.decodeUnknownEffect(EditorStateWireFromJson)(
 *   '{"root":{"type":"root","version":2,"children":[],"future":true}}'
 * )
 * Effect.runPromise(program).then((state) => console.log(state.root.version))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const EditorStateWireFromJson = S.fromJsonString(SerializedEditorStateWire).pipe(
  $I.annoteSchema("EditorStateWireFromJson", {
    description: "Lossless Lexical editor-state wire codec over its JSON string form.",
  })
);

/**
 * Typed failure raised by strict or lossless editor-state decoding.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Effect } from "effect"
 * import { decodeEditorStateStrict } from "@beep/lexical-schema/Lexical.model"
 *
 * const handled = decodeEditorStateStrict({ root: null }).pipe(
 *   Effect.catchTag("LexicalDecodeError", (error) => Effect.succeed(error.message))
 * )
 * Effect.runPromise(handled).then(console.log)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LexicalDecodeError extends S.TaggedError<LexicalDecodeError>($I`LexicalDecodeError`)(
  "LexicalDecodeError",
  {
    message: S.String,
    cause: Defect({ includeStack: true }),
  },
  $I.annoteError<LexicalDecodeError>("LexicalDecodeError", {
    description: "Typed failure raised when a Lexical semantic or wire payload cannot be decoded.",
  })
) {}

/**
 * Reason a lossless wire payload cannot be used as a strict semantic state.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { LexicalCompatibilityIssue } from "@beep/lexical-schema/Lexical.model"
 *
 * const issue = LexicalCompatibilityIssue.make({ message: "Unknown node type." })
 * console.log(issue.code)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class LexicalCompatibilityIssue extends S.Class<LexicalCompatibilityIssue>($I`LexicalCompatibilityIssue`)(
  {
    code: S.Literal("strict-schema-mismatch").pipe(
      SchemaUtils.withConstantDefault("strict-schema-mismatch"),
      S.annotateKey({ description: "Stable compatibility issue code." })
    ),
    message: S.NonEmptyString.annotateKey({
      description: "Strict semantic decode failure rendered for diagnostics.",
    }),
  },
  $I.annote("LexicalCompatibilityIssue", {
    description: "Reason a lossless Lexical wire payload cannot be used as a strict semantic editor state.",
  })
) {}

/**
 * Compatibility inspection retaining lossless wire alongside an optional
 * strict semantic state.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { analyzeEditorStateCompatibility } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = analyzeEditorStateCompatibility({
 *   root: { type: "root", version: 1, children: [] },
 * })
 * Effect.runPromise(program).then((result) => console.log(result.isCompatible)) // false
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class LexicalCompatibilityResult extends S.Class<LexicalCompatibilityResult>($I`LexicalCompatibilityResult`)(
  {
    issues: S.Array(LexicalCompatibilityIssue).annotateKey({
      description: "Strict semantic compatibility failures; empty when state is available.",
    }),
    state: S.Option(SerializedEditorState).annotateKey({
      description: "Strict semantic state when the lossless wire matches the supported v1 grammar.",
    }),
    wire: SerializedEditorStateWire.annotateKey({
      description: "Lossless wire retained regardless of strict semantic compatibility.",
    }),
  },
  $I.annote("LexicalCompatibilityResult", {
    description: "Lossless Lexical wire plus an optional strict semantic state and compatibility diagnostics.",
  })
) {
  /**
   * Whether the wire can be consumed through the strict semantic model.
   *
   * **Example** (Use the lexical model)
   *
   * ```ts import.meta.vitest name="Use the lexical model"
   * import * as O from "effect/Option"
   * import { LexicalCompatibilityResult } from "@beep/lexical-schema/Lexical.model"
   *
   * const result = LexicalCompatibilityResult.make({
   *   issues: [],
   *   state: O.none(),
   *   wire: { root: { type: "root", version: 1, children: [] } },
   * })
   * result.isCompatible // => false
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get isCompatible(): boolean {
    return O.isSome(this.state);
  }
}

const decodeStrictEditorStateResult = S.decodeUnknownResult(SerializedEditorState);
const decodeLosslessEditorStateResult = S.decodeUnknownResult(SerializedEditorStateWire);
const inspectStrictEditorState = S.decodeUnknownResult(SerializedEditorState);
const strictEditorStateDecodeError = (cause: unknown): LexicalDecodeError =>
  LexicalDecodeError.make({ cause, message: "Lexical editor state failed strict semantic decoding." });
const losslessEditorStateDecodeError = (cause: unknown): LexicalDecodeError =>
  LexicalDecodeError.make({ cause, message: "Lexical editor state failed lossless JSON-wire decoding." });

/**
 * Synchronously decodes an unknown payload into the supported strict semantic
 * editor state without throwing.
 *
 * This Result boundary is intended for synchronous framework callbacks and
 * render admission. Effectful callers should prefer
 * {@link decodeEditorStateStrict}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import { decodeEditorStateStrictResult } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = decodeEditorStateStrictResult({
 *   root: {
 *     type: "root", version: 1, direction: null, format: "", indent: 0,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   },
 * })
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEditorStateStrictResult = (
  input: unknown
): Result.Result<SerializedEditorState, LexicalDecodeError> =>
  decodeStrictEditorStateResult(input).pipe(Result.mapError(strictEditorStateDecodeError));

/**
 * Decodes an unknown payload into the supported strict semantic editor state.
 *
 * **Details**
 *
 * Excess fields, invalid topology, and empty roots that Lexical cannot apply
 * are errors. Use {@link decodeEditorStateLossless} when their exact wire must
 * be retained for migration or read-only fallback.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeEditorStateStrict } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = decodeEditorStateStrict({
 *   root: {
 *     type: "root", version: 1, direction: null, format: "", indent: 0,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   },
 * })
 * Effect.runPromise(program).then((state) => console.log(state.root.type))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEditorStateStrict = (input: unknown): Effect.Effect<SerializedEditorState, LexicalDecodeError> =>
  Effect.fromResult(decodeEditorStateStrictResult(input));

/**
 * Decodes an unknown payload into the JSON-only lossless wire model.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeEditorStateLossless } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = decodeEditorStateLossless({
 *   root: { type: "root", version: 9, children: [], future: true },
 * })
 * Effect.runPromise(program).then((state) => console.log(state.root.version))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEditorStateLossless = (
  input: unknown
): Effect.Effect<SerializedEditorStateWire, LexicalDecodeError> =>
  Effect.fromResult(decodeLosslessEditorStateResult(input).pipe(Result.mapError(losslessEditorStateDecodeError)));

/**
 * Synchronously retains lossless wire and reports whether strict semantic
 * decoding succeeds, without throwing.
 *
 * This Result boundary is intended for synchronous framework rendering.
 * Effectful callers should prefer {@link analyzeEditorStateCompatibility}.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import { analyzeEditorStateCompatibilityResult } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = analyzeEditorStateCompatibilityResult({
 *   root: { type: "root", version: 1, children: [] },
 * })
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const analyzeEditorStateCompatibilityResult = (
  input: unknown
): Result.Result<LexicalCompatibilityResult, LexicalDecodeError> =>
  decodeLosslessEditorStateResult(input).pipe(
    Result.mapError(losslessEditorStateDecodeError),
    Result.map((wire) =>
      Result.match(inspectStrictEditorState(wire), {
        onFailure: (error) =>
          LexicalCompatibilityResult.make({
            issues: [LexicalCompatibilityIssue.make({ message: error.message })],
            state: O.none(),
            wire,
          }),
        onSuccess: (state) => LexicalCompatibilityResult.make({ issues: [], state: O.some(state), wire }),
      })
    )
  );

/**
 * Retains lossless wire and reports whether strict semantic decoding succeeds.
 *
 * **Example** (Use the lexical model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { analyzeEditorStateCompatibility } from "@beep/lexical-schema/Lexical.model"
 *
 * const program = analyzeEditorStateCompatibility({
 *   root: { type: "root", version: 2, children: [], future: true },
 * })
 * Effect.runPromise(program).then((result) => console.log(result.issues.length))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const analyzeEditorStateCompatibility = (
  input: unknown
): Effect.Effect<LexicalCompatibilityResult, LexicalDecodeError> =>
  Effect.fromResult(analyzeEditorStateCompatibilityResult(input));

/**
 * The same envelope, but encoding directly to/from a JSON string (for
 * persistence boundaries).
 *
 * **Example** (Use the lexical model)
 *
 * ```ts import.meta.vitest name="Use the lexical model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { EditorStateFromJson } from "@beep/lexical-schema/Lexical.model"
 *
 * const result = S.decodeUnknownResult(EditorStateFromJson)(
 *   '{"root":{"type":"root","version":1,"children":[{"type":"paragraph","version":1,"children":[],"direction":null,"format":"","indent":0}],"direction":null,"format":"","indent":0}}'
 * )
 * Result.isSuccess(result) && result.success.root.type === "root" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EditorStateFromJson = S.fromJsonString(SerializedEditorState).pipe(
  $I.annoteSchema("EditorStateFromJson", {
    description: "Serialized Lexical editor state codec over its JSON string wire form.",
    parseOptions: strictSemanticParseOptions,
  })
);
