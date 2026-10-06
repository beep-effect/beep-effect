// Adapted from effected/packages/jsonl/__test__/JsonlError.test.ts (MIT).

import {
  InvalidData,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  LineSlice,
  MalformedLine,
  TerminalViolation,
  UnknownEvent,
  UnserializableData,
} from "../../effected/jsonl/index.ts";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

/**
 * Every error's `message` getter is exercised.
 *
 * Not a coverage exercise. A `message` getter is the one piece of an error that
 * runs at the moment something has already gone wrong — usually inside a
 * reporter — so a throw there converts a legible failure into an unreadable
 * one. This branch paid for that shape once already, when a test-runner SDK
 * crashed recording an error and made a failing test impossible to read.
 */

const slice = LineSlice.make({ offset: 12, end: 20, length: 7, text: '{"a":1}', terminated: true });

/** A real `SchemaError`, obtained the way the package obtains one. */
const InvalidNumber = S.Struct({ n: S.Finite });
const schemaError = (() => {
  const decoded = S.decodeUnknownResult(InvalidNumber)({ n: "no" });
  const error = decoded.pipe(Result.getFailure, O.getOrThrow);
  assertFailure(decoded, error);
  return error;
})();

describe("error messages render", () => {
  it("MalformedLine", () => {
    const message = MalformedLine.make({ line: slice }).message;
    assert.include(message, "12");
    assert.include(message, "malformed line", "a terminated line is a hole in the history");
  });

  it("MalformedLine distinguishes an UNTERMINATED tail", () => {
    // The two cases have different recoveries — a torn tail heals when the
    // writer finishes its line, a terminated malformed line never does — so the
    // rendering has to tell them apart, and the branch that does needs a
    // fixture that reaches it.
    // Unterminated, so `end` is exactly `offset + length`.
    const torn = LineSlice.make({ offset: 12, end: 15, length: 3, text: '{"a', terminated: false });
    const message = MalformedLine.make({ line: torn }).message;
    assert.include(message, "unterminated final line");
    assert.include(message, "12");
  });

  it("UnknownEvent", () => {
    assert.include(UnknownEvent.make({ line: slice, event: "ghost", known: ["a"] }).message, "ghost");
  });

  it("InvalidData", () => {
    const error = InvalidData.make({ line: slice, event: O.some("noted"), error: schemaError });
    assert.include(error.message, "noted");
  });

  it("InvalidData with no event names the envelope", () => {
    const error = InvalidData.make({ line: slice, event: O.none(), error: schemaError });
    assert.include(error.message, "envelope");
  });

  it("UnserializableData", () => {
    const error = UnserializableData.make({ event: "noted", cause: new TypeError("boom") });
    assert.include(error.message, "noted");
  });

  it("TerminalViolation", () => {
    assert.include(TerminalViolation.make({ event: "noted", terminal: "ended" }).message, "ended");
  });

  it("JournalClosed", () => {
    assert.include(JournalClosed.make({ event: "noted" }).message, "closed");
  });

  it("JournalNotFound", () => {
    assert.include(JournalNotFound.make({ path: "/tmp/j.jsonl" }).message, "/tmp/j.jsonl");
  });

  it("JournalResync", () => {
    const error = JournalResync.make({ path: "/tmp/j.jsonl", reason: "truncated", expected: 90, actual: 10 });
    assert.include(error.message, "truncated");
  });
});

describe("UnserializableData renders a CIRCULAR cause safely", () => {
  const circular = (): unknown => {
    const node: Record<string, unknown> = { name: "loop" };
    node.self = node;
    return node;
  };

  it("returns without throwing", () => {
    // The cause here is, by construction, the very value that could not be
    // serialized. Rendering it is the plausible "better diagnostics" change,
    // and it would reintroduce a throw inside an error's own accessor — at the
    // exact moment a reporter is trying to print the failure.
    const error = UnserializableData.make({ event: "noted", cause: circular() });
    let threw: unknown;
    let rendered = "";
    try {
      rendered = error.message;
    } catch (caught) {
      threw = caught;
    }
    assert.isUndefined(threw, "message must not throw");
    assert.isString(rendered);
  });

  it("does NOT include the cause", () => {
    const error = UnserializableData.make({ event: "noted", cause: circular() });
    assert.notInclude(error.message, "loop", "the cyclic cause is not rendered into the message");
    assert.include(error.message, "noted", "but the event tag still is");
  });
});
