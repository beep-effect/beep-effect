import { documentToEditorState } from "@beep/lexical-schema";
import * as Md from "@beep/md/Md.model";
import { refineSafeDocument } from "@beep/md/Md.safe";
import { it, layer } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { describe, expect } from "vitest";
import {
  ComposerPolicy,
  ComposerPolicyLive,
  ComposerSendDecision,
  composerPolicy,
  MAX_MESSAGE_CHARACTERS,
} from "@/chat/ui/ComposerPolicy";
import type { SerializedEditorState } from "@beep/lexical-schema";

const textDocument = (value: string): Md.Document =>
  Md.Document.make({ children: [Md.P.make({ children: [Md.Text.make({ value })] })] });

// A NUL character survives the Lexical round-trip as plain text and fails the
// InvalidScalar safety check; URL-bearing fixtures do not work here because the
// editor projection sanitizes unsafe hrefs before the policy ever sees them.
const unsafeScalarDocument = textDocument("bad\u0000scalar");

const safeTextDocument = (value: string) => Result.getOrThrow(refineSafeDocument(textDocument(value)));

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
  it.effect("silently gates when a safety gate is open and nothing is confirmed", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(textDocument("hello"));
      const decision = composerPolicy.decideSend({
        confirmed: O.none(),
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
        confirmed: O.none(),
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
        confirmed: O.none(),
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
        confirmed: O.none(),
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
        confirmed: O.none(),
        gateOpen: false,
        seed: textDocument("hello world"),
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("send");
    })
  );

  it.effect("refuses an over-limit confirmed payload with an error notice", () =>
    Effect.gen(function* () {
      const oversized = safeTextDocument(Str.repeat(MAX_MESSAGE_CHARACTERS + 1)("a"));
      const state = yield* documentToEditorState(textDocument("short"));
      const decision = composerPolicy.decideSend({
        confirmed: O.some(oversized),
        gateOpen: false,
        seed: textDocument("short"),
        state,
        turnActive: false,
      });
      expect(decisionSummary(decision)).toBe("refuse:error");
    })
  );
});

describe("composerPolicy.decideConfirmNormalization", () => {
  it("silently gates when no confirmable escaped copy exists", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.none(),
      turnActive: false,
    });
    expect(decisionSummary(decision)).toBe("gated");
  });

  it("refuses with an info notice while a turn is streaming", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument("escaped copy")),
      turnActive: true,
    });
    expect(decisionSummary(decision)).toBe("refuse:info");
  });

  it("refuses an escaped copy with no visible text", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument("   ")),
      turnActive: false,
    });
    expect(decisionSummary(decision)).toBe("refuse:error");
  });

  it("refuses an over-limit escaped copy with the shared character-limit notice", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument(Str.repeat(MAX_MESSAGE_CHARACTERS + 1)("a"))),
      turnActive: false,
    });
    expect(decisionSummary(decision)).toBe("refuse:error");
  });

  it("accepts a visible, in-limit escaped copy", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument("escaped copy")),
      turnActive: false,
    });
    expect(decisionSummary(decision)).toBe("send");
  });
});

layer(ComposerPolicyLive)("ComposerPolicy service", (it) => {
  it.effect("resolves the live policy through ComposerPolicyLive", () =>
    Effect.gen(function* () {
      const policy = yield* ComposerPolicy;
      const decision = policy.decideConfirmNormalization({ normalized: O.none(), turnActive: false });
      expect(decisionSummary(decision)).toBe("gated");
    })
  );
});
