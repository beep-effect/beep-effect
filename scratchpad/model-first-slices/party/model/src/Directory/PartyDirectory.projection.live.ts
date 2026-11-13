import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import { PartyDirectory } from "./PartyDirectory.projection.ts";
import { DirectoryChange, PartyDirectoryStore } from "./PartyDirectory.store.ts";

/**
 * Writes each batch of party changes in one store round-trip.
 *
 * @category handlers
 * @since 0.0.0
 */
export const PartyDirectoryLive = PartyDirectory.toLayer(
  Effect.gen(function* () {
    const store = yield* PartyDirectoryStore;
    return Effect.fn(function* (batch) {
      yield* store.record(
        A.map(batch, ({ key, event }) =>
          Match.value(event).pipe(
            Match.tagsExhaustive({
              PartyRegistered: (registered): DirectoryChange =>
                DirectoryChange.cases.Registered.make({
                  partyId: key.id,
                  org: registered.by.org,
                  name: registered.name,
                }),
              PartiesMerged: (merged): DirectoryChange =>
                DirectoryChange.cases.Merged.make({ partyId: key.id, absorbed: merged.absorbed }),
            }),
          ),
        ),
      );
    });
  }),
  { batch: { size: 100, wait: "1 second" } },
);
