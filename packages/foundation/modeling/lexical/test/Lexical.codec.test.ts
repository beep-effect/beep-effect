import {
  ARTIFACT_URI_PREFIX,
  ArtifactUri,
  blockToLexical,
  documentToEditorState,
  editorStateToDocument,
  nodeToBlocks,
  RootNode,
  SerializedEditorState,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import { refineSafeDocument } from "@beep/md/Md.safe";
import { PosInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { TableCellHeaderState } from "@beep/lexical-schema";

const StateArbitrary = S.toArbitrary(SerializedEditorState);
const ArtifactUriArbitrary = S.toArbitrary(ArtifactUri);
const DocumentArbitrary = S.toArbitrary(MdModel.Document);

const mdText = (value: string) => MdModel.Text.make({ value });

const roundTrip = (document: MdModel.Document): MdModel.Document =>
  documentToEditorState(document).pipe(Effect.runSync, editorStateToDocument);

const tableState = (headerState: TableCellHeaderState): SerializedEditorState =>
  SerializedEditorState.make({
    root: RootNode.make({
      children: [
        TableNode.make({
          children: [TableRowNode.make({ children: [TableCellNode.make({ children: [], headerState })] })],
        }),
      ],
    }),
  });

describe("Lexical.codec", () => {
  it("canonicalizes an empty Md document to one runtime-editable paragraph", () => {
    const empty = MdModel.Document.make({ children: [] });
    const state = Effect.runSync(documentToEditorState(empty));

    expect(state.root.children).toEqual([expect.objectContaining({ type: "paragraph", children: [] })]);

    const projected = editorStateToDocument(state);
    expect(projected).toEqual(MdModel.Document.make({ children: [MdModel.P.make({ children: [] })] }));
    expect(roundTrip(projected)).toEqual(projected);
  });

  it("round-trips an md-core assistant turn (Md → Lexical → Md identity)", () => {
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

    expect(roundTrip(document)).toEqual(document);
  });

  it("preserves the complete user-content link domain through the editor codec", () => {
    const hrefs = ["#section", "/docs", "https://example.com", "mailto:user@example.com", "tel:+15551234567"];

    for (const href of hrefs) {
      const document = MdModel.Document.make({
        children: [MdModel.P.make({ children: [MdModel.A.make({ href, children: [mdText(href)] })] })],
      });

      expect(roundTrip(document)).toEqual(document);
    }
  });

  it("converges control-separated protocol-relative links to a harmless fragment", () => {
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

    expect(roundTrip(hostile)).toEqual(converged);
    expect(roundTrip(converged)).toEqual(converged);
  });

  it("keeps safe nested-link content inside the strict Lexical grammar", () => {
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

    expect(Result.isSuccess(refineSafeDocument(document))).toBe(true);
    expect(roundTrip(document)).toEqual(converged);
    expect(roundTrip(converged)).toEqual(converged);
  });

  it("converges Markdown table alignment to the structural Lexical table profile", () => {
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

    expect(roundTrip(aligned)).toEqual(structural);
    expect(roundTrip(structural)).toEqual(structural);
  });

  it("normalizes an unrepresentable empty Markdown header row", () => {
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
      const converged = roundTrip(document);
      expect(converged.children[0]).toMatchObject({ _tag: "table", headerRow: false });
      expect(roundTrip(converged)).toEqual(converged);
    }
  });

  it.each([
    [0, false],
    [1, true],
    [2, false],
    [3, true],
  ] as const)("projects table header state %i to headerRow=%s", (headerState, headerRow) => {
    expect(editorStateToDocument(tableState(headerState)).children).toEqual([expect.objectContaining({ headerRow })]);
  });

  it("leaves document frontmatter to the owning persistence adapter", () => {
    const children = [MdModel.P.make({ children: [mdText("Body")] })];
    const withFrontmatter = MdModel.Document.make({
      children,
      frontmatter: O.some({ title: "Retain me" }),
    });

    expect(roundTrip(withFrontmatter)).toEqual(MdModel.Document.make({ children }));
  });

  it("round-trips artifact-ref blocks through the artifact:// link form", () => {
    const labeled = MdModel.P.make({
      children: [
        MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}artifact-123`, children: [mdText("Quarterly report")] }),
      ],
    });
    const unlabeled = MdModel.P.make({
      children: [MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}artifact-456`, children: [mdText("artifact-456")] })],
    });

    const labeledNode = Effect.runSync(blockToLexical(labeled));
    expect(labeledNode.type).toBe("artifact-ref");
    if (labeledNode.type === "artifact-ref") {
      expect(labeledNode.artifactId).toBe("artifact-123");
      expect(labeledNode.label).toEqual(O.some("Quarterly report"));
    }

    const unlabeledNode = Effect.runSync(blockToLexical(unlabeled));
    if (unlabeledNode.type === "artifact-ref") {
      expect(unlabeledNode.label).toEqual(O.none());
    }

    const document = MdModel.Document.make({ children: [labeled, unlabeled] });
    expect(roundTrip(document)).toEqual(document);
  });

  it("keeps non-canonical artifact links reversible as ordinary links", () => {
    const href = `${ARTIFACT_URI_PREFIX}artifact-123`;
    const links = [
      MdModel.A.make({ href, children: [MdModel.Strong.make({ children: [mdText("Quarterly report")] })] }),
      MdModel.A.make({ href, children: [mdText("Quarterly "), mdText("report")] }),
      MdModel.A.make({ href, children: [mdText("Quarterly report")], title: O.some("Artifact title") }),
      MdModel.A.make({ href, children: [mdText("")] }),
    ];

    for (const link of links) {
      const paragraph = MdModel.P.make({ children: [link] });
      const node = Effect.runSync(blockToLexical(paragraph));
      expect(node.type).toBe("paragraph");
      if (node.type === "paragraph") expect(node.children[0]?.type).toBe("link");

      const document = MdModel.Document.make({ children: [paragraph] });
      expect(roundTrip(document)).toEqual(document);
    }
  });

  it("round-trips schema-derived artifact URIs without grammar drift", () => {
    fc.assert(
      fc.property(ArtifactUriArbitrary, (uri) => {
        expect(ArtifactUri.is(uri)).toBe(true);
        expect(S.decodeUnknownSync(ArtifactUri)(S.encodeSync(ArtifactUri)(uri))).toBe(uri);
      }),
      fcRuns(50)
    );
  });

  it("keeps malformed artifact:// links as normal Markdown links", () => {
    const invalidArtifactLink = MdModel.P.make({
      children: [MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}bad id`, children: [mdText("Legacy artifact")] })],
    });

    const node = Effect.runSync(blockToLexical(invalidArtifactLink));
    expect(node.type).toBe("paragraph");
    if (node.type === "paragraph") {
      expect(node.children[0]).toMatchObject({ type: "link", url: `${ARTIFACT_URI_PREFIX}bad id` });
    }

    expect(roundTrip(MdModel.Document.make({ children: [invalidArtifactLink] }))).toEqual(
      MdModel.Document.make({ children: [invalidArtifactLink] })
    );
  });

  it("drops invalid legacy code-fence languages during Lexical projection", () => {
    // Invalid info-strings are unconstructable via `Pre.make` now (the schema
    // validates the branded `CodeFenceLanguage` at construction); they can only
    // arrive on the wire, where Md decode folds them to None at the boundary.
    const invalidLanguage = S.decodeUnknownSync(MdModel.Pre)({
      _tag: "pre",
      value: "console.log('beep')",
      language: "ts bad",
    });
    expect(invalidLanguage.language).toEqual(O.none());

    const validLanguage = MdModel.Pre.make({ value: "console.log('beep')", language: O.some("ts") });

    const invalidNode = Effect.runSync(blockToLexical(invalidLanguage));
    expect(invalidNode.type).toBe("code");
    if (invalidNode.type === "code") {
      expect(invalidNode.language).toEqual(O.none());
    }

    const validNode = Effect.runSync(blockToLexical(validLanguage));
    if (validNode.type === "code") {
      expect(validNode.language).toEqual(O.some("ts"));
    }

    expect(roundTrip(MdModel.Document.make({ children: [invalidLanguage] }))).toEqual(
      MdModel.Document.make({
        children: [MdModel.Pre.make({ value: "console.log('beep')", language: O.none() })],
      })
    );
  });

  it("drops Lexical-only text format bits (underline) per the lossiness profile", () => {
    const state = S.decodeUnknownSync(SerializedEditorState)({
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
    });

    expect(editorStateToDocument(state).children).toEqual([
      MdModel.P.make({ children: [MdModel.Strong.make({ children: [mdText("kept bold")] })] }),
    ]);
  });

  it("normalizes inline mark nesting to the canonical Strong > Em > Del order", () => {
    const document = MdModel.Document.make({
      children: [
        MdModel.P.make({
          children: [MdModel.Em.make({ children: [MdModel.Strong.make({ children: [mdText("swapped")] })] })],
        }),
      ],
    });

    expect(roundTrip(document)).toEqual(
      MdModel.Document.make({
        children: [
          MdModel.P.make({
            children: [MdModel.Strong.make({ children: [MdModel.Em.make({ children: [mdText("swapped")] })] })],
          }),
        ],
      })
    );
  });

  it("preserves nested lists through Lexical and Md projections", () => {
    const state = S.decodeUnknownSync(SerializedEditorState)({
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
                          { type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "child" },
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
    });

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
    expect(roundTrip(nestedDocument)).toEqual(nestedDocument);
  });

  it("degrades out-of-profile Md nodes deterministically", () => {
    const hr = Effect.runSync(blockToLexical(MdModel.Hr.make({})));
    expect(hr.type).toBe("paragraph");
    expect(nodeToBlocks(hr)).toEqual([MdModel.P.make({ children: [mdText("---")] })]);

    const image = Effect.runSync(
      blockToLexical(
        MdModel.P.make({
          children: [
            MdModel.Img.make({
              src: "https://example.com/x.png",
              alt: "x",
              title: O.some("Image title"),
            }),
          ],
        })
      )
    );
    if (image.type === "paragraph") {
      const link = image.children[0];
      expect(link?.type).toBe("link");
      if (link?.type === "link") {
        expect(link.title).toEqual(O.some("Image title"));
      }
    }

    const raw = Effect.runSync(
      blockToLexical(MdModel.P.make({ children: [MdModel.RawMarkdown.make({ value: "**trusted**" })] }))
    );
    if (raw.type === "paragraph") {
      expect(raw.children[0]?.type).toBe("text");
    }
  });

  it("projects schema-derived arbitrary editor states onto valid Md documents (totality)", () => {
    fc.assert(
      fc.property(StateArbitrary, (state) => {
        const document = editorStateToDocument(state);
        // Validate via the encode -> decode round-trip: Pre.language is a codec
        // field (OptionFromNullOr), so the projected instance differs from its
        // encoded form. Decoding the instance directly would reject its real
        // Option; decoding the encoded form confirms the projection is valid.
        expect(S.decodeUnknownSync(MdModel.Document)(S.encodeSync(MdModel.Document)(document))).toEqual(document);
      }),
      fcRuns(50)
    );
  });

  it("stabilizes after one Md → Lexical → Md pass (lossy codec idempotent on its stable image)", () => {
    fc.assert(
      fc.property(DocumentArbitrary, (document) => {
        // The codec is intentionally lossy (Lexical-only presentation state drops on
        // the way to Md), so `roundTrip` is NOT identity on arbitrary documents.
        // But one pass lands the document in the md-core stable subalgebra, after
        // which further passes are identity: `roundTrip` is idempotent. This is the
        // documented lossiness profile stated as a law.
        const once = roundTrip(document);
        expect(roundTrip(once)).toEqual(once);
      }),
      fcRuns(50)
    );
  });

  it("normalizes multi-block quotes into a single linebreak-separated paragraph", () => {
    const document = MdModel.Document.make({
      children: [
        MdModel.BlockQuote.make({
          children: [MdModel.P.make({ children: [mdText("first")] }), MdModel.P.make({ children: [mdText("second")] })],
        }),
      ],
    });

    expect(roundTrip(document)).toEqual(
      MdModel.Document.make({
        children: [
          MdModel.BlockQuote.make({
            children: [MdModel.P.make({ children: [mdText("first"), MdModel.Br.make({}), mdText("second")] })],
          }),
        ],
      })
    );
  });
});
