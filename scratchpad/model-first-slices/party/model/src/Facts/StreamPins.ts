import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";

/**
 * Party's published stream generations, pinned (D43, phase 9). Generation 1
 * (`PartyFacts`) is closed: its writer read the `ClaimReview` view and was
 * retired. Generation 2 (`PartyFacts2`) is open, written by `ClaimDecisions`
 * at generation 0 from the claim's own events.
 *
 * **Details**
 *
 * Changing the publisher (a version bump, a view it reads bumped, a source
 * added or removed) means pinning the current generation closed and opening
 * the next one here, with the new stream in the model and the feed. The
 * stream-pin test fails until this file and the model agree.
 *
 * **Example** (Reading the open generation)
 * ```ts
 * import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
 * import * as A from "effect/Array";
 *
 * const open = A.filter(partyStreamPins, (pin) => pin._tag === "Open");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const partyStreamPins: ReadonlyArray<StreamPin> = [
  StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
  StreamPin.cases.Open.make({
    stream: "PartyFacts2",
    writer: StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] }),
  }),
];
