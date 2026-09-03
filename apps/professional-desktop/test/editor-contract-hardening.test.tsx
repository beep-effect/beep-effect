import {
  attachmentFailureAtom,
  attachmentSweepBindingAtom,
  attachmentsAtom,
  captureAttachmentsFn,
  isTypeaheadMenuVisible,
  onAttachAtom,
  TYPEAHEAD_MENU_ATTRIBUTE,
} from "@beep/editor/chat/atoms";
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
import type { MentionOption, MentionSource } from "@beep/editor/chat/config";
import "@testing-library/jest-dom/vitest";
import { RegistryContext, RegistryProvider, scheduleTask, useAtomSet } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from "lexical";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import {
  composerDocumentSafetyGateAtoms,
  composerSerializedChangeHandlerAtoms,
  prepareComposerDocumentSafetyGate,
} from "@/chat/ui/Composer.atoms";
import { composerDocumentFromEditorState } from "@/chat/ui/ComposerPolicy";
import type { Atom } from "effect/unstable/reactivity";

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

function CaptureRuntimeKeeper(): null {
  useAtomSet(captureAttachmentsFn);
  return null;
}

function CaptureEditorInstance({ capture }: { readonly capture: (editor: ReturnType<typeof createEditor>) => void }) {
  const [editor] = useLexicalComposerContext();
  return (
    <button type="button" aria-label="Capture editor instance" onClick={() => capture(editor)}>
      Capture editor
    </button>
  );
}

const makeControlledScheduler = () => {
  const pending = new Set<() => void>();
  const schedule = (task: () => void): (() => void) => {
    const run = () => {
      pending.delete(run);
      task();
    };
    pending.add(run);
    return () => {
      pending.delete(run);
    };
  };
  const flush = (): void => {
    for (const task of pending) task();
  };
  return { flush, schedule };
};

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

  it("does not advertise a combobox when no typeahead plugin can mount", () => {
    render(
      <ChatComposer namespace="typeahead-unavailable" mountConfig={{ features: { mentions: true, slash: false } }} />
    );

    const editor = screen.getByRole("textbox", { name: "Message composer" });
    expect(editor).not.toHaveAttribute("aria-expanded");
    expect(editor).not.toHaveAttribute("aria-controls");
    expect(editor).not.toHaveAttribute("aria-activedescendant");
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
        if (filename === "first.png") return firstPort.pipe(Deferred.await, runPromise);
        if (filename === "second.png") {
          return secondPort.pipe(Deferred.await, runPromise).then(() => {
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
    "aborts a pending attachment port on unmount without double-revoking or writing a late failure",
    Effect.fnUntraced(function* () {
      const port = yield* Deferred.make<void, Error>();
      const context = yield* Effect.context<never>();
      const runPromise = Effect.runPromiseWith(context);
      const runSync = Effect.runSyncWith(context);
      const registry = AtomRegistry.make({
        defaultIdleTTL: 20,
        scheduleTask,
        timeoutResolution: 1,
      });
      let editor: ReturnType<typeof createEditor> | undefined;
      const firstRevoke = yield* Deferred.make<void>();
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pending-unmount");
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
        runSync(Deferred.succeed(firstRevoke, undefined));
      });
      const onAttach = vi.fn(() => port.pipe(Deferred.await, runPromise));
      const mounted = (showComposer: boolean) => (
        <RegistryContext.Provider value={registry}>
          <CaptureRuntimeKeeper />
          {showComposer ? (
            <ChatComposer mountConfig={{ onAttach }}>
              <CaptureEditorInstance capture={(value) => (editor = value)} />
            </ChatComposer>
          ) : null}
        </RegistryContext.Provider>
      );
      const view = render(mounted(true));
      fireEvent.click(screen.getByRole("button", { name: "Capture editor instance" }));
      const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();

      fireEvent.change(input!, {
        target: {
          files: [new File(["pending"], "pending.png", { type: "image/png" })],
        },
      });
      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1)));
      yield* Effect.promise(() =>
        waitFor(() => expect(AsyncResult.isWaiting(registry.get(captureAttachmentsFn))).toBe(true))
      );

      view.rerender(mounted(false));
      yield* Deferred.fail(port, new Error("private post-unmount detail"));
      yield* Deferred.await(firstRevoke);
      yield* Effect.promise(() =>
        waitFor(() => expect(AsyncResult.isSuccess(registry.get(captureAttachmentsFn))).toBe(true))
      );

      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
      expect(editor).toBeDefined();
      if (editor !== undefined) {
        expect(registry.get(attachmentsAtom(editor))).toEqual([]);
        expect(O.isNone(registry.get(attachmentFailureAtom(editor)))).toBe(true);
      }

      view.unmount();
      registry.dispose();
      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "disposes a captured batch without reading or writing the registry from async teardown",
    Effect.fnUntraced(function* () {
      const editor = createEditor({ namespace: "attachment-disposal-boundary" });
      const onAttach = vi.fn();
      const registry = AtomRegistry.make({
        defaultIdleTTL: 20,
        initialValues: [[onAttachAtom(editor), onAttach]],
        scheduleTask,
        timeoutResolution: 1,
      });
      const attachmentSizes: Array<number> = [];
      let disposed = false;
      let postDisposeGets = 0;
      let disposeSets = 0;
      const originalGet = registry.get.bind(registry);
      const originalSet = registry.set.bind(registry);
      Object.defineProperty(registry, "get", {
        configurable: true,
        value: <A,>(atom: Atom.Atom<A>): A => {
          if (disposed) postDisposeGets += 1;
          return originalGet(atom);
        },
      });
      Object.defineProperty(registry, "set", {
        configurable: true,
        value: <R, W>(atom: Atom.Writable<R, W>, value: W): void => {
          if (disposed) disposeSets += 1;
          originalSet(atom, value);
        },
      });
      vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
        queueMicrotask(() => {
          disposed = true;
          registry.dispose();
        });
        return "blob:dispose-before-port";
      });
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

      registry.mount(captureAttachmentsFn);
      registry.mount(onAttachAtom(editor));
      editor.setRootElement(document.createElement("div"));
      registry.mount(attachmentSweepBindingAtom(editor));
      registry.subscribe(
        attachmentsAtom(editor),
        (attachments) => {
          attachmentSizes.push(attachments.length);
        },
        { immediate: false }
      );
      registry.set(captureAttachmentsFn, {
        editor,
        files: [new File(["pending"], "dispose-before-port.png", { type: "image/png" })],
      });

      yield* Effect.callback<void>((resume) => {
        queueMicrotask(() => queueMicrotask(() => resume(Effect.void)));
      });

      expect(onAttach).not.toHaveBeenCalled();
      expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith("blob:dispose-before-port");
      expect(attachmentSizes).toEqual([1]);
      expect(postDisposeGets).toBe(0);
      expect(disposeSets).toBe(0);
    })
  );

  it.effect(
    "isolates a pending capture from a same-editor remount before scheduled atom removal",
    Effect.fnUntraced(function* () {
      const port = yield* Deferred.make<void, Error>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const scheduler = makeControlledScheduler();
      const editor = createEditor({ namespace: "attachment-rapid-remount" });
      const onAttach = vi.fn((files: ReadonlyArray<File>): void | Promise<void> =>
        files[0]?.name === "rapid-remount.png" ? port.pipe(Deferred.await, runPromise) : undefined
      );
      const registry = AtomRegistry.make({
        defaultIdleTTL: 20,
        initialValues: [[onAttachAtom(editor), onAttach]],
        scheduleTask: scheduler.schedule,
        timeoutResolution: 1,
      });
      const createObjectUrl = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValueOnce("blob:rapid-remount")
        .mockReturnValueOnce("blob:new-mount");
      const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
      registry.mount(captureAttachmentsFn);
      registry.mount(onAttachAtom(editor));
      const binding = attachmentSweepBindingAtom(editor);
      editor.setRootElement(document.createElement("div"));
      const releaseFirstMount = registry.mount(binding);
      registry.set(captureAttachmentsFn, {
        editor,
        files: [new File(["pending"], "rapid-remount.png", { type: "image/png" })],
      });
      scheduler.flush();
      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1)));

      editor.setRootElement(null);
      releaseFirstMount();
      expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith("blob:rapid-remount");
      expect(registry.get(attachmentsAtom(editor))).toEqual([]);

      // No lifecycle exists between the null transition and the remount, so an
      // event captured in that window is rejected before minting an object URL.
      registry.set(captureAttachmentsFn, {
        editor,
        files: [new File(["orphan"], "orphan.png", { type: "image/png" })],
      });

      editor.setRootElement(document.createElement("div"));
      const releaseSecondMount = registry.mount(binding);
      scheduler.flush();
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      registry.set(captureAttachmentsFn, {
        editor,
        files: [new File(["new"], "new-mount.png", { type: "image/png" })],
      });
      scheduler.flush();
      yield* Effect.promise(() => waitFor(() => expect(onAttach).toHaveBeenCalledTimes(2)));
      yield* Effect.promise(() =>
        waitFor(() => expect(registry.get(attachmentsAtom(editor))[0]?.file.name).toBe("new-mount.png"))
      );

      yield* Deferred.fail(port, new Error("private prior-mount detail"));
      scheduler.flush();
      yield* Effect.promise(() =>
        waitFor(() => expect(AsyncResult.isSuccess(registry.get(captureAttachmentsFn))).toBe(true))
      );

      expect(O.isNone(registry.get(attachmentFailureAtom(editor)))).toBe(true);
      expect(registry.get(attachmentsAtom(editor))[0]?.file.name).toBe("new-mount.png");
      expect(revokeObjectUrl).toHaveBeenCalledTimes(1);

      editor.setRootElement(null);
      releaseSecondMount();
      scheduler.flush();
      registry.dispose();
      expect(revokeObjectUrl.mock.calls).toEqual([["blob:rapid-remount"], ["blob:new-mount"]]);
    })
  );

  it.effect(
    "does not let one composer's pending attachment port interrupt another composer",
    Effect.fnUntraced(function* () {
      const firstPort = yield* Deferred.make<void, Error>();
      const secondPort = yield* Deferred.make<void>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const firstAttach = vi.fn(() => firstPort.pipe(Deferred.await, runPromise));
      const secondAttach = vi.fn(() => secondPort.pipe(Deferred.await, runPromise));
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
      const failureStatus = yield* Effect.promise(() => screen.findByRole("status"));
      expect(failureStatus).toHaveTextContent("Mentions are unavailable right now.");

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
    "keeps a pending mention lookup visible and owns Enter until it settles",
    Effect.fnUntraced(function* () {
      const lookup = yield* Deferred.make<ReadonlyArray<MentionOption>>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const source = vi.fn<MentionSource>(() => lookup.pipe(Deferred.await, runPromise));
      const onSend = vi.fn(() => true);
      render(
        <ChatComposer namespace="pending-mention-input" mentionSource={source} mountConfig={{ onSend }}>
          <SeedEditor label="Seed pending mention" text="@pending" />
        </ChatComposer>
      );

      fireEvent.click(screen.getByRole("button", { name: "Seed pending mention" }));
      yield* Effect.promise(() => screen.findByText("Looking up mentions..."));

      const editor = screen.getByRole("combobox", { name: "Message composer" });
      const controls = editor.getAttribute("aria-controls");
      expect(editor).toHaveAttribute("aria-expanded", "true");
      expect(controls).toMatch(/^typeahead-menu-/u);
      const listbox = controls === null ? null : document.getElementById(controls);
      expect(listbox).toHaveAttribute("role", "listbox");
      if (listbox === null) return;
      const noticeOption = listbox.querySelector('[role="option"]');
      const noticeStatus = screen.getByRole("status");
      expect(noticeOption?.parentElement).toBe(listbox);
      expect(noticeOption).toHaveAttribute("aria-disabled", "true");
      expect(noticeOption).toHaveAccessibleName("Looking up mentions...");
      expect(noticeStatus).toHaveTextContent("Looking up mentions...");
      expect(listbox).not.toContainElement(noticeStatus);

      fireEvent.keyDown(editor, { code: "Enter", key: "Enter", keyCode: 13 });
      expect(onSend).not.toHaveBeenCalled();

      yield* Deferred.succeed(lookup, [{ id: "settled", label: "Settled" }]);
    })
  );

  it.effect(
    "maps synchronous throws and invalid duplicate mention ids to safe failure feedback",
    Effect.fnUntraced(function* () {
      const synchronousSend = vi.fn(() => true);
      const duplicateSend = vi.fn(() => true);
      const duplicateSource = (() => [
        { id: "duplicate", label: "First" },
        { id: "duplicate", label: "Second" },
      ]) as MentionSource;
      render(
        <>
          <ChatComposer
            namespace="throwing-mention-input"
            mentionSource={() => {
              throw new Error("private synchronous lookup detail");
            }}
            mountConfig={{ onSend: synchronousSend }}
          >
            <SeedEditor label="Seed throwing mention" text="@throw" />
          </ChatComposer>
          <ChatComposer
            namespace="invalid-mention-input"
            mentionSource={duplicateSource}
            mountConfig={{ onSend: duplicateSend }}
          >
            <SeedEditor label="Seed invalid mention" text="@duplicate" />
          </ChatComposer>
        </>
      );

      fireEvent.click(screen.getByRole("button", { name: "Seed throwing mention" }));
      yield* Effect.promise(() => screen.findByText("Mentions are unavailable right now."));
      fireEvent.click(screen.getByRole("button", { name: "Seed invalid mention" }));
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getAllByText("Mentions are unavailable right now.")).toHaveLength(2))
      );

      expect(document.body).not.toHaveTextContent("private synchronous lookup detail");
      for (const editor of screen.getAllByRole("combobox", { name: "Message composer" })) {
        fireEvent.keyDown(editor, { code: "Enter", key: "Enter", keyCode: 13 });
      }
      expect(synchronousSend).not.toHaveBeenCalled();
      expect(duplicateSend).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "keeps only the latest out-of-order mention response",
    Effect.fnUntraced(function* () {
      const firstLookup = yield* Deferred.make<ReadonlyArray<MentionOption>>();
      const secondLookup = yield* Deferred.make<ReadonlyArray<MentionOption>>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const source = vi.fn<MentionSource>((query) =>
        (query === "ab" ? secondLookup : firstLookup).pipe(Deferred.await, runPromise)
      );
      render(
        <ChatComposer namespace="mention-latest-wins" mentionSource={source}>
          <SeedEditor label="Seed first lookup" text="@a" />
          <SeedEditor label="Seed second lookup" text="@ab" />
        </ChatComposer>
      );

      fireEvent.click(screen.getByRole("button", { name: "Seed first lookup" }));
      yield* Effect.promise(() => waitFor(() => expect(source).toHaveBeenCalledWith("a")));
      fireEvent.click(screen.getByRole("button", { name: "Seed second lookup" }));
      yield* Effect.promise(() => waitFor(() => expect(source).toHaveBeenCalledWith("ab")));

      yield* Deferred.succeed(secondLookup, [{ id: "latest", label: "Latest" }]);
      yield* Effect.promise(() => screen.findByRole("option", { name: /Latest/u }));
      yield* Deferred.succeed(firstLookup, [{ id: "stale", label: "Stale" }]);
      yield* Effect.promise(() =>
        waitFor(() => {
          expect(screen.getByRole("option", { name: /Latest/u })).toBeInTheDocument();
          expect(screen.queryByRole("option", { name: /Stale/u })).not.toBeInTheDocument();
        })
      );
    })
  );

  it.effect(
    "interrupts a pending mention lookup and releases DOM listeners immediately under the production idle TTL",
    Effect.fnUntraced(function* () {
      const lookup = yield* Deferred.make<ReadonlyArray<MentionOption>>();
      const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());
      const scheduler = makeControlledScheduler();
      const source = vi.fn<MentionSource>(() => lookup.pipe(Deferred.await, runPromise));
      const decodedAfterUnmount = vi.fn(() => "late");
      const disconnectObserver = vi.spyOn(MutationObserver.prototype, "disconnect");
      const removeWindowListener = vi.spyOn(window, "removeEventListener");
      const view = render(
        <RegistryProvider defaultIdleTTL={30_000} scheduleTask={scheduler.schedule}>
          <ChatComposer namespace="mention-unmount-interruption" mentionSource={source}>
            <SeedEditor label="Seed pending lookup" text="@pending" />
          </ChatComposer>
        </RegistryProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Seed pending lookup" }));
      act(() => scheduler.flush());
      yield* Effect.promise(() => waitFor(() => expect(source).toHaveBeenCalledTimes(1)));
      yield* Effect.promise(() => screen.findByText("Looking up mentions..."));
      const editorRoot = screen.getByRole("combobox");
      editorRoot.setAttribute("aria-activedescendant", "lexical-stale-option");
      disconnectObserver.mockClear();
      removeWindowListener.mockClear();
      view.rerender(
        <RegistryProvider defaultIdleTTL={30_000} scheduleTask={scheduler.schedule}>
          <div />
        </RegistryProvider>
      );
      yield* Effect.promise(() => waitFor(() => expect(disconnectObserver).toHaveBeenCalled()));
      act(() => scheduler.flush());
      expect(editorRoot).not.toHaveAttribute("aria-activedescendant");
      expect(removeWindowListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
        expect.objectContaining({ capture: true, passive: true })
      );
      expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));

      yield* Deferred.succeed(lookup, [
        {
          get id() {
            return decodedAfterUnmount();
          },
          label: "Late",
        },
      ]);
      yield* Effect.promise(() => Promise.resolve());
      yield* Effect.yieldNow;

      expect(screen.queryByText("Mentions are unavailable right now.")).not.toBeInTheDocument();
      expect(decodedAfterUnmount).not.toHaveBeenCalled();
      view.unmount();
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

  it.effect(
    "scopes concurrent typeahead listbox ids and aria-controls to each composer",
    Effect.fnUntraced(function* () {
      render(
        <>
          <ChatComposer
            namespace="mention-aria-first"
            mentionSource={() => [{ id: "first", label: "First scoped option" }]}
          >
            <SeedEditor label="Seed first scoped mention" text="@first" />
          </ChatComposer>
          <ChatComposer
            namespace="mention-aria-second"
            mentionSource={() => [{ id: "second", label: "Second scoped option" }]}
          >
            <SeedEditor label="Seed second scoped mention" text="@second" />
          </ChatComposer>
        </>
      );

      fireEvent.click(screen.getByRole("button", { name: "Seed first scoped mention" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /First scoped option/u }));
      fireEvent.click(screen.getByRole("button", { name: "Seed second scoped mention" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /Second scoped option/u }));

      const editors = screen.getAllByRole("combobox", { name: "Message composer" });
      const firstEditor = editors.at(0);
      const secondEditor = editors.at(1);
      expect(firstEditor).toBeDefined();
      expect(secondEditor).toBeDefined();
      if (firstEditor === undefined || secondEditor === undefined) return;
      const firstControls = firstEditor.getAttribute("aria-controls");
      const secondControls = secondEditor.getAttribute("aria-controls");
      expect(firstControls).toMatch(/^typeahead-menu-/u);
      expect(secondControls).toMatch(/^typeahead-menu-/u);
      expect(firstControls).not.toBe(secondControls);

      const firstListbox = firstControls === null ? null : document.getElementById(firstControls);
      const secondListbox = secondControls === null ? null : document.getElementById(secondControls);
      expect(firstListbox).toHaveAttribute("role", "listbox");
      expect(firstListbox).toHaveTextContent("First scoped option");
      expect(firstListbox).not.toHaveTextContent("Second scoped option");
      expect(secondListbox).toHaveAttribute("role", "listbox");
      expect(secondListbox).toHaveTextContent("Second scoped option");
      expect(secondListbox).not.toHaveTextContent("First scoped option");

      yield* Effect.promise(() =>
        waitFor(() => {
          const firstActive = firstEditor.getAttribute("aria-activedescendant");
          const secondActive = secondEditor.getAttribute("aria-activedescendant");
          expect(firstActive).toMatch(/^typeahead-item-/u);
          expect(secondActive).toMatch(/^typeahead-item-/u);
          expect(firstListbox).toContainElement(firstActive === null ? null : document.getElementById(firstActive));
          expect(secondListbox).toContainElement(secondActive === null ? null : document.getElementById(secondActive));
        })
      );

      const firstActive = firstEditor.getAttribute("aria-activedescendant");
      const secondActive = secondEditor.getAttribute("aria-activedescendant");
      expect(firstActive).not.toBeNull();
      expect(secondActive).not.toBeNull();
      if (firstActive === null || secondActive === null) return;
      fireEvent.keyDown(firstEditor, { code: "ArrowDown", key: "ArrowDown", keyCode: 40 });
      fireEvent.keyDown(secondEditor, { code: "ArrowUp", key: "ArrowUp", keyCode: 38 });
      yield* Effect.promise(() =>
        waitFor(() => {
          expect(firstEditor).toHaveAttribute("aria-activedescendant", firstActive);
          expect(secondEditor).toHaveAttribute("aria-activedescendant", secondActive);
        })
      );
    })
  );

  it.effect(
    "collapses a vanished popup and restores only its composer's ARIA relations when it reappears",
    Effect.fnUntraced(function* () {
      render(
        <>
          <ChatComposer
            namespace="mention-aria-recovery-first"
            mentionSource={() => [{ id: "first", label: "First recovery option" }]}
          >
            <SeedEditor label="Seed first recovery mention" text="@first" />
          </ChatComposer>
          <ChatComposer
            namespace="mention-aria-recovery-second"
            mentionSource={() => [{ id: "second", label: "Second recovery option" }]}
          >
            <SeedEditor label="Seed second recovery mention" text="@second" />
          </ChatComposer>
        </>
      );

      fireEvent.click(screen.getByRole("button", { name: "Seed first recovery mention" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /First recovery option/u }));
      fireEvent.click(screen.getByRole("button", { name: "Seed second recovery mention" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /Second recovery option/u }));

      const editors = screen.getAllByRole("combobox", { name: "Message composer" });
      const firstEditor = editors.at(0);
      const secondEditor = editors.at(1);
      expect(firstEditor).toBeDefined();
      expect(secondEditor).toBeDefined();
      if (firstEditor === undefined || secondEditor === undefined) return;

      const firstControls = firstEditor.getAttribute("aria-controls");
      const secondControls = secondEditor.getAttribute("aria-controls");
      expect(firstControls).not.toBeNull();
      expect(secondControls).not.toBeNull();
      if (firstControls === null || secondControls === null) return;

      const firstListbox = document.getElementById(firstControls);
      const firstMarker = firstListbox?.querySelector<HTMLElement>(`[${TYPEAHEAD_MENU_ATTRIBUTE}]`);
      expect(firstListbox).toHaveAttribute("role", "listbox");
      expect(firstMarker).toBeInTheDocument();
      if (firstListbox === null || firstMarker === null || firstMarker === undefined) return;

      firstMarker.remove();
      yield* Effect.promise(() =>
        waitFor(() => {
          expect(firstEditor).toHaveAttribute("aria-expanded", "false");
          expect(firstEditor).not.toHaveAttribute("aria-controls");
          expect(firstEditor).not.toHaveAttribute("aria-activedescendant");
          expect(secondEditor).toHaveAttribute("aria-expanded", "true");
          expect(secondEditor).toHaveAttribute("aria-controls", secondControls);
        })
      );

      firstListbox.append(firstMarker);
      yield* Effect.promise(() =>
        waitFor(() => {
          expect(firstEditor).toHaveAttribute("aria-expanded", "true");
          expect(firstEditor).toHaveAttribute("aria-controls", firstControls);
          const active = firstEditor.getAttribute("aria-activedescendant");
          expect(firstListbox).toContainElement(active === null ? null : document.getElementById(active));
          expect(secondEditor).toHaveAttribute("aria-expanded", "true");
          expect(secondEditor).toHaveAttribute("aria-controls", secondControls);
        })
      );
    })
  );

  it.effect.each([
    ["modern", { code: "Enter", isComposing: true, key: "Enter", keyCode: 13 }],
    ["legacy", { code: "Enter", isComposing: false, key: "Enter", keyCode: 229 }],
  ] as const)(
    "keeps %s IME Enter from selecting a visible mention option",
    Effect.fnUntraced(function* (signal, event) {
      const onSend = vi.fn(() => true);
      render(
        <ChatComposer
          namespace={`ime-open-mention-${signal}`}
          mentionSource={() => [{ id: "first", label: "First" }]}
          mountConfig={{ onSend }}
        >
          <SeedEditor label={`Seed ${signal} composed mention`} text="@f" />
        </ChatComposer>
      );
      fireEvent.click(screen.getByRole("button", { name: `Seed ${signal} composed mention` }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /First/u }));
      const editor = screen.getByRole("combobox", { name: "Message composer" });

      fireEvent.keyDown(editor, event);

      yield* Effect.promise(() =>
        waitFor(() => {
          expect(screen.getByRole("option", { name: /First/u })).toBeInTheDocument();
          expect(editor).toHaveTextContent("@f");
        })
      );
      expect(onSend).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "still selects a visible mention option on ordinary Enter",
    Effect.fnUntraced(function* () {
      const onSend = vi.fn(() => true);
      render(
        <ChatComposer
          namespace="ordinary-enter-open-mention"
          mentionSource={() => [{ id: "first", label: "First" }]}
          mountConfig={{ onSend }}
        >
          <SeedEditor label="Seed ordinary mention" text="@f" />
        </ChatComposer>
      );
      fireEvent.click(screen.getByRole("button", { name: "Seed ordinary mention" }));
      yield* Effect.promise(() => screen.findByRole("option", { name: /First/u }));
      const editor = screen.getByRole("combobox", { name: "Message composer" });

      fireEvent.keyDown(editor, { code: "Enter", key: "Enter", keyCode: 13 });

      yield* Effect.promise(() => waitFor(() => expect(editor).toHaveTextContent("@First")));
      expect(screen.queryByRole("option", { name: /First/u })).not.toBeInTheDocument();
      expect(onSend).not.toHaveBeenCalled();
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
    const valid = render(<YouTubeEmbed videoID="M7lc1UVf-VE" />);
    const watchLink = screen.getByRole("link", { name: "Watch on YouTube" });
    expect(watchLink).not.toHaveAttribute("target");
    fireEvent.click(watchLink);
    window.removeEventListener(YOUTUBE_WATCH_EVENT, onWatch);

    expect(request?.url).toBe("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(browserFallback).not.toHaveBeenCalled();
    fireEvent.click(watchLink);
    expect(browserFallback).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      "_blank",
      "noopener,noreferrer"
    );
    expect(valid.container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE"
    );
    expect(
      Result.isFailure(
        S.decodeResult(YouTubeWatchRequest)({
          url: "https://evil.example/?v=M7lc1UVf-VE",
        })
      )
    ).toBe(true);
  });

  it("round-trips generated composer feature configurations through the production schema", () => {
    fc.assert(
      fc.property(S.toArbitrary(ComposerFeatures)(fc), (features) => {
        const encoded = S.encodeSync(ComposerFeatures)(features);
        expect(S.decodeSync(ComposerFeatures)(encoded)).toEqual(features);
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

  it("keeps an empty persisted root inert and disables editing, persistence, and sending", () => {
    const emptyWire = {
      root: {
        type: "root",
        version: 1,
        children: [],
      },
    };
    const persisted = vi.fn();
    const sent = vi.fn(() => true);

    expect(Effect.runSyncExit(decodeEditorStateForRuntime(emptyWire))._tag).toBe("Failure");

    const admission = render(<EditorWireComposer input={emptyWire} onSerializedChange={persisted} />);
    expect(admission.container.querySelector("[contenteditable='true']")).toBeNull();
    expect(screen.getByTestId("editor-compatibility-fallback")).toHaveTextContent('"children":[]');
    expect(persisted).not.toHaveBeenCalled();
    admission.unmount();

    const composer = render(
      <ChatComposer initialState={emptyWire as never} onSerializedChange={persisted} mountConfig={{ onSend: sent }} />
    );
    expect(screen.queryByRole("combobox", { name: "Message composer" })).not.toBeInTheDocument();
    expect(screen.getByTestId("editor-compatibility-fallback")).toHaveTextContent('"children":[]');
    expect(persisted).not.toHaveBeenCalled();
    expect(sent).not.toHaveBeenCalled();
    composer.unmount();
  });

  it.effect(
    "admits a safe nested-link document as an editable composer seed",
    Effect.fnUntraced(function* () {
      const content = Md.Document.make({
        children: [
          Md.P.make({
            children: [
              Md.A.make({
                href: "https://outer.example",
                children: [
                  Md.A.make({
                    href: "https://inner.example",
                    children: [Md.Strong.make({ children: [Md.Text.make({ value: "inner " })] })],
                  }),
                  Md.Img.make({ src: "https://example.com/diagram.png", alt: "diagram" }),
                ],
              }),
            ],
          }),
        ],
      });

      expect(Result.isSuccess(refineSafeDocument(content))).toBe(true);
      const initialState = yield* documentToEditorState(content);
      const view = render(<ChatComposer namespace="safe-nested-link-seed" initialState={initialState} />);
      const editor = yield* Effect.promise(() => view.findByRole("combobox", { name: "Message composer" }));

      expect(editor).toHaveTextContent("inner diagram");
      expect(view.queryByTestId("editor-compatibility-fallback")).not.toBeInTheDocument();
      view.unmount();
    })
  );

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
    expect(gate.issueCount).toBe(1);
    expect(gate.message).toMatch(/trusted raw Markdown or HTML/u);
    expect(legacy.children[0]).toHaveProperty("children.0.children.0.children.0._tag", "rawHtml");
  });

  it.effect(
    "clears a corrected safety refusal once the draft is edited safe",
    Effect.fnUntraced(function* () {
      const threadId = WorkspaceIdentity.ThreadId.make(8_104);
      const unsafe = Md.Document.make({
        children: [
          Md.P.make({
            children: [Md.A.make({ href: "javascript:alert(1)", children: [Md.Text.make({ value: "unsafe link" })] })],
          }),
        ],
      });
      const corrected = Md.Document.make({
        children: [
          Md.P.make({
            children: [Md.A.make({ href: "https://example.com", children: [Md.Text.make({ value: "safe link" })] })],
          }),
        ],
      });
      const registry = AtomRegistry.make({ defaultIdleTTL: 30_000 });
      const gateAtom = composerDocumentSafetyGateAtoms(threadId)(unsafe);
      const changeHandlerAtom = composerSerializedChangeHandlerAtoms(threadId)(unsafe);
      registry.mount(gateAtom);
      registry.mount(changeHandlerAtom);

      const initialGate = O.getOrThrow(registry.get(gateAtom));
      expect(initialGate.message).toMatch(/link or embedded URL outside the safe destination policy/u);

      registry.get(changeHandlerAtom)(yield* documentToEditorState(corrected));
      yield* Effect.promise(() => waitFor(() => expect(O.isNone(registry.get(gateAtom))).toBe(true)));
      registry.dispose();
    })
  );

  it("describes invalid scalar text without misleading URL guidance or exposing draft content", () => {
    const privateScalarText = "private\u0000payload";
    const document = Md.Document.make({
      children: [Md.P.make({ children: [Md.Text.make({ value: privateScalarText })] })],
    });
    const gate = O.getOrThrow(prepareComposerDocumentSafetyGate(document));

    expect(gate.message).toMatch(/NUL character or lone UTF-16 surrogate/u);
    expect(gate.message).not.toMatch(/link|URL|private|payload/u);
  });

  it("describes duplicate footnote definitions without exposing their content", () => {
    const identifier = Md.FootnoteIdentifier.make("duplicate");
    const footnote = (value: string) =>
      Md.FootnoteDefinition.make({
        identifier,
        children: [Md.P.make({ children: [Md.Text.make({ value })] })],
      });
    const document = Md.Document.make({ children: [footnote("private first"), footnote("private second")] });
    const gate = O.getOrThrow(prepareComposerDocumentSafetyGate(document));

    expect(gate.message).toMatch(/duplicate footnote definitions/u);
    expect(gate.message).not.toMatch(/private|first|second/u);
  });

  it("describes document structures that cannot render as conformant HTML", () => {
    const document = Md.Document.make({
      children: [Md.Heading.make({ level: 2, children: [] }), Md.Heading.make({ level: 5, children: [] })],
    });
    const gate = O.getOrThrow(prepareComposerDocumentSafetyGate(document));

    expect(gate.issueCount).toBe(1);
    expect(gate.message).toMatch(/document structure that cannot be rendered as conformant HTML/u);
  });

  it.effect(
    "preserves persistence-owned seed frontmatter through the editor projection",
    Effect.fnUntraced(function* () {
      const seed = Md.Document.make({
        children: [Md.P.make({ children: [Md.Text.make({ value: "persisted draft" })] })],
        frontmatter: O.some({ source: "legacy-import" }),
      });
      const lexicalState = yield* documentToEditorState(seed);

      expect(composerDocumentFromEditorState(seed, lexicalState).frontmatter).toEqual(seed.frontmatter);
      expect(composerDocumentFromEditorState(lexicalState)(seed).frontmatter).toEqual(seed.frontmatter);
    })
  );
});
