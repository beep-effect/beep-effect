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

import { Git } from "@beep/git/Git";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { jsonFlagWith } from "@beep/repo-cli-kit/cli/Flags";
import { printCommandJson } from "@beep/repo-cli-kit/cli/Json";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O } from "@beep/utils";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { layerSessionLedgerLive } from "../Session/SessionLedger.service.ts";
import { detectPrRepository } from "../Yeet/internal/ProvenanceFooter.ts";
import { FleetMirrorService, FleetMirrorServiceLive } from "./Fleet.service.ts";
import {
  FleetCheckoutDescription,
  FleetJoinedRow,
  FleetRegistryRow,
  FleetSeatRole,
} from "./internal/FleetRegistry.schemas.ts";
import {
  describeFleetCheckout,
  FleetRegistryStore,
  FleetRegistryStoreLive,
  joinFleetRows,
  loadFleetJoin,
  registerFleetRegistryRow,
} from "./internal/FleetRegistry.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import { FleetScanOptions } from "./Worktree.schemas.ts";
import type { SessionLedgerRow } from "../Session/Session.schemas.ts";
import type { PrRepository } from "../Yeet/internal/Provenance.ts";
import type { ConfiguredFleetRoots } from "./internal/FleetRoots.schemas.ts";
import type {
  FleetCheckout,
  FleetContestedPath,
  FleetEpochTarget,
  FleetScanCoverage,
  FleetSnapshot,
} from "./Worktree.schemas.ts";

const shortSha = (sha: string | null): string => (sha === null ? "unknown" : Str.slice(0, 10)(sha));

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

const liveCheckoutSet = (checkouts: ReadonlyArray<FleetCheckout>): MutableHashSet.MutableHashSet<string> => {
  const live = MutableHashSet.empty<string>();
  for (const row of checkouts) {
    if (row.liveness === "live") {
      MutableHashSet.add(live, row.path);
    }
  }
  return live;
};

/**
 * Rank contested paths for display: rows contested by more live checkouts
 * first, then by more claimants overall, then by path.
 *
 * **Details**
 *
 * The snapshot's `contestedPaths` stay sorted by path — that is the canonical
 * JSON ordering. Ranking is a display concern: an unweighted path sort lets
 * one high-dirty checkout swamp the truncated text rendering with rows only
 * it contests, burying the cross-live contention the mirror exists to
 * surface.
 *
 * **Example** (A path claimed by a live checkout outranks an earlier-sorted stale one)
 *
 * ```ts
 * import { FleetCheckout, FleetContestedPath, rankContestedPaths } from "@beep/repo-cli/commands/Worktree"
 *
 * const busy = FleetCheckout.make({
 *   path: "/fleet/busy",
 *   kind: "clone",
 *   branch: null,
 *   detached: null,
 *   head: null,
 *   dirtyCount: null,
 *   mergeBase: null,
 *   branchDiffCount: null,
 *   liveness: "live",
 *   livenessEvidence: ["claude-session"],
 *   conflict: "unknown",
 *   conflictReason: "head-unknown",
 *   conflictPaths: [],
 *   policyMovement: "unknown",
 *   policyReason: "head-unknown",
 *   policyPaths: [],
 * })
 * const stale = FleetContestedPath.make({ path: "a.ts", checkouts: ["/fleet/idle", "/fleet/other"] })
 * const active = FleetContestedPath.make({ path: "b.ts", checkouts: ["/fleet/idle", "/fleet/busy"] })
 * const ranked = rankContestedPaths([stale, active], [busy])
 * console.log(ranked[0]?.path) // "b.ts"
 * ```
 *
 * @param contested - Contested paths in canonical (path-sorted) order.
 * @param checkouts - The snapshot's checkout rows, consulted for liveness.
 * @returns The same entries ranked live-claimants-first for text rendering.
 * @category formatting
 * @since 0.0.0
 */
export const rankContestedPaths: {
  (
    contested: ReadonlyArray<FleetContestedPath>,
    checkouts: ReadonlyArray<FleetCheckout>
  ): ReadonlyArray<FleetContestedPath>;
  (
    checkouts: ReadonlyArray<FleetCheckout>
  ): (contested: ReadonlyArray<FleetContestedPath>) => ReadonlyArray<FleetContestedPath>;
} = dual(2, (contested: ReadonlyArray<FleetContestedPath>, checkouts: ReadonlyArray<FleetCheckout>) => {
  const live = liveCheckoutSet(checkouts);
  const liveClaimants = (entry: FleetContestedPath): number =>
    A.length(A.filter(entry.checkouts, (checkout) => MutableHashSet.has(live, checkout)));
  return A.sort(
    contested,
    Order.combine(
      Order.mapInput(Order.flip(Order.Number), liveClaimants),
      Order.combine(
        Order.mapInput(Order.flip(Order.Number), (entry: FleetContestedPath) => A.length(entry.checkouts)),
        Order.mapInput(Order.String, (entry: FleetContestedPath) => entry.path)
      )
    )
  );
});

const CONTESTED_SWAMPING_SHARE = 0.5;

const contestedClaims = (
  contested: ReadonlyArray<FleetContestedPath>
): MutableHashMap.MutableHashMap<string, number> => {
  const claims = MutableHashMap.empty<string, number>();
  for (const entry of contested) {
    for (const checkout of entry.checkouts) {
      MutableHashMap.set(claims, checkout, O.getOrElse(MutableHashMap.get(claims, checkout), () => 0) + 1);
    }
  }
  return claims;
};

/**
 * Note lines flagging checkouts that swamp the contested-path index.
 *
 * **Details**
 *
 * A note fires only when the contested list overflows the render limit —
 * exactly when truncation can hide information — and a single checkout claims
 * more than half the rows. The measured specimen: one checkout with 5,133
 * dirty files occupied 895 of 1,185 contested rows, displacing every
 * cross-live collision from the truncated rendering.
 *
 * **Example** (A short contested list never notes)
 *
 * ```ts
 * import { contestedSwampingNotes, FleetContestedPath } from "@beep/repo-cli/commands/Worktree"
 *
 * const contested = [FleetContestedPath.make({ path: "a.ts", checkouts: ["/fleet/a", "/fleet/b"] })]
 * console.log(contestedSwampingNotes(contested, [])) // []
 * ```
 *
 * @param contested - The snapshot's full contested-path list.
 * @param checkouts - The snapshot's checkout rows, consulted for dirty counts.
 * @returns One note line per swamping checkout, in checkout order.
 * @category formatting
 * @since 0.0.0
 */
export const contestedSwampingNotes: {
  (contested: ReadonlyArray<FleetContestedPath>, checkouts: ReadonlyArray<FleetCheckout>): ReadonlyArray<string>;
  (checkouts: ReadonlyArray<FleetCheckout>): (contested: ReadonlyArray<FleetContestedPath>) => ReadonlyArray<string>;
} = dual(2, (contested: ReadonlyArray<FleetContestedPath>, checkouts: ReadonlyArray<FleetCheckout>) => {
  if (contested.length <= CONTESTED_RENDER_LIMIT) {
    return A.empty();
  }
  const claims = contestedClaims(contested);
  const claimCount = (checkoutPath: string): number => O.getOrElse(MutableHashMap.get(claims, checkoutPath), () => 0);
  const swamping = A.filter(checkouts, (row) => claimCount(row.path) > contested.length * CONTESTED_SWAMPING_SHARE);
  return A.map(
    swamping,
    (row) =>
      `  note: ${row.path} claims ${claimCount(row.path)}/${contested.length} contested rows` +
      ` (dirty: ${countLabel(row.dirtyCount)})`
  );
});

const contestedLines = (
  contested: ReadonlyArray<FleetContestedPath>,
  checkouts: ReadonlyArray<FleetCheckout>
): ReadonlyArray<string> => {
  if (contested.length === 0) {
    return A.empty();
  }
  const shown = A.map(
    A.take(rankContestedPaths(contested, checkouts), CONTESTED_RENDER_LIMIT),
    (entry) => `  ${entry.path} — ${A.join(entry.checkouts, ", ")}`
  );
  const hidden = contested.length - CONTESTED_RENDER_LIMIT;
  const overflow = hidden > 0 ? [`  … and ${hidden} more (use --json for the full list)`] : A.empty<string>();
  return A.appendAll(
    A.appendAll(
      A.prepend(
        contestedSwampingNotes(contested, checkouts),
        `Contested paths (${contested.length}, ranked by live claimants):`
      ),
      shown
    ),
    overflow
  );
};

// `Effect.forEach` passes `(line, index)`; a point-free `Console.log` would print the index after every line.
const printLine = (line: string) => Console.log(line);

/**
 * Print a fleet snapshot as the plain `beep worktree fleet` text report.
 *
 * **Example** (Build the render effect)
 *
 * ```ts
 * import { renderFleetSnapshot } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(typeof renderFleetSnapshot) // "function"
 * ```
 *
 * @param snapshot - The derived snapshot to print.
 * @returns An effect that writes one console line per report line.
 * @category formatting
 * @since 0.0.0
 */
export const renderFleetSnapshot = Effect.fn("Fleet.renderFleetSnapshot")(function* (snapshot: FleetSnapshot) {
  yield* Effect.forEach(snapshotHeaderLines(snapshot), printLine);
  if (snapshot.checkouts.length === 0) {
    yield* Console.log("No checkouts sharing this origin were found under the fleet root.");
    return;
  }
  yield* Effect.forEach(A.flatMap(snapshot.checkouts, fleetCheckoutLines), printLine);
  yield* Effect.forEach(contestedLines(snapshot.contestedPaths, snapshot.checkouts), printLine);
});

const valueOrDash = (value: string | number | null): string => (value === null ? "-" : `${value}`);

const rootsLabel = (roots: ConfiguredFleetRoots): string =>
  `${A.join(
    A.map(roots.roots, (root) => (root.namePrefix === undefined ? root.path : `${root.path}/${root.namePrefix}*`)),
    ", "
  )} (${roots.source})`;

/**
 * Render one compact `fleet --join` row.
 *
 * **Example** (A legacy clone with no ledger history)
 *
 * ```ts
 * import { fleetJoinedRowLine, FleetJoinedRow } from "@beep/repo-cli/test/Worktree"
 *
 * const line = fleetJoinedRowLine(
 *   FleetJoinedRow.make({
 *     path: "/p/beep-effect0",
 *     kind: "clone",
 *     branch: "main",
 *     liveness: "dormant",
 *     dirtyCount: 0,
 *     seatRole: "legacy",
 *     owningSeat: null,
 *     drainStatus: "active",
 *     retentionExempt: false,
 *     lane: null,
 *     pr: null,
 *     state: null,
 *   })
 * )
 * console.log(line.startsWith("- /p/beep-effect0")) // true
 * ```
 *
 * @param row - The joined row to render.
 * @returns One line: identity, mirror facts, registry facts, then ledger facts.
 * @category formatting
 * @since 0.0.0
 */
export const fleetJoinedRowLine = (row: FleetJoinedRow): string =>
  `- ${row.path} [${row.kind}] ${valueOrDash(row.branch)} ${row.liveness} dirty=${countLabel(row.dirtyCount)}` +
  `  role=${row.seatRole} seat=${valueOrDash(row.owningSeat)} drain=${row.drainStatus}` +
  `${row.retentionExempt ? " exempt" : ""}` +
  `  lane=${valueOrDash(row.lane)} pr=${row.pr === null ? "-" : `#${row.pr}`} state=${valueOrDash(row.state)}`;

const ledgerRowLine = (row: SessionLedgerRow): string =>
  `    ${DateTime.formatIso(row.recordedAt)} ${row.state} lane=${row.lane} branch=${row.branch}` +
  ` pr=${O.match(row.pr, { onNone: () => "-", onSome: (pr) => `#${pr}` })} next: ${row.next}`;

/**
 * Render a `fleet describe` expansion as report lines.
 *
 * **Example** (Reference the renderer)
 *
 * ```ts
 * import { fleetDescriptionLines } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof fleetDescriptionLines) // "function"
 * ```
 *
 * @param description - The expansion to render.
 * @returns The mirror lines, the registry line, then one line per ledger row.
 * @category formatting
 * @since 0.0.0
 */
export const fleetDescriptionLines = (description: FleetCheckoutDescription): ReadonlyArray<string> => {
  const registry = description.registry;
  return [
    ...fleetCheckoutLines(description.checkout),
    `    registry: role=${registry.seatRole} seat=${valueOrDash(registry.owningSeat)} drain=${registry.drainStatus}` +
      ` retention-exempt=${registry.retentionExempt}`,
    `    ledger (${description.ledger.length} newest):`,
    ...A.map(description.ledger, ledgerRowLine),
  ];
};

const encodeJoinedRows = S.encodeEffect(S.Array(FleetJoinedRow));
const encodeDescription = S.encodeEffect(FleetCheckoutDescription);

const resolveRepository = Effect.fn("Fleet.resolveRepository")(function* () {
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(WorktreeCommandError.new("Failed to locate the current repository root."))
  );
  return yield* detectPrRepository(repoRoot).pipe(
    Effect.mapError(WorktreeCommandError.new("The fleet registry needs a github.com origin for its repository key."))
  );
});

const printJson = (value: unknown, what: string) =>
  printCommandJson(value).pipe(Effect.mapError(WorktreeCommandError.new(`Failed to print the ${what} as JSON.`)));

/**
 * Print the `fleet --join` view: the roots header, the registry summary and
 * one compact row per checkout, or the joined rows as JSON.
 *
 * **Details**
 *
 * The command resolves `options` and `repository` from the invoking
 * checkout; tests pass a fixture fleet and repository directly.
 *
 * **Example** (Build the join view)
 *
 * ```ts
 * import { FleetScanOptions, printFleetJoin } from "@beep/repo-cli/commands/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * const view = printFleetJoin(FleetScanOptions.make({}), { host: "github.com", owner: "o", name: "r" }, false)
 * console.log(Effect.isEffect(view)) // true
 * ```
 *
 * @param options - Scan options; discovery roots resolve from them.
 * @param repository - The repository keying the registry and session ledger.
 * @param json - Print the joined rows as JSON instead of text.
 * @returns An effect that prints the view.
 * @category cli-commands
 * @since 0.0.0
 */
export const printFleetJoin = Effect.fn("Fleet.printFleetJoin")(function* (
  options: FleetScanOptions,
  repository: PrRepository,
  json: boolean
) {
  const join = yield* loadFleetJoin(options, repository);
  const rows = joinFleetRows({ checkouts: join.snapshot.checkouts, registry: join.registry, ledger: join.ledger });
  if (json) {
    const encoded = yield* encodeJoinedRows(rows).pipe(
      Effect.mapError(WorktreeCommandError.new("Failed to encode the joined fleet rows."))
    );
    yield* printJson(encoded, "joined fleet");
    return;
  }
  yield* Console.log(`Fleet roots: ${rootsLabel(join.roots)}`);
  yield* Console.log(
    `Registry:    ${join.registry.rows.length} row(s); ${join.adopted.length} adopted by this scan` +
      `  (expand one: beep worktree fleet describe <checkout>)`
  );
  yield* Console.log(A.join(A.map(rows, fleetJoinedRowLine), "\n"));
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

const reportFleetError =
  (label: string) =>
  <A, R>(effect: Effect.Effect<A, WorktreeCommandError, R>) =>
    effect.pipe(
      Effect.catchTag(
        "WorktreeCommandError",
        Effect.fn(function* (error) {
          yield* Console.error(`${label}: ${error.message}`);
          return yield* failWithReportedExit(`${label}: ${error.message}`);
        })
      )
    );

const absoluteCheckout = Effect.fn("Fleet.absoluteCheckout")(function* (checkout: string) {
  const path = yield* Path.Path;
  return Str.replace(/\/+$/u, "")(path.resolve(checkout));
});

const DEFAULT_DESCRIBE_LEDGER_ROWS = 5;

/**
 * Print the `fleet describe <checkout>` expansion of one joined row.
 *
 * **Example** (Build the description view)
 *
 * ```ts
 * import { FleetScanOptions, printFleetCheckoutDescription } from "@beep/repo-cli/commands/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * const view = printFleetCheckoutDescription(
 *   FleetScanOptions.make({}),
 *   { host: "github.com", owner: "o", name: "r" },
 *   { checkout: "/p/beep-effect0", ledgerRows: 5, json: false }
 * )
 * console.log(Effect.isEffect(view)) // true
 * ```
 *
 * @param options - Scan options; discovery roots resolve from them.
 * @param repository - The repository keying the registry and session ledger.
 * @param request - The checkout to expand, how many ledger rows to include, and whether to print JSON.
 * @returns An effect that prints the description, failing when the fleet has no such checkout.
 * @category cli-commands
 * @since 0.0.0
 */
export const printFleetCheckoutDescription = Effect.fn("Fleet.printFleetCheckoutDescription")(function* (
  options: FleetScanOptions,
  repository: PrRepository,
  request: { readonly checkout: string; readonly ledgerRows: number; readonly json: boolean }
) {
  const { ledgerRows, json } = request;
  const target = yield* absoluteCheckout(request.checkout);
  const join = yield* loadFleetJoin(options, repository);
  const description = describeFleetCheckout({
    checkouts: join.snapshot.checkouts,
    registry: join.registry,
    ledger: join.ledger,
    checkout: target,
    ledgerLimit: ledgerRows,
  });
  if (O.isNone(description)) {
    return yield* WorktreeCommandError.make({
      message: `No fleet checkout at ${target}; list them with beep worktree fleet --join.`,
      path: target,
    });
  }
  if (json) {
    const encoded = yield* encodeDescription(description.value).pipe(
      Effect.mapError(WorktreeCommandError.new("Failed to encode the fleet checkout description."))
    );
    yield* printJson(encoded, "fleet checkout description");
    return;
  }
  yield* Console.log(A.join(fleetDescriptionLines(description.value), "\n"));
});

const derivedOwningSeat = Effect.fn("Fleet.derivedOwningSeat")(function* (checkout: string) {
  const git = yield* Git;
  const path = yield* Path.Path;
  const commonDir = yield* git.commonDir(checkout).pipe(Effect.option);
  const seat = O.map(commonDir, (output) => path.dirname(path.resolve(checkout, Str.trim(output))));
  return O.getOrNull(O.filter(seat, (value) => value !== checkout));
});

/**
 * Author one checkout's registry row (`fleet register`).
 *
 * **Details**
 *
 * The checkout must be one the fleet discovers. The owning seat is the
 * `owningSeat` request, else the row's current value, else derived from
 * `git rev-parse --git-common-dir`; an existing retention exemption is kept.
 *
 * **Example** (Build the registration)
 *
 * ```ts
 * import { FleetScanOptions, registerFleetCheckout } from "@beep/repo-cli/commands/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const register = registerFleetCheckout(FleetScanOptions.make({}), { host: "github.com", owner: "o", name: "r" }, {
 *   checkout: "/p/beep/seats/main",
 *   role: "main",
 *   owningSeat: O.none(),
 *   retentionExempt: false,
 * })
 * console.log(Effect.isEffect(register)) // true
 * ```
 *
 * @param scan - Scan options; discovery roots resolve from them.
 * @param repository - The repository keying the registry.
 * @param options - The checkout, its seat role, an optional owning seat and the retention exemption flag.
 * @returns An effect that writes the row and prints a confirmation.
 * @category cli-commands
 * @since 0.0.0
 */
export const registerFleetCheckout = Effect.fn("Fleet.registerFleetCheckout")(function* (
  scan: FleetScanOptions,
  repository: PrRepository,
  options: {
    readonly checkout: string;
    readonly role: FleetSeatRole;
    readonly owningSeat: O.Option<string>;
    readonly retentionExempt: boolean;
  }
) {
  const target = yield* absoluteCheckout(options.checkout);
  const mirror = yield* FleetMirrorService;
  const store = yield* FleetRegistryStore;
  const known = yield* mirror.listCheckouts(scan);
  if (!A.contains(known, target)) {
    return yield* WorktreeCommandError.make({
      message: `No fleet checkout at ${target}; register only a checkout the fleet discovers.`,
      path: target,
    });
  }
  const explicitSeat = yield* O.match(options.owningSeat, {
    onNone: () => Effect.succeedNone,
    onSome: (seat) => Effect.asSome(absoluteCheckout(seat)),
  });
  const derivedSeat = yield* derivedOwningSeat(target);
  // The row is built from the registry as it is under the lock, so a concurrent scan's adoption is kept.
  // Owning seat: the flag, else the row's current value, else the git-common-dir derivation.
  const [, row] = yield* store.update(repository, (current) => {
    const existing = A.findFirst(current.rows, (entry) => entry.checkout === target);
    const knownSeat = O.orElse(explicitSeat, () => O.flatMap(existing, (entry) => O.fromNullOr(entry.owningSeat)));
    const next = FleetRegistryRow.make({
      checkout: target,
      seatRole: options.role,
      owningSeat: O.getOrElse(knownSeat, () => derivedSeat),
      drainStatus: O.getOrElse(
        O.map(existing, (entry) => entry.drainStatus),
        () => "active" as const
      ),
      retentionExempt: options.retentionExempt || O.exists(existing, (entry) => entry.retentionExempt),
    });
    return [registerFleetRegistryRow(current, next), next] as const;
  });
  yield* Console.log(`Registered ${target}: role=${row.seatRole} seat=${valueOrDash(row.owningSeat)}`);
});

const fleetJoinLayer = Layer.mergeAll(FleetMirrorServiceLive, FleetRegistryStoreLive, layerSessionLedgerLive);

const worktreeFleetDescribeCommand = Command.make(
  "describe",
  {
    checkout: Argument.String("checkout").pipe(Argument.withDescription("Checkout path to expand")),
    ledgerRows: Flag.Int("ledger-rows").pipe(
      Flag.withDefault(DEFAULT_DESCRIBE_LEDGER_ROWS),
      Flag.withDescription("How many of the newest session-ledger rows to include")
    ),
    json: jsonFlagWith("Render the checkout description as JSON"),
  },
  Effect.fn(function* ({ checkout, ledgerRows, json }) {
    yield* resolveRepository().pipe(
      Effect.flatMap((repository) =>
        printFleetCheckoutDescription(FleetScanOptions.make({}), repository, { checkout, ledgerRows, json })
      ),
      reportFleetError("worktree fleet describe")
    );
  })
).pipe(
  Command.withDescription(
    "Expand one fleet checkout: full mirror record, registry row and its newest session-ledger rows"
  ),
  Command.provide(fleetJoinLayer)
);

const worktreeFleetRegisterCommand = Command.make(
  "register",
  {
    checkout: Argument.String("checkout").pipe(Argument.withDescription("Checkout path to register")),
    role: Flag.Literals("role", FleetSeatRole.literals).pipe(Flag.withDescription("Workload-named seat role")),
    owningSeat: Flag.String("owning-seat").pipe(
      Flag.withDescription("Seat whose .git holds this lane (default: derived from git-common-dir)"),
      Flag.optional
    ),
    retentionExempt: Flag.Boolean("retention-exempt").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Exempt the checkout from retention (an existing exemption is kept)")
    ),
  },
  Effect.fn(function* ({ checkout, role, owningSeat, retentionExempt }) {
    yield* resolveRepository().pipe(
      Effect.flatMap((repository) =>
        registerFleetCheckout(FleetScanOptions.make({}), repository, { checkout, role, owningSeat, retentionExempt })
      ),
      reportFleetError("worktree fleet register")
    );
  })
).pipe(
  Command.withDescription("Author a checkout's seat role, owning seat and retention exemption in the fleet registry"),
  Command.provide(fleetJoinLayer)
);

/**
 * The `worktree fleet` subcommand.
 *
 * **Details**
 *
 * Plain `fleet` and `fleet --json` are the read-only mirror. `--join` adopts
 * unregistered checkouts into the registry and prints one compact row per
 * checkout; `describe` expands one row and `register` authors one.
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
    join: Flag.Boolean("join").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Join mirror rows with registry facts and the newest session-ledger row per checkout")
    ),
  },
  Effect.fn(function* ({ json, join }) {
    yield* (
      join
        ? resolveRepository().pipe(
            Effect.flatMap((repository) => printFleetJoin(FleetScanOptions.make({}), repository, json))
          )
        : runWorktreeFleet(json)
    ).pipe(reportFleetError("worktree fleet"));
  })
).pipe(
  Command.withDescription(
    "Derive a read-only fleet mirror: per-checkout liveness, conflict prediction, and policy movement across every checkout sharing this origin"
  ),
  Command.provide(fleetJoinLayer),
  Command.withSubcommands([worktreeFleetDescribeCommand, worktreeFleetRegisterCommand])
);
