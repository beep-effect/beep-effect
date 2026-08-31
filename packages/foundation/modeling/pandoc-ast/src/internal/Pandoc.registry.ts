import { $PandocAstId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PandocAstId.create("internal/Pandoc.registry");
const $ModelI = $PandocAstId.create("Pandoc.model");

const PandocCurrentInlineConstructorName = LiteralKit([
  "Str",
  "Emph",
  "Underline",
  "Strong",
  "Strikeout",
  "Superscript",
  "Subscript",
  "SmallCaps",
  "Quoted",
  "Cite",
  "Code",
  "Space",
  "SoftBreak",
  "LineBreak",
  "Math",
  "RawInline",
  "Link",
  "Image",
  "Note",
  "Span",
]).pipe(
  $I.annoteSchema("PandocCurrentInlineConstructorName", {
    description: "Exhaustive Pandoc 1.23.1 inline constructor-name registry.",
  })
);

const PandocSupportedInlineConstructorName = LiteralKit(PandocCurrentInlineConstructorName.Options).pipe(
  $I.annoteSchema("PandocSupportedInlineConstructorName", {
    description: "Pandoc inline constructors represented by the strict semantic model.",
  })
);

const PandocCurrentBlockConstructorName = LiteralKit([
  "Plain",
  "Para",
  "LineBlock",
  "CodeBlock",
  "RawBlock",
  "BlockQuote",
  "OrderedList",
  "BulletList",
  "DefinitionList",
  "Header",
  "HorizontalRule",
  "Table",
  "Figure",
  "Div",
]).pipe(
  $I.annoteSchema("PandocCurrentBlockConstructorName", {
    description: "Exhaustive Pandoc 1.23.1 block constructor-name registry.",
  })
);

const PandocSupportedBlockConstructorName = LiteralKit(PandocCurrentBlockConstructorName.Options).pipe(
  $I.annoteSchema("PandocSupportedBlockConstructorName", {
    description: "Pandoc block constructors represented by the strict semantic model.",
  })
);

const PandocCurrentMetaConstructorName = LiteralKit([
  "MetaBool",
  "MetaString",
  "MetaInlines",
  "MetaBlocks",
  "MetaList",
  "MetaMap",
]).pipe(
  $I.annoteSchema("PandocCurrentMetaConstructorName", {
    description: "Exhaustive Pandoc 1.23.1 metadata constructor-name registry.",
  })
);

/**
 * Pandoc quotation-style constructor names.
 *
 * **Example** (Check a double quote marker)
 *
 * ```ts import.meta.vitest name="Check a double quote marker"
 * import { PandocQuoteType } from "@beep/pandoc-ast/Pandoc.model"
 *
 * PandocQuoteType.is.DoubleQuote("DoubleQuote") // => true
 * ```
 *
 * @see {@link https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs#L286-L287} for the pinned pandoc-types definition.
 * @category models
 * @since 0.0.0
 */
export const PandocQuoteType = LiteralKit(["SingleQuote", "DoubleQuote"]).pipe(
  $I.annoteSchema("PandocQuoteTypeConstructorName", {
    description: "Exhaustive Pandoc 1.23.1 quote-type constructor-name registry.",
  })
);

/**
 * Pandoc citation-mode constructor names.
 *
 * **Example** (Check a normal citation marker)
 *
 * ```ts import.meta.vitest name="Check a normal citation marker"
 * import { PandocCitationMode } from "@beep/pandoc-ast/Pandoc.model"
 *
 * PandocCitationMode.is.NormalCitation("NormalCitation") // => true
 * ```
 *
 * @see {@link https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs#L343-L355} for the pinned pandoc-types definition.
 * @category models
 * @since 0.0.0
 */
export const PandocCitationMode = LiteralKit(["AuthorInText", "SuppressAuthor", "NormalCitation"]).pipe(
  $I.annoteSchema("PandocCitationModeConstructorName", {
    description: "Exhaustive Pandoc 1.23.1 citation-mode constructor-name registry.",
  })
);

const PandocCurrentStructuralConstructorName = LiteralKit([
  "Pandoc",
  "Meta",
  "Format",
  "RowHeadColumns",
  "Row",
  "TableHead",
  "TableBody",
  "TableFoot",
  "Caption",
  "Cell",
  "RowSpan",
  "ColSpan",
  "Citation",
]).pipe(
  $I.annoteSchema("PandocCurrentStructuralConstructorName", {
    description: "Pandoc 1.23.1 data and newtype constructor names whose JSON forms are structural or envelope-owned.",
  })
);

/**
 * Pandoc table-alignment constructor names.
 *
 * **Example** (Check AlignDefault constructor name)
 *
 * ```ts
 * import { PandocTableAlignmentConstructorName } from "../internal/Pandoc.registry.js"
 *
 * console.log(PandocTableAlignmentConstructorName.is.AlignDefault("AlignDefault")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocTableAlignmentConstructorName = LiteralKit([
  "AlignLeft",
  "AlignRight",
  "AlignCenter",
  "AlignDefault",
]).pipe(
  $I.annoteSchema("PandocTableAlignmentConstructorName", {
    description: "Constructor names accepted in a Pandoc table-alignment slot.",
  })
);

const PandocTableColumnWidthConstructorName = LiteralKit(["ColWidth", "ColWidthDefault"]).pipe(
  $I.annoteSchema("PandocTableColumnWidthConstructorName", {
    description: "Constructor names accepted in a Pandoc table column-width slot.",
  })
);

/**
 * Pandoc math-mode constructor names.
 *
 * @category models
 * @since 0.0.0
 */
export const PandocMathType = LiteralKit(["InlineMath", "DisplayMath"]).pipe(
  $ModelI.annoteSchema("PandocMathType", {
    description: "Pandoc math mode marker.",
  })
);

/**
 * Pandoc ordered-list numbering-style constructor names.
 *
 * @category models
 * @since 0.0.0
 */
export const PandocListNumberStyle = LiteralKit([
  "DefaultStyle",
  "Example",
  "Decimal",
  "LowerRoman",
  "UpperRoman",
  "LowerAlpha",
  "UpperAlpha",
]).pipe(
  $ModelI.annoteSchema("PandocListNumberStyle", {
    description: "Pandoc ordered-list numbering style constructor.",
  })
);

/**
 * Pandoc ordered-list delimiter constructor names.
 *
 * @category models
 * @since 0.0.0
 */
export const PandocListNumberDelimiter = LiteralKit(["DefaultDelim", "Period", "OneParen", "TwoParens"]).pipe(
  $ModelI.annoteSchema("PandocListNumberDelimiter", {
    description: "Pandoc ordered-list numbering delimiter constructor.",
  })
);

const PandocKnownConstructorName = S.Union([
  PandocCurrentInlineConstructorName,
  PandocCurrentBlockConstructorName,
  PandocCurrentMetaConstructorName,
  PandocQuoteType,
  PandocCitationMode,
  PandocCurrentStructuralConstructorName,
  PandocTableAlignmentConstructorName,
  PandocTableColumnWidthConstructorName,
  PandocMathType,
  PandocListNumberStyle,
  PandocListNumberDelimiter,
  S.Literal("TableCaption"),
]).pipe(
  $I.annoteSchema("PandocKnownConstructorName", {
    description: "Exhaustive Pandoc 1.23.1 constructor-name registry plus the reserved legacy TableCaption alias.",
  })
);

const PandocSupportedConstructorName = S.Union([
  PandocSupportedInlineConstructorName,
  PandocSupportedBlockConstructorName,
  PandocCurrentMetaConstructorName,
  PandocTableAlignmentConstructorName,
  PandocTableColumnWidthConstructorName,
  PandocMathType,
  PandocListNumberStyle,
  PandocListNumberDelimiter,
]).pipe(
  $I.annoteSchema("PandocSupportedConstructorName", {
    description: "Pandoc constructor names represented by the strict semantic model or its structural slots.",
  })
);

/**
 * Returns whether a name belongs to any constructor understood by the strict
 * semantic Pandoc decoder.
 *
 * @category guards
 * @since 0.0.0
 */
export const isPandocKnownConstructorName = S.is(PandocKnownConstructorName);

/**
 * Returns whether a known constructor belongs to the strict semantic subset.
 *
 * @category guards
 * @since 0.0.0
 */
export const isPandocSupportedConstructorName = S.is(PandocSupportedConstructorName);

/**
 * Returns whether a name is a Pandoc table-alignment constructor.
 *
 * @category guards
 * @since 0.0.0
 */
export const isPandocTableAlignmentConstructorName = S.is(PandocTableAlignmentConstructorName);
