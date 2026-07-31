import * as Md from "@beep/md/Md.model";
import { decodePandocJson, decodePandocJsonString } from "@beep/pandoc-ast/Pandoc.codec";
import { documentToPandoc, PandocMappingError, pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping";
import * as Pandoc from "@beep/pandoc-ast/Pandoc.model";
import {
  JsonPath,
  JsonPathSegment,
  jsonPointerFromPath,
  PandocCompatibilityReport,
  PandocMappingIssue,
  profileFromIssues,
} from "@beep/pandoc-ast/Pandoc.report";
import { PosInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const JsonPathArbitrary = S.toArbitrary(JsonPath);
const JsonPathSegmentArbitrary = S.toArbitrary(JsonPathSegment);
const MdDocumentArbitrary = S.toArbitrary(Md.Document);
const PandocDocumentArbitrary = S.toArbitrary(Pandoc.PandocDocument);
const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
      Effect.scoped
    );
const provideBunFileSystem = provideScopedLayer(BunFileSystem.layer);

const fixture = Effect.fn("PandocMappingTest.fixture")((name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(new URL(`./fixtures/${name}`, import.meta.url).pathname);
  }).pipe(provideBunFileSystem)
);
const text = (value: string): Md.Text => Md.Text.make({ value });
const inlineListPandocJson = () => ({
  "pandoc-api-version": [1, 23, 1],
  blocks: [
    {
      c: [
        [
          {
            c: [
              { c: "alpha", t: "Str" },
              { t: "Space" },
              { c: [{ c: "beta", t: "Str" }], t: "Emph" },
              { t: "Space" },
              { c: [["", [], []], [{ c: "docs", t: "Str" }], ["https://example.com", ""]], t: "Link" },
            ],
            t: "Plain",
          },
        ],
      ],
      t: "BulletList",
    },
  ],
  meta: {},
});

const inlineListDocument = (): Md.Document =>
  Md.Document.make({
    children: [
      Md.Ul.make({
        children: [
          Md.Li.make({
            children: [
              text("alpha "),
              Md.Em.make({ children: [text("beta")] }),
              text(" "),
              Md.A.make({ children: [text("docs")], href: "https://example.com" }),
            ],
          }),
        ],
      }),
    ],
  });

const expectUl = (block: Md.Block | undefined): Md.Ul => {
  expect(block?._tag).toBe("ul");
  if (block?._tag !== "ul") {
    throw new Error("expected unordered list block");
  }
  return block;
};

const expectBulletList = (block: Pandoc.PandocBlock | undefined): Pandoc.BulletList => {
  expect(block?._tag).toBe("bulletlist");
  if (block?._tag !== "bulletlist") {
    throw new Error("expected Pandoc bullet list block");
  }
  return block;
};

const expectPlain = (block: Pandoc.PandocBlock | undefined): Pandoc.Plain => {
  expect(block?._tag).toBe("plain");
  if (block?._tag !== "plain") {
    throw new Error("expected Pandoc plain block");
  }
  return block;
};

const expectPara = (block: Pandoc.PandocBlock | undefined): Pandoc.Para => {
  expect(block?._tag).toBe("para");
  if (block?._tag !== "para") {
    throw new Error("expected Pandoc para block");
  }
  return block;
};

const expectStr = (inline: Pandoc.PandocInline.Type | undefined): Pandoc.Str => {
  expect(inline?._tag).toBe("str");
  if (inline?._tag !== "str") {
    throw new Error("expected Pandoc str inline");
  }
  return inline;
};

const expectLink = (inline: Pandoc.PandocInline.Type | undefined): Pandoc.Link => {
  expect(inline?._tag).toBe("link");
  if (inline?._tag !== "link") {
    throw new Error("expected Pandoc link inline");
  }
  return inline;
};

const expectParagraphText = (block: Md.Block | undefined, value: string): void => {
  expect(block?._tag).toBe("p");
  if (block?._tag !== "p") {
    throw new Error("expected paragraph block");
  }
  expect(block.children[0]?._tag).toBe("text");
  if (block.children[0]?._tag !== "text") {
    throw new Error("expected text inline");
  }
  expect(block.children[0].value).toBe(value);
};

const expectReportInvariants = (report: PandocCompatibilityReport.Type): void => {
  expect(report.profile).toBe(PandocCompatibilityReport.profileFromIssues(report.issues));
  expect(report.profile).toBe(profileFromIssues(report.issues));

  for (const issue of report.issues) {
    expect(issue.pointer).toBe(JsonPath.toPointer(issue.path));
    expect(issue.pointer).toBe(jsonPointerFromPath(issue.path));
  }
};

describe("Pandoc.mapping", () => {
  it("maps md-core Pandoc JSON to @beep/md with a supported report", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* fixture("green-core.pandoc.json");
        const pandoc = yield* decodePandocJsonString(source);
        const result = yield* pandocToDocument(pandoc);

        expect(result.report.profile).toBe("supported");
        expect(result.report.issues).toEqual([]);
        expect(A.map(result.document.children, (block) => block._tag)).toEqual([
          "heading",
          "p",
          "blockquote",
          "pre",
          "ul",
          "ol",
          "hr",
        ]);
      })
    ));

  it("records DOCX-origin compatibility gaps while producing partial Md output", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* fixture("gap-docx-styles.pandoc.json");
        const pandoc = yield* decodePandocJsonString(source);
        const result = yield* pandocToDocument(pandoc);
        const constructs = A.map(result.report.issues, (entry) => entry.construct);

        expect(result.report.profile).toBe("gap");
        expect(constructs).toEqual(expect.arrayContaining(["Div", "Span", "Note", "Table"]));
        expect(constructs).not.toContain("Math");
        expect(result.report.issues[0]?.pointer).toBe("/blocks/0/children/0/children/0");
        expect(A.map(result.document.children, (block) => block._tag)).toEqual(["blockquote", "p"]);
        const blockquote = result.document.children[0];
        if (blockquote?._tag === "blockquote" && blockquote.children[0]?._tag === "p") {
          expect(A.map(blockquote.children[0].children, (inline) => inline._tag)).toContain("inlineMath");
        }
      })
    ));

  it("maps @beep/md documents to Pandoc with explicit lossiness for raw content and task lists", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = Md.Document.make({
          children: [
            Md.Heading.make({ level: 2, children: [text("Round trip")] }),
            Md.P.make({
              children: [
                text("before "),
                Md.RawMarkdown.make({ value: "**trusted**" }),
                Md.Br.make({}),
                Md.A.make({ children: [text("docs")], href: "https://example.com" }),
              ],
            }),
            Md.TaskList.make({
              children: [Md.TaskItem.make({ checked: true, children: [text("done")] })],
            }),
          ],
        });

        const result = yield* documentToPandoc(document);

        expect(result.pandoc.blocks.map((block) => block._tag)).toEqual(["header", "para", "bulletlist"]);
        expect(result.report.profile).toBe("gap");
        expect(A.map(result.report.issues, (entry) => entry.construct)).toEqual(
          expect.arrayContaining(["rawMarkdown", "TaskList"])
        );
      })
    ));

  it("derives JSON pointer and default severity behavior from report schemas", () =>
    fc.assert(
      fc.property(JsonPathArbitrary, (path) => {
        const issue = PandocMappingIssue.fromPath({
          construct: "Generated",
          direction: "pandoc-to-md",
          message: "Generated issue.",
          path,
        });

        expect(issue.pointer).toBe(JsonPath.toPointer(path));
        expect(issue.pointer).toBe(jsonPointerFromPath(path));
        expect(issue.severity).toBe("unsupported");
        expect(S.encodeSync(PandocMappingIssue)(issue)).not.toHaveProperty("pointer");

        const report = PandocCompatibilityReport.fromIssues([issue]);
        expect(report.profile).toBe("gap");
        expect(S.encodeSync(PandocCompatibilityReport)(report)).not.toHaveProperty("profile");
      }),
      fcRuns(50)
    ));

  it("generates only non-negative numeric JSON path segments", () =>
    fc.assert(
      fc.property(JsonPathSegmentArbitrary, (segment) => {
        if (typeof segment === "number") {
          expect(Number.isInteger(segment)).toBe(true);
          expect(segment).toBeGreaterThanOrEqual(0);
        }
      }),
      fcRuns(50)
    ));

  it("preserves mapping report invariants for schema-derived documents", () =>
    fc.assert(
      fc.property(PandocDocumentArbitrary, MdDocumentArbitrary, (pandoc, document) => {
        expectReportInvariants(Effect.runSync(pandocToDocument(pandoc)).report);
        expectReportInvariants(Effect.runSync(documentToPandoc(document)).report);
      }),
      fcRuns(25)
    ));

  it("degrades @beep/md tables and YouTube embeds to Pandoc with recorded lossiness", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = Md.Document.make({
          children: [
            Md.Table.make({
              headerRow: true,
              children: [
                Md.TableRow.make({
                  children: [
                    Md.TableCell.make({ children: [text("Name")] }),
                    Md.TableCell.make({ children: [text("Value")] }),
                  ],
                }),
                Md.TableRow.make({
                  children: [
                    Md.TableCell.make({ children: [text("Rich")] }),
                    Md.TableCell.make({ children: [text("Ready")] }),
                  ],
                }),
              ],
            }),
            Md.YouTube.make({ videoId: "M7lc1UVf-VE" }),
          ],
        });

        const result = yield* documentToPandoc(document);

        expect(result.pandoc.blocks.map((block) => block._tag)).toEqual(["para", "para"]);
        expect(A.map(result.report.issues, (entry) => entry.construct)).toEqual(
          expect.arrayContaining(["Table", "YouTube"])
        );

        const tableText = expectStr(expectPara(result.pandoc.blocks[0]).children[0]);
        expect(tableText.text).toBe("Name | Value\nRich | Ready");

        const youtubeLink = expectLink(expectPara(result.pandoc.blocks[1]).children[0]);
        expect(youtubeLink.target.url).toBe("https://www.youtube.com/watch?v=M7lc1UVf-VE");
      })
    ));

  it("preserves @beep/md titles, ordered starts, and math in Pandoc projection", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const document = Md.Document.make({
          children: [
            Md.P.make({
              children: [
                Md.A.make({
                  children: [text("docs")],
                  href: "https://example.com",
                  title: O.some("Docs title"),
                }),
                Md.Img.make({
                  alt: "Diagram",
                  src: "diagram.png",
                  title: O.some("Diagram title"),
                }),
                Md.InlineMath.make({ value: "x + y" }),
              ],
            }),
            Md.Ol.make({
              children: [Md.Li.make({ children: [text("third")] })],
              start: PosInt.make(3),
            }),
            Md.MathBlock.make({ value: "a^2 + b^2 = c^2" }),
          ],
        });

        const result = yield* documentToPandoc(document);

        expect(result.report.issues).toEqual([]);
        expect(result.pandoc.blocks.map((block) => block._tag)).toEqual(["para", "orderedlist", "para"]);

        const paragraph = expectPara(result.pandoc.blocks[0]);
        const link = expectLink(paragraph.children[0]);
        expect(link.target.title).toBe("Docs title");

        const image = paragraph.children[1];
        expect(image?._tag).toBe("image");
        if (image?._tag === "image") {
          expect(image.target.title).toBe("Diagram title");
        }

        const inlineMath = paragraph.children[2];
        expect(inlineMath?._tag).toBe("math");
        if (inlineMath?._tag === "math") {
          expect(inlineMath.mathType).toBe("InlineMath");
        }

        const list = result.pandoc.blocks[1];
        expect(list?._tag).toBe("orderedlist");
        if (list?._tag === "orderedlist") {
          expect(list.start).toBe(3);
        }

        const displayMath = expectPara(result.pandoc.blocks[2]).children[0];
        expect(displayMath?._tag).toBe("math");
        if (displayMath?._tag === "math") {
          expect(displayMath.mathType).toBe("DisplayMath");
        }
      })
    ));

  it("emits a safe YouTube watch URL and placeholders empty tables", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // `videoId` is constrained to the bare 11-character YouTube id at the
        // `@beep/md` model boundary (CSF-026), so a mapped id can never contain
        // reserved characters and the emitted watch URL is always well-formed.
        const document = Md.Document.make({
          children: [Md.Table.make({ headerRow: false, children: [] }), Md.YouTube.make({ videoId: "ab-CD_12xyz" })],
        });

        const result = yield* documentToPandoc(document);

        expect(A.map(result.report.issues, (entry) => entry.construct)).toEqual(
          expect.arrayContaining(["Table", "YouTube"])
        );
        expect(expectStr(expectPara(result.pandoc.blocks[0]).children[0]).text).toBe("[table]");
        expect(expectLink(expectPara(result.pandoc.blocks[1]).children[0]).target.url).toBe(
          "https://www.youtube.com/watch?v=ab-CD_12xyz"
        );
      })
    ));

  it("rejects malformed YouTube video ids at the model boundary so the mapping cannot crash", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // CSF-026 guard: a hostile lone-surrogate id (which would make
        // `encodeURIComponent` throw a `URIError`) and reserved characters are
        // refused at the `@beep/md` schema boundary through the typed
        // `SchemaError` channel, so they can never reach `documentToPandoc`.
        const decodeYouTube = S.decodeUnknownEffect(Md.YouTube);

        for (const hostileVideoId of ["\ud800", "a b&c", "../../etc/passwd", "tooShort"]) {
          const exit = yield* Effect.exit(decodeYouTube({ _tag: "youtube", videoId: hostileVideoId }));
          expect(Exit.isFailure(exit)).toBe(true);
        }

        // The bare 11-character form still decodes successfully.
        const safe = yield* decodeYouTube({ _tag: "youtube", videoId: "M7lc1UVf-VE" });
        expect(safe.videoId).toBe("M7lc1UVf-VE");
      })
    ));

  it("returns typed mapping failures for forged runtime inputs", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const invalidPandoc = {
          _tag: "pandocDocument",
          apiVersion: [1, 23, 1],
          blocks: [{ _tag: "para", children: [{ _tag: "str", text: 42 }] }],
          meta: {},
        } as unknown as Pandoc.PandocDocument;
        const invalidMd = {
          _tag: "document",
          children: [{ _tag: "p", children: [{ _tag: "text", value: 42 }] }],
        } as unknown as Md.Document;

        const pandocError = yield* Effect.flip(pandocToDocument(invalidPandoc));
        const mdError = yield* Effect.flip(documentToPandoc(invalidMd));

        expect(pandocError).toBeInstanceOf(PandocMappingError);
        expect(pandocError._tag).toBe("PandocMappingError");
        expect(mdError).toBeInstanceOf(PandocMappingError);
        expect(mdError._tag).toBe("PandocMappingError");
      })
    ));

  it("preserves inline structure inside list items in both mapping directions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson(inlineListPandocJson());
        const mappedMd = yield* pandocToDocument(pandoc);
        const list = expectUl(mappedMd.document.children[0]);

        expect(mappedMd.report.issues).toEqual([]);
        expect(A.map(list.children[0]?.children ?? [], (inline) => inline._tag)).toEqual([
          "text",
          "text",
          "em",
          "text",
          "a",
        ]);

        const document = inlineListDocument();
        const mappedPandoc = yield* documentToPandoc(document);
        const block = expectBulletList(mappedPandoc.pandoc.blocks[0]);

        expect(mappedPandoc.report.issues).toEqual([]);
        const firstItemBlock = expectPlain(block.items[0]?.[0]);

        expect(A.map(firstItemBlock.children, (inline) => inline._tag)).toEqual(["str", "emph", "str", "link"]);
      })
    ));

  it("preserves Pandoc list item block structure", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                [
                  { c: [{ c: "first", t: "Str" }], t: "Plain" },
                  { c: [{ c: "second", t: "Str" }], t: "Para" },
                ],
              ],
              t: "BulletList",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);
        const list = expectUl(result.document.children[0]);
        const item = list.children[0];

        expect(result.report.profile).toBe("supported");
        expect(result.report.issues).toEqual([]);
        expect(A.map(item?.children ?? [], (child) => child._tag)).toEqual(["p", "p"]);
      })
    ));

  it("records unstyled Pandoc div wrappers instead of silently blockquoting them", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [["", [], []], [{ c: [{ c: "wrapped", t: "Str" }], t: "Para" }]],
              t: "Div",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);

        expect(result.report.profile).toBe("gap");
        expect(A.map(result.report.issues, (entry) => entry.construct)).toContain("Div");
        expect(A.map(result.document.children, (block) => block._tag)).toEqual(["blockquote"]);
      })
    ));

  it("reports out-of-range Pandoc header levels as lossy heading clamping", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [7, ["", [], []], [{ c: "deep", t: "Str" }]],
              t: "Header",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);

        expect(result.report.profile).toBe("gap");
        expect(A.map(result.report.issues, (entry) => entry.construct)).toContain("Header");
        const heading = result.document.children[0];
        expect(heading?._tag).toBe("heading");
        if (heading?._tag !== "heading") {
          throw new Error("expected heading block");
        }
        expect(heading.level).toBe(6);
      })
    ));

  it("preserves supported nested image-alt math before flattening alt text", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                {
                  c: [["", [], []], [{ c: [{ t: "InlineMath" }, "x"], t: "Math" }], ["diagram.png", ""]],
                  t: "Image",
                },
              ],
              t: "Para",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);
        const paragraph = result.document.children[0];

        expect(result.report.profile).toBe("supported");
        expect(result.report.issues).toEqual([]);
        expect(paragraph?._tag).toBe("p");
        if (paragraph?._tag !== "p") {
          return;
        }
        expect(paragraph.children[0]?._tag).toBe("img");
        if (paragraph.children[0]?._tag === "img") {
          expect(paragraph.children[0].alt).toBe("x");
        }
      })
    ));

  it("reports Pandoc block metadata dropped by Md-core mappings", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [2, ["heading-id", ["unnumbered"], []], [{ c: "heading", t: "Str" }]],
              t: "Header",
            },
            {
              c: [["code-id", ["ts", "extra"], [["custom-style", "Code"]]], "const value = 1"],
              t: "CodeBlock",
            },
            {
              c: [[3, { t: "LowerRoman" }, { t: "OneParen" }], [[{ c: [{ c: "item", t: "Str" }], t: "Plain" }]]],
              t: "OrderedList",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);

        expect(result.report.profile).toBe("gap");
        expect(A.map(result.report.issues, (entry) => entry.construct)).toEqual(
          expect.arrayContaining(["Header", "CodeBlock", "OrderedList"])
        );
      })
    ));

  it("reports document metadata and invalid sole code languages at their exact pointers", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [["", ["ts bad"], []], "const value = 1"],
              t: "CodeBlock",
            },
          ],
          meta: {
            title: { c: "Document", t: "MetaString" },
          },
        });
        const result = yield* pandocToDocument(pandoc);
        const code = result.document.children[0];

        expect(result.report.issues.map((entry) => [entry.construct, entry.pointer])).toEqual([
          ["CodeBlock", "/blocks/0"],
          ["Meta", "/meta"],
        ]);
        expect(code?._tag).toBe("pre");
        if (code?._tag === "pre") {
          expect(code.language).toEqual(O.none());
        }
      })
    ));

  it("reports nested inline compatibility issues at child-specific pointers", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                {
                  c: [{ c: [["code-id", [], []], "marked"], t: "Code" }],
                  t: "Emph",
                },
              ],
              t: "Para",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);

        expect(result.report.profile).toBe("gap");
        expect(result.report.issues[0]?.construct).toBe("Code");
        expect(result.report.issues[0]?.pointer).toBe("/blocks/0/children/0/children/0");
      })
    ));

  it("rejects malformed inline constructor shapes before mapping", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: ["not-inline-constructor"],
              t: "Para",
            },
          ],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("rejects malformed supported inline payloads before mapping", () =>
    expect(
      Effect.runPromise(
        decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [{ c: ["not-a-string"], t: "Str" }],
              t: "Para",
            },
          ],
          meta: {},
        })
      )
    ).rejects.toThrow());

  it("maps Pandoc soft breaks as spaces while preserving hard line breaks", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                { c: "soft", t: "Str" },
                { t: "SoftBreak" },
                { c: "wrap", t: "Str" },
                { t: "LineBreak" },
                { c: "hard", t: "Str" },
              ],
              t: "Para",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);
        const paragraph = result.document.children[0];

        expect(result.report.profile).toBe("gap");
        expect(A.map(result.report.issues, (entry) => entry.construct)).toContain("SoftBreak");
        expect(paragraph?._tag).toBe("p");
        if (paragraph?._tag !== "p") {
          return;
        }
        expect(A.map(paragraph.children, (inline) => inline._tag)).toEqual(["text", "text", "text", "br", "text"]);
        expect(paragraph.children[1]?._tag === "text" ? paragraph.children[1].value : "").toBe(" ");
      })
    ));

  it("normalizes soft breaks to spaces in fallback Pandoc text extraction", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pandoc = yield* decodePandocJson({
          "pandoc-api-version": [1, 23, 1],
          blocks: [
            {
              c: [
                {
                  c: [{ c: [{ c: "foot", t: "Str" }, { t: "SoftBreak" }, { c: "note", t: "Str" }], t: "Plain" }],
                  t: "Note",
                },
              ],
              t: "Para",
            },
            {
              c: [
                ["", [], []],
                [{ c: [{ c: "wide", t: "Str" }, { t: "SoftBreak" }, { c: "caption", t: "Str" }], t: "Plain" }],
                [],
                [],
                [],
                [],
              ],
              t: "Table",
            },
          ],
          meta: {},
        });
        const result = yield* pandocToDocument(pandoc);

        expectParagraphText(result.document.children[0], "foot note");
        expectParagraphText(result.document.children[1], "wide caption");
      })
    ));
});
