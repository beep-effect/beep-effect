import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
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
 * @category vault-sync
 * @since 0.0.0
 */
export class SyncConflict extends Domain.Aggregate("SyncConflict", {
  id: V.DestinationId,
  state: S.HashMap(S.String, C.ConflictRecord),
  initial: H.empty(),
  commands: [C.RecordConflict, C.ReviewConflict, C.ConfirmConflictReview],
  decide: {
    RecordConflict: (s, c, { id }) =>
      c.record.destinationId !== id
        ? SyncRuleViolation.make({ rule: "conflict-scope", evidence: id })
        : H.has(s, c.record.remoteEventId)
          ? []
          : [C.ConflictRecorded.make({ record: { ...c.record, reviewed: false } })],
    ReviewConflict: (s, c) =>
      O.match(H.get(s, c.remoteEventId), {
        onNone: () => SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId }),
        onSome: (record) =>
          record.workspaceId !== c.workspaceId
            ? SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId })
            : record.reviewed
              ? []
              : c.correction !== null &&
                  (c.correction.input.destinationId !== record.destinationId ||
                    c.correction.input.itemId !== record.itemId)
                ? SyncRuleViolation.make({ rule: "correction-scope", evidence: c.remoteEventId })
                : [C.ConflictReviewRequested.make({ record, correction: c.correction })],
      }),
    ConfirmConflictReview: (s, c) =>
      O.match(H.get(s, c.remoteEventId), {
        onNone: () => SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId }),
        onSome: (record) =>
          record.workspaceId !== c.workspaceId
            ? SyncRuleViolation.make({ rule: "conflict-not-found", evidence: c.remoteEventId })
            : record.reviewed
              ? []
              : [C.ConflictReviewed.make({ record: { ...record, reviewed: true } })],
      }),
  },
  evolve: {
    ConflictReviewRequested: (s) => s,
    ConflictRecorded: (s, e) => H.set(s, e.record.remoteEventId, e.record),
    ConflictReviewed: (s, e) => H.set(s, e.record.remoteEventId, e.record),
  },
}) {}
