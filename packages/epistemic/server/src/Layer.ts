/**
 * Epistemic server layer.
 *
 * Composes the slice's live service surface: the claim gate (wired over the
 * bounded SHACL engine), the lifecycle transition, and the gate-outcome resolver
 * that gives a rejected verdict somewhere durable to land. The shared
 * `ShaclValidationService` backend is provided once at the merge boundary so it
 * is built a single time across consumers.
 *
 * Two core compositions are published. `EpistemicServerLive` requires nothing
 * and keeps the in-memory disposition repository plus an empty contradiction
 * repository, so gate and lifecycle consumers boot it without standing up a database;
 * {@link EpistemicServerDrizzleLive} is the same surface plus the bitemporal edge
 * authority, backed by Postgres. The edge authority appears only in the Drizzle
 * composition because its guarantees are the database's — a locked head, a
 * guarded close, an exclusion constraint that refuses a second open head — and
 * an in-memory stand-in would promise something it could not keep.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */
import {
  ClaimDispositionRepository,
  ClaimGateOutcomeResolver,
  makeClaimGateOutcomeResolver,
} from "@beep/epistemic-use-cases/ClaimDisposition";
import { ClaimGate, makeClaimGate } from "@beep/epistemic-use-cases/ClaimGate";
import { ClaimTransition, makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import { ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { Effect, Layer } from "effect";
import { ClaimDispositionRepositoryDrizzle, ClaimDispositionRepositoryInMemory } from "./ClaimDisposition/index.ts";
import {
  ContradictionHandlersLive,
  ContradictionTriageRepositoryDrizzle,
  ContradictionTriageRepositoryFixture,
  ContradictionTriageServiceLive,
} from "./ContradictionTriage/index.ts";
import { EdgeAuthorityRepositoryDrizzle } from "./EdgeAuthority/index.ts";
import { ExecutionLedgerDrizzle } from "./ExecutionLedger/index.ts";
import { BoundedShaclValidationServiceLive } from "./ShaclValidation/index.ts";
import type { EdgeAuthorityRepository } from "@beep/epistemic-use-cases/EdgeAuthority";
import type { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import type {
  ContradictionReviewer,
  ContradictionReviewScope,
  ContradictionTriageRepository,
} from "@beep/epistemic-use-cases/server";
import type { SourceTextResolver } from "@beep/file-processing/SourceText";
import type { PostgresDrizzle } from "@beep/postgres";
import type * as Crypto from "effect/Crypto";

const ClaimGateLayer = Layer.effect(
  ClaimGate,
  Effect.map(ShaclValidationService, (shacl) => ClaimGate.of(makeClaimGate(shacl)))
);

const ClaimTransitionLayer = Layer.succeed(ClaimTransition, ClaimTransition.of(makeClaimTransition()));

const ClaimGateOutcomeResolverLayer = Layer.effect(
  ClaimGateOutcomeResolver,
  Effect.map(Effect.all([ClaimDispositionRepository, ClaimTransition]), ([dispositions, transition]) =>
    ClaimGateOutcomeResolver.of(makeClaimGateOutcomeResolver(dispositions, transition))
  )
);

/**
 * Live epistemic server layer providing the claim gate, lifecycle transition,
 * gate-outcome resolver, and an in-memory disposition repository over the
 * bounded SHACL engine.
 *
 * **Example** (Import EpistemicServerLive layer)
 *
 * ```ts
 * import { EpistemicServerLive } from "@beep/epistemic-server/layer"
 *
 * console.log(EpistemicServerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EpistemicServerLive: Layer.Layer<
  ClaimDispositionRepository | ClaimGate | ClaimGateOutcomeResolver | ClaimTransition | ContradictionTriageRepository
> = Layer.mergeAll(
  ClaimGateLayer,
  ClaimTransitionLayer,
  ClaimDispositionRepositoryInMemory,
  ContradictionTriageRepositoryFixture,
  ClaimGateOutcomeResolverLayer.pipe(
    Layer.provide(Layer.merge(ClaimTransitionLayer, ClaimDispositionRepositoryInMemory))
  )
).pipe(Layer.provide(BoundedShaclValidationServiceLive));

/**
 * Drizzle-backed epistemic server layer: the live surface plus the bitemporal
 * edge authority and the append-only execution ledger, with dispositions
 * persisted rather than held in memory.
 *
 * **Example** (Import Drizzle-backed layer)
 *
 * ```ts
 * import { EpistemicServerDrizzleLive } from "@beep/epistemic-server/layer"
 *
 * console.log(EpistemicServerDrizzleLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EpistemicServerDrizzleLive: Layer.Layer<
  | ClaimDispositionRepository
  | ClaimGate
  | ClaimGateOutcomeResolver
  | ClaimTransition
  | ContradictionTriageRepository
  | EdgeAuthorityRepository
  | ExecutionLedger,
  never,
  PostgresDrizzle
> = Layer.mergeAll(
  ClaimGateLayer.pipe(Layer.provide(BoundedShaclValidationServiceLive)),
  ClaimTransitionLayer,
  ClaimDispositionRepositoryDrizzle,
  ContradictionTriageRepositoryDrizzle,
  EdgeAuthorityRepositoryDrizzle,
  ExecutionLedgerDrizzle,
  ClaimGateOutcomeResolverLayer.pipe(
    Layer.provide(Layer.merge(ClaimTransitionLayer, ClaimDispositionRepositoryDrizzle))
  )
);

const ContradictionRpcLive = ContradictionHandlersLive.pipe(Layer.provide(ContradictionTriageServiceLive));

/**
 * In-memory epistemic server surface plus contradiction RPC handlers.
 *
 * **Details**
 *
 * The application supplies the authenticated reviewer, trusted organization
 * and source scope, a source-text resolver, and the cryptographic hashing
 * service used to verify source identity.
 *
 * **Example** (Import RPC live layer)
 *
 * ```ts
 * import { EpistemicServerRpcLive } from "@beep/epistemic-server/layer"
 *
 * console.log(EpistemicServerRpcLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EpistemicServerRpcLive: Layer.Layer<
  Layer.Success<typeof ContradictionHandlersLive>,
  never,
  ContradictionReviewer | ContradictionReviewScope | Crypto.Crypto | SourceTextResolver
> = ContradictionRpcLive.pipe(Layer.provide(EpistemicServerLive));

/**
 * Drizzle-backed epistemic server surface plus contradiction RPC handlers.
 *
 * **Details**
 *
 * The application supplies Postgres, the authenticated reviewer, trusted
 * organization and source scope, a source-text resolver, and the cryptographic
 * hashing service used to verify source identity.
 *
 * **Example** (Import Drizzle RPC layer)
 *
 * ```ts
 * import { EpistemicServerDrizzleRpcLive } from "@beep/epistemic-server/layer"
 *
 * console.log(EpistemicServerDrizzleRpcLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EpistemicServerDrizzleRpcLive: Layer.Layer<
  Layer.Success<typeof ContradictionHandlersLive>,
  never,
  ContradictionReviewer | ContradictionReviewScope | Crypto.Crypto | PostgresDrizzle | SourceTextResolver
> = ContradictionRpcLive.pipe(Layer.provide(EpistemicServerDrizzleLive));

/**
 * Contradiction-triage repository, application-service, and RPC-handler layers
 * for application composition.
 *
 * @category layers
 * @since 0.0.0
 */
export {
  ContradictionHandlersLive,
  ContradictionTriageRepositoryDrizzle,
  ContradictionTriageRepositoryFixture,
  ContradictionTriageServiceLive,
};
