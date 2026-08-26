import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {LiteralKit} from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import {SemverFromString} from "@beep/schema/Semver";
import {FilePath} from "@beep/schema";


const $I = $ScratchpadId.create("ontoskills/OntoSkills.models");

export const TrustTier = LiteralKit(
  [
"verified", "official", "community", "local"
  ]
).pipe(
  $I.annoteSchema("TrustTier", {
    description: ""
  })
)

export type TrustTier = typeof TrustTier.Type;


export const SourceKind = LiteralKit(
  [
"ontology", "source"
  ]
).pipe(
  $I.annoteSchema("SourceKind", {
    description: ""
  })
)

export type SourceKind = typeof SourceKind.Type;

export class PackageSkillManifest extends S.Class<PackageSkillManifest>($I`PackageSkillManifest`)(
  {},
  $I.annote("PackageSkillManifest", {
    description: ""
  })
) {}

export class PackageManifest extends S.Class<PackageManifest>($I`PackageManifest`)(
  {},
  $I.annote("PackageManifest", {
    description: ""
  })
) {}

export class InstalledSkillState extends S.Class<InstalledSkillState>($I`InstalledSkillState`)(
  {},
  $I.annote("InstalledSkillState", {
    description: ""
  })
) {}

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
  $I.annote("InstalledSkillStateBase", {
    description: ""
  })
) {}

export class InstalledPackageVerifiedStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageVerifiedStateValue>($I`InstalledPackageVerifiedStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.verified)
  },
  $I.annote("InstalledPackageVerifiedStateValue", {
    description: ""
  })
) {}

export class InstalledPackageOfficialStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageOfficialStateValue>($I`InstalledPackageOfficialStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.official)
  },
  $I.annote("InstalledPackageOfficialStateValue", {
    description: ""
  })
) {}

export class InstalledPackageCommunityStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageCommunityStateValue>($I`InstalledPackageCommunityStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.community)
  },
  $I.annote("InstalledPackageCommunityStateValue", {
    description: ""
  })
) {}

export class InstalledPackageLocalStateValue extends InstalledSkillStateValueBase.extend<InstalledPackageLocalStateValue>($I`InstalledPackageLocalStateValue`)(
  {
    trustTier: S.tag(TrustTier.Enum.local)
  },
  $I.annote("InstalledPackageLocalStateValue", {
    description: ""
  })
) {}

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
    description: ""
  })
)

export type InstalledPackageStateValue = typeof InstalledPackageStateValue.Type;

export class InstalledPackageStateBase extends S.Class<InstalledPackageStateBase>($I`InstalledPackageStateBase`)(
  {
    state: InstalledPackageStateValue
  },
  $I.annote("InstalledPackageStateBase", {
    description: ""
  })
) {}

export class InstalledOntologyPackageState extends InstalledPackageStateBase.extend<InstalledOntologyPackageState>($I`InstalledOntologyPackageState`)(
  {
    sourceKind: S.tag(SourceKind.Enum.ontology)
  },
  $I.annote("InstalledOntologyPackageState", {
    description: ""
  })
) {}

export class InstalledSourcePackageState extends InstalledPackageStateBase.extend<InstalledSourcePackageState>($I`InstalledSourcePackageState`)(
  {
    sourceKind: S.tag(SourceKind.Enum.source)
  },
  $I.annote("InstalledSourcePackageState", {
    description: ""
  })
) {}

export const InstalledPackageState = S.Union(
  [InstalledOntologyPackageState, InstalledSourcePackageState]
).pipe(
  S.toTaggedUnion("sourceKind"),
  $I.annoteSchema("InstalledPackageState", {
    description: ""
  })
)

export type InstalledPackageState = typeof InstalledPackageState.Type;
