import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as S from "effect/Schema";
import { DestinationState } from "./SyncDestination.command.ts";
import { SyncDestinationSnapshot } from "./SyncDestinationSnapshot.view.ts";
import * as V from "./Values.ts";
/**
 * DestinationList pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { DestinationList } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationList.definition;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class DestinationList extends Domain.View("DestinationList", {
  from: [SyncDestinationSnapshot],
  key: V.OrgKey,
  state: S.HashMap(V.DestinationId, DestinationState),
  initial: H.empty(),
  keyOf: {
    SyncDestinationSnapshot: ({ state }) =>
      state?._tag === "Registered" ? V.OrgKey.make(`${state.orgId}`) : undefined,
  },
  evolve: { SyncDestinationSnapshot: (s, _e, { source, state }) => (state === null ? s : H.set(s, source.id, state)) },
}) {}
