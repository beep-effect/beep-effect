import { BrowserSafeUrlPolicySpec, Md, makeHtmlFragmentAdapter, makeMarkdownAdapter, renderSafeHtml } from "@beep/md";
import { Effect, Result } from "effect";
import { describe, expect, it } from "tstyche";
import type { SafeHtml } from "@beep/html";
import type {
  Admonition,
  Block,
  BlockContent,
  BlockContentBuilder,
  BlockInput,
  BlockQuote,
  BlockTemplateValue,
  Del,
  Document,
  DocumentToHtmlFragment,
  DocumentToMarkdown,
  DocumentToPlainText,
  EffectRenderAdapter,
  Em,
  Embed,
  FootnoteDefinition,
  FootnoteReference,
  Heading,
  Inline,
  InlineContent,
  InlineContentBuilder,
  InlineInput,
  InlineMath,
  Li,
  ListItemChildInput,
  ListItemContent,
  ListItemContentBuilder,
  ListItemInput,
  MathBlock,
  Ol,
  P,
  PureRenderAdapter,
  RenderError,
  Strong,
  Table,
  TaskItem,
  TaskList,
  TaskListItemSpec,
  Ul,
  UrlRenderOptions,
  YouTube,
} from "@beep/md";
import type { HtmlFragment, Markdown } from "@beep/schema";
import type * as S from "effect/Schema";

describe("@beep/md", () => {
  it("keeps document, block, and inline constructors typed", () => {
    const document = Md.make([Md.h1("Hello"), Md.p`World ${Md.code("x")}`]);

    expect(document).type.toBe<Document>();
    expect(Md.h1("Hello")).type.toBe<Heading>();
    expect(Md.h1`Heading 1`).type.toBe<Heading>();
    expect(Md.h2`Heading ${Md.code("2")}`).type.toBe<Heading>();
    expect(Md.h3`Heading ${Md.em("3")}`).type.toBe<Heading>();
    expect(Md.h4`Heading ${Md.strong("4")}`).type.toBe<Heading>();
    expect(Md.h5`Heading ${Md.del("5")}`).type.toBe<Heading>();
    expect(Md.h6`Heading ${Md.code("6")}`).type.toBe<Heading>();
    expect(Md.p("Hello")).type.toBe<P>();
    expect(Md.p`Hello ${"world"}`).type.toBe<P>();
    expect(Md.p([Md.strong("Hello"), " world"])).type.toBe<P>();
    expect(Md.p`Hello ${[Md.strong("world"), "!"]}`).type.toBe<P>();
    expect(Md.strong`Hello ${Md.code("world")}`).type.toBe<Strong>();
    expect(Md.em`Hello ${Md.strong("world")}`).type.toBe<Em>();
    expect(Md.del`Hello ${Md.em("world")}`).type.toBe<Del>();
    expect(Md.li`Item ${Md.code("one")}`).type.toBe<Li>();
    expect(Md.li([Md.p("Parent"), Md.ul(["Child"])])).type.toBe<Li>();
    expect(Md.blockquote([Md.h2("Nested"), "plain"])).type.toBe<BlockQuote>();
    expect(Md.blockquote`Quoted ${Md.strong("text")}`).type.toBe<BlockQuote>();
    expect(Md.blockquote`${Md.h2("Nested")}`).type.toBe<BlockQuote>();
    expect(Md.blockquote`${["a", "b"]}`).type.toBe<BlockQuote>();
    expect(Md.ul(["One", Md.li("Two"), [Md.strong("Three")]])).type.toBe<Ul>();
    expect(Md.taskItem("Done", { checked: true })).type.toBe<TaskItem>();
    expect(Md.taskListFromItems([Md.taskItem("Done", { checked: true })])).type.toBe<TaskList>();
    expect(Md.taskList(["Todo", { text: "Done", checked: true }, Md.taskItem("Maybe")])).type.toBe<TaskList>();
    expect(Md.taskList([{ children: [Md.p("Parent"), Md.ul(["Child"])], checked: true }])).type.toBe<TaskList>();
    expect(Md.inlineMath("a^2")).type.toBe<InlineMath>();
    expect(Md.footnoteRef("note-1")).type.toBe<FootnoteReference>();
    expect(Md.ol(["Three"], { start: 3 })).type.toBe<Ol>();
    expect(Md.table([["A"]], { headerRow: true, align: ["left"] })).type.toBe<Table>();
    expect(Md.mathBlock("a=b")).type.toBe<MathBlock>();
    expect(Md.footnoteDef("note-1", "Body")).type.toBe<FootnoteDefinition>();
    expect(Md.admonition("warning", "Body", { title: "Careful" })).type.toBe<Admonition>();
    expect(Md.embed("video", "https://example.com", { title: "Demo" })).type.toBe<Embed>();
    expect(Md.make([Md.p("Body")], { frontmatter: { title: "Doc" } })).type.toBe<Document>();
    expect(Md.youtube("dQw4w9WgXcQ")).type.toBe<Result.Result<YouTube, S.SchemaError>>();
    expect(Md.youtubeEffect("dQw4w9WgXcQ")).type.toBe<Effect.Effect<YouTube, S.SchemaError>>();
    expect(Md.youtubeUnsafe("dQw4w9WgXcQ")).type.toBe<YouTube>();
    expect(Md.text("x")).type.toBeAssignableTo<Inline>();
    expect(Md.hr).type.toBeAssignableTo<Block>();
  });

  it("exposes constructor input helper types", () => {
    expect<string>().type.toBeAssignableTo<InlineInput>();
    expect<[InlineInput, InlineInput]>().type.toBeAssignableTo<InlineContent>();
    expect<Strong>().type.toBeAssignableTo<InlineContent>();
    expect<Block>().type.toBeAssignableTo<BlockInput>();
    expect<[BlockInput, BlockInput]>().type.toBeAssignableTo<BlockContent>();
    expect<Heading>().type.toBeAssignableTo<BlockTemplateValue>();
    expect<["a", "b"]>().type.toBeAssignableTo<BlockTemplateValue>();
    expect<Li>().type.toBeAssignableTo<ListItemInput>();
    expect<Block>().type.toBeAssignableTo<ListItemChildInput>();
    expect<[ListItemChildInput, ListItemChildInput]>().type.toBeAssignableTo<ListItemContent>();
    expect<TaskItem>().type.toBeAssignableTo<TaskListItemSpec>();

    const strongBuilder: InlineContentBuilder<Strong> = Md.strong;
    const blockquoteBuilder: BlockContentBuilder<BlockQuote> = Md.blockquote;
    const listItemBuilder: ListItemContentBuilder<Li> = Md.li;

    expect(strongBuilder).type.toBe<InlineContentBuilder<Strong>>();
    expect(blockquoteBuilder).type.toBe<BlockContentBuilder<BlockQuote>>();
    expect(listItemBuilder).type.toBe<ListItemContentBuilder<Li>>();
  });

  it("keeps render outputs branded by target", () => {
    const document = Md.make([Md.h1("Hello")]);
    type RenderPacket = {
      readonly body: Markdown;
      readonly format: "packet";
    };
    const packetAdapter: PureRenderAdapter<RenderPacket> = {
      name: "packet",
      render: (input) => ({
        body: Md.renderUnsafe(input),
        format: "packet",
      }),
    };

    expect(Md.render(document)).type.toBe<Result.Result<Markdown, RenderError>>();
    expect(Md.renderUnsafe(document)).type.toBe<Markdown>();
    expect(Md.renderHtml(document)).type.toBe<Result.Result<HtmlFragment, RenderError>>();
    expect(Md.renderHtmlUnsafe(document)).type.toBe<HtmlFragment>();
    expect(Md.renderPlainText(document)).type.toBe<Result.Result<string, RenderError>>();
    expect(Md.renderPlainTextUnsafe(document)).type.toBe<string>();
    expect(Md.renderWith(Md.MarkdownAdapter, document)).type.toBe<Result.Result<Markdown, RenderError>>();
    expect(Md.renderWithUnsafe(Md.MarkdownAdapter, document)).type.toBe<Markdown>();
    expect(Md.renderWith(packetAdapter, document)).type.toBe<Result.Result<RenderPacket, RenderError>>();
    expect(Md.renderWithUnsafe(packetAdapter, document)).type.toBe<RenderPacket>();
    expect(Md.MarkdownAdapter).type.toBe<PureRenderAdapter<Markdown>>();
    expect(Md.HtmlFragmentAdapter).type.toBe<PureRenderAdapter<HtmlFragment>>();
    expect(Md.PlainTextAdapter).type.toBe<PureRenderAdapter<string>>();
    const renderOptions: UrlRenderOptions = { urlPolicy: BrowserSafeUrlPolicySpec };
    expect(renderOptions).type.toBe<UrlRenderOptions>();
    expect(makeMarkdownAdapter({ urlPolicy: BrowserSafeUrlPolicySpec })).type.toBe<PureRenderAdapter<Markdown>>();
    expect(makeHtmlFragmentAdapter({ urlPolicy: BrowserSafeUrlPolicySpec })).type.toBe<
      PureRenderAdapter<HtmlFragment>
    >();
    expect(Md.makeMarkdownAdapter({ urlPolicy: BrowserSafeUrlPolicySpec })).type.toBe<PureRenderAdapter<Markdown>>();
    const safeDocument = Result.getOrThrow(Md.refineSafeDocument(document));
    expect(renderSafeHtml(safeDocument)).type.toBe<SafeHtml>();
    expect(Md.renderSafeHtml(safeDocument)).type.toBe<SafeHtml>();

    const bytesAdapter: EffectRenderAdapter<Uint8Array, "pdf-error", "fonts"> = {
      name: "bytes",
      render: () => Effect.succeed(new Uint8Array()),
    };
    expect(Md.renderEffectWith(bytesAdapter, document)).type.toBe<
      Effect.Effect<Uint8Array, "pdf-error" | RenderError, "fonts">
    >();
    expect(Md.renderEffectWithUnsafe(bytesAdapter, document)).type.toBe<
      Effect.Effect<Uint8Array, "pdf-error", "fonts">
    >();
  });

  it("exposes schema transformation types and future effectful adapter shape", () => {
    expect<DocumentToMarkdown>().type.toBe<Markdown>();
    expect<DocumentToHtmlFragment>().type.toBe<HtmlFragment>();
    expect<DocumentToPlainText>().type.toBe<string>();

    type BytesAdapter = EffectRenderAdapter<Uint8Array, Error, never>;
    expect<BytesAdapter["name"]>().type.toBe<string>();
  });

  it("rejects invalid builder shapes", () => {
    // @ts-expect-error!
    Md.make(Md.p("Hello"));

    // @ts-expect-error!
    Md.taskItem("Done", { checked: "yes" });

    // @ts-expect-error!
    Md.ul([1]);

    // @ts-expect-error!
    Md.p`Count ${1}`;

    // @ts-expect-error!
    Md.p`Count ${[Md.strong("ok"), 1]}`;

    // @ts-expect-error!
    Md.blockquote`${[Md.h2("Nested"), "plain"]}`;
  });
});
