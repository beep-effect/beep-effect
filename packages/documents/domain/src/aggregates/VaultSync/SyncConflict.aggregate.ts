/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as C from "./SyncConflict.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";

const sameConflict =
  (scope: Pick<C.ConflictRecord, "workspaceId" | "destinationId" | "remoteEventId">) =>
  (record: C.ConflictRecord): boolean =>
    record.workspaceId === scope.workspaceId &&
    record.destinationId === scope.destinationId &&
    record.remoteEventId === scope.remoteEventId;
const escapesConflictScope =
  (record: C.ConflictRecord) =>
  (correction: { readonly input: Pick<C.ConflictRecord, "destinationId" | "itemId"> }): boolean =>
    correction.input.destinationId !== record.destinationId || correction.input.itemId !== record.itemId;
// QueueOperation refuses an input whose idempotency key is not its target, so such a correction can never queue.
const unreachableCorrection = (correction: {
  readonly operationId: V.OperationId;
  readonly input: { readonly idempotencyKey: V.OperationId };
}): boolean => correction.input.idempotencyKey !== correction.operationId;
const decideOpenConflict = <A>(
  s: C.ConflictRecord | null,
  scope: Pick<C.ConflictRecord, "workspaceId" | "destinationId" | "remoteEventId">,
  onOpen: (record: C.ConflictRecord) => A
): A | SyncRuleViolation | [] =>
  O.match(O.filter(O.fromNullOr(s), sameConflict(scope)), {
    onNone: () => SyncRuleViolation.make({ rule: "conflict-not-found", evidence: scope.remoteEventId }),
    onSome: (record): A | [] => (record.reviewed ? [] : onOpen(record)),
  });
/**
 * SyncConflict vault sync contract.
 *
 * **Example** (Address one aggregate stream)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const ref=V.SyncConflict.ref(V.ConflictId.make("documents_sync_conflict_a1"));
 * console.log(ref.id);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncConflict extends Domain.Aggregate("SyncConflict", {
  id: V.ConflictId,
  state: S.NullOr(C.ConflictRecord),
  initial: null,
  commands: [C.ConfirmConflict, C.ReviewConflict, C.ConfirmConflictReview],
  decide: {
    ConfirmConflict: (s, c, { id }) =>
      id !== c.record.publicId
        ? SyncRuleViolation.make({ rule: "conflict-id", evidence: id })
        : s === null
          ? [C.ConflictRecorded.make({ record: { ...c.record, reviewed: false } })]
          : [],
    ReviewConflict: (s, c) =>
      decideOpenConflict(s, c, (record) =>
        O.exists(O.fromNullOr(c.correction), escapesConflictScope(record))
          ? SyncRuleViolation.make({ rule: "correction-scope", evidence: c.remoteEventId })
          : O.exists(O.fromNullOr(c.correction), unreachableCorrection)
            ? SyncRuleViolation.make({ rule: "correction-key", evidence: c.remoteEventId })
            : [
                C.ConflictReviewRequested.make({
                  record,
                  correction: c.correction,
                  healOperationId: c.healOperationId,
                }),
              ]
      ),
    ConfirmConflictReview: (s, c) =>
      decideOpenConflict(s, c, (record) => [C.ConflictReviewed.make({ record: { ...record, reviewed: true } })]),
  },
  evolve: {
    ConflictReviewRequested: (s) => s,
    ConflictRecorded: (_s, e) => e.record,
    ConflictReviewed: (_s, e) => e.record,
  },
}) {}
