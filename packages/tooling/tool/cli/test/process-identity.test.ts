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
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { vi } from "vitest";

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

  it.effect("classifies only same-source mismatches as PID reuse", () =>
    Effect.gen(function* () {
      const inspect = (recorded: string, current: O.Option<string>) =>
        processIdentityStatusWithStartForTesting({ pid: process.pid, procStart: recorded }, current);

      expect(yield* inspect("proc:one", O.some("proc:one"))).toBe("alive");
      expect(yield* inspect("proc:one", O.some("proc:two"))).toBe("dead");
      expect(yield* inspect("one", O.some("two"))).toBe("dead");
      expect(yield* inspect("proc:one", O.some("ps:one"))).toBe("unknown");
      expect(yield* inspect("ps:one", O.some("proc:one"))).toBe("unknown");
      expect(yield* inspect("win:one", O.some("ps:one"))).toBe("unknown");
      expect(yield* inspect("proc:one", O.none())).toBe("unknown");
      expect(yield* inspect("", O.none())).toBe("alive");
      expect(
        yield* processIdentityStatusWithStartForTesting({ pid: DEAD_PID, procStart: "proc:one" }, O.some("proc:one"))
      ).toBe("dead");
    })
  );

  it.effect("retains inconclusive identities and rejects proven reuse", () =>
    Effect.gen(function* () {
      expect(
        yield* isProcessIdentityAliveWithStartForTesting({ pid: process.pid, procStart: "proc:one" }, O.none())
      ).toBe(true);
      expect(
        yield* isProcessIdentityAliveWithStartForTesting(
          { pid: process.pid, procStart: "proc:one" },
          O.some("proc:two")
        )
      ).toBe(false);
    })
  );

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

  it.effect("reads proc identities and uses the recorded source without substitution", () =>
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
    }).pipe(provideScopedLayer(NodeFileSystem.layer))
  );

  it.effect("uses the Windows source when the runtime identifies as Windows", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const platform = Object.getOwnPropertyDescriptor(process, "platform");
        Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
        return platform;
      }),
      () =>
        withProcStat("", processStartIdentityForPid(process.pid)).pipe(
          Effect.tap((identity) => Effect.sync(() => expect(O.isNone(identity)).toBe(true)))
        ),
      (platform) =>
        Effect.sync(() =>
          Object.defineProperty(process, "platform", platform ?? { configurable: true, value: "linux" })
        )
    ).pipe(provideScopedLayer(NodeFileSystem.layer))
  );
});
