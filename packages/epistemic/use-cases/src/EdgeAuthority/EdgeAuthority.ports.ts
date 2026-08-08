/**
 * Edge authority repository port: the typed contract through which bitemporal
 * epistemic edges are asserted, superseded, and read on both time axes. The live
 * implementation is provided in the epistemic server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import type { LogicalEdgeKey } from "@beep/epistemic-domain/values";
import type { Effect, Option } from "effect";
import type { EdgeAsOfQuery, RecordEdgeFact, SupersedeEdgeFact } from "./EdgeAuthority.commands.ts";
import type { EdgeAuthorityError, EdgeRepositoryUnavailable } from "./EdgeAuthority.errors.ts";

const $I = $EpistemicUseCasesId.create("EdgeAuthority/EdgeAuthority.ports");

/**
 * Service shape for the bitemporal edge authority.
 *
 * **Details**
 *
 * The surface is deliberately four operations wide, and what it omits is the
 * contract:
 *
 * - There is no update surface for `supersedesId`. Lineage is written once, when
 *   a replacement row is inserted, and no operation here can rewrite it — which
 *   is why cycle prevention stays application-side (P0 S6) rather than needing a
 *   database trigger to police mutations that cannot happen.
 * - There is no update surface for `fact` either. A fact payload is immutable;
 *   correcting a belief means superseding it, so the record of what was once
 *   believed survives the correction.
 * - There is no delete surface at all. History is the product.
 * - `supersede` closes the head and inserts the replacement inside ONE
 *   transaction. A caller can never observe an edge with two open heads or with
 *   none, and a failure leaves the head exactly where it was.
 * - `readAsOf` answers on both axes; `readLatest` is the same predicate asked at
 *   now/now, not a separate "current" table or an `isLatest` flag.
 *
 * **Example** (Read-only offline stub)
 *
 * ```ts
 * import type { EdgeAuthorityRepositoryShape } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import { EdgeRepositoryUnavailable } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const offline: EdgeAuthorityRepositoryShape = {
 *   readAsOf: () => Effect.succeed(O.none()),
 *   readLatest: () => Effect.succeed(O.none()),
 *   record: () => Effect.fail(EdgeRepositoryUnavailable.during("record", "read-only stub")),
 *   supersede: () => Effect.fail(EdgeRepositoryUnavailable.during("supersede", "read-only stub"))
 * }
 *
 * console.log(typeof offline.readLatest)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface EdgeAuthorityRepositoryShape {
  readonly readAsOf: (query: EdgeAsOfQuery) => Effect.Effect<Option.Option<EdgeVersion>, EdgeRepositoryUnavailable>;
  readonly readLatest: (
    logicalKey: LogicalEdgeKey
  ) => Effect.Effect<Option.Option<EdgeVersion>, EdgeRepositoryUnavailable>;
  readonly record: (command: RecordEdgeFact) => Effect.Effect<EdgeVersion, EdgeAuthorityError>;
  readonly supersede: (command: SupersedeEdgeFact) => Effect.Effect<EdgeVersion, EdgeAuthorityError>;
}

/**
 * Edge authority repository service tag.
 *
 * **Example** (Provide service with stub)
 *
 * ```ts
 * import { EdgeAuthorityRepository } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import { EdgeRepositoryUnavailable } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* EdgeAuthorityRepository
 *   return typeof repository.readAsOf === "function"
 * }).pipe(
 *   Effect.provideService(
 *     EdgeAuthorityRepository,
 *     EdgeAuthorityRepository.of({
 *       readAsOf: () => Effect.succeed(O.none()),
 *       readLatest: () => Effect.succeed(O.none()),
 *       record: () => Effect.fail(EdgeRepositoryUnavailable.during("record", "read-only stub")),
 *       supersede: () => Effect.fail(EdgeRepositoryUnavailable.during("supersede", "read-only stub"))
 *     })
 *   )
 * )
 *
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class EdgeAuthorityRepository extends Context.Service<EdgeAuthorityRepository, EdgeAuthorityRepositoryShape>()(
  $I`EdgeAuthorityRepository`
) {}
