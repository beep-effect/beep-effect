/**
 * Matter scope bindings: which scope keys belong to one matter, and which
 * matters a principal is staffed on.
 *
 * **Details**
 *
 * Each walled path already carries a scope key: text paths a `scopeRef`,
 * Practice KG rows a client-qualified family key, email rows a mail archive
 * and folder. A {@link MatterScope} binds keys of each kind to one matter and
 * a {@link MatterGrant} staffs a principal on matters (decision
 * `matter-authority-port-principal-and-scope-bindings`).
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { ScopeRef } from "../LawClaim/LawClaim.model.ts";

const $I = $LawPracticeDomainId.create("values/MatterScope/MatterScope.model");

/**
 * The kind of access a walled path asks for: the seven SPEC paths in order,
 * then the two claim writes.
 *
 * **Example** (Check an access kind)
 *
 * ```ts import.meta.vitest name="Check an access kind"
 * import { MatterAccessKind } from "@beep/law-practice-domain/values/MatterScope"
 *
 * MatterAccessKind.is["graph-query"]("graph-query") // => true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const MatterAccessKind = LiteralKit([
  "source-retrieval",
  "anchor-resolution",
  "graph-query",
  "search",
  "cache-lookup",
  "draft-assembly",
  "provenance-traversal",
  "claim-proposal",
  "claim-admission",
]).pipe($I.annoteSchema("MatterAccessKind", { description: "The kind of access a walled path asks for." }));

/**
 * @category value-objects
 * @since 0.0.0
 */
export type MatterAccessKind = typeof MatterAccessKind.Type;

const FamilyKeyPart = S.NonEmptyString.check(
  S.isPattern(/^[^.]+$/, {
    message: "Expected a family key part without a dot",
    description: "One part of a client-qualified Practice KG family key; the client part holds no dot.",
  })
);

const FamilyKeyFields = S.Struct({
  client: FamilyKeyPart.annotateKey({ description: "Client part of the family key." }),
  family: S.NonEmptyString.annotateKey({ description: "Docket family part of the family key." }),
});

/**
 * **Details**
 *
 * Decoding splits at the first dot, so the client part holds no dot. A row
 * whose client or family is missing has no key: an empty part is refused.
 * Two clients sharing a family string are two keys.
 *
 * **Example** (Decode a family key)
 *
 * ```ts
 * import { PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope"
 * import * as S from "effect/Schema"
 *
 * const key = S.decodeUnknownSync(PracticeKgFamilyKey)("acme.US-2024-001")
 * console.log(key.client, key.family) // acme US-2024-001
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class PracticeKgFamilyKey extends S.Opaque<PracticeKgFamilyKey, { readonly brand: unique symbol }>()(
  S.String.pipe(
    S.decodeTo(
      FamilyKeyFields,
      SchemaTransformation.transform({
        decode: (spelled: string) =>
          O.match(Str.indexOf(".")(spelled), {
            onNone: () => ({ client: spelled, family: "" }),
            onSome: (dot) => ({ client: Str.slice(0, dot)(spelled), family: Str.slice(dot + 1)(spelled) }),
          }),
        encode: (key: typeof FamilyKeyFields.Type): string => `${key.client}.${key.family}`,
      })
    ),
    $I.annoteSchema("PracticeKgFamilyKey", {
      description: "Client-qualified Practice KG family key, spelled client.family.",
    })
  )
) {}

const MailFolderBindingFields = S.Struct({
  archive: S.NonEmptyString.annotateKey({ description: "Digest of the mail archive the messages came from." }),
  folderPrefix: S.NonEmptyString.annotateKey({ description: "Folder path prefix the bound messages sit under." }),
});

/**
 * Binds the messages of one mail archive under one folder path prefix to a
 * matter; email rows carry no docket or client, so this is their only key.
 *
 * **Example** (Build a binding)
 *
 * ```ts
 * import { MailFolderBinding } from "@beep/law-practice-domain/values/MatterScope"
 *
 * const binding = MailFolderBinding.make({ archive: "sha256-archive", folderPrefix: "Matters/A" })
 * console.log(binding.folderPrefix) // "Matters/A"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class MailFolderBinding extends S.Opaque<MailFolderBinding, { readonly brand: unique symbol }>()(
  MailFolderBindingFields.pipe(
    $I.annoteSchema("MailFolderBinding", {
      description: "Binds the messages of one mail archive under one folder prefix to a matter.",
    })
  )
) {}

const mailFolderOrder: Order.Order<typeof MailFolderBinding.Encoded> = Order.combine(
  Order.mapInput(Order.String, (binding: typeof MailFolderBinding.Encoded) => binding.archive),
  Order.mapInput(Order.String, (binding: typeof MailFolderBinding.Encoded) => binding.folderPrefix)
);

const orderedHashSet = <Item extends S.Top>(item: Item, order: Order.Order<Item["Encoded"]>) =>
  item.pipe(
    S.toEncoded,
    S.Array,
    S.decodeTo(
      S.HashSet(item),
      SchemaTransformation.transform({
        decode: (members: ReadonlyArray<Item["Encoded"]>) => HashSet.fromIterable(members),
        encode: (members: HashSet.HashSet<Item["Encoded"]>): ReadonlyArray<Item["Encoded"]> =>
          A.sort(A.fromIterable(members), order),
      })
    )
  );

const MailFolderBindings = orderedHashSet(MailFolderBinding, mailFolderOrder).pipe(
  $I.annoteSchema("MailFolderBindings", {
    description: "A set of mail folder bindings encoded sorted by archive, then folder prefix.",
  })
);

const MatterScopeFields = S.Struct({
  matter: LawPractice.MatterId,
  scopeRefs: CanonicalHashSet(ScopeRef).annotateKey({ description: "Capture scope references bound to the matter." }),
  familyKeys: CanonicalHashSet(PracticeKgFamilyKey).annotateKey({
    description: "Practice KG family keys bound to the matter.",
  }),
  mailFolders: MailFolderBindings.annotateKey({ description: "Mail folder bindings bound to the matter." }),
});

/**
 * Binds the scope keys each walled path carries to one matter; at least one
 * key set is non-empty.
 *
 * **Example** (Bind a scope reference to a matter)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { MatterScope } from "@beep/law-practice-domain/values/MatterScope"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * const scope = MatterScope.make({
 *   matter: LawPractice.MatterId.make(1),
 *   scopeRefs: HashSet.make("matter:a"),
 *   familyKeys: HashSet.empty(),
 *   mailFolders: HashSet.empty(),
 * })
 *
 * console.log(HashSet.size(scope.scopeRefs)) // 1
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class MatterScope extends S.Opaque<MatterScope, { readonly brand: unique symbol }>()(
  MatterScopeFields.check(
    S.makeFilter(
      (scope: typeof MatterScopeFields.Type) =>
        HashSet.size(scope.scopeRefs) + HashSet.size(scope.familyKeys) + HashSet.size(scope.mailFolders) > 0,
      $I.annote("MatterScopeBindsAKey", {
        title: "Matter Scope Binds A Key",
        description: "A matter scope binds at least one scope reference, family key or mail folder.",
        message: "Expected at least one scope reference, family key or mail folder binding",
      })
    )
  ).pipe($I.annoteSchema("MatterScope", { description: "The scope keys bound to one matter." }))
) {}

/**
 * **Example** (Staff a principal on a matter)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { MatterGrant } from "@beep/law-practice-domain/values/MatterScope"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * const grant = MatterGrant.make({
 *   principal: Shared.UserId.make(7),
 *   matters: HashSet.make(LawPractice.MatterId.make(1)),
 * })
 *
 * console.log(HashSet.size(grant.matters)) // 1
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class MatterGrant extends S.Opaque<MatterGrant, { readonly brand: unique symbol }>()(
  S.Struct({
    principal: Shared.UserId,
    matters: orderedHashSet(LawPractice.MatterId, Order.Number).annotateKey({
      description: "Matters the principal is staffed on.",
    }),
  }).pipe($I.annoteSchema("MatterGrant", { description: "The matters one principal is staffed on." }))
) {}
