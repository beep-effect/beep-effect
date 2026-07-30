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
import { Effect, FileSystem, HashSet, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { QaCommandError } from "./Qa.errors.ts";
import type { RoundLayout } from "@beep/qa-capture";
import type { QaInventory } from "./Inventory.schemas.ts";
import type { QaEventLog } from "./Qa.session.ts";

const $I = $RepoCliId.create("commands/Qa/JudgeCheck");

/**
 * Everything an inventory cited that the round cannot back up.
 *
 * @example
 * ```ts
 * import { EvidenceCrossCheck } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const check = EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] })
 * console.log(check.missingPaths.length) // 0
 * ```
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
 * @param check - Cross-check result to inspect.
 * @returns True when the inventory cited nothing the round cannot back up.
 * @example
 * ```ts
 * import { EvidenceCrossCheck, isCrossCheckClean } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * console.log(isCrossCheckClean(EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] }))) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isCrossCheckClean = (check: EvidenceCrossCheck): boolean =>
  !A.isReadonlyArrayNonEmpty(check.missingEventIds) && !A.isReadonlyArrayNonEmpty(check.missingPaths);

/**
 * Every round-relative path an inventory cites, deduplicated.
 *
 * @param inventory - Inventory whose evidence citations are collected.
 * @returns Every distinct round-relative path the inventory cites.
 * @example
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { citedPaths } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(citedPaths(inventory).length) // 0
 * ```
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
 * @param inventory - Inventory whose evidence citations are collected.
 * @returns Every distinct witness sequence number the inventory cites.
 * @example
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { citedEventIds } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(citedEventIds(inventory).length) // 0
 * ```
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
 * @example
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { crossCheckEvidence } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * const check = crossCheckEvidence(inventory, HashSet.empty<string>(), HashSet.empty<number>())
 * console.log(check.missingPaths.length) // 0
 * ```
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

/**
 * Render a cross-check failure into an operator-readable error.
 *
 * @example
 * ```ts
 * import { EvidenceCrossCheck, renderCrossCheckFailure } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 *
 * const message = renderCrossCheckFailure(
 *   3,
 *   EvidenceCrossCheck.make({ missingEventIds: [412], missingPaths: ["frames/ghost.png"] })
 * )
 * console.log(message.includes("frames/ghost.png")) // true
 * ```
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
 * @example
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
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
 *   requiredCount: 0,
 *   round: 1,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * const program = crossCheckAgainstRound(layout, inventory, QaEventLog.make({ events: [], rejectedCount: 0 }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const crossCheckAgainstRound = Effect.fn("QaJudgeCheck.crossCheckAgainstRound")(function* (
  layout: RoundLayout,
  inventory: QaInventory,
  eventLog: QaEventLog
): Effect.fn.Return<EvidenceCrossCheck, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const present = yield* Effect.forEach(citedPaths(inventory), (relative) =>
    fs.exists(path.join(layout.root, relative)).pipe(
      Effect.map((exists) => (exists ? O.some(relative) : O.none<string>())),
      Effect.orElseSucceed(O.none<string>)
    )
  );
  return crossCheckEvidence(
    inventory,
    HashSet.fromIterable(A.getSomes(present)),
    HashSet.fromIterable(A.map(eventLog.events, (event) => event.seq))
  );
});

/**
 * Fail with a cross-check error when an inventory cites unbacked evidence.
 *
 * @example
 * ```ts
 * import { EvidenceCrossCheck, raiseCrossCheckFailure } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import { Effect } from "effect"
 *
 * const clean = EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] })
 * console.log(Effect.isEffect(raiseCrossCheckFailure(1, clean))) // true
 * ```
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
 * Extract the last fenced JSON block from noisy judge output.
 *
 * Judges narrate. The contract is that the inventory is the final fenced JSON
 * block, so everything before it — reasoning, tool chatter, earlier draft
 * blocks — is ignored rather than parsed.
 *
 * @param text - Raw judge output, narration and draft blocks included.
 * @returns The last fenced JSON block, or none when the output carries none.
 * @example
 * ```ts
 * import { extractLastJsonBlock } from "@beep/repo-cli/commands/Qa/JudgeCheck"
 * import * as O from "effect/Option"
 *
 * const fence = "`".repeat(3)
 * const draft = [`${fence}json`, `{"draft":true}`, fence].join("\n")
 * const final = [`${fence}json`, `{"final":true}`, fence].join("\n")
 * const stdout = ["thinking...", draft, "on reflection:", final, "REQUIRED FINDINGS: 0"].join("\n")
 * console.log(O.getOrElse(extractLastJsonBlock(stdout), () => "")) // '{"final":true}'
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const extractLastJsonBlock = (text: string): O.Option<string> =>
  O.orElse(lastMatch(text, FENCED_JSON), () => lastMatch(text, FENCED_ANY));
