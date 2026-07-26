/**
 * Epistemic server layer.
 *
 * Composes the slice's live service surface: the claim gate (wired over the
 * bounded SHACL engine), the lifecycle transition, and the gate-outcome resolver
 * that gives a rejected verdict somewhere durable to land. The shared
 * `ShaclValidationService` backend is provided once at the merge boundary so it
 * is built a single time across consumers.
 *
 * Two compositions are published rather than one. `EpistemicServerLive` requires
 * nothing and keeps the in-memory disposition repository, so gate and lifecycle
 * consumers boot it without standing up a database;
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
import { ShaclValidationServiceLive } from "@beep/semantic-web/adapters/shacl-engine";
import { ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { Effect, Layer } from "effect";
import { ClaimDispositionRepositoryDrizzle, ClaimDispositionRepositoryInMemory } from "./ClaimDisposition/index.ts";
import { EdgeAuthorityRepositoryDrizzle } from "./EdgeAuthority/index.ts";
import { ExecutionLedgerDrizzle } from "./ExecutionLedger/index.ts";
import type { EdgeAuthorityRepository } from "@beep/epistemic-use-cases/EdgeAuthority";
import type { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import type { PostgresDrizzle } from "@beep/postgres";

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
 * @example
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
  ClaimDispositionRepository | ClaimGate | ClaimGateOutcomeResolver | ClaimTransition
> = Layer.mergeAll(
  ClaimGateLayer,
  ClaimTransitionLayer,
  ClaimDispositionRepositoryInMemory,
  ClaimGateOutcomeResolverLayer.pipe(
    Layer.provide(Layer.merge(ClaimTransitionLayer, ClaimDispositionRepositoryInMemory))
  )
).pipe(Layer.provide(ShaclValidationServiceLive));

/**
 * Drizzle-backed epistemic server layer: the live surface plus the bitemporal
 * edge authority and the append-only execution ledger, with dispositions
 * persisted rather than held in memory.
 *
 * @example
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
  | EdgeAuthorityRepository
  | ExecutionLedger,
  never,
  PostgresDrizzle
> = Layer.mergeAll(
  ClaimGateLayer.pipe(Layer.provide(ShaclValidationServiceLive)),
  ClaimTransitionLayer,
  ClaimDispositionRepositoryDrizzle,
  EdgeAuthorityRepositoryDrizzle,
  ExecutionLedgerDrizzle,
  ClaimGateOutcomeResolverLayer.pipe(
    Layer.provide(Layer.merge(ClaimTransitionLayer, ClaimDispositionRepositoryDrizzle))
  )
);
