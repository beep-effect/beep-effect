/**
 * `beep explore --check` — read-only packet-stream check.
 *
 * **Details**
 *
 * Scans both packet roots (`goals/`, `explorations/`) for packets that opted
 * into event sourcing (an `ops/events/` directory), folds each stream, and
 * reports forks, chain-integrity issues, and stale or missing trace
 * projections through the existing goals-doctor finding shape. Advisory in
 * this first slice (D8): findings are printed, the exit code stays zero, and
 * the blocking flip arrives later through the established ratchet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Order, Path } from "effect";
import { GoalDoctorFinding } from "../Goals/Doctor.ts";
import { parseGoalManifestText, TEMPLATE_SLUG } from "../Goals/Inventory.ts";
import { decodePacketTraceProjection, isPacketSlug, PacketRoot } from "../Goals/PacketCore/PacketCore.schemas.ts";
import { PacketEventStore, PacketStreamLocator } from "../Goals/PacketCore/PacketEventStore.ts";
import {
  foldPacketEvents,
  packetTraceIsStale,
  projectPacketTrace,
  renderPacketTraceFile,
} from "../Goals/PacketCore/PacketFold.ts";
import { PACKET_TRACE_SEGMENTS } from "../Goals/PacketCore/PacketTransitionWriter.ts";
import type { GoalDoctorFindingKind } from "../Goals/Doctor.ts";
import type {
  PacketDerivedState,
  PacketTraceProjection,
  StoredPacketEvent,
} from "../Goals/PacketCore/PacketCore.schemas.ts";

const finding = (slug: string, kind: GoalDoctorFindingKind, message: string, keySuffix = ""): GoalDoctorFinding =>
  GoalDoctorFinding.make({
    slug,
    kind,
    severity: "advisory",
    key: keySuffix === "" ? `${slug} ${kind}` : `${slug} ${kind} ${keySuffix}`,
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

const traceFindings = Effect.fn("Explore.traceFindings")(function* (
  packetPath: string,
  slug: string,
  derived: PacketDerivedState,
  events: ReadonlyArray<StoredPacketEvent>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tracePath = path.join(packetPath, ...PACKET_TRACE_SEGMENTS);
  const text = yield* fs.readFileString(tracePath).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));
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
    Effect.map(O.some),
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
    Effect.map(O.some),
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
  for (const fork of derived.forks) {
    findings = A.append(
      findings,
      finding(
        slug,
        "packet-stream-fork",
        `two or more children of one parent at seq ${fork.parentSeq} (${A.length(fork.children)} branches); repair the fork before writing.`,
        `${fork.parentSeq}`
      )
    );
  }
  findings = A.appendAll(findings, yield* traceFindings(packetPath, slug, derived, listing.events));
  return { derived, findings };
});

type RootScan = {
  readonly streams: number;
  readonly summaries: ReadonlyArray<string>;
  readonly findings: ReadonlyArray<GoalDoctorFinding>;
};

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
    yield* Console.log("[explore:check] OK: no stream findings.");
    return;
  }
  yield* Console.error("[explore:check] findings (advisory):");
  for (const item of scan.findings) {
    yield* Console.error(findingLine(item));
  }
});

/**
 * Run the read-only packet-stream check over both packet roots.
 *
 * **Details**
 *
 * Advisory-only: findings are printed on stderr in the goals-doctor line
 * format, per-stream derived summaries on stdout, and the effect always
 * succeeds so CI stays green until the blocking ratchet flips.
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
  yield* printCheckReport(merged);
});
