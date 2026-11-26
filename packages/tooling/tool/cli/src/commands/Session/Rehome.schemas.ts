/**
 * Schemas for `session rehome`: the per-store plan that moves a checkout's
 * session history from one repository partition to another.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CheckoutRepository } from "../../internal/state/WorkstationState.ts";

const $I = $RepoCliId.create("commands/Session/Rehome.schemas");

const RowCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("SessionRehomeRowCount", { description: "A non-negative number of JSON Lines rows." })
);

/**
 * The per-repository session stores `session rehome` copies.
 *
 * **Example** (List the stores)
 *
 * ```ts
 * import { SessionStoreName } from "@beep/repo-cli/test/Session"
 *
 * console.log(SessionStoreName.literals) // ["ledger", "presence", "register", "rulings"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionStoreName = LiteralKit(["ledger", "presence", "register", "rulings"]).pipe(
  $I.annoteSchema("SessionStoreName", { description: "A per-repository session store under the beep state root." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SessionStoreName = typeof SessionStoreName.Type;

/**
 * What a rehome moves and whether it writes.
 *
 * **Example** (Ask for a dry run)
 *
 * ```ts
 * import { CheckoutRepository, SessionRehomeRequest } from "@beep/repo-cli/test/Session"
 *
 * const request = SessionRehomeRequest.make({
 *   from: CheckoutRepository.make({ host: "github.com", owner: "o", name: "r" }),
 *   to: CheckoutRepository.make({ host: "gitlab.example.com", owner: "o", name: "r" }),
 *   apply: false,
 * })
 * console.log(request.apply) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionRehomeRequest extends S.Opaque<SessionRehomeRequest, { readonly brand: unique symbol }>()(
  S.Struct({ from: CheckoutRepository, to: CheckoutRepository, apply: S.Boolean }).pipe(
    $I.annoteSchema("SessionRehomeRequest", {
      description: "The repository partitions a session rehome copies between, and whether it writes.",
    })
  )
) {}

/**
 * One store's part of a rehome: the source file and its decodable row count,
 * the target file and its existing row count, and how many rewritten rows the
 * target does not already hold.
 *
 * **Example** (Describe a ledger move)
 *
 * ```ts
 * import { SessionRehomeStorePlan } from "@beep/repo-cli/test/Session"
 *
 * const plan = SessionRehomeStorePlan.make({
 *   store: "ledger",
 *   sourceFile: "/state/sessions/github.com__o__r.jsonl",
 *   sourceRows: 3,
 *   targetFile: "/state/sessions/gitlab.example.com__o__r.jsonl",
 *   targetRows: 0,
 *   newRows: 3,
 * })
 * console.log(plan.newRows) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionRehomeStorePlan extends S.Opaque<SessionRehomeStorePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    store: SessionStoreName,
    sourceFile: S.String,
    sourceRows: RowCount,
    targetFile: S.String,
    targetRows: RowCount,
    newRows: RowCount,
  }).pipe(
    $I.annoteSchema("SessionRehomeStorePlan", {
      description: "One session store's source and target partition files and the rows a rehome copies.",
    })
  )
) {}

/**
 * The outcome of `session rehome`: both repositories, whether rows were
 * written, and one plan per store.
 *
 * **Example** (A dry run)
 *
 * ```ts
 * import { CheckoutRepository, SessionRehomeReport } from "@beep/repo-cli/test/Session"
 *
 * const report = SessionRehomeReport.make({
 *   from: CheckoutRepository.make({ host: "github.com", owner: "o", name: "r" }),
 *   to: CheckoutRepository.make({ host: "gitlab.example.com", owner: "o", name: "r" }),
 *   applied: false,
 *   stores: [],
 * })
 * console.log(report.applied) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionRehomeReport extends S.Opaque<SessionRehomeReport, { readonly brand: unique symbol }>()(
  S.Struct({
    from: CheckoutRepository,
    to: CheckoutRepository,
    applied: S.Boolean,
    stores: S.Array(SessionRehomeStorePlan),
  }).pipe(
    $I.annoteSchema("SessionRehomeReport", {
      description: "A session rehome between two repository partitions, dry run or applied.",
    })
  )
) {}
