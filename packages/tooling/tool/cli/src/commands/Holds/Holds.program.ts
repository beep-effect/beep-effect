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
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { HoldsError } from "./Holds.errors.ts";
import { anchorKey, heldListFor, holdLintFindingText, lintHolds } from "./Holds.inventory.ts";
import { HoldId, HoldVersionId } from "./Holds.schemas.ts";
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

const manifestsNamedBy = (live: ReadonlyArray<HoldClaimVersion>): ReadonlyArray<string> =>
  pipe(
    live,
    A.flatMap((version) => version.proposition.subject.anchors),
    A.map((anchor) => (anchor._tag === "ManifestDependency" ? O.some(anchor.manifest) : O.none())),
    A.getSomes
  );

const lintSnapshot = Effect.fn("Holds.lintSnapshot")(function* (live: ReadonlyArray<HoldClaimVersion>) {
  const sites = yield* HoldSites;
  const snapshot = yield* sites.snapshot(manifestsNamedBy(live));
  return lintHolds(snapshot, live);
});

const tombstonesFor = Effect.fn("Holds.tombstones")(function* (
  all: ReadonlyArray<HoldClaimVersion>,
  live: ReadonlyArray<HoldClaimVersion>,
  findings: ReadonlyArray<HoldLintFinding>
) {
  const at = yield* DateTime.now;
  const counts = A.reduce(all, HashMap.empty<string, number>(), (tally, row) =>
    HashMap.set(tally, row.logicalKey, O.getOrElse(HashMap.get(tally, row.logicalKey), () => 0) + 1)
  );
  const orphanReasons = A.reduce(findings, HashMap.empty<string, ReadonlyArray<string>>(), (reasons, finding) =>
    finding._tag === "Orphaned"
      ? HashMap.set(
          reasons,
          finding.holdId,
          A.append(O.getOrElse(HashMap.get(reasons, finding.holdId), A.empty), anchorKey(finding.anchor))
        )
      : reasons
  );
  return A.getSomes(
    A.map(live, (version) =>
      O.map(
        HashMap.get(orphanReasons, version.proposition.holdId),
        (gone): HoldClaimVersion => ({
          ...version,
          // The tombstone keeps the proposition so a re-introduced hold can cite what was retired.
          id: HoldVersionId.make(
            `${version.proposition.holdId}@${O.getOrElse(HashMap.get(counts, version.logicalKey), () => 0) + 1}`
          ),
          supersedes: O.some(version.id),
          knowledge: { ...version.knowledge, recordedAt: at },
          review: { _tag: "Retracted", reason: `Anchor gone: ${A.join(gone, ", ")}.`, at },
        })
      )
    )
  );
});

const writeLintFixes = Effect.fn("Holds.writeLintFixes")(function* (
  live: ReadonlyArray<HoldClaimVersion>,
  findings: ReadonlyArray<HoldLintFinding>
) {
  const ledger = yield* HoldLedger;
  const tombstones = yield* tombstonesFor(yield* ledger.allVersions, live, findings);
  yield* ledger.appendVersions(tombstones);
  yield* ledger.writeHeldList(heldListFor(yield* ledger.currentVersions));
  return A.map(tombstones, (tombstone) => `[holds] tombstoned ${tombstone.id}: ${tombstone.proposition.holdId}`);
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
