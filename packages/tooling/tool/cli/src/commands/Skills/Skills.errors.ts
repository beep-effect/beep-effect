/**
 * Tagged errors for the skills command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { messageWithCause } from "@beep/repo-cli-kit/cli/CommandErrorFields";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { SkillFrontmatterIssue } from "./SkillFrontmatter.schemas.ts";
import { SkillPublicationRefusal } from "./SkillsPublication.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/Skills.errors");

const makeSkillsCommandError = (cause: unknown, message: string, file?: string, skill?: string): SkillsCommandError => {
  const fields: {
    cause: unknown;
    file?: string;
    message: string;
    skill?: string;
  } = {
    cause,
    message,
  };
  if (file !== undefined) {
    fields.file = file;
  }
  if (skill !== undefined) {
    fields.skill = skill;
  }
  return SkillsCommandError.make(fields);
};

/**
 * Operational error while reading, fetching, hashing, or writing repo-local skills.
 *
 * **Example** (Make skills command error)
 *
 * ```ts
 * import { SkillsCommandError } from "@beep/repo-cli/commands/Skills"
 *
 * const error = SkillsCommandError.make({ message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class SkillsCommandError extends S.TaggedError<SkillsCommandError, { readonly brand: unique symbol }>(
  $I`SkillsCommandError`
)(
  "SkillsCommandError",
  {
    message: S.String,
    file: S.optionalKey(S.String),
    skill: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<SkillsCommandError>("SkillsCommandError", {
    title: "Skills Command Error",
    description: "Failed to read, fetch, hash, or write repo-local skill configuration.",
  })
) {
  /**
   * Construct a skills command error from an underlying cause.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, file?: string, skill?: string): SkillsCommandError;
    (message: string, file?: string, skill?: string): (cause: unknown) => SkillsCommandError;
  } = dual(
    4,
    (cause: unknown, message: string, file?: string, skill?: string): SkillsCommandError =>
      makeSkillsCommandError(cause, message, file, skill)
  );

  static readonly mapError = Err.mapCauseError<SkillsCommandError, [message: string, file?: string, skill?: string]>(
    (cause, message, file, skill) => makeSkillsCommandError(cause, messageWithCause(message, cause), file, skill)
  );
}

/**
 * Drift detected while running skills update in check mode.
 *
 * **Example** (Make skills drift error)
 *
 * ```ts
 * import { SkillsDriftError } from "@beep/repo-cli/commands/Skills"
 *
 * const error = SkillsDriftError.make({ driftCount: 2, message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class SkillsDriftError extends S.TaggedError<SkillsDriftError, { readonly brand: unique symbol }>(
  $I`SkillsDriftError`
)(
  "SkillsDriftError",
  {
    message: S.String,
    driftCount: S.Finite,
  },
  $I.annoteError<SkillsDriftError>("SkillsDriftError", {
    title: "Skills Drift Error",
    description: "Repo-local skill drift was detected while running in check mode.",
  })
) {
  /**
   * Construct a skills drift error from a drift count and message.
   *
   * @category constructors
   */
  static readonly new: {
    (driftCount: number, message: string): SkillsDriftError;
    (message: string): (driftCount: number) => SkillsDriftError;
  } = dual(
    2,
    (driftCount: number, message: string): SkillsDriftError =>
      SkillsDriftError.make({
        driftCount,
        message,
      })
  );

  static readonly mapError = Err.mapToError<SkillsDriftError, [driftCount: number, message: string]>(
    (driftCount, message) => SkillsDriftError.new(driftCount, message)
  );
}

/**
 * Why an installed skill's targets cannot be hashed.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { SkillInstallStateReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillInstallStateReason.is["missing-target"]("missing-target")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillInstallStateReason = LiteralKit(["missing-target", "divergent-targets"]).pipe(
  $I.annoteSchema("SkillInstallStateReason", {
    description: "A skill install-state problem: a missing target directory or targets whose trees disagree.",
  })
);

/**
 * Why a skill's installed targets cannot back a lock entry.
 *
 * **Example** (Annotate an install-state reason)
 *
 * ```ts
 * import type { SkillInstallStateReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillInstallStateReason = "divergent-targets"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillInstallStateReason = typeof SkillInstallStateReason.Type;

/**
 * A skill's installed targets are missing or disagree with each other.
 *
 * **Details**
 *
 * Kept apart from {@link SkillsCommandError} so the lock-migration plan can
 * report one partially installed skill as `unresolved` instead of aborting
 * the whole plan; every other filesystem failure stays fatal.
 *
 * **Example** (Create an install-state error)
 *
 * ```ts
 * import { SkillInstallStateError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillInstallStateError.make({ skill: "adhd", reason: "missing-target", message: "missing" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillInstallStateError extends S.TaggedError<SkillInstallStateError, { readonly brand: unique symbol }>(
  $I`SkillInstallStateError`
)(
  "SkillInstallStateError",
  {
    skill: S.String,
    reason: SkillInstallStateReason,
    message: S.String,
  },
  $I.annoteError<SkillInstallStateError>("SkillInstallStateError", {
    title: "Skill Install State Error",
    description: "An installed skill's targets are missing or have diverged.",
  })
) {}

/**
 * Why an upstream skill read failed.
 *
 * **Details**
 *
 * `path-absent`: the request succeeded, but the revision has no file under the
 * skill's tree path, or the tracking ref has no commit touching it. A path
 * history walk reads this as "the skill did not exist at that revision".
 * `unavailable`: every other failure (fetch, non-2xx status, decode, truncated
 * tree), which says nothing about the content.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { SkillUpstreamContentErrorReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillUpstreamContentErrorReason.is["path-absent"]("path-absent")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillUpstreamContentErrorReason = LiteralKit(["unavailable", "path-absent"]).pipe(
  $I.annoteSchema("SkillUpstreamContentErrorReason", {
    description: "Whether an upstream skill read failed outright or proved the skill path absent at that revision.",
  })
);

/**
 * Why an upstream skill read failed.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { SkillUpstreamContentErrorReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillUpstreamContentErrorReason = "unavailable"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillUpstreamContentErrorReason = typeof SkillUpstreamContentErrorReason.Type;

/**
 * The pinned, historical, or path-history upstream content of a skill cannot be read.
 *
 * **Details**
 *
 * Raised by the upstream content source for any fetch, response, tree-decode,
 * missing-tree-path, empty-history, or truncated-tree failure; `reason` tells a
 * proven-absent path apart from an unreadable upstream. The lock-migration
 * plan turns it into a per-skill `unresolved` row, so one moved or unreachable
 * upstream never aborts the plan for every other skill.
 *
 * **Example** (Create an upstream-content error)
 *
 * ```ts
 * import { SkillUpstreamContentError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillUpstreamContentError.make({ skill: "oracle", reason: "path-absent", message: "No files found" })
 * console.log(error.reason) // "path-absent"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillUpstreamContentError extends S.TaggedError<
  SkillUpstreamContentError,
  { readonly brand: unique symbol }
>($I`SkillUpstreamContentError`)(
  "SkillUpstreamContentError",
  {
    skill: S.String,
    reason: SkillUpstreamContentErrorReason,
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<SkillUpstreamContentError>("SkillUpstreamContentError", {
    title: "Skill Upstream Content Error",
    description: "A skill's pinned, historical, or path-history upstream content could not be fetched or decoded.",
  })
) {}

/**
 * Why `skills lock-plan --write` refused to write.
 *
 * **Details**
 *
 * `missing-expect`: `--write` ran without `--expect <planDigest>`.
 * `digest-mismatch`: the recomputed plan's digest differs from `--expect`, so
 * upstream, the installed trees, CODEOWNERS, or `skills-lock.json` moved since
 * review. `conflicted-plan`: a row is unresolved for a reason a write cannot
 * settle (a missing or divergent install, or a seeded skill whose provenance
 * or upstream cannot be read). `lock-changed`: `skills-lock.json` changed
 * between planning and the atomic rename.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { SkillsLockWriteRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillsLockWriteRefusalReason.is["digest-mismatch"]("digest-mismatch")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillsLockWriteRefusalReason = LiteralKit([
  "missing-expect",
  "digest-mismatch",
  "conflicted-plan",
  "lock-changed",
]).pipe(
  $I.annoteSchema("SkillsLockWriteRefusalReason", {
    description: "Why a skills-lock write refused: no expected digest, a moved plan, a conflict, or a changed lock.",
  })
);

/**
 * Why `skills lock-plan --write` refused to write.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { SkillsLockWriteRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillsLockWriteRefusalReason = "conflicted-plan"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillsLockWriteRefusalReason = typeof SkillsLockWriteRefusalReason.Type;

/**
 * A reviewed skills-lock write was refused before anything was published.
 *
 * **Details**
 *
 * Raised before the staged lock and patch tree are renamed into place, so a
 * refusal leaves `skills-lock.json` and `.agents/skill-patches` untouched.
 *
 * **Example** (Create a digest-mismatch refusal)
 *
 * ```ts
 * import { SkillsLockWriteRefusal } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillsLockWriteRefusal.make({ reason: "digest-mismatch", message: "Plan moved since review." })
 * console.log(error.reason) // "digest-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillsLockWriteRefusal extends S.TaggedError<SkillsLockWriteRefusal, { readonly brand: unique symbol }>(
  $I`SkillsLockWriteRefusal`
)(
  "SkillsLockWriteRefusal",
  {
    reason: SkillsLockWriteRefusalReason,
    message: S.String,
  },
  $I.annoteError<SkillsLockWriteRefusal>("SkillsLockWriteRefusal", {
    title: "Skills Lock Write Refusal",
    description: "A skills-lock write refused because the reviewed plan no longer matches or cannot be written.",
  })
) {}

/**
 * `skills update` was asked to refetch a vendored skill at its floating ref.
 *
 * **Details**
 *
 * A `vendored` lock entry is pinned to an immutable upstream revision with a
 * patch series replayed on top. A floating refetch would replace it with
 * whatever the tracking ref holds today, so the updater refuses; the entry
 * moves only through a pinned bump (design contract 7, B3).
 *
 * **Example** (Create a refusal for a vendored skill)
 *
 * ```ts
 * import { SkillVendoredRefetchError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillVendoredRefetchError.make({
 *   skill: "shadcn",
 *   sourceRevision: "c257f688cf000000000000000000000000000000",
 *   message: "shadcn is vendored; bump its pin instead.",
 * })
 * console.log(error.skill) // "shadcn"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillVendoredRefetchError extends S.TaggedError<
  SkillVendoredRefetchError,
  { readonly brand: unique symbol }
>($I`SkillVendoredRefetchError`)(
  "SkillVendoredRefetchError",
  {
    skill: S.String,
    sourceRevision: S.String,
    message: S.String,
  },
  $I.annoteError<SkillVendoredRefetchError>("SkillVendoredRefetchError", {
    title: "Skill Vendored Refetch Error",
    description: "A floating refetch of a pinned vendored skill was refused; vendored skills move by pinned bump.",
  })
) {}

/**
 * Repo-authored skills whose `SKILL.md` frontmatter violates the Agent Skills
 * format or the Claude Code extension keys.
 *
 * **Details**
 *
 * Raised in every mode of `beep skills update`, and only for skills this
 * repository authors: the installer cannot rewrite an author's frontmatter, so
 * the fix is to edit the skill (repo extras go under `metadata`). The same
 * finding on a lock-managed upstream mirror is printed as an advisory instead,
 * because editing the mirror would only drift it from its pinned snapshot.
 *
 * **Example** (Build the error from a report)
 *
 * ```ts
 * import { SkillFrontmatterError, SkillFrontmatterIssue } from "@beep/repo-cli/commands/Skills"
 *
 * const error = SkillFrontmatterError.new([
 *   SkillFrontmatterIssue.make({ skill: "yeet", message: "Unexpected key \"version\"" }),
 * ])
 * console.log(error.issues.length) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillFrontmatterError extends S.TaggedError<SkillFrontmatterError, { readonly brand: unique symbol }>(
  $I`SkillFrontmatterError`
)(
  "SkillFrontmatterError",
  {
    message: S.String,
    issues: S.Array(SkillFrontmatterIssue),
  },
  $I.annoteError<SkillFrontmatterError>("SkillFrontmatterError", {
    title: "Skill Frontmatter Error",
    description: "One or more installed skills carry frontmatter outside the Agent Skills format.",
  })
) {
  /**
   * Construct the error from the issues a frontmatter check collected.
   *
   * @param issues - Every frontmatter issue the check found, one per skill.
   * @returns The error carrying those issues and a one-line summary message.
   * @category constructors
   */
  static readonly new = (issues: ReadonlyArray<SkillFrontmatterIssue>): SkillFrontmatterError =>
    SkillFrontmatterError.make({
      issues,
      message: `${issues.length} repo-authored skill frontmatter issue(s); repo extras belong under metadata.`,
    });
}

/**
 * Why a strict unified-diff apply refused a patch.
 *
 * **Details**
 *
 * `malformed-patch`: the text is not a Git unified diff (bad header, hunk
 * range, or body). `unsupported-patch`: a rename, copy, or binary diff, which
 * the skill patch series never carries. `context-mismatch`: a hunk's context
 * or removed lines are not the file's lines at the recorded position; the
 * applier never searches nearby lines or fuzzes. `file-exists` and
 * `file-missing`: a new-file patch over an existing file, or a change to a
 * file that is not there. `mode-mismatch`: the file's mode is not the
 * patch's old mode. `binary-content`: the patched file is not UTF-8 text.
 * `incomplete-delete`: a delete patch leaves lines behind.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { SkillPatchApplyReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillPatchApplyReason.is["context-mismatch"]("context-mismatch")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillPatchApplyReason = LiteralKit([
  "malformed-patch",
  "unsupported-patch",
  "context-mismatch",
  "file-exists",
  "file-missing",
  "mode-mismatch",
  "binary-content",
  "incomplete-delete",
]).pipe(
  $I.annoteSchema("SkillPatchApplyReason", {
    description: "Why a strict unified-diff apply refused a skill patch.",
  })
);

/**
 * Why a strict unified-diff apply refused a patch.
 *
 * **Example** (Annotate an apply reason)
 *
 * ```ts
 * import type { SkillPatchApplyReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillPatchApplyReason = "context-mismatch"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillPatchApplyReason = typeof SkillPatchApplyReason.Type;

/**
 * A skill patch did not apply exactly to the tree it was replayed onto.
 *
 * **Details**
 *
 * Raised before anything is written: the materializer applies the whole
 * series in memory, so a refused patch leaves every installed target as it
 * was. `patch` names the patch file, `file` the skill-relative path the
 * failing section targets (empty for a header-level failure).
 *
 * **Example** (Create a context-mismatch failure)
 *
 * ```ts
 * import { SkillPatchApplyError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillPatchApplyError.make({
 *   patch: ".agents/skill-patches/oracle/0001-skill-md.patch",
 *   file: "SKILL.md",
 *   reason: "context-mismatch",
 *   message: "Hunk 1 does not match SKILL.md at line 1.",
 * })
 * console.log(error.reason) // "context-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillPatchApplyError extends S.TaggedError<SkillPatchApplyError, { readonly brand: unique symbol }>(
  $I`SkillPatchApplyError`
)(
  "SkillPatchApplyError",
  {
    patch: S.String,
    file: S.String,
    reason: SkillPatchApplyReason,
    message: S.String,
  },
  $I.annoteError<SkillPatchApplyError>("SkillPatchApplyError", {
    title: "Skill Patch Apply Error",
    description: "A skill patch did not apply exactly; no fuzz and no offset search are attempted.",
  })
) {}

/**
 * Why `skills materialize` refused to rebuild a vendored skill.
 *
 * **Details**
 *
 * `pristine-mismatch`: the tree loaded at `upstream.sourceRevision` does not
 * hash to the lock's snapshot tree or manifest hash. `patch-digest-mismatch`:
 * a patch file's bytes differ from its recorded sha256, or the series' set
 * hash differs from `patches.patchSetHash`. `effective-mismatch`: the replayed
 * tree does not hash to `effective.treeHash`. `unknown-skill`: `--skill`
 * names no lock entry. `unsafe-target`: an installed target is not a
 * contained repo-relative path. `post-write-divergence`: after publication the
 * targets still disagree with the effective tree.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { SkillMaterializeRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillMaterializeRefusalReason.is["pristine-mismatch"]("pristine-mismatch")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillMaterializeRefusalReason = LiteralKit([
  "pristine-mismatch",
  "patch-digest-mismatch",
  "effective-mismatch",
  "unknown-skill",
  "unsafe-target",
  "post-write-divergence",
]).pipe(
  $I.annoteSchema("SkillMaterializeRefusalReason", {
    description: "Why skills materialize refused: an unverified pristine tree, patch, or reconstruction.",
  })
);

/**
 * Why `skills materialize` refused to rebuild a vendored skill.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { SkillMaterializeRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillMaterializeRefusalReason = "effective-mismatch"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMaterializeRefusalReason = typeof SkillMaterializeRefusalReason.Type;

/**
 * `skills materialize` refused because a verification step failed.
 *
 * **Details**
 *
 * Every verification runs before the first write (B17), so a refusal other
 * than `post-write-divergence` leaves the installed targets untouched.
 *
 * **Example** (Create a pristine-mismatch refusal)
 *
 * ```ts
 * import { SkillMaterializeRefusal } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillMaterializeRefusal.make({
 *   skill: "oracle",
 *   reason: "pristine-mismatch",
 *   message: "The pinned tree does not match the snapshot.",
 * })
 * console.log(error.reason) // "pristine-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillMaterializeRefusal extends S.TaggedError<SkillMaterializeRefusal, { readonly brand: unique symbol }>(
  $I`SkillMaterializeRefusal`
)(
  "SkillMaterializeRefusal",
  {
    skill: S.String,
    reason: SkillMaterializeRefusalReason,
    message: S.String,
  },
  $I.annoteError<SkillMaterializeRefusal>("SkillMaterializeRefusal", {
    title: "Skill Materialize Refusal",
    description: "A vendored skill was not rebuilt because a pristine, patch, or reconstruction check failed.",
  })
) {}

/**
 * Why `skills relock` refused to record new hashes.
 *
 * **Details**
 *
 * `unknown-skill`: the lock has no entry by that name. `not-vendored`: the
 * entry is local, so it has no pin to relock. `replay-conflicted`: at least
 * one hunk of the patch series conflicts at the new pin. `replay-fuzz-only`:
 * no hunk conflicts, but at least one matches only at a shifted position, so
 * the strict applier cannot reproduce a tree (B27). `license-changed`: the
 * license bytes at the new pin no longer hash to the recorded digest.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { SkillRelockRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillRelockRefusalReason.is["replay-conflicted"]("replay-conflicted")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillRelockRefusalReason = LiteralKit([
  "unknown-skill",
  "not-vendored",
  "replay-conflicted",
  "replay-fuzz-only",
  "license-changed",
]).pipe(
  $I.annoteSchema("SkillRelockRefusalReason", {
    description: "Why skills relock refused: no such vendored entry, an unclean replay, or a changed license.",
  })
);

/**
 * Why `skills relock` refused to record new hashes.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { SkillRelockRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillRelockRefusalReason = "license-changed"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillRelockRefusalReason = typeof SkillRelockRefusalReason.Type;

/**
 * `skills relock` refused, and `skills-lock.json` was left untouched.
 *
 * **Details**
 *
 * Every refusal happens before the lock is staged, so a refused relock never
 * leaves a partial lock or a stage file behind. That is what holds a
 * conflicted pin bump for the review ritual (B19): the Renovate branch keeps
 * the old pin's hashes and `materialize --check` stays red until a human
 * decides the conflicted hunks.
 *
 * **Example** (Create a conflict refusal)
 *
 * ```ts
 * import { SkillRelockRefusal } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillRelockRefusal.make({
 *   skill: "oracle",
 *   reason: "replay-conflicted",
 *   message: "1 hunk conflicts at the new pin.",
 * })
 * console.log(error.reason) // "replay-conflicted"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillRelockRefusal extends S.TaggedError<SkillRelockRefusal, { readonly brand: unique symbol }>(
  $I`SkillRelockRefusal`
)(
  "SkillRelockRefusal",
  {
    skill: S.String,
    reason: SkillRelockRefusalReason,
    message: S.String,
  },
  $I.annoteError<SkillRelockRefusal>("SkillRelockRefusal", {
    title: "Skill Relock Refusal",
    description: "A vendored skill's new pin was not recorded because its replay or license check failed.",
  })
) {}

/**
 * Why `skills patch add` or `skills patch label` refused to plan or write.
 *
 * **Details**
 *
 * `unknown-skill`: the lock has no entry by that name. `not-vendored`: the
 * entry is local, so it has no patch series. `missing-target`: an install
 * target of the skill does not exist. `divergent-targets`: the install
 * targets hold different trees, so there is no single hand edit to record.
 * `no-hand-edit`: the installed tree already equals the recorded effective
 * tree. `patch-exists`: a new patch would land on a path that already holds a
 * file. `replay-mismatch`: the extended series does not reproduce the
 * installed tree under the strict applier.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { SkillPatchRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillPatchRefusalReason.is["no-hand-edit"]("no-hand-edit")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillPatchRefusalReason = LiteralKit([
  "unknown-skill",
  "not-vendored",
  "missing-target",
  "divergent-targets",
  "no-hand-edit",
  "patch-exists",
  "replay-mismatch",
]).pipe(
  $I.annoteSchema("SkillPatchRefusalReason", {
    description: "Why a patch-series write refused: no such vendored entry, no single hand edit, or an unsafe write.",
  })
);

/**
 * Why `skills patch add` or `skills patch label` refused to plan or write.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { SkillPatchRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillPatchRefusalReason = "divergent-targets"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillPatchRefusalReason = typeof SkillPatchRefusalReason.Type;

/**
 * `skills patch add` or `skills patch label` refused, and nothing was written.
 *
 * **Details**
 *
 * Every refusal happens before a patch file or the lock is staged, so a
 * refused run leaves `.agents/skill-patches` and `skills-lock.json` byte for
 * byte as they were.
 *
 * **Example** (Create a refusal)
 *
 * ```ts
 * import { SkillPatchRefusal } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillPatchRefusal.make({
 *   skill: "oracle",
 *   reason: "no-hand-edit",
 *   message: "The installed tree already matches the lock.",
 * })
 * console.log(error.reason) // "no-hand-edit"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillPatchRefusal extends S.TaggedError<SkillPatchRefusal, { readonly brand: unique symbol }>(
  $I`SkillPatchRefusal`
)(
  "SkillPatchRefusal",
  {
    skill: S.String,
    reason: SkillPatchRefusalReason,
    message: S.String,
  },
  $I.annoteError<SkillPatchRefusal>("SkillPatchRefusal", {
    title: "Skill Patch Refusal",
    description: "A vendored skill's patch series or labels were not recorded because a precondition failed.",
  })
) {}

/**
 * Why `skills review` refused to record a decision.
 *
 * **Details**
 *
 * `invalid-decision`: the answer does not fit the item (a classification
 * keeps with a label or drops; a conflict takes any decision).
 * `unknown-hunk`: a scripted answer names a hunk identity that no queued
 * item carries. `ambiguous-hunk`: a scripted identity prefix matches more
 * than one queued item.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { SkillReviewRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillReviewRefusalReason.is["unknown-hunk"]("unknown-hunk")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillReviewRefusalReason = LiteralKit(["invalid-decision", "unknown-hunk", "ambiguous-hunk"]).pipe(
  $I.annoteSchema("SkillReviewRefusalReason", {
    description: "Why skills review refused an answer: it does not fit the item or names no single queued hunk.",
  })
);

/**
 * Why `skills review` refused to record a decision.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { SkillReviewRefusalReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillReviewRefusalReason = "ambiguous-hunk"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillReviewRefusalReason = typeof SkillReviewRefusalReason.Type;

/**
 * `skills review` refused an answer; rows recorded before it stay in the ledger.
 *
 * **Details**
 *
 * The ledger is append-only and every decision is checkpointed as it is
 * made, so a refusal mid-session keeps the decisions already recorded and
 * the next session resumes from the first undecided hunk.
 *
 * **Example** (Create a refusal)
 *
 * ```ts
 * import { SkillReviewRefusal } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillReviewRefusal.make({
 *   reason: "invalid-decision",
 *   message: "A classification keep needs a label.",
 * })
 * console.log(error.reason) // "invalid-decision"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillReviewRefusal extends S.TaggedError<SkillReviewRefusal, { readonly brand: unique symbol }>(
  $I`SkillReviewRefusal`
)(
  "SkillReviewRefusal",
  {
    reason: SkillReviewRefusalReason,
    message: S.String,
  },
  $I.annoteError<SkillReviewRefusal>("SkillReviewRefusal", {
    title: "Skill Review Refusal",
    description: "A skills review answer was not recorded because it does not fit a single queued hunk.",
  })
) {}

/**
 * A skill file or directory publication, or its recovery, failed.
 *
 * **Details**
 *
 * `reason` is set when the refusal has a typed cause (see
 * {@link SkillPublicationRefusal}); an I/O failure carries only its message.
 * `journal` names the publication journal once one was written, so the
 * operator can run `beep skills recover` against it. A failure never removes
 * a recovery artifact.
 *
 * **Example** (Create an unsupported-filesystem refusal)
 *
 * ```ts
 * import { SkillPublicationError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillPublicationError.make({
 *   reason: "exchange-unsupported",
 *   target: "/repo/.claude/skills/grill-me",
 *   message: "Atomic exchange unsupported on the target filesystem.",
 * })
 * console.log(error.reason) // "exchange-unsupported"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillPublicationError extends S.TaggedError<SkillPublicationError, { readonly brand: unique symbol }>(
  $I`SkillPublicationError`
)(
  "SkillPublicationError",
  {
    message: S.String,
    reason: S.optionalKey(SkillPublicationRefusal),
    target: S.optionalKey(S.String),
    journal: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<SkillPublicationError>("SkillPublicationError", {
    title: "Skill Publication Error",
    description: "A skill file or directory publication, or its recovery, failed and kept its artifacts.",
  })
) {
  static readonly mapError = Err.mapCauseError<SkillPublicationError, [message: string, target?: string]>(
    (cause, message, target) =>
      SkillPublicationError.make({
        cause,
        message: messageWithCause(message, cause),
        ...O.getSomesStruct({ target: O.fromUndefinedOr(target) }),
      })
  );
}
