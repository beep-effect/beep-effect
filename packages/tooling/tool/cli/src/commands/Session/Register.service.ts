/**
 * The orchestrator register store: an append-only JSON Lines file per
 * repository under the workstation state root, shared by every clone and lane.
 *
 * **Details**
 *
 * The register lives next to the session ledger
 * (`$XDG_STATE_HOME/beep/orchestrator/`, `~/.local/state/beep/...` by default)
 * rather than under `~/.cache`, because a cache is disposable by contract and
 * the register is the one artifact a successor orchestrator cannot rebuild from
 * chat. `BEEP_ORCHESTRATOR_STATE_ROOT` overrides the directory for tests and
 * for a lane that must not touch the workstation file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Context, DateTime, Effect, flow, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { makeJsonLinesStore, partitionJsonLines } from "../../internal/state/JsonLinesStore.ts";
import { repositoryJsonLinesFileName, resolveWorkstationStateDir } from "../../internal/state/WorkstationState.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";
import { RegisterRow, RegisterRowJson } from "./Register.schemas.ts";
import { SessionLedgerError, sessionStatePlatformError } from "./Session.errors.ts";
import { sessionCheckoutFacts, sessionHarness } from "./SessionLedger.service.ts";
import type { RegisterNoteInput } from "./Register.schemas.ts";

const $I = $RepoCliId.create("commands/Session/Register.service");
const equivalentRepository = S.toEquivalence(PrRepository);

/**
 * Service contract for the register: append one row, list a repository's rows.
 *
 * @category services
 * @since 0.0.0
 */
export interface OrchestratorRegisterShape {
  readonly append: (row: RegisterRow) => Effect.Effect<void, SessionLedgerError>;
  readonly list: (repository: PrRepository) => Effect.Effect<ReadonlyArray<RegisterRow>, SessionLedgerError>;
}

/**
 * Effect Context tag for the orchestrator register store.
 *
 * **Example** (Request the service)
 *
 * ```ts
 * import { OrchestratorRegister } from "@beep/repo-cli/test/Session"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const register = yield* OrchestratorRegister
 *   return register
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OrchestratorRegister extends Context.Service<OrchestratorRegister, OrchestratorRegisterShape>()(
  $I`OrchestratorRegister`
) {}

/**
 * Decoded register rows plus the count of corrupt lines skipped.
 *
 * @category models
 * @since 0.0.0
 */
export class DecodedRegister extends S.Class<DecodedRegister>($I`DecodedRegister`)(
  { rows: S.Array(RegisterRow), corruptLineCount: S.Finite },
  $I.annote("DecodedRegister", { description: "Decoded register rows and the count of corrupt JSON Lines entries." })
) {}

/**
 * Decode JSON Lines register content, keeping valid rows and counting corrupt lines.
 *
 * **Example** (Decode an empty file)
 *
 * ```ts
 * import { decodeRegister } from "@beep/repo-cli/test/Session"
 *
 * console.log(decodeRegister("").rows.length) // 0
 * ```
 *
 * @param content - Raw JSON Lines file content.
 * @returns Valid rows and the count of skipped corrupt lines.
 * @category codecs
 * @since 0.0.0
 */
export const decodeRegister = (content: string): DecodedRegister =>
  DecodedRegister.make(partitionJsonLines(RegisterRowJson.decodeOption)(content));

/**
 * The register file name for a repository.
 *
 * @category services
 * @since 0.0.0
 */
export const registerFileName: (repository: PrRepository) => string = repositoryJsonLinesFileName;

/**
 * Build the live register store against the workstation state directory.
 *
 * @category services
 * @since 0.0.0
 */
export const makeOrchestratorRegisterLive = Effect.fn("OrchestratorRegister.makeLive")(function* () {
  const store = yield* makeJsonLinesStore({
    directory: yield* resolveWorkstationStateDir({ override: "BEEP_ORCHESTRATOR_STATE_ROOT", store: "orchestrator" }),
    fileName: registerFileName,
    partitionOf: (row: RegisterRow) => row.repository,
    encode: flow(
      RegisterRowJson.encode,
      Effect.mapError((cause) =>
        SessionLedgerError.make({ reason: "decode", message: "Failed to encode the register row.", cause })
      )
    ),
    decodeOption: RegisterRowJson.decodeOption,
    onPlatformError: sessionStatePlatformError,
    label: { scope: "session", noun: "register" },
  });
  return OrchestratorRegister.of(store);
});

/**
 * The register layer that writes the workstation JSON Lines file.
 *
 * @category layers
 * @since 0.0.0
 */
export const layerOrchestratorRegisterLive = Layer.effect(OrchestratorRegister, makeOrchestratorRegisterLive());

/**
 * In-memory register layer for tests.
 *
 * **Example** (Provide the memory layer)
 *
 * ```ts
 * import { layerOrchestratorRegisterMemory } from "@beep/repo-cli/test/Session"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(layerOrchestratorRegisterMemory)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerOrchestratorRegisterMemory = Layer.effect(
  OrchestratorRegister,
  Ref.make(A.empty<RegisterRow>()).pipe(
    Effect.map((rows) =>
      OrchestratorRegister.of({
        append: Effect.fn("OrchestratorRegister.memory.append")((row) => Ref.update(rows, A.append(row))),
        list: Effect.fn("OrchestratorRegister.memory.list")((repository) =>
          Ref.get(rows).pipe(Effect.map(A.filter((row) => equivalentRepository(row.repository, repository))))
        ),
      })
    )
  )
);

/**
 * Stamp repository and recorder provenance on an input and append it.
 *
 * **Details**
 *
 * The repository comes from the checkout at `cwd` (its `origin` remote), so a
 * register row can be written from any lane of the clone. `recordedBy` is the
 * harness session id when the harness exposes one, so a successor can tell
 * which orchestrator wrote each row.
 *
 * @category workflows
 * @since 0.0.0
 */
export const noteRegister = Effect.fn("OrchestratorRegister.note")(function* (cwd: string, input: RegisterNoteInput) {
  const facts = yield* sessionCheckoutFacts(cwd);
  const identity = yield* sessionHarness;
  const row = RegisterRow.make({
    schemaVersion: "orchestrator-register/v1",
    repository: facts.repository,
    kind: input.kind,
    address: input.address,
    name: input.name,
    owns: input.owns,
    state: input.state,
    waitingOnOrchestrator: input.waitingOnOrchestrator,
    lastContact: input.lastContact,
    orphanPlan: input.orphanPlan,
    note: input.note,
    recordedBy: identity.sessionId,
    recordedAt: yield* DateTime.now,
  });
  const register = yield* OrchestratorRegister;
  yield* register.append(row);
  return row;
});
