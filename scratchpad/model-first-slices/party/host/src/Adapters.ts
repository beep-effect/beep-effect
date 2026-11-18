import * as Layer from "effect/Layer";
import { PartyAuthority } from "./Authority.adapter.ts";
import { FixtureContactSource } from "./Evidence/FixtureContactSource.adapter.ts";
import { FixtureReasoner } from "./Review/FixtureReasoner.adapter.ts";
import { PartyReviewRuns } from "./Review/ReviewRuns.adapter.ts";

/**
 * The ports the model declared, implemented, except the directory store:
 * fixtures for the mailbox and the Reasoner, and the authority and runs
 * ports over those contexts' gateways, which the app (or a test) provides.
 * `hostParty` adds the directory store: memory by default, Postgres on the
 * cluster.
 *
 * **Example** (The ports for an Api test)
 * ```ts
 * import { PartyAdapters } from "@proto/party-host/Adapters";
 *
 * const ports = PartyAdapters;
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const PartyAdapters = Layer.mergeAll(
  FixtureContactSource,
  FixtureReasoner,
  PartyAuthority,
  PartyReviewRuns,
);
