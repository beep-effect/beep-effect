/**
 * The state-directory writer lock through the real command line: one writer
 * at a time, stale locks taken over, the lock released however a command
 * ends, and read-only commands never touching it.
 */

import { MailTaggingPortError } from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, Fiber, FileSystem, Layer, Runtime } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import { PracticeMailTaggingError } from "@/PracticeMailTagging.errors";
import {
  ProcessProbe,
  ProcessProbeLive,
  StateDirectoryLocked,
  StateLock,
  StateLockHolder,
  signalRefusalMeansAlive,
} from "@/PracticeMailTagging.lock";
import { StateLockLive } from "@/runtime/Layer";
import {
  configOf,
  deadPid,
  failNextListings,
  lockNow,
  lockOf,
  lockPath,
  otherWriterPid,
  outlookNow,
  ownPid,
  Platform,
  pollInterval,
  run,
  settingsEnvironment,
  World,
  writeLock,
} from "./PracticeMailTagging.fixture.ts";

const isLocked = S.is(StateDirectoryLocked);

// Runs a command that must be refused because another writer holds the lock.
const held = (args: ReadonlyArray<string>) => run(args).pipe(Effect.flip, Effect.filterOrElse(isLocked, Effect.die));

describe("state lock, held by another writer", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("refuses apply, watch, and undo --yes with exit code 4 and builds no service", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf(otherWriterPid));

        const apply = yield* held(["apply", "--yes"]);
        const watch = yield* held(["watch", "--yes"]);
        const undo = yield* held(["undo", "--run", "tag-0001", "--yes"]);

        expect(apply[Runtime.errorExitCode]).toBe(4);
        expect(apply.message).toBe(`another writer holds the state directory: ${lockPath} (pid ${otherWriterPid})`);
        assertSome(apply.holderPid, otherWriterPid);
        expect(watch.lockPath).toBe(lockPath);
        expect(undo.lockPath).toBe(lockPath);
        expect((yield* outlookNow).serviceBuilds).toBe(0);
        assertSome(yield* lockNow, lockOf(otherWriterPid));
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("treats an unreadable lock as held by an unknown process", () =>
      Effect.gen(function* () {
        yield* writeLock("not a lock");

        const error = yield* held(["apply", "--yes"]);

        assertNone(error.holderPid);
        expect(Str.endsWith("(pid unknown)")(error.message)).toBe(true);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("lets dry-run, undo --dry-run, and report run without touching the lock", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf(otherWriterPid));

        yield* run(["dry-run"]);
        yield* run(["undo", "--run", "tag-0001", "--dry-run"]);
        yield* run(["report"]);

        assertSome(yield* lockNow, lockOf(otherWriterPid));
        expect((yield* outlookNow).categoryWrites).toBe(0);
      })
    );
  });
});

describe("state lock, taken and released", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("takes over a lock whose process is gone and removes it after the run", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf(deadPid));

        yield* run(["apply", "--yes"]);

        expect((yield* outlookNow).categoryWrites).toBe(1);
        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("releases the lock after a failed run", () =>
      Effect.gen(function* () {
        yield* failNextListings([MailTaggingPortError.during("Mailbox", "listMessagesSince", "HTTP 503")]);

        const error = yield* Effect.flip(run(["apply", "--yes"]));

        assertInstanceOf(error, PracticeMailTaggingError);
        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("holds the lock across watch passes and releases it when watch ends", () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(run(["watch", "--yes", "--max-passes", "2"]));
        yield* TestClock.adjust(0);
        const betweenPasses = yield* lockNow;
        const builds = (yield* outlookNow).serviceBuilds;
        yield* TestClock.adjust(pollInterval);
        yield* Fiber.join(fiber);

        expect(builds).toBe(1);
        assertSome(O.map(betweenPasses, Str.includes(`"pid":${ownPid},"command":"watch"`)), true);
        expect((yield* outlookNow).serviceBuilds).toBe(2);
        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("fails when the state directory cannot hold a lock file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString("/state", "a file where the state directory should be");

        const error = yield* Effect.flip(run(["apply", "--yes"]));

        assertInstanceOf(error, PracticeMailTaggingError);
        expect(error.source).toBe("StateLock");
        expect(Str.startsWith(`cannot create the state lock at ${lockPath}`)(error.message)).toBe(true);
      })
    );
  });
});

describe("StateLockLive and the live process probe", () => {
  it.layer(Layer.provideMerge(StateLockLive.pipe(Layer.provide(configOf(settingsEnvironment))), Platform), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("writes the running process into the configured state directory's lock", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* StateLock.use((lock) => lock.hold("apply"));
        const text = yield* fs.readFileString(
          `${settingsEnvironment.PRACTICE_MAIL_TAGGING_STATE_DIRECTORY}/writer.lock`
        );

        expect(Str.includes(`"pid":${process.pid},"command":"apply"`)(text)).toBe(true);
      })
    );
  });

  it.layer(Platform, { timeout: "30 seconds" })((it) => {
    it.effect("fails to build without a state directory", () =>
      Effect.gen(function* () {
        const error = yield* StateLockLive.pipe(Layer.provide(configOf({})), Layer.build, Effect.flip);

        assertInstanceOf(error, PracticeMailTaggingError);
      })
    );
  });

  it.layer(ProcessProbeLive, { timeout: "30 seconds" })((it) => {
    it.effect("reports this process as alive and an unused process id as gone", () =>
      Effect.gen(function* () {
        const probe = yield* ProcessProbe;

        expect(probe.pid).toBe(process.pid);
        expect(yield* probe.isAlive(process.pid)).toBe(true);
        expect(yield* probe.isAlive(2_147_483_646)).toBe(false);
      })
    );
  });

  it("reads a permission refusal as a live process and any other refusal as gone", () => {
    expect(signalRefusalMeansAlive({ code: "EPERM" })).toBe(true);
    expect(signalRefusalMeansAlive({ code: "ESRCH" })).toBe(false);
    expect(signalRefusalMeansAlive("not an error")).toBe(false);
  });

  it("decodes every generated lock holder to itself", () => {
    assertSchemaArbitraryDecodesToSelf(S.toType(StateLockHolder), { runs: 10 });
  });
});
