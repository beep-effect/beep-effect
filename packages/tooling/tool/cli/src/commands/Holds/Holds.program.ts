/**
 * `beep holds` programs: the list and probe flows over the ledger and probe
 * services, returning the lines the command prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { HoldsError } from "./Holds.errors.ts";
import { HoldId } from "./Holds.schemas.ts";
import { HoldLedger, HoldProbe, HoldProbeRequest } from "./Holds.service.ts";
import { confirmHoldRuns } from "./Holds.verdict.ts";
import type { ProbeOutcome } from "./Holds.schemas.ts";

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
