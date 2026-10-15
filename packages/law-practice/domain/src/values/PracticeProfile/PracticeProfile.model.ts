/**
 * Practice profile value objects: what an onboarding interview learns about a
 * practice, and which provider serves each capability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { LawPracticeText } from "../../entities/LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("values/PracticeProfile/PracticeProfile.model");

/**
 * A capability a practice can ask the gateway to provide.
 *
 * **Example** (Check a capability literal)
 *
 * ```ts
 * import { PracticeCapability } from "@beep/law-practice-domain"
 *
 * console.log(PracticeCapability.is.documents("documents")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PracticeCapability = LiteralKit([
  "documents",
  "mail-calendar",
  "secrets",
  "practice-billing",
  "knowledge-graph",
]).pipe(
  $I.annoteSchema("PracticeCapability", {
    description: "A capability a practice can ask the gateway to provide.",
  })
);

/**
 * Decoded type of {@link PracticeCapability}.
 *
 * **Example** (Type a capability)
 *
 * ```ts
 * import type { PracticeCapability } from "@beep/law-practice-domain"
 *
 * const capability: PracticeCapability = "secrets"
 * console.log(capability)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeCapability = typeof PracticeCapability.Type;

/**
 * A provider the gateway has an adapter for.
 *
 * **Details**
 *
 * Grows one adapter at a time in solo/small-firm adoption order. A provider a
 * practice names that is not listed here is recorded as a
 * {@link CapabilityGap}, not added ad hoc.
 *
 * **Example** (Check a provider literal)
 *
 * ```ts
 * import { PracticeProvider } from "@beep/law-practice-domain"
 *
 * console.log(PracticeProvider.is["box-drive"]("box-drive")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PracticeProvider = LiteralKit([
  "box-drive",
  "microsoft-365",
  "windows-credential-manager",
  "practice-kg",
]).pipe(
  $I.annoteSchema("PracticeProvider", {
    description: "A provider the gateway has an adapter for.",
  })
);

/**
 * Decoded type of {@link PracticeProvider}.
 *
 * **Example** (Type a provider)
 *
 * ```ts
 * import type { PracticeProvider } from "@beep/law-practice-domain"
 *
 * const provider: PracticeProvider = "microsoft-365"
 * console.log(provider)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeProvider = typeof PracticeProvider.Type;

/**
 * A capability served by a supported provider.
 *
 * **Example** (Choose Box Drive for documents)
 *
 * ```ts
 * import { CapabilitySupported } from "@beep/law-practice-domain"
 *
 * const choice = CapabilitySupported.make({ capability: "documents", provider: "box-drive" })
 * console.log(choice.kind) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilitySupported extends S.Opaque<CapabilitySupported, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("supported"),
    capability: PracticeCapability.annotateKey({ description: "The capability being served." }),
    provider: PracticeProvider.annotateKey({ description: "The supported provider serving it." }),
  }).pipe(
    $I.annoteSchema("CapabilitySupported", {
      description: "A capability served by a supported provider.",
    })
  )
) {}

/**
 * A capability the practice wants from a provider the gateway has no adapter
 * for yet.
 *
 * **Details**
 *
 * Gaps are demand data: the named provider ranks which adapter to build next.
 * The optional fallback is a supported provider that covers the capability in
 * the meantime.
 *
 * **Example** (Record a NetDocuments gap with a Box Drive fallback)
 *
 * ```ts
 * import { CapabilityGap } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const gap = CapabilityGap.make({
 *   capability: "documents",
 *   namedProvider: "NetDocuments",
 *   fallback: O.some("box-drive"),
 * })
 * console.log(gap.kind) // "gap"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityGap extends S.Opaque<CapabilityGap, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("gap"),
    capability: PracticeCapability.annotateKey({ description: "The capability the practice wants." }),
    namedProvider: LawPracticeText.annotateKey({
      description: "The provider the practice named, in its own words.",
    }),
    fallback: PracticeProvider.pipe(
      S.OptionFromOptionalKey,
      S.annotateKey({ description: "A supported provider covering the capability meanwhile." })
    ),
  }).pipe(
    $I.annoteSchema("CapabilityGap", {
      description: "A wanted capability whose named provider has no adapter yet.",
    })
  )
) {}

/**
 * A capability the practice chose not to set up.
 *
 * **Example** (Decline practice billing)
 *
 * ```ts
 * import { CapabilityDeclined } from "@beep/law-practice-domain"
 *
 * const declined = CapabilityDeclined.make({ capability: "practice-billing" })
 * console.log(declined.kind) // "declined"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityDeclined extends S.Opaque<CapabilityDeclined, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("declined"),
    capability: PracticeCapability.annotateKey({ description: "The capability the practice declined." }),
  }).pipe(
    $I.annoteSchema("CapabilityDeclined", {
      description: "A capability the practice chose not to set up.",
    })
  )
) {}

/**
 * The interview outcome for one capability, discriminated on `kind`.
 *
 * **Example** (Branch on a capability choice)
 *
 * ```ts
 * import { CapabilityChoice, CapabilitySupported } from "@beep/law-practice-domain"
 *
 * const choice: CapabilityChoice = CapabilitySupported.make({ capability: "documents", provider: "box-drive" })
 * console.log(CapabilityChoice.guards.supported(choice)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CapabilityChoice = S.Union([CapabilitySupported, CapabilityGap, CapabilityDeclined]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("CapabilityChoice", {
    description: "The interview outcome for one capability.",
  })
);

/**
 * Decoded type of {@link CapabilityChoice}.
 *
 * **Example** (Type a declined choice)
 *
 * ```ts
 * import { CapabilityDeclined, type CapabilityChoice } from "@beep/law-practice-domain"
 *
 * const choice: CapabilityChoice = CapabilityDeclined.make({ capability: "secrets" })
 * console.log(choice.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CapabilityChoice = typeof CapabilityChoice.Type;

/**
 * Whether the lawyer can approve Windows administrator prompts on this machine.
 *
 * **Example** (Check admin availability)
 *
 * ```ts
 * import { AdminRights } from "@beep/law-practice-domain"
 *
 * console.log(AdminRights.is.blocked("blocked")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdminRights = LiteralKit(["available", "blocked", "unknown"]).pipe(
  $I.annoteSchema("AdminRights", {
    description: "Whether the lawyer can approve Windows administrator prompts.",
  })
);

/**
 * Decoded type of {@link AdminRights}.
 *
 * **Example** (Type admin rights)
 *
 * ```ts
 * import type { AdminRights } from "@beep/law-practice-domain"
 *
 * const rights: AdminRights = "unknown"
 * console.log(rights)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AdminRights = typeof AdminRights.Type;

/**
 * Whether outbound traffic passes through a network proxy.
 *
 * **Example** (Check proxy presence)
 *
 * ```ts
 * import { NetworkProxy } from "@beep/law-practice-domain"
 *
 * console.log(NetworkProxy.is.present("present")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NetworkProxy = LiteralKit(["none", "present", "unknown"]).pipe(
  $I.annoteSchema("NetworkProxy", {
    description: "Whether outbound traffic passes through a network proxy.",
  })
);

/**
 * Decoded type of {@link NetworkProxy}.
 *
 * **Example** (Type proxy presence)
 *
 * ```ts
 * import type { NetworkProxy } from "@beep/law-practice-domain"
 *
 * const proxy: NetworkProxy = "none"
 * console.log(proxy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkProxy = typeof NetworkProxy.Type;

/**
 * Firm IT limits that shape which remediations the doctor may attempt.
 *
 * **Example** (Record unknown IT limits)
 *
 * ```ts
 * import { ItLimits } from "@beep/law-practice-domain"
 *
 * const limits = ItLimits.make({ adminRights: "unknown", proxy: "unknown" })
 * console.log(limits.adminRights)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ItLimits extends S.Opaque<ItLimits, { readonly brand: unique symbol }>()(
  S.Struct({
    adminRights: AdminRights.annotateKey({ description: "Whether admin prompts can be approved." }),
    proxy: NetworkProxy.annotateKey({ description: "Whether a network proxy is in the path." }),
  }).pipe(
    $I.annoteSchema("ItLimits", {
      description: "Firm IT limits that shape which remediations the doctor may attempt.",
    })
  )
) {}

/**
 * The outcome of an onboarding interview: one choice per capability discussed
 * and the firm's IT limits.
 *
 * **Details**
 *
 * The profile selects which providers the gateway mounts and which setup
 * requirements the doctor checks. It holds no secrets and no client data.
 *
 * **Example** (Build a profile for the first proving ground)
 *
 * ```ts
 * import { CapabilitySupported, ItLimits, PracticeProfile } from "@beep/law-practice-domain"
 * import * as DateTime from "effect/DateTime"
 *
 * const profile = PracticeProfile.make({
 *   choices: [
 *     CapabilitySupported.make({ capability: "documents", provider: "box-drive" }),
 *     CapabilitySupported.make({ capability: "mail-calendar", provider: "microsoft-365" }),
 *   ],
 *   itLimits: ItLimits.make({ adminRights: "available", proxy: "none" }),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(profile.choices.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeProfile extends S.Opaque<PracticeProfile, { readonly brand: unique symbol }>()(
  S.Struct({
    choices: S.NonEmptyArray(CapabilityChoice).annotateKey({
      description: "One interview outcome per capability discussed.",
    }),
    itLimits: ItLimits.annotateKey({ description: "Firm IT limits found during the interview." }),
    recordedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "When the interview produced this profile.",
    }),
  }).pipe(
    $I.annoteSchema("PracticeProfile", {
      description: "The outcome of an onboarding interview: capability choices and IT limits.",
    })
  )
) {}
