import {
  currentHostArchitecture,
  currentHostPlatform,
  HostProcessArchitecture,
  HostProcessPlatform,
} from "@beep/utils/HostProcess";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const decodeGuardOutput = S.decodeSync(S.fromJsonString(S.Struct({ platform: S.String, arch: S.String })));

describe("HostProcess", () => {
  it("reads the real host platform and architecture on a Node-compatible runtime", () => {
    expect(currentHostPlatform.length).toBeGreaterThan(0);
    expect(currentHostPlatform).not.toBe("browser");
    expect(currentHostArchitecture.length).toBeGreaterThan(0);
    expect(currentHostArchitecture).not.toBe("unknown");
  });

  it.effect(
    "defaults the Effect references to the module constants",
    Effect.fnUntraced(function* () {
      expect(yield* HostProcessPlatform).toBe(currentHostPlatform);
      expect(yield* HostProcessArchitecture).toBe(currentHostArchitecture);
    })
  );

  it.effect(
    "lets tests pin the platform and architecture via provideService",
    Effect.fnUntraced(function* () {
      const pinned = yield* Effect.all([HostProcessPlatform, HostProcessArchitecture]).pipe(
        Effect.provideService(HostProcessPlatform, "win32"),
        Effect.provideService(HostProcessArchitecture, "arm64")
      );
      expect(pinned).toEqual(["win32", "arm64"]);
    })
  );
});

it.layer(NodeServices.layer)("HostProcess browser-eval guard", (it) => {
  // Regression guard for the professional-desktop blank shell: evaluating the
  // `@beep/utils` barrel in an environment with no `process` global (a browser
  // bundle) must not throw, and the host constants must take their fallbacks.
  it.effect(
    "evaluates the @beep/utils barrel without a process global",
    Effect.fnUntraced(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const script = [
        "delete globalThis.process;",
        'const mod = await import("@beep/utils");',
        "console.log(JSON.stringify({ platform: mod.currentHostPlatform, arch: mod.currentHostArchitecture }));",
      ].join("\n");
      const command = ChildProcess.make("bun", ["-e", script], {
        cwd: import.meta.dirname,
        stdout: "pipe",
        stderr: "inherit",
      });
      const output = yield* spawner.string(command);
      expect(decodeGuardOutput(output.trim())).toEqual({ platform: "browser", arch: "unknown" });
    }),
    30_000
  );
});
