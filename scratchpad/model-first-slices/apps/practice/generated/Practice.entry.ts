// Generated from the composed deployment descriptors by scripts/entries.ts. Do not edit:
// `bun run entries` rewrites it, and `bun run entries --check` fails on drift.
import * as DomainCluster from "@alchemy.run/domain/EffectCluster";
import * as Layer from "effect/Layer";
import { AuthorityCluster } from "@proto/authority-host/Authority.cluster";
import { ConformanceCluster } from "@proto/conformance/Conformance.cluster";
import { PartyCluster } from "@proto/party-host/Party.cluster";
import { RunsCluster } from "@proto/runs-host/Runs.cluster";
import { Default } from "../src/Cluster.ts";

/** The pool's platform: every composed context's entities, under one entity. */
export const platform = DomainCluster.layerEntities({
  name: "Practice",
  main: import.meta.url,
  handler: "PracticeLive",
  pool: Default,
});

/** Each context's cluster wiring, over the one platform. */
export const authority = AuthorityCluster(platform);
export const party = PartyCluster(platform);
export const runs = RunsCluster(platform);
export const conformance = ConformanceCluster(platform);

/** Each part, given the parts it uses. */
export const AuthorityGateway = authority.parts.AuthorityGateway;
export const Session = authority.parts.Session;
export const Conformance = conformance.parts.Conformance;
export const RunsGateway = runs.parts.RunsGateway.pipe(Layer.provide(Layer.mergeAll(AuthorityGateway)));
export const PartyFactsFeed = party.parts.PartyFactsFeed.pipe(Layer.provide(Layer.mergeAll(AuthorityGateway, RunsGateway)));
export const ClaimDecidedInbox = runs.parts.ClaimDecidedInbox.pipe(Layer.provide(Layer.mergeAll(AuthorityGateway, PartyFactsFeed)));

/** What every runner of the pool builds: every part, and so every context's model. */
export const PracticeLive = Layer.mergeAll(AuthorityGateway, Session, Conformance, RunsGateway, PartyFactsFeed, ClaimDecidedInbox);

export default PracticeLive;
