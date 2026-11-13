import { orgOf } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import * as Effect from "effect/Effect";
import { FindParties } from "./FindParties.query.ts";
import { PartyDirectoryStore } from "./PartyDirectory.store.ts";

/**
 * Scopes the search to the caller's org, then reads the page, so a page
 * holds only rows the caller may see.
 *
 * @category handlers
 * @since 0.0.0
 */
export const FindPartiesLive = FindParties.toLayer(
  Effect.gen(function* () {
    const store = yield* PartyDirectoryStore;
    return Effect.fn(function* ({ text }, page) {
      const actor = yield* CurrentActor;
      return yield* store.search(orgOf(actor), text, page);
    });
  }),
  { take: { default: 50, max: 200 } },
);
