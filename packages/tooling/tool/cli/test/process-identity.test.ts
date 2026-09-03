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
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect, FileSystem } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { describe, expect, it, vi } from "vitest";

const DEAD_PID = 2_147_483_647;
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

describe("ProcessIdentity", () => {
  it("models every supported source-prefixed identity", () => {
    const isIdentity = S.is(ProcessStartIdentity);

    expect(ProcessIdentitySource.Options).toStrictEqual(["proc", "ps", "win"]);
    expect(ProcessIdentityStatus.Options).toStrictEqual(["alive", "dead", "unknown"]);
    expect(isIdentity("proc:8241991")).toBe(true);
    expect(isIdentity("ps:Thu Sep  3 12:00:00 2026")).toBe(true);
    expect(isIdentity("win:638925552000000000")).toBe(true);
    expect(isIdentity("8241991")).toBe(false);
    expect(isIdentity("proc:")).toBe(false);
  });

  it("parses proc stat field 22 after the final closing parenthesis", () => {
    expect(O.getOrThrow(parseAdmissionProcStatStartTime(PROC_STAT))).toBe("8241991");
    expect(O.isNone(parseAdmissionProcStatStartTime("malformed"))).toBe(true);
  });

  it("classifies only same-source mismatches as PID reuse", async () => {
    const inspect = (recorded: string, current: O.Option<string>) =>
      Effect.runPromise(processIdentityStatusWithStartForTesting({ pid: process.pid, procStart: recorded }, current));

    expect(await inspect("proc:one", O.some("proc:one"))).toBe("alive");
    expect(await inspect("proc:one", O.some("proc:two"))).toBe("dead");
    expect(await inspect("one", O.some("two"))).toBe("dead");
    expect(await inspect("proc:one", O.some("ps:one"))).toBe("unknown");
    expect(await inspect("ps:one", O.some("proc:one"))).toBe("unknown");
    expect(await inspect("win:one", O.some("ps:one"))).toBe("unknown");
    expect(await inspect("proc:one", O.none())).toBe("unknown");
    expect(await inspect("", O.none())).toBe("alive");
    expect(
      await Effect.runPromise(
        processIdentityStatusWithStartForTesting({ pid: DEAD_PID, procStart: "proc:one" }, O.some("proc:one"))
      )
    ).toBe("dead");
  });

  it("retains inconclusive identities and rejects proven reuse", async () => {
    expect(
      await Effect.runPromise(
        isProcessIdentityAliveWithStartForTesting({ pid: process.pid, procStart: "proc:one" }, O.none())
      )
    ).toBe(true);
    expect(
      await Effect.runPromise(
        isProcessIdentityAliveWithStartForTesting({ pid: process.pid, procStart: "proc:one" }, O.some("proc:two"))
      )
    ).toBe(false);
  });

  it("treats permission denial as a live PID", () => {
    const kill = vi.spyOn(process, "kill").mockImplementationOnce(() => {
      throw Object.assign(new Error("permission denied"), { code: "EPERM" });
    });
    try {
      expect(Effect.runSync(isProcessPidAlive(process.pid))).toBe(true);
    } finally {
      kill.mockRestore();
    }
  });

  it("reads proc identities and uses the recorded source without substitution", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        expect(O.getOrThrow(yield* withProcStat(PROC_STAT, processStartTimeForPid(process.pid)))).toBe("8241991");
        expect(O.getOrThrow(yield* withProcStat(PROC_STAT, processStartIdentityForPid(process.pid)))).toBe(
          "proc:8241991"
        );
        expect(
          O.isNone(yield* withProcStat("", processStartIdentityForPid(process.pid, O.some("proc:recorded-start"))))
        ).toBe(true);

        const portable = yield* withProcStat("", processStartIdentityForPid(process.pid));
        expect(O.isSome(portable)).toBe(true);
        if (O.isSome(portable)) {
          expect(Str.startsWith("ps:")(portable.value)).toBe(true);
          expect(O.isSome(yield* processStartIdentityForPid(process.pid, portable))).toBe(true);
        }

        expect(O.isNone(yield* processStartIdentityForPid(DEAD_PID, O.some("ps:missing")))).toBe(true);
        expect(O.isNone(yield* processStartIdentityForPid(process.pid, O.some("win:recorded")))).toBe(true);
      }).pipe(Effect.provide(NodeFileSystem.layer))
    );
  });

  it("uses the Windows source when the runtime identifies as Windows", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    try {
      await Effect.runPromise(
        withProcStat("", processStartIdentityForPid(process.pid)).pipe(Effect.provide(NodeFileSystem.layer))
      ).then((identity) => expect(O.isNone(identity)).toBe(true));
    } finally {
      Object.defineProperty(process, "platform", platform ?? { configurable: true, value: "linux" });
    }
  });
});
