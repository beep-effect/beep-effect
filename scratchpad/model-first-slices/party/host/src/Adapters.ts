import { MemoryPartyDirectoryStore } from "@proto/party/Directory/PartyDirectory.store";
import * as Layer from "effect/Layer";
import { FixtureContactSource } from "./Evidence/FixtureContactSource.adapter.ts";
import { FixtureReasoner } from "./Review/FixtureReasoner.adapter.ts";

/**
 * Every port the model declared, implemented. Fixtures here; a production
 * host swaps in vendor and database adapters and nothing else changes.
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
export const PartyAdapters = Layer.mergeAll(FixtureContactSource, FixtureReasoner, MemoryPartyDirectoryStore);
