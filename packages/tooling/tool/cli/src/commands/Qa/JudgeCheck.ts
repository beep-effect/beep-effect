/**
 * Evidence cross-checking shared by `judge-ingest` and `judge-lint`.
 *
 * A vision judge can hallucinate a filename or a sequence number as easily as
 * it can describe a defect. Every inventory therefore has to survive the same
 * two questions before it is written or accepted: does each cited artifact
 * exist in the round, and does each cited event id appear in that round's
 * witness log?
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import { Effect, HashSet, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { jsonObjectTextFromMixedOutput } from "../../internal/cli/MixedOutputJson.ts";
import {
  CitedArtifactExistsInput,
  CitedArtifactExistsVerdict,
  evaluateCitedArtifactExists,
} from "./CitedArtifactExistsGate.ts";
import {
  CitedEventIdExistsInput,
  DeclaredRoundCoherentInput,
  DeclaredRoundCoherentVerdict,
  EvidenceCrossCheckCleanInput,
  EvidenceCrossCheckCleanVerdict,
  evaluateCitedEventIdExists,
  evaluateDeclaredRoundCoherent,
  evaluateEvidenceCrossCheckClean,
} from "./JudgeContract.ts";
import { QaCommandError } from "./Qa.errors.ts";
import type { RoundLayout } from "@beep/qa-capture";
import type { FileSystem, Path } from "effect";
import type { QaInventory } from "./Inventory.schemas.ts";
import type { QaEventLog } from "./Qa.session.ts";

const $I = $RepoCliId.create("commands/Qa/JudgeCheck");

/**
 * Everything an inventory cited that the round cannot back up.
 *
 * **Example** (Usage)
 * ```ts
 * import { EvidenceCrossCheck } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const check = EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] })
 * console.log(check.missingPaths.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceCrossCheck extends S.Class<EvidenceCrossCheck>($I`EvidenceCrossCheck`)(
  {
    missingEventIds: S.Array(S.Int).pipe(
      $I.annoteKey("EvidenceCrossCheck.missingEventIds", {
        description: "Cited witness sequence numbers absent from events.ndjson.",
      })
    ),
    missingPaths: S.Array(S.String).pipe(
      $I.annoteKey("EvidenceCrossCheck.missingPaths", {
        description: "Cited round-relative artifact paths that do not exist.",
      })
    ),
  },
  $I.annote("EvidenceCrossCheck", {
    description: "Everything an inventory cited that its round cannot back up.",
  })
) {}

/**
 * Whether a cross-check found nothing wrong.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { EvidenceCrossCheck, isCrossCheckClean } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * console.log(isCrossCheckClean(EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] }))) // true
 * ```
 *
 * @param check - Cross-check result to inspect.
 * @returns True when the inventory cited nothing the round cannot back up.
 * @category predicates
 * @since 0.0.0
 */
export const isCrossCheckClean = (check: EvidenceCrossCheck): boolean =>
  !A.isReadonlyArrayNonEmpty(check.missingEventIds) && !A.isReadonlyArrayNonEmpty(check.missingPaths);

/**
 * Every round-relative path an inventory cites, deduplicated.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { citedPaths } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(citedPaths(inventory).length) // 0
 * ```
 *
 * @param inventory - Inventory whose evidence citations are collected.
 * @returns Every distinct round-relative path the inventory cites.
 * @category utilities
 * @since 0.0.0
 */
export const citedPaths = (inventory: QaInventory): ReadonlyArray<string> =>
  pipe(
    inventory.findings,
    A.flatMap((finding) => A.map(finding.evidence, (evidence) => evidence.path)),
    A.dedupe
  );

/**
 * Every witness sequence number an inventory cites, deduplicated.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { citedEventIds } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(citedEventIds(inventory).length) // 0
 * ```
 *
 * @param inventory - Inventory whose evidence citations are collected.
 * @returns Every distinct witness sequence number the inventory cites.
 * @category utilities
 * @since 0.0.0
 */
export const citedEventIds = (inventory: QaInventory): ReadonlyArray<number> =>
  pipe(
    inventory.findings,
    A.flatMap((finding) => A.flatMap(finding.evidence, (evidence) => evidence.eventIds)),
    A.dedupe
  );

/**
 * Compare an inventory's citations against what a round actually holds.
 *
 * **Example** (Usage)
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { crossCheckEvidence } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * const check = crossCheckEvidence(inventory, HashSet.empty<string>(), HashSet.empty<number>())
 * console.log(check.missingPaths.length) // 0
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const crossCheckEvidence: {
  (
    existingPaths: HashSet.HashSet<string>,
    knownEventIds: HashSet.HashSet<number>
  ): (inventory: QaInventory) => EvidenceCrossCheck;
  (
    inventory: QaInventory,
    existingPaths: HashSet.HashSet<string>,
    knownEventIds: HashSet.HashSet<number>
  ): EvidenceCrossCheck;
} = dual(
  3,
  (
    inventory: QaInventory,
    existingPaths: HashSet.HashSet<string>,
    knownEventIds: HashSet.HashSet<number>
  ): EvidenceCrossCheck =>
    EvidenceCrossCheck.make({
      missingEventIds: A.filter(citedEventIds(inventory), (seq) => !HashSet.has(knownEventIds, seq)),
      missingPaths: A.filter(citedPaths(inventory), (value) => !HashSet.has(existingPaths, value)),
    })
);

const citedArtifactVerdictToCrossCheckImpl = (
  verdict: CitedArtifactExistsVerdict,
  missingEventIds: ReadonlyArray<number>
): EvidenceCrossCheck =>
  CitedArtifactExistsVerdict.match(verdict, {
    allowed: () => EvidenceCrossCheck.make({ missingEventIds, missingPaths: A.empty<string>() }),
    denied: ({ audit }) => EvidenceCrossCheck.make({ missingEventIds, missingPaths: audit.detail.missingPaths }),
  });

/**
 * Projects a cited-artifact gate verdict into the legacy evidence aggregate.
 *
 * **Details**
 *
 * Audit metadata stays on the typed verdict. The projection carries only the
 * ordered missing paths and the unchanged event-id result because those are
 * the fields the existing renderer and command error channels expose.
 *
 * **Example** (Project a denied verdict)
 *
 * ```ts
 * import {
 *   CitedArtifactExistsDenied,
 *   CitedArtifactExistsGate,
 *   CitedArtifactExistsVerdict
 * } from "@beep/repo-cli/commands/Qa/CitedArtifactExistsGate"
 * import { citedArtifactVerdictToCrossCheck } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import { ISOStr } from "@beep/schema/Timestamp"
 *
 * const verdict = CitedArtifactExistsVerdict.cases.denied.make({
 *   audit: {
 *     detail: CitedArtifactExistsDenied.make({
 *       checkedPaths: ["frames/ghost.png"],
 *       missingPaths: ["frames/ghost.png"]
 *     }),
 *     evaluator: "qa",
 *     gateId: CitedArtifactExistsGate.id,
 *     occurredAt: ISOStr.make("2026-08-24T00:00:00.000Z"),
 *     outcome: "denied",
 *     reason: "The citation is missing."
 *   }
 * })
 * const check = citedArtifactVerdictToCrossCheck(verdict, [412])
 * console.log(check.missingPaths) // ["frames/ghost.png"]
 * ```
 *
 * @param verdict - Typed cited-artifact gate result.
 * @param missingEventIds - Existing witness-event cross-check result.
 * @returns Lossless legacy aggregate used by judge-lint and judge-ingest.
 * @category projections
 * @since 0.0.0
 */
export const citedArtifactVerdictToCrossCheck: {
  (missingEventIds: ReadonlyArray<number>): (verdict: CitedArtifactExistsVerdict) => EvidenceCrossCheck;
  (verdict: CitedArtifactExistsVerdict, missingEventIds: ReadonlyArray<number>): EvidenceCrossCheck;
} = dual(2, citedArtifactVerdictToCrossCheckImpl);

const evidenceCrossCheckVerdictToCrossCheckImpl = (verdict: EvidenceCrossCheckCleanVerdict): EvidenceCrossCheck =>
  EvidenceCrossCheckCleanVerdict.match(verdict, {
    allowed: () => EvidenceCrossCheck.make({ missingEventIds: A.empty<number>(), missingPaths: A.empty<string>() }),
    denied: ({ audit }) => EvidenceCrossCheck.make(audit.detail),
  });

/**
 * Projects the derived aggregate gate verdict into the legacy cross-check model.
 *
 * **Details**
 *
 * Leaf verdict audits remain available to typed callers. This projection keeps
 * only the ordered missing artifact paths and event ids exposed by the existing
 * renderer and command adapters.
 *
 * **Example** (Inspect the projection)
 *
 * ```ts
 * import { evidenceCrossCheckVerdictToCrossCheck } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * console.log(typeof evidenceCrossCheckVerdictToCrossCheck) // "function"
 * ```
 *
 * @param verdict - Derived artifact-and-event aggregate verdict.
 * @returns Legacy evidence cross-check projection.
 * @category projections
 * @since 0.0.0
 */
export const evidenceCrossCheckVerdictToCrossCheck = evidenceCrossCheckVerdictToCrossCheckImpl;

/**
 * Render a cross-check failure into an operator-readable error.
 *
 * **Example** (Usage)
 * ```ts
 * import { EvidenceCrossCheck, renderCrossCheckFailure } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const message = renderCrossCheckFailure(
 *   3,
 *   EvidenceCrossCheck.make({ missingEventIds: [412], missingPaths: ["frames/ghost.png"] })
 * )
 * console.log(message.includes("frames/ghost.png")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderCrossCheckFailure: {
  (check: EvidenceCrossCheck): (round: number) => string;
  (round: number, check: EvidenceCrossCheck): string;
} = dual(2, (round: number, check: EvidenceCrossCheck): string =>
  A.join(
    [
      `qa judge inventory for round ${round} cites evidence the round cannot back up.`,
      ...A.map(check.missingPaths, (value) => `  missing artifact: ${value}`),
      ...A.map(check.missingEventIds, (seq) => `  missing event id: ${seq}`),
    ],
    "\n"
  )
);

/**
 * Cross-check an inventory against a round directory on disk.
 *
 * **Example** (Usage)
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { crossCheckAgainstRound } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import { Effect } from "effect"
 * import { QaEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { RoundLayout } from "@beep/qa-capture"
 *
 * const layout = RoundLayout.make({
 *   clipsDir: "/repo/.beep/qa/round-1/clips",
 *   eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *   framesDir: "/repo/.beep/qa/round-1/frames",
 *   reportPath: "/repo/.beep/qa/round-1/report.md",
 *   root: "/repo/.beep/qa/round-1",
 *   round: 1,
 *   sessionPath: "/repo/.beep/qa/round-1/session.json",
 *   sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *   videoDir: "/repo/.beep/qa/round-1/video"
 * })
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * const program = crossCheckAgainstRound(layout, inventory, QaEventLog.make({ events: [], rejectedCount: 0 }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const crossCheckAgainstRound = Effect.fn("QaJudgeCheck.crossCheckAgainstRound")(function* (
  layout: RoundLayout,
  inventory: QaInventory,
  eventLog: QaEventLog
): Effect.fn.Return<EvidenceCrossCheck, never, FileSystem.FileSystem | Path.Path> {
  const artifactVerdict = yield* evaluateCitedArtifactExists(
    CitedArtifactExistsInput.make({ citedPaths: citedPaths(inventory), roundRoot: layout.root })
  );
  const eventIdVerdict = yield* evaluateCitedEventIdExists(
    CitedEventIdExistsInput.make({
      citedEventIds: citedEventIds(inventory),
      knownEventIds: A.map(eventLog.events, (event) => event.seq),
    })
  );
  const aggregateVerdict = yield* evaluateEvidenceCrossCheckClean(
    EvidenceCrossCheckCleanInput.make({ artifactVerdict, eventIdVerdict })
  );
  return evidenceCrossCheckVerdictToCrossCheck(aggregateVerdict);
});

/**
 * Fail with a cross-check error when an inventory cites unbacked evidence.
 *
 * **Example** (Usage)
 * ```ts
 * import { EvidenceCrossCheck, raiseCrossCheckFailure } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import { Effect } from "effect"
 *
 * const clean = EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] })
 * console.log(Effect.isEffect(raiseCrossCheckFailure(1, clean))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const raiseCrossCheckFailure: {
  (check: EvidenceCrossCheck): (round: number) => Effect.Effect<void, QaCommandError>;
  (round: number, check: EvidenceCrossCheck): Effect.Effect<void, QaCommandError>;
} = dual(
  2,
  (round: number, check: EvidenceCrossCheck): Effect.Effect<void, QaCommandError> =>
    isCrossCheckClean(check)
      ? Effect.void
      : Effect.fail(QaCommandError.make({ message: renderCrossCheckFailure(round, check) }))
);

const requireInventoryRoundImpl = Effect.fn("QaJudgeCheck.requireInventoryRound")(function* (
  round: number,
  inventory: QaInventory
): Effect.fn.Return<void, QaCommandError> {
  const verdict = yield* evaluateDeclaredRoundCoherent(
    DeclaredRoundCoherentInput.make({ declaredRound: inventory.round, requestedRound: round })
  );
  return yield* DeclaredRoundCoherentVerdict.match(verdict, {
    allowed: () => Effect.void,
    denied: ({ audit }) =>
      Effect.fail(
        QaCommandError.make({
          message: `qa judge inventory declares round ${audit.detail.declaredRound} but round ${audit.detail.requestedRound} was requested.`,
        })
      ),
  });
});

/**
 * Fail when an inventory declares a different round than the one requested.
 *
 * **Details**
 *
 * Witness sequence numbers restart per round and frame names repeat across
 * rounds, so a copied inventory can genuinely pass another round's evidence
 * cross-check; the declared round has to be checked explicitly.
 *
 * **Example** (Usage)
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { requireInventoryRound } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import { Effect } from "effect"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(Effect.isEffect(requireInventoryRound(1, inventory))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const requireInventoryRound: {
  (inventory: QaInventory): (round: number) => Effect.Effect<void, QaCommandError>;
  (round: number, inventory: QaInventory): Effect.Effect<void, QaCommandError>;
} = dual(2, requireInventoryRoundImpl);

const FENCED_JSON = /```json\s*\r?\n([\s\S]*?)```/g;
const FENCED_ANY = /```\s*\r?\n(\{[\s\S]*?\})\s*```/g;

const lastMatch = (text: string, pattern: RegExp): O.Option<string> =>
  pipe(
    A.fromIterable(text.matchAll(pattern)),
    A.last,
    O.flatMap((match) => A.get(match, 1)),
    O.map(Str.trim)
  );

/**
 * Extract the last JSON inventory block from noisy judge output.
 *
 * Judges narrate. The contract is that the inventory is the final fenced JSON
 * block, so everything before it — reasoning, tool chatter, earlier draft
 * blocks — is ignored rather than parsed.
 *
 * **Details**
 *
 * Extraction degrades through three rungs: the last json-tagged fence, then
 * the last anonymous fence holding an object, then a balanced-brace scan that
 * accepts the last parseable top-level object anywhere in the text.
 * The final rung exists because judges sometimes emit a correct, schema-valid
 * inventory without any fence at all — an output that used to hard-fail
 * ingest and discard the whole capture+extract+judge round.
 *
 * **Gotchas**
 *
 * A fenced block always wins over unfenced text, even when prose after the
 * fence contains a parseable object; the unfenced rung only runs when no
 * fence matched anywhere.
 * Unfenced salvage is permanent ingest hardening, not transitional compatibility.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { extractLastJsonBlock } from "@beep/repo-cli/commands/Qa"
 * import * as O from "effect/Option"
 *
 * const fence = "`".repeat(3)
 * const draft = [`${fence}json`, `{"draft":true}`, fence].join("\n")
 * const final = [`${fence}json`, `{"final":true}`, fence].join("\n")
 * const stdout = ["thinking...", draft, "on reflection:", final, "REQUIRED FINDINGS: 0"].join("\n")
 * console.log(O.getOrElse(extractLastJsonBlock(stdout), () => "")) // '{"final":true}'
 * console.log(O.getOrElse(extractLastJsonBlock('no fence: {"final":true}'), () => "")) // '{"final":true}'
 * ```
 *
 * @param text - Raw judge output, narration and draft blocks included.
 * @returns The last fenced JSON block, the last parseable unfenced object when
 * no fence matched, or none when the output carries neither.
 * @category utilities
 * @since 0.0.0
 */
export const extractLastJsonBlock = (text: string): O.Option<string> =>
  pipe(
    lastMatch(text, FENCED_JSON),
    O.orElse(() => lastMatch(text, FENCED_ANY)),
    O.orElse(() => jsonObjectTextFromMixedOutput(text))
  );
