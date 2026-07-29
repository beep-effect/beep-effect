import { ChatComposer as RootChatComposer, EditorViewer as RootEditorViewer } from "@beep/editor";
import { ChatComposer as ChatFacadeComposer } from "@beep/editor/chat";
import { EditorWireComposer } from "@beep/editor/composer";
import { EditorWireViewer } from "@beep/editor/viewer";
import { describe, expect, it } from "tstyche";
import type { ChatComposer, ChatComposerProps } from "@beep/editor/chat/chat-composer";
import type { EditorWireComposerProps } from "@beep/editor/composer";
import type { EditorViewer, EditorViewerProps, EditorWireViewerProps } from "@beep/editor/viewer";

describe("@beep/editor package boundaries", () => {
  it("keeps compatibility aliases type-identical to exact subpath exports", () => {
    expect(RootEditorViewer).type.toBe<typeof EditorViewer>();
    expect(RootChatComposer).type.toBe<typeof ChatComposer>();
    expect(ChatFacadeComposer).type.toBe<typeof ChatComposer>();
  });

  it("separates decoded-state props from unknown-wire admission props", () => {
    expect<EditorViewerProps["state"]>().type.not.toBe<unknown>();
    expect<EditorWireViewerProps["input"]>().type.toBe<unknown>();
    expect<EditorWireComposerProps["input"]>().type.toBe<unknown>();
    expect(EditorWireViewer).type.toBeCallableWith({ input: { future: true } });
    expect(EditorWireComposer).type.toBeCallableWith({ input: { future: true } });
  });

  it("exposes immutable chat ports through mountConfig", () => {
    expect<NonNullable<ChatComposerProps["mountConfig"]>["onSend"]>().type.toBeAssignableTo<
      ((state: EditorViewerProps["state"]) => boolean | void) | undefined
    >();
  });
});
