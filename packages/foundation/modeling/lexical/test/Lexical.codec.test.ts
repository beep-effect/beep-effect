import {
  ARTIFACT_URI_PREFIX,
  ArtifactUri,
  blockToLexical,
  documentToEditorState,
  editorStateToDocument,
  LexicalNode,
  ListNode,
  nodeToBlocks,
  ParagraphNode,
  RootNode,
  SerializedEditorState,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import { refineSafeDocument } from "@beep/md/Md.safe";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { TableCellHeaderState } from "@beep/lexical-schema";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const decodeLexicalNodeResult = S.decodeResult(LexicalNode);
const decodeSerializedEditorStateResult = S.decodeResult(SerializedEditorState);
const decodeArtifactUriResult = S.decodeResult(ArtifactUri);
const decodeMdModelDocumentResult = S.decodeResult(MdModel.Document);
const decodeMdModelPreResult = S.decodeResult(MdModel.Pre);
const encodeArtifactUriResult = S.encodeResult(ArtifactUri);
const encodeMdModelDocumentResult = S.encodeResult(MdModel.Document);

const decoded = <A, E>(result: Result.Result<A, E>): A =>
  Result.match(result, {
    onSuccess: (value) => value,
    onFailure: (error) => expect.fail(String(error)),
  });

const StateArbitrary = Arbitrary.schema(SerializedEditorState);
const ArtifactUriArbitrary = Arbitrary.schema(ArtifactUri);
const DocumentArbitrary = Arbitrary.schema(MdModel.Document);

const mdText = (value: string) => MdModel.Text.make({ value });

const roundTrip = (document: MdModel.Document) =>
  documentToEditorState(document).pipe(Effect.map(editorStateToDocument));

const tableState = (headerState: TableCellHeaderState): SerializedEditorState =>
  SerializedEditorState.make({
    root: RootNode.make({
      children: [
        TableNode.make({
          children: [
            TableRowNode.make({
              children: [TableCellNode.make({ children: [ParagraphNode.make({ children: [] })], headerState })],
            }),
          ],
        }),
      ],
    }),
  });

describe("Lexical.codec", { concurrent: false }, () => {
  it.effect(
    "canonicalizes an empty Md document to one runtime-editable paragraph",
    Effect.fnUntraced(function* () {
      const empty = MdModel.Document.make({ children: [] });
      const state = yield* documentToEditorState(empty);

      expect(state.root.children).toEqual([expect.objectContaining({ type: "paragraph", children: [] })]);

      const projected = editorStateToDocument(state);
      expect(projected).toEqual(MdModel.Document.make({ children: [MdModel.P.make({ children: [] })] }));
      expect(yield* roundTrip(projected)).toEqual(projected);
    })
  );

  it.effect(
    "round-trips an md-core assistant turn (Md → Lexical → Md identity)",
    Effect.fnUntraced(function* () {
      const document = MdModel.Document.make({
        children: [
          MdModel.Heading.make({ level: 1, children: [mdText("Title")] }),
          MdModel.P.make({
            children: [
              mdText("Read "),
              MdModel.A.make({
                href: "https://example.com",
                children: [mdText("the docs")],
                title: O.some("Documentation"),
              }),
              MdModel.Br.make({}),
              MdModel.Strong.make({ children: [MdModel.Em.make({ children: [mdText("carefully")] })] }),
              MdModel.Del.make({ children: [mdText("or not")] }),
              MdModel.Code.make({ value: "beep()" }),
            ],
          }),
          MdModel.BlockQuote.make({ children: [MdModel.P.make({ children: [mdText("Measure twice.")] })] }),
          MdModel.Pre.make({ value: "flowchart TD\nA[Start] --> B[Done]", language: O.some("mermaid") }),
          MdModel.Pre.make({ value: 'console.log("beep")\nexport {}', language: O.some("typescript") }),
          MdModel.Table.make({
            headerRow: true,
            children: [
              MdModel.TableRow.make({
                children: [
                  MdModel.TableCell.make({ children: [mdText("Name")] }),
                  MdModel.TableCell.make({ children: [mdText("Value")] }),
                ],
              }),
              MdModel.TableRow.make({
                children: [
                  MdModel.TableCell.make({ children: [mdText("Language")] }),
                  MdModel.TableCell.make({ children: [MdModel.Code.make({ value: "ts" })] }),
                ],
              }),
            ],
          }),
          MdModel.YouTube.make({ videoId: "M7lc1UVf-VE" }),
          MdModel.Ul.make({ children: [MdModel.Li.make({ children: [mdText("alpha")] })] }),
          MdModel.Ol.make({ children: [MdModel.Li.make({ children: [mdText("first")] })] }),
          MdModel.TaskList.make({
            children: [
              MdModel.TaskItem.make({ checked: true, children: [mdText("done")] }),
              MdModel.TaskItem.make({ checked: false, children: [mdText("todo")] }),
            ],
          }),
        ],
      });

      expect(yield* roundTrip(document)).toEqual(document);
    })
  );

  it.effect(
    "constructs every Markdown list projection through the canonical ListNode payload cases",
    Effect.fnUntraced(function* () {
      const projections = [
        {
          block: MdModel.Ul.make({ children: [MdModel.Li.make({ children: [mdText("bullet")] })] }),
          expected: { listType: "bullet", start: 1, tag: "ul" },
        },
        {
          block: MdModel.Ol.make({
            children: [MdModel.Li.make({ children: [mdText("third")] })],
            start: PosInt.make(3),
          }),
          expected: { listType: "number", start: 3, tag: "ol" },
        },
        {
          block: MdModel.TaskList.make({
            children: [MdModel.TaskItem.make({ checked: true, children: [mdText("done")] })],
          }),
          expected: { listType: "check", start: 1, tag: "ul" },
        },
      ] as const;

      for (const { block, expected } of projections) {
        const node = yield* blockToLexical(block);

        expect(ListNode.is(node)).toBe(true);
        expect(node).toMatchObject({ type: "list", ...expected });
      }
    })
  );

  it.effect(
    "preserves the complete user-content link domain through the editor codec",
    Effect.fnUntraced(function* () {
      const hrefs = ["#section", "/docs", "https://example.com", "mailto:user@example.com", "tel:+15551234567"];

      for (const href of hrefs) {
        const document = MdModel.Document.make({
          children: [MdModel.P.make({ children: [MdModel.A.make({ href, children: [mdText(href)] })] })],
        });

        expect(yield* roundTrip(document)).toEqual(document);
      }
    })
  );

  it.effect(
    "materializes deterministic text for an empty Markdown link",
    Effect.fnUntraced(function* () {
      const href = "https://example.com/empty";
      const document = MdModel.Document.make({
        children: [MdModel.P.make({ children: [MdModel.A.make({ href, children: [] })] })],
      });

      expect(yield* roundTrip(document)).toEqual(
        MdModel.Document.make({
          children: [MdModel.P.make({ children: [MdModel.A.make({ href, children: [mdText(href)] })] })],
        })
      );
    })
  );

  it.effect(
    "materializes one runtime list item for empty Markdown lists",
    Effect.fnUntraced(function* () {
      const emptyLists = [
        MdModel.Ul.make({ children: [] }),
        MdModel.Ol.make({ children: [] }),
        MdModel.TaskList.make({ children: [] }),
      ];

      for (const block of emptyLists) {
        const node = yield* blockToLexical(block);

        expect(node).toMatchObject({ type: "list", children: [expect.objectContaining({ type: "listitem" })] });
      }
    })
  );

  it.effect(
    "converges control-separated protocol-relative links to a harmless fragment",
    Effect.fnUntraced(function* () {
      const hostile = MdModel.Document.make({
        children: [
          MdModel.P.make({
            children: [MdModel.A.make({ href: "/\n/evil.example/path", children: [mdText("External")] })],
          }),
        ],
      });
      const converged = MdModel.Document.make({
        children: [
          MdModel.P.make({
            children: [MdModel.A.make({ href: "#", children: [mdText("External")] })],
          }),
        ],
      });

      expect(yield* roundTrip(hostile)).toEqual(converged);
      expect(yield* roundTrip(converged)).toEqual(converged);
    })
  );

  it.effect(
    "keeps safe nested-link content inside the strict Lexical grammar",
    Effect.fnUntraced(function* () {
      const document = MdModel.Document.make({
        children: [
          MdModel.P.make({
            children: [
              MdModel.A.make({
                href: "https://outer.example",
                children: [
                  MdModel.Strong.make({
                    children: [
                      MdModel.A.make({
                        href: "https://inner.example",
                        children: [MdModel.Em.make({ children: [mdText("inner ")] })],
                      }),
                    ],
                  }),
                  MdModel.Img.make({ src: "https://example.com/diagram.png", alt: "diagram" }),
                ],
              }),
            ],
          }),
        ],
      });
      const converged = MdModel.Document.make({
        children: [
          MdModel.P.make({
            children: [
              MdModel.A.make({
                href: "https://outer.example",
                children: [
                  MdModel.Strong.make({ children: [MdModel.Em.make({ children: [mdText("inner ")] })] }),
                  mdText("diagram"),
                ],
              }),
            ],
          }),
        ],
      });

      pipe(refineSafeDocument(document), Result.isSuccess, assertTrue);
      expect(yield* roundTrip(document)).toEqual(converged);
      expect(yield* roundTrip(converged)).toEqual(converged);
    })
  );

  it.effect(
    "converges Markdown table alignment to the structural Lexical table profile",
    Effect.fnUntraced(function* () {
      const row = MdModel.TableRow.make({
        children: [
          MdModel.TableCell.make({ children: [mdText("Left")] }),
          MdModel.TableCell.make({ children: [mdText("Right")] }),
        ],
      });
      const aligned = MdModel.Document.make({
        children: [MdModel.Table.make({ align: ["center", "right"], children: [row], headerRow: true })],
      });
      const structural = MdModel.Document.make({
        children: [MdModel.Table.make({ children: [row], headerRow: true })],
      });

      expect(yield* roundTrip(aligned)).toEqual(structural);
      expect(yield* roundTrip(structural)).toEqual(structural);
    })
  );

  it.effect(
    "normalizes an unrepresentable empty Markdown header row",
    Effect.fnUntraced(function* () {
      const emptyHeaderTable = MdModel.Document.make({
        children: [MdModel.Table.make({ headerRow: true, children: [] })],
      });
      const emptyHeaderRow = MdModel.Document.make({
        children: [
          MdModel.Table.make({
            headerRow: true,
            children: [MdModel.TableRow.make({ children: [] })],
          }),
        ],
      });

      for (const document of [emptyHeaderTable, emptyHeaderRow]) {
        const converged = yield* roundTrip(document);
        expect(converged.children[0]).toMatchObject({ _tag: "table", headerRow: false });
        expect(yield* roundTrip(converged)).toEqual(converged);
      }
    })
  );

  it.each([
    [0, false],
    [1, true],
    [2, false],
    [3, true],
  ] as const)("projects table header state %i to headerRow=%s", (headerState, headerRow) => {
    expect(editorStateToDocument(tableState(headerState)).children).toEqual([expect.objectContaining({ headerRow })]);
  });

  it.effect(
    "leaves document frontmatter to the owning persistence adapter",
    Effect.fnUntraced(function* () {
      const children = [MdModel.P.make({ children: [mdText("Body")] })];
      const withFrontmatter = MdModel.Document.make({
        children,
        frontmatter: O.some({ title: "Retain me" }),
      });

      expect(yield* roundTrip(withFrontmatter)).toEqual(MdModel.Document.make({ children }));
    })
  );

  it.effect(
    "round-trips artifact-ref blocks through the artifact:// link form",
    Effect.fnUntraced(function* () {
      const labeled = MdModel.P.make({
        children: [
          MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}artifact-123`, children: [mdText("Quarterly report")] }),
        ],
      });
      const unlabeled = MdModel.P.make({
        children: [MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}artifact-456`, children: [mdText("artifact-456")] })],
      });

      const labeledNode = yield* blockToLexical(labeled);
      expect(labeledNode.type).toBe("artifact-ref");
      if (labeledNode.type === "artifact-ref") {
        expect(labeledNode.artifactId).toBe("artifact-123");
        assertSome(labeledNode.label, "Quarterly report");
      }

      const unlabeledNode = yield* blockToLexical(unlabeled);
      expect(unlabeledNode.type).toBe("artifact-ref");
      if (unlabeledNode.type === "artifact-ref") {
        assertNone(unlabeledNode.label);
      }

      const document = MdModel.Document.make({ children: [labeled, unlabeled] });
      expect(yield* roundTrip(document)).toEqual(document);
    })
  );

  it.effect(
    "keeps non-canonical artifact links reversible as ordinary links",
    Effect.fnUntraced(function* () {
      const href = `${ARTIFACT_URI_PREFIX}artifact-123`;
      const links = [
        MdModel.A.make({ href, children: [MdModel.Strong.make({ children: [mdText("Quarterly report")] })] }),
        MdModel.A.make({ href, children: [mdText("Quarterly "), mdText("report")] }),
        MdModel.A.make({ href, children: [mdText("Quarterly report")], title: O.some("Artifact title") }),
        MdModel.A.make({ href, children: [mdText("")] }),
      ];

      for (const link of links) {
        const paragraph = MdModel.P.make({ children: [link] });
        const node = yield* blockToLexical(paragraph);
        expect(node.type).toBe("paragraph");
        if (node.type === "paragraph") expect(node.children[0]?.type).toBe("link");

        const document = MdModel.Document.make({ children: [paragraph] });
        expect(yield* roundTrip(document)).toEqual(document);
      }
    })
  );

  it.prop(
    "round-trips schema-derived artifact URIs without grammar drift",
    { uri: ArtifactUriArbitrary },
    ({ uri }) => {
      expect(S.is(ArtifactUri)(uri)).toBe(true);
      expect(decoded(decodeArtifactUriResult(decoded(encodeArtifactUriResult(uri))))).toBe(uri);
    },
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "keeps malformed artifact:// links as normal Markdown links",
    Effect.fnUntraced(function* () {
      const invalidArtifactLink = MdModel.P.make({
        children: [MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}bad id`, children: [mdText("Legacy artifact")] })],
      });

      const node = yield* blockToLexical(invalidArtifactLink);
      expect(node.type).toBe("paragraph");
      if (node.type === "paragraph") {
        expect(node.children[0]).toMatchObject({ type: "link", url: `${ARTIFACT_URI_PREFIX}bad id` });
      }

      expect(yield* roundTrip(MdModel.Document.make({ children: [invalidArtifactLink] }))).toEqual(
        MdModel.Document.make({ children: [invalidArtifactLink] })
      );
    })
  );

  it.effect(
    "drops invalid legacy code-fence languages during Lexical projection",
    Effect.fnUntraced(function* () {
      // Invalid info-strings are unconstructable via `Pre.make` now (the schema
      // validates the branded `CodeFenceLanguage` at construction); they can only
      // arrive on the wire, where Md decode folds them to None at the boundary.
      const invalidLanguage = decoded(
        decodeMdModelPreResult({
          _tag: "pre",
          value: "console.log('beep')",
          language: "ts bad",
        })
      );
      assertNone(invalidLanguage.language);

      const validLanguage = MdModel.Pre.make({ value: "console.log('beep')", language: O.some("ts") });

      const invalidNode = yield* blockToLexical(invalidLanguage);
      expect(invalidNode.type).toBe("code");
      if (invalidNode.type === "code") {
        assertNone(invalidNode.language);
      }

      const validNode = yield* blockToLexical(validLanguage);
      expect(validNode.type).toBe("code");
      if (validNode.type === "code") {
        assertSome(validNode.language, "ts");
      }

      expect(yield* roundTrip(MdModel.Document.make({ children: [invalidLanguage] }))).toEqual(
        MdModel.Document.make({
          children: [MdModel.Pre.make({ value: "console.log('beep')", language: O.none() })],
        })
      );
    })
  );

  it("drops Lexical-only text format bits (underline) per the lossiness profile", () => {
    const state = decoded(
      decodeSerializedEditorStateResult({
        root: {
          type: "root",
          version: 1,
          direction: null,
          format: "",
          indent: 0,
          children: [
            {
              type: "paragraph",
              version: 1,
              direction: null,
              format: "",
              indent: 0,
              children: [
                // bold (1) + underline (8): underline has no Md equivalent
                { type: "text", version: 1, detail: 0, format: 9, mode: "normal", style: "", text: "kept bold" },
              ],
            },
          ],
        },
      })
    );

    expect(editorStateToDocument(state).children).toEqual([
      MdModel.P.make({ children: [MdModel.Strong.make({ children: [mdText("kept bold")] })] }),
    ]);
  });

  it.effect(
    "normalizes inline mark nesting to the canonical Strong > Em > Del order",
    Effect.fnUntraced(function* () {
      const document = MdModel.Document.make({
        children: [
          MdModel.P.make({
            children: [MdModel.Em.make({ children: [MdModel.Strong.make({ children: [mdText("swapped")] })] })],
          }),
        ],
      });

      expect(yield* roundTrip(document)).toEqual(
        MdModel.Document.make({
          children: [
            MdModel.P.make({
              children: [MdModel.Strong.make({ children: [MdModel.Em.make({ children: [mdText("swapped")] })] })],
            }),
          ],
        })
      );
    })
  );

  it.effect(
    "preserves nested lists through Lexical and Md projections",
    Effect.fnUntraced(function* () {
      const state = decoded(
        decodeSerializedEditorStateResult({
          root: {
            type: "root",
            version: 1,
            direction: null,
            format: "",
            indent: 0,
            children: [
              {
                type: "list",
                version: 1,
                direction: null,
                format: "",
                indent: 0,
                listType: "bullet",
                start: 1,
                tag: "ul",
                children: [
                  {
                    type: "listitem",
                    version: 1,
                    direction: null,
                    format: "",
                    indent: 0,
                    value: 1,
                    children: [
                      { type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "parent" },
                      {
                        type: "list",
                        version: 1,
                        direction: null,
                        format: "",
                        indent: 1,
                        listType: "bullet",
                        start: 1,
                        tag: "ul",
                        children: [
                          {
                            type: "listitem",
                            version: 1,
                            direction: null,
                            format: "",
                            indent: 1,
                            value: 1,
                            children: [
                              {
                                type: "text",
                                version: 1,
                                detail: 0,
                                format: 0,
                                mode: "normal",
                                style: "",
                                text: "child",
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        })
      );

      expect(editorStateToDocument(state).children).toEqual([
        MdModel.Ul.make({
          children: [
            MdModel.Li.make({
              children: [
                mdText("parent"),
                MdModel.Ul.make({
                  children: [MdModel.Li.make({ children: [mdText("child")] })],
                }),
              ],
            }),
          ],
        }),
      ]);

      const nestedDocument = MdModel.Document.make({
        children: [
          MdModel.Ol.make({
            start: PosInt.make(3),
            children: [
              MdModel.Li.make({
                children: [
                  mdText("parent"),
                  MdModel.Ul.make({
                    children: [MdModel.Li.make({ children: [mdText("child")] })],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      expect(yield* roundTrip(nestedDocument)).toEqual(nestedDocument);
    })
  );

  it.effect(
    "degrades out-of-profile Md nodes deterministically",
    Effect.fnUntraced(function* () {
      const hr = yield* blockToLexical(MdModel.Hr.make({}));
      expect(hr.type).toBe("paragraph");
      expect(nodeToBlocks(hr)).toEqual([MdModel.P.make({ children: [mdText("---")] })]);

      const image = yield* blockToLexical(
        MdModel.P.make({
          children: [
            MdModel.Img.make({
              src: "https://example.com/x.png",
              alt: "x",
              title: O.some("Image title"),
            }),
          ],
        })
      );
      expect(image.type).toBe("paragraph");
      if (image.type === "paragraph") {
        const link = image.children[0];
        expect(link?.type).toBe("link");
        if (link?.type === "link") {
          assertSome(link.title, "Image title");
        }
      }

      const raw = yield* blockToLexical(
        MdModel.P.make({ children: [MdModel.RawMarkdown.make({ value: "**trusted**" })] })
      );
      expect(raw.type).toBe("paragraph");
      if (raw.type === "paragraph") {
        expect(raw.children[0]?.type).toBe("text");
      }
    })
  );

  it.effect(
    "preserves plain-text content when a list item block is not representable in Lexical",
    Effect.fnUntraced(function* () {
      const document = MdModel.Document.make({
        children: [
          MdModel.Ul.make({
            children: [
              MdModel.Li.make({
                children: [
                  MdModel.P.make({
                    children: [
                      mdText("text"),
                      MdModel.RawMarkdown.make({ value: "**raw**" }),
                      MdModel.RawHtml.make({ value: "<b>raw</b>" }),
                      MdModel.Strong.make({ children: [mdText("strong")] }),
                      MdModel.Em.make({ children: [mdText("em")] }),
                      MdModel.Del.make({ children: [mdText("del")] }),
                      MdModel.Code.make({ value: "code" }),
                      MdModel.A.make({ href: "https://example.com", children: [mdText("link")] }),
                      MdModel.Img.make({ src: "https://example.com/image.png", alt: "image" }),
                      MdModel.Br.make({}),
                      MdModel.InlineMath.make({ value: "x+y" }),
                      MdModel.FootnoteReference.make({ identifier: "note" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });

      expect(yield* roundTrip(document)).toEqual(
        MdModel.Document.make({
          children: [
            MdModel.Ul.make({
              children: [
                MdModel.Li.make({
                  children: [mdText("text**raw**<b>raw</b>strongemdelcodelinkimage\nx+ynote")],
                }),
              ],
            }),
          ],
        })
      );
    })
  );

  it.prop(
    "projects schema-derived arbitrary editor states onto valid Md documents (totality)",
    { state: StateArbitrary },
    ({ state }) => {
      const document = editorStateToDocument(state);
      expect(decoded(decodeMdModelDocumentResult(decoded(encodeMdModelDocumentResult(document))))).toEqual(document);
    },
    { arbitrary: fcRuns(50) }
  );

  it("wraps a loose text node in a Markdown paragraph", () => {
    const looseText = Result.getOrThrow(
      decodeLexicalNodeResult({
        type: "text",
        version: 1,
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: "loose",
      })
    );

    expect(nodeToBlocks(looseText)).toEqual([MdModel.P.make({ children: [mdText("loose")] })]);
  });

  it.effect.prop(
    "stabilizes after one Md → Lexical → Md pass (lossy codec idempotent on its stable image)",
    { document: DocumentArbitrary },
    Effect.fnUntraced(function* ({ document }) {
      const once = yield* roundTrip(document);
      expect(yield* roundTrip(once)).toEqual(once);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "normalizes multi-block quotes into a single linebreak-separated paragraph",
    Effect.fnUntraced(function* () {
      const document = MdModel.Document.make({
        children: [
          MdModel.BlockQuote.make({
            children: [
              MdModel.P.make({ children: [mdText("first")] }),
              MdModel.P.make({ children: [mdText("second")] }),
            ],
          }),
        ],
      });

      expect(yield* roundTrip(document)).toEqual(
        MdModel.Document.make({
          children: [
            MdModel.BlockQuote.make({
              children: [MdModel.P.make({ children: [mdText("first"), MdModel.Br.make({}), mdText("second")] })],
            }),
          ],
        })
      );
    })
  );

  it("preserves block structure for shadow-root quotes", () => {
    const state = Result.getOrThrow(
      decodeSerializedEditorStateResult({
        root: {
          type: "root",
          version: 1,
          direction: null,
          format: "",
          indent: 0,
          children: [
            {
              type: "quote",
              version: 1,
              direction: null,
              format: "",
              indent: 0,
              shadowRoot: true,
              children: [
                {
                  type: "heading",
                  version: 1,
                  direction: null,
                  format: "",
                  indent: 0,
                  tag: "h2",
                  children: [
                    { type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "Title" },
                  ],
                },
                {
                  type: "list",
                  version: 1,
                  direction: null,
                  format: "",
                  indent: 0,
                  listType: "bullet",
                  start: 1,
                  tag: "ul",
                  children: [
                    {
                      type: "listitem",
                      version: 1,
                      direction: null,
                      format: "",
                      indent: 0,
                      value: 1,
                      children: [
                        {
                          type: "text",
                          version: 1,
                          detail: 0,
                          format: 0,
                          mode: "normal",
                          style: "",
                          text: "Item",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    );

    expect(editorStateToDocument(state)).toEqual(
      MdModel.Document.make({
        children: [
          MdModel.BlockQuote.make({
            children: [
              MdModel.Heading.make({ level: 2, children: [mdText("Title")] }),
              MdModel.Ul.make({ children: [MdModel.Li.make({ children: [mdText("Item")] })] }),
            ],
          }),
        ],
      })
    );
  });
});
