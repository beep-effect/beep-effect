/**
 * The orchestrator rulings store: an append-only JSON Lines file per
 * repository next to the register, shared by every clone and lane.
 *
 * **Details**
 *
 * Same directory and override as the register (`BEEP_ORCHESTRATOR_STATE_ROOT`,
 * else `$XDG_STATE_HOME/beep/orchestrator/`), file
 * `<host>__<owner>__<repo>.rulings.jsonl`: rulings are state a successor cannot
 * rebuild from chat, so they do not live under a disposable cache.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeJsonLinesStore, makeMemoryJsonLinesStore } from "../../internal/state/JsonLinesStore.ts";
import { repositoryJsonLinesFileName, resolveWorkstationStateDir } from "../../internal/state/WorkstationState.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";
import { RulingRow, RulingRowJson } from "./Rulings.schemas.ts";
import { SessionLedgerError, sessionStatePlatformError } from "./Session.errors.ts";
import { sessionCheckoutFacts, sessionHarness } from "./SessionLedger.service.ts";
import type { RulingNoteInput } from "./Rulings.schemas.ts";

const $I = $RepoCliId.create("commands/Session/Rulings.service");
const equivalentRepository = S.toEquivalence(PrRepository);

/**
 * Service contract for the rulings store: append one row, list a repository's rows.
 *
 * **Example** (Name the operations)
 *
 * ```ts
 * import { type OrchestratorRulingsShape } from "@beep/repo-cli/test/Session"
 *
 * const operations: ReadonlyArray<keyof OrchestratorRulingsShape> = ["append", "list"]
 * console.log(operations.length) // 2
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OrchestratorRulingsShape {
  readonly append: (row: RulingRow) => Effect.Effect<void, SessionLedgerError>;
  readonly list: (repository: PrRepository) => Effect.Effect<ReadonlyArray<RulingRow>, SessionLedgerError>;
}

/**
 * Effect Context tag for the orchestrator rulings store.
 *
 * **Example** (Request the service)
 *
 * ```ts
 * import { OrchestratorRulings } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* OrchestratorRulings }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OrchestratorRulings extends Context.Service<OrchestratorRulings, OrchestratorRulingsShape>()(
  $I`OrchestratorRulings`
) {}

/**
 * The rulings file name for a repository.
 *
 * **Example** (Name the file)
 *
 * ```ts
 * import { PrRepository, rulingsFileName } from "@beep/repo-cli/test/Session"
 *
 * console.log(rulingsFileName(PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })))
 * // "github.com__beep-effect__beep-effect.rulings.jsonl"
 * ```
 *
 * @param repository - The repository the rulings belong to.
 * @returns The file name under the orchestrator state directory.
 * @category services
 * @since 0.0.0
 */
export const rulingsFileName: (repository: PrRepository) => string = flow(
  repositoryJsonLinesFileName,
  Str.replace(/\.jsonl$/u, ".rulings.jsonl")
);

/**
 * Build the live rulings store against the workstation state directory.
 *
 * **Example** (Build the live store effect)
 *
 * ```ts
 * import { makeOrchestratorRulingsLive } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof makeOrchestratorRulingsLive) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const makeOrchestratorRulingsLive = Effect.fn("OrchestratorRulings.makeLive")(function* () {
  const store = yield* makeJsonLinesStore({
    directory: yield* resolveWorkstationStateDir({ override: "BEEP_ORCHESTRATOR_STATE_ROOT", store: "orchestrator" }),
    fileName: rulingsFileName,
    partitionOf: (row: RulingRow) => row.repository,
    encode: flow(
      RulingRowJson.encode,
      Effect.mapError((cause) =>
        SessionLedgerError.make({ reason: "decode", message: "Failed to encode the ruling row.", cause })
      )
    ),
    decodeOption: RulingRowJson.decodeOption,
    onPlatformError: sessionStatePlatformError,
    label: { scope: "session", noun: "rulings" },
  });
  return OrchestratorRulings.of(store);
});

/**
 * The rulings layer that writes the workstation JSON Lines file.
 *
 * **Example** (Check the layer)
 *
 * ```ts
 * import { layerOrchestratorRulingsLive } from "@beep/repo-cli/test/Session"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerOrchestratorRulingsLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerOrchestratorRulingsLive = Layer.effect(OrchestratorRulings, makeOrchestratorRulingsLive());

/**
 * In-memory rulings layer for tests.
 *
 * **Example** (Provide the memory layer)
 *
 * ```ts
 * import { layerOrchestratorRulingsMemory } from "@beep/repo-cli/test/Session"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerOrchestratorRulingsMemory)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerOrchestratorRulingsMemory = Layer.effect(
  OrchestratorRulings,
  makeMemoryJsonLinesStore({
    partitionOf: (row: RulingRow) => row.repository,
    samePartition: equivalentRepository,
  }).pipe(Effect.map(OrchestratorRulings.of))
);

/**
 * Stamp repository and recorder provenance on a ruling and append it.
 *
 * **Example** (Build the append effect)
 *
 * ```ts
 * import { noteRuling } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof noteRuling) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const noteRuling = Effect.fn("OrchestratorRulings.note")(function* (cwd: string, input: RulingNoteInput) {
  const facts = yield* sessionCheckoutFacts(cwd);
  const identity = yield* sessionHarness;
  const row = RulingRow.make({
    schemaVersion: "orchestrator-ruling/v1",
    repository: facts.repository,
    id: input.id,
    date: input.date,
    verbatim: input.verbatim,
    source: input.source,
    state: input.state,
    supersededBy: input.supersededBy,
    note: input.note,
    recordedBy: identity.sessionId,
    recordedAt: yield* DateTime.now,
  });
  const rulings = yield* OrchestratorRulings;
  yield* rulings.append(row);
  return row;
});
