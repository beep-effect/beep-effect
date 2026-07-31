import { $PandocAstId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PandocAstId.create("internal/Pandoc.registry");
const $ModelI = $PandocAstId.create("Pandoc.model");

const PandocInlineConstructorName = LiteralKit([
  "Str",
  "Space",
  "SoftBreak",
  "LineBreak",
  "Emph",
  "Strong",
  "Strikeout",
  "Code",
  "Link",
  "Image",
  "Span",
  "Note",
  "Math",
]).pipe(
  $I.annoteSchema("PandocInlineConstructorName", {
    description: "Constructor names recognized by the strict Pandoc inline decoder.",
  })
);

const PandocBlockConstructorName = LiteralKit([
  "Plain",
  "Para",
  "Header",
  "BlockQuote",
  "CodeBlock",
  "BulletList",
  "OrderedList",
  "HorizontalRule",
  "Div",
  "Table",
]).pipe(
  $I.annoteSchema("PandocBlockConstructorName", {
    description: "Constructor names recognized by the strict Pandoc block decoder.",
  })
);

const PandocMetaConstructorName = LiteralKit([
  "MetaBool",
  "MetaString",
  "MetaInlines",
  "MetaBlocks",
  "MetaList",
  "MetaMap",
]).pipe(
  $I.annoteSchema("PandocMetaConstructorName", {
    description: "Constructor names recognized by the strict Pandoc metadata decoder.",
  })
);

/**
 * Pandoc table-alignment constructor names.
 *
 * @example
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
  PandocInlineConstructorName,
  PandocBlockConstructorName,
  PandocMetaConstructorName,
  PandocTableAlignmentConstructorName,
  PandocTableColumnWidthConstructorName,
  PandocMathType,
  PandocListNumberStyle,
  PandocListNumberDelimiter,
  S.Literal("TableCaption"),
]).pipe(
  $I.annoteSchema("PandocKnownConstructorName", {
    description: "Complete constructor-name registry understood anywhere by the strict Pandoc decoder.",
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
 * Returns whether a name is a Pandoc table-alignment constructor.
 *
 * @category guards
 * @since 0.0.0
 */
export const isPandocTableAlignmentConstructorName = S.is(PandocTableAlignmentConstructorName);
