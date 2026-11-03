/**
 * Party ledger port, independent of storage.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyUseCasesId } from "@beep/identity/packages";
import { ClaimVersion, SourceAssertion } from "@beep/party-domain/Claim";
import { Observation } from "@beep/party-domain/Communication";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type { PartyKey } from "@beep/party-domain/PartyKey";
import type { PartyId } from "@beep/shared-domain/identity/Party";
import type * as Effect from "effect/Effect";

const $I = $PartyUseCasesId.create("values/Ledger/Ledger.ports");

/**
 * A rejected write that would break append-only identity history.
 * **Example** (Identify a duplicate version)
 * ```ts
 * import { LedgerConflict } from "@beep/party-use-cases/Ledger"
 * LedgerConflict.make({ recordId: "party-cv:1", reason: "duplicate-version" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class LedgerConflict extends S.TaggedError<LedgerConflict, { readonly brand: unique symbol }>(
  $I`LedgerConflict`
)(
  "LedgerConflict",
  { recordId: S.NonEmptyString, reason: S.NonEmptyString },
  $I.annoteError<LedgerConflict>("LedgerConflict", { description: "Write rejected without changing ledger state." })
) {}

/**
 * Effective versions with derived knowledge bounds; stored writes remain immutable.
 * **Example** (An empty snapshot)
 * ```ts
 * import { LedgerSnapshot } from "@beep/party-use-cases/Ledger"
 * LedgerSnapshot.make({ observations: [], assertions: [], versions: [] })
 * ```
 * @category models
 * @since 0.0.0
 */
export class LedgerSnapshot extends S.Opaque<LedgerSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    observations: S.Array(Observation),
    assertions: S.Array(SourceAssertion),
    versions: S.Array(ClaimVersion),
  }).pipe($I.annoteSchema("LedgerSnapshot", { description: "Effective immutable claim-version snapshot." }))
) {}

/**
 * Ledger operations and typed failure boundary.
 * @category services
 * @since 0.0.0
 */
export interface PartyLedgerShape {
  readonly allocateAnchorParty: (key: PartyKey) => Effect.Effect<PartyId>;
  readonly allocatePartyId: Effect.Effect<PartyId>;
  readonly append: (version: ClaimVersion) => Effect.Effect<void, LedgerConflict>;
  readonly appendEvidence: (batch: LedgerSnapshot) => Effect.Effect<void, LedgerConflict>;
  readonly recordAssertion: (assertion: SourceAssertion) => Effect.Effect<void, LedgerConflict>;
  readonly recordObservation: (observation: Observation) => Effect.Effect<void, LedgerConflict>;
  readonly snapshot: Effect.Effect<LedgerSnapshot>;
}

/**
 * Append-only claim history and stable integer identity allocation.
 * **Example** (Read a snapshot through the port)
 * ```ts
 * import { PartyLedger } from "@beep/party-use-cases/Ledger"
 * import * as Effect from "effect/Effect"
 * const snapshot = Effect.gen(function* () { return yield* (yield* PartyLedger).snapshot })
 * ```
 * @category services
 * @since 0.0.0
 */
export class PartyLedger extends Context.Service<PartyLedger, PartyLedgerShape>()($I`PartyLedger`) {}
