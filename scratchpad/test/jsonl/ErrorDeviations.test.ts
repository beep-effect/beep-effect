// Pins for the JsonlError rows of the D9 deviation review (EFFECTED_PORT_GOAL
// section 14). Each block names the review entry it pins and says whether the
// lab matches upstream or deviates from it, and why.

import {
  InvalidData,
  InvalidJournalConfig,
  InvalidSlice,
  InvalidUtf8,
  JournalClosed,
  JournalNotFound,
  JournalResync,
  JournalResyncReason,
  JournalUnterminated,
  JournalWriteConflict,
  JsonlError,
  MalformedLine,
  TerminalViolation,
  UnknownEvent,
  UnserializableData,
} from "../../effected/jsonl/JsonlError.ts";
import { LineSlice } from "../../effected/jsonl/LineSlice.ts";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const slice = LineSlice.make({ offset: 12, end: 20, length: 7, text: '{"a":1}', terminated: true });
const encodedSlice = { offset: 12, end: 20, length: 7, text: '{"a":1}', terminated: true };

/** A real `SchemaError`, obtained the way the package obtains one. */
const schemaError = S.decodeUnknownResult(S.Struct({ n: S.Finite }))({ n: "no" }).pipe(
  Result.getFailure,
  O.getOrThrow
);

describe("D23: UnknownEvent.known and InvalidData.event are required, as upstream", () => {
  it("UnknownEvent refuses construction without known", () => {
    assert.throws(
      () =>
        // @ts-expect-error — `known` is required; upstream has no default for it.
        UnknownEvent.make({ line: slice, event: "ghost" }),
      /Schema validation failed/
    );
  });

  it("InvalidData refuses construction without event", () => {
    assert.throws(
      () =>
        // @ts-expect-error — `event` is required; upstream has no default for it.
        InvalidData.make({ line: slice, error: schemaError }),
      /Schema validation failed/
    );
  });

  it("UnknownEvent decoding requires known", () => {
    const decode = S.decodeUnknownResult(UnknownEvent);
    decode({ _tag: "UnknownEvent", line: encodedSlice, event: "ghost" }).pipe(Result.isFailure, assertTrue);
    const decoded = decode({ _tag: "UnknownEvent", line: encodedSlice, event: "ghost", known: [] });
    decoded.pipe(Result.isSuccess, assertTrue);
    assertSuccess(decoded.pipe(Result.map((error) => error.known)), []);
  });

  it("InvalidData decoding requires event", () => {
    const decode = S.decodeUnknownResult(InvalidData);
    decode({ _tag: "InvalidData", line: encodedSlice, error: schemaError }).pipe(Result.isFailure, assertTrue);
    const decoded = decode({ _tag: "InvalidData", line: encodedSlice, event: O.none(), error: schemaError });
    decoded.pipe(Result.isSuccess, assertTrue);
    assertSuccess(decoded.pipe(Result.map((error) => error.event)), O.none());
  });
});

describe("D24: error names carry the $ScratchpadId identity (law:D5)", () => {
  it("MalformedLine renders its identity in name, String and Cause.pretty, keeping the tag", () => {
    const error = MalformedLine.make({ line: slice });
    const identity = "@beep/scratchpad/effected/jsonl/JsonlError/MalformedLine";
    const rendered = `${identity}: JSONL malformed line at byte offset 12`;
    assert.strictEqual(error._tag, "MalformedLine");
    assert.strictEqual(error.name, identity);
    assert.strictEqual(String(error), rendered);
    assert.deepStrictEqual(pipe(Cause.fail(error), Cause.pretty, Str.split("\n"), A.head), O.some(rendered));
  });
});

describe("D25: message is an own field on every member (upstream-bug: Bun prepareStackTrace, probes 25b, 25c, 29)", () => {
  const torn = LineSlice.make({ offset: 12, end: 15, length: 3, text: '{"a', terminated: false });
  const members: ReadonlyArray<{ readonly tag: string; readonly error: JsonlError; readonly message: string }> = [
    {
      tag: "MalformedLine",
      error: MalformedLine.make({ line: slice }),
      message: "JSONL malformed line at byte offset 12",
    },
    {
      tag: "MalformedLine",
      error: MalformedLine.make({ line: torn }),
      message: "JSONL unterminated final line at byte offset 12",
    },
    {
      tag: "UnknownEvent",
      error: UnknownEvent.make({ line: slice, event: "ghost", known: ["a"] }),
      message: 'unknown JSONL event "ghost" at byte offset 12',
    },
    {
      tag: "InvalidData",
      error: InvalidData.make({ line: slice, event: O.some("noted"), error: schemaError }),
      message: `invalid JSONL payload for event "noted" at byte offset 12: ${schemaError.message}`,
    },
    {
      tag: "InvalidData",
      error: InvalidData.make({ line: slice, event: O.none(), error: schemaError }),
      message: `invalid JSONL envelope at byte offset 12: ${schemaError.message}`,
    },
    {
      tag: "UnserializableData",
      error: UnserializableData.make({ event: "noted", cause: new TypeError("boom") }),
      message: 'cannot serialize payload for event "noted": boom',
    },
    {
      tag: "TerminalViolation",
      error: TerminalViolation.make({ event: "noted", terminal: "ended" }),
      message: 'cannot append "noted": the journal is terminal at "ended"',
    },
    {
      tag: "JournalClosed",
      error: JournalClosed.make({ event: "noted" }),
      message: 'cannot append "noted": the journal is closed',
    },
    {
      tag: "JournalNotFound",
      error: JournalNotFound.make({ path: "/tmp/j.jsonl" }),
      message: "journal not found: /tmp/j.jsonl",
    },
    {
      tag: "JournalResync",
      error: JournalResync.make({
        path: "/tmp/j.jsonl",
        reason: JournalResyncReason.Enum.replaced,
        expected: 90,
        actual: 10,
      }),
      message: "journal replaced beneath the reader at /tmp/j.jsonl: consumed 90, file is now 10",
    },
    {
      tag: "InvalidJournalConfig",
      error: InvalidJournalConfig.make({ error: schemaError }),
      message: "invalid journal configuration",
    },
    {
      tag: "InvalidSlice",
      error: InvalidSlice.make({ error: schemaError }),
      message: "invalid journal selection",
    },
    {
      tag: "JournalWriteConflict",
      error: JournalWriteConflict.make({ path: "/journal", expected: 80, actual: 160 }),
      message: "journal write placement conflict at /journal: expected 80 bytes, found 160; reconcile before retrying",
    },
    {
      tag: "InvalidUtf8",
      error: InvalidUtf8.make({ path: "/journal", offset: 3, cause: new TypeError("invalid UTF-8") }),
      message: "invalid UTF-8 in journal /journal at decoded range starting at physical byte 3",
    },
    {
      tag: "JournalUnterminated",
      error: JournalUnterminated.make({ path: "/journal", offset: 80, end: 83 }),
      message: "unterminated journal suffix at /journal: logical bytes 80 to 83; complete or repair before appending",
    },
  ];

  it("covers every member of the JsonlError union", () => {
    const sortTags = A.sort(Order.String);
    assert.deepStrictEqual(
      sortTags(A.dedupe(A.map(members, (member) => member.tag))),
      sortTags(R.keys(JsonlError.cases))
    );
  });

  it.each(members)("$tag owns its exact message", ({ tag, error, message }) => {
    assert.strictEqual(error._tag, tag);
    assert.isTrue(Object.hasOwn(error, "message"), "message is an own field, not a prototype getter");
    assert.isTrue(
      P.isUndefined(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(error), "message")),
      "the class declares no message accessor that a stack hook could reach before fields are set"
    );
    assert.strictEqual(error.message, message);
  });
});

describe("D07: JournalResync byte counts are non-negative integers (upstream-bug: probes 03, 03b, 14)", () => {
  it.each([-3, 1.5])("expected and actual reject %s", (size) => {
    assert.isFalse(S.is(JournalResync.fields.expected)(size));
    assert.isFalse(S.is(JournalResync.fields.actual)(size));
  });

  it("expected and actual accept zero, the size of a truncated journal", () => {
    assert.isTrue(S.is(JournalResync.fields.expected)(0));
    assert.isTrue(S.is(JournalResync.fields.actual)(0));
  });
});
