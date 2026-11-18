// Temporary negative probe: a handler that requires a service the model never declared.
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ClaimReviewLive } from "../src/Claim/ClaimReview.view.live.ts";
import { FindPartiesLive } from "../src/Directory/FindParties.query.live.ts";
import { PartyDirectoryLive } from "../src/Directory/PartyDirectory.projection.live.ts";
import type { Host, PartyPorts } from "../src/Handlers.ts";
import { PartyModel } from "../src/Party.model.ts";
import { EffectivePartyLive } from "../src/Party/EffectiveParty.view.live.ts";
import { MergeOnSameParty } from "../src/Party/MergeOnSameParty.policy.ts";
import { ReviewAssistLive } from "../src/Review/ReviewAssist.saga.live.ts";
import { ReviewOnAssertionLive } from "../src/Review/ReviewOnAssertion.policy.live.ts";

class Mailer extends Context.Service<Mailer, { readonly send: (to: string) => Effect.Effect<void> }>()("Probe/Mailer") {}

const LeakyMergeLive = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const mailer = yield* Mailer;
    return () => mailer.send("ops");
  }),
);

const Leaky = PartyModel.layer(
  Layer.mergeAll(ClaimReviewLive, EffectivePartyLive, LeakyMergeLive, ReviewOnAssertionLive, ReviewAssistLive, PartyDirectoryLive, FindPartiesLive),
);
type Leaked = Exclude<Layer.Services<typeof Leaky>, PartyPorts | Host>;
export const purity: [Leaked] extends [never] ? true : Leaked = true;
export const satisfiesForm = Leaky satisfies Layer.Layer<never, unknown, PartyPorts | Host>;
export const sketchForm = Leaky satisfies Layer.Layer<any, any, PartyPorts | Host>;
