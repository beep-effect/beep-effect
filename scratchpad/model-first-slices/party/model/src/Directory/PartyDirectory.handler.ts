import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import { PartyDirectory } from "./PartyDirectory.projection.ts";
import { DirectoryChange, type DirectoryWrite, PartyDirectoryStore } from "./PartyDirectory.store.ts";

/**
 * The directory generation this build writes. Bump it to rebuild the
 * directory: the library replays the history into the new generation
 * (`version`), the store keeps the old generation for queries, and the host
 * switches once the new one has caught up.
 *
 * @category constants
 * @since 0.0.0
 */
export const PartyDirectoryGeneration = 0;

/**
 * The directory projection writing one generation: each batch of party
 * changes in one store round-trip, each change tagged with its source
 * stream and position so the store refuses what it already applied.
 *
 * **Example** (A rebuild's handler)
 * ```ts
 * import { partyDirectoryLive } from "@proto/party-model/Directory/PartyDirectory.handler";
 *
 * const next = partyDirectoryLive(1);
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const partyDirectoryLive = (generation: number) =>
  PartyDirectory.toLayer(
    Effect.gen(function* () {
      const store = yield* PartyDirectoryStore;
      return Effect.fn(function* (batch) {
        yield* pipe(
          A.map(
            batch,
            ({ key, event, envelope }): DirectoryWrite => ({
              stream: envelope.stream,
              seq: envelope.seq,
              change: Match.value(event).pipe(
                Match.tagsExhaustive({
                  PartyRegistered: (registered): DirectoryChange =>
                    DirectoryChange.cases.Registered.make({ partyId: key.id, org: registered.org, name: registered.name }),
                  PartiesMerged: (merged): DirectoryChange =>
                    DirectoryChange.cases.Merged.make({ partyId: key.id, absorbed: merged.absorbed }),
                }),
              ),
            }),
          ),
          store.apply(generation),
        );
      });
    }),
    { batch: { size: 100, wait: "1 second" }, version: generation },
  );

/**
 * The directory projection at this build's generation.
 *
 * @category handlers
 * @since 0.0.0
 */
export const PartyDirectoryLive = partyDirectoryLive(PartyDirectoryGeneration);
