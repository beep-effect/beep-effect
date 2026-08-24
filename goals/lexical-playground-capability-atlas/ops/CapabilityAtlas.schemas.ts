import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

export const AtlasSchemaVersion = LiteralKit(["editor-capability-atlas/v1"]);
export const EvidenceStatus = LiteralKit(["verified-live", "verified-source", "unverified"]);
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
export const CapabilityDisposition = LiteralKit(["implement", "generalize", "defer", "development-only", "reject"]);
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
export const Platform = LiteralKit(["windows-linux", "apple", "all"]);
export const ProfileEligibility = LiteralKit([
  "minimal",
  "document-proof",
  "production-single-user",
  "development-reference",
  "slice-owned",
  "deferred",
  "ineligible",
]);
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
export const CompatibilityStatus = LiteralKit([
  "lossless",
  "lossy",
  "unsupported",
  "development-only",
  "future",
  "not-applicable",
]);
export const NetworkEgress = LiteralKit(["none", "user-initiated", "authorized-provider", "rejected"]);

export const UpstreamIdentity = S.Struct({
  project: S.NonEmptyString,
  packageName: S.NonEmptyString,
  packageVersion: S.NonEmptyString,
  commit: S.NonEmptyString,
  commitShort: S.NonEmptyString,
  license: S.NonEmptyString,
  baselineNote: S.NonEmptyString,
});
export type UpstreamIdentity = typeof UpstreamIdentity.Type;

export const EntryUpstreamIdentity = S.Struct({
  packageVersion: S.NonEmptyString,
  commit: S.NonEmptyString,
});
export type EntryUpstreamIdentity = typeof EntryUpstreamIdentity.Type;

export const SourceEvidence = S.Struct({
  auditPath: S.NonEmptyString,
  upstreamPath: S.NonEmptyString,
  lineRange: S.NonEmptyString,
  detail: S.NonEmptyString,
});
export type SourceEvidence = typeof SourceEvidence.Type;

export const LiveEvidence = S.Struct({
  auditPath: S.NonEmptyString,
  screenshots: S.Array(S.NonEmptyString),
  detail: S.NonEmptyString,
});
export type LiveEvidence = typeof LiveEvidence.Type;

export const CapabilityEvidence = S.Struct({
  source: S.Array(SourceEvidence),
  live: S.Array(LiveEvidence),
});
export type CapabilityEvidence = typeof CapabilityEvidence.Type;

export const CapabilityDispositionRecord = S.Struct({
  kind: CapabilityDisposition,
  rationale: S.NonEmptyString,
  decisionRefs: S.NonEmptyArray(S.NonEmptyString),
});
export type CapabilityDispositionRecord = typeof CapabilityDispositionRecord.Type;

export const CapabilityOwnership = S.Struct({
  ownerPackage: S.NonEmptyString,
  targetGoal: S.NonEmptyString,
});
export type CapabilityOwnership = typeof CapabilityOwnership.Type;

export const CapabilityRegistrations = S.Struct({
  nodes: S.Array(S.NonEmptyString),
  marks: S.Array(S.NonEmptyString),
  extensions: S.Array(S.NonEmptyString),
  transformers: S.Array(S.NonEmptyString),
  nestedEditors: S.Array(S.NonEmptyString),
});
export type CapabilityRegistrations = typeof CapabilityRegistrations.Type;

export const ActivationPath = S.Struct({
  surface: ActivationSurface,
  action: S.NonEmptyString,
  evidenceStatus: EvidenceStatus,
});
export type ActivationPath = typeof ActivationPath.Type;

export const Keybinding = S.Struct({
  platform: Platform,
  chord: S.NonEmptyString,
});
export type Keybinding = typeof Keybinding.Type;

export const CapabilityCommand = S.Struct({
  id: S.NonEmptyString,
  label: S.NonEmptyString,
  helpText: S.NonEmptyString,
  keybindings: S.Array(Keybinding),
});
export type CapabilityCommand = typeof CapabilityCommand.Type;

export const CompatibilityRow = S.Struct({
  format: CompatibilityFormat,
  status: CompatibilityStatus,
  loss: S.NonEmptyString,
  ownerGoal: S.NonEmptyString,
});
export type CompatibilityRow = typeof CompatibilityRow.Type;

export const AccessibilityContract = S.Struct({
  expectations: S.NonEmptyArray(S.NonEmptyString),
  knownRisks: S.Array(S.NonEmptyString),
});
export type AccessibilityContract = typeof AccessibilityContract.Type;

export const ResponsiveContract = S.Struct({
  expectations: S.NonEmptyArray(S.NonEmptyString),
  touchAlternative: S.NonEmptyString,
});
export type ResponsiveContract = typeof ResponsiveContract.Type;

export const NetworkSecurityContract = S.Struct({
  egress: NetworkEgress,
  opensRemoteContent: S.Boolean,
  behavior: S.NonEmptyString,
});
export type NetworkSecurityContract = typeof NetworkSecurityContract.Type;

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
export type Capability = typeof Capability.Type;

export const ScreenshotEvidence = S.Struct({
  path: S.NonEmptyString,
  caption: S.NonEmptyString,
});
export type ScreenshotEvidence = typeof ScreenshotEvidence.Type;

export const RegistrationInventoryItem = S.Struct({
  name: S.NonEmptyString,
  capabilityId: S.NonEmptyString,
});
export type RegistrationInventoryItem = typeof RegistrationInventoryItem.Type;

export const KeybindingInventoryItem = S.Struct({
  capabilityId: S.NonEmptyString,
  action: S.NonEmptyString,
  windowsLinux: S.NonEmptyString,
  apple: S.NonEmptyString,
});
export type KeybindingInventoryItem = typeof KeybindingInventoryItem.Type;

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
export type InventoryCounts = typeof InventoryCounts.Type;

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
export type EvidenceInventories = typeof EvidenceInventories.Type;

export const AtlasEvidence = S.Struct({
  sourceAuditPath: S.NonEmptyString,
  liveAuditPath: S.NonEmptyString,
  capabilityReferencePath: S.NonEmptyString,
  decisionsPath: S.NonEmptyString,
  screenshots: S.NonEmptyArray(ScreenshotEvidence),
  inventories: EvidenceInventories,
});
export type AtlasEvidence = typeof AtlasEvidence.Type;

export const EditorCapabilityAtlas = S.Struct({
  schemaVersion: AtlasSchemaVersion,
  upstream: UpstreamIdentity,
  evidence: AtlasEvidence,
  capabilities: S.NonEmptyArray(Capability),
});
export type EditorCapabilityAtlas = typeof EditorCapabilityAtlas.Type;
