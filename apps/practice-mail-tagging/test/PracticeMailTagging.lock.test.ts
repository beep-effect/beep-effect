/**
 * The state-directory writer lock through the real command line: one writer
 * at a time, stale locks taken over, the lock released however a command
 * ends, and read-only commands never touching it.
 */

import { MailTaggingPortError } from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import { PracticeMailTaggingError } from "@/PracticeMailTagging.errors";
import {
  ProcessProbe,
  ProcessProbeLive,
  procStatStartTime,
  StateDirectoryLocked,
  StateLock,
  StateLockHolder,
} from "@/PracticeMailTagging.lock";
import { StateLockLive } from "@/runtime/Layer";
import {
  configOf,
  currentBootId,
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
        yield* writeLock(lockOf({ pid: otherWriterPid }));

        const apply = yield* held(["apply", "--yes"]);
        const watch = yield* held(["watch", "--yes"]);
        const undo = yield* held(["undo", "--run", "tag-0001", "--yes"]);

        expect(apply[Runtime.errorExitCode]).toBe(4);
        expect(apply.message).toBe(`another writer holds the state directory: ${lockPath} (pid ${otherWriterPid})`);
        assertSome(apply.holderPid, otherWriterPid);
        expect(watch.lockPath).toBe(lockPath);
        expect(undo.lockPath).toBe(lockPath);
        expect((yield* outlookNow).serviceBuilds).toBe(0);
        assertSome(yield* lockNow, lockOf({ pid: otherWriterPid }));
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
        yield* writeLock(lockOf({ pid: otherWriterPid }));

        yield* run(["dry-run"]);
        yield* run(["undo", "--run", "tag-0001", "--dry-run"]);
        yield* run(["report"]);

        assertSome(yield* lockNow, lockOf({ pid: otherWriterPid }));
        expect((yield* outlookNow).categoryWrites).toBe(0);
      })
    );
  });
});

describe("state lock, taken and released", () => {
  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("takes over a lock whose process is gone and removes it after the run", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf({ pid: deadPid }));

        yield* run(["apply", "--yes"]);

        expect((yield* outlookNow).categoryWrites).toBe(1);
        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("takes over a lock recorded under this process's own pid", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf({ pid: ownPid, startTime: "100" }));

        yield* run(["apply", "--yes"]);

        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("takes over a lock whose pid now belongs to a process with another start time", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf({ pid: otherWriterPid, startTime: "499" }));

        yield* run(["apply", "--yes"]);

        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("takes over a lock written before the last reboot", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf({ pid: otherWriterPid, bootId: "boot-0000" }));

        yield* run(["apply", "--yes"]);

        assertNone(yield* lockNow);
      })
    );
  });

  it.layer(World, { timeout: "30 seconds" })((it) => {
    it.effect("takes over a lock written without boot id and start time", () =>
      Effect.gen(function* () {
        yield* writeLock(lockOf({ pid: otherWriterPid, bootId: null, startTime: null }));

        yield* run(["apply", "--yes"]);

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
        // The holder records this process's pid, boot id, and start time.
        assertSome(
          betweenPasses,
          `{"pid":${ownPid},"command":"watch","acquiredAt":"1970-01-01T00:00:00.000Z","bootId":"${currentBootId}","startTime":"100"}`
        );
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

  it.layer(ProcessProbeLive.pipe(Layer.provideMerge(BunFileSystem.layer)), { timeout: "30 seconds" })((it) => {
    it.effect("reads this machine's boot id and this process's start time, and none for an unused pid", () =>
      Effect.gen(function* () {
        const probe = yield* ProcessProbe;

        expect(probe.pid).toBe(process.pid);
        expect(O.getOrElse(yield* probe.bootId, () => "")).toMatch(/^[0-9a-f-]{36}$/u);
        expect(O.getOrElse(yield* probe.startTime(process.pid), () => "")).toMatch(/^\d+$/u);
        assertNone(yield* probe.startTime(2_147_483_646));
      })
    );
  });

  it.layer(ProcessProbeLive.pipe(Layer.provideMerge(Platform)), { timeout: "30 seconds" })((it) => {
    it.effect("answers none for every identity when /proc cannot be read", () =>
      Effect.gen(function* () {
        const probe = yield* ProcessProbe;

        assertNone(yield* probe.bootId);
        assertNone(yield* probe.startTime(process.pid));
      })
    );
  });

  it("reads field 22 of a stat line, counting from the last closing parenthesis", () => {
    assertSome(
      procStatStartTime("42 (bun (worker)) S 1 42 42 0 -1 4194560 1 0 0 0 0 0 0 0 20 0 1 0 987654 0 0"),
      "987654"
    );
    assertNone(procStatStartTime("no parenthesis here"));
    assertNone(procStatStartTime("42 (bun) S 1"));
  });

  it("decodes every generated lock holder to itself", () => {
    assertSchemaArbitraryDecodesToSelf(S.toType(StateLockHolder), { runs: 10 });
  });
});
