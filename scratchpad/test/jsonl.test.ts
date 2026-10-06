import { $ScratchpadId } from "@beep/identity/packages";
import {
  Envelope,
  type EnvelopeUnion,
  type EnvelopeWithTag,
  Journal,
  type JournalShape,
  JsonlEvent,
  Line,
  LineSlice,
} from "@beep/scratchpad/effected/jsonl/index";
import { canMerge, shallowMerge } from "@beep/scratchpad/effected/jsonl/internal/merge";
import { probeBomBytes, readTailUntil } from "@beep/scratchpad/effected/jsonl/internal/tail";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { expectTypeOf } from "vitest";

const $I = $ScratchpadId.create("test/jsonl");
const Updated = JsonlEvent.make("updated", { data: S.Struct({ count: S.Finite, label: S.String }) });
const Closed = JsonlEvent.make("closed", { data: S.Null, terminal: true });
const Reopened = JsonlEvent.make("reopened", { data: S.Null, reopen: true });
const events = [Updated, Closed, Reopened] as const;
type Registry = typeof events;

class TestJournal extends Journal.Service<TestJournal>()($I`TestJournal`, { events }) {}
class OtherJournal extends Journal.Service<OtherJournal>()($I`OtherJournal`, {
  events: [JsonlEvent.make("other", { data: S.String })],
}) {}

const at = DateTime.makeUnsafe("2026-10-06T00:00:00.000Z");
const path = "/journal.jsonl";
const line = (text: string) =>
  LineSlice.make({ offset: 0, end: Line.byteLength(text) + 1, length: Line.byteLength(text), text, terminated: true });

const withJournal = Effect.fnUntraced(function* <A, E>(body: Effect.Effect<A, E, TestJournal>) {
  const context = yield* Layer.build(TestJournal.layer({ path }).pipe(Layer.provide(MemoryFileSystem.layer)));
  return yield* Effect.provideContext(body, context);
}, Effect.scoped);

describe("JSONL schema and facade types", () => {
  it("supports value-first and piped synchronous codecs without widening the registry", () => {
    const text = '{"at":"2026-10-06T00:00:00Z","event":"updated","data":{"count":2,"label":"a"}}';
    const source = line(text);
    const decoded = pipe(source, Envelope.decodeResult(events));
    expectTypeOf<Result.Result.Success<typeof decoded>>().toEqualTypeOf<EnvelopeUnion<Registry>>();
    expect(decoded).toEqual(Envelope.decodeResult(source, events));
    expect(
      pipe(
        source,
        Envelope.decodeSelectedResult(events, () => true),
      ),
    ).toEqual(Envelope.decodeSelectedResult(source, events, () => true));
    expect(
      pipe(
        source,
        Envelope.decodeSelectedResult(events, () => false),
      ),
    ).toEqual(O.none());
    expect(pipe(text, Envelope.decodeAllResult(events))).toEqual(Envelope.decodeAllResult(text, events));
    expect(pipe(`${text}\n{`, Envelope.lastValidResult(events))).toEqual(Envelope.lastValidResult(`${text}\n`, events));
    expect(pipe({ at, event: "updated", data: { count: 2, label: "a" } }, Envelope.encodeResult(events))).toEqual(
      Envelope.encodeResult({ at, event: "updated", data: { count: 2, label: "a" } }, events),
    );
  });

  it.effect("supports lazy piped Effect codecs", () =>
    Effect.gen(function* () {
      const encoded = yield* pipe({ at, event: "updated", data: { count: 2, label: "a" } }, Envelope.encode(events));
      const decoded = yield* pipe(line(encoded), Envelope.decode(events));
      expectTypeOf(decoded).toEqualTypeOf<EnvelopeUnion<Registry>>();
      expect(decoded.data).toEqual({ count: 2, label: "a" });
      expect(encoded).toBe(yield* Envelope.encode({ at, event: "updated", data: { count: 2, label: "a" } }, events));
    }),
  );

  it("preserves byte offsets across CRLF, blank lines, multibyte characters and torn tails", () => {
    const source = '"😀"\r\n\n"é"\n{';
    expect(
      A.map(Line.split(source), ({ offset, end, length, text, terminated }) => ({
        offset,
        end,
        length,
        text,
        terminated,
      })),
    ).toEqual([
      { offset: 0, end: 8, length: 6, text: '"😀"', terminated: true },
      { offset: 8, end: 9, length: 0, text: "", terminated: true },
      { offset: 9, end: 14, length: 4, text: '"é"', terminated: true },
      { offset: 14, end: 15, length: 1, text: "{", terminated: false },
    ]);
    expect(Line.consumedOffset(source)).toBe(14);
    expect(Line.lastValid(source).pipe(O.map((parsed) => parsed.value))).toEqual(O.some("é"));
    expect(A.length(Line.parseAll(source))).toBe(3);
    expect(Line.split("")).toEqual([]);
    expect(A.length(Line.split("\n"))).toBe(1);
    expect(Line.byteLength("\ud800")).toBe(3);
  });

  it.effect("handles both tail-reader forms when the optional window is omitted", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString(path, '\ufeff{"answer":42}\n{');
      const bom = yield* pipe(fs, probeBomBytes(path));
      expect(bom).toBe(3);
      const decode = (window: { readonly text: string }) => Line.lastValid(window.text);
      const direct = yield* readTailUntil(fs, path, bom, decode);
      expect(yield* pipe(fs, readTailUntil(path, bom, decode))).toEqual(direct);
      expect(yield* readTailUntil(fs, path, bom, decode, 2)).toEqual(direct);
      expect(yield* pipe(fs, readTailUntil(path, bom, decode, 2))).toEqual(direct);
      expect(direct.pipe(O.map((parsed) => parsed.line.offset))).toEqual(O.some(0));
    }),
  );

  it("preserves lifecycle literals and the caller's service identity", () => {
    expectTypeOf(Updated.terminal).toEqualTypeOf<false>();
    expectTypeOf(Closed.terminal).toEqualTypeOf<true>();
    expectTypeOf(Reopened.reopen).toEqualTypeOf<true>();
    expectTypeOf<JsonlEvent.TerminalTags<Registry>>().toEqualTypeOf<"closed">();
    expectTypeOf<JsonlEvent.ReopenTags<Registry>>().toEqualTypeOf<"reopened">();
    expectTypeOf(TestJournal.layer({ path })).toEqualTypeOf<
      Layer.Layer<TestJournal, PlatformError.PlatformError, FileSystem.FileSystem>
    >();
    expect(TestJournal.events).toBe(events);
    expect(TestJournal.key).toBe($I`TestJournal`);
    expect(OtherJournal.key).not.toBe(TestJournal.key);
    expect(Closed.terminal).toBe(true);
  });

  it("derives a discriminated envelope union from the selected event codec", () => {
    const decoded = Envelope.decodeResult(
      line('{"at":"2026-10-06T00:00:00Z","event":"updated","data":{"count":2,"label":"a"}}'),
      events,
    );
    expectTypeOf<Result.Result.Success<typeof decoded>>().toEqualTypeOf<EnvelopeUnion<Registry>>();
    expect(Result.isSuccess(decoded)).toBe(true);
    if (Result.isSuccess(decoded) && decoded.success.event === "updated") {
      expectTypeOf(decoded.success.data).toEqualTypeOf<{ readonly count: number; readonly label: string }>();
      expect(decoded.success.data.count).toBe(2);
    }
  });

  it("does not decode payloads rejected by the frame filter", () => {
    const invalid = line('{"at":"2026-10-06T00:00:00Z","event":"updated","data":{"count":"bad"}}');
    expect(O.isNone(Envelope.decodeSelectedResult(invalid, events, () => false))).toBe(true);
    const selected = Envelope.decodeSelectedResult(invalid, events, () => true);
    expect(O.isSome(selected) && Result.isFailure(selected.value)).toBe(true);
    const unknown = Envelope.decodeResult(line('{"at":"2026-10-06T00:00:00Z","event":"foreign","data":null}'), events);
    expect(Result.isFailure(unknown) && unknown.failure._tag).toBe("UnknownEvent");
  });

  it("decodes a transformed payload once and keeps its decoded type", () => {
    const transformed = [JsonlEvent.make("number", { data: S.FiniteFromString })] as const;
    const encoded = Envelope.encodeResult({ at, event: "number", data: 42 }, transformed);
    expect(Result.isSuccess(encoded)).toBe(true);
    if (Result.isSuccess(encoded)) {
      const decoded = Envelope.decodeResult(line(encoded.success), transformed);
      expect(Result.isSuccess(decoded)).toBe(true);
      if (Result.isSuccess(decoded)) {
        expectTypeOf(decoded.success.data).toEqualTypeOf<number>();
        expect(decoded.success.data).toBe(42);
      }
    }
  });

  it("reports serializability failures in the typed Result channel", () => {
    const permissive = [JsonlEvent.make("unknown", { data: S.Unknown })] as const;
    const encoded = Envelope.encodeResult({ at, event: "unknown", data: 1n }, permissive);
    expect(Result.isFailure(encoded) && encoded.failure._tag).toBe("UnserializableData");
  });

  it("round-trips payloadless events through JSON null", () => {
    const payloadless = [JsonlEvent.make("empty", { data: S.Void })] as const;
    const encoded = Envelope.encodeResult({ at, event: "empty", data: undefined }, payloadless);
    expect(Result.isSuccess(encoded)).toBe(true);
    if (Result.isSuccess(encoded)) {
      const decoded = Envelope.decodeResult(line(encoded.success), payloadless);
      expect(Result.isSuccess(decoded)).toBe(true);
      if (Result.isSuccess(decoded)) {
        expectTypeOf(decoded.success.data).toEqualTypeOf<void>();
        expect(decoded.success.event).toBe("empty");
      }
    }
  });
});

describe("JSONL generic engine", () => {
  it("keeps shallow patches pipeable while excluding prototype keys", () => {
    const patch = S.decodeResult(S.fromJsonString(S.Record(S.String, S.Unknown)))(
      '{"count":2,"nested":{"after":true},"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad"}',
    );
    expect(Result.isSuccess(patch)).toBe(true);
    if (Result.isSuccess(patch)) {
      const base = { count: 1, nested: { before: true } };
      expect(pipe(base, canMerge(patch.success))).toBe(true);
      const merged = pipe(base, shallowMerge(patch.success));
      expect(merged).toEqual({ count: 2, nested: { after: true } });
      expect(R.keys(merged)).toEqual(["count", "nested"]);
      expect(base).toEqual({ count: 1, nested: { before: true } });
    }
  });

  it.effect("delivers live selected events and ends on an excluded terminal event", () =>
    withJournal(
      Effect.gen(function* () {
        const journal = yield* TestJournal;
        yield* journal.create;
        const changes = journal.changes({ events: ["updated"] });
        expectTypeOf<Stream.Success<typeof changes>>().toEqualTypeOf<EnvelopeWithTag<Registry, "updated">>();
        const reader = yield* changes.pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
        yield* journal.append("updated", { count: 1, label: "live" });
        yield* journal.append("closed", null);
        const received = yield* Fiber.join(reader);
        expect(A.map(received, (envelope) => envelope.data.label)).toEqual(["live"]);
      }),
    ),
  );

  it.effect("appends, patches and resumes queries with typed results", () =>
    withJournal(
      Effect.gen(function* () {
        const journal = yield* TestJournal;
        yield* journal.create;
        const first = yield* journal.append("updated", { count: 1, label: "a" });
        expectTypeOf(first).toEqualTypeOf<EnvelopeWithTag<Registry, "updated">>();
        const second = yield* journal.appendPatch("updated", { count: 2 });
        expect(second.data).toEqual({ count: 2, label: "a" });
        expect(second.line.offset).toBe(first.line.end);
        const query = journal.query({ events: ["updated"], cursor: first.line.end });
        expectTypeOf<Stream.Success<typeof query>>().toEqualTypeOf<EnvelopeWithTag<Registry, "updated">>();
        const rows = yield* Stream.runCollect(query);
        expect(A.map(rows, (row) => row.data.count)).toEqual([2]);
        expect(yield* SubscriptionRef.get(journal.latest)).toEqual(O.some(second));
      }),
    ),
  );

  it.effect("replays terminal history, projects selected payloads, and reopens", () =>
    withJournal(
      Effect.gen(function* () {
        const journal = yield* TestJournal;
        yield* journal.create;
        yield* journal.append("updated", { count: 3, label: "a" });
        yield* journal.append("closed", null);
        expect(yield* journal.quiescent).toBe(true);
        const rejected = yield* Effect.result(journal.append("updated", { count: 4, label: "b" }));
        expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("TerminalViolation");
        const projected = yield* journal
          .projection(0, (sum, envelope) => sum + envelope.data.count, { events: ["updated"], cursor: 0 })
          .pipe(Stream.runCollect);
        expect(A.last(projected)).toEqual(O.some(3));
        yield* journal.append("reopened", null);
        expect(yield* journal.quiescent).toBe(false);
        const full = journal.query();
        expectTypeOf<Stream.Success<typeof full>>().toEqualTypeOf<EnvelopeUnion<Registry>>();
        expect(A.length(yield* Stream.runCollect(full))).toBe(3);
      }),
    ),
  );

  it.effect("seeds latest from disk and retains class payloads through patches", () =>
    Effect.gen(function* () {
      class Payload extends S.Class<Payload>($I`Payload`)({ count: S.Finite, label: S.String }) {}
      const definitions = [JsonlEvent.make("boxed", { data: Payload })] as const;
      class BoxedJournal extends Journal.Service<BoxedJournal>()($I`BoxedJournal`, { events: definitions }) {}
      const fs = yield* MemoryFileSystem.make;
      yield* fs.writeFileString(
        path,
        '\ufeff{"at":"2026-10-06T00:00:00Z","event":"boxed","data":{"count":1,"label":"seed"}}\n',
      );
      const context = yield* Layer.build(
        BoxedJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs))),
      );
      yield* Effect.gen(function* () {
        const journal = yield* BoxedJournal;
        const latest = yield* SubscriptionRef.get(journal.latest);
        expect(O.isSome(latest) && latest.value.line.offset).toBe(0);
        const patched = yield* journal.appendPatch("boxed", { count: 2 });
        expect(patched.data).toBeInstanceOf(Payload);
        expect(patched.data.label).toBe("seed");
        expect(patched.data.count).toBe(2);
      }).pipe(Effect.provideContext(context));
    }).pipe(Effect.scoped),
  );
});

// Compile-only negative checks: the callback is never run. Each expected error
// fails the compiler if an invalid operation becomes accepted by the facade.
const rejectsInvalidCalls = (
  journal: JournalShape<Registry>,
  needsService: S.Codec<string, string, FileSystem.FileSystem>,
) => {
  // @ts-expect-error The selected tag controls the payload type.
  const invalid0 = journal.append("updated", { count: "wrong", label: "a" });
  // @ts-expect-error A foreign tag is not in the registry.
  const invalid1 = journal.append("foreign", null);
  // @ts-expect-error A patch must contain fields of the selected payload.
  const invalid2 = journal.appendPatch("updated", { count: "wrong" });
  // @ts-expect-error Narrowing a query requires a runtime event filter.
  const invalid3 = journal.query<"updated">();
  // @ts-expect-error Scope filters cannot justify event narrowing.
  const invalid4 = journal.changes<"updated">({ scopes: ["a"] });
  const invalid5 = journal.projection(
    0,
    // @ts-expect-error A projection cannot narrow through its callback alone.
    (sum, envelope: EnvelopeWithTag<Registry, "updated">) => sum + envelope.data.count,
  );
  // @ts-expect-error Pure codecs must reject service-requiring schemas at registration.
  const invalid6 = JsonlEvent.make("service", { data: needsService });
  // @ts-expect-error Encoding uses the payload for the supplied event tag.
  const invalid7 = Envelope.encodeResult({ at, event: "updated", data: null }, events);
  // @ts-expect-error Piped encoding preserves the selected tag's payload type.
  const invalid8 = Envelope.encodeResult(events)({ at, event: "updated", data: null });
  // @ts-expect-error Effectful piped encoding also rejects foreign tags.
  const invalid9 = Envelope.encode(events)({ at, event: "foreign", data: null });
  return [invalid0, invalid1, invalid2, invalid3, invalid4, invalid5, invalid6, invalid7, invalid8, invalid9];
};
void rejectsInvalidCalls;
