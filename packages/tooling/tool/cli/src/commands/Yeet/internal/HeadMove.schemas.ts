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
