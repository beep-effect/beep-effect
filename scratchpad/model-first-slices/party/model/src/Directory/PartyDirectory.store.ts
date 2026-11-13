import type * as Domain from "@alchemy.run/domain";
import { OrgId } from "@proto/kernel/Ids";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PartyId } from "../Party/Party.id.ts";

/**
 * One party as the directory lists it. Clients read it through `FindParties`.
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryRow = S.Struct({
  partyId: PartyId,
  org: OrgId,
  name: S.String,
  absorbed: S.Array(PartyId),
});
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryRow = typeof DirectoryRow.Type;

/**
 * A change the projection writes. A projection from an aggregate sees only
 * events, never the aggregate's state, so the store applies changes rather
 * than taking whole rows.
 *
 * @category models
 * @since 0.0.0
 */
export const DirectoryChange = S.TaggedUnion({
  Registered: { partyId: PartyId, org: OrgId, name: S.String },
  Merged: { partyId: PartyId, absorbed: PartyId },
});
/**
 * @category models
 * @since 0.0.0
 */
export type DirectoryChange = typeof DirectoryChange.Type;

/**
 * Where the directory lives: a port the model declares. The projection
 * writes through it and `FindParties` reads through it, so a story runs both
 * against memory and a host against a database.
 *
 * @category ports
 * @since 0.0.0
 */
export class PartyDirectoryStore extends Context.Service<
  PartyDirectoryStore,
  {
    /** Apply changes; replaying a change leaves the directory as it was. */
    readonly record: (changes: ReadonlyArray<DirectoryChange>) => Effect.Effect<void>;
    /** One page of an org's parties whose name contains `text`, ordered by party id. */
    readonly search: (
      org: OrgId,
      text: string,
      page: Domain.Query.PageRequest,
    ) => Effect.Effect<Domain.Query.Page<DirectoryRow>>;
  }
>()("Party/PartyDirectoryStore") {}

const byPartyId = Order.mapInput(Order.String, (row: DirectoryRow) => row.partyId);

const apply = (rows: HashMap.HashMap<PartyId, DirectoryRow>, change: DirectoryChange) =>
  DirectoryChange.match(change, {
    Registered: ({ partyId, org, name }) =>
      HashMap.set(rows, partyId, { partyId, org, name, absorbed: [] }),
    Merged: ({ partyId, absorbed }) =>
      HashMap.modify(rows, partyId, (row) =>
        A.contains(row.absorbed, absorbed) ? row : { ...row, absorbed: A.append(row.absorbed, absorbed) },
      ),
  });

/**
 * The directory in memory: the twin stories and Api tests use. A fresh,
 * empty directory each time the Layer is built.
 *
 * **Example** (A story's store)
 * ```ts
 * import { MemoryPartyDirectoryStore } from "@proto/party/Directory/PartyDirectory.store";
 * import { PartyHandlers } from "@proto/party/Handlers";
 * import * as Layer from "effect/Layer";
 *
 * const layer = PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MemoryPartyDirectoryStore = Layer.effect(
  PartyDirectoryStore,
  Effect.gen(function* () {
    const table = yield* Ref.make(HashMap.empty<PartyId, DirectoryRow>());
    return {
      record: (changes) => Ref.update(table, (rows) => A.reduce(changes, rows, apply)),
      search: (org, text, { after, take }) =>
        Effect.map(Ref.get(table), (rows) => {
          const matching = pipe(
            A.fromIterable(HashMap.values(rows)),
            A.filter((row) => row.org === org && pipe(Str.toLowerCase(row.name), Str.includes(Str.toLowerCase(text)))),
            A.sort(byPartyId),
            A.filter((row) => after === undefined || row.partyId > after),
          );
          const entries = A.take(matching, take);
          return {
            entries,
            cursor: matching.length > take ? O.getOrNull(O.map(A.last(entries), (row) => row.partyId)) : null,
          };
        }),
    };
  }),
);
