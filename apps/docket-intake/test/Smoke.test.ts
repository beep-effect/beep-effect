/**
 * Smoke check proofs over a scripted `M365` service. Every value is synthetic.
 */
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Cause, Effect, Exit, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { smoke } from "@/Smoke";
import { fixtureConfig } from "./support/Config.ts";
import {
  ambiguous,
  eventsFound,
  FakeM365,
  FakeM365Layer,
  passingScript,
  refused,
  unreachable,
} from "./support/FakeM365.ts";
import type { M365Script } from "./support/FakeM365.ts";

const SmokeLayer = Layer.merge(FakeM365Layer, BunCrypto.layer);

// Run the smoke check against a script; answer how many steps it reported failed, the verbs it
// called and the lines it printed.
const runSmoke = Effect.fnUntraced(function* (script: Partial<M365Script>, write: boolean) {
  const fake = yield* FakeM365;
  yield* Ref.set(fake.script, { ...passingScript, ...script });
  const exit = yield* Effect.exit(smoke(fixtureConfig, write));
  return {
    calls: yield* Ref.get(fake.calls),
    failed: O.map(Exit.match(exit, { onFailure: Cause.findErrorOption, onSuccess: O.none }), (error) => error.failed),
    lines: A.filter(yield* TestConsole.logLines, (line): line is string => Str.isString(line)),
  };
});

describe("@beep/docket-intake smoke check", () => {
  it.layer(SmokeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reads one page of messages and the categories, prints counts only, and writes nothing",
      Effect.fnUntraced(function* () {
        const result = yield* runSmoke({}, false);

        assertNone(result.failed);
        expect(result.calls).toStrictEqual(["listMessages", "listCategories"]);
        expect(result.lines).toStrictEqual([
          "PASS list messages: count=2",
          "PASS list master categories: count=3 docket=2",
          "PASS smoke",
        ]);
      })
    );
  });

  it.layer(SmokeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reports each failed read with its reason and status, and fails the check",
      Effect.fnUntraced(function* () {
        const result = yield* runSmoke(
          { listCategories: Effect.fail(unreachable), listMessages: Effect.fail(refused) },
          false
        );

        assertSome(result.failed, 2);
        expect(result.lines).toStrictEqual([
          "FAIL list messages: response status 403",
          "FAIL list master categories: transport",
          "FAIL smoke: 2 step(s) failed",
        ]);
      })
    );
  });

  it.layer(SmokeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "with --write creates one event, finds it by key and deletes it",
      Effect.fnUntraced(function* () {
        const result = yield* runSmoke({}, true);

        assertNone(result.failed);
        expect(result.calls).toStrictEqual([
          "listMessages",
          "listCategories",
          "createEvent",
          "findEvents",
          "deleteEvent event-1",
        ]);
        expect(A.drop(result.lines, 2)).toStrictEqual([
          "PASS create event: id=event-1",
          "PASS find event by key: count=1",
          "PASS delete event: id=event-1",
          "PASS smoke",
        ]);
      })
    );
  });

  it.layer(SmokeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "still finds and deletes the event when the create reported a failure",
      Effect.fnUntraced(function* () {
        const result = yield* runSmoke({ createEvent: Effect.fail(ambiguous) }, true);

        assertSome(result.failed, 1);
        expect(A.drop(result.calls, 2)).toStrictEqual(["createEvent", "findEvents", "deleteEvent event-1"]);
        expect(A.drop(result.lines, 2)).toStrictEqual([
          "FAIL create event: ambiguous write",
          "PASS find event by key: count=1",
          "PASS delete event: id=event-1",
          "FAIL smoke: 1 step(s) failed",
        ]);
      })
    );
  });

  it.layer(SmokeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails the check when the created event cannot be found, and deletes nothing",
      Effect.fnUntraced(function* () {
        const missing = yield* runSmoke({ findEvents: eventsFound([]) }, true);
        const lookupDown = yield* runSmoke({ findEvents: Effect.fail(unreachable) }, true);

        assertSome(missing.failed, 1);
        assertSome(lookupDown.failed, 1);
        expect(missing.lines).toContain("PASS find event by key: count=0");
        expect(lookupDown.lines).toContain("FAIL find event by key: transport");
        expect(A.filter(lookupDown.calls, Str.startsWith("deleteEvent"))).toStrictEqual([]);
      })
    );
  });

  it.layer(SmokeLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails the check when a found event cannot be deleted",
      Effect.fnUntraced(function* () {
        const result = yield* runSmoke(
          { deleteEvent: Effect.fail(refused), findEvents: eventsFound(["event-1", "event-2"]) },
          true
        );

        assertSome(result.failed, 1);
        expect(A.filter(result.calls, Str.startsWith("deleteEvent"))).toStrictEqual([
          "deleteEvent event-1",
          "deleteEvent event-2",
        ]);
      })
    );
  });
});
