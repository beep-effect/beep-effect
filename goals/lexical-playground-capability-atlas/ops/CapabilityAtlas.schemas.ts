/**
 * Schema contracts for the versioned editor capability atlas artifact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

/**
 * Wire-version schema for authored editor capability atlas documents.
 *
 * **Example** (Validate the atlas wire version)
 *
 * ```ts
 * import { AtlasSchemaVersion } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AtlasSchemaVersion)("editor-capability-atlas/v1")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AtlasSchemaVersion = LiteralKit(["editor-capability-atlas/v1"]);
/**
 * Evidence-state schema that distinguishes live proof, source proof, and unresolved verification.
 *
 * **Example** (Validate a source-backed status)
 *
 * ```ts
 * import { EvidenceStatus } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EvidenceStatus)("verified-source")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceStatus = LiteralKit(["verified-live", "verified-source", "unverified"]);
/**
 * Taxonomy schema used to group editor capabilities by their primary role.
 *
 * **Example** (Validate a capability category)
 *
 * ```ts
 * import { CapabilityCategory } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityCategory)("document-action")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityCategory = LiteralKit([
  "core-node",
  "node",
  "extension",
  "setting",
  "transformer",
  "authoring",
  "document-action",
  "interchange",
  "collaboration",
  "diagnostic",
  "integration",
]);
/**
 * Decision schema for how the target editor should treat an upstream capability.
 *
 * **Example** (Validate an implementation disposition)
 *
 * ```ts
 * import { CapabilityDisposition } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityDisposition)("implement")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityDisposition = LiteralKit(["implement", "generalize", "defer", "development-only", "reject"]);
/**
 * Interaction-surface schema describing where a user or host can activate a capability.
 *
 * **Example** (Validate a keyboard activation surface)
 *
 * ```ts
 * import { ActivationSurface } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ActivationSurface)("keyboard")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActivationSurface = LiteralKit([
  "toolbar",
  "floating-toolbar",
  "block-menu",
  "insert-menu",
  "slash-menu",
  "markdown-shortcut",
  "keyboard",
  "context-menu",
  "paste-drop",
  "importer",
  "programmatic",
  "settings-panel",
  "query-parameter",
  "document-action",
  "typeahead",
  "selection",
  "draggable-block",
  "automatic",
  "browser-api",
  "read-only",
]);
/**
 * Platform schema for capability keybinding variants.
 *
 * **Example** (Validate a cross-platform binding target)
 *
 * ```ts
 * import { Platform } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Platform)("all")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Platform = LiteralKit(["windows-linux", "apple", "all"]);
/**
 * Editor-profile schema that records where a capability may be enabled.
 *
 * **Example** (Validate a document-proof profile)
 *
 * ```ts
 * import { ProfileEligibility } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProfileEligibility)("document-proof")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProfileEligibility = LiteralKit([
  "minimal",
  "document-proof",
  "production-single-user",
  "development-reference",
  "slice-owned",
  "deferred",
  "ineligible",
]);
/**
 * Document-format schema covered by each capability compatibility assessment.
 *
 * **Example** (Validate a canonical format)
 *
 * ```ts
 * import { CompatibilityFormat } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CompatibilityFormat)("beep-md")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CompatibilityFormat = LiteralKit([
  "beep-md",
  "lexical-wire-strict",
  "markdown",
  "html",
  "lexical-json-raw",
  "pandoc-docx",
  "pdf",
  "read-only-fallback",
]);
/**
 * Compatibility-result schema for loss, support, and lifecycle classifications.
 *
 * **Example** (Validate a lossless status)
 *
 * ```ts
 * import { CompatibilityStatus } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CompatibilityStatus)("lossless")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CompatibilityStatus = LiteralKit([
  "lossless",
  "lossy",
  "unsupported",
  "development-only",
  "future",
  "not-applicable",
]);
/**
 * Network-egress policy schema applied to capability security contracts.
 *
 * **Example** (Validate a no-egress policy)
 *
 * ```ts
 * import { NetworkEgress } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NetworkEgress)("none")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkEgress = LiteralKit(["none", "user-initiated", "authorized-provider", "rejected"]);

/**
 * Schema for the pinned upstream project, package, commit, license, and baseline note.
 *
 * **Example** (Validate a pinned upstream identity)
 *
 * ```ts
 * import { UpstreamIdentity } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UpstreamIdentity)({ project: "lexical", packageName: "lexical-playground", packageVersion: "0.49.0", commit: "abc", commitShort: "abc", license: "MIT", baselineNote: "Pinned audit baseline." })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamIdentity = S.Struct({
  project: S.NonEmptyString,
  packageName: S.NonEmptyString,
  packageVersion: S.NonEmptyString,
  commit: S.NonEmptyString,
  commitShort: S.NonEmptyString,
  license: S.NonEmptyString,
  baselineNote: S.NonEmptyString,
});
/**
 * Decoded pinned upstream identity used by the atlas header.
 *
 * @see {@link UpstreamIdentity} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type UpstreamIdentity = typeof UpstreamIdentity.Type;

/**
 * Schema for the upstream version and commit repeated on each capability entry.
 *
 * **Example** (Validate an entry identity)
 *
 * ```ts
 * import { EntryUpstreamIdentity } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EntryUpstreamIdentity)({ packageVersion: "0.49.0", commit: "abc" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntryUpstreamIdentity = S.Struct({
  packageVersion: S.NonEmptyString,
  commit: S.NonEmptyString,
});
/**
 * Decoded upstream version and commit carried by a capability entry.
 *
 * @see {@link EntryUpstreamIdentity} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type EntryUpstreamIdentity = typeof EntryUpstreamIdentity.Type;

/**
 * Schema for a source-audit citation attached to an upstream capability.
 *
 * **Example** (Validate a source citation)
 *
 * ```ts
 * import { SourceEvidence } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SourceEvidence)({ auditPath: "research/source.md", upstreamPath: "src/App.tsx", lineRange: "10-20", detail: "Registers the plugin." })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceEvidence = S.Struct({
  auditPath: S.NonEmptyString,
  upstreamPath: S.NonEmptyString,
  lineRange: S.NonEmptyString,
  detail: S.NonEmptyString,
});
/**
 * Decoded source-audit citation for a capability.
 *
 * @see {@link SourceEvidence} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type SourceEvidence = typeof SourceEvidence.Type;

/**
 * Schema for a live-audit citation and its optional screenshot references.
 *
 * **Example** (Validate live evidence)
 *
 * ```ts
 * import { LiveEvidence } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LiveEvidence)({ auditPath: "research/live.md", screenshots: [], detail: "Exercised by keyboard." })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LiveEvidence = S.Struct({
  auditPath: S.NonEmptyString,
  screenshots: S.Array(S.NonEmptyString),
  detail: S.NonEmptyString,
});
/**
 * Decoded live-audit citation and screenshot list for a capability.
 *
 * @see {@link LiveEvidence} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type LiveEvidence = typeof LiveEvidence.Type;

/**
 * Schema that groups source and live evidence for one capability.
 *
 * **Example** (Validate an empty evidence collection)
 *
 * ```ts
 * import { CapabilityEvidence } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityEvidence)({ source: [], live: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityEvidence = S.Struct({
  source: S.Array(SourceEvidence),
  live: S.Array(LiveEvidence),
});
/**
 * Decoded collection of source and live evidence for a capability.
 *
 * @see {@link CapabilityEvidence} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type CapabilityEvidence = typeof CapabilityEvidence.Type;

/**
 * Schema for a capability decision, rationale, and supporting decision references.
 *
 * **Example** (Validate a disposition record)
 *
 * ```ts
 * import { CapabilityDispositionRecord } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityDispositionRecord)({ kind: "implement", rationale: "Required for the document profile.", decisionRefs: ["D2"] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityDispositionRecord = S.Struct({
  kind: CapabilityDisposition,
  rationale: S.NonEmptyString,
  decisionRefs: S.NonEmptyArray(S.NonEmptyString),
});
/**
 * Decoded capability decision with rationale and decision references.
 *
 * @see {@link CapabilityDispositionRecord} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type CapabilityDispositionRecord = typeof CapabilityDispositionRecord.Type;

/**
 * Schema for the package and goal that own a capability's implementation decision.
 *
 * **Example** (Validate capability ownership)
 *
 * ```ts
 * import { CapabilityOwnership } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityOwnership)({ ownerPackage: "@beep/editor", targetGoal: "configurable-full-document-editor" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityOwnership = S.Struct({
  ownerPackage: S.NonEmptyString,
  targetGoal: S.NonEmptyString,
});
/**
 * Decoded package and goal ownership for a capability.
 *
 * @see {@link CapabilityOwnership} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type CapabilityOwnership = typeof CapabilityOwnership.Type;

/**
 * Schema for the nodes, marks, extensions, transformers, and nested editors a capability registers.
 *
 * **Example** (Validate an empty registration set)
 *
 * ```ts
 * import { CapabilityRegistrations } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityRegistrations)({ nodes: [], marks: [], extensions: [], transformers: [], nestedEditors: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityRegistrations = S.Struct({
  nodes: S.Array(S.NonEmptyString),
  marks: S.Array(S.NonEmptyString),
  extensions: S.Array(S.NonEmptyString),
  transformers: S.Array(S.NonEmptyString),
  nestedEditors: S.Array(S.NonEmptyString),
});
/**
 * Decoded registration inventory owned by a capability.
 *
 * @see {@link CapabilityRegistrations} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type CapabilityRegistrations = typeof CapabilityRegistrations.Type;

/**
 * Schema for one capability activation path and its evidence state.
 *
 * **Example** (Validate a keyboard activation path)
 *
 * ```ts
 * import { ActivationPath } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ActivationPath)({ surface: "keyboard", action: "Run the command.", evidenceStatus: "verified-source" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActivationPath = S.Struct({
  surface: ActivationSurface,
  action: S.NonEmptyString,
  evidenceStatus: EvidenceStatus,
});
/**
 * Decoded activation path and its evidence state.
 *
 * @see {@link ActivationPath} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type ActivationPath = typeof ActivationPath.Type;

/**
 * Schema for a platform-specific keyboard chord.
 *
 * **Example** (Validate a keybinding)
 *
 * ```ts
 * import { Keybinding } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Keybinding)({ platform: "windows-linux", chord: "Ctrl+B" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Keybinding = S.Struct({
  platform: Platform,
  chord: S.NonEmptyString,
});
/**
 * Decoded platform-specific keyboard chord.
 *
 * @see {@link Keybinding} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type Keybinding = typeof Keybinding.Type;

/**
 * Schema for a stable command identifier, user-facing help, and keybindings.
 *
 * **Example** (Validate a capability command)
 *
 * ```ts
 * import { CapabilityCommand } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CapabilityCommand)({ id: "format.bold", label: "Bold", helpText: "Toggle bold formatting.", keybindings: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityCommand = S.Struct({
  id: S.NonEmptyString,
  label: S.NonEmptyString,
  helpText: S.NonEmptyString,
  keybindings: S.Array(Keybinding),
});
/**
 * Decoded stable command metadata and keybindings.
 *
 * @see {@link CapabilityCommand} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type CapabilityCommand = typeof CapabilityCommand.Type;

/**
 * Schema for one format-specific compatibility assessment and owning goal.
 *
 * **Example** (Validate a compatibility row)
 *
 * ```ts
 * import { CompatibilityRow } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CompatibilityRow)({ format: "beep-md", status: "lossless", loss: "No known loss.", ownerGoal: "configurable-full-document-editor" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CompatibilityRow = S.Struct({
  format: CompatibilityFormat,
  status: CompatibilityStatus,
  loss: S.NonEmptyString,
  ownerGoal: S.NonEmptyString,
});
/**
 * Decoded format compatibility assessment for a capability.
 *
 * @see {@link CompatibilityRow} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type CompatibilityRow = typeof CompatibilityRow.Type;

/**
 * Schema for accessibility expectations and known risks attached to a capability.
 *
 * **Example** (Validate an accessibility contract)
 *
 * ```ts
 * import { AccessibilityContract } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AccessibilityContract)({ expectations: ["Keyboard operable."], knownRisks: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AccessibilityContract = S.Struct({
  expectations: S.NonEmptyArray(S.NonEmptyString),
  knownRisks: S.Array(S.NonEmptyString),
});
/**
 * Decoded accessibility expectations and known risks.
 *
 * @see {@link AccessibilityContract} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type AccessibilityContract = typeof AccessibilityContract.Type;

/**
 * Schema for responsive-layout expectations and the required touch alternative.
 *
 * **Example** (Validate a responsive contract)
 *
 * ```ts
 * import { ResponsiveContract } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ResponsiveContract)({ expectations: ["Fits narrow layouts."], touchAlternative: "Expose the action in a menu." })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResponsiveContract = S.Struct({
  expectations: S.NonEmptyArray(S.NonEmptyString),
  touchAlternative: S.NonEmptyString,
});
/**
 * Decoded responsive-layout expectations and touch alternative.
 *
 * @see {@link ResponsiveContract} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type ResponsiveContract = typeof ResponsiveContract.Type;

/**
 * Schema for network egress, remote-content, and security behavior.
 *
 * **Example** (Validate an offline security contract)
 *
 * ```ts
 * import { NetworkSecurityContract } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NetworkSecurityContract)({ egress: "none", opensRemoteContent: false, behavior: "Runs locally." })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkSecurityContract = S.Struct({
  egress: NetworkEgress,
  opensRemoteContent: S.Boolean,
  behavior: S.NonEmptyString,
});
/**
 * Decoded network and remote-content security behavior.
 *
 * @see {@link NetworkSecurityContract} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type NetworkSecurityContract = typeof NetworkSecurityContract.Type;

/**
 * Schema for one complete editor capability, including evidence, ownership, registrations, and contracts.
 *
 * **Example** (Reject an incomplete capability)
 *
 * ```ts
 * import { Capability } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Capability)({ id: "node.heading" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Capability = S.Struct({
  id: S.NonEmptyString,
  title: S.NonEmptyString,
  summary: S.NonEmptyString,
  upstream: EntryUpstreamIdentity,
  upstreamEvidence: CapabilityEvidence,
  evidenceStatus: EvidenceStatus,
  category: CapabilityCategory,
  disposition: CapabilityDispositionRecord,
  ownership: CapabilityOwnership,
  registrations: CapabilityRegistrations,
  activationPaths: S.Array(ActivationPath),
  commands: S.Array(CapabilityCommand),
  helpText: S.NonEmptyString,
  dependencies: S.Array(S.NonEmptyString),
  conflicts: S.Array(S.NonEmptyString),
  profileEligibility: S.NonEmptyArray(ProfileEligibility),
  compatibility: S.NonEmptyArray(CompatibilityRow),
  readOnlyFallback: S.NonEmptyString,
  accessibility: AccessibilityContract,
  responsive: ResponsiveContract,
  networkSecurity: NetworkSecurityContract,
  proofGaps: S.Array(S.NonEmptyString),
});
/**
 * Decoded editor capability entry accepted by the atlas.
 *
 * @see {@link Capability} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type Capability = typeof Capability.Type;

/**
 * Schema for a pinned screenshot path and its human-readable caption.
 *
 * **Example** (Validate screenshot evidence)
 *
 * ```ts
 * import { ScreenshotEvidence } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ScreenshotEvidence)({ path: "research/screenshots/editor.png", caption: "The editor toolbar." })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScreenshotEvidence = S.Struct({
  path: S.NonEmptyString,
  caption: S.NonEmptyString,
});
/**
 * Decoded screenshot path and caption in the evidence inventory.
 *
 * @see {@link ScreenshotEvidence} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type ScreenshotEvidence = typeof ScreenshotEvidence.Type;

/**
 * Schema that maps an inventoried registration name to its owning capability.
 *
 * **Example** (Validate a registration mapping)
 *
 * ```ts
 * import { RegistrationInventoryItem } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RegistrationInventoryItem)({ name: "HistoryExtension", capabilityId: "extension.history" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RegistrationInventoryItem = S.Struct({
  name: S.NonEmptyString,
  capabilityId: S.NonEmptyString,
});
/**
 * Decoded registration-to-capability inventory mapping.
 *
 * @see {@link RegistrationInventoryItem} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type RegistrationInventoryItem = typeof RegistrationInventoryItem.Type;

/**
 * Schema for an observed command label and its Windows/Linux and Apple chords.
 *
 * **Example** (Validate an observed keybinding)
 *
 * ```ts
 * import { KeybindingInventoryItem } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KeybindingInventoryItem)({ capabilityId: "format.bold", action: "Bold", windowsLinux: "Ctrl+B", apple: "Cmd+B" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KeybindingInventoryItem = S.Struct({
  capabilityId: S.NonEmptyString,
  action: S.NonEmptyString,
  windowsLinux: S.NonEmptyString,
  apple: S.NonEmptyString,
});
/**
 * Decoded observed keybinding inventory entry.
 *
 * @see {@link KeybindingInventoryItem} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type KeybindingInventoryItem = typeof KeybindingInventoryItem.Type;

/**
 * Schema for the pinned totals used to reconcile atlas evidence inventories.
 *
 * **Example** (Validate zeroed inventory counts)
 *
 * ```ts
 * import { InventoryCounts } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(InventoryCounts)({ rootRegisteredNodes: 0, effectiveRichTextNodes: 0, settings: 0, screenshots: 0, topLevelRegistrations: 0, markdownTransformers: 0, observedKeybindings: 0, documentActions: 0 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InventoryCounts = S.Struct({
  rootRegisteredNodes: S.Int,
  effectiveRichTextNodes: S.Int,
  settings: S.Int,
  screenshots: S.Int,
  topLevelRegistrations: S.Int,
  markdownTransformers: S.Int,
  observedKeybindings: S.Int,
  documentActions: S.Int,
});
/**
 * Decoded pinned totals for atlas evidence inventories.
 *
 * @see {@link InventoryCounts} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type InventoryCounts = typeof InventoryCounts.Type;

/**
 * Schema for the complete pinned node, setting, registration, keybinding, action, and activation inventories.
 *
 * **Example** (Reject an incomplete evidence inventory)
 *
 * ```ts
 * import { EvidenceInventories } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EvidenceInventories)({ expectedCounts: {} })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceInventories = S.Struct({
  expectedCounts: InventoryCounts,
  rootRegisteredNodeIds: S.NonEmptyArray(S.NonEmptyString),
  effectiveRichTextNodeIds: S.NonEmptyArray(S.NonEmptyString),
  settingIds: S.NonEmptyArray(S.NonEmptyString),
  topLevelRegistrations: S.NonEmptyArray(RegistrationInventoryItem),
  markdownTransformers: S.NonEmptyArray(RegistrationInventoryItem),
  observedKeybindings: S.NonEmptyArray(KeybindingInventoryItem),
  documentActionIds: S.NonEmptyArray(S.NonEmptyString),
  activationSurfaces: S.NonEmptyArray(ActivationSurface),
});
/**
 * Decoded node, setting, registration, keybinding, action, and activation inventories.
 *
 * @see {@link EvidenceInventories} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type EvidenceInventories = typeof EvidenceInventories.Type;

/**
 * Schema for atlas-level audit paths, screenshots, and reconciled inventories.
 *
 * **Example** (Reject incomplete atlas evidence)
 *
 * ```ts
 * import { AtlasEvidence } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AtlasEvidence)({ sourceAuditPath: "research/source.md" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AtlasEvidence = S.Struct({
  sourceAuditPath: S.NonEmptyString,
  liveAuditPath: S.NonEmptyString,
  capabilityReferencePath: S.NonEmptyString,
  decisionsPath: S.NonEmptyString,
  screenshots: S.NonEmptyArray(ScreenshotEvidence),
  inventories: EvidenceInventories,
});
/**
 * Decoded atlas-level audit paths, screenshots, and inventories.
 *
 * @see {@link AtlasEvidence} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type AtlasEvidence = typeof AtlasEvidence.Type;

/**
 * Top-level schema for the versioned editor capability atlas artifact.
 *
 * **Example** (Reject an incomplete atlas document)
 *
 * ```ts
 * import { EditorCapabilityAtlas } from "./CapabilityAtlas.schemas.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EditorCapabilityAtlas)({ schemaVersion: "editor-capability-atlas/v1" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EditorCapabilityAtlas = S.Struct({
  schemaVersion: AtlasSchemaVersion,
  upstream: UpstreamIdentity,
  evidence: AtlasEvidence,
  capabilities: S.NonEmptyArray(Capability),
});
/**
 * Decoded editor capability atlas document.
 *
 * @see {@link EditorCapabilityAtlas} for the runtime schema and decoding constraints.
 * @category models
 * @since 0.0.0
 */
export type EditorCapabilityAtlas = typeof EditorCapabilityAtlas.Type;
