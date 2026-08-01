// @vitest-environment jsdom

import { ArtifactRefNode } from "@beep/editor/artifact-ref-node";
import { editorNodes } from "@beep/editor/nodes";
import { YOUTUBE_EMBED_SANDBOX } from "@beep/editor/youtube-embed";
import { YouTubeNode } from "@beep/editor/youtube-node";
import {
  ARTIFACT_URI_PREFIX,
  documentToEditorState,
  EditorStateFromJson,
  SerializedEditorState,
} from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import { describe, expect, it } from "@effect/vitest";
import { createHeadlessEditor } from "@lexical/headless";
import { $generateNodesFromDOM } from "@lexical/html";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { $getRoot, $setState, createState } from "lexical";

const text = (value: string) => MdModel.Text.make({ value });
const syntheticYouTubeVideoId = "AbCdEfGhI12";

/**
 * The fixture flows through the real pipeline: Md AST → schema codec →
 * encoded wire state → headless Lexical import/export → schema decode.
 */
const fixtureTurn = MdModel.Document.make({
  children: [
    MdModel.Heading.make({ level: 2, children: [MdModel.Strong.make({ children: [text("Plan")] })] }),
    MdModel.P.make({
      children: [text("See "), MdModel.A.make({ href: "https://example.com", children: [text("the docs")] })],
    }),
    MdModel.BlockQuote.make({ children: [MdModel.P.make({ children: [text("Measure twice.")] })] }),
    MdModel.Pre.make({ value: 'console.log("beep")\nexport {}', language: O.some("typescript") }),
    MdModel.Pre.make({ value: "graph TD\n  A --> B", language: O.some("mermaid") }),
    MdModel.Table.make({
      headerRow: true,
      children: [
        MdModel.TableRow.make({
          children: [
            MdModel.TableCell.make({ children: [text("Name")] }),
            MdModel.TableCell.make({ children: [text("Value")] }),
          ],
        }),
        MdModel.TableRow.make({
          children: [
            MdModel.TableCell.make({ children: [text("Language")] }),
            MdModel.TableCell.make({ children: [MdModel.Code.make({ value: "ts" })] }),
          ],
        }),
      ],
    }),
    MdModel.YouTube.make({ videoId: "M7lc1UVf-VE" }),
    MdModel.TaskList.make({
      children: [
        MdModel.TaskItem.make({ checked: true, children: [text("ship schema")] }),
        MdModel.TaskItem.make({ checked: false, children: [text("ship editor")] }),
      ],
    }),
    MdModel.P.make({
      children: [MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}artifact-123`, children: [text("Quarterly report")] })],
    }),
  ],
});

describe("@beep/editor node registration", () => {
  it("admits schema-derived strict states through the real Lexical runtime", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-schema-property-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });

    fc.assert(
      fc.property(S.toArbitrary(SerializedEditorState), (state) => {
        editor.setEditorState(editor.parseEditorState(S.encodeSync(EditorStateFromJson)(state)));
        expect(Result.isSuccess(S.decodeUnknownResult(SerializedEditorState)(editor.getEditorState().toJSON()))).toBe(
          true
        );
      }),
      { numRuns: 25 }
    );
  });

  it("imports a codec-built editor state and re-exports schema-conformant wire state", () => {
    const wire = documentToEditorState(fixtureTurn).pipe(Effect.runSync, S.encodeSync(SerializedEditorState));

    const editor = createHeadlessEditor({
      namespace: "beep-editor-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });

    editor.setEditorState(editor.parseEditorState(JSON.stringify(wire)));
    const exported = editor.getEditorState().toJSON();

    // Whatever the runtime nodes export must decode through the schema.
    const decoded = S.decodeUnknownSync(SerializedEditorState)(exported);
    const artifact = decoded.root.children.at(-1);
    expect(artifact?.type).toBe("artifact-ref");
    if (artifact?.type === "artifact-ref") {
      expect(artifact.artifactId).toBe("artifact-123");
      expect(artifact.label).toEqual(O.some("Quarterly report"));
    }
    expect(decoded.root.children.some((node) => node.type === "table")).toBe(true);
    expect(decoded.root.children.some((node) => node.type === "youtube")).toBe(true);
    expect(
      decoded.root.children.some(
        (node) => node.type === "code" && O.isSome(node.language) && node.language.value === "mermaid"
      )
    ).toBe(true);
  });

  it("preserves JSON-compatible NodeState when exporting decorator nodes", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-valid-node-state-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });
    const nodeState = createState("beep-valid-export", {
      parse: () => 0,
      unparse: () => ({ enabled: true, nested: [1, null] }),
    });

    editor.update(
      () => {
        const artifact = $setState(
          ArtifactRefNode.importJSON({
            type: "artifact-ref",
            version: 1,
            artifactId: "artifact-123",
          }),
          nodeState,
          1
        );
        const youtube = $setState(
          YouTubeNode.importJSON({
            type: "youtube",
            version: 1,
            format: "",
            videoID: syntheticYouTubeVideoId,
          }),
          nodeState,
          1
        );
        $getRoot().clear().append(artifact, youtube);

        expect(artifact.exportJSON().$).toEqual({
          "beep-valid-export": { enabled: true, nested: [1, null] },
        });
        expect(youtube.exportJSON().$).toEqual({
          "beep-valid-export": { enabled: true, nested: [1, null] },
        });
      },
      { discrete: true }
    );
  });

  it("rejects non-JSON NodeState when exporting decorator nodes", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-invalid-node-state-export-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });
    const nodeState = createState("beep-invalid-export", {
      parse: () => 0,
      unparse: () => 1n,
    });

    editor.update(
      () => {
        const artifact = $setState(
          ArtifactRefNode.importJSON({
            type: "artifact-ref",
            version: 1,
            artifactId: "artifact-123",
          }),
          nodeState,
          1
        );
        const youtube = $setState(
          YouTubeNode.importJSON({
            type: "youtube",
            version: 1,
            format: "",
            videoID: syntheticYouTubeVideoId,
          }),
          nodeState,
          1
        );
        $getRoot().clear().append(artifact, youtube);

        expect(() => artifact.exportJSON()).toThrow(S.SchemaError);
        expect(() => youtube.exportJSON()).toThrow(S.SchemaError);
      },
      { discrete: true }
    );
  });

  it("keeps malformed serialized decorator payloads inert at runtime import", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-invalid-node-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });
    let youtubeId: string | undefined;
    let artifactId: string | undefined;
    let artifactLabel: string | undefined;

    editor.update(
      () => {
        const youtube = YouTubeNode.importJSON({
          type: "youtube",
          version: 1,
          format: "",
          videoID: '"><script>alert(1)</script>',
        } as never);
        const artifact = ArtifactRefNode.importJSON({
          type: "artifact-ref",
          version: 1,
          artifactId: "",
          label: "<img src=x onerror=alert(1)>",
        } as never);
        youtubeId = youtube.__id;
        artifactId = artifact.__artifactId;
        artifactLabel = artifact.__label;
      },
      { discrete: true }
    );

    expect(youtubeId).toBe("");
    expect(artifactId).toBe("");
    expect(artifactLabel).toBeUndefined();
  });

  it("round-trips YouTube DOM as one node with the least-privilege frame and visible watch fallback", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-youtube-export-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });
    const output: { current: HTMLElement | null } = { current: null };

    editor.update(
      () => {
        const node = YouTubeNode.importJSON({
          type: "youtube",
          version: 1,
          format: "",
          videoID: syntheticYouTubeVideoId,
        });
        const element = node.exportDOM().element;
        output.current = element instanceof HTMLElement ? element : null;
        if (output.current === null) return;

        const importedDocument = document.implementation.createHTMLDocument();
        importedDocument.body.append(output.current.cloneNode(true));
        $getRoot()
          .clear()
          .append(...$generateNodesFromDOM(editor, importedDocument));
      },
      { discrete: true }
    );

    const iframe = output.current?.querySelector("iframe");
    const watch = output.current?.querySelector("a");
    expect(output.current?.getAttribute("data-lexical-youtube-wrapper")).toBe(syntheticYouTubeVideoId);
    expect(iframe?.getAttribute("src")).toBe(`https://www.youtube-nocookie.com/embed/${syntheticYouTubeVideoId}`);
    expect(iframe?.getAttribute("sandbox")).toBe(YOUTUBE_EMBED_SANDBOX);
    expect(iframe?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(watch?.getAttribute("href")).toBe(`https://www.youtube.com/watch?v=${syntheticYouTubeVideoId}`);
    expect(watch?.getAttribute("rel")).toBe("noreferrer noopener");
    expect(watch?.textContent).toBe("Watch on YouTube");

    const roundTripped = Result.getOrThrow(
      S.decodeUnknownResult(SerializedEditorState)(editor.getEditorState().toJSON())
    );
    expect(roundTripped.root.children).toEqual([
      expect.objectContaining({ type: "youtube", videoID: syntheticYouTubeVideoId }),
    ]);
  });

  it("drops every descendant of a malformed marked YouTube wrapper", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-youtube-malformed-wrapper-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });
    const importedDocument = document.implementation.createHTMLDocument();
    const wrapper = importedDocument.createElement("figure");
    wrapper.setAttribute("data-lexical-youtube-wrapper", "invalid");
    const iframe = importedDocument.createElement("iframe");
    iframe.setAttribute("data-lexical-youtube", syntheticYouTubeVideoId);
    const watch = importedDocument.createElement("a");
    watch.setAttribute("href", "javascript:alert(1)");
    watch.textContent = "Unsafe fallback";
    wrapper.append(iframe, watch);
    importedDocument.body.append(wrapper);

    editor.update(
      () => {
        $getRoot().append(...$generateNodesFromDOM(editor, importedDocument));
      },
      { discrete: true }
    );

    expect(editor.getEditorState().toJSON().root.children).toEqual([]);
  });

  it("continues to import a standalone legacy YouTube iframe", () => {
    const editor = createHeadlessEditor({
      namespace: "beep-editor-youtube-legacy-iframe-test",
      nodes: [...editorNodes],
      onError: (error) => {
        throw error;
      },
    });
    const importedDocument = document.implementation.createHTMLDocument();
    const iframe = importedDocument.createElement("iframe");
    iframe.setAttribute("data-lexical-youtube", syntheticYouTubeVideoId);
    importedDocument.body.append(iframe);

    editor.update(
      () => {
        $getRoot().append(...$generateNodesFromDOM(editor, importedDocument));
      },
      { discrete: true }
    );

    expect(editor.getEditorState().toJSON().root.children).toEqual([
      expect.objectContaining({ type: "youtube", videoID: syntheticYouTubeVideoId }),
    ]);
  });
});
