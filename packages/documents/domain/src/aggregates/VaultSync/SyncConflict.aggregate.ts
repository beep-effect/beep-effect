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
/**
 * SyncConflict vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SyncConflict } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncConflict;
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
      O.match(O.fromNullOr(s), {
        onNone: () => SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId }),
        onSome: (record) =>
          record.workspaceId !== c.workspaceId ||
          record.destinationId !== c.destinationId ||
          record.remoteEventId !== c.remoteEventId
            ? SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId })
            : record.reviewed
              ? []
              : c.correction !== null &&
                  (c.correction.input.destinationId !== record.destinationId ||
                    c.correction.input.itemId !== record.itemId)
                ? SyncRuleViolation.make({ rule: "correction-scope", evidence: c.remoteEventId })
                : [
                    C.ConflictReviewRequested.make({
                      record,
                      correction: c.correction,
                      healOperationId: c.healOperationId,
                    }),
                  ],
      }),
    ConfirmConflictReview: (s, c) =>
      O.match(O.fromNullOr(s), {
        onNone: () => SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId }),
        onSome: (record) =>
          record.workspaceId !== c.workspaceId ||
          record.destinationId !== c.destinationId ||
          record.remoteEventId !== c.remoteEventId
            ? SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId })
            : record.reviewed
              ? []
              : [C.ConflictReviewed.make({ record: { ...record, reviewed: true } })],
      }),
  },
  evolve: {
    ConflictReviewRequested: (s) => s,
    ConflictRecorded: (_s, e) => e.record,
    ConflictReviewed: (_s, e) => e.record,
  },
}) {}
