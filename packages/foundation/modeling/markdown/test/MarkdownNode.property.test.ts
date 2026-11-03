import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Mdx from "@beep/markdown/MarkdownMdx";
import * as Subject from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("MarkdownNode schema property floor", () => {
  roundTrips("Point", Subject.Point);
  roundTrips("Position", Subject.Position);
  roundTrips("ReferenceType", Subject.ReferenceType);
  roundTrips("HeadingStyle", Subject.HeadingStyle);
  roundTrips("BreakStyle", Subject.BreakStyle);
  roundTrips("FenceChar", Subject.FenceChar);
  roundTrips("BulletChar", Subject.BulletChar);
  roundTrips("ListDelimiter", Subject.ListDelimiter);
  roundTrips("ThematicBreakChar", Subject.ThematicBreakChar);
  roundTrips("EmphasisChar", Subject.EmphasisChar);
  roundTrips("HeadingDepth", Subject.HeadingDepth);
  roundTrips("TableAlign", Subject.TableAlign);
  roundTrips("Text", Subject.Text);
  roundTrips("InlineCode", Subject.InlineCode);
  roundTrips("Html", Subject.Html);
  roundTrips("Break", Subject.Break);
  roundTrips("Image", Subject.Image);
  roundTrips("ImageReference", Subject.ImageReference);
  roundTrips("Emphasis", Subject.Emphasis);
  roundTrips("Strong", Subject.Strong);
  roundTrips("Delete", Subject.Delete);
  roundTrips("Link", Subject.Link);
  roundTrips("LinkReference", Subject.LinkReference);
  roundTrips("FootnoteReference", Subject.FootnoteReference);
  roundTrips("PhrasingContent", Subject.PhrasingContent);
  roundTrips("ThematicBreak", Subject.ThematicBreak);
  roundTrips("Code", Subject.Code);
  roundTrips("Definition", Subject.Definition);
  roundTrips("FootnoteDefinition", Subject.FootnoteDefinition);
  roundTrips("Paragraph", Subject.Paragraph);
  roundTrips("Heading", Subject.Heading);
  roundTrips("ListItem", Subject.ListItem);
  roundTrips("List", Subject.List);
  roundTrips("Blockquote", Subject.Blockquote);
  roundTrips("TableCell", Subject.TableCell);
  roundTrips("RowContent", Subject.RowContent);
  roundTrips("TableRow", Subject.TableRow);
  roundTrips("TableContent", Subject.TableContent);
  roundTrips("Table", Subject.Table);
  roundTrips("FlowContent", Subject.FlowContent);
  roundTrips("ListContent", Subject.ListContent);
  roundTrips("MdxJsxAttributeValueExpression", Mdx.MdxJsxAttributeValueExpression);
  // The former `toCodecArbitrary` override is gone: the effect Arbitrary
  // compiler honors it only on declarations, and the node is an `S.Opaque`
  // struct now (D-22), so the native struct arbitrary drives it.
  roundTrips("MdxJsxAttribute", Mdx.MdxJsxAttribute);
  roundTrips("MdxJsxExpressionAttribute", Mdx.MdxJsxExpressionAttribute);
  roundTrips("MdxJsxAttributeContent", Mdx.MdxJsxAttributeContent);
  roundTrips("MdxJsxFlowElement", Mdx.MdxJsxFlowElement);
  roundTrips("MdxJsxTextElement", Mdx.MdxJsxTextElement);
  roundTrips("MdxFlowExpression", Mdx.MdxFlowExpression);
  roundTrips("MdxTextExpression", Mdx.MdxTextExpression);
  roundTrips("MdxjsEsm", Mdx.MdxjsEsm);
  roundTrips("FrontmatterFormat", Subject.FrontmatterFormat);
  roundTrips("Frontmatter", Subject.Frontmatter);
  roundTrips("FrontmatterContent", Subject.FrontmatterContent);
  roundTrips("Root", Subject.Root);
  roundTrips("MarkdownNode", Subject.MarkdownNode);
});
