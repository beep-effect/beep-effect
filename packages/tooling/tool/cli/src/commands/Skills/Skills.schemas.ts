/**
 * Schema models for immutable skill provenance and `skills-lock/v2`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Skills/Skills.schemas");

const gitRevisionPattern = /^[0-9a-f]{40}$/u;

/**
 * Upstream source kinds a `skills-lock/v2` provenance entry is allowed to pin.
 *
 * **Details**
 *
 * The first provenance wave resolves GitHub trees only. Every admitted kind
 * needs its own immutable-content fetcher, so the domain widens deliberately
 * rather than accepting arbitrary source strings.
 *
 * **Example** (Recognize the pilot source kind)
 *
 * ```ts
 * import { SkillSourceType } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillSourceType.is.github("github")) // true
 * console.log(SkillSourceType.is.github("gitlab")) // false
 * console.log(SkillSourceType.Options.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillSourceType = LiteralKit(["github"]).pipe(
  $I.annoteSchema("SkillSourceType", {
    description: "Upstream source kind supported by skills-lock/v2 provenance entries.",
  })
);
/**
 * Upstream source kind decoded by {@link SkillSourceType}.
 *
 * @see {@link SkillSourceType} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillSourceType = typeof SkillSourceType.Type;

/**
 * Digest algorithm every `skills-lock/v2` hash is computed with.
 *
 * **Details**
 *
 * The algorithm is recorded in the lock rather than assumed by readers, so a
 * future migration can be detected instead of silently misinterpreted.
 *
 * **Example** (Check the recorded digest algorithm)
 *
 * ```ts
 * import { SkillSnapshotAlgorithm } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillSnapshotAlgorithm.is.sha256("sha256")) // true
 * console.log(SkillSnapshotAlgorithm.is.sha256("sha512")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillSnapshotAlgorithm = LiteralKit(["sha256"]).pipe(
  $I.annoteSchema("SkillSnapshotAlgorithm", {
    description: "Digest algorithm used for skill snapshots, patches, licenses, and effective trees.",
  })
);
/**
 * Digest algorithm decoded by {@link SkillSnapshotAlgorithm}.
 *
 * @see {@link SkillSnapshotAlgorithm} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillSnapshotAlgorithm = typeof SkillSnapshotAlgorithm.Type;

/**
 * Git file modes the ordered snapshot manifest is allowed to retain.
 *
 * **Details**
 *
 * Modes are part of the hashed manifest because a skill that loses its
 * executable bit or turns into a symlink is a different tree even when every
 * byte matches. Directory and submodule modes are excluded: the manifest lists
 * blobs only.
 *
 * **Example** (Separate blob modes from directory modes)
 *
 * ```ts
 * import { SkillTreeMode } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillTreeMode.is["100755"]("100755")) // true
 * console.log(SkillTreeMode.is["120000"]("040000")) // false
 * console.log(SkillTreeMode.Options.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillTreeMode = LiteralKit(["100644", "100755", "120000"]).pipe(
  $I.annoteSchema("SkillTreeMode", {
    description: "Canonical Git mode for a regular, executable, or symbolic-link skill tree entry.",
  })
);
/**
 * Git tree mode decoded by {@link SkillTreeMode}.
 *
 * @see {@link SkillTreeMode} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillTreeMode = typeof SkillTreeMode.Type;

/**
 * Epistemic status of an upstream provenance claim.
 *
 * **Details**
 *
 * `exact` means the pinned tree reproduces byte-for-byte, `inferred` means the
 * origin was reconstructed from history rather than proven by content, and
 * `unresolved` records that the audit failed to establish an origin at all.
 * The status is stored so an unproven claim can never be read as a proven one.
 *
 * **Example** (Distinguish a proven origin from a reconstructed one)
 *
 * ```ts
 * import { SkillProvenanceStatus } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillProvenanceStatus.is.exact("exact")) // true
 * console.log(SkillProvenanceStatus.is.inferred("exact")) // false
 * console.log(SkillProvenanceStatus.Options.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProvenanceStatus = LiteralKit(["exact", "inferred", "unresolved"]).pipe(
  $I.annoteSchema("SkillProvenanceStatus", {
    description: "Whether the pinned provenance claim is byte-exact, inferred, or unresolved.",
  })
);
/**
 * Provenance status decoded by {@link SkillProvenanceStatus}.
 *
 * @see {@link SkillProvenanceStatus} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillProvenanceStatus = typeof SkillProvenanceStatus.Type;

/**
 * Audited confidence attached to an upstream provenance claim.
 *
 * **Details**
 *
 * Confidence is graded separately from {@link SkillProvenanceStatus} because a
 * reconstructed origin can still be well evidenced, and an `unresolved` status
 * carries the matching `unresolved` confidence rather than a misleading `low`.
 *
 * **Example** (Read the graded confidence domain)
 *
 * ```ts
 * import { SkillProvenanceConfidence } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillProvenanceConfidence.is.high("high")) // true
 * console.log(SkillProvenanceConfidence.is.unresolved("unresolved")) // true
 * console.log(SkillProvenanceConfidence.Options.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProvenanceConfidence = LiteralKit(["high", "medium", "low", "unresolved"]).pipe(
  $I.annoteSchema("SkillProvenanceConfidence", {
    description: "Audited confidence in the upstream repository and pinned revision claim.",
  })
);
/**
 * Provenance confidence decoded by {@link SkillProvenanceConfidence}.
 *
 * @see {@link SkillProvenanceConfidence} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillProvenanceConfidence = typeof SkillProvenanceConfidence.Type;

/**
 * Evidence classes the wave-1 provenance audit accepts as support for a claim.
 *
 * **Details**
 *
 * `exact-tree` is content proof; the remaining classes are historical
 * arguments. An entry records the evidence it actually has, so a reader can
 * tell a byte-verified origin from one supported only by import history.
 *
 * **Example** (Admit content proof and reject an unlisted class)
 *
 * ```ts
 * import { SkillProvenanceEvidence } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillProvenanceEvidence.is["exact-tree"]("exact-tree")) // true
 * console.log(SkillProvenanceEvidence.is["path-history"]("vibes")) // false
 * console.log(SkillProvenanceEvidence.Options.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProvenanceEvidence = LiteralKit([
  "exact-tree",
  "historical-import",
  "package-owner",
  "path-history",
]).pipe(
  $I.annoteSchema("SkillProvenanceEvidence", {
    description: "Evidence classes supporting a wave-1 skill provenance claim.",
  })
);
/**
 * Provenance evidence class decoded by {@link SkillProvenanceEvidence}.
 *
 * @see {@link SkillProvenanceEvidence} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillProvenanceEvidence = typeof SkillProvenanceEvidence.Type;

/**
 * Review labels explaining why an ordered local skill patch exists.
 *
 * **Details**
 *
 * The label is what makes drift reviewable instead of permanent:
 * `temporary-drift` is expected to disappear once upstream catches up, while
 * `policy` and `repo-adaptation` patches are intentionally carried forward.
 *
 * **Example** (Label a patch that is meant to be dropped)
 *
 * ```ts
 * import { SkillPatchLabel } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(SkillPatchLabel.is["temporary-drift"]("temporary-drift")) // true
 * console.log(SkillPatchLabel.is.policy("temporary-drift")) // false
 * console.log(SkillPatchLabel.Options.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillPatchLabel = LiteralKit(["policy", "repo-adaptation", "temporary-drift"]).pipe(
  $I.annoteSchema("SkillPatchLabel", {
    description: "Review label describing why a local skill patch exists.",
  })
);
/**
 * Patch review label decoded by {@link SkillPatchLabel}.
 *
 * @see {@link SkillPatchLabel} for the runtime literal schema and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SkillPatchLabel = typeof SkillPatchLabel.Type;

/**
 * Branded 40-character lowercase Git commit revision that pins immutable content.
 *
 * **Details**
 *
 * Abbreviated revisions, uppercase hex, tags, and branch names are all
 * rejected: only a complete commit object id names content that cannot move
 * out from under the lock.
 *
 * **Example** (Reject an abbreviated revision)
 *
 * ```ts
 * import { SkillGitRevision } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const isRevision = S.is(SkillGitRevision)
 *
 * console.log(isRevision("91f21dfe1328585670275781b4525fff2507f917")) // true
 * console.log(isRevision("91f21df")) // false
 * console.log(isRevision("main")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillGitRevision = S.String.check(
  S.isPattern(gitRevisionPattern, {
    identifier: $I`SkillGitRevisionCheck`,
    title: "Skill Git Revision",
    description: "A complete 40-character lowercase hexadecimal Git commit revision.",
    message: "Expected a complete 40-character lowercase Git revision",
  })
).pipe(
  S.brand("SkillGitRevision"),
  $I.annoteSchema("SkillGitRevision", {
    description: "Immutable complete Git commit revision used by skills-lock/v2.",
  })
);
/**
 * Branded Git commit revision decoded by {@link SkillGitRevision}.
 *
 * @see {@link SkillGitRevision} for the runtime schema and its pattern check.
 * @category type-level
 * @since 0.0.0
 */
export type SkillGitRevision = typeof SkillGitRevision.Type;

/**
 * One raw file supplied from an immutable upstream skill tree.
 *
 * **Details**
 *
 * Content is carried as bytes rather than text so binary assets and unusual
 * encodings survive hashing unchanged; `path` is always relative to the skill
 * tree root, never to the repository.
 *
 * **Example** (Supply one pinned upstream file)
 *
 * ```ts
 * import { SkillUpstreamContentFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const file = SkillUpstreamContentFile.make({
 *   path: "SKILL.md",
 *   mode: "100644",
 *   bytes: new TextEncoder().encode("# shadcn\n"),
 * })
 *
 * console.log(file.path) // "SKILL.md"
 * console.log(file.bytes.length) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillUpstreamContentFile extends S.Class<SkillUpstreamContentFile>($I`SkillUpstreamContentFile`)(
  {
    path: S.String,
    mode: SkillTreeMode,
    bytes: S.Uint8Array,
  },
  $I.annote("SkillUpstreamContentFile", {
    description: "Binary-safe file bytes and Git mode supplied for an immutable upstream skill tree.",
  })
) {}

/**
 * Binary-safe upstream snapshot and pinned license bytes returned by a content source.
 *
 * **Details**
 *
 * License bytes travel with the tree because both are fetched at the same
 * pinned revision; splitting the fetch would let the recorded license drift
 * away from the code it covers.
 *
 * **Example** (Assemble the payload a content source returns)
 *
 * ```ts
 * import { SkillUpstreamContent, SkillUpstreamContentFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const encoder = new TextEncoder()
 * const content = SkillUpstreamContent.make({
 *   files: [
 *     SkillUpstreamContentFile.make({
 *       path: "SKILL.md",
 *       mode: "100644",
 *       bytes: encoder.encode("# shadcn\n"),
 *     }),
 *   ],
 *   licenseBytes: encoder.encode("MIT License\n"),
 * })
 *
 * console.log(content.files.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillUpstreamContent extends S.Class<SkillUpstreamContent>($I`SkillUpstreamContent`)(
  {
    files: S.Array(SkillUpstreamContentFile),
    licenseBytes: S.Uint8Array,
  },
  $I.annote("SkillUpstreamContent", {
    description: "Complete pinned skill tree plus license bytes supplied behind the upstream-content service.",
  })
) {}

/**
 * Immutable upstream identity and observation metadata for one skill.
 *
 * **Details**
 *
 * `sourceRevision` is the pin everything else is computed against.
 * `observedHeadRevision` and `observedPathRevision` are recorded separately so
 * a later run can tell "upstream moved" from "this skill's files moved" without
 * refetching; `trackingRef` is advisory only and never resolved during hashing.
 *
 * **Example** (Decode the ratified upstream identity of the pilot skill)
 *
 * ```ts
 * import { SkillUpstream } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const upstream = S.decodeUnknownSync(SkillUpstream)({
 *   repository: "shadcn-ui/ui",
 *   repositoryUrl: "https://github.com/shadcn-ui/ui",
 *   treePath: "skills/shadcn",
 *   entryPath: "skills/shadcn/SKILL.md",
 *   trackingRef: "main",
 *   sourceRevision: "91f21dfe1328585670275781b4525fff2507f917",
 *   observedHeadRevision: "cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4",
 *   observedPathRevision: "6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37",
 * })
 *
 * console.log(upstream.treePath) // "skills/shadcn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillUpstream extends S.Class<SkillUpstream>($I`SkillUpstream`)(
  {
    repository: S.String,
    repositoryUrl: S.String,
    treePath: S.String,
    entryPath: S.String,
    trackingRef: S.String,
    sourceRevision: SkillGitRevision,
    observedHeadRevision: SkillGitRevision,
    observedPathRevision: SkillGitRevision,
  },
  $I.annote("SkillUpstream", {
    description: "Immutable source identity plus the separately observed repository and entry-path revisions.",
  })
) {}

/**
 * One ordered, mode-aware file in a pristine skill snapshot.
 *
 * **Details**
 *
 * Only the digest is retained, never the content, so the manifest stays small
 * while still identifying the file exactly. Manifest entries are sorted by
 * `path`, which is what makes the aggregate manifest hash reproducible.
 *
 * **Example** (Decode one manifest entry)
 *
 * ```ts
 * import { SkillSnapshotFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const file = S.decodeUnknownSync(SkillSnapshotFile)({
 *   path: "SKILL.md",
 *   mode: "100644",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 * })
 *
 * console.log(file.mode) // "100644"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillSnapshotFile extends S.Class<SkillSnapshotFile>($I`SkillSnapshotFile`)(
  {
    path: S.String,
    mode: SkillTreeMode,
    sha256: Sha256Hex,
  },
  $I.annote("SkillSnapshotFile", {
    description: "One canonical path, Git mode, and content digest in an ordered skill manifest.",
  })
) {}

const SkillSnapshotFileCountCheck = S.makeFilter(
  (snapshot: { readonly fileCount: number; readonly manifest: ReadonlyArray<SkillSnapshotFile> }) =>
    snapshot.fileCount === snapshot.manifest.length,
  {
    identifier: $I`SkillSnapshotFileCountCheck`,
    title: "Skill Snapshot File Count",
    description: "A snapshot's fileCount must equal the number of entries in its manifest.",
    message: "Expected fileCount to equal the number of manifest entries",
  }
);

/**
 * Complete pristine upstream tree snapshot at the pinned source revision.
 *
 * **Details**
 *
 * `treeHash` covers the file contents while `manifestHash` covers the ordered
 * path-and-mode listing, so a pure rename or mode flip is still detected even
 * though the content digests are unchanged.
 *
 * **Gotchas**
 *
 * `fileCount` is checked against `manifest.length` at the struct level, so a
 * hand-edited lock entry claiming more or fewer files than it lists is rejected
 * at decode rather than being read as a smaller snapshot than it really is.
 *
 * **Example** (Decode a single-file snapshot)
 *
 * ```ts
 * import { SkillSnapshot } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const snapshot = S.decodeUnknownSync(SkillSnapshot)({
 *   algorithm: "sha256",
 *   treeHash: digest,
 *   fileCount: 1,
 *   manifestHash: digest,
 *   manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 * })
 *
 * console.log(snapshot.manifest.length) // 1
 * ```
 *
 * **Example** (Reject a manifest that disagrees with its count)
 *
 * ```ts
 * import { SkillSnapshot } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const decoded = S.decodeUnknownResult(SkillSnapshot)({
 *   algorithm: "sha256",
 *   treeHash: digest,
 *   fileCount: 0,
 *   manifestHash: digest,
 *   manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 * })
 *
 * console.log(Result.isFailure(decoded)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillSnapshot extends S.Class<SkillSnapshot>($I`SkillSnapshot`)(
  S.Struct({
    algorithm: SkillSnapshotAlgorithm,
    treeHash: Sha256Hex,
    fileCount: NonNegativeInt,
    manifestHash: Sha256Hex,
    manifest: S.Array(SkillSnapshotFile),
  }).check(SkillSnapshotFileCountCheck),
  $I.annote("SkillSnapshot", {
    description: "Mode-aware ordered upstream tree manifest and its canonical aggregate hashes.",
  })
) {}

/**
 * License bytes captured from the upstream repository at the pinned revision.
 *
 * **Details**
 *
 * The digest is verified against the refetched license before any provenance
 * is reported, so a relicensed upstream fails loudly instead of being
 * republished under the terms recorded here.
 *
 * **Example** (Decode the pinned pilot license)
 *
 * ```ts
 * import { SkillLicense } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const license = S.decodeUnknownSync(SkillLicense)({
 *   spdxId: "MIT",
 *   path: "LICENSE.md",
 *   sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
 * })
 *
 * console.log(license.spdxId) // "MIT"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLicense extends S.Class<SkillLicense>($I`SkillLicense`)(
  {
    spdxId: S.String,
    path: S.String,
    sha256: Sha256Hex,
  },
  $I.annote("SkillLicense", {
    description: "SPDX identity, upstream path, and byte hash of the license at sourceRevision.",
  })
) {}

/**
 * Audited evidence and epistemic state for an upstream provenance claim.
 *
 * **Details**
 *
 * `matchedFileCount` and `upstreamFileCount` are what make a `high` confidence
 * claim checkable: equal counts mean the pinned tree reproduces completely,
 * while a shortfall is the local drift the patch series must account for.
 *
 * **Example** (Decode a fully reproduced provenance claim)
 *
 * ```ts
 * import { SkillProvenance } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const provenance = S.decodeUnknownSync(SkillProvenance)({
 *   status: "exact",
 *   confidence: "high",
 *   matchedFileCount: 4,
 *   upstreamFileCount: 4,
 *   evidence: ["exact-tree", "path-history"],
 * })
 *
 * console.log(provenance.matchedFileCount === provenance.upstreamFileCount) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProvenance extends S.Class<SkillProvenance>($I`SkillProvenance`)(
  {
    status: SkillProvenanceStatus,
    confidence: SkillProvenanceConfidence,
    matchedFileCount: NonNegativeInt,
    upstreamFileCount: NonNegativeInt,
    evidence: S.Array(SkillProvenanceEvidence),
  },
  $I.annote("SkillProvenance", {
    description: "Explicit epistemic state, match counts, and audited evidence for one skill origin claim.",
  })
) {}

/**
 * One ordered local patch proposed between the pristine and effective trees.
 *
 * **Details**
 *
 * `owner` and `dropCondition` are required so no patch becomes permanent by
 * accident: every carried delta names who answers for it and the observable
 * condition under which it should be deleted.
 *
 * **Example** (Decode a patch that names its own retirement condition)
 *
 * ```ts
 * import { SkillPatch } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const patch = S.decodeUnknownSync(SkillPatch)({
 *   path: "patches/0001-local-drift.patch",
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   label: "repo-adaptation",
 *   owner: "repo-cli",
 *   dropCondition: "Upstream adopts the portless dev-server law.",
 * })
 *
 * console.log(patch.label) // "repo-adaptation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatch extends S.Class<SkillPatch>($I`SkillPatch`)(
  {
    path: S.String,
    sha256: Sha256Hex,
    label: SkillPatchLabel,
    owner: S.String,
    dropCondition: S.String,
  },
  $I.annote("SkillPatch", {
    description: "Hashed local patch with its review label, owner, and explicit drop condition.",
  })
) {}

/**
 * Ordered and independently hashed local patch series.
 *
 * **Details**
 *
 * `patchSetHash` is computed even when `required` is `false`, so a skill with
 * no local delta still carries the stable empty-set digest and a later
 * appearance of drift is visible as a hash change rather than a new field.
 *
 * **Example** (Decode a skill that carries no local drift)
 *
 * ```ts
 * import { SkillPatches } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const patches = S.decodeUnknownSync(SkillPatches)({
 *   required: false,
 *   patchSetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   series: [],
 * })
 *
 * console.log(patches.required) // false
 * console.log(patches.series.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillPatches extends S.Class<SkillPatches>($I`SkillPatches`)(
  {
    required: S.Boolean,
    patchSetHash: Sha256Hex,
    series: S.Array(SkillPatch),
  },
  $I.annote("SkillPatches", {
    description: "Ordered patch series separating local customization from the pristine upstream snapshot.",
  })
) {}

/**
 * Reconstructed output identity and installed-target equivalence proof.
 *
 * **Details**
 *
 * `treeHash` is what upstream plus the patch series reconstructs to, while
 * `installedTreeHash` folds every entry of `installedTargets` together. The
 * pair is what proves the mirrored install locations have not diverged.
 *
 * **Example** (Decode the cross-target effective identity)
 *
 * ```ts
 * import { SkillEffective } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const effective = S.decodeUnknownSync(SkillEffective)({
 *   treeHash: digest,
 *   installedTargets: [".claude/skills/shadcn", ".agents/skills/shadcn"],
 *   installedTreeHash: digest,
 * })
 *
 * console.log(effective.installedTargets.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillEffective extends S.Class<SkillEffective>($I`SkillEffective`)(
  {
    treeHash: Sha256Hex,
    installedTargets: S.Array(S.String),
    installedTreeHash: Sha256Hex,
  },
  $I.annote("SkillEffective", {
    description: "Reconstructed upstream-plus-patches hash and cross-target installed tree identity.",
  })
) {}

/**
 * Full `skills-lock/v2` entry for one vendored skill.
 *
 * **Details**
 *
 * Every section is required. The entry deliberately keeps the pristine
 * upstream snapshot, the local patch series, and the reconstructed effective
 * tree apart, so local customization can never be mistaken for upstream
 * content, and the epistemic status of the origin claim travels with it.
 *
 * **Example** (Decode a complete lock entry with no local drift)
 *
 * ```ts
 * import { SkillLockV2Entry } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const revision = "91f21dfe1328585670275781b4525fff2507f917"
 *
 * const entry = S.decodeUnknownSync(SkillLockV2Entry)({
 *   sourceType: "github",
 *   upstream: {
 *     repository: "shadcn-ui/ui",
 *     repositoryUrl: "https://github.com/shadcn-ui/ui",
 *     treePath: "skills/shadcn",
 *     entryPath: "skills/shadcn/SKILL.md",
 *     trackingRef: "main",
 *     sourceRevision: revision,
 *     observedHeadRevision: revision,
 *     observedPathRevision: revision,
 *   },
 *   snapshot: {
 *     algorithm: "sha256",
 *     treeHash: digest,
 *     fileCount: 1,
 *     manifestHash: digest,
 *     manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 *   },
 *   license: { spdxId: "MIT", path: "LICENSE.md", sha256: digest },
 *   provenance: {
 *     status: "exact",
 *     confidence: "high",
 *     matchedFileCount: 1,
 *     upstreamFileCount: 1,
 *     evidence: ["exact-tree"],
 *   },
 *   patches: { required: false, patchSetHash: digest, series: [] },
 *   effective: {
 *     treeHash: digest,
 *     installedTargets: [".claude/skills/shadcn", ".agents/skills/shadcn"],
 *     installedTreeHash: digest,
 *   },
 * })
 *
 * console.log(entry.provenance.status) // "exact"
 * console.log(entry.patches.required) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLockV2Entry extends S.Class<SkillLockV2Entry>($I`SkillLockV2Entry`)(
  {
    sourceType: SkillSourceType,
    upstream: SkillUpstream,
    snapshot: SkillSnapshot,
    license: SkillLicense,
    provenance: SkillProvenance,
    patches: SkillPatches,
    effective: SkillEffective,
  },
  $I.annote("SkillLockV2Entry", {
    description: "Complete immutable-origin, snapshot, license, provenance, patch, and effective-tree record.",
  })
) {}

/**
 * Ratified source-resolution input used to compute a would-be v2 entry.
 *
 * **Details**
 *
 * This is the hand-audited half of a lock entry: the immutable source, the
 * license the audit expects to find, and the epistemic verdict. Everything
 * else in an entry is derived by hashing, which is why no digest other than
 * the license appears here.
 *
 * **Example** (Decode the ratified pilot resolution)
 *
 * ```ts
 * import { SkillProvenanceResolution } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const resolution = S.decodeUnknownSync(SkillProvenanceResolution)({
 *   name: "shadcn",
 *   sourceType: "github",
 *   upstream: {
 *     repository: "shadcn-ui/ui",
 *     repositoryUrl: "https://github.com/shadcn-ui/ui",
 *     treePath: "skills/shadcn",
 *     entryPath: "skills/shadcn/SKILL.md",
 *     trackingRef: "main",
 *     sourceRevision: "91f21dfe1328585670275781b4525fff2507f917",
 *     observedHeadRevision: "cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4",
 *     observedPathRevision: "6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37",
 *   },
 *   license: {
 *     spdxId: "MIT",
 *     path: "LICENSE.md",
 *     sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
 *   },
 *   provenanceStatus: "exact",
 *   provenanceConfidence: "high",
 *   provenanceEvidence: ["exact-tree", "path-history"],
 * })
 *
 * console.log(resolution.name) // "shadcn"
 * console.log(resolution.provenanceEvidence.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProvenanceResolution extends S.Class<SkillProvenanceResolution>($I`SkillProvenanceResolution`)(
  {
    name: S.String,
    sourceType: SkillSourceType,
    upstream: SkillUpstream,
    license: SkillLicense,
    provenanceStatus: SkillProvenanceStatus,
    provenanceConfidence: SkillProvenanceConfidence,
    provenanceEvidence: S.Array(SkillProvenanceEvidence),
  },
  $I.annote("SkillProvenanceResolution", {
    description: "Ratified immutable source, license expectation, and epistemic evidence for one pilot skill.",
  })
) {}

/**
 * Read-only provenance report pairing a would-be lock entry with local drift paths.
 *
 * **Details**
 *
 * `driftPaths` is the sorted union of paths that differ between the pinned
 * upstream tree and the installed one, including paths present on only one
 * side. It is reported rather than repaired: nothing in the pilot writes the
 * lock or the working tree.
 *
 * **Example** (Reject a report whose computed entry is missing)
 *
 * ```ts
 * import { SkillProvenanceReport } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const isReport = S.is(SkillProvenanceReport)
 *
 * console.log(isReport({ skill: "shadcn", entry: {}, driftPaths: [] })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProvenanceReport extends S.Class<SkillProvenanceReport>($I`SkillProvenanceReport`)(
  {
    skill: S.String,
    entry: SkillLockV2Entry,
    driftPaths: S.Array(S.String),
  },
  $I.annote("SkillProvenanceReport", {
    description: "Computed lock entry and deterministic local-drift inventory rendered by the provenance pilot.",
  })
) {}

/**
 * Version-2 project skill lock document keyed by installed skill name.
 *
 * **Details**
 *
 * `version` is a literal `2`, so a v1 lock fails to decode instead of being
 * read with v2 expectations.
 *
 * **Example** (Decode an empty v2 lock and reject a v1 document)
 *
 * ```ts
 * import { SkillsLockV2 } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const lock = S.decodeUnknownSync(SkillsLockV2)({ version: 2, skills: {} })
 *
 * console.log(lock.version) // 2
 * console.log(S.is(SkillsLockV2)({ version: 1, skills: {} })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillsLockV2 extends S.Class<SkillsLockV2>($I`SkillsLockV2`)(
  {
    version: S.Literal(2),
    skills: S.Record(S.String, SkillLockV2Entry),
  },
  $I.annote("SkillsLockV2", {
    description: "Canonical skills-lock/v2 document keyed by installed skill name.",
  })
) {}

/**
 * Narrows an unknown value to a decoded {@link SkillUpstream} record.
 *
 * **Example** (Reject an upstream block missing its observed revisions)
 *
 * ```ts
 * import { isSkillUpstream } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(isSkillUpstream({ repository: "shadcn-ui/ui", treePath: "skills/shadcn" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillUpstream = S.is(SkillUpstream);
/**
 * Narrows an unknown value to a decoded {@link SkillSnapshotFile} entry.
 *
 * **Example** (Accept a manifest entry and reject a truncated digest)
 *
 * ```ts
 * import { isSkillSnapshotFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *
 * console.log(isSkillSnapshotFile({ path: "SKILL.md", mode: "100644", sha256: digest })) // true
 * console.log(isSkillSnapshotFile({ path: "SKILL.md", mode: "100644", sha256: "e3b0c4" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillSnapshotFile = S.is(SkillSnapshotFile);
/**
 * Narrows an unknown value to a decoded {@link SkillSnapshot}.
 *
 * **Example** (Reject a snapshot without its manifest)
 *
 * ```ts
 * import { isSkillSnapshot } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(isSkillSnapshot({ algorithm: "sha256", fileCount: 0 })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillSnapshot = S.is(SkillSnapshot);
/**
 * Narrows an unknown value to a decoded {@link SkillLicense}.
 *
 * **Example** (Accept the pinned pilot license)
 *
 * ```ts
 * import { isSkillLicense } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const sha256 = "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f"
 *
 * console.log(isSkillLicense({ spdxId: "MIT", path: "LICENSE.md", sha256 })) // true
 * console.log(isSkillLicense({ spdxId: "MIT", path: "LICENSE.md" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillLicense = S.is(SkillLicense);
/**
 * Narrows an unknown value to a decoded {@link SkillProvenance} claim.
 *
 * **Example** (Accept a fully evidenced claim)
 *
 * ```ts
 * import { isSkillProvenance } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(
 *   isSkillProvenance({
 *     status: "exact",
 *     confidence: "high",
 *     matchedFileCount: 4,
 *     upstreamFileCount: 4,
 *     evidence: ["exact-tree"],
 *   })
 * ) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillProvenance = S.is(SkillProvenance);
/**
 * Narrows an unknown value to a decoded {@link SkillPatch}.
 *
 * **Example** (Reject a patch that names no drop condition)
 *
 * ```ts
 * import { isSkillPatch } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *
 * console.log(isSkillPatch({ path: "patches/0001.patch", sha256, label: "policy", owner: "repo-cli" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillPatch = S.is(SkillPatch);
/**
 * Narrows an unknown value to a decoded {@link SkillPatches} series.
 *
 * **Example** (Accept an empty but still hashed patch set)
 *
 * ```ts
 * import { isSkillPatches } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const patchSetHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *
 * console.log(isSkillPatches({ required: false, patchSetHash, series: [] })) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillPatches = S.is(SkillPatches);
/**
 * Narrows an unknown value to a decoded {@link SkillEffective} identity.
 *
 * **Example** (Reject an effective block with no installed targets recorded)
 *
 * ```ts
 * import { isSkillEffective } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * const treeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *
 * console.log(isSkillEffective({ treeHash, installedTreeHash: treeHash })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillEffective = S.is(SkillEffective);
/**
 * Narrows an unknown value to a decoded {@link SkillLockV2Entry}.
 *
 * **Example** (Reject an entry that carries only its source kind)
 *
 * ```ts
 * import { isSkillLockV2Entry } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(isSkillLockV2Entry({ sourceType: "github" })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillLockV2Entry = S.is(SkillLockV2Entry);
/**
 * Narrows an unknown value to a decoded {@link SkillsLockV2} document.
 *
 * **Example** (Accept an empty v2 lock and reject a v1 one)
 *
 * ```ts
 * import { isSkillsLockV2 } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 *
 * console.log(isSkillsLockV2({ version: 2, skills: {} })) // true
 * console.log(isSkillsLockV2({ version: 1, skills: {} })) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSkillsLockV2 = S.is(SkillsLockV2);

/**
 * Decodes an unknown value as a {@link SkillUpstream} identity.
 *
 * **Example** (Decode the pinned upstream identity)
 *
 * ```ts
 * import { decodeSkillUpstream } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const upstream = Effect.runSync(
 *   decodeSkillUpstream({
 *     repository: "shadcn-ui/ui",
 *     repositoryUrl: "https://github.com/shadcn-ui/ui",
 *     treePath: "skills/shadcn",
 *     entryPath: "skills/shadcn/SKILL.md",
 *     trackingRef: "main",
 *     sourceRevision: "91f21dfe1328585670275781b4525fff2507f917",
 *     observedHeadRevision: "cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4",
 *     observedPathRevision: "6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37",
 *   })
 * )
 *
 * console.log(upstream.repository) // "shadcn-ui/ui"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillUpstream: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillUpstream, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillUpstream, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillUpstream));
/**
 * Encodes a {@link SkillUpstream} identity back to its wire shape.
 *
 * **Example** (Round-trip the pinned upstream identity)
 *
 * ```ts
 * import { decodeSkillUpstream, encodeSkillUpstream } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const revision = "91f21dfe1328585670275781b4525fff2507f917"
 * const upstream = Effect.runSync(
 *   decodeSkillUpstream({
 *     repository: "shadcn-ui/ui",
 *     repositoryUrl: "https://github.com/shadcn-ui/ui",
 *     treePath: "skills/shadcn",
 *     entryPath: "skills/shadcn/SKILL.md",
 *     trackingRef: "main",
 *     sourceRevision: revision,
 *     observedHeadRevision: revision,
 *     observedPathRevision: revision,
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillUpstream(upstream)).treePath) // "skills/shadcn"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillUpstream: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillUpstream.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillUpstream.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillUpstream));
/**
 * Decodes an unknown value as a {@link SkillSnapshotFile} manifest entry.
 *
 * **Example** (Decode one manifest entry)
 *
 * ```ts
 * import { decodeSkillSnapshotFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const file = Effect.runSync(
 *   decodeSkillSnapshotFile({
 *     path: "SKILL.md",
 *     mode: "100644",
 *     sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   })
 * )
 *
 * console.log(file.path) // "SKILL.md"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillSnapshotFile: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillSnapshotFile, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillSnapshotFile, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillSnapshotFile));
/**
 * Encodes a {@link SkillSnapshotFile} manifest entry back to its wire shape.
 *
 * **Example** (Round-trip one manifest entry)
 *
 * ```ts
 * import { decodeSkillSnapshotFile, encodeSkillSnapshotFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const file = Effect.runSync(
 *   decodeSkillSnapshotFile({
 *     path: "SKILL.md",
 *     mode: "100644",
 *     sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillSnapshotFile(file)).mode) // "100644"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillSnapshotFile: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillSnapshotFile.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillSnapshotFile.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillSnapshotFile));
/**
 * Decodes an unknown value as a {@link SkillSnapshot}.
 *
 * **Example** (Decode a single-file snapshot)
 *
 * ```ts
 * import { decodeSkillSnapshot } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const snapshot = Effect.runSync(
 *   decodeSkillSnapshot({
 *     algorithm: "sha256",
 *     treeHash: digest,
 *     fileCount: 1,
 *     manifestHash: digest,
 *     manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 *   })
 * )
 *
 * console.log(snapshot.fileCount) // 1
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillSnapshot: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillSnapshot, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillSnapshot, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillSnapshot));
/**
 * Encodes a {@link SkillSnapshot} back to its wire shape.
 *
 * **Example** (Round-trip a single-file snapshot)
 *
 * ```ts
 * import { decodeSkillSnapshot, encodeSkillSnapshot } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const snapshot = Effect.runSync(
 *   decodeSkillSnapshot({
 *     algorithm: "sha256",
 *     treeHash: digest,
 *     fileCount: 1,
 *     manifestHash: digest,
 *     manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillSnapshot(snapshot)).manifest.length) // 1
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillSnapshot: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillSnapshot.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillSnapshot.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillSnapshot));
/**
 * Decodes an unknown value as a {@link SkillLicense}.
 *
 * **Example** (Decode the pinned pilot license)
 *
 * ```ts
 * import { decodeSkillLicense } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const license = Effect.runSync(
 *   decodeSkillLicense({
 *     spdxId: "MIT",
 *     path: "LICENSE.md",
 *     sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
 *   })
 * )
 *
 * console.log(license.path) // "LICENSE.md"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillLicense: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillLicense, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillLicense, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillLicense));
/**
 * Encodes a {@link SkillLicense} back to its wire shape.
 *
 * **Example** (Round-trip the pinned pilot license)
 *
 * ```ts
 * import { decodeSkillLicense, encodeSkillLicense } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const license = Effect.runSync(
 *   decodeSkillLicense({
 *     spdxId: "MIT",
 *     path: "LICENSE.md",
 *     sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillLicense(license)).spdxId) // "MIT"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillLicense: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillLicense.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillLicense.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillLicense));
/**
 * Decodes an unknown value as a {@link SkillProvenance} claim.
 *
 * **Example** (Decode a fully reproduced claim)
 *
 * ```ts
 * import { decodeSkillProvenance } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const provenance = Effect.runSync(
 *   decodeSkillProvenance({
 *     status: "exact",
 *     confidence: "high",
 *     matchedFileCount: 4,
 *     upstreamFileCount: 4,
 *     evidence: ["exact-tree", "path-history"],
 *   })
 * )
 *
 * console.log(provenance.confidence) // "high"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillProvenance: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillProvenance, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillProvenance, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillProvenance));
/**
 * Encodes a {@link SkillProvenance} claim back to its wire shape.
 *
 * **Example** (Round-trip a fully reproduced claim)
 *
 * ```ts
 * import { decodeSkillProvenance, encodeSkillProvenance } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const provenance = Effect.runSync(
 *   decodeSkillProvenance({
 *     status: "exact",
 *     confidence: "high",
 *     matchedFileCount: 4,
 *     upstreamFileCount: 4,
 *     evidence: ["exact-tree"],
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillProvenance(provenance)).status) // "exact"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillProvenance: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillProvenance.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillProvenance.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillProvenance));
/**
 * Decodes an unknown value as a {@link SkillPatch}.
 *
 * **Example** (Decode one labelled local patch)
 *
 * ```ts
 * import { decodeSkillPatch } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const patch = Effect.runSync(
 *   decodeSkillPatch({
 *     path: "patches/0001-local-drift.patch",
 *     sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     label: "temporary-drift",
 *     owner: "repo-cli",
 *     dropCondition: "Upstream ships the same fix.",
 *   })
 * )
 *
 * console.log(patch.owner) // "repo-cli"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillPatch: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillPatch, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillPatch, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillPatch));
/**
 * Encodes a {@link SkillPatch} back to its wire shape.
 *
 * **Example** (Round-trip one labelled local patch)
 *
 * ```ts
 * import { decodeSkillPatch, encodeSkillPatch } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const patch = Effect.runSync(
 *   decodeSkillPatch({
 *     path: "patches/0001-local-drift.patch",
 *     sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     label: "temporary-drift",
 *     owner: "repo-cli",
 *     dropCondition: "Upstream ships the same fix.",
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillPatch(patch)).label) // "temporary-drift"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillPatch: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillPatch.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillPatch.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillPatch));
/**
 * Decodes an unknown value as a {@link SkillPatches} series.
 *
 * **Example** (Decode a drift-free patch set)
 *
 * ```ts
 * import { decodeSkillPatches } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const patches = Effect.runSync(
 *   decodeSkillPatches({
 *     required: false,
 *     patchSetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     series: [],
 *   })
 * )
 *
 * console.log(patches.series.length) // 0
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillPatches: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillPatches, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillPatches, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillPatches));
/**
 * Encodes a {@link SkillPatches} series back to its wire shape.
 *
 * **Example** (Round-trip a drift-free patch set)
 *
 * ```ts
 * import { decodeSkillPatches, encodeSkillPatches } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const patches = Effect.runSync(
 *   decodeSkillPatches({
 *     required: false,
 *     patchSetHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     series: [],
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillPatches(patches)).required) // false
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillPatches: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillPatches.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillPatches.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillPatches));
/**
 * Decodes an unknown value as a {@link SkillEffective} identity.
 *
 * **Example** (Decode the cross-target effective identity)
 *
 * ```ts
 * import { decodeSkillEffective } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const effective = Effect.runSync(
 *   decodeSkillEffective({
 *     treeHash: digest,
 *     installedTargets: [".claude/skills/shadcn", ".agents/skills/shadcn"],
 *     installedTreeHash: digest,
 *   })
 * )
 *
 * console.log(effective.installedTargets[0]) // ".claude/skills/shadcn"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillEffective: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillEffective, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillEffective, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillEffective));
/**
 * Encodes a {@link SkillEffective} identity back to its wire shape.
 *
 * **Example** (Round-trip the cross-target effective identity)
 *
 * ```ts
 * import { decodeSkillEffective, encodeSkillEffective } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const effective = Effect.runSync(
 *   decodeSkillEffective({
 *     treeHash: digest,
 *     installedTargets: [".claude/skills/shadcn", ".agents/skills/shadcn"],
 *     installedTreeHash: digest,
 *   })
 * )
 *
 * console.log(Effect.runSync(encodeSkillEffective(effective)).installedTargets.length) // 2
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillEffective: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillEffective.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillEffective.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillEffective));
/**
 * Decodes an unknown value as a {@link SkillLockV2Entry}.
 *
 * **Example** (Fail on a partial entry rather than filling in defaults)
 *
 * ```ts
 * import { decodeSkillLockV2Entry } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect, Exit } from "effect"
 *
 * const exit = Effect.runSyncExit(decodeSkillLockV2Entry({ sourceType: "github" }))
 *
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillLockV2Entry: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillLockV2Entry, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillLockV2Entry, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillLockV2Entry));
/**
 * Encodes a {@link SkillLockV2Entry} back to its wire shape.
 *
 * **Example** (Reject a partial entry on the way out)
 *
 * ```ts
 * import { encodeSkillLockV2Entry } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect, Exit } from "effect"
 *
 * const exit = Effect.runSyncExit(encodeSkillLockV2Entry({ sourceType: "github" }))
 *
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillLockV2Entry: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillLockV2Entry.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillLockV2Entry.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillLockV2Entry));
/**
 * Decodes an unknown value as a {@link SkillsLockV2} document.
 *
 * **Example** (Decode a lock that pins no skills yet)
 *
 * ```ts
 * import { decodeSkillsLockV2 } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const lock = Effect.runSync(decodeSkillsLockV2({ version: 2, skills: {} }))
 *
 * console.log(lock.version) // 2
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillsLockV2: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillsLockV2, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillsLockV2, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillsLockV2));
/**
 * Encodes a {@link SkillsLockV2} document back to its wire shape.
 *
 * **Example** (Round-trip a lock that pins no skills yet)
 *
 * ```ts
 * import { decodeSkillsLockV2, encodeSkillsLockV2 } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const lock = Effect.runSync(decodeSkillsLockV2({ version: 2, skills: {} }))
 *
 * console.log(Effect.runSync(encodeSkillsLockV2(lock)).version) // 2
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillsLockV2: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<typeof SkillsLockV2.Encoded, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<typeof SkillsLockV2.Encoded, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillsLockV2));

const SkillsLockV2Json = S.fromJsonString(SkillsLockV2);

/**
 * Decodes a raw `skills-lock.json` string as a {@link SkillsLockV2} document.
 *
 * **Details**
 *
 * JSON parsing and schema validation happen in one step, so a syntactically
 * valid but structurally wrong lock file fails on the same channel as a
 * malformed one.
 *
 * **Example** (Decode a lock file straight from its text)
 *
 * ```ts
 * import { decodeSkillsLockV2Json } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const lock = Effect.runSync(decodeSkillsLockV2Json('{"version":2,"skills":{}}'))
 *
 * console.log(lock.version) // 2
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSkillsLockV2Json: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SkillsLockV2, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SkillsLockV2, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SkillsLockV2Json));
/**
 * Encodes a {@link SkillsLockV2} document as a `skills-lock.json` string.
 *
 * **Gotchas**
 *
 * The result is compact JSON with no trailing newline; writers that need
 * stable on-disk formatting must format it before writing.
 *
 * **Example** (Serialize a lock that pins no skills yet)
 *
 * ```ts
 * import { decodeSkillsLockV2Json, encodeSkillsLockV2Json } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { Effect } from "effect"
 *
 * const lock = Effect.runSync(decodeSkillsLockV2Json('{"version":2,"skills":{}}'))
 *
 * console.log(Effect.runSync(encodeSkillsLockV2Json(lock))) // '{"version":2,"skills":{}}'
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSkillsLockV2Json: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(SkillsLockV2Json));
