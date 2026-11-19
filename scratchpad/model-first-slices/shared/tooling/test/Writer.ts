import { Count, Name, Sequence } from "@proto/kernel/Measure";
import { StreamWriter } from "@proto/kernel/PublishedStream";
import * as A from "@beep/utils/Array";
import * as Eq from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as S from "effect/Schema";

// The writers of published stream generations, as the stream-pin, handover and retirement laws
// generate them.

/** A writer as a model declares it: a projection, its generation and the sources it reads. */
export const Writer = S.Struct({ projection: Name, generation: Count, sources: S.Array(Name) });
export type Writer = typeof Writer.Type;

/** The writer, reading each of its sources once, as a model lists them. */
export const writerOf = (writer: Writer): StreamWriter => StreamWriter.make({ ...writer, sources: A.dedupe(writer.sources) });

/** The writer with its sources listed in another order: the same writer. */
export const reordered = (writer: Writer): StreamWriter => {
  const listed = writerOf(writer);
  return { ...listed, sources: A.reverse(listed.sources) };
};

/** How one writer differs from another: its projection, its generation, or a source one reads that the other does not. */
const Change = S.Literals(["projection", "generation", "added", "removed"]);

/** A writer and one change to it: `extra` names what the change adds, `bump` how far a generation moves. */
export const Changed = S.Struct({ writer: Writer, change: Change, extra: Name, bump: Sequence });
export type Changed = typeof Changed.Type;

/** The writer before the change and after it, never the same writer. */
export const changedOf = ({ writer, change, extra, bump }: Changed): { readonly before: StreamWriter; readonly after: StreamWriter } => {
  const base = writerOf(writer);
  // Longer than every source the writer reads, so not one of them.
  const withFresh = { ...base, sources: A.append(base.sources, `${A.join(base.sources, "")}${extra}`) };
  return Match.value(change).pipe(
    Match.when("projection", () => ({ before: base, after: { ...base, projection: `${base.projection}${extra}` } })),
    Match.when("generation", () => ({ before: base, after: { ...base, generation: base.generation + bump } })),
    Match.when("added", () => ({ before: base, after: withFresh })),
    Match.when("removed", () => ({ before: withFresh, after: base })),
    Match.exhaustive,
  );
};

/** Two source lists picked from the same three names, each name read once, so they often read the same set in another order. */
export const Listings = S.Struct({ writer: Writer, names: S.Tuple([Name, Name, Name]), before: S.Array(Count), after: S.Array(Count) });
export type Listings = typeof Listings.Type;

/** The two writers the listings give, and whether they read the same set of sources. */
export const listedOf = ({ writer, names, before, after }: Listings) => {
  const sourcesOf = (picks: ReadonlyArray<number>) => A.dedupe(A.map(picks, (pick) => names[pick % names.length] ?? names[0]));
  const first = StreamWriter.make({ ...writer, sources: sourcesOf(before) });
  const second = StreamWriter.make({ ...writer, sources: sourcesOf(after) });
  const setOf = (listed: StreamWriter) => HashSet.fromIterable(listed.sources);
  return { before: first, after: second, sameSources: Eq.equals(setOf(first), setOf(second)) };
};
