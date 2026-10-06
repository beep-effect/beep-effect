import { $ScratchpadId } from "@beep/identity/packages";
import { Envelope, Journal, type JournalConfig, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { Effect } from "effect";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

export const $I = $ScratchpadId.create("test/jsonl");
export const path = "/journal/events.jsonl";
export const at = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
export const Noted = JsonlEvent.make("noted", {
  data: S.Struct({ round: S.Finite, label: S.String, optional: S.optionalKey(S.String) }),
});
export const Ended = JsonlEvent.make("ended", { data: S.Null, terminal: true });
export const Reopened = JsonlEvent.make("reopened", { data: S.Null, reopen: true });
export const events = Tuple.make(Noted, Ended, Reopened);
export class TestJournal extends Journal.Service<TestJournal>()($I`TestJournal`, { events }) {}
export const line: { (round: number, label?: string): string; (label?: string): (round: number) => string } = dual(
  (args) => P.isNumber(args[0]),
  (round: number, label = "seed") =>
    Result.getOrThrow(Envelope.encodeResult({ at, event: "noted", data: { round, label } }, events))
);
export const open = Effect.fn("JsonlTest.open")(function* (
  fs: FileSystem.FileSystem,
  config: JournalConfig = { path }
) {
  const context = yield* Layer.build(
    TestJournal.layer(config).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
  );
  return Context.get(context, TestJournal);
});
export const memory = Effect.fn("JsonlTest.memory")(function* () {
  const fs = yield* MemoryFileSystem.make;
  yield* fs.makeDirectory("/journal");
  return fs;
});
export const externalAppend = Effect.fn("JsonlTest.externalAppend")(function* (
  fs: FileSystem.FileSystem,
  text: string
) {
  const handle = yield* fs.open(path, { flag: "a" });
  yield* handle.writeAll(new TextEncoder().encode(text));
}, Effect.scoped);
