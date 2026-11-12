import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import { makeCommandSource } from "@/LaneSource";
import { LanesSnapshot } from "@/Lanes";
import { ROWS, report } from "./fixtures.ts";

const readWith = Effect.fn("readWith")(function* (command: ChildProcess.Command) {
  const source = yield* makeCommandSource(command);
  return yield* source.read;
});

describe("LaneSource", () => {
  it.layer(BunServices.layer)((it) => {
    it.effect("decodes the command's stdout into lanes", () =>
      Effect.gen(function* () {
        const snapshot = yield* readWith(ChildProcess.make("printf", ["%s", yield* report(ROWS)]));
        expect(LanesSnapshot.guards.LanesLoaded(snapshot) ? snapshot.lanes.length : -1).toBe(5);
      })
    );

    it.effect("turns unreadable output into a failed snapshot", () =>
      Effect.gen(function* () {
        const snapshot = yield* readWith(ChildProcess.make("printf", ["%s", "not json"]));
        expect(snapshot._tag).toBe("LanesFailed");
      })
    );

    it.effect("turns a command that cannot start into a failed snapshot", () =>
      Effect.gen(function* () {
        const snapshot = yield* readWith(ChildProcess.make("lane-cockpit-no-such-binary", []));
        expect(LanesSnapshot.guards.LanesFailed(snapshot) ? snapshot.message : "").toContain(
          "session open --json failed"
        );
      })
    );
  });
});
