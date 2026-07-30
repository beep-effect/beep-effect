import { decodeEditorStateForRuntime, decodeEditorStateForRuntimeResult } from "@beep/editor/runtime";
import { TextDetailMask, TextFormatMask, TextNode } from "@beep/lexical-schema/Lexical.model";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";

const emptyWire = {
  root: {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

const decodedEmptyState = (): SerializedEditorState => Result.getOrThrow(decodeEditorStateForRuntimeResult(emptyWire));

const appendRootChild = (state: SerializedEditorState, child: unknown): void => {
  Reflect.set(state.root.children, state.root.children.length, child);
};

describe("@beep/editor runtime admission", () => {
  it("admits valid raw wire and untouched schema-decoded state", () => {
    const decoded = decodedEmptyState();

    expect(Result.isSuccess(decodeEditorStateForRuntimeResult(emptyWire))).toBe(true);
    expect(Result.isSuccess(decodeEditorStateForRuntimeResult(decoded))).toBe(true);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Success");
  });

  it("deeply rejects a decoded state mutated with a null child", () => {
    const decoded = decodedEmptyState();
    appendRootChild(decoded, null);

    expect(Result.isFailure(decodeEditorStateForRuntimeResult(decoded))).toBe(true);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });

  it("deeply rejects a decoded state mutated with an unknown future node", () => {
    const decoded = decodedEmptyState();
    appendRootChild(decoded, {
      pluginData: { enabled: true },
      type: "future-node",
      version: 2,
    });

    expect(Result.isFailure(decodeEditorStateForRuntimeResult(decoded))).toBe(true);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });

  it("deeply rejects a decoded state mutated with a misplaced semantic text node", () => {
    const decoded = decodedEmptyState();
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

    expect(Result.isFailure(decodeEditorStateForRuntimeResult(decoded))).toBe(true);
    expect(Effect.runSyncExit(decodeEditorStateForRuntime(decoded))._tag).toBe("Failure");
  });
});
