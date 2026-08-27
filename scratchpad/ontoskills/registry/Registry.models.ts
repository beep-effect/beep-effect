/**
 * Installed-package lock, source indexes, trust tiers, and install-target
 * resolution models for OntoSkills.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {LiteralKit} from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import {SemverFromString} from "@beep/schema/Semver";
import {FilePath, PosInt} from "@beep/schema";


const $I = $ScratchpadId.create("ontoskills/registry/Registry.models");

/**
 * Install-time trust classification for an OntoSkills package source or locked package.
 *
 * **Example** (Guard a community trust tier)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TrustTier } from "@beep/scratchpad/ontoskills/registry"
 *
 * console.log(S.is(TrustTier)(TrustTier.Enum.community)) // true
 * console.log(S.is(TrustTier)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TrustTier = LiteralKit(
  [
    "verified", "official", "community", "local"
  ]
).pipe(
  $I.annoteSchema("TrustTier", {
    description: "Install-time trust classification for an OntoSkills package source or locked package."
  })
);

/**
 * Decoded member of {@link TrustTier}.
 *
 * @see {@link TrustTier} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TrustTier = typeof TrustTier.Type;


/**
 * Whether an installed package is an ontology catalog or a skill source tree.
 *
 * **Example** (Guard an ontology source kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SourceKind } from "@beep/scratchpad/ontoskills/registry"
 *
 * console.log(S.is(SourceKind)(SourceKind.Enum.ontology)) // true
 * console.log(S.is(SourceKind)("registry")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceKind = LiteralKit(
  [
    "ontology", "source"
  ]
).pipe(
  $I.annoteSchema("SourceKind", {
    description: "Whether an installed package is an ontology catalog or a skill source tree."
  })
);

/**
 * Decoded member of {@link SourceKind}.
 *
 * @see {@link SourceKind} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SourceKind = typeof SourceKind.Type;

/**
 * Empty schema shell for a package-level skill manifest; currently decodes no fields.
 *
 * **Gotchas**
 *
 * `PackageSkillManifest.make({})` is the only valid instance until fields are ported.
 * Callers must not invent manifest properties; they will fail decode.
 *
 * **Example** (Construct the empty shell)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PackageSkillManifest } from "@beep/scratchpad/ontoskills/registry"
 *
 * const manifest = PackageSkillManifest.make({})
 * console.log(S.encodeSync(PackageSkillManifest)(manifest))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageSkillManifest extends S.Class<PackageSkillManifest>($I`PackageSkillManifest`)(
  {},
  $I.annote("PackageSkillManifest", {
    description: "Empty schema shell for a package-level skill manifest; currently decodes no fields."
  })
) {
}

/**
 * Empty schema shell for a package manifest; currently decodes no fields.
 *
 * **Gotchas**
 *
 * `PackageManifest.make({})` is the only valid instance until fields are ported.
 * Callers must not invent manifest properties; they will fail decode.
 *
 * **Example** (Construct the empty shell)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PackageManifest } from "@beep/scratchpad/ontoskills/registry"
 *
 * const manifest = PackageManifest.make({})
 * console.log(S.encodeSync(PackageManifest)(manifest))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageManifest extends S.Class<PackageManifest>($I`PackageManifest`)(
  {},
  $I.annote("PackageManifest", {
    description: "Empty schema shell for a package manifest; currently decodes no fields."
  })
) {
}

/**
 * Empty schema shell for per-skill install state; currently decodes no fields.
 *
 * **Gotchas**
 *
 * `InstalledSkillState.make({})` is the only valid instance until fields are ported.
 * This empty class is already the type of {@link InstalledSkillStateValueBase}.skills,
 * so inventing skill-state properties will fail decode of a locked package.
 *
 * **Example** (Construct the empty shell)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledSkillState } from "@beep/scratchpad/ontoskills/registry"
 *
 * const state = InstalledSkillState.make({})
 * console.log(S.encodeSync(InstalledSkillState)(state))
 * ```
 *
 * @see {@link InstalledSkillStateValueBase} for the locked-package fields that embed this shell.
 * @category models
 * @since 0.0.0
 */
export class InstalledSkillState extends S.Class<InstalledSkillState>($I`InstalledSkillState`)(
  {},
  $I.annote("InstalledSkillState", {
    description: "Empty schema shell for per-skill install state; currently decodes no fields."
  })
) {
}

/**
 * Shared install metadata for a locked package, including version, paths, and the empty skill-state shell.
 *
 * **Example** (Decode locked-package metadata)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledSkillStateValueBase } from "@beep/scratchpad/ontoskills/registry"
 *
 * const installed = S.decodeSync(InstalledSkillStateValueBase)({
 *   version: "1.0.0",
 *   packageId: "office",
 *   installedAt: "2026-01-15T12:00:00.000Z",
 *   installRoot: "skills/office",
 *   manifestPath: "skills/office/SKILL.md",
 *   skills: {},
 * })
 * console.log(installed.packageId) // "office"
 * ```
 *
 * @see {@link InstalledSkillState} for the empty `skills` shell currently stored here.
 * @category models
 * @since 0.0.0
 */
export class InstalledSkillStateValueBase extends S.Class<InstalledSkillStateValueBase>($I`InstalledSkillStateValueBase`)(
  {
    version: SemverFromString,
    packageId: S.String,
    source: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
    ),
    installedAt: S.DateTimeUtcFromString,
    installRoot: FilePath,
    manifestPath: FilePath,
    skills: InstalledSkillState,
  },
  $I.annote("InstalledSkillStateValueBase", {
    description: "Shared install metadata for a locked package, including version, paths, and the empty skill-state shell."
  })
) {
}

/**
 * Locked package state tagged with the verified trust tier.
 *
 * **Example** (Decode a verified package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageVerifiedStateValue } from "@beep/scratchpad/ontoskills/registry"
 *
 * const verified = S.decodeSync(InstalledPackageVerifiedStateValue)({
 *   version: "1.0.0",
 *   packageId: "office",
 *   installedAt: "2026-01-15T12:00:00.000Z",
 *   installRoot: "skills/office",
 *   manifestPath: "skills/office/SKILL.md",
 *   skills: {},
 *   trustTier: "verified",
 * })
 * console.log(verified.trustTier) // "verified"
 * ```
 *
 * @see {@link InstalledPackageOfficialStateValue} for the official trust-tier variant.
 * @see {@link InstalledPackageCommunityStateValue} for the community trust-tier variant.
 * @see {@link InstalledPackageLocalStateValue} for the local trust-tier variant.
 * @category models
 * @since 0.0.0
 */
export class InstalledPackageVerifiedStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageVerifiedStateValue>($I`InstalledPackageVerifiedStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.verified)
  },
  $I.annote("InstalledPackageVerifiedStateValue", {
    description: "Locked package state tagged with the verified trust tier."
  })
) {
}

/**
 * Locked package state tagged with the official trust tier.
 *
 * **Example** (Decode an official package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageOfficialStateValue } from "@beep/scratchpad/ontoskills/registry"
 *
 * const official = S.decodeSync(InstalledPackageOfficialStateValue)({
 *   version: "1.0.0",
 *   packageId: "office",
 *   installedAt: "2026-01-15T12:00:00.000Z",
 *   installRoot: "skills/office",
 *   manifestPath: "skills/office/SKILL.md",
 *   skills: {},
 *   trustTier: "official",
 * })
 * console.log(official.trustTier) // "official"
 * ```
 *
 * @see {@link InstalledPackageVerifiedStateValue} for the verified trust-tier variant.
 * @see {@link InstalledPackageCommunityStateValue} for the community trust-tier variant.
 * @see {@link InstalledPackageLocalStateValue} for the local trust-tier variant.
 * @category models
 * @since 0.0.0
 */
export class InstalledPackageOfficialStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageOfficialStateValue>($I`InstalledPackageOfficialStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.official)
  },
  $I.annote("InstalledPackageOfficialStateValue", {
    description: "Locked package state tagged with the official trust tier."
  })
) {
}

/**
 * Locked package state tagged with the community trust tier.
 *
 * **Example** (Decode a community package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageCommunityStateValue } from "@beep/scratchpad/ontoskills/registry"
 *
 * const community = S.decodeSync(InstalledPackageCommunityStateValue)({
 *   version: "1.0.0",
 *   packageId: "office",
 *   installedAt: "2026-01-15T12:00:00.000Z",
 *   installRoot: "skills/office",
 *   manifestPath: "skills/office/SKILL.md",
 *   skills: {},
 *   trustTier: "community",
 * })
 * console.log(community.trustTier) // "community"
 * ```
 *
 * @see {@link InstalledPackageVerifiedStateValue} for the verified trust-tier variant.
 * @see {@link InstalledPackageOfficialStateValue} for the official trust-tier variant.
 * @see {@link InstalledPackageLocalStateValue} for the local trust-tier variant.
 * @category models
 * @since 0.0.0
 */
export class InstalledPackageCommunityStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageCommunityStateValue>($I`InstalledPackageCommunityStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.community)
  },
  $I.annote("InstalledPackageCommunityStateValue", {
    description: "Locked package state tagged with the community trust tier."
  })
) {
}

/**
 * Locked package state tagged with the local trust tier.
 *
 * **Example** (Decode a local package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageLocalStateValue } from "@beep/scratchpad/ontoskills/registry"
 *
 * const local = S.decodeSync(InstalledPackageLocalStateValue)({
 *   version: "1.0.0",
 *   packageId: "office",
 *   installedAt: "2026-01-15T12:00:00.000Z",
 *   installRoot: "skills/office",
 *   manifestPath: "skills/office/SKILL.md",
 *   skills: {},
 *   trustTier: "local",
 * })
 * console.log(local.trustTier) // "local"
 * ```
 *
 * @see {@link InstalledPackageVerifiedStateValue} for the verified trust-tier variant.
 * @see {@link InstalledPackageOfficialStateValue} for the official trust-tier variant.
 * @see {@link InstalledPackageCommunityStateValue} for the community trust-tier variant.
 * @category models
 * @since 0.0.0
 */
export class InstalledPackageLocalStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageLocalStateValue>($I`InstalledPackageLocalStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.local)
  },
  $I.annote("InstalledPackageLocalStateValue", {
    description: "Locked package state tagged with the local trust tier."
  })
) {
}

/**
 * Discriminated union of locked-package values keyed by {@link TrustTier}.
 *
 * **Example** (Decode by trust tier)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageStateValue } from "@beep/scratchpad/ontoskills/registry"
 *
 * const value = S.decodeSync(InstalledPackageStateValue)({
 *   version: "1.0.0",
 *   packageId: "office",
 *   installedAt: "2026-01-15T12:00:00.000Z",
 *   installRoot: "skills/office",
 *   manifestPath: "skills/office/SKILL.md",
 *   skills: {},
 *   trustTier: "community",
 * })
 * console.log(value.trustTier) // "community"
 * ```
 *
 * @see {@link InstalledPackageVerifiedStateValue} for the verified member.
 * @see {@link InstalledPackageOfficialStateValue} for the official member.
 * @see {@link InstalledPackageCommunityStateValue} for the community member.
 * @see {@link InstalledPackageLocalStateValue} for the local member.
 * @category schemas
 * @since 0.0.0
 */
export const InstalledPackageStateValue = S.Union(
  [
    InstalledPackageVerifiedStateValue,
    InstalledPackageOfficialStateValue,
    InstalledPackageCommunityStateValue,
    InstalledPackageLocalStateValue
  ]
).pipe(
  S.toTaggedUnion("trustTier"),
  $I.annoteSchema("InstalledPackageStateValue", {
    description: "Discriminated union of locked-package values keyed by trust tier."
  })
);

/**
 * Decoded member of {@link InstalledPackageStateValue}.
 *
 * @see {@link InstalledPackageStateValue} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type InstalledPackageStateValue = typeof InstalledPackageStateValue.Type;

/**
 * Wrapper that stores one {@link InstalledPackageStateValue} before source-kind tagging.
 *
 * **Example** (Decode a wrapped community state)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageStateBase } from "@beep/scratchpad/ontoskills/registry"
 *
 * const wrapped = S.decodeSync(InstalledPackageStateBase)({
 *   state: {
 *     version: "1.0.0",
 *     packageId: "office",
 *     installedAt: "2026-01-15T12:00:00.000Z",
 *     installRoot: "skills/office",
 *     manifestPath: "skills/office/SKILL.md",
 *     skills: {},
 *     trustTier: "community",
 *   },
 * })
 * console.log(wrapped.state.trustTier) // "community"
 * ```
 *
 * @see {@link InstalledOntologyPackageState} for the ontology source-kind extension.
 * @see {@link InstalledSourcePackageState} for the source-tree extension.
 * @category models
 * @since 0.0.0
 */
export class InstalledPackageStateBase extends S.Class<InstalledPackageStateBase>($I`InstalledPackageStateBase`)(
  {
    state: InstalledPackageStateValue
  },
  $I.annote("InstalledPackageStateBase", {
    description: "Wrapper that stores one locked-package value before source-kind tagging."
  })
) {
}

/**
 * Locked package tagged as an ontology catalog source.
 *
 * **Example** (Decode an ontology package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledOntologyPackageState } from "@beep/scratchpad/ontoskills/registry"
 *
 * const ontology = S.decodeSync(InstalledOntologyPackageState)({
 *   sourceKind: "ontology",
 *   state: {
 *     version: "1.0.0",
 *     packageId: "office",
 *     installedAt: "2026-01-15T12:00:00.000Z",
 *     installRoot: "skills/office",
 *     manifestPath: "skills/office/SKILL.md",
 *     skills: {},
 *     trustTier: "community",
 *   },
 * })
 * console.log(ontology.sourceKind) // "ontology"
 * ```
 *
 * @see {@link InstalledSourcePackageState} for the skill-source-tree variant.
 * @category models
 * @since 0.0.0
 */
export class InstalledOntologyPackageState extends InstalledPackageStateBase.extend<InstalledOntologyPackageState>($I`InstalledOntologyPackageState`)(
  {
    sourceKind: S.tag(SourceKind.Enum.ontology)
  },
  $I.annote("InstalledOntologyPackageState", {
    description: "Locked package tagged as an ontology catalog source."
  })
) {
}

/**
 * Locked package tagged as a skill source tree.
 *
 * **Example** (Decode a source-tree package)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledSourcePackageState } from "@beep/scratchpad/ontoskills/registry"
 *
 * const source = S.decodeSync(InstalledSourcePackageState)({
 *   sourceKind: "source",
 *   state: {
 *     version: "1.0.0",
 *     packageId: "office",
 *     installedAt: "2026-01-15T12:00:00.000Z",
 *     installRoot: "skills/office",
 *     manifestPath: "skills/office/SKILL.md",
 *     skills: {},
 *     trustTier: "local",
 *   },
 * })
 * console.log(source.sourceKind) // "source"
 * ```
 *
 * @see {@link InstalledOntologyPackageState} for the ontology-catalog variant.
 * @category models
 * @since 0.0.0
 */
export class InstalledSourcePackageState extends InstalledPackageStateBase.extend<InstalledSourcePackageState>($I`InstalledSourcePackageState`)(
  {
    sourceKind: S.tag(SourceKind.Enum.source)
  },
  $I.annote("InstalledSourcePackageState", {
    description: "Locked package tagged as a skill source tree."
  })
) {
}

/**
 * Discriminated union of locked packages keyed by {@link SourceKind}.
 *
 * **Example** (Decode by source kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstalledPackageState } from "@beep/scratchpad/ontoskills/registry"
 *
 * const locked = S.decodeSync(InstalledPackageState)({
 *   sourceKind: "ontology",
 *   state: {
 *     version: "1.0.0",
 *     packageId: "office",
 *     installedAt: "2026-01-15T12:00:00.000Z",
 *     installRoot: "skills/office",
 *     manifestPath: "skills/office/SKILL.md",
 *     skills: {},
 *     trustTier: "community",
 *   },
 * })
 * console.log(locked.sourceKind) // "ontology"
 * ```
 *
 * @see {@link InstalledOntologyPackageState} for the ontology member.
 * @see {@link InstalledSourcePackageState} for the source-tree member.
 * @category schemas
 * @since 0.0.0
 */
export const InstalledPackageState = S.Union(
  [InstalledOntologyPackageState, InstalledSourcePackageState]
).pipe(
  S.toTaggedUnion("sourceKind"),
  $I.annoteSchema("InstalledPackageState", {
    description: "Discriminated union of locked packages keyed by source kind."
  })
);

/**
 * Decoded member of {@link InstalledPackageState}.
 *
 * @see {@link InstalledPackageState} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type InstalledPackageState = typeof InstalledPackageState.Type;

/**
 * On-disk lock mapping package identifiers to their installed {@link InstalledPackageState}.
 *
 * **Example** (Decode a one-package lock)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistryLock } from "@beep/scratchpad/ontoskills/registry"
 *
 * const lock = S.decodeSync(RegistryLock)({
 *   packages: {
 *     "acme/office": {
 *       sourceKind: "ontology",
 *       state: {
 *         version: "1.0.0",
 *         packageId: "office",
 *         installedAt: "2026-01-15T12:00:00.000Z",
 *         installRoot: "skills/office",
 *         manifestPath: "skills/office/SKILL.md",
 *         skills: {},
 *         trustTier: "community",
 *       },
 *     },
 *   },
 * })
 * console.log(Object.keys(lock.packages)) // ["acme/office"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryLock extends S.Class<RegistryLock>($I`RegistryLock`)(
  {
    packages: S.Record(S.NonEmptyString, InstalledPackageState)
  },
  $I.annote("RegistryLock", {
    description: "On-disk lock mapping package identifiers to their installed package state."
  })
) {
}


/**
 * Configured registry source with an index URL, default trust tier, and source kind.
 *
 * **Example** (Decode a community ontology source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistrySource } from "@beep/scratchpad/ontoskills/registry"
 *
 * const source = S.decodeSync(RegistrySource)({
 *   name: "acme",
 *   indexUrl: "https://skills.example.com/index.json",
 * })
 * console.log(source.trustTier) // "community"
 * console.log(source.sourceKind) // "ontology"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistrySource extends S.Class<RegistrySource>($I`RegistrySource`)(
  {
    name: S.String,
    indexUrl: S.URLFromString,
    trustTier: TrustTier.pipe(SchemaUtils.withKeyDefaults(TrustTier.Enum.community)),
    sourceKind: SourceKind.pipe(SchemaUtils.withKeyDefaults(SourceKind.Enum.ontology))
  },
  $I.annote("RegistrySource", {
    description: "Configured registry source with an index URL, default trust tier, and source kind."
  })
) {
}


/**
 * Catalog row pointing at one package manifest path with optional trust override.
 *
 * **Example** (Decode a package catalog row)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistryPackageEntry } from "@beep/scratchpad/ontoskills/registry"
 *
 * const entry = S.decodeSync(RegistryPackageEntry)({
 *   packageId: "office",
 *   manifestPath: "skills/office/SKILL.md",
 * })
 * console.log(entry.sourceKind) // "ontology"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryPackageEntry extends S.Class<RegistryPackageEntry>($I`RegistryPackageEntry`)(
  {
    packageId: S.String,
    manifestPath: FilePath,
    trustTier: TrustTier.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    sourceKind: SourceKind.pipe(SchemaUtils.withKeyDefaults(SourceKind.Enum.ontology)),
  },
  $I.annote("RegistryPackageEntry", {
    description: "Catalog row pointing at one package manifest path with optional trust override."
  })
) {}

/**
 * Global embedding model declaration used by a registry index for retrieval.
 *
 * **Example** (Decode the default MiniLM model)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EmbeddingModelInfo } from "@beep/scratchpad/ontoskills/registry"
 *
 * const model = S.decodeSync(EmbeddingModelInfo)({})
 * console.log(model.dimension) // 384
 * console.log(model.modelName) // "sentence-transformers/all-MiniLM-L6-v2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmbeddingModelInfo extends S.Class<EmbeddingModelInfo>($I`EmbeddingModelInfo`)(
  {
    modelName: S.String.pipe(SchemaUtils.withKeyDefaults("sentence-transformers/all-MiniLM-L6-v2")),
    dimension: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(384))),
    modelFile: S.String.pipe(SchemaUtils.withKeyDefaults("model.onnx")),
    tokenizerFile: S.String.pipe(SchemaUtils.withKeyDefaults("tokenizer.json")),
  },
  $I.annote("EmbeddingModelInfo", {
    description: "Global embedding model declaration used by a registry index for retrieval."
  })
) {}

/**
 * Source index listing package identifiers and the embedding model used to retrieve them.
 *
 * **Example** (Decode an empty package index)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RegistryIndex } from "@beep/scratchpad/ontoskills/registry"
 *
 * const index = S.decodeSync(RegistryIndex)({
 *   embeddingModel: {},
 * })
 * console.log(index.packages) // []
 * console.log(index.embeddingModel.dimension) // 384
 * ```
 *
 * @see {@link EmbeddingModelInfo} for the nested embedding-model defaults.
 * @category models
 * @since 0.0.0
 */
export class RegistryIndex extends S.Class<RegistryIndex>($I`RegistryIndex`)(
  {
    packages: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
    embeddingModel: EmbeddingModelInfo,
  },
  $I.annote("RegistryIndex", {
    description: "Source index listing package identifiers and the embedding model used to retrieve them."
  })
) {}

/**
 * Resolution result for an author-level install covering every package under that author.
 *
 * **Example** (Resolve an author with no packages yet)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AuthorTarget } from "@beep/scratchpad/ontoskills/registry"
 *
 * const target = S.decodeSync(AuthorTarget)({
 *   _tag: "AuthorTarget",
 *   author: "acme",
 * })
 * console.log(target.author) // "acme"
 * console.log(target.packages.length) // 0
 * ```
 *
 * @see {@link PackageTarget} for a single-package install.
 * @see {@link SkillTarget} for a single-skill install.
 * @category models
 * @since 0.0.0
 */
export class AuthorTarget extends S.TaggedClass<AuthorTarget>($I`AuthorTarget`)(
  "AuthorTarget",
  {
    author: S.String,
    packages: RegistryPackageEntry.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<RegistryPackageEntry>())
  },
  $I.annote("AuthorTarget", {
    description: "Resolution result for an author-level install covering every package under that author."
  })
) {}

/**
 * Resolution result for a package-level install of one catalog entry.
 *
 * **Example** (Resolve a package install)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PackageTarget } from "@beep/scratchpad/ontoskills/registry"
 *
 * const target = S.decodeSync(PackageTarget)({
 *   _tag: "PackageTarget",
 *   package: {
 *     packageId: "office",
 *     manifestPath: "skills/office/SKILL.md",
 *   },
 * })
 * console.log(target.package.packageId) // "office"
 * ```
 *
 * @see {@link AuthorTarget} for an author-wide install.
 * @see {@link SkillTarget} for a single-skill install.
 * @category models
 * @since 0.0.0
 */
export class PackageTarget extends S.TaggedClass<PackageTarget>($I`PackageTarget`)(
  "PackageTarget",
  {
    package:RegistryPackageEntry,
  },
  $I.annote("PackageTarget", {
    description: "Resolution result for a package-level install of one catalog entry."
  })
) {}

/**
 * Resolution result for a skill-level install, including sibling dependency identifiers.
 *
 * **Example** (Resolve a standalone skill)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SkillTarget } from "@beep/scratchpad/ontoskills/registry"
 *
 * const target = S.decodeSync(SkillTarget)({
 *   _tag: "SkillTarget",
 *   package: {
 *     packageId: "office",
 *     manifestPath: "skills/office/SKILL.md",
 *   },
 *   skillId: "docx-review",
 *   standalone: true,
 * })
 * console.log(target.skillId) // "docx-review"
 * console.log(target.siblingDeps) // []
 * ```
 *
 * @see {@link AuthorTarget} for an author-wide install.
 * @see {@link PackageTarget} for a whole-package install.
 * @category models
 * @since 0.0.0
 */
export class SkillTarget extends S.TaggedClass<SkillTarget>($I`SkillTarget`)(
  "SkillTarget",
  {
    package:RegistryPackageEntry,
    skillId: S.String,
    standalone: S.Boolean,
    siblingDeps: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>())
  },
  $I.annote("SkillTarget", {
    description: "Resolution result for a skill-level install, including sibling dependency identifiers."
  })
)  {}

/**
 * Discriminated union of author, package, and skill install resolutions.
 *
 * **Example** (Decode a package install target)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InstallTarget } from "@beep/scratchpad/ontoskills/registry"
 *
 * const target = S.decodeSync(InstallTarget)({
 *   _tag: "PackageTarget",
 *   package: {
 *     packageId: "office",
 *     manifestPath: "skills/office/SKILL.md",
 *   },
 * })
 * console.log(target._tag) // "PackageTarget"
 * ```
 *
 * @see {@link AuthorTarget} for the author-wide member.
 * @see {@link PackageTarget} for the package member.
 * @see {@link SkillTarget} for the skill member.
 * @category schemas
 * @since 0.0.0
 */
export const InstallTarget = S.Union(
  [
    AuthorTarget,
    PackageTarget,
    SkillTarget,
  ]
).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("InstallTarget", {
    description: "Discriminated union of author, package, and skill install resolutions."
  })
)

/**
 * Decoded member of {@link InstallTarget}.
 *
 * @see {@link InstallTarget} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type InstallTarget = typeof InstallTarget.Type;
