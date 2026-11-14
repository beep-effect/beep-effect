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
 * with the writer it was opened with, or closed, which no writer may append
 * to again. The stream-pin check compares the model's live writers with these.
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
});
/**
 * @category models
 * @since 0.0.0
 */
export type StreamPin = typeof StreamPin.Type;
