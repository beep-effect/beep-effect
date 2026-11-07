/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as S from "effect/Schema";
import * as C from "./SyncConflict.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ConflictEventRegistry vault sync contract.
 *
 * **Example** (Address one aggregate stream)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const ref=V.ConflictEventRegistry.ref(V.DestinationId.make("vault"));
 * console.log(ref.id);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ConflictEventRegistry extends Domain.Aggregate("ConflictEventRegistry", {
  id: V.DestinationId,
  state: S.HashMap(S.String, C.ConflictRecord),
  initial: H.empty(),
  commands: [C.RecordConflict],
  decide: {
    RecordConflict: (s, c, { id }) =>
      c.record.destinationId !== id
        ? SyncRuleViolation.make({ rule: "conflict-scope", evidence: id })
        : H.has(s, c.record.remoteEventId)
          ? []
          : [C.ConflictEventReserved.make({ record: c.record })],
  },
  evolve: { ConflictEventReserved: (s, e) => H.set(s, e.record.remoteEventId, e.record) },
}) {}
