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
import {
  InvalidJournalConfig,
  InvalidSlice,
  InvalidUtf8,
  JournalUnterminated,
  JournalWriteConflict,
  JournalResyncReason,
  JsonlError,
} from "@beep/scratchpad/effected/jsonl/JsonlError";
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
    const error = JournalResync.make({
      path: "/tmp/j.jsonl",
      reason: JournalResyncReason.Enum.truncated,
      expected: 90,
      actual: 10,
    });
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

describe("boundary and write-conflict failures", () => {
  it("preserves schema issue trees on configuration and selection failures", () => {
    const configuration = InvalidJournalConfig.make({ error: schemaError });
    const selection = InvalidSlice.make({ error: schemaError });
    assert.strictEqual(configuration.error, schemaError);
    assert.strictEqual(selection.error, schemaError);
    assert.strictEqual(configuration.message, "invalid journal configuration");
    assert.strictEqual(selection.message, "invalid journal selection");
    assert.isTrue(JsonlError.guards.InvalidJournalConfig(configuration));
    assert.isTrue(JsonlError.guards.InvalidSlice(selection));
  });
  it("describes persisted-byte ambiguity without recommending automatic retry", () => {
    const conflict = JournalWriteConflict.make({ path: "/journal", expected: 80, actual: 160 });
    assert.strictEqual(
      conflict.message,
      "journal write placement conflict at /journal: expected 80 bytes, found 160; reconcile before retrying"
    );
    assert.isTrue(JsonlError.guards.JournalWriteConflict(conflict));
    assert.strictEqual(conflict.expected, 80);
    assert.strictEqual(conflict.actual, 160);
    assert.isTrue(S.is(JournalWriteConflict.fields.expected)(0));
    assert.isTrue(S.is(JournalWriteConflict.fields.actual)(0));
  });
});

it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid write-conflict byte counts %s", (size) => {
  assert.isFalse(S.is(JournalWriteConflict.fields.expected)(size));
  assert.isFalse(S.is(JournalWriteConflict.fields.actual)(size));
});

it("retains strict decoder failures and raw unfinished spans structurally", () => {
  const cause = new TypeError("invalid UTF-8");
  const encoding = InvalidUtf8.make({ path: "/journal", offset: 3, cause });
  assert.strictEqual(encoding.cause, cause);
  assert.strictEqual(
    encoding.message,
    "invalid UTF-8 in journal /journal at decoded range starting at physical byte 3"
  );
  assert.isTrue(JsonlError.guards.InvalidUtf8(encoding));
  const unfinished = JournalUnterminated.make({ path: "/journal", offset: 80, end: 83 });
  assert.strictEqual(
    unfinished.message,
    "unterminated journal suffix at /journal: logical bytes 80 to 83; complete or repair before appending"
  );
  assert.isTrue(JsonlError.guards.JournalUnterminated(unfinished));
});
