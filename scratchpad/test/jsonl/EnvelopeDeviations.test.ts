// Pins from the Envelope deviation review. D19 restores upstream's issue roots and
// messages byte for byte (oracle: effected/packages/jsonl, probe 29); D21 pins the
// lab's lazy Effect forms; D15 pins upstream's omission of an undefined scope.
import type { EnvelopeInput } from "../../effected/jsonl/index.ts";
import { Envelope, InvalidData, JsonlEvent, Line } from "../../effected/jsonl/index.ts";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const at = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const Round = S.Struct({ round: S.Finite, label: S.String });
const Noted = JsonlEvent.make("noted", { data: Round });
const Text = JsonlEvent.make("text", { data: S.String });
const Nested = JsonlEvent.make("nested", { data: S.Struct({ inner: S.Struct({ n: S.Finite }) }) });
const events = Tuple.make(Noted, Text, Nested);
const line = (text: string) => O.getOrThrow(A.head(Line.split(text)));
const AT = '"at":"2026-01-01T00:00:00.000Z"';

const invalidData = (result: Result.Result<unknown, unknown>): InvalidData => {
  const failure = result.pipe(Result.getFailure, O.getOrThrow);
  if (!S.is(InvalidData)(failure)) return assert.fail("expected InvalidData");
  return failure;
};

/** A typed input that an untyped caller then corrupts field by field. */
const corrupted = (fields: R.ReadonlyRecord<string, unknown>, data: R.ReadonlyRecord<string, unknown> = {}) => {
  const input: EnvelopeInput<"noted", typeof Round.Type> = { at, event: "noted", data: { round: 1, label: "x" } };
  for (const [key, value] of R.toEntries(fields)) Reflect.set(input, key, value);
  for (const [key, value] of R.toEntries(data)) Reflect.set(input.data, key, value);
  return input;
};

describe("D19: payload failures are rooted at the payload, as upstream reports them", () => {
  it.each([
    {
      name: "a struct payload field",
      text: `{${AT},"event":"noted","data":{"round":"x","label":"y"}}`,
      issue: 'Expected number\n  at ["round"]',
      root: "Composite",
    },
    {
      name: "the first of two bad struct fields",
      text: `{${AT},"event":"noted","data":{"round":"x","label":1}}`,
      issue: 'Expected number\n  at ["round"]',
      root: "Composite",
    },
    {
      name: "a scalar payload",
      text: `{${AT},"event":"text","data":42}`,
      issue: "Expected string",
      root: "InvalidType",
    },
    {
      name: "a nested payload field",
      text: `{${AT},"event":"nested","data":{"inner":{"n":"x"}}}`,
      issue: 'Expected number\n  at ["inner"]["n"]',
      root: "Composite",
    },
  ])("decodes $name with a data-relative issue", ({ text, issue, root }) => {
    const source = line(text);
    const error = invalidData(Envelope.decodeResult(source, events));
    const event = O.getOrThrow(error.event);
    assert.strictEqual(error.error.message, issue);
    assert.strictEqual(error.error.issue._tag, root);
    assert.strictEqual(error.message, `invalid JSONL payload for event "${event}" at byte offset 0: ${issue}`);
    assertSome(
      O.map(Envelope.decodeSelectedResult(source, events, () => true), (selected) => invalidData(selected).message),
      error.message
    );
  });

  it("reports an invalid wire timestamp at the frame, before any payload codec", () => {
    const error = invalidData(Envelope.decodeResult(line('{"at":"bad","event":"noted","data":{"round":"x"}}'), events));
    assertNone(error.event);
    assert.strictEqual(
      error.message,
      'invalid JSONL envelope at byte offset 0: Expected a valid UTC DateTime string\n  at ["at"]'
    );
  });

  it.each([
    {
      name: "an invalid timestamp, with no path",
      input: corrupted({ at: "not-a-date" }),
      issue: "Expected DateTime.Utc",
      root: "Encoding",
    },
    {
      name: "a null timestamp, with no path",
      input: corrupted({ at: null }),
      issue: "Expected DateTime.Utc",
      root: "Encoding",
    },
    {
      name: "an invalid payload, relative to data",
      input: corrupted({}, { round: "1" }),
      issue: 'Expected number\n  at ["round"]',
      root: "Composite",
    },
    {
      name: "the payload before the timestamp",
      input: corrupted({ at: "not-a-date" }, { round: "1" }),
      issue: 'Expected number\n  at ["round"]',
      root: "Composite",
    },
    {
      name: "the timestamp before an untyped scope",
      input: corrupted({ at: "not-a-date", scope: 42 }),
      issue: "Expected DateTime.Utc",
      root: "Encoding",
    },
    {
      name: "the payload before an untyped scope",
      input: corrupted({ scope: 42 }, { round: "1" }),
      issue: 'Expected number\n  at ["round"]',
      root: "Composite",
    },
  ])("encodes $name", ({ input, issue, root }) => {
    const error = invalidData(Envelope.encodeResult(input, events));
    assertSome(error.event, "noted");
    assert.strictEqual(error.error.message, issue);
    assert.strictEqual(error.error.issue._tag, root);
    assert.strictEqual(error.message, `invalid JSONL payload for event "noted" at byte offset 0: ${issue}`);
  });

  it("reports a scalar payload encode failure at the payload root", () => {
    const input: EnvelopeInput<"text", string> = { at, event: "text", data: "x" };
    Reflect.set(input, "data", 42);
    const error = invalidData(Envelope.encodeResult(input, events));
    assert.strictEqual(error.message, 'invalid JSONL payload for event "text" at byte offset 0: Expected string');
    assert.strictEqual(error.error.issue._tag, "InvalidType");
  });
});

class GetterBoom extends Data.TaggedError("GetterBoom") {}

describe("D21: the Effect forms evaluate when run, not when built", () => {
  const Snapshot = JsonlEvent.make("snapshot", { data: S.Unknown });
  const snapshots = Tuple.make(Snapshot);

  it.effect("emits the payload as it is when the Effect runs", () =>
    Effect.gen(function* () {
      const data: Record<string, unknown> = { v: "at-construction" };
      const direct = Envelope.encode({ at, event: "snapshot", data }, snapshots);
      const piped = pipe({ at, event: "snapshot", data }, Envelope.encode(snapshots));
      data.v = "at-run";
      const expected = `{${AT},"event":"snapshot","data":{"v":"at-run"}}\n`;
      assert.strictEqual(yield* direct, expected);
      assert.strictEqual(yield* piped, expected);
    })
  );

  it.effect("defers a throwing payload getter into the fiber, where it dies", () =>
    Effect.gen(function* () {
      const Guarded = JsonlEvent.make("guarded", { data: S.Struct({ a: S.String }) });
      const data = Object.defineProperty<{ readonly a: string }>({ a: "" }, "a", {
        enumerable: true,
        get: () => {
          throw new GetterBoom();
        },
      });
      const build = () => Envelope.encode({ at, event: "guarded", data }, Tuple.make(Guarded));
      assert.doesNotThrow(build, "building the Effect reads no payload");
      const exit = yield* Effect.exit(build());
      assert.isTrue(Exit.hasDies(exit), "the getter's throw is a defect inside the fiber");
      exit.pipe(Exit.findErrorOption, assertNone);
    })
  );
});

describe("D15: an explicitly undefined scope is omitted, as upstream does", () => {
  it.effect("encodes the same bytes as an absent scope in both forms", () =>
    Effect.gen(function* () {
      const data = { round: 3, label: "x" };
      const omitted = yield* Envelope.encode({ at, event: "noted", data }, events);
      assert.strictEqual(omitted, `{${AT},"event":"noted","data":{"round":3,"label":"x"}}\n`);
      assert.strictEqual(yield* Envelope.encode({ at, event: "noted", scope: undefined, data }, events), omitted);
      assertSuccess(Envelope.encodeResult({ at, event: "noted", scope: undefined, data }, events), omitted);
      assertSuccess(
        Envelope.encodeResult({ at, event: "noted", scope: "box", data }, events),
        `{${AT},"event":"noted","scope":"box","data":{"round":3,"label":"x"}}\n`
      );
    })
  );
});
