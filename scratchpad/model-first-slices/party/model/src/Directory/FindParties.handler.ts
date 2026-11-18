import { ResourceScope } from "@proto/kernel/Capability";
import { requireGrant } from "@proto/kernel/CurrentInvocation.context";
import { PartyRead } from "@proto/party-contract/Party.capabilities";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { FindParties } from "./FindParties.query.ts";
import { PartyDirectoryStore } from "./PartyDirectory.store.ts";

/**
 * Refuses an org the invocation holds no `party.read` grant on, then reads
 * the page, so a page holds only rows the caller may see. The span carries
 * the org, never the search text, which may hold a person's name; a cursor
 * the store did not issue is refused with `InvalidCursor`.
 *
 * @category handlers
 * @since 0.0.0
 */
export const FindPartiesLive = FindParties.toLayer(
  Effect.gen(function* () {
    const store = yield* PartyDirectoryStore;
    return Effect.fn(function* ({ org, text }, page) {
      yield* Effect.annotateCurrentSpan("org", org);
      const now = yield* DateTime.now;
      yield* requireGrant(PartyRead, FindParties.queryName, ResourceScope.cases.Org.make({ org }), now);
      return yield* store.search(org, text, page);
    });
  }),
  { take: { default: 50, max: 200 } },
);
