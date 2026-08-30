/**
 * Tests for the in-process hook event bus.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as FileChanged from "../../../claudecode/Hook/Events/FileChanged.ts";
import * as SessionStart from "../../../claudecode/Hook/Events/SessionStart.ts";
import * as Hook from "../../../claudecode/Hook.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fileChanged = (filePath: string) =>
  FileChanged.Input.make({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/repo",
    hook_event_name: "FileChanged",
    file_path: filePath,
    event: "change",
  });

const sessionStart = () =>
  SessionStart.Input.make({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/repo",
    hook_event_name: "SessionStart",
    source: "startup",
  });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HookBus", () => {
  it.effect("publishes events to subscribers", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const hookBus = yield* Hook.Bus.Service;
        const done = yield* Deferred.make<ReadonlyArray<string>>();

        yield* hookBus.stream("FileChanged").pipe(
          Stream.map((event) => event.file_path),
          Stream.take(2),
          Stream.runCollect,
          Effect.flatMap((paths) => Deferred.succeed(done, Array.from(paths))),
          Effect.forkScoped
        );

        yield* Effect.yieldNow;
        yield* hookBus.publish(fileChanged("/repo/a.ts"));
        yield* hookBus.publish(sessionStart());
        yield* hookBus.publish(fileChanged("/repo/b.ts"));

        const paths = yield* Deferred.await(done);
        expect(paths).toEqual(["/repo/a.ts", "/repo/b.ts"]);
      }).pipe(Effect.provide(Hook.Bus.layer))
    )
  );

  it.effect("publish helper sends events through the current bus", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const done = yield* Deferred.make<string>();

        yield* Hook.bus.pipe(
          Effect.flatMap((hookBus) =>
            hookBus.stream("SessionStart").pipe(
              Stream.runHead,
              Effect.flatMap((event) => Deferred.succeed(done, O.isSome(event) ? event.value.source : "missing")),
              Effect.forkScoped
            )
          )
        );

        yield* Effect.yieldNow;
        yield* Hook.publish(sessionStart());

        const source = yield* Deferred.await(done);
        expect(source).toBe("startup");
      }).pipe(Effect.provide(Hook.Bus.layer))
    )
  );
});
/** @effect-diagnostics strictEffectProvide:skip-file -- Vitest cases are application entry points; each provided Layer is composed immediately before the terminal Effect runner. */
