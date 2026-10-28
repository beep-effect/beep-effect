/**
 * Schemas for the final-check refresh rule: a passing receipt on an ancestor
 * head R still covers a later head F when, outside what `main` brought in, the
 * lane's own changes between R and F touch only tool-regenerated standards
 * inventories and goal-packet files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { FinalCheckReceipt } from "./FinalCheck.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/FinalCheckRefresh.schemas");

/**
 * Why a lane-owned path may change after the receipt without a new final-check.
 *
 * **Details**
 *
 * `standards-inventory` covers the tool-regenerated inventories a main merge
 * forces a lane to re-run (`--write`); `goal-packet` covers the packet files a
 * lane flips as its work lands (`SPEC.md`, `PLAN.md`, `README.md`,
 * `ops/manifest.json`, reuse ledgers). Neither changes code, tests or config.
 *
 * **Example** (List the allowances)
 *
 * ```ts
 * import { FinalCheckRefreshAllowance } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FinalCheckRefreshAllowance.literals) // ["standards-inventory", "goal-packet"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FinalCheckRefreshAllowance = LiteralKit(["standards-inventory", "goal-packet"]).pipe(
  $I.annoteSchema("FinalCheckRefreshAllowance", {
    description: "Why a lane-owned path may change after a final-check receipt without a new run.",
  })
);

/**
 * Why a lane-owned path may change after the receipt without a new final-check.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FinalCheckRefreshAllowance = typeof FinalCheckRefreshAllowance.Type;

/**
 * Why the refresh rule refused a later head.
 *
 * **Details**
 *
 * `own-change-outside-allowlist`: the lane changed code, tests or config after
 * the receipt. `effect-vitest-status-drift`: the lane's net change to the
 * effect-vitest inventory status counts differs between R and F, the
 * take-main-then-`--write` hazard that silently reopens or closes findings.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { FinalCheckRefreshRefusalReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FinalCheckRefreshRefusalReason.is["effect-vitest-status-drift"]("effect-vitest-status-drift")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FinalCheckRefreshRefusalReason = LiteralKit([
  "own-change-outside-allowlist",
  "effect-vitest-status-drift",
]).pipe(
  $I.annoteSchema("FinalCheckRefreshRefusalReason", {
    description: "Why the final-check refresh rule refused to carry a receipt to a later head.",
  })
);

/**
 * Why the refresh rule refused a later head.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FinalCheckRefreshRefusalReason = typeof FinalCheckRefreshRefusalReason.Type;

/**
 * A path the lane itself changed between the receipt head and the final head,
 * with the allowance that admits it, if any.
 *
 * **Example** (An admitted inventory change)
 *
 * ```ts
 * import { FinalCheckRefreshOwnChange } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const change = FinalCheckRefreshOwnChange.make({
 *   path: "standards/schema-first.inventory.jsonc",
 *   allowance: O.some("standards-inventory"),
 * })
 * console.log(O.isSome(change.allowance)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckRefreshOwnChange extends S.Opaque<
  FinalCheckRefreshOwnChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: S.NonEmptyString,
    allowance: S.Option(FinalCheckRefreshAllowance),
  }).pipe(
    $I.annoteSchema("FinalCheckRefreshOwnChange", {
      description: "A lane-owned path changed after the final-check receipt, with the allowance that admits it.",
    })
  )
) {}

/**
 * One effect-vitest finding status whose lane-owned count changed between the
 * receipt head and the final head.
 *
 * **Details**
 *
 * `atReceipt` is the count at R minus the count at R's merge base with `main`;
 * `atFinal` is the same difference for F. Equal values mean the lane's net
 * contribution to that status survived the main merge unchanged.
 *
 * **Example** (A finding reopened by a re-run)
 *
 * ```ts
 * import { FinalCheckStatusDrift } from "@beep/repo-cli/test/Yeet"
 *
 * const drift = FinalCheckStatusDrift.make({ status: "open", atReceipt: 0, atFinal: 1 })
 * console.log(drift.atFinal - drift.atReceipt) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckStatusDrift extends S.Opaque<FinalCheckStatusDrift, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.NonEmptyString,
    atReceipt: S.Finite,
    atFinal: S.Finite,
  }).pipe(
    $I.annoteSchema("FinalCheckStatusDrift", {
      description:
        "An effect-vitest status whose lane-owned count differs between the receipt head and the final head.",
    })
  )
) {}

/**
 * What git says about a receipt head R and a final head F, read once and then
 * judged by the pure refresh decision.
 *
 * **Details**
 *
 * `ownChanges` lists every path in `git diff R F` that main did not bring in:
 * a path absent from `git diff MBR MBF`, or present there with a different
 * lane patch (`MBR..R` against `MBF..F`). `effectVitestStatusDrift` is
 * empty when the effect-vitest inventory is not an own change or its lane
 * status counts held. `effectVitestUnreadable` names a revision whose
 * inventory could not be decoded, which fails closed.
 *
 * **Example** (Facts for an inventory-only refresh)
 *
 * ```ts
 * import { FinalCheckReceipt, FinalCheckRefreshFacts } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const facts = FinalCheckRefreshFacts.make({
 *   receipt: FinalCheckReceipt.make({
 *     schemaVersion: "yeet-final-check/v1", headSha: "r".repeat(40), mergeBase: "m".repeat(40), base: "origin/main",
 *     complete: true, verdict: "pass", startedAt: "2026-10-28T00:00:00.000Z",
 *     finishedAt: "2026-10-28T00:40:00.000Z", steps: [], expectationRewrites: [],
 *   }),
 *   finalHead: "f".repeat(40),
 *   ownChanges: ["standards/schema-first.inventory.jsonc"],
 *   effectVitestStatusDrift: [],
 *   effectVitestUnreadable: O.none(),
 * })
 * console.log(facts.ownChanges.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckRefreshFacts extends S.Opaque<FinalCheckRefreshFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    receipt: FinalCheckReceipt,
    finalHead: S.NonEmptyString,
    ownChanges: S.Array(S.NonEmptyString),
    effectVitestStatusDrift: S.Array(FinalCheckStatusDrift),
    effectVitestUnreadable: S.Option(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("FinalCheckRefreshFacts", {
      description: "Git facts about a receipt head and a later final head, judged by the final-check refresh rule.",
    })
  )
) {}

/**
 * The receipt on R carries to F: every lane-owned change since R is allowed.
 *
 * **Example** (A passing refresh verdict)
 *
 * ```ts
 * import { FinalCheckReceipt, FinalCheckRefreshPass } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = FinalCheckRefreshPass.make({
 *   receipt: FinalCheckReceipt.make({
 *     schemaVersion: "yeet-final-check/v1", headSha: "r".repeat(40), mergeBase: "m".repeat(40), base: "origin/main",
 *     complete: true, verdict: "pass", startedAt: "2026-10-28T00:00:00.000Z",
 *     finishedAt: "2026-10-28T00:40:00.000Z", steps: [], expectationRewrites: [],
 *   }),
 *   finalHead: "f".repeat(40),
 *   ownChanges: [],
 * })
 * console.log(verdict._tag) // "pass"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckRefreshPass extends S.Opaque<FinalCheckRefreshPass, { readonly brand: unique symbol }>()(
  S.TaggedStruct("pass", {
    receipt: FinalCheckReceipt,
    finalHead: S.NonEmptyString,
    ownChanges: S.Array(FinalCheckRefreshOwnChange),
  }).pipe(
    $I.annoteSchema("FinalCheckRefreshPass", {
      description: "The final-check receipt on an ancestor head carries to the final head.",
    })
  )
) {}

/**
 * The receipt on R does not carry to F; a full final-check on F is required.
 *
 * **Example** (A refused refresh verdict)
 *
 * ```ts
 * import { FinalCheckRefreshRefused } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = FinalCheckRefreshRefused.make({
 *   receiptHead: "r".repeat(40),
 *   finalHead: "f".repeat(40),
 *   reason: "own-change-outside-allowlist",
 *   ownChanges: [],
 *   detail: "the lane changed src/index.ts after the receipt",
 * })
 * console.log(verdict._tag) // "refused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckRefreshRefused extends S.Opaque<FinalCheckRefreshRefused, { readonly brand: unique symbol }>()(
  S.TaggedStruct("refused", {
    receiptHead: S.NonEmptyString,
    finalHead: S.NonEmptyString,
    reason: FinalCheckRefreshRefusalReason,
    ownChanges: S.Array(FinalCheckRefreshOwnChange),
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("FinalCheckRefreshRefused", {
      description: "The final-check receipt on an ancestor head does not carry to the final head.",
    })
  )
) {}

/**
 * The refresh rule's verdict for one receipt head and final head.
 *
 * **Example** (Decode a refused verdict)
 *
 * ```ts
 * import { FinalCheckRefreshVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const verdict = S.decodeUnknownSync(FinalCheckRefreshVerdict)({
 *   _tag: "refused", receiptHead: "r", finalHead: "f", reason: "own-change-outside-allowlist",
 *   ownChanges: [], detail: "code changed",
 * })
 * console.log(verdict._tag) // "refused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FinalCheckRefreshVerdict = S.Union([FinalCheckRefreshPass, FinalCheckRefreshRefused]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("FinalCheckRefreshVerdict", {
    description: "Pass or refused verdict of the final-check refresh rule.",
  })
);

/**
 * The refresh rule's verdict for one receipt head and final head.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FinalCheckRefreshVerdict = typeof FinalCheckRefreshVerdict.Type;
