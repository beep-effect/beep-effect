/**
 * Evidence models for conservative GitHub head-rewrite classification.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Yeet/internal/HeadMove.schemas");

/**
 * Why a head move cannot carry rewrite proof.
 *
 * **Details**
 *
 * `not-base-merge` and `merge-conflict` refuse a base merge: the new head is
 * not one two-parent merge on top of the old head, or the automatic merge of
 * the base conflicts. A base merge also refuses with `base-mismatch` (the
 * merged commit is not on the synchronized base), `replay-tree` (the pushed
 * tree is not the clean merge) and `patch` (the pull request's own patch
 * changed).
 *
 * **Example** (YeetHeadMoveChange evidence)
 *
 * ```ts
 * import { YeetHeadMoveChange } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetHeadMoveChange.is.patch("patch")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetHeadMoveChange = LiteralKit([
  "lane-push",
  "not-github-rewrite",
  "base-mismatch",
  "commit-count",
  "merge-commit",
  "empty-range",
  "patch",
  "metadata",
  "old-base-not-absorbed",
  "replay-tree",
  "not-base-merge",
  "merge-conflict",
]).pipe($I.annoteSchema("YeetHeadMoveChange", { description: "The failed invariant of a head rewrite." }));
/** The failed rewrite invariant. @category type-level @since 0.0.0 */
export type YeetHeadMoveChange = typeof YeetHeadMoveChange.Type;

/**
 * Pinned old head, new head and synchronized base to classify.
 *
 * **Example** (YeetHeadMoveRequest evidence)
 *
 * ```ts
 * import { YeetHeadMoveRequest } from "@beep/repo-cli/test/Yeet"
 * const request = YeetHeadMoveRequest.make({ before: "b", after: "a", base: "s" })
 * console.log(request.base) // "s"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadMoveRequest extends S.Opaque<YeetHeadMoveRequest, { readonly brand: unique symbol }>()(
  S.Struct({ before: S.NonEmptyString, after: S.NonEmptyString, base: S.NonEmptyString }).pipe(
    $I.annoteSchema("YeetHeadMoveRequest", {
      description: "Pinned old head, new head and synchronized base to classify.",
    })
  )
) {}

/**
 * A proven GitHub replay with identical non-empty commits.
 *
 * **Example** (YeetHeadMoveUnchanged evidence)
 *
 * ```ts
 * import { YeetHeadMoveUnchanged } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetHeadMoveUnchanged.make({ before: "b", after: "a", base: "s", commits: 1 }).commits) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadMoveUnchanged extends S.Opaque<YeetHeadMoveUnchanged, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unchanged", {
    before: S.NonEmptyString,
    after: S.NonEmptyString,
    base: S.NonEmptyString,
    commits: S.Int.check(S.isGreaterThan(0)),
  }).pipe(
    $I.annoteSchema("YeetHeadMoveUnchanged", {
      description: "A proven GitHub replay with identical non-empty commits.",
    })
  )
) {}

/**
 * A head move that fails a rewrite invariant.
 *
 * **Example** (YeetHeadMoveChanged evidence)
 *
 * ```ts
 * import { YeetHeadMoveChanged } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetHeadMoveChanged.make({ before: "b", after: "a", base: "s", change: "patch", detail: "x" }).change) // "patch"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadMoveChanged extends S.Opaque<YeetHeadMoveChanged, { readonly brand: unique symbol }>()(
  S.TaggedStruct("changed", {
    before: S.NonEmptyString,
    after: S.NonEmptyString,
    base: S.NonEmptyString,
    change: YeetHeadMoveChange,
    detail: S.NonEmptyString,
  }).pipe($I.annoteSchema("YeetHeadMoveChanged", { description: "A head move that fails a rewrite invariant." }))
) {}

/**
 * Unreadable evidence that must never carry proof.
 *
 * **Example** (YeetHeadMoveUnknown evidence)
 *
 * ```ts
 * import { YeetHeadMoveUnknown } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetHeadMoveUnknown.make({ before: "b", after: "a", reason: "missing object" })._tag) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHeadMoveUnknown extends S.Opaque<YeetHeadMoveUnknown, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unknown", { before: S.NonEmptyString, after: S.NonEmptyString, reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("YeetHeadMoveUnknown", { description: "Unreadable evidence that must never carry proof." })
  )
) {}

/**
 * Exhaustive verdict for a head move.
 *
 * **Example** (YeetHeadMove evidence)
 *
 * ```ts
 * import { YeetHeadMove } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetHeadMove.guards.unknown({ _tag: "unknown", before: "b", after: "a", reason: "missing" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YeetHeadMove = S.Union([YeetHeadMoveUnchanged, YeetHeadMoveChanged, YeetHeadMoveUnknown]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("YeetHeadMove", { description: "Proof, refusal or unreadable evidence for a head move." })
);
/** The exhaustive head-move verdict. @category type-level @since 0.0.0 */
export type YeetHeadMove = typeof YeetHeadMove.Type;

/**
 * A proven merge of the synchronized base that leaves the pull request's own
 * patch unchanged.
 *
 * **Details**
 *
 * `after` is one two-parent commit whose first parent is `before` and whose
 * second parent, `merged`, is on `base`; its tree is the clean automatic merge,
 * and the patch against the base has the same identity before and after.
 *
 * **Example** (YeetBaseMergeUnchanged evidence)
 *
 * ```ts
 * import { YeetBaseMergeUnchanged } from "@beep/repo-cli/test/Yeet"
 * const proof = YeetBaseMergeUnchanged.make({ before: "b", after: "h", base: "s", merged: "m" })
 * console.log(proof.merged) // "m"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetBaseMergeUnchanged extends S.Opaque<YeetBaseMergeUnchanged, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unchanged", {
    before: S.NonEmptyString,
    after: S.NonEmptyString,
    base: S.NonEmptyString,
    merged: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("YeetBaseMergeUnchanged", {
      description: "A proven clean merge of the synchronized base that leaves the pull request's patch unchanged.",
    })
  )
) {}

/**
 * Exhaustive verdict for a push that merges the base into the pull request.
 *
 * **Details**
 *
 * The refusal and unknown members are the head-move ones, so an unreadable
 * base merge never carries, exactly as an unreadable rewrite does not.
 *
 * **Example** (YeetBaseMerge evidence)
 *
 * ```ts
 * import { YeetBaseMerge } from "@beep/repo-cli/test/Yeet"
 * console.log(YeetBaseMerge.guards.unknown({ _tag: "unknown", before: "b", after: "h", reason: "shallow" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YeetBaseMerge = S.Union([YeetBaseMergeUnchanged, YeetHeadMoveChanged, YeetHeadMoveUnknown]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("YeetBaseMerge", { description: "Proof, refusal or unreadable evidence for a base merge." })
);
/** The exhaustive base-merge verdict. @category type-level @since 0.0.0 */
export type YeetBaseMerge = typeof YeetBaseMerge.Type;
