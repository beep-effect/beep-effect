/**
 * `beep explore --check` — read-only stream-integrity and goal-fleet check.
 *
 * **Details**
 *
 * Scans both packet roots (`goals/`, `explorations/`) for packets that opted
 * into event sourcing (an `ops/events/` directory), folds each stream, and
 * reports forks, chain-integrity issues, and stale or missing trace
 * projections. It also scans every goal manifest for duplicate identities,
 * dependency cycles, unreachable references, and references to packets that
 * have not adopted the v2 convention. All findings use the goals-doctor shape
 * and remain advisory: they are printed while the exit code stays zero.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Order, Path } from "effect";
import { constUndefined, dual } from "effect/Function";
import * as S from "effect/Schema";
import { GoalDoctorFinding } from "../Goals/Doctor.ts";
import { listGoalPackets, parseGoalManifestText, TEMPLATE_SLUG } from "../Goals/Inventory.ts";
import { lintGoalFleet } from "../Goals/Migration/ManifestTranslation.ts";
import { decodePacketTraceProjection, isPacketSlug, PacketRoot } from "../Goals/PacketCore/PacketCore.schemas.ts";
import { PacketEventStore, PacketStreamLocator } from "../Goals/PacketCore/PacketEventStore.ts";
import {
  foldPacketEvents,
  packetTraceIsStale,
  planForkRepair,
  projectPacketTrace,
  renderPacketTraceFile,
} from "../Goals/PacketCore/PacketFold.ts";
import { PACKET_TRACE_SEGMENTS } from "../Goals/PacketCore/PacketTransitionWriter.ts";
import type { GoalDoctorFindingKind } from "../Goals/Doctor.ts";
import type {
  PacketDerivedState,
  PacketForkVerdict,
  PacketTraceProjection,
  StoredPacketEvent,
} from "../Goals/PacketCore/PacketCore.schemas.ts";

const $I = $RepoCliId.create("commands/Explore/Check");

const GoalPacketManifestStatus = S.Struct({
  initiative: S.Struct({ status: S.String }),
}).pipe(
  $I.annoteSchema("GoalPacketManifestStatus", {
    description: "Root-specific goal manifest projection used to compare initiative.status with the event fold.",
  })
);

const ExplorationPacketManifestStatus = S.Struct({
  exploration: S.Struct({ status: S.String }),
}).pipe(
  $I.annoteSchema("ExplorationPacketManifestStatus", {
    description:
      "Root-specific exploration manifest projection used to compare exploration.status with the event fold.",
  })
);

const decodeGoalPacketManifestStatus = S.decodeUnknownEffect(GoalPacketManifestStatus);
const decodeExplorationPacketManifestStatus = S.decodeUnknownEffect(ExplorationPacketManifestStatus);

const finding = (slug: string, kind: GoalDoctorFindingKind, message: string, keySuffix = ""): GoalDoctorFinding =>
  GoalDoctorFinding.make({
    slug,
    kind,
    severity: "advisory",
    key: keySuffix === "" ? `${slug} ${kind}` : `${slug} ${kind} ${keySuffix}`,
    message,
  });

/**
 * Build the stable finding key for one fork from its parent digest.
 *
 * **Example** (Key two forks that share a parent sequence)
 *
 * ```ts
 * import { packetForkFindingKey } from "@beep/repo-cli/commands/Explore/Check"
 * import { PacketForkVerdict } from "@beep/repo-cli/test/Goals"
 *
 * const left = PacketForkVerdict.make({ parent: "a".repeat(64), parentSeq: 2, children: [] })
 * const right = PacketForkVerdict.make({ parent: "b".repeat(64), parentSeq: 2, children: [] })
 *
 * console.log(packetForkFindingKey("demo", left) === packetForkFindingKey("demo", right)) // false
 * ```
 *
 * **Example** (Key a genesis fork that has no parent)
 *
 * ```ts
 * import { packetForkFindingKey } from "@beep/repo-cli/commands/Explore/Check"
 * import { PacketForkVerdict } from "@beep/repo-cli/test/Goals"
 *
 * const genesis = PacketForkVerdict.make({ parentSeq: 0, children: [] })
 *
 * console.log(packetForkFindingKey("demo", genesis)) // "demo packet-stream-fork genesis"
 * ```
 *
 * @param slug - Packet slug carrying the fork.
 * @param fork - Fork verdict whose parent digest identifies the fork.
 * @returns A goals-doctor finding key that does not collide with another fork at the same sequence.
 * @category utilities
 * @since 0.0.0
 */
export const packetForkFindingKey: {
  (slug: string, fork: PacketForkVerdict): string;
  (fork: PacketForkVerdict): (slug: string) => string;
} = dual(
  2,
  (slug: string, fork: PacketForkVerdict): string => `${slug} packet-stream-fork ${fork.parent ?? "genesis"}`
);

const forkFinding = (slug: string, fork: PacketForkVerdict, message: string): GoalDoctorFinding =>
  GoalDoctorFinding.make({
    slug,
    kind: "packet-stream-fork",
    severity: "advisory",
    key: packetForkFindingKey(slug, fork),
    message,
  });

const findingLine = (item: GoalDoctorFinding): string => `- ${item.slug} [${item.kind}] ${item.message}`;

const derivedSummary = (root: string, slug: string, derived: PacketDerivedState): string => {
  const tip = pipe(
    O.fromUndefinedOr(derived.tip),
    O.match({ onNone: () => "empty", onSome: (value) => `${value.seq}@${pipe(value.id, Str.slice(0, 12))}` })
  );
  return `- ${root}/${slug}: revision=${derived.revision} tip=${tip} status=${derived.status ?? "—"} furthest=${derived.furthestStage ?? "—"} resume=${derived.resumeStage ?? "—"}`;
};

const statusDriftFindings = Effect.fn("Explore.statusDriftFindings")(function* (
  root: PacketRoot,
  slug: string,
  packetPath: string,
  derived: PacketDerivedState
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(packetPath, "ops", "manifest.json");
  const text = yield* fs.readFileString(manifestPath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  if (O.isNone(text)) {
    return A.empty<GoalDoctorFinding>();
  }
  const parsed = parseGoalManifestText(text.value);
  if (O.isNone(parsed)) {
    return A.empty<GoalDoctorFinding>();
  }
  const manifestStatus = yield* PacketRoot.$match(root, {
    goals: () =>
      decodeGoalPacketManifestStatus(parsed.value).pipe(Effect.map((manifest) => manifest.initiative.status)),
    explorations: () =>
      decodeExplorationPacketManifestStatus(parsed.value).pipe(Effect.map((manifest) => manifest.exploration.status)),
  }).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  if (O.isNone(manifestStatus) || derived.status === undefined || manifestStatus.value === derived.status) {
    return A.empty<GoalDoctorFinding>();
  }
  return A.of(
    finding(
      slug,
      "packet-status-drift",
      `${manifestPath} status ${manifestStatus.value} disagrees with stream-derived status ${derived.status}.`,
      root
    )
  );
});

const traceFindings = Effect.fn("Explore.traceFindings")(function* (
  packetPath: string,
  slug: string,
  derived: PacketDerivedState,
  events: ReadonlyArray<StoredPacketEvent>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tracePath = path.join(packetPath, ...PACKET_TRACE_SEGMENTS);
  const text = yield* fs.readFileString(tracePath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  if (O.isNone(text)) {
    return A.of(
      finding(
        slug,
        "packet-trace-missing",
        `stream is present but ${tracePath} does not exist; run a guarded transition or regenerate the trace.`
      )
    );
  }
  const parsed = parseGoalManifestText(text.value);
  if (O.isNone(parsed)) {
    return A.of(finding(slug, "packet-trace-stale", `${tracePath} does not parse as JSON; regenerate it.`));
  }
  const trace = yield* decodePacketTraceProjection(parsed.value).pipe(
    Effect.asSome,
    Effect.orElseSucceed(O.none<PacketTraceProjection>)
  );
  if (O.isNone(trace)) {
    return A.of(
      finding(slug, "packet-trace-stale", `${tracePath} does not decode as PacketTraceProjection; regenerate it.`)
    );
  }
  if (packetTraceIsStale(trace.value, derived)) {
    return A.of(
      finding(
        slug,
        "packet-trace-stale",
        `${tracePath} sourceTip/projector no longer match the folded stream; regenerate it.`
      )
    );
  }
  // The trace is a whole-file derivation: any byte drift from the re-rendered
  // projection (not just a moved sourceTip) means the committed copy lies.
  const rendered = yield* renderPacketTraceFile(projectPacketTrace(derived, events)).pipe(
    Effect.asSome,
    Effect.orElseSucceed(O.none<string>)
  );
  if (O.isSome(rendered) && rendered.value !== text.value) {
    return A.of(
      finding(slug, "packet-trace-stale", `${tracePath} content drifts from the folded stream; regenerate it.`)
    );
  }
  return A.empty<GoalDoctorFinding>();
});

const streamFindings = Effect.fn("Explore.streamFindings")(function* (
  root: PacketRoot,
  slug: string,
  packetPath: string
) {
  const store = yield* PacketEventStore;
  const locator = PacketStreamLocator.make({ packet: slug, root, packetPath });
  const listing = yield* store.list(locator);
  const derived = foldPacketEvents({ packet: slug, root, events: listing.events });

  let findings = A.empty<GoalDoctorFinding>();
  for (const item of A.appendAll(listing.issues, derived.issues)) {
    findings = A.append(
      findings,
      finding(slug, "packet-stream-integrity", `${item.fileName}: ${item.kind} — ${item.detail}`, item.fileName)
    );
  }
  const repairPlan = A.isReadonlyArrayNonEmpty(derived.forks)
    ? yield* planForkRepair({ packet: slug, root, events: listing.events }).pipe(
        Effect.map(O.getOrUndefined),
        Effect.orElseSucceed(constUndefined)
      )
    : undefined;
  for (const fork of derived.forks) {
    const planSummary =
      repairPlan !== undefined && repairPlan.fork.parent === fork.parent
        ? ` repair plan (read-only): keep ${pipe(repairPlan.survivor, Str.slice(0, 12))}, rebase ${A.length(repairPlan.rebaseDrafts)} event(s), remove ${A.length(repairPlan.filesToRemove)} file(s).`
        : "";
    findings = A.append(
      findings,
      forkFinding(
        slug,
        fork,
        `two or more children of one parent at seq ${fork.parentSeq} (${A.length(fork.children)} branches); repair the fork before writing.${planSummary}`
      )
    );
  }
  findings = A.appendAll(findings, yield* statusDriftFindings(root, slug, packetPath, derived));
  findings = A.appendAll(findings, yield* traceFindings(packetPath, slug, derived, listing.events));
  return { derived, findings };
});

type RootScan = {
  readonly streams: number;
  readonly summaries: ReadonlyArray<string>;
  readonly findings: ReadonlyArray<GoalDoctorFinding>;
};

const fleetFindingKind = (
  kind: "duplicate-slug" | "dependency-cycle" | "unreachable-packet" | "unmigrated-reference"
): GoalDoctorFindingKind => {
  if (kind === "duplicate-slug") return "packet-fleet-duplicate-slug";
  if (kind === "dependency-cycle") return "packet-fleet-dependency-cycle";
  return kind === "unreachable-packet" ? "packet-fleet-unreachable" : "packet-fleet-unmigrated-reference";
};

const fleetLintFindings = Effect.fn("Explore.fleetLintFindings")(function* () {
  const records = yield* listGoalPackets();
  return A.map(lintGoalFleet(records), (item) =>
    GoalDoctorFinding.make({
      slug: item.slug,
      kind: fleetFindingKind(item.kind),
      severity: "advisory",
      key: `${item.slug} ${item.kind} ${A.join(item.related, ",")}`,
      message: `${item.severity}: ${item.message}`,
    })
  );
});

const scanRootStreams = Effect.fn("Explore.scanRootStreams")(function* (root: PacketRoot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* PacketEventStore;
  const entries = yield* fs.readDirectory(root).pipe(Effect.orElseSucceed(A.empty<string>));

  let streams = 0;
  let summaries = A.empty<string>();
  let findings = A.empty<GoalDoctorFinding>();
  for (const slug of A.sort(entries, Order.String)) {
    if (slug === TEMPLATE_SLUG || Str.startsWith(".")(slug) || !isPacketSlug(slug)) {
      continue;
    }
    const packetPath = path.join(root, slug);
    const present = yield* store.hasStream(packetPath);
    if (!present) {
      continue;
    }
    streams += 1;
    const result = yield* streamFindings(root, slug, packetPath);
    summaries = A.append(summaries, derivedSummary(root, slug, result.derived));
    findings = A.appendAll(findings, result.findings);
  }
  return { streams, summaries, findings };
});

const printCheckReport = Effect.fn("Explore.printCheckReport")(function* (scan: RootScan) {
  yield* Console.log(
    `[explore:check] roots=${A.length(PacketRoot.Options)} streams=${scan.streams} findings=${A.length(scan.findings)}`
  );
  for (const summary of scan.summaries) {
    yield* Console.log(summary);
  }
  if (!A.isReadonlyArrayNonEmpty(scan.findings)) {
    yield* Console.log("[explore:check] OK: no stream-integrity or fleet-graph findings.");
    return;
  }
  yield* Console.error("[explore:check] findings (advisory):");
  for (const item of scan.findings) {
    yield* Console.error(findingLine(item));
  }
});

/**
 * Run the read-only stream-integrity and goal-fleet check.
 *
 * **Details**
 *
 * Advisory-only: stream and fleet-graph findings are printed on stderr in the
 * goals-doctor line format, per-stream derived summaries on stdout, and the
 * effect always succeeds so CI stays green until the blocking ratchet flips.
 *
 * **Example** (Verify the check returns an Effect)
 *
 * ```ts
 * import { runExploreCheck } from "@beep/repo-cli/commands/Explore/Check"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runExploreCheck()))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runExploreCheck = Effect.fn("Explore.runExploreCheck")(function* () {
  let merged: RootScan = { streams: 0, summaries: A.empty<string>(), findings: A.empty<GoalDoctorFinding>() };
  for (const root of PacketRoot.Options) {
    const scan = yield* scanRootStreams(root);
    merged = {
      streams: merged.streams + scan.streams,
      summaries: A.appendAll(merged.summaries, scan.summaries),
      findings: A.appendAll(merged.findings, scan.findings),
    };
  }
  merged = { ...merged, findings: A.appendAll(merged.findings, yield* fleetLintFindings()) };
  yield* printCheckReport(merged);
});
