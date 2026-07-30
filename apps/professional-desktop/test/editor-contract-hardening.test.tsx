import { draftAtoms } from "@beep/agents-client/Chat.atoms";
import { isTypeaheadMenuVisible, TYPEAHEAD_MENU_ATTRIBUTE } from "@beep/editor/chat/atoms";
import { ChatComposer } from "@beep/editor/chat/chat-composer";
import { ComposerFeatures } from "@beep/editor/chat/config";
import { EditorWireComposer } from "@beep/editor/composer";
import { decodeEditorStateForRuntime } from "@beep/editor/runtime";
import { EditorCompatibilityViewer, EditorViewer } from "@beep/editor/viewer";
import { YOUTUBE_WATCH_EVENT, YouTubeEmbed, YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import { documentToEditorState, editorStateToDocument } from "@beep/lexical-schema/Lexical.codec";
import { LexicalCompatibilityResult, SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import * as Md from "@beep/md/Md.model";
import { documentSafetyIssues, refineSafeDocument } from "@beep/md/Md.safe";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import "@testing-library/jest-dom/vitest";
import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Deferred, Effect, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from "lexical";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { Composer, ComposerSafetyWarning } from "@/chat/ui/Composer";
import {
  composerConfirmedNormalizationAtoms,
  composerDocumentForSend,
  composerDocumentFromEditorState,
  normalizeLegacyRawDocument,
  prepareComposerDocumentSafetyGate,
} from "@/chat/ui/Composer.atoms";

function SeedEditor({ label, text }: { readonly label: string; readonly text: string }) {
  const [editor] = useLexicalComposerContext();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() =>
        editor.update(
          () => {
            const paragraph = $createParagraphNode();
            const textNode = $createTextNode(text);
            paragraph.append(textNode);
            $getRoot().clear().append(paragraph);
            textNode.selectEnd();
          },
          { discrete: true }
        )
      }
    >
      Seed
    </button>
  );
}

function ConfirmationProbe({
  document,
  threadId,
}: {
  readonly document: Md.Document;
  readonly threadId: WorkspaceIdentity.ThreadId;
}) {
  const confirmed = useAtomValue(composerConfirmedNormalizationAtoms(threadId)(document));
  return <output data-testid="normalization-confirmation">{O.isSome(confirmed) ? "confirmed" : "pending"}</output>;
}

let rangeRectDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  rangeRectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        bottom: 50,
        height: 18,
        left: 24,
        right: 25,
        top: 32,
        width: 1,
        x: 24,
        y: 32,
        toJSON: () => ({}),
      }) satisfies DOMRect,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (rangeRectDescriptor === undefined) {
    Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
  } else {
    Object.defineProperty(Range.prototype, "getBoundingClientRect", rangeRectDescriptor);
  }
});

describe("editor contract hardening", { concurrent: false }, () => {
  it("keeps the seeded mountConfig feature set immutable", () => {
    const view = render(<ChatComposer mountConfig={{ features: { attachments: true } }} />);

    expect(screen.getByRole("button", { name: "Attach files" })).toBeInTheDocument();

    view.rerender(<ChatComposer mountConfig={{ features: { attachments: false } }} />);

    // Mount config is intentionally uncontrolled. Changing it without changing
    // the component key must not split plugin visibility from the seeded atoms.
    expect(screen.getByRole("button", { name: "Attach files" })).toBeInTheDocument();
  });

  it.effect(
    "catches a synchronously rejected attachment port and revokes the rolled-back URL exactly once",
    Effect.fnUntraced(function* () {
      const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:attachment-test");
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      const onAttach = vi.fn(() => {
        throw new Error("private backend detail");
      });
      const view = render(
        <RegistryProvider>
          <ChatComposer mountConfig={{ onAttach }} />
        </RegistryProvider>
      );
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();

      fireEvent.change(input!, {
        target: {
          files: [new File(["png"], "diagram.png", { type: "image/png" })],
        },
      });

      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1)));
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Files could not be attached"))
      );
      expect(screen.getByRole("alert")).not.toHaveTextContent("private backend detail");
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.queryByRole("button", { name: "Remove diagram.png" })).not.toBeInTheDocument())
      );
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);

      view.unmount();
      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "settles concurrent attachment batches out of order and rolls back only the rejected batch",
    Effect.fnUntraced(function* () {
      const firstPort = yield* Deferred.make<void, Error>();
      const secondPort = yield* Deferred.make<void>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const secondSettled = vi.fn();
      const createObjectUrl = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValueOnce("blob:first-batch")
        .mockReturnValueOnce("blob:second-batch")
        .mockReturnValueOnce("blob:recovery-batch");
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      const onAttach = vi.fn((files: ReadonlyArray<File>): void | Promise<void> => {
        const filename = files[0]?.name;
        if (filename === "first.png") return runPromise(Deferred.await(firstPort));
        if (filename === "second.png") {
          return runPromise(Deferred.await(secondPort)).then(() => {
            secondSettled();
          });
        }
      });
      const view = render(
        <RegistryProvider>
          <ChatComposer mountConfig={{ onAttach }} />
        </RegistryProvider>
      );
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();
      if (input === null) return;

      fireEvent.change(input, {
        target: { files: [new File(["first"], "first.png", { type: "image/png" })] },
      });
      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1)));

      fireEvent.change(input, {
        target: { files: [new File(["second"], "second.png", { type: "image/png" })] },
      });
      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(2)));
      expect(screen.getByRole("button", { name: "Remove first.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove second.png" })).toBeInTheDocument();

      // Settle the newer success first, then reject the older capture. Both
      // fibers must still be live for the older batch to reach its rollback.
      yield* Deferred.succeed(secondPort, undefined);
      yield* Effect.promise(() => waitFor(() => expect(secondSettled).toHaveBeenCalledTimes(1)));
      yield* Deferred.fail(firstPort, new Error("private first-batch detail"));
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.queryByRole("button", { name: "Remove first.png" })).not.toBeInTheDocument())
      );

      expect(screen.getByRole("button", { name: "Remove second.png" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Files could not be attached");
      expect(screen.getByRole("alert")).not.toHaveTextContent("private first-batch detail");
      expect(revokeObjectUrl.mock.calls).toEqual([["blob:first-batch"]]);

      // A later synchronous success clears the prior failure and remains
      // removable alongside the earlier successful batch.
      fireEvent.change(input, {
        target: { files: [new File(["recovery"], "recovery.png", { type: "image/png" })] },
      });
      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(3)));
      yield* Effect.promise(() => waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument()));
      expect(screen.getByRole("button", { name: "Remove recovery.png" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Remove second.png" }));
      fireEvent.click(screen.getByRole("button", { name: "Remove recovery.png" }));
      expect(revokeObjectUrl.mock.calls).toEqual([
        ["blob:first-batch"],
        ["blob:second-batch"],
        ["blob:recovery-batch"],
      ]);
      expect(createObjectUrl).toHaveBeenCalledTimes(3);

      view.unmount();
      expect(revokeObjectUrl).toHaveBeenCalledTimes(3);
    })
  );

  it.effect(
    "does not let one composer's pending attachment port interrupt another composer",
    Effect.fnUntraced(function* () {
      const firstPort = yield* Deferred.make<void, Error>();
      const secondPort = yield* Deferred.make<void>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const firstAttach = vi.fn(() => runPromise(Deferred.await(firstPort)));
      const secondAttach = vi.fn(() => runPromise(Deferred.await(secondPort)));
      vi.spyOn(URL, "createObjectURL")
        .mockReturnValueOnce("blob:first-composer")
        .mockReturnValueOnce("blob:second-composer");
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      const view = render(
        <RegistryProvider>
          <ChatComposer namespace="attachment-isolation-first" mountConfig={{ onAttach: firstAttach }} />
          <ChatComposer namespace="attachment-isolation-second" mountConfig={{ onAttach: secondAttach }} />
        </RegistryProvider>
      );
      const inputs = view.container.querySelectorAll<HTMLInputElement>('input[type="file"]');
      const firstInput = inputs.item(0);
      const secondInput = inputs.item(1);

      fireEvent.change(firstInput, {
        target: { files: [new File(["first"], "first-composer.png", { type: "image/png" })] },
      });
      yield* Effect.promise(() => waitFor(() => expect(firstAttach).toHaveBeenCalledTimes(1)));
      fireEvent.change(secondInput, {
        target: { files: [new File(["second"], "second-composer.png", { type: "image/png" })] },
      });
      yield* Effect.promise(() => waitFor(() => expect(secondAttach).toHaveBeenCalledTimes(1)));

      yield* Deferred.succeed(secondPort, undefined);
      yield* Deferred.fail(firstPort, new Error("private cross-composer detail"));
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(screen.queryByRole("button", { name: "Remove first-composer.png" })).not.toBeInTheDocument()
        )
      );

      expect(screen.getByRole("button", { name: "Remove second-composer.png" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).not.toHaveTextContent("private cross-composer detail");
      expect(revokeObjectUrl.mock.calls).toEqual([["blob:first-composer"]]);

      fireEvent.click(screen.getByRole("button", { name: "Remove second-composer.png" }));
      expect(revokeObjectUrl.mock.calls).toEqual([["blob:first-composer"], ["blob:second-composer"]]);
      view.unmount();
      expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
    })
  );

  it("treats a mention failure notice as a visible typeahead surface even without options", () => {
    const editor = createEditor({ namespace: "typeahead-failure-ownership" });
    const root = document.createElement("div");
    const notice = document.createElement("div");
    notice.setAttribute(TYPEAHEAD_MENU_ATTRIBUTE, editor.getKey());
    document.body.append(root, notice);
    editor.setRootElement(root);

    expect(isTypeaheadMenuVisible(editor)).toBe(true);

    editor.setRootElement(null);
    root.remove();
    notice.remove();
  });

  it.effect(
    "keeps Enter owned by a rejected mention lookup instead of sending",
    Effect.fnUntraced(function* () {
      const onSend = vi.fn(() => true);
      render(
        <ChatComposer
          namespace="rejected-mention-input"
          mentionSource={() => Promise.reject(new Error("lookup unavailable"))}
          mountConfig={{ onSend }}
        >
          <SeedEditor label="Seed rejected mention" text="@ada" />
        </ChatComposer>
      );
      fireEvent.click(screen.getByRole("button", { name: "Seed rejected mention" }));
      yield* Effect.promise(() => screen.findByText("Mentions are unavailable right now."));

      fireEvent.keyDown(screen.getByRole("combobox", { name: "Message composer" }), {
        code: "Enter",
        key: "Enter",
        keyCode: 13,
      });

      expect(onSend).not.toHaveBeenCalled();
      expect(screen.getByText("Mentions are unavailable right now.")).toBeInTheDocument();
    })
  );

  it.effect(
    "isolates one composer's open mention menu from another composer's Enter key",
    Effect.fnUntraced(function* () {
      const firstSend = vi.fn(() => true);
      const secondSend = vi.fn(() => true);
      render(
        <>
          <ChatComposer
            namespace="mention-isolation-first"
            mentionSource={() => [{ id: "first", label: "First" }]}
            mountConfig={{ onSend: firstSend }}
          >
            <SeedEditor label="Seed first mention" text="@f" />
          </ChatComposer>
          <ChatComposer
            namespace="mention-isolation-second"
            mentionSource={() => [{ id: "second", label: "Second" }]}
            mountConfig={{ onSend: secondSend }}
          >
            <SeedEditor label="Seed second message" text="hello" />
          </ChatComposer>
        </>
      );
      fireEvent.click(screen.getByRole("button", { name: "Seed first mention" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /First/u }));
      fireEvent.click(screen.getByRole("button", { name: "Seed second message" }));

      const editors = screen.getAllByRole("combobox", { name: "Message composer" });
      const secondEditor = editors.at(1);
      expect(secondEditor).toBeDefined();
      if (secondEditor === undefined) return;
      fireEvent.keyDown(secondEditor, { code: "Enter", key: "Enter", keyCode: 13 });

      expect(firstSend).not.toHaveBeenCalled();
      expect(secondSend).toHaveBeenCalledTimes(1);
    })
  );

  it("suppresses both modern and legacy IME Enter paths through the mounted composer", () => {
    const onSend = vi.fn(() => true);
    render(
      <ChatComposer namespace="ime-input" mountConfig={{ onSend }}>
        <SeedEditor label="Seed IME message" text="変換" />
      </ChatComposer>
    );
    fireEvent.click(screen.getByRole("button", { name: "Seed IME message" }));
    const editor = screen.getByRole("combobox", { name: "Message composer" });

    fireEvent.keyDown(editor, {
      code: "Enter",
      isComposing: true,
      key: "Enter",
      keyCode: 13,
    });
    fireEvent.keyDown(editor, {
      code: "Enter",
      isComposing: false,
      key: "Enter",
      keyCode: 229,
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it.effect(
    "falls back to the default slash collection when duplicate keys fail runtime decode",
    Effect.fnUntraced(function* () {
      render(
        <ChatComposer
          namespace="duplicate-slash-fallback"
          slashItems={[
            { key: "duplicate", label: "Unsafe first", onSelect: () => undefined },
            { key: "duplicate", label: "Unsafe second", onSelect: () => undefined },
          ]}
        >
          <SeedEditor label="Seed slash trigger" text="/" />
        </ChatComposer>
      );
      fireEvent.click(screen.getByRole("button", { name: "Seed slash trigger" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /^Text/u }));

      expect(screen.queryByText("Unsafe first")).not.toBeInTheDocument();
      expect(screen.queryByText("Unsafe second")).not.toBeInTheDocument();
    })
  );

  it("keeps malformed YouTube ids inert and emits a cancelable typed watch fallback for valid ids", () => {
    const invalid = render(<YouTubeEmbed videoID={'"><script>alert(1)</script>'} />);
    expect(invalid.container.querySelector("iframe")).toBeNull();
    expect(invalid.container.querySelector("a")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Video unavailable");
    invalid.unmount();

    let request: YouTubeWatchRequest | undefined;
    const onWatch = (event: Event): void => {
      if (event instanceof CustomEvent) request = event.detail as YouTubeWatchRequest;
      event.preventDefault();
    };
    const browserFallback = vi.spyOn(window, "open").mockImplementation(() => null);
    window.addEventListener(YOUTUBE_WATCH_EVENT, onWatch);
    const valid = render(<YouTubeEmbed videoID="dQw4w9WgXcQ" />);
    const watchLink = screen.getByRole("link", { name: "Watch on YouTube" });
    expect(watchLink).not.toHaveAttribute("target");
    fireEvent.click(watchLink);
    window.removeEventListener(YOUTUBE_WATCH_EVENT, onWatch);

    expect(request?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(browserFallback).not.toHaveBeenCalled();
    fireEvent.click(watchLink);
    expect(browserFallback).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "_blank",
      "noopener,noreferrer"
    );
    expect(valid.container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
    expect(
      Result.isFailure(
        S.decodeUnknownResult(YouTubeWatchRequest)({
          url: "https://evil.example/?v=dQw4w9WgXcQ",
        })
      )
    ).toBe(true);
  });

  it("round-trips generated composer feature configurations through the production schema", () => {
    fc.assert(
      fc.property(S.toArbitrary(ComposerFeatures), (features) => {
        const encoded = S.encodeSync(ComposerFeatures)(features);
        expect(S.decodeUnknownSync(ComposerFeatures)(encoded)).toEqual(features);
        expect(["enter", "modifierEnter"]).toContain(features.sendOn);
      })
    );
  });

  it("shows incompatible future wire as escaped read-only text", () => {
    const result = LexicalCompatibilityResult.make({
      issues: [],
      state: O.none(),
      wire: {
        root: {
          type: "root",
          version: 9,
          children: [
            {
              type: "future-node",
              version: 9,
              payload: "</pre><script data-owned='no'>alert(1)</script>",
            },
          ],
        },
      },
    });
    const view = render(<EditorCompatibilityViewer result={result} />);

    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.getByTestId("editor-compatibility-fallback")).toHaveTextContent("<script");
    expect(screen.getByTestId("editor-compatibility-fallback")).toHaveAttribute(
      "data-testid",
      "editor-compatibility-fallback"
    );
  });

  it("keeps runtime-incompatible wire out of Lexical load and persistence callbacks", () => {
    const futureWire = {
      root: {
        type: "root",
        version: 9,
        children: [
          {
            type: "future-node",
            version: 9,
            payload: "</pre><script data-runtime-xss='no'>alert(1)</script>",
          },
        ],
      },
    };
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(futureWire))._tag).toBe("Failure");

    const viewer = render(<EditorViewer state={futureWire as never} />);
    expect(viewer.container.querySelector("[contenteditable='true']")).toBeNull();
    expect(viewer.container.querySelector("script")).toBeNull();
    expect(screen.getByTestId("editor-runtime-refusal")).toHaveTextContent("<script");
    viewer.unmount();

    const persisted = vi.fn();
    const sent = vi.fn(() => true);
    const admission = render(<EditorWireComposer input={futureWire} onSerializedChange={persisted} />);
    expect(admission.container.querySelector("[contenteditable='true']")).toBeNull();
    expect(screen.getByTestId("editor-compatibility-fallback")).toHaveTextContent("<script");
    expect(persisted).not.toHaveBeenCalled();
    admission.unmount();

    const composer = render(
      <ChatComposer initialState={futureWire as never} onSerializedChange={persisted} mountConfig={{ onSend: sent }} />
    );
    expect(screen.queryByRole("combobox", { name: "Message composer" })).not.toBeInTheDocument();
    expect(screen.getByTestId("editor-compatibility-fallback")).toHaveTextContent("<script");
    expect(persisted).not.toHaveBeenCalled();
    expect(sent).not.toHaveBeenCalled();
    composer.unmount();
  });

  it.effect(
    "remounts a compatible wire composer when its canonical input changes",
    Effect.fnUntraced(function* () {
      const document = (value: string) =>
        Md.Document.make({
          children: [Md.P.make({ children: [Md.Text.make({ value })] })],
        });
      const first = yield* documentToEditorState(document("first persisted value"));
      const second = yield* documentToEditorState(document("second persisted value"));
      const firstWire = yield* S.encodeEffect(SerializedEditorState)(first);
      const secondWire = yield* S.encodeEffect(SerializedEditorState)(second);
      const view = render(<EditorWireComposer input={firstWire} />);
      const editable = () => view.container.querySelector<HTMLElement>("[contenteditable='true']");

      yield* Effect.promise(() => waitFor(() => expect(editable()).toHaveTextContent("first persisted value")));
      view.rerender(<EditorWireComposer input={secondWire} />);
      yield* Effect.promise(() => waitFor(() => expect(editable()).toHaveTextContent("second persisted value")));
      expect(editable()).not.toHaveTextContent("first persisted value");
    })
  );

  it("keeps raw seed provenance gated after Lexical projects it to safe plain text", () => {
    const rawValue = `<img src=x onerror="alert(1)">`;
    const legacy = Md.Document.make({
      children: [
        Md.BlockQuote.make({
          children: [
            Md.P.make({
              children: [
                Md.Strong.make({
                  children: [Md.RawHtml.make({ value: rawValue })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const lexicalProjection = documentToEditorState(legacy).pipe(Effect.runSync, editorStateToDocument);

    expect(documentSafetyIssues(lexicalProjection)).toEqual([]);
    const gate = O.getOrThrow(prepareComposerDocumentSafetyGate(legacy));
    expect(gate._tag).toBe("RawNormalization");
    if (gate._tag !== "RawNormalization") return;
    expect(gate.preview).toContain(rawValue);
    expect(Result.isSuccess(refineSafeDocument(gate.normalized))).toBe(true);
    expect(legacy.children[0]).toHaveProperty("children.0.children.0.children.0._tag", "rawHtml");
  });

  it("normalizes nested raw nodes to escaped text without approving unsafe URLs", () => {
    const legacy = Md.Document.make({
      children: [
        Md.Table.make({
          children: [
            Md.TableRow.make({
              children: [
                Md.TableCell.make({
                  children: [Md.RawMarkdown.make({ value: "**literal**" })],
                }),
              ],
            }),
          ],
        }),
        Md.P.make({
          children: [
            Md.A.make({
              href: "javascript:alert(1)",
              children: [Md.RawHtml.make({ value: "<script>alert(1)</script>" })],
            }),
          ],
        }),
      ],
    });
    const normalized = normalizeLegacyRawDocument(legacy);

    expect(normalized.children[0]).toHaveProperty("children.0.children.0.children.0._tag", "text");
    expect(documentSafetyIssues(normalized).map((issue) => issue._tag)).toEqual(["UnsafeUrl"]);
    expect(O.getOrThrow(prepareComposerDocumentSafetyGate(legacy))._tag).toBe("UnsafeDocument");
  });

  it("describes invalid scalar text without misleading URL guidance or exposing draft content", () => {
    const privateScalarText = "private\u0000payload";
    const document = Md.Document.make({
      children: [Md.P.make({ children: [Md.Text.make({ value: privateScalarText })] })],
    });
    const gate = O.getOrThrow(prepareComposerDocumentSafetyGate(document));

    expect(gate._tag).toBe("UnsafeDocument");
    expect(gate.message).toMatch(/NUL character or lone UTF-16 surrogate/u);
    expect(gate.message).not.toMatch(/link|URL|private|payload/u);
  });

  it("renders an escaped normalization preview and requires the explicit confirmation button", () => {
    const confirm = vi.fn();
    const source = `</pre><script data-normalization-xss="no">alert(1)</script>`;
    const view = render(
      <ComposerSafetyWarning message="Review the escaped literal copy." preview={source} onConfirm={confirm} />
    );

    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("<script");
    fireEvent.click(screen.getByRole("button", { name: "Send escaped literal copy" }));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it.effect(
    "sends the exact normalized payload through the normal cleanup transaction",
    Effect.fnUntraced(function* () {
      const threadId = WorkspaceIdentity.ThreadId.make(8_081);
      const source = "<strong>send me literally</strong>";
      const legacy = Md.Document.make({
        children: [
          Md.P.make({
            children: [
              Md.RawHtml.make({ value: source }),
              Md.Img.make({
                alt: "Lossy diagram",
                src: "https://example.com/lossy-diagram.png",
              }),
            ],
          }),
        ],
        frontmatter: O.some({ source: "legacy-import" }),
      });
      const normalized = Result.getOrThrow(refineSafeDocument(normalizeLegacyRawDocument(legacy)));
      const lexicalState = yield* documentToEditorState(legacy);
      expect(editorStateToDocument(lexicalState)).not.toEqual(normalized);
      expect(composerDocumentForSend(legacy, lexicalState, O.some(normalized))).toBe(normalized);
      expect(composerDocumentForSend(lexicalState, O.some(normalized))(legacy)).toBe(normalized);
      expect(composerDocumentForSend(legacy, lexicalState, O.none()).frontmatter).toEqual(legacy.frontmatter);
      expect(composerDocumentFromEditorState(legacy, lexicalState).frontmatter).toEqual(legacy.frontmatter);
      expect(composerDocumentFromEditorState(lexicalState)(legacy).frontmatter).toEqual(legacy.frontmatter);

      const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:normalization-attachment");
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      const view = render(
        <RegistryProvider initialValues={[[draftAtoms(threadId), O.some(legacy)]]}>
          <Composer threadId={threadId} />
          <ConfirmationProbe document={legacy} threadId={threadId} />
        </RegistryProvider>
      );

      yield* Effect.promise(() => screen.findAllByText(source));
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();
      fireEvent.change(input!, {
        target: {
          files: [new File(["png"], "legacy.png", { type: "image/png" })],
        },
      });
      yield* Effect.promise(() => screen.findByRole("button", { name: "Remove legacy.png" }));

      fireEvent.click(screen.getByRole("button", { name: "Send escaped literal copy" }));

      yield* Effect.promise(() =>
        waitFor(() => expect(screen.queryByRole("button", { name: "Remove legacy.png" })).not.toBeInTheDocument())
      );
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getByRole("combobox", { name: "Message composer" })).not.toHaveTextContent(source))
      );
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);

      view.unmount();
      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "keeps whitespace-only raw normalization pending instead of dispatching an empty send",
    Effect.fnUntraced(function* () {
      const threadId = WorkspaceIdentity.ThreadId.make(8_082);
      const legacy = Md.Document.make({
        children: [Md.P.make({ children: [Md.RawMarkdown.make({ value: " \t " })] })],
      });
      render(
        <RegistryProvider initialValues={[[draftAtoms(threadId), O.some(legacy)]]}>
          <Composer threadId={threadId} />
          <ConfirmationProbe document={legacy} threadId={threadId} />
        </RegistryProvider>
      );

      yield* Effect.promise(() => screen.findByRole("button", { name: "Send escaped literal copy" }));
      expect(screen.getByTestId("normalization-confirmation")).toHaveTextContent("pending");
      fireEvent.click(screen.getByRole("button", { name: "Send escaped literal copy" }));
      expect(screen.getByTestId("normalization-confirmation")).toHaveTextContent("pending");
      expect(screen.getByRole("button", { name: "Send escaped literal copy" })).toBeInTheDocument();
    })
  );
});
