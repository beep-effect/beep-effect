import * as A from "@beep/utils/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { Count, Name, Sequence } from "./Measure.ts";

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
  projection: Name,
  generation: Count,
  sources: S.UniqueArray(Name),
});
/**
 * @category models
 * @since 0.0.0
 */
export type StreamWriter = typeof StreamWriter.Type;

/**
 * Whether two writers are the same writer: the same projection at the same
 * generation, reading the same sources in any order.
 *
 * **Example** (Source order does not matter)
 * ```ts
 * import { sameWriter, StreamWriter } from "@proto/kernel/PublishedStream";
 *
 * const pinned = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Claim", "Party"] });
 * const live = StreamWriter.make({ projection: "ClaimDecisions", generation: 0, sources: ["Party", "Claim"] });
 *
 * const same = sameWriter(pinned, live);
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const sameWriter: {
  (that: StreamWriter): (self: StreamWriter) => boolean;
  (self: StreamWriter, that: StreamWriter): boolean;
} = dual(
  2,
  (self: StreamWriter, that: StreamWriter): boolean =>
    self.projection === that.projection &&
    self.generation === that.generation &&
    A.every(self.sources, (source) => A.contains(that.sources, source)) &&
    A.every(that.sources, (source) => A.contains(self.sources, source)),
);

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
  Open: { stream: Name, writer: StreamWriter },
  Closed: { stream: Name },
  Retired: { stream: Name, length: Count },
});
/**
 * @category models
 * @since 0.0.0
 */
export type StreamPin = typeof StreamPin.Type;

/**
 * One feed's pins, its generations in order. A stream is pinned once: the
 * checks read the first pin of a name, so a second one would never be read.
 *
 * **Example** (A model's pins)
 * ```ts
 * import { StreamPin, StreamPins } from "@proto/kernel/PublishedStream";
 *
 * const pins = StreamPins.make([
 *   StreamPin.cases.Closed.make({ stream: "PartyFacts" }),
 *   StreamPin.cases.Retired.make({ stream: "PartyFacts0", length: 12 }),
 * ]);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamPins = S.Array(StreamPin).check(
  S.makeFilter((pins) => A.length(A.dedupeWith(pins, (a, b) => a.stream === b.stream)) === A.length(pins), {
    identifier: "OnePinPerStreamCheck",
    title: "One pin per stream",
    description: "No two pins name the same stream.",
    message: "Expected each stream to be pinned once",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type StreamPins = typeof StreamPins.Type;

/**
 * One entry of a published generation, as the live host holds it: its
 * position in the generation (the stream entry's `seq`), the fact id, the
 * fact version and the payload as that version encodes it.
 *
 * @category models
 * @since 0.0.0
 */
export const GenerationEntry = S.Struct({ position: Sequence, factId: S.String, version: Sequence, payload: S.Unknown });
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
export const LiveGeneration = S.Struct({ stream: Name, entries: S.Array(GenerationEntry) });
/**
 * @category models
 * @since 0.0.0
 */
export type LiveGeneration = typeof LiveGeneration.Type;
