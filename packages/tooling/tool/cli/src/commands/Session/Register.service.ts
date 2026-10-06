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
import { Console, Context, DateTime, Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  emptyWhenNotFound,
  repositoryJsonLinesFileName,
  resolveWorkstationStateDir,
} from "../../internal/state/WorkstationState.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";
import { RegisterRow, RegisterRowJson } from "./Register.schemas.ts";
import { SessionLedgerError } from "./Session.errors.ts";
import { sessionCheckoutFacts, sessionHarness } from "./SessionLedger.service.ts";
import type { PlatformError } from "effect";
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
export const decodeRegister = (content: string): DecodedRegister => {
  let rows = A.empty<RegisterRow>();
  let corruptLineCount = 0;
  for (const line of A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty)) {
    const decoded = RegisterRowJson.decodeOption(line);
    if (O.isSome(decoded)) {
      rows = A.append(rows, decoded.value);
    } else {
      corruptLineCount += 1;
    }
  }
  return DecodedRegister.make({ rows, corruptLineCount });
};

const mapPlatformError = (cause: PlatformError.PlatformError): SessionLedgerError =>
  SessionLedgerError.make({
    reason: cause.reason._tag === "PermissionDenied" ? "denied" : "io",
    message: cause.message,
    cause,
  });

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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* resolveWorkstationStateDir({
    override: "BEEP_ORCHESTRATOR_STATE_ROOT",
    store: "orchestrator",
  });
  const fileFor = (repository: PrRepository): string => path.join(directory, registerFileName(repository));
  return OrchestratorRegister.of({
    append: Effect.fn("OrchestratorRegister.append")((row) =>
      RegisterRowJson.encode(row).pipe(
        Effect.mapError((cause) =>
          SessionLedgerError.make({ reason: "decode", message: "Failed to encode the register row.", cause })
        ),
        Effect.flatMap((encoded) =>
          fs
            .makeDirectory(directory, { recursive: true, mode: 0o700 })
            .pipe(
              Effect.andThen(fs.writeFileString(fileFor(row.repository), `${encoded}\n`, { flag: "a", mode: 0o600 })),
              Effect.mapError(mapPlatformError)
            )
        )
      )
    ),
    list: Effect.fn("OrchestratorRegister.list")((repository) =>
      fs.readFileString(fileFor(repository)).pipe(
        Effect.map(decodeRegister),
        Effect.tap((result) =>
          result.corruptLineCount > 0
            ? Console.warn(`[session] skipped ${result.corruptLineCount} corrupt register line(s)`)
            : Effect.void
        ),
        Effect.map((result) => result.rows),
        emptyWhenNotFound(mapPlatformError)
      )
    ),
  });
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
