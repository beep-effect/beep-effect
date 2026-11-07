import {
  AGENT_RUNS_SLICE_UNITS,
  installAgentRunsSlice,
  renderAgentRunsSliceListing,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";

// Pinned byte for byte to the retired `scripts/systemd/agent-runs.slice` sources. Only the
// install header changed, from `cp scripts/systemd/...` to the command that renders them.
const EXPECTED_SLICE = `# Install:
#   bun run beep quality scheduler slice --install
#   systemctl --user daemon-reload

[Unit]
Description=beep agent run-lease slice

[Slice]
CPUAccounting=yes
MemoryAccounting=yes
IOAccounting=yes
TasksAccounting=yes
# Preserve the workstation's heavy budget adopted from the operator-built
# 50-heavy-budget.conf drop-in. Re-rendering these sources changes no live unit;
# the owner re-syncs installed units separately after merge.
MemoryHigh=48G
MemoryMax=60G
MemorySwapMax=8G
`;

const EXPECTED_OOMD = `# Preserve the workstation heavy-budget pressure policy. This source is
# declarative; agents do not install or reload the unit as part of this port.
[Slice]
ManagedOOMMemoryPressure=kill
ManagedOOMMemoryPressureLimit=50%
`;

const runCli = Effect.fn("AgentRunsSliceTest.runCli")(function* (args: ReadonlyArray<string>, home: string) {
  const path = yield* Path.Path;
  const entry = yield* path.fromFileUrl(new URL("../src/bin.ts", import.meta.url));
  const ambientPath = yield* Config.String("PATH");
  const handle = yield* ChildProcess.make("bun", [entry, "quality", "scheduler", "slice", ...args], {
    // No systemctl stand-in exists on this PATH prefix: the command must not need one.
    env: { HOME: home, PATH: ambientPath },
    extendEnv: false,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = yield* Effect.all(
    [
      handle.exitCode,
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
    ],
    { concurrency: "unbounded" }
  );
  return { exitCode, stdout, stderr };
}, Effect.scoped);

it.layer(NodeServices.layer, { timeout: "60 seconds" })("agent-runs.slice units", (it) => {
  it.effect("renders the slice and its oomd drop-in byte for byte", () =>
    Effect.sync(() => {
      expect(A.map(AGENT_RUNS_SLICE_UNITS, (unit) => [A.join(unit.relativePath, "/"), unit.text])).toEqual([
        ["agent-runs.slice", EXPECTED_SLICE],
        ["agent-runs.slice.d/50-oomd.conf", EXPECTED_OOMD],
      ]);
      expect(renderAgentRunsSliceListing()).toBe(
        `# ~/.config/systemd/user/agent-runs.slice\n${EXPECTED_SLICE}# ~/.config/systemd/user/agent-runs.slice.d/50-oomd.conf\n${EXPECTED_OOMD}`
      );
    })
  );

  it.effect("installs into the home's systemd user directory without reloading the manager", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "agent-runs-slice-" });
      const unitDir = path.join(home, ".config", "systemd", "user");
      const written = yield* installAgentRunsSlice(home);
      expect(written).toEqual([
        path.join(unitDir, "agent-runs.slice"),
        path.join(unitDir, "agent-runs.slice.d", "50-oomd.conf"),
      ]);
      const slice = yield* fs.readFileString(path.join(unitDir, "agent-runs.slice"));
      expect(slice).toBe(EXPECTED_SLICE);
      const oomd = yield* fs.readFileString(path.join(unitDir, "agent-runs.slice.d", "50-oomd.conf"));
      expect(oomd).toBe(EXPECTED_OOMD);
    })
  );

  it.effect("prints by default and --install only writes files and names the reload", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "agent-runs-slice-cli-" });
      const printed = yield* runCli([], home);
      expect(printed).toEqual({ exitCode: 0, stdout: renderAgentRunsSliceListing(), stderr: "" });
      const exists = yield* fs.exists(path.join(home, ".config"));
      expect(exists).toBe(false);
      const installed = yield* runCli(["--install"], home);
      const unitDir = path.join(home, ".config", "systemd", "user");
      expect(installed).toEqual({
        exitCode: 0,
        stdout: `wrote ${path.join(unitDir, "agent-runs.slice")}\nwrote ${path.join(unitDir, "agent-runs.slice.d", "50-oomd.conf")}\nApply with: systemctl --user daemon-reload\n`,
        stderr: "",
      });
      const slice = yield* fs.readFileString(path.join(unitDir, "agent-runs.slice"));
      expect(slice).toBe(EXPECTED_SLICE);
    })
  );
});
