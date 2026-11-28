/**
 * `beep holds` programs: the list and probe flows over the ledger and probe
 * services, returning the lines the command prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { claimReferenceKey } from "@beep/epistemics/ClaimImport.schema";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HoldsError } from "./Holds.errors.ts";
import {
  anchorKey,
  heldListFor,
  holdLintFindingText,
  holdPackageMatches,
  isProbeDue,
  isUnpinnedByCatalogBump,
  lintHolds,
  liveAnchorValues,
} from "./Holds.inventory.ts";
import {
  HoldClaimEvent,
  HoldExitAction,
  HoldFalsifier,
  HoldId,
  HoldReviewState,
  holdClaimKey,
  holdClaimLabel,
  holdProposition,
} from "./Holds.schemas.ts";
import { HoldLedger, HoldProbe, HoldProbeRequest } from "./Holds.service.ts";
import { HoldSites } from "./Holds.sites.ts";
import { confirmHoldRuns } from "./Holds.verdict.ts";
import type { HoldClaim, HoldLintFinding, ProbeOutcome, ProbeRun } from "./Holds.schemas.ts";

const $I = $RepoCliId.create("commands/Holds/Holds.program");

const decodeHoldId = S.decodeUnknownEffect(HoldId);

const outcomeText = (outcome: ProbeOutcome): string =>
  outcome._tag === "Inconclusive" ? `${outcome._tag} (${outcome.detail})` : outcome._tag;

/**
 * List current hold versions with their confirmed verdicts.
 *
 * **Example** (Build the list program)
 *
 * ```ts
 * import { runHoldsList } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runHoldsList)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runHoldsList = Effect.gen(function* () {
  const ledger = yield* HoldLedger;
  const versions = yield* ledger.currentClaims;
  if (A.isReadonlyArrayEmpty(versions)) {
    return ["[holds] no hold records yet."];
  }
  return yield* Effect.forEach(
    versions,
    (version) =>
      Effect.map(
        ledger.runsFor(version),
        (runs) =>
          `[holds] ${holdProposition(version).holdId} (${holdProposition(version).kind}, ${A.join(holdProposition(version).subject.packages, ", ")}): ${confirmHoldRuns(runs)} after ${A.length(runs)} run(s)`
      ),
    { concurrency: 1 }
  );
});

/**
 * **Example** (Probe input)
 *
 * ```ts
 * import { HoldsProbeInput } from "@beep/repo-cli/commands/Holds"
 *
 * const input = HoldsProbeInput.make({ holdId: "statelyai-model-testing-404", dryRun: true, commitSha: "0".repeat(40) })
 * console.log(input.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HoldsProbeInput extends S.Opaque<HoldsProbeInput, { readonly brand: unique symbol }>()(
  S.Struct({
    holdId: S.String,
    dryRun: S.Boolean,
    commitSha: S.String.check(S.isPattern(/^[0-9a-f]{40}$/)),
  }).pipe(
    $I.annoteSchema("HoldsProbeInput", {
      description: "The hold id as typed, whether to skip recording, and the commit the run is recorded against.",
    })
  )
) {}

/**
 * Probe one hold, append the run unless it is a dry run, and report the
 * confirmed verdict.
 *
 * **Example** (Build the probe program)
 *
 * ```ts
 * import { HoldsProbeInput, runHoldsProbe } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * const program = runHoldsProbe(
 *   HoldsProbeInput.make({ holdId: "statelyai-model-testing-404", dryRun: true, commitSha: "0".repeat(40) })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runHoldsProbe = Effect.fn("Holds.probeProgram")(function* (input: HoldsProbeInput) {
  const id = yield* decodeHoldId(input.holdId).pipe(
    Effect.mapError((cause) =>
      HoldsError.make({ reason: "usage", message: `"${input.holdId}" is not a kebab-case hold id.`, cause })
    )
  );
  const ledger = yield* HoldLedger;
  const probe = yield* HoldProbe;
  const currentVersions1 = yield* ledger.currentClaims;
  const version = yield* pipe(
    currentVersions1,
    A.findFirst((candidate) => holdProposition(candidate).holdId === id),
    O.match({
      onNone: () => HoldsError.make({ reason: "not-found", message: `No current hold record named ${id}.` }),
      onSome: Effect.succeed,
    })
  );
  const run = yield* probe.probe(
    HoldProbeRequest.make({
      proposition: holdProposition(version),
      claim: version.reference,
      commitSha: input.commitSha,
    })
  );
  const report = [
    `[holds] ${id}`,
    `  control   ${run.controlVersion}: ${outcomeText(run.control)}`,
    `  candidate ${run.candidateVersion}: ${outcomeText(run.candidate)}`,
    `  run verdict: ${run.verdict}`,
  ];
  if (input.dryRun) {
    return A.append(report, "[holds] dry run: nothing recorded.");
  }
  yield* ledger.appendRun(run);
  const runsFor2 = yield* ledger.runsFor(version);
  const confirmed = confirmHoldRuns(runsFor2);
  return A.append(report, `[holds] recorded ${run.id}; confirmed verdict: ${confirmed}`);
});

const manifestsNamedBy = liveAnchorValues((anchor) =>
  anchor._tag === "ManifestDependency" ? O.some(anchor.manifest) : O.none()
);

const lintSnapshot = Effect.fn("Holds.lintSnapshot")(function* (live: ReadonlyArray<HoldClaim>) {
  const sites = yield* HoldSites;
  const snapshot = yield* sites.snapshot(manifestsNamedBy(live));
  return lintHolds(snapshot, live);
});

const goneAnchorsByHold = (findings: ReadonlyArray<HoldLintFinding>): HashMap.HashMap<string, ReadonlyArray<string>> =>
  A.reduce(findings, HashMap.empty<string, ReadonlyArray<string>>(), (gone, finding) =>
    finding._tag === "Orphaned"
      ? HashMap.set(
          gone,
          finding.holdId,
          A.append(O.getOrElse(HashMap.get(gone, finding.holdId), A.empty), anchorKey(finding.anchor))
        )
      : gone
  );

const isFullyOrphaned = (version: HoldClaim, gone: ReadonlyArray<string>): boolean =>
  A.length(gone) ===
  A.length(A.filter(holdProposition(version).subject.anchors, (anchor) => anchor._tag !== "SyncpackHeld"));

const retract =
  (at: DateTime.Utc) =>
  (version: HoldClaim, reason: string): HoldClaimEvent =>
    HoldClaimEvent.cases.Review.make({
      claim: version.reference,
      review: HoldReviewState.cases.Retracted.make({ reason, at }),
      at,
    });

const tombstonesFor = Effect.fn("Holds.tombstones")(function* (
  live: ReadonlyArray<HoldClaim>,
  gone: HashMap.HashMap<string, ReadonlyArray<string>>
) {
  const now3 = yield* DateTime.now;
  const tombstone = retract(now3);
  return A.getSomes(
    A.map(live, (version) =>
      pipe(
        HashMap.get(gone, holdProposition(version).holdId),
        O.filter((keys) => isFullyOrphaned(version, keys)),
        O.map((keys) => ({ version, event: tombstone(version, `Anchor gone: ${A.join(keys, ", ")}.`) }))
      )
    )
  );
});

const writeLintFixes = Effect.fn("Holds.writeLintFixes")(function* (
  live: ReadonlyArray<HoldClaim>,
  findings: ReadonlyArray<HoldLintFinding>
) {
  const ledger = yield* HoldLedger;
  const gone = goneAnchorsByHold(findings);
  const tombstones = yield* tombstonesFor(live, gone);
  yield* ledger.appendEvents(A.map(tombstones, (tombstone) => tombstone.event));
  const currentVersions5 = yield* ledger.currentClaims;
  yield* ledger.writeHeldList(heldListFor(currentVersions5));
  const kept = A.filter(live, (version) =>
    O.exists(HashMap.get(gone, holdProposition(version).holdId), (keys) => !isFullyOrphaned(version, keys))
  );
  return [
    ...A.map(
      tombstones,
      ({ version }) => `[holds] tombstoned ${holdClaimLabel(version)}: ${holdProposition(version).holdId}`
    ),
    ...A.map(
      kept,
      (version) =>
        `[holds] kept ${holdProposition(version).holdId}: some anchors remain; update or retire the record by hand`
    ),
  ];
});

/**
 * Compare the ledger with the checkout's hold-shaped config and, with `write`,
 * tombstone orphaned records and regenerate the syncpack held list.
 *
 * **Details**
 *
 * Unrecorded sites cannot be fixed mechanically: each needs a hold record with
 * an exit condition. Any finding left after `write` fails the program.
 *
 * A record is tombstoned only when every anchor the lint can check (all but
 * held-list patterns) is gone. One that keeps some anchors may still apply, so
 * it stays live and the lint keeps failing on it until it is fixed by hand.
 *
 * **Example** (Build the lint program)
 *
 * ```ts
 * import { runHoldsLint } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runHoldsLint(false))) // true
 * ```
 *
 * @param write - Tombstone orphans and regenerate the held list before checking.
 * @returns The report lines when the ledger and the config agree.
 * @category use-cases
 * @since 0.0.0
 */
export const runHoldsLint = Effect.fn("Holds.lintProgram")(function* (write: boolean) {
  const ledger = yield* HoldLedger;
  const before = yield* ledger.currentClaims;
  const initial = yield* lintSnapshot(before);
  const written = write ? yield* writeLintFixes(before, initial) : [];
  const findings = write ? yield* yield* Effect.map(ledger.currentClaims, lintSnapshot) : initial;
  if (A.isReadonlyArrayNonEmpty(findings)) {
    return yield* HoldsError.make({
      reason: "lint",
      message: A.join([...written, ...A.map(findings, holdLintFindingText)], "\n"),
    });
  }
  const currentVersions6 = yield* ledger.currentClaims;
  return A.append(written, `[holds] lint ok: ${A.length(currentVersions6)} live hold(s) cover every site.`);
});

/**
 * **Example** (Plan an update without recording)
 *
 * ```ts
 * import { HoldsUpdateInput } from "@beep/repo-cli/commands/Holds"
 *
 * const input = HoldsUpdateInput.make({ dryRun: true, commitSha: "0".repeat(40) })
 * console.log(input.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HoldsUpdateInput extends S.Opaque<HoldsUpdateInput, { readonly brand: unique symbol }>()(
  S.Struct({
    dryRun: S.Boolean,
    commitSha: S.String.check(S.isPattern(/^[0-9a-f]{40}$/)),
  }).pipe(
    $I.annoteSchema("HoldsUpdateInput", {
      description: "Whether to skip recording, and the commit probe runs are recorded against.",
    })
  )
) {}

const exitText = (version: HoldClaim): string =>
  HoldExitAction.match(holdProposition(version).exitAction, {
    Unpin: () => "Unpin",
    Rewrite: ({ path }) => `Rewrite ${path}`,
    EscalateToGoal: ({ slug }) => `EscalateToGoal goals/${slug}`,
  });

const probeNow = Effect.fn("Holds.probeNow")(function* (version: HoldClaim, commitSha: string) {
  const probe = yield* HoldProbe;
  return yield* probe
    .probe(HoldProbeRequest.make({ proposition: holdProposition(version), claim: version.reference, commitSha }))
    .pipe(
      Effect.map((run) => ({
        run: O.some(run),
        line: `[holds] probed ${holdProposition(version).holdId}: ${run.verdict} (candidate ${run.candidateVersion})`,
      })),
      Effect.catchTag("HoldsError", (error) =>
        Effect.succeed({
          run: O.none<ProbeRun>(),
          line: `[holds] probe of ${holdProposition(version).holdId} did not run; the hold stays: ${error.message}`,
        })
      )
    );
});

const flipLine = (version: HoldClaim, unpinned: boolean, dryRun: boolean): string =>
  unpinned
    ? `[holds] ${dryRun ? "would unpin" : "unpinned"} ${holdProposition(version).holdId}: flipped; dropped from the held list for this catalog bump`
    : `[holds] flipped ${holdProposition(version).holdId}: its exit (${exitText(version)}) needs a reviewed change`;

const maxLifetimeMillis = 180 * 24 * 60 * 60 * 1000;

const escalationLine = (all: ReadonlyArray<HoldClaim>, now: DateTime.Utc) => (version: HoldClaim) => {
  const firstRecorded = A.reduce(
    A.filter(all, (row) => row.logicalKey === version.logicalKey),
    DateTime.toEpochMillis(version.knowledge.start),
    (earliest, row) => Math.min(earliest, DateTime.toEpochMillis(row.knowledge.start))
  );
  const leaseOver =
    version.valid._tag === "Interval" &&
    O.exists(version.valid.validTo, (validTo) => DateTime.toEpochMillis(validTo) < DateTime.toEpochMillis(now));
  const lifetimeOver = DateTime.toEpochMillis(now) - firstRecorded > maxLifetimeMillis;
  return leaseOver || lifetimeOver
    ? O.some(
        `[holds] escalate ${holdProposition(version).holdId}: ${lifetimeOver ? "older than 180 days" : "lease ended"}; exit ${exitText(version)}, or renew with fresh evidence`
      )
    : O.none();
};

/**
 * The `deps:update` pre-step: probe every due scripted hold and every flipped
 * one, then retire each hold whose history, including today's run, is confirmed
 * `Flipped` and whose exit a catalog bump completes.
 *
 * **Details**
 *
 * A probe that fails to run is reported and leaves its hold in place, whatever
 * its earlier runs said. Retirement needs today's run to be one of the two
 * passing runs, so a `latest` that moved since the last probe is re-checked
 * before the bump installs it. A dry run plans with the fresh runs in memory and
 * writes nothing. A flipped
 * hold that anchors an override, patch, OSV exception or version group is
 * reported instead of retired. Retired holds get a `Retracted` tombstone and the
 * syncpack held list is regenerated, so the catalog bump that follows moves the
 * package in the same change. A hold past its lease or 180 days after its first
 * version is reported for escalation and never retired, whatever its probe says.
 *
 * **Example** (Build the update program)
 *
 * ```ts
 * import { HoldsUpdateInput, runHoldsUpdate } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * const program = runHoldsUpdate(HoldsUpdateInput.make({ dryRun: true, commitSha: "0".repeat(40) }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param input - Dry-run flag and the commit runs are recorded against.
 * @returns The report lines.
 * @category use-cases
 * @since 0.0.0
 */
export const runHoldsUpdate = Effect.fn("Holds.updateProgram")(function* (input: HoldsUpdateInput) {
  const ledger = yield* HoldLedger;
  const now = yield* DateTime.now;
  const live = yield* ledger.currentClaims;
  const stored = yield* Effect.forEach(
    live,
    (version) => Effect.map(ledger.runsFor(version), (runs) => [version, runs] as const),
    { concurrency: 1 }
  );
  const toProbe = A.filter(
    stored,
    ([version, runs]) =>
      holdProposition(version).falsifier._tag === "Scripted" &&
      (isProbeDue(version, now) || confirmHoldRuns(runs) === "Flipped")
  );
  const probed = yield* Effect.forEach(
    toProbe,
    ([version, runs]) => Effect.map(probeNow(version, input.commitSha), (result) => ({ version, runs, ...result })),
    { concurrency: 1 }
  );
  const verdicts = A.map(stored, ([version, runs]) => {
    const fresh = A.findFirst(probed, (entry) => holdClaimKey(entry.version) === holdClaimKey(version));
    const freshRun = O.flatMap(fresh, (entry) => entry.run);
    const failed = O.isSome(fresh) && O.isNone(freshRun);
    return { version, freshRun, flipped: !failed && confirmHoldRuns([...O.toArray(freshRun), ...runs]) === "Flipped" };
  });
  const allVersions7 = yield* ledger.allClaims;
  const escalate = escalationLine(allVersions7, now);
  const flipped = A.filter(verdicts, (entry) => entry.flipped);
  const unpinned = A.filter(
    flipped,
    (entry) =>
      O.isSome(entry.freshRun) &&
      isUnpinnedByCatalogBump(holdProposition(entry.version)) &&
      O.isNone(escalate(entry.version))
  );
  if (!input.dryRun) {
    yield* Effect.forEach(A.getSomes(A.map(probed, (entry) => entry.run)), ledger.appendRun, {
      concurrency: 1,
      discard: true,
    });
    const tombstone = retract(now);
    yield* ledger.appendEvents(
      A.map(unpinned, ({ version }) =>
        tombstone(version, "Flipped: the candidate passed twice, the newest run today; unpinned by deps:update.")
      )
    );
    const currentVersions9 = yield* ledger.currentClaims;
    yield* ledger.writeHeldList(heldListFor(currentVersions9));
  }
  return [
    ...A.map(probed, (entry) => entry.line),
    ...A.map(flipped, ({ version }) =>
      flipLine(
        version,
        A.some(unpinned, (entry) => holdClaimKey(entry.version) === holdClaimKey(version)),
        input.dryRun
      )
    ),
    ...A.getSomes(A.map(live, escalate)),
    `[holds] update ${input.dryRun ? "planned (dry run)" : "done"}: ${A.length(probed)} probed, ${A.length(unpinned)} unpinned.`,
  ];
});

const leaseText = (version: HoldClaim): string =>
  version.valid._tag === "Interval"
    ? O.match(version.valid.validTo, {
        onNone: () => "open lease",
        onSome: (validTo) => `lease to ${validTo.pipe(DateTime.formatIso, Str.slice(0, 10))}`,
      })
    : "unknown lease";

const falsifierText = (version: HoldClaim): string =>
  HoldFalsifier.match(holdProposition(version).falsifier, {
    Scripted: ({ runtime, command, controlVersion, candidate }) =>
      `scripted (${runtime}) \`${A.join(command, " ")}\`, control ${controlVersion}, candidate ${candidate}`,
    Judgement: ({ question }) => `judgement: ${question}`,
  });

const whyLines = Effect.fn("Holds.whyLines")(function* (head: HoldClaim, versionCount: number) {
  const ledger = yield* HoldLedger;
  const proposition = holdProposition(head);
  const status =
    head.review._tag === "Retracted"
      ? `tombstoned ${head.review.at.pipe(DateTime.formatIso, Str.slice(0, 10))}: ${head.review.reason}`
      : yield* O.match(head.knowledge.end, {
          onSome: (at) => Effect.succeed(`expired ${at.pipe(DateTime.formatIso, Str.slice(0, 10))}, not live`),
          onNone: () =>
            Effect.map(ledger.runsFor(head), (runs) => `live, ${leaseText(head)}, confirmed ${confirmHoldRuns(runs)}`),
        });
  return [
    `[holds] ${proposition.holdId} (${proposition.kind}, ${A.join(proposition.subject.packages, ", ")}): ${status}`,
    `  assertion: ${proposition.assertion}`,
    `  probe: ${falsifierText(head)}`,
    `  exit: ${exitText(head)}; anchors: ${A.join(A.map(proposition.subject.anchors, anchorKey), ", ")}`,
    `  evidence: ${A.join(head.evidence.supportedBy, ", ")}; ${versionCount} version(s)`,
  ];
});

/**
 * Explain every hold record that governs a package: live holds with their
 * lease and confirmed verdict, and tombstoned holds with why they ended.
 *
 * **Details**
 *
 * Only a live head reads its probe runs. A tombstoned or expired record reports
 * how it ended without them, so damaged run history cannot hide a retirement.
 *
 * **Example** (Build the why program)
 *
 * ```ts
 * import { runHoldsWhy } from "@beep/repo-cli/commands/Holds"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runHoldsWhy("statelyai"))) // true
 * ```
 *
 * @param packageName - The package to explain.
 * @returns The report lines, one block per hold.
 * @category use-cases
 * @since 0.0.0
 */
export const runHoldsWhy = Effect.fn("Holds.whyProgram")(function* (packageName: string) {
  const ledger = yield* HoldLedger;
  const all = yield* ledger.allClaims;
  const superseded = HashSet.fromIterable(A.getSomes(A.map(all, (row) => O.map(row.predecessor, claimReferenceKey))));
  const heads = A.filter(
    all,
    (row) =>
      !HashSet.has(superseded, holdClaimKey(row)) &&
      A.some(holdProposition(row).subject.packages, holdPackageMatches(packageName))
  );
  if (A.isReadonlyArrayEmpty(heads)) {
    return [`[holds] no hold record governs ${packageName}.`];
  }
  const blocks = yield* Effect.forEach(
    heads,
    (head) => whyLines(head, A.length(A.filter(all, (row) => row.logicalKey === head.logicalKey))),
    { concurrency: 1 }
  );
  return A.flatten(blocks);
});
