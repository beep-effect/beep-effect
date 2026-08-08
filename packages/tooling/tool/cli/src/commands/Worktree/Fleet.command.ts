/**
 * `beep worktree fleet` — read-only rendering of the fleet-mirror snapshot.
 *
 * The subcommand derives one {@link FleetSnapshot} through
 * {@link FleetMirrorService} and renders it, either as text or as JSON. It
 * writes nothing into any checkout and never blocks anything: the mirror is a
 * bulletin, not a gate.
 *
 * Module graph: depends only on the schema leaf (`Worktree.schemas.ts`), the
 * error leaf, and the fleet service, so `Worktree.command.ts` can register
 * this subcommand without an import cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { jsonFlagWith } from "../../internal/cli/Flags.ts";
import { printCommandJson } from "../../internal/cli/Json.ts";
import { FleetMirrorService, FleetMirrorServiceLive } from "./Fleet.service.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import type {
  FleetCheckout,
  FleetContestedPath,
  FleetEpochTarget,
  FleetScanCoverage,
  FleetSnapshot,
} from "./Worktree.schemas.ts";

const shortSha = (sha: string | null): string => (sha === null ? "unknown" : sha.slice(0, 10));

const CONTESTED_RENDER_LIMIT = 20;
const PATH_LIST_RENDER_LIMIT = 6;

const pathList = (paths: ReadonlyArray<string>): string => {
  const shown = A.take(paths, PATH_LIST_RENDER_LIMIT);
  const hidden = paths.length - shown.length;
  return hidden > 0 ? `${A.join(shown, ", ")} (+${hidden} more)` : A.join(shown, ", ");
};

const branchLabel = (row: FleetCheckout): string => {
  if (row.branch !== null) {
    return row.branch;
  }
  if (row.detached === true) {
    return "(detached)";
  }
  return "unknown";
};

const livenessLabel = (row: FleetCheckout): string =>
  row.livenessEvidence.length > 0 ? `${row.liveness} (${A.join(row.livenessEvidence, ", ")})` : row.liveness;

const countLabel = (count: number | null): string => (count === null ? "unknown" : `${count}`);

const conflictLabel = (row: FleetCheckout): string => {
  if (row.conflict === "conflict") {
    return `conflict — ${pathList(row.conflictPaths)}`;
  }
  if (row.conflict === "unknown" && row.conflictReason !== null) {
    return `unknown (${row.conflictReason})`;
  }
  return row.conflict;
};

const policyLabel = (row: FleetCheckout): string => {
  if (row.policyMovement === "moved") {
    return `MOVED — ${pathList(row.policyPaths)}`;
  }
  if (row.policyMovement === "unknown" && row.policyReason !== null) {
    return `unknown (${row.policyReason})`;
  }
  return row.policyMovement;
};

/**
 * Render one fleet-checkout row as indented report lines.
 *
 * **Example** (Render an unknown-heavy row)
 *
 * ```ts
 * import { fleetCheckoutLines, FleetCheckout } from "@beep/repo-cli/commands/Worktree"
 *
 * const lines = fleetCheckoutLines(
 *   FleetCheckout.make({
 *     path: "/fleet/sibling",
 *     kind: "clone",
 *     branch: null,
 *     detached: null,
 *     head: null,
 *     dirtyCount: null,
 *     mergeBase: null,
 *     branchDiffCount: null,
 *     liveness: "unknown",
 *     livenessEvidence: [],
 *     conflict: "unknown",
 *     conflictReason: "head-unknown",
 *     conflictPaths: [],
 *     policyMovement: "unknown",
 *     policyReason: "head-unknown",
 *     policyPaths: [],
 *   })
 * )
 * console.log(lines.length) // 3
 * ```
 *
 * @param row - The derived fleet-checkout row to render.
 * @returns Three report lines: identity, branch and liveness, then counts and signals.
 * @category formatting
 * @since 0.0.0
 */
export const fleetCheckoutLines = (row: FleetCheckout): ReadonlyArray<string> => [
  `- ${row.path} [${row.kind}]`,
  `    branch ${branchLabel(row)} @ ${shortSha(row.head)}  liveness: ${livenessLabel(row)}`,
  `    dirty: ${countLabel(row.dirtyCount)}  branch-diff: ${countLabel(row.branchDiffCount)} (base ${shortSha(
    row.mergeBase
  )})  conflict: ${conflictLabel(row)}  policy: ${policyLabel(row)}`,
];

const targetLabel = (target: FleetEpochTarget): string =>
  target.sha === null
    ? `${target.ref} @ unknown (remote unresolved — signals 2 and 3 read unknown)`
    : `${target.ref} @ ${shortSha(target.sha)}${
        target.materialized ? "" : " (unmaterialized — signals 2 and 3 read unknown)"
      }`;

const coverageLabel = (coverage: FleetScanCoverage): string =>
  `${coverage.clonesDiscovered} clone(s), ${coverage.checkoutsDiscovered} checkout(s), ` +
  `${coverage.checkoutsDegraded} degraded; processes: ${coverage.processesScanned} scanned, ` +
  `${coverage.processesUnreadable} unreadable`;

const snapshotHeaderLines = (snapshot: FleetSnapshot): ReadonlyArray<string> => [
  `Fleet root: ${snapshot.fleetRoot}`,
  `Origin:     ${snapshot.originUrl}`,
  `Target:     ${targetLabel(snapshot.target)}`,
  `Coverage:   ${coverageLabel(snapshot.coverage)}`,
];

const contestedLines = (contested: ReadonlyArray<FleetContestedPath>): ReadonlyArray<string> => {
  if (contested.length === 0) {
    return A.empty();
  }
  const shown = A.map(
    A.take(contested, CONTESTED_RENDER_LIMIT),
    (entry) => `  ${entry.path} — ${A.join(entry.checkouts, ", ")}`
  );
  const hidden = contested.length - CONTESTED_RENDER_LIMIT;
  const overflow = hidden > 0 ? [`  … and ${hidden} more (use --json for the full list)`] : A.empty<string>();
  return A.appendAll(A.prepend(shown, `Contested paths (${contested.length}):`), overflow);
};

const renderFleetSnapshot = Effect.fn("Fleet.renderFleetSnapshot")(function* (snapshot: FleetSnapshot) {
  yield* Effect.forEach(snapshotHeaderLines(snapshot), Console.log);
  if (snapshot.checkouts.length === 0) {
    yield* Console.log("No checkouts sharing this origin were found under the fleet root.");
    return;
  }
  yield* Effect.forEach(A.flatMap(snapshot.checkouts, fleetCheckoutLines), Console.log);
  yield* Effect.forEach(contestedLines(snapshot.contestedPaths), Console.log);
});

const runWorktreeFleet = Effect.fn("Fleet.runWorktreeFleet")(function* (json: boolean) {
  const service = yield* FleetMirrorService;
  const snapshot = yield* service.scan();
  if (json) {
    yield* printCommandJson(snapshot).pipe(
      Effect.mapError(WorktreeCommandError.new("Failed to print the fleet snapshot as JSON."))
    );
    return;
  }
  yield* renderFleetSnapshot(snapshot);
});

/**
 * The `worktree fleet` subcommand.
 *
 * **Example** (Reference the subcommand)
 *
 * ```ts
 * import { worktreeFleetCommand } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(typeof worktreeFleetCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const worktreeFleetCommand = Command.make(
  "fleet",
  {
    json: jsonFlagWith("Render the fleet snapshot as JSON"),
  },
  Effect.fn(function* ({ json }) {
    yield* runWorktreeFleet(json).pipe(
      Effect.catchTag(
        "WorktreeCommandError",
        Effect.fn(function* (error) {
          yield* Console.error(`worktree fleet: ${error.message}`);
          return yield* failWithReportedExit(`worktree fleet: ${error.message}`);
        })
      )
    );
  })
).pipe(
  Command.withDescription(
    "Derive a read-only fleet mirror: per-checkout liveness, conflict prediction, and policy movement across every checkout sharing this origin"
  ),
  Command.provide(FleetMirrorServiceLive)
);
