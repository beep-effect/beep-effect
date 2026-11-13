import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import * as Layer from "effect/Layer";
import { PartyAuthority } from "./Authority.adapter.ts";
import { FixtureContactSource } from "./Evidence/FixtureContactSource.adapter.ts";
import { FixtureReasoner } from "./Review/FixtureReasoner.adapter.ts";
import { PartyReviewRuns } from "./Review/ReviewRuns.adapter.ts";

/**
 * Every port the model declared, implemented. Fixtures for the mailbox and
 * the Reasoner, memory for the directory, and the authority and runs ports
 * over those contexts' gateways, which the app (or a test) provides.
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
  MemoryPartyDirectoryStore,
  PartyAuthority,
  PartyReviewRuns,
);
