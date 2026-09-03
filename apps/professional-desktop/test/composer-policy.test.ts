import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as Md from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { DocumentComplexitySafetyViolation, MAX_SAFE_DOCUMENT_NODES } from "@beep/md/Md.safe";
import { NonNegativeInt } from "@beep/schema/Number";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { describe, expect } from "vitest";
import {
  ComposerSendDecision,
  composerPolicy,
  MAX_MESSAGE_CHARACTERS,
  unsafeDocumentMessage,
} from "@/chat/ui/ComposerPolicy";
import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";

const textDocument = (value: string): Md.Document =>
  Md.Document.make({ children: [Md.P.make({ children: [Md.Text.make({ value })] })] });

// A NUL character survives the Lexical round-trip as plain text and fails the
// InvalidScalar safety check; URL-bearing fixtures do not work here because the
// editor projection sanitizes unsafe hrefs before the policy ever sees them.
const unsafeScalarDocument = textDocument("bad\u0000scalar");

// Exhaustive by construction: adding a ComposerSendDecision variant fails these
// tests at compile time instead of silently falling through a `.kind ===` guard.
const decisionSummary = (decision: ComposerSendDecision): string =>
  ComposerSendDecision.match(decision, {
    gated: () => "gated",
    refuse: (refused) => `refuse:${refused.notice.kind}`,
    send: () => "send",
    unsafe: () => "unsafe",
  });

describe("composerPolicy.decideSend", () => {
  it("explains document-complexity refusals without misdiagnosing trusted raw content", () => {
    const issue = DocumentComplexitySafetyViolation.make({
      maxNodes: NonNegativeInt.make(MAX_SAFE_DOCUMENT_NODES),
      observedNodes: NonNegativeInt.make(MAX_SAFE_DOCUMENT_NODES + 1),
    });

    expect(unsafeDocumentMessage([issue])).toBe(
      "This draft contains a document whose structure exceeds the safe size and complexity limit. Edit or replace that content before sending."
    );
  });

  it.effect("silently gates while a seed-time safety gate is open", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(textDocument("hello"));
      const decision = composerPolicy.decideSend({
        gateOpen: true,
        seed: textDocument("hello"),
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("gated");
    })
  );

  it.effect("refuses with an info notice while a turn is streaming", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(textDocument("hello"));
      const decision = composerPolicy.decideSend({
        gateOpen: false,
        seed: textDocument("hello"),
        state,
        turnActive: true,
      });
      expect(decisionSummary(decision)).toBe("refuse:info");
    })
  );

  it.effect("refuses an empty projection with a decode-error notice", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(textDocument("hello"));
      const emptyRootState: SerializedEditorState = { ...state, root: { ...state.root, children: [] } };
      const decision = composerPolicy.decideSend({
        gateOpen: false,
        seed: textDocument("hello"),
        state: emptyRootState,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("refuse:decode-error");
    })
  );

  it.effect("refuses an unsafe projection with an inline safety refusal", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(unsafeScalarDocument);
      const decision = composerPolicy.decideSend({
        gateOpen: false,
        seed: unsafeScalarDocument,
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("unsafe");
    })
  );

  it.effect("accepts a safe draft within the character limit", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(textDocument("hello world"));
      const decision = composerPolicy.decideSend({
        gateOpen: false,
        seed: textDocument("hello world"),
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("send");
    })
  );

  it.effect("accepts a safe draft exactly at the character limit", () =>
    Effect.gen(function* () {
      const boundary = textDocument(Str.repeat(MAX_MESSAGE_CHARACTERS)("a"));
      expect(Str.length(renderPlainTextUnsafe(boundary))).toBe(MAX_MESSAGE_CHARACTERS);
      const state = yield* documentToEditorState(boundary);
      const decision = composerPolicy.decideSend({
        gateOpen: false,
        seed: boundary,
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("send");
    })
  );

  it.effect("refuses an over-limit draft with an error notice", () =>
    Effect.gen(function* () {
      const oversized = textDocument(Str.repeat(MAX_MESSAGE_CHARACTERS + 1)("a"));
      const state = yield* documentToEditorState(oversized);
      const decision = composerPolicy.decideSend({
        gateOpen: false,
        seed: oversized,
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("refuse:error");
    })
  );
});
