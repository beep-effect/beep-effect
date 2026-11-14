import * as S from "effect/Schema";

/**
 * The writer a published stream generation was opened with: the projection
 * that appends to it, that projection's generation (its own version plus the
 * versions of the views it reads), and the sources it reads, by name.
 *
 * **Details**
 *
 * The library refuses appends whose positions fall at or before the last one
 * a stream stored, so a writer that is rebuilt (its generation changes) or
 * reads different sources (its input positions mean something else) cannot
 * keep writing the same stream (D43). It writes a new generation instead.
 *
 * **Example** (The writer of Party's facts, generation 2)
 * ```ts
 * import { StreamWriter } from "@proto/kernel/PublishedStream";
 *
 * const writer = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamWriter = S.Struct({
  projection: S.String,
  generation: S.Int,
  sources: S.Array(S.String),
});
/**
 * @category models
 * @since 0.0.0
 */
export type StreamWriter = typeof StreamWriter.Type;

/**
 * A published stream generation, pinned in the model that writes it: open,
 * with the writer it was opened with; closed, which no writer may append to
 * again and the feed still serves; or retired, which the feed no longer
 * serves. The stream-pin check compares the model's live writers with these.
 *
 * **Details**
 *
 * A retired generation keeps its pin, with the number of positions it held,
 * so the feed places later generations where they were: a checkpoint keeps
 * its meaning. Retiring is a pin change the retirement check approves
 * against the live host (D51): the next generation holds every fact it held,
 * every consumer has read past it, and the fact versions still consumed are
 * still published (D34). The pins list one feed's generations in order.
 *
 * **Example** (Party's two generations)
 * ```ts
 * import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
 *
 * const pins = [
 *   StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
 *   StreamPin.cases.Open.make({
 *     stream: "PartyFacts2",
 *     writer: StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim"] }),
 *   }),
 * ];
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamPin = S.TaggedUnion({
  Open: { stream: S.String, writer: StreamWriter },
  Closed: { stream: S.String },
  Retired: { stream: S.String, length: S.Int },
});
/**
 * @category models
 * @since 0.0.0
 */
export type StreamPin = typeof StreamPin.Type;

/**
 * One entry of a published generation, as the live host holds it: its
 * position in the generation (the stream entry's `seq`), the fact id, the
 * fact version and the payload as that version encodes it.
 *
 * @category models
 * @since 0.0.0
 */
export const GenerationEntry = S.Struct({ position: S.Int, factId: S.String, version: S.Int, payload: S.Unknown });
/**
 * @category models
 * @since 0.0.0
 */
export type GenerationEntry = typeof GenerationEntry.Type;

/**
 * A generation's entries, read from the live host.
 *
 * @category models
 * @since 0.0.0
 */
export const LiveGeneration = S.Struct({ stream: S.String, entries: S.Array(GenerationEntry) });
/**
 * @category models
 * @since 0.0.0
 */
export type LiveGeneration = typeof LiveGeneration.Type;
