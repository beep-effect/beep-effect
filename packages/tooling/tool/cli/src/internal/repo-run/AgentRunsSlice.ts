/**
 * The `agent-runs.slice` systemd user units that admitted run scopes join.
 *
 * **Details**
 *
 * `enterRunScope` starts every `agent-run-<ticket>.scope` (and detached
 * `beep-proof-<jobId>.service` units) under `agent-runs.slice`. Without these
 * installed units systemd creates a transient slice with default accounting;
 * installing them applies the workstation heavy budget and the systemd-oomd
 * pressure policy. Rendering changes no live unit: the operator reloads the
 * user manager after an install.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { systemdUserUnitDir } from "@beep/repo-cli-kit/systemd/SystemdUnit";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/AgentRunsSlice");

/**
 * One rendered `agent-runs.slice` unit file, relative to the systemd user unit directory.
 *
 * **Example** (Describe a drop-in)
 *
 * ```ts
 * import { AgentRunsSliceUnit } from "@beep/repo-cli/test/RepoRun"
 *
 * const unit = AgentRunsSliceUnit.make({ relativePath: ["agent-runs.slice.d", "50-oomd.conf"], text: "[Slice]\n" })
 * console.log(unit.relativePath.join("/")) // "agent-runs.slice.d/50-oomd.conf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AgentRunsSliceUnit extends S.Opaque<AgentRunsSliceUnit, { readonly brand: unique symbol }>()(
  S.Struct({
    relativePath: S.Array(S.String),
    text: S.String,
  }).pipe(
    $I.annoteSchema("AgentRunsSliceUnit", {
      description: "One agent-runs.slice unit file and its path under the systemd user unit directory.",
    })
  )
) {}

const SLICE_UNIT_TEXT = `# Install:
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

const OOMD_DROP_IN_TEXT = `# Preserve the workstation heavy-budget pressure policy. This source is
# declarative; agents do not install or reload the unit as part of this port.
[Slice]
ManagedOOMMemoryPressure=kill
ManagedOOMMemoryPressureLimit=50%
`;

/**
 * The rendered `agent-runs.slice` unit and its systemd-oomd drop-in, in install order.
 *
 * **Example** (List the rendered unit paths)
 *
 * ```ts
 * import { AGENT_RUNS_SLICE_UNITS } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AGENT_RUNS_SLICE_UNITS.map((unit) => unit.relativePath.join("/")))
 * // ["agent-runs.slice", "agent-runs.slice.d/50-oomd.conf"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const AGENT_RUNS_SLICE_UNITS: ReadonlyArray<AgentRunsSliceUnit> = [
  AgentRunsSliceUnit.make({ relativePath: ["agent-runs.slice"], text: SLICE_UNIT_TEXT }),
  AgentRunsSliceUnit.make({ relativePath: ["agent-runs.slice.d", "50-oomd.conf"], text: OOMD_DROP_IN_TEXT }),
];

/**
 * Write the `agent-runs.slice` units into a home's systemd user unit directory.
 *
 * **Gotchas**
 *
 * Only writes files: it never calls `systemctl`, so the caller tells the
 * operator to run `systemctl --user daemon-reload`.
 *
 * **Example** (Install into a home directory)
 *
 * ```ts
 * import { installAgentRunsSlice } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(installAgentRunsSlice("/home/op"))) // true
 * ```
 *
 * @param home - Operator home directory whose `.config/systemd/user` receives the units.
 * @returns The absolute paths written, in install order.
 * @category utilities
 * @since 0.0.0
 */
export const installAgentRunsSlice = Effect.fn("AgentRunsSlice.install")(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const unitDir = systemdUserUnitDir(path, home);
  return yield* Effect.forEach(AGENT_RUNS_SLICE_UNITS, (unit) => {
    const target = path.join(unitDir, ...unit.relativePath);
    return fs
      .makeDirectory(path.dirname(target), { recursive: true })
      .pipe(Effect.andThen(fs.writeFileString(target, unit.text)), Effect.as(target));
  });
});

/**
 * Render every `agent-runs.slice` unit as one printable listing.
 *
 * **Details**
 *
 * Each file is introduced by a `# ~/.config/systemd/user/<path>` comment line,
 * which systemd would also ignore, followed by the exact unit text.
 *
 * **Example** (Print the listing)
 *
 * ```ts
 * import { renderAgentRunsSliceListing } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(renderAgentRunsSliceListing().startsWith("# ~/.config/systemd/user/agent-runs.slice\n")) // true
 * ```
 *
 * @returns The listing, ending with a newline.
 * @category utilities
 * @since 0.0.0
 */
export const renderAgentRunsSliceListing = (): string =>
  A.join(
    A.map(AGENT_RUNS_SLICE_UNITS, (unit) => `# ~/.config/systemd/user/${A.join(unit.relativePath, "/")}\n${unit.text}`),
    ""
  );
