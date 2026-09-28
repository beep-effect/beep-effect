import { decodeEditorStateForRuntime, decodeEditorStateForRuntimeResult } from "@beep/editor/runtime";
import { TextDetailMask, TextFormatMask, TextNode } from "@beep/lexical-schema/Lexical.model";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";

const validWire = {
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

const emptyWire = {
  root: {
    ...validWire.root,
    children: [],
  },
};

const decodedValidState = (): SerializedEditorState => Result.getOrThrow(decodeEditorStateForRuntimeResult(validWire));

const appendRootChild = (state: SerializedEditorState, child: unknown): void => {
  Reflect.set(state.root.children, state.root.children.length, child);
};

describe("@beep/editor runtime admission", () => {
  it("admits valid raw wire and untouched schema-decoded state", () => {
    const decoded = decodedValidState();

    pipe(decodeEditorStateForRuntimeResult(validWire), Result.isSuccess, assertTrue);
    pipe(decodeEditorStateForRuntimeResult(decoded), Result.isSuccess, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Success");
  });

  it("rejects an empty root that Lexical cannot apply at runtime", () => {
    pipe(decodeEditorStateForRuntimeResult(emptyWire), Result.isFailure, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(emptyWire))._tag).toBe("Failure");
  });

  it("deeply rejects a decoded state mutated with a null child", () => {
    const decoded = decodedValidState();
    appendRootChild(decoded, null);

    pipe(decodeEditorStateForRuntimeResult(decoded), Result.isFailure, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });

  it("deeply rejects a decoded state mutated with an unknown future node", () => {
    const decoded = decodedValidState();
    appendRootChild(decoded, {
      pluginData: { enabled: true },
      type: "future-node",
      version: 2,
    });

    pipe(decodeEditorStateForRuntimeResult(decoded), Result.isFailure, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });

  it("deeply rejects a decoded state mutated with a misplaced semantic text node", () => {
    const decoded = decodedValidState();
    appendRootChild(
      decoded,
      TextNode.make({
        detail: TextDetailMask.make(0),
        format: TextFormatMask.make(0),
        mode: "normal",
        style: "",
        text: "not a root block",
      })
    );

    pipe(decodeEditorStateForRuntimeResult(decoded), Result.isFailure, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });

  it("rejects non-JSON NodeState before runtime or persistence", () => {
    const raw = {
      root: {
        ...validWire.root,
        children: [{ ...validWire.root.children[0], $: { plugin: () => true } }],
      },
    };
    const decoded = decodedValidState();
    const paragraph = O.getOrThrow(A.head(decoded.root.children));
    Reflect.set(paragraph, "$", O.some({ plugin: 1n }));

    pipe(decodeEditorStateForRuntimeResult(raw), Result.isFailure, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(raw))._tag).toBe("Failure");
    pipe(decodeEditorStateForRuntimeResult(decoded), Result.isFailure, assertTrue);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });
});
