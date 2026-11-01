/**
 * `beep holds` programs: the list and probe flows over the ledger and probe
 * services, returning the lines the command prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
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
import { HoldFalsifier, HoldId, HoldVersionId } from "./Holds.schemas.ts";
import { HoldLedger, HoldProbe, HoldProbeRequest } from "./Holds.service.ts";
import { HoldSites } from "./Holds.sites.ts";
import { confirmHoldRuns } from "./Holds.verdict.ts";
import type { HoldClaimVersion, HoldLintFinding, ProbeOutcome } from "./Holds.schemas.ts";

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
  const versions = yield* ledger.currentVersions;
  if (A.isReadonlyArrayEmpty(versions)) {
    return ["[holds] no hold records yet."];
  }
  return yield* Effect.forEach(versions, (version) =>
    Effect.map(
      ledger.runsFor(version),
      (runs) =>
        `[holds] ${version.proposition.holdId} (${version.proposition.kind}, ${A.join(version.proposition.subject.packages, ", ")}): ${confirmHoldRuns(runs)} after ${A.length(runs)} run(s)`
    )
  );
});

/**
 * Inputs for {@link runHoldsProbe}.
 *
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
  const version = yield* pipe(
    yield* ledger.currentVersions,
    A.findFirst((candidate) => candidate.proposition.holdId === id),
    O.match({
      onNone: () => HoldsError.make({ reason: "not-found", message: `No current hold record named ${id}.` }),
      onSome: Effect.succeed,
    })
  );
  const run = yield* probe.probe(
    HoldProbeRequest.make({ proposition: version.proposition, holdVersionId: version.id, commitSha: input.commitSha })
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
  const confirmed = confirmHoldRuns(yield* ledger.runsFor(version));
  return A.append(report, `[holds] recorded ${run.id}; confirmed verdict: ${confirmed}`);
});

const manifestsNamedBy = liveAnchorValues((anchor) =>
  anchor._tag === "ManifestDependency" ? O.some(anchor.manifest) : O.none()
);

const lintSnapshot = Effect.fn("Holds.lintSnapshot")(function* (live: ReadonlyArray<HoldClaimVersion>) {
  const sites = yield* HoldSites;
  const snapshot = yield* sites.snapshot(manifestsNamedBy(live));
  return lintHolds(snapshot, live);
});

// The anchor keys each hold lost, from the Orphaned findings.
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

// Version ids are not guaranteed consecutive, so skip any id the ledger already uses.
const unusedVersionId = (holdId: string, n: number, taken: HashSet.HashSet<string>): typeof HoldVersionId.Type =>
  HashSet.has(taken, `${holdId}@${n}`) ? unusedVersionId(holdId, n + 1, taken) : HoldVersionId.make(`${holdId}@${n}`);

// Every anchor the lint can check is gone, so nothing in config still enforces the hold.
const isFullyOrphaned = (version: HoldClaimVersion, gone: ReadonlyArray<string>): boolean =>
  A.length(gone) ===
  A.length(A.filter(version.proposition.subject.anchors, (anchor) => anchor._tag !== "SyncpackHeld"));

// The tombstone keeps the proposition so a re-introduced hold can cite what was retired.
const retract =
  (all: ReadonlyArray<HoldClaimVersion>, at: DateTime.Utc) =>
  (version: HoldClaimVersion, reason: string): HoldClaimVersion => ({
    ...version,
    id: unusedVersionId(
      version.proposition.holdId,
      A.length(A.filter(all, (row) => row.logicalKey === version.logicalKey)) + 1,
      HashSet.fromIterable(A.map(all, (row) => row.id))
    ),
    supersedes: O.some(version.id),
    knowledge: { ...version.knowledge, recordedAt: at },
    review: { _tag: "Retracted", reason, at },
  });

const tombstonesFor = Effect.fn("Holds.tombstones")(function* (
  all: ReadonlyArray<HoldClaimVersion>,
  live: ReadonlyArray<HoldClaimVersion>,
  gone: HashMap.HashMap<string, ReadonlyArray<string>>
) {
  const tombstone = retract(all, yield* DateTime.now);
  return A.getSomes(
    A.map(live, (version) =>
      pipe(
        HashMap.get(gone, version.proposition.holdId),
        O.filter((keys) => isFullyOrphaned(version, keys)),
        O.map((keys) => tombstone(version, `Anchor gone: ${A.join(keys, ", ")}.`))
      )
    )
  );
});

const writeLintFixes = Effect.fn("Holds.writeLintFixes")(function* (
  live: ReadonlyArray<HoldClaimVersion>,
  findings: ReadonlyArray<HoldLintFinding>
) {
  const ledger = yield* HoldLedger;
  const gone = goneAnchorsByHold(findings);
  const tombstones = yield* tombstonesFor(yield* ledger.allVersions, live, gone);
  yield* ledger.appendVersions(tombstones);
  yield* ledger.writeHeldList(heldListFor(yield* ledger.currentVersions));
  // A hold that lost only some anchors may still apply, so it stays live and the lint keeps failing on it.
  const kept = A.filter(live, (version) =>
    O.exists(HashMap.get(gone, version.proposition.holdId), (keys) => !isFullyOrphaned(version, keys))
  );
  return [
    ...A.map(tombstones, (tombstone) => `[holds] tombstoned ${tombstone.id}: ${tombstone.proposition.holdId}`),
    ...A.map(
      kept,
      (version) =>
        `[holds] kept ${version.proposition.holdId}: some anchors remain; update or retire the record by hand`
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
  const before = yield* ledger.currentVersions;
  const initial = yield* lintSnapshot(before);
  const written = write ? yield* writeLintFixes(before, initial) : [];
  const findings = write ? yield* lintSnapshot(yield* ledger.currentVersions) : initial;
  if (A.isReadonlyArrayNonEmpty(findings)) {
    return yield* HoldsError.make({
      reason: "lint",
      message: A.join([...written, ...A.map(findings, holdLintFindingText)], "\n"),
    });
  }
  return A.append(
    written,
    `[holds] lint ok: ${A.length(yield* ledger.currentVersions)} live hold(s) cover every site.`
  );
});

/**
 * Inputs for {@link runHoldsUpdate}.
 *
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

const probeDue = Effect.fn("Holds.probeDue")(function* (version: HoldClaimVersion, input: HoldsUpdateInput) {
  const ledger = yield* HoldLedger;
  const probe = yield* HoldProbe;
  const run = yield* probe.probe(
    HoldProbeRequest.make({ proposition: version.proposition, holdVersionId: version.id, commitSha: input.commitSha })
  );
  if (!input.dryRun) {
    yield* ledger.appendRun(run);
  }
  return `[holds] probed ${version.proposition.holdId}: ${run.verdict} (candidate ${run.candidateVersion})`;
});

const flipLine = (version: HoldClaimVersion, unpinned: boolean, dryRun: boolean): string =>
  unpinned
    ? `[holds] ${dryRun ? "would unpin" : "unpinned"} ${version.proposition.holdId}: flipped; dropped from the held list for this catalog bump`
    : `[holds] flipped ${version.proposition.holdId}: its exit (${version.proposition.exitAction._tag}) needs a reviewed change to the files it anchors`;

const maxLifetimeMillis = 180 * 24 * 60 * 60 * 1000;

// A hold past its lease or its 180-day lifetime escalates whatever its probe says.
const escalationLine = (all: ReadonlyArray<HoldClaimVersion>, now: DateTime.Utc) => (version: HoldClaimVersion) => {
  const firstRecorded = A.reduce(
    A.filter(all, (row) => row.logicalKey === version.logicalKey),
    DateTime.toEpochMillis(version.knowledge.recordedAt),
    (earliest, row) => Math.min(earliest, DateTime.toEpochMillis(row.knowledge.recordedAt))
  );
  const leaseOver =
    version.validTime._tag === "Interval" &&
    O.exists(version.validTime.validTo, (validTo) => DateTime.toEpochMillis(validTo) < DateTime.toEpochMillis(now));
  const lifetimeOver = DateTime.toEpochMillis(now) - firstRecorded > maxLifetimeMillis;
  return leaseOver || lifetimeOver
    ? O.some(
        `[holds] escalate ${version.proposition.holdId}: ${lifetimeOver ? "older than 180 days" : "lease ended"}; exit ${version.proposition.exitAction._tag}, or renew with fresh evidence`
      )
    : O.none();
};

/**
 * The `deps:update` pre-step: probe every due scripted hold, then retire each
 * hold whose probe history is confirmed `Flipped` and whose exit a catalog bump
 * completes.
 *
 * **Details**
 *
 * A probe that fails to run is reported and leaves its hold in place. A flipped
 * hold that anchors an override, patch, OSV exception or version group is
 * reported instead of retired. Retired holds get a `Retracted` tombstone and the
 * syncpack held list is regenerated, so the catalog bump that follows moves the
 * package in the same change. A hold past its lease or 180 days after its first
 * version is reported for escalation. `dryRun` records nothing.
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
  const due = A.filter(
    yield* ledger.currentVersions,
    (version) => version.proposition.falsifier._tag === "Scripted" && isProbeDue(version, now)
  );
  const probed = yield* Effect.forEach(due, (version) =>
    probeDue(version, input).pipe(
      Effect.catchTag("HoldsError", (error) =>
        Effect.succeed(`[holds] probe of ${version.proposition.holdId} did not run: ${error.message}`)
      )
    )
  );
  const live = yield* ledger.currentVersions;
  const flipped = yield* Effect.filter(live, (version) =>
    Effect.map(ledger.runsFor(version), (runs) => confirmHoldRuns(runs) === "Flipped")
  );
  const unpinned = A.filter(flipped, isUnpinnedByCatalogBump);
  if (!input.dryRun) {
    const tombstone = retract(yield* ledger.allVersions, now);
    yield* ledger.appendVersions(
      A.map(unpinned, (version) => tombstone(version, "Flipped: the candidate passed twice; unpinned by deps:update."))
    );
    yield* ledger.writeHeldList(heldListFor(yield* ledger.currentVersions));
  }
  const escalate = escalationLine(yield* ledger.allVersions, now);
  return [
    ...probed,
    ...A.map(flipped, (version) => flipLine(version, isUnpinnedByCatalogBump(version), input.dryRun)),
    ...A.getSomes(
      A.map(
        A.filter(live, (version) => !A.contains(unpinned, version)),
        escalate
      )
    ),
    `[holds] update ${input.dryRun ? "planned (dry run)" : "done"}: ${A.length(due)} probed, ${A.length(unpinned)} unpinned.`,
  ];
});

const leaseText = (version: HoldClaimVersion): string =>
  version.validTime._tag === "Interval"
    ? O.match(version.validTime.validTo, {
        onNone: () => "open lease",
        onSome: (validTo) => `lease to ${validTo.pipe(DateTime.formatIso, Str.slice(0, 10))}`,
      })
    : "unknown lease";

const falsifierText = (version: HoldClaimVersion): string =>
  HoldFalsifier.match(version.proposition.falsifier, {
    Scripted: ({ runtime, command, controlVersion, candidate }) =>
      `scripted (${runtime}) \`${A.join(command, " ")}\`, control ${controlVersion}, candidate ${candidate}`,
    Judgement: ({ question }) => `judgement: ${question}`,
  });

const whyLines = Effect.fn("Holds.whyLines")(function* (head: HoldClaimVersion, versionCount: number) {
  const ledger = yield* HoldLedger;
  const proposition = head.proposition;
  const status =
    head.review._tag === "Retracted"
      ? `tombstoned ${head.review.at.pipe(DateTime.formatIso, Str.slice(0, 10))}: ${head.review.reason}`
      : `live, ${leaseText(head)}, confirmed ${confirmHoldRuns(yield* ledger.runsFor(head))}`;
  return [
    `[holds] ${proposition.holdId} (${proposition.kind}, ${A.join(proposition.subject.packages, ", ")}): ${status}`,
    `  assertion: ${proposition.assertion}`,
    `  probe: ${falsifierText(head)}`,
    `  exit: ${proposition.exitAction._tag}; anchors: ${A.join(A.map(proposition.subject.anchors, anchorKey), ", ")}`,
    `  evidence: ${A.join(head.supportedBy, ", ")}; ${versionCount} version(s)`,
  ];
});

/**
 * Explain every hold record that governs a package: live holds with their
 * lease and confirmed verdict, and tombstoned holds with why they ended.
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
  const all = yield* ledger.allVersions;
  const superseded = HashSet.fromIterable(A.getSomes(A.map(all, (row) => row.supersedes)));
  const heads = A.filter(
    all,
    (row) =>
      !HashSet.has(superseded, row.id) && A.some(row.proposition.subject.packages, holdPackageMatches(packageName))
  );
  if (A.isReadonlyArrayEmpty(heads)) {
    return [`[holds] no hold record governs ${packageName}.`];
  }
  const blocks = yield* Effect.forEach(heads, (head) =>
    whyLines(head, A.length(A.filter(all, (row) => row.logicalKey === head.logicalKey)))
  );
  return A.flatten(blocks);
});
