/**
 * The slice 1 setup requirement catalog, as data, and the pure mapping from a
 * practice profile to the requirements the doctor checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import {
  AutomaticRemediation,
  CapabilityChoice,
  HumanRemediation,
  Remediation,
  SetupCapability,
  SetupProvider,
  SetupRequirement,
  SetupRequirementId,
} from "@beep/law-practice-domain";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { PracticeCapability, PracticeProfile, PracticeProvider } from "@beep/law-practice-domain";

const $I = $PracticeGatewayId.create("Requirements");

/**
 * Identifiers of every requirement the slice 1 gateway can check.
 *
 * **Example** (Check a requirement id)
 *
 * ```ts
 * import { GatewayRequirementId } from "@beep/practice-gateway/Requirements"
 *
 * console.log(GatewayRequirementId.is["bitlocker-on"]("bitlocker-on")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GatewayRequirementId = LiteralKit([
  "claude-desktop-installed",
  "claude-signed-in",
  "box-drive-installed",
  "box-drive-signed-in",
  "box-drive-folder-available",
  "m365-consented",
  "m365-token-cached",
  "practice-kg-bundle-present",
  "practice-kg-self-check",
  "bitlocker-on",
]).pipe(
  $I.annoteSchema("GatewayRequirementId", {
    description: "Identifier of a setup requirement the slice 1 gateway can check.",
  })
);

/**
 * Decoded type of {@link GatewayRequirementId}.
 *
 * **Example** (Type a requirement id)
 *
 * ```ts
 * import type { GatewayRequirementId } from "@beep/practice-gateway/Requirements"
 *
 * const id: GatewayRequirementId = "m365-token-cached"
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GatewayRequirementId = typeof GatewayRequirementId.Type;

/**
 * A catalog entry: everything about a requirement except the capability it
 * serves, which comes from the profile choice that selected it.
 *
 * **Example** (Describe a catalog entry)
 *
 * ```ts
 * import { HumanRemediation } from "@beep/law-practice-domain"
 * import { RequirementTemplate } from "@beep/practice-gateway/Requirements"
 *
 * const entry = RequirementTemplate.make({
 *   id: "claude-signed-in",
 *   provider: "claude",
 *   dependsOn: [],
 *   remediation: HumanRemediation.make({ step: "sign-in", instruction: "Open Claude and sign in." }),
 *   explain: "Claude runs the practice tools.",
 * })
 * console.log(entry.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RequirementTemplate extends S.Opaque<RequirementTemplate, { readonly brand: unique symbol }>()(
  S.Struct({
    id: GatewayRequirementId.annotateKey({ description: "Stable identifier of the requirement." }),
    provider: SetupProvider.annotateKey({ description: "The provider or host the requirement belongs to." }),
    dependsOn: S.Array(GatewayRequirementId).annotateKey({
      description: "Requirements that must hold before this one is probed.",
    }),
    remediation: Remediation.annotateKey({ description: "How the requirement is repaired." }),
    explain: S.NonEmptyString.annotateKey({ description: "Plain-language reason shown to the lawyer." }),
  }).pipe(
    $I.annoteSchema("RequirementTemplate", {
      description: "A setup requirement catalog entry without its capability.",
    })
  )
) {}

const human = (step: HumanRemediation["step"], instruction: string) => HumanRemediation.make({ step, instruction });

/**
 * The slice 1 requirement catalog, keyed by id.
 *
 * **Details**
 *
 * Box Drive install and the Microsoft 365 sign-in page are the automatic
 * remediations; everything else is a step only the lawyer can take (D3). The
 * Microsoft 365 repair only opens the sign-in page: the lawyer still signs in
 * and consents in the browser.
 *
 * **Example** (Read a catalog entry)
 *
 * ```ts
 * import { RequirementCatalog } from "@beep/practice-gateway/Requirements"
 *
 * console.log(RequirementCatalog["box-drive-signed-in"].dependsOn) // ["box-drive-installed"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RequirementCatalog: { readonly [Id in GatewayRequirementId]: RequirementTemplate } = {
  "claude-desktop-installed": RequirementTemplate.make({
    id: "claude-desktop-installed",
    provider: "claude",
    dependsOn: [],
    remediation: human("install", "Install Claude Desktop from claude.ai/download, then open it."),
    explain: "Claude Desktop is the app you use to work with the practice tools.",
  }),
  "claude-signed-in": RequirementTemplate.make({
    id: "claude-signed-in",
    provider: "claude",
    dependsOn: [],
    remediation: human("sign-in", "Open Claude and sign in with your Claude account."),
    explain: "Claude must be signed in before anything else can be set up.",
  }),
  "box-drive-installed": RequirementTemplate.make({
    id: "box-drive-installed",
    provider: "box-drive",
    dependsOn: [],
    remediation: AutomaticRemediation.make({ summary: "Install Box Drive for your Windows account." }),
    explain: "Box Drive puts your Box documents in a folder Claude can read.",
  }),
  "box-drive-signed-in": RequirementTemplate.make({
    id: "box-drive-signed-in",
    provider: "box-drive",
    dependsOn: ["box-drive-installed"],
    remediation: human("sign-in", "Open Box Drive and sign in with your Box account."),
    explain: "Box Drive only shows your documents while you are signed in.",
  }),
  "box-drive-folder-available": RequirementTemplate.make({
    id: "box-drive-folder-available",
    provider: "box-drive",
    dependsOn: ["box-drive-signed-in"],
    remediation: human("sign-in", "Open Box Drive and wait until the Box folder appears in File Explorer."),
    explain: "Claude reads your documents from the Box folder in your user folder.",
  }),
  "m365-consented": RequirementTemplate.make({
    id: "m365-consented",
    provider: "microsoft-365",
    dependsOn: [],
    remediation: AutomaticRemediation.make({
      summary:
        "Open the Microsoft sign-in page in your web browser, where you sign in to Microsoft 365 and approve access for the practice gateway.",
    }),
    explain: "Claude needs your permission to read your Microsoft 365 mail and calendar.",
  }),
  "m365-token-cached": RequirementTemplate.make({
    id: "m365-token-cached",
    provider: "microsoft-365",
    dependsOn: ["m365-consented"],
    remediation: human("sign-in", "Sign in to Microsoft 365 again so the gateway can keep you signed in."),
    explain: "The gateway keeps your Microsoft 365 sign-in encrypted for your Windows account.",
  }),
  "practice-kg-bundle-present": RequirementTemplate.make({
    id: "practice-kg-bundle-present",
    provider: "practice-kg",
    dependsOn: [],
    remediation: human(
      "configure",
      "In Claude, open the practice gateway's extension settings and choose the knowledge-graph bundle folder."
    ),
    explain: "The practice knowledge graph is read from a bundle folder you were given.",
  }),
  "practice-kg-self-check": RequirementTemplate.make({
    id: "practice-kg-self-check",
    provider: "practice-kg",
    dependsOn: ["practice-kg-bundle-present"],
    remediation: human(
      "configure",
      "Close Claude and open it again. If this still fails, ask for a fresh copy of the knowledge-graph bundle."
    ),
    explain: "The knowledge-graph bundle must open cleanly before Claude can search it.",
  }),
  "bitlocker-on": RequirementTemplate.make({
    id: "bitlocker-on",
    provider: "windows",
    dependsOn: [],
    remediation: human("admin-prompt", "Ask your IT administrator to turn on BitLocker for drive C:."),
    explain: "BitLocker encrypts this computer's drive so client documents stay protected if it is lost.",
  }),
};

/**
 * Requirements each supported provider brings, in probe order.
 *
 * **Details**
 *
 * Windows Credential Manager is part of Windows and needs no setup.
 *
 * **Example** (List Box Drive's requirements)
 *
 * ```ts
 * import { ProviderRequirements } from "@beep/practice-gateway/Requirements"
 *
 * console.log(ProviderRequirements["box-drive"].length) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ProviderRequirements: { readonly [Provider in PracticeProvider]: ReadonlyArray<GatewayRequirementId> } = {
  "box-drive": ["box-drive-installed", "box-drive-signed-in", "box-drive-folder-available"],
  "microsoft-365": ["m365-consented", "m365-token-cached"],
  "windows-credential-manager": [],
  "practice-kg": ["practice-kg-bundle-present", "practice-kg-self-check"],
};

/**
 * Build one {@link SetupRequirement} from its catalog entry.
 *
 * **Example** (Materialize a workstation requirement)
 *
 * ```ts
 * import { requirementFromCatalog } from "@beep/practice-gateway/Requirements"
 *
 * console.log(requirementFromCatalog("bitlocker-on", "workstation").provider) // "windows"
 * ```
 *
 * @param id - Catalog entry to materialize.
 * @param capability - The capability the requirement serves.
 * @category constructors
 * @since 0.0.0
 */
export const requirementFromCatalog: {
  (capability: SetupCapability): (id: GatewayRequirementId) => SetupRequirement;
  (id: GatewayRequirementId, capability: SetupCapability): SetupRequirement;
} = dual(2, (id: GatewayRequirementId, capability: SetupCapability): SetupRequirement => {
  const template = RequirementCatalog[id];
  return SetupRequirement.make({
    id: SetupRequirementId.make(template.id),
    capability,
    provider: template.provider,
    dependsOn: A.map(template.dependsOn, (dependency) => SetupRequirementId.make(dependency)),
    remediation: template.remediation,
    explain: template.explain,
  });
});

const workstation = requirementFromCatalog(SetupCapability.Enum.workstation);

const servedProvider = CapabilityChoice.match({
  supported: (choice): O.Option<readonly [PracticeCapability, PracticeProvider]> =>
    O.some([choice.capability, choice.provider] as const),
  gap: (choice) => O.map(choice.fallback, (fallback) => [choice.capability, fallback] as const),
  declined: () => O.none(),
});

/**
 * Whether a profile selects a provider, directly or as a gap's fallback.
 *
 * **Example** (A profile that serves documents from Box Drive)
 *
 * ```ts
 * import { CapabilitySupported, ItLimits, PracticeProfile } from "@beep/law-practice-domain"
 * import { profileSelects } from "@beep/practice-gateway/Requirements"
 * import * as DateTime from "effect/DateTime"
 *
 * const profile = PracticeProfile.make({
 *   choices: [CapabilitySupported.make({ capability: "documents", provider: "box-drive" })],
 *   itLimits: ItLimits.make({ adminRights: "unknown", proxy: "unknown" }),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(profileSelects(profile, "practice-kg")) // false
 * ```
 *
 * @param profile - The saved practice profile.
 * @param provider - The provider to look for.
 * @category predicates
 * @since 0.0.0
 */
export const profileSelects: {
  (provider: PracticeProvider): (profile: PracticeProfile) => boolean;
  (profile: PracticeProfile, provider: PracticeProvider): boolean;
} = dual(2, (profile: PracticeProfile, provider: PracticeProvider): boolean =>
  A.some(profile.choices, (choice) => O.exists(servedProvider(choice), ([, served]) => served === provider))
);

/**
 * Requirements every workstation has, before any profile is saved.
 *
 * **Details**
 *
 * Claude comes first: sign-in is verified before anything else (D3).
 *
 * **Example** (List the base requirements)
 *
 * ```ts
 * import { baseRequirements } from "@beep/practice-gateway/Requirements"
 *
 * console.log(baseRequirements.map((requirement) => requirement.id))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const baseRequirements: ReadonlyArray<SetupRequirement> = [
  workstation("claude-desktop-installed"),
  workstation("claude-signed-in"),
  workstation("bitlocker-on"),
];

/**
 * The slice 1 requirements a practice profile selects.
 *
 * **Details**
 *
 * Supported choices bring their provider's requirements; a gap with a
 * fallback brings the fallback's; declined choices bring none. A provider
 * selected by two capabilities contributes its requirements once, under the
 * first capability. Claude requirements lead and BitLocker closes the list.
 *
 * **Example** (Requirements for Box Drive documents)
 *
 * ```ts
 * import { CapabilitySupported, ItLimits, PracticeProfile } from "@beep/law-practice-domain"
 * import { requirementsFor } from "@beep/practice-gateway/Requirements"
 * import * as DateTime from "effect/DateTime"
 *
 * const profile = PracticeProfile.make({
 *   choices: [CapabilitySupported.make({ capability: "documents", provider: "box-drive" })],
 *   itLimits: ItLimits.make({ adminRights: "unknown", proxy: "unknown" }),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(requirementsFor(profile).length) // 6
 * ```
 *
 * @param profile - The saved practice profile.
 * @category constructors
 * @since 0.0.0
 */
export const requirementsFor = (profile: PracticeProfile): ReadonlyArray<SetupRequirement> => {
  const providerRequirements = pipe(
    profile.choices,
    A.map(servedProvider),
    A.getSomes,
    A.flatMap(([capability, provider]) =>
      A.map(ProviderRequirements[provider], (id) => requirementFromCatalog(id, capability))
    )
  );
  return A.dedupeWith(
    [
      workstation("claude-desktop-installed"),
      workstation("claude-signed-in"),
      ...providerRequirements,
      workstation("bitlocker-on"),
    ],
    (left, right) => left.id === right.id
  );
};

/**
 * The requirements for whatever profile is saved: the profile's selection, or
 * the base requirements when no profile exists yet.
 *
 * **Example** (No profile saved yet)
 *
 * ```ts
 * import { requirementsForSaved } from "@beep/practice-gateway/Requirements"
 * import * as O from "effect/Option"
 *
 * console.log(requirementsForSaved(O.none()).length) // 3
 * ```
 *
 * @param profile - The saved profile, if any.
 * @category constructors
 * @since 0.0.0
 */
export const requirementsForSaved = (profile: O.Option<PracticeProfile>): ReadonlyArray<SetupRequirement> =>
  O.match(profile, { onNone: () => baseRequirements, onSome: requirementsFor });
