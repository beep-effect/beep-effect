/**
 * The matter wall over Practice KG reads: which family keys and mail folders a
 * query may return, and the SQL filters that enforce it inside each query.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { MailFolderBinding, PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope";
import { LawPrincipal, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { sqlStringLiteral } from "./internal/Sql.ts";
import type { GrantedScopes } from "@beep/law-practice-use-cases/MatterWall";

const $I = $LawPracticeServerId.create("PracticeKg.wall");

/**
 * **Details**
 *
 * `Walled` is a principal's read: only rows of the listed client-qualified
 * family keys (spelled `client.family`) and only messages under the listed
 * mail folder bindings. A row whose client or family is unknown matches no
 * key and is denied. `Unwalled` is a system read, such as docket intake
 * resolving a docket reference, and is never built from a principal's
 * request.
 *
 * **Example** (A read with no grants)
 *
 * ```ts
 * import { PracticeKgReadScope } from "@beep/law-practice-server"
 *
 * const scope = PracticeKgReadScope.cases.Walled.make({ familyKeys: [], mailFolders: [] })
 * console.log(scope._tag) // "Walled"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PracticeKgReadScope = S.TaggedUnion({
  Walled: {
    familyKeys: S.Array(PracticeKgFamilyKey).annotateKey({ description: "Granted client-qualified family keys." }),
    mailFolders: S.Array(MailFolderBinding).annotateKey({ description: "Granted mail folder bindings." }),
  },
  Unwalled: {},
}).pipe(
  $I.annoteSchema("PracticeKgReadScope", {
    description: "The family keys and mail folders a Practice KG read may return, or a system read.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type PracticeKgReadScope = typeof PracticeKgReadScope.Type;

const spelled = (key: PracticeKgFamilyKey): string => `${key.client}.${key.family}`;

const familyKeyOrder = Order.mapInput(Order.String, spelled);

/**
 * The walled read scope of a principal's granted scopes.
 *
 * **Example** (Wall a read by an empty grant)
 *
 * ```ts
 * import { practiceKgReadScopeOf } from "@beep/law-practice-server"
 * import { GrantedScopes } from "@beep/law-practice-use-cases/MatterWall"
 * import * as HashSet from "effect/HashSet"
 *
 * const scope = practiceKgReadScopeOf(
 *   GrantedScopes.make({ scopeRefs: HashSet.empty(), familyKeys: HashSet.empty(), mailFolders: HashSet.empty() })
 * )
 * console.log(scope._tag) // "Walled"
 * ```
 *
 * @param granted - Every scope key bound to a matter the principal is staffed on.
 * @returns A `Walled` scope listing the granted family keys and mail folders in a stable order.
 * @category constructors
 * @since 0.0.0
 */
export const practiceKgReadScopeOf = (granted: GrantedScopes): PracticeKgReadScope =>
  PracticeKgReadScope.cases.Walled.make({
    familyKeys: A.sort(A.fromIterable(granted.familyKeys), familyKeyOrder),
    mailFolders: A.sort(
      A.fromIterable(granted.mailFolders),
      Order.combine(
        Order.mapInput(Order.String, (binding: MailFolderBinding) => binding.archive),
        Order.mapInput(Order.String, (binding: MailFolderBinding) => binding.folderPrefix)
      )
    ),
  });

/**
 * The walled read scope of the host's principal.
 *
 * **Example** (Read the principal's scope)
 *
 * ```ts
 * import { currentPracticeKgReadScope } from "@beep/law-practice-server"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(currentPracticeKgReadScope)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const currentPracticeKgReadScope: Effect.Effect<PracticeKgReadScope, never, LawPrincipal | MatterAuthority> =
  Effect.gen(function* () {
    const { principal } = yield* LawPrincipal;
    const authority = yield* MatterAuthority;
    const granted = yield* authority.grantedScopes(principal);
    return practiceKgReadScopeOf(granted);
  });

const inList = (expression: string, values: ReadonlyArray<string>): string =>
  A.isReadonlyArrayNonEmpty(values) ? `(${expression}) IN (${A.join(A.map(values, sqlStringLiteral), ", ")})` : "FALSE";

/**
 * The SQL condition that keeps a row whose family key the scope grants.
 *
 * **Details**
 *
 * The condition is the same in PGlite and DuckDB. A `NULL` family key, the
 * value of a row with no client or no family, never matches, and an empty
 * grant is `FALSE`.
 *
 * **Example** (Filter by one granted family)
 *
 * ```ts
 * import { PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope"
 * import { PracticeKgReadScope, practiceKgFamilyKeyFilter } from "@beep/law-practice-server"
 *
 * const scope = PracticeKgReadScope.cases.Walled.make({ familyKeys: [PracticeKgFamilyKey.make({ client: "2001", family: "20001" })], mailFolders: [] })
 * console.log(practiceKgFamilyKeyFilter(scope, "n.client || '.' || n.docket_family"))
 * // "(n.client || '.' || n.docket_family) IN ('2001.20001')"
 * ```
 *
 * @param scope - The read scope.
 * @param familyKey - SQL expression for the row's client-qualified family key.
 * @returns A SQL boolean expression.
 * @category utilities
 * @since 0.0.0
 */
export const practiceKgFamilyKeyFilter: {
  (familyKey: string): (scope: PracticeKgReadScope) => string;
  (scope: PracticeKgReadScope, familyKey: string): string;
} = dual(2, (scope: PracticeKgReadScope, familyKey: string): string =>
  PracticeKgReadScope.match(scope, {
    Unwalled: () => "TRUE",
    Walled: ({ familyKeys }) => inList(familyKey, A.map(familyKeys, spelled)),
  })
);

/**
 * The SQL condition that keeps a row whose client owns a granted family key.
 *
 * **Example** (Filter by a granted family's client)
 *
 * ```ts
 * import { PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope"
 * import { PracticeKgReadScope, practiceKgClientFilter } from "@beep/law-practice-server"
 *
 * const scope = PracticeKgReadScope.cases.Walled.make({ familyKeys: [PracticeKgFamilyKey.make({ client: "2001", family: "20001" })], mailFolders: [] })
 * console.log(practiceKgClientFilter(scope, "l.client_number")) // "(l.client_number) IN ('2001')"
 * ```
 *
 * @param scope - The read scope.
 * @param client - SQL expression for the row's client number.
 * @returns A SQL boolean expression.
 * @category utilities
 * @since 0.0.0
 */
export const practiceKgClientFilter: {
  (client: string): (scope: PracticeKgReadScope) => string;
  (scope: PracticeKgReadScope, client: string): string;
} = dual(2, (scope: PracticeKgReadScope, client: string): string =>
  PracticeKgReadScope.match(scope, {
    Unwalled: () => "TRUE",
    Walled: ({ familyKeys }) => inList(client, A.dedupe(A.map(familyKeys, (familyKey) => familyKey.client))),
  })
);

/**
 * The SQL condition that keeps a mail message under a granted folder binding.
 *
 * **Details**
 *
 * A message matches a binding when its archive digest equals the binding's
 * archive and its folder path starts with the binding's prefix. A message
 * under no binding is denied.
 *
 * **Example** (Filter by one bound folder)
 *
 * ```ts
 * import { MailFolderBinding } from "@beep/law-practice-domain/values/MatterScope"
 * import { PracticeKgReadScope, practiceKgMailFolderFilter } from "@beep/law-practice-server"
 *
 * const scope = PracticeKgReadScope.cases.Walled.make({
 *   familyKeys: [],
 *   mailFolders: [MailFolderBinding.make({ archive: "sha256:aa", folderPrefix: "Inbox/A" })]
 * })
 * console.log(practiceKgMailFolderFilter(scope, "archive_digest", "folder_path"))
 * // "((archive_digest = 'sha256:aa' AND starts_with(folder_path, 'Inbox/A')))"
 * ```
 *
 * @param scope - The read scope.
 * @param archive - SQL expression for the message's archive digest.
 * @param folder - SQL expression for the message's folder path.
 * @returns A DuckDB boolean expression.
 * @category utilities
 * @since 0.0.0
 */
export const practiceKgMailFolderFilter: {
  (archive: string, folder: string): (scope: PracticeKgReadScope) => string;
  (scope: PracticeKgReadScope, archive: string, folder: string): string;
} = dual(3, (scope: PracticeKgReadScope, archive: string, folder: string): string =>
  PracticeKgReadScope.match(scope, {
    Unwalled: () => "TRUE",
    Walled: ({ mailFolders }) =>
      A.isReadonlyArrayNonEmpty(mailFolders)
        ? `(${A.join(
            A.map(
              mailFolders,
              (binding) =>
                `(${archive} = ${sqlStringLiteral(binding.archive)} AND starts_with(${folder}, ${sqlStringLiteral(binding.folderPrefix)}))`
            ),
            " OR "
          )})`
        : "FALSE",
  })
);

/**
 * Whether the scope grants a family key.
 *
 * **Example** (Check a key)
 *
 * ```ts
 * import { PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope"
 * import { PracticeKgReadScope, practiceKgGrantsFamily } from "@beep/law-practice-server"
 *
 * const scope = PracticeKgReadScope.cases.Walled.make({ familyKeys: [PracticeKgFamilyKey.make({ client: "2001", family: "20001" })], mailFolders: [] })
 * console.log(practiceKgGrantsFamily(scope)("2001.20001")) // true
 * ```
 *
 * @param scope - The read scope.
 * @returns A predicate over client-qualified family keys.
 * @category utilities
 * @since 0.0.0
 */
export const practiceKgGrantsFamily =
  (scope: PracticeKgReadScope) =>
  (familyKey: string): boolean =>
    PracticeKgReadScope.match(scope, {
      Unwalled: () => true,
      Walled: ({ familyKeys }) => HashSet.has(HashSet.fromIterable(A.map(familyKeys, spelled)), familyKey),
    });
