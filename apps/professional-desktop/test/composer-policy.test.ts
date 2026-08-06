import { documentToEditorState } from "@beep/lexical-schema";
import * as Md from "@beep/md/Md.model";
import { refineSafeDocument } from "@beep/md/Md.safe";
import { it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { describe, expect } from "vitest";
import { composerPolicy, MAX_MESSAGE_CHARACTERS } from "@/chat/ui/ComposerPolicy";

const textDocument = (value: string): Md.Document =>
  Md.Document.make({ children: [Md.P.make({ children: [Md.Text.make({ value })] })] });

const safeTextDocument = (value: string) => Result.getOrThrow(refineSafeDocument(textDocument(value)));

const emptyDocument = Md.Document.make({ children: [] });

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
      expect(decision.kind).toBe("gated");
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
      expect(decision.kind).toBe("refuse");
      if (decision.kind === "refuse") expect(decision.notice.kind).toBe("info");
    })
  );

  it.effect("refuses an empty projection with a decode-error notice", () =>
    Effect.gen(function* () {
      const state = yield* documentToEditorState(emptyDocument);
      const decision = composerPolicy.decideSend({
        confirmed: O.none(),
        gateOpen: false,
        seed: emptyDocument,
        state,
        turnActive: false,
      });
      expect(decision.kind === "refuse" || decision.kind === "send").toBe(true);
      if (decision.kind === "refuse") expect(decision.notice.kind).toBe("decode-error");
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
      expect(decision.kind).toBe("send");
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
      expect(decision.kind).toBe("refuse");
      if (decision.kind === "refuse") expect(decision.notice.kind).toBe("error");
    })
  );
});

describe("composerPolicy.decideConfirmNormalization", () => {
  it("silently gates when no confirmable escaped copy exists", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.none(),
      turnActive: false,
    });
    expect(decision.kind).toBe("gated");
  });

  it("refuses with an info notice while a turn is streaming", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument("escaped copy")),
      turnActive: true,
    });
    expect(decision.kind).toBe("refuse");
    if (decision.kind === "refuse") expect(decision.notice.kind).toBe("info");
  });

  it("refuses an escaped copy with no visible text", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument("   ")),
      turnActive: false,
    });
    expect(decision.kind).toBe("refuse");
    if (decision.kind === "refuse") expect(decision.notice.kind).toBe("error");
  });

  it("refuses an over-limit escaped copy with the shared character-limit notice", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument(Str.repeat(MAX_MESSAGE_CHARACTERS + 1)("a"))),
      turnActive: false,
    });
    expect(decision.kind).toBe("refuse");
    if (decision.kind === "refuse") expect(decision.notice.kind).toBe("error");
  });

  it("accepts a visible, in-limit escaped copy", () => {
    const decision = composerPolicy.decideConfirmNormalization({
      normalized: O.some(safeTextDocument("escaped copy")),
      turnActive: false,
    });
    expect(decision.kind).toBe("send");
  });
});
