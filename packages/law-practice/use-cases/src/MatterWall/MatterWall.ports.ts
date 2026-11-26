/**
 * Matter wall ports: the host-provided principal and the matter authority
 * every walled path asks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { ScopeRef } from "@beep/law-practice-domain/values/LawClaim";
import type { MatterAccessKind, PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope";
import type * as Shared from "@beep/shared-domain/identity/Shared";
import type * as Effect from "effect/Effect";
import type { GrantedScopes, MatterAccess } from "./MatterWall.values.ts";

const $I = $LawPracticeUseCasesId.create("MatterWall/MatterWall.ports");

/**
 * The principal a walled path acts for, provided by the host and never read
 * from a request.
 *
 * **Example** (Read the principal)
 *
 * ```ts
 * import { LawPrincipal } from "@beep/law-practice-use-cases/MatterWall"
 * import * as Effect from "effect/Effect"
 *
 * const principal = LawPrincipal.pipe(Effect.map((current) => current.principal))
 * console.log(Effect.isEffect(principal)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LawPrincipal extends Context.Service<LawPrincipal, { readonly principal: Shared.UserId }>()(
  $I`LawPrincipal`
) {}

/**
 * Service shape of the matter authority.
 *
 * **Details**
 *
 * `authorize` resolves a scope reference to the matter it binds and checks the
 * principal's staffing; `authorizeFamily` does the same for a Practice KG
 * family key. A refusal is a `Denied` value, never a failure.
 * `grantedScopes` returns every key of every matter the principal is staffed
 * on, for reads that filter in bulk.
 *
 * **Example** (Name an authority method)
 *
 * ```ts
 * import type { MatterAuthorityShape } from "@beep/law-practice-use-cases/MatterWall"
 *
 * const method: keyof MatterAuthorityShape = "authorize"
 * console.log(method) // "authorize"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface MatterAuthorityShape {
  /** Answer whether the principal may take the access on the scope reference. */
  readonly authorize: (request: {
    readonly principal: Shared.UserId;
    readonly scope: ScopeRef;
    readonly access: MatterAccessKind;
  }) => Effect.Effect<MatterAccess>;
  /** Answer whether the principal may take the access on the family key. */
  readonly authorizeFamily: (request: {
    readonly principal: Shared.UserId;
    readonly family: PracticeKgFamilyKey;
    readonly access: MatterAccessKind;
  }) => Effect.Effect<MatterAccess>;
  /** Every scope key bound to a matter the principal is staffed on. */
  readonly grantedScopes: (principal: Shared.UserId) => Effect.Effect<GrantedScopes>;
}

/**
 * The one authority every walled path asks before it reads matter material.
 *
 * **Example** (Reference the authority service)
 *
 * ```ts
 * import { MatterAuthority } from "@beep/law-practice-use-cases/MatterWall"
 *
 * console.log(MatterAuthority.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MatterAuthority extends Context.Service<MatterAuthority, MatterAuthorityShape>()($I`MatterAuthority`) {}
