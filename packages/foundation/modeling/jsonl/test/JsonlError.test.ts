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
} from "@beep/jsonl";
import {
  InvalidJournalConfig,
  InvalidSlice,
  InvalidUtf8,
  JournalResyncReason,
  JournalUnterminated,
  JournalWriteConflict,
  JsonlError,
} from "@beep/jsonl/JsonlError";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const slice = LineSlice.make({ offset: 12, end: 20, length: 7, text: '{"a":1}', terminated: true });

const InvalidNumber = S.Struct({ n: S.Finite });
const decodedSchemaError = (() => {
  const decoded = S.decodeUnknownResult(InvalidNumber)({ n: "no" });
  const error = decoded.pipe(Result.getFailure, O.getOrThrow);
  assertFailure(decoded, error);
  return error;
})();

describe("every error message field renders, since a reporter reads it after something already failed and a throw there hides the failure", () => {
  it("MalformedLine", () => {
    const message = MalformedLine.make({ line: slice }).message;
    assert.include(message, "12");
    assert.include(message, "malformed line", "a terminated line is a hole in the history");
  });

  it("MalformedLine distinguishes an UNTERMINATED tail, which heals when the writer finishes its line, from a terminated hole that never does", () => {
    const torn = LineSlice.make({ offset: 12, end: 12 + 3, length: 3, text: '{"a', terminated: false });
    const message = MalformedLine.make({ line: torn }).message;
    assert.include(message, "unterminated final line");
    assert.include(message, "12");
  });

  it("UnknownEvent", () => {
    assert.include(UnknownEvent.make({ line: slice, event: "ghost", known: ["a"] }).message, "ghost");
  });

  it("InvalidData", () => {
    const error = InvalidData.make({ line: slice, event: O.some("noted"), error: decodedSchemaError });
    assert.include(error.message, "noted");
  });

  it("InvalidData with no event names the envelope", () => {
    const error = InvalidData.make({ line: slice, event: O.none(), error: decodedSchemaError });
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

  it("returns without throwing, because the cause is the very value that could not be serialized", () => {
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
    const configuration = InvalidJournalConfig.make({ error: decodedSchemaError });
    const selection = InvalidSlice.make({ error: decodedSchemaError });
    assert.strictEqual(configuration.error, decodedSchemaError);
    assert.strictEqual(selection.error, decodedSchemaError);
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
