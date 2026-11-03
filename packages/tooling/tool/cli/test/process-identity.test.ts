import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  isProcessIdentityAliveWithStartForTesting,
  isProcessPidAlive,
  ProcessIdentitySource,
  ProcessIdentityStatus,
  ProcessStartIdentity,
  parseAdmissionProcStatStartTime,
  processIdentityStatusWithStartForTesting,
  processStartIdentityForPid,
  processStartTimeForPid,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { HostProcessPlatform } from "@beep/utils";
import { expect, vi } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const DEAD_PID = 2_147_483_647;
const isProcessStartIdentity = S.is(ProcessStartIdentity);
const PROC_STAT = "1234 (bun worker) S 1 1234 1234 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 8241991 0 0";

const withProcStat = Effect.fnUntraced(function* <Value, Error, Requirements>(
  stat: string,
  effect: Effect.Effect<Value, Error, Requirements | FileSystem.FileSystem>
): Effect.fn.Return<Value, Error, Requirements | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const testFileSystem = FileSystem.FileSystem.of({
    ...fs,
    readFileString: Effect.fn("ProcessIdentityTest.readFileString")((target, encoding) =>
      Str.startsWith("/proc/")(target) ? Effect.succeed(stat) : fs.readFileString(target, encoding)
    ),
  });
  return yield* effect.pipe(Effect.provideService(FileSystem.FileSystem, testFileSystem));
});

it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })("ProcessIdentity", (it) => {
  it.effect("keeps process identity unknown when the system inspector cannot spawn", () =>
    Effect.gen(function* () {
      const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
      const spawn = yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi.spyOn(Bun, "spawnSync").mockImplementation(() => {
            throw failure;
          })
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const identity = yield* processStartIdentityForPid(process.pid, O.some("ps:recorded-start"));
      identity.pipe(assertNone);
      expect(spawn).toHaveBeenCalledTimes(1);
    })
  );

  it("models every supported source-prefixed identity", () => {
    expect(ProcessIdentitySource.literals).toStrictEqual(["proc", "ps", "win"]);
    expect(ProcessIdentityStatus.literals).toStrictEqual(["alive", "dead", "unknown"]);
    expect(isProcessStartIdentity("proc:8241991")).toBe(true);
    expect(isProcessStartIdentity("ps:Thu Sep  3 12:00:00 2026")).toBe(true);
    expect(isProcessStartIdentity("win:638925552000000000")).toBe(true);
    expect(isProcessStartIdentity("8241991")).toBe(false);
    expect(isProcessStartIdentity("proc:")).toBe(false);
  });

  it("parses proc stat field 22 after the final closing parenthesis", () => {
    expect(O.getOrThrow(parseAdmissionProcStatStartTime(PROC_STAT))).toBe("8241991");
    parseAdmissionProcStatStartTime("malformed").pipe(assertNone);
  });

  it.effect("classifies only same-source mismatches as PID reuse", () =>
    Effect.gen(function* () {
      const inspect = (recorded: string, current: O.Option<string>) =>
        processIdentityStatusWithStartForTesting({ pid: process.pid, procStart: recorded }, current);

      const inspect1 = yield* inspect("proc:one", O.some("proc:one"));
      expect(inspect1).toBe("alive");
      const inspect2 = yield* inspect("proc:one", O.some("proc:two"));
      expect(inspect2).toBe("dead");
      const inspect3 = yield* inspect("one", O.some("two"));
      expect(inspect3).toBe("dead");
      const inspect4 = yield* inspect("proc:one", O.some("ps:one"));
      expect(inspect4).toBe("unknown");
      const inspect5 = yield* inspect("ps:one", O.some("proc:one"));
      expect(inspect5).toBe("unknown");
      const inspect6 = yield* inspect("win:one", O.some("ps:one"));
      expect(inspect6).toBe("unknown");
      const inspect7 = yield* inspect("proc:one", O.none());
      expect(inspect7).toBe("unknown");
      const inspect8 = yield* inspect("", O.none());
      expect(inspect8).toBe("alive");
      const processIdentityStatusWithStartForTesting9 = yield* processIdentityStatusWithStartForTesting(
        { pid: DEAD_PID, procStart: "proc:one" },
        O.some("proc:one")
      );
      expect(processIdentityStatusWithStartForTesting9).toBe("dead");
    })
  );

  it.effect("retains inconclusive identities and rejects proven reuse", () =>
    Effect.gen(function* () {
      const isProcessIdentityAliveWithStartForTesting10 = yield* isProcessIdentityAliveWithStartForTesting(
        { pid: process.pid, procStart: "proc:one" },
        O.none()
      );
      expect(isProcessIdentityAliveWithStartForTesting10).toBe(true);
      const isProcessIdentityAliveWithStartForTesting11 = yield* isProcessIdentityAliveWithStartForTesting(
        { pid: process.pid, procStart: "proc:one" },
        O.some("proc:two")
      );
      expect(isProcessIdentityAliveWithStartForTesting11).toBe(false);
    })
  );

  it.effect("treats permission denial as a live PID", () =>
    Effect.gen(function* () {
      const kill = vi.spyOn(process, "kill").mockImplementationOnce(() => {
        throw Object.assign(new Error("permission denied"), { code: "EPERM" });
      });
      try {
        const isProcessPidAlive12 = yield* isProcessPidAlive(process.pid);
        expect(isProcessPidAlive12).toBe(true);
      } finally {
        kill.mockRestore();
      }
    })
  );

  it.effect("reads proc identities and uses the recorded source without substitution", () =>
    Effect.gen(function* () {
      const withProcStat13 = yield* withProcStat(PROC_STAT, processStartTimeForPid(process.pid));
      expect(O.getOrThrow(withProcStat13)).toBe("8241991");
      const withProcStat14 = yield* withProcStat(PROC_STAT, processStartIdentityForPid(process.pid));
      expect(O.getOrThrow(withProcStat14)).toBe("8241991");
      const withProcStat15 = yield* withProcStat(
        PROC_STAT,
        processStartIdentityForPid(process.pid, O.some("proc:8241991"))
      );
      expect(O.getOrThrow(withProcStat15)).toBe("proc:8241991");
      (yield* withProcStat("", processStartIdentityForPid(process.pid, O.some("proc:recorded-start")))).pipe(
        assertNone
      );

      const portable = yield* withProcStat("", processStartIdentityForPid(process.pid));
      portable.pipe(O.isSome, assertTrue);
      if (O.isSome(portable)) {
        expect(Str.startsWith("ps:")(portable.value)).toBe(true);
        (yield* processStartIdentityForPid(process.pid, portable)).pipe(O.isSome, assertTrue);
      }

      (yield* processStartIdentityForPid(DEAD_PID, O.some("ps:missing"))).pipe(assertNone);
      (yield* processStartIdentityForPid(process.pid, O.some("win:recorded"))).pipe(assertNone);
    })
  );

  it.effect("uses the Windows source when the runtime identifies as Windows", () =>
    withProcStat("", processStartIdentityForPid(process.pid)).pipe(
      Effect.tap((identity) => Effect.sync(() => identity.pipe(assertNone))),
      Effect.provideService(HostProcessPlatform, "win32")
    )
  );
});
