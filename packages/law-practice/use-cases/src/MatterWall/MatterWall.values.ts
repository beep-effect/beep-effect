/**
 * Matter wall values: the access answer and the scope keys a principal may read.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { MatterScope } from "@beep/law-practice-domain/values/MatterScope";
import { LiteralKit } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("MatterWall/MatterWall.values");

/**
 * Why a walled path was denied: the scope key binds no matter, or the
 * principal is not staffed on the matter it binds.
 *
 * **Example** (Check a denial reason)
 *
 * ```ts
 * import { MatterDenialReason } from "@beep/law-practice-use-cases/MatterWall"
 *
 * console.log(MatterDenialReason.is["not-staffed"]("not-staffed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MatterDenialReason = LiteralKit(["unbound-scope", "not-staffed"]).pipe(
  $I.annoteSchema("MatterDenialReason", { description: "Why the matter wall denied a walled path." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type MatterDenialReason = typeof MatterDenialReason.Type;

/**
 * The matter wall's answer: the matter a granted scope key binds, or the
 * reason for a denial.
 *
 * **Example** (Decode a denial)
 *
 * ```ts
 * import { MatterAccess } from "@beep/law-practice-use-cases/MatterWall"
 * import * as S from "effect/Schema"
 *
 * const access = S.decodeUnknownSync(MatterAccess)({ _tag: "Denied", reason: "unbound-scope" })
 * console.log(access._tag) // "Denied"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MatterAccess = S.TaggedUnion({
  Granted: { matter: LawPractice.MatterId },
  Denied: { reason: MatterDenialReason },
}).pipe($I.annoteSchema("MatterAccess", { description: "The matter a granted scope binds, or a denial reason." }));

/**
 * @category models
 * @since 0.0.0
 */
export type MatterAccess = typeof MatterAccess.Type;

/**
 * Every scope key bound to a matter the principal is staffed on: what a bulk
 * read filters by inside its query.
 *
 * **Example** (Grant nothing)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { GrantedScopes } from "@beep/law-practice-use-cases/MatterWall"
 *
 * const none = GrantedScopes.make({
 *   scopeRefs: HashSet.empty(),
 *   familyKeys: HashSet.empty(),
 *   mailFolders: HashSet.empty(),
 * })
 * console.log(HashSet.size(none.scopeRefs)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrantedScopes extends S.Opaque<GrantedScopes, { readonly brand: unique symbol }>()(
  S.Struct({
    scopeRefs: MatterScope.fields.scopeRefs,
    familyKeys: MatterScope.fields.familyKeys,
    mailFolders: MatterScope.fields.mailFolders,
  }).pipe(
    $I.annoteSchema("GrantedScopes", {
      description: "Every scope key bound to a matter the principal is staffed on.",
    })
  )
) {}
