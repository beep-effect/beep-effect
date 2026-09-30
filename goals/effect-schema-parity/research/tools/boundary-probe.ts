// P3 gate evidence for goals/effect-schema-parity (SPEC "Boundary Table").
//
// For every group D and E concept, encodes representative values with today's
// `@beep/schema` codec and with each candidate upstream codec, then compares
// the `JSON.stringify` output byte for byte. A thrown decode or encode is
// recorded as its full issue message, so rejections compare by message too.
// Deterministic, no network; the Timezone row reads the runtime's IANA data, so
// it is only as stable as the Bun/ICU build that runs it.
//
// Run from the repo root: bun run goals/effect-schema-parity/research/tools/boundary-probe.ts
// Pinned evidence: this probe compares the retired @beep/schema group D and E concepts with
// their upstream replacements, so it only resolves at commit 45d0490d22 (PR #1334), before
// those concepts were deleted. Check that commit out in a scratch worktree to re-run it.
import { Timezones } from "@beep/data";
import { ArrayBuf } from "@beep/schema/ArrayBuffer";
import * as ArrayOf from "@beep/schema/ArrayOf";
import { Bytes } from "@beep/schema/Bytes";
import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid";
import { DurationUnit } from "@beep/schema/Duration";
import { DirectedGraph } from "@beep/schema/Graph";
import { HashSet as StoredHashSet } from "@beep/schema/HashSet";
import { MutableHashMap as BeepMutableHashMap } from "@beep/schema/MutableHashMap";
import { MutableHashSet as BeepMutableHashSet } from "@beep/schema/MutableHashSet";
import { RegExpFromStr } from "@beep/schema/RegExp";
import { EpochMillis, ISOStr, Timestamp } from "@beep/schema/Timestamp";
import { Timezone } from "@beep/schema/Timezone";
import { DateTime, Effect, Graph, HashSet, MutableHashMap, MutableHashSet, SchemaTransformation } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

type Probe = {
  readonly concept: string;
  readonly candidate: string;
  readonly identical: number;
  readonly total: number;
  readonly firstDiff: string;
};

const rows: Array<Probe> = [];

const render = (thunk: () => unknown): string => {
  try {
    return JSON.stringify(thunk()) ?? "undefined";
  } catch (error) {
    return `throws: ${P.isError(error) ? error.message.replaceAll("\n", " / ") : String(error)}`;
  }
};

const probe = <V>(
  concept: string,
  candidate: string,
  values: ReadonlyArray<V>,
  today: (value: V) => unknown,
  upstream: (value: V) => unknown
): void => {
  const pairs = A.map(values, (value) => [render(() => today(value)), render(() => upstream(value))] as const);
  const diff = A.findFirst(pairs, ([left, right]) => left !== right);
  rows.push({
    concept,
    candidate,
    identical: A.filter(pairs, ([left, right]) => left === right).length,
    total: pairs.length,
    firstDiff: O.match(diff, { onNone: () => "", onSome: ([left, right]) => `today ${left} vs upstream ${right}` }),
  });
};

// Stored bytes -> decode -> encode, i.e. what a rewrite of an existing row or file would emit.
const roundTrip =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): E =>
    S.encodeSync(schema)(S.decodeUnknownSync(schema)(input));

// --- Group D ---------------------------------------------------------------

const isoInputs = [
  "2026-09-29T12:34:56.789Z",
  "2026-09-29T12:34:56.000Z",
  "2026-09-29T12:34:56Z",
  "2026-09-29T12:34:56.7Z",
  "2026-09-29T12:34:56.123456Z",
  "2026-09-29T12:34:56+00:00",
  "2026-09-29T14:34:56+02:00",
  "2026-09-29",
  " 2026-09-29T12:34:56.789Z ",
  "",
  "   ",
  "not a date",
];
// The composition carries ISOStr's two annotations that change observable output: the
// NonEmptyTrimmedStr message and the arbitrary pattern (Timestamp.schema.ts, String.ts).
const isoArbitraryPattern =
  "^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|1\\d|2[0-8])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{3}Z$";
const isoParses = (value: string): boolean => O.isSome(DateTime.make(value));
const IsoDateTimeString = S.Trim.check(
  S.isNonEmpty({ message: "String must not be empty" }),
  S.makeFilter(isoParses, { arbitraryConstraint: { patterns: [{ source: isoArbitraryPattern, flags: "" }] } })
);
const IsoWithoutMessage = S.Trim.check(S.isNonEmpty(), S.makeFilter(isoParses));
probe(
  "Timestamp (ISOStr field)",
  "S.Trim + isNonEmpty message + DateTime.make check with the pattern (string stays)",
  isoInputs,
  roundTrip(ISOStr),
  roundTrip(IsoDateTimeString)
);
probe(
  "Timestamp (ISOStr field)",
  "same composition without the isNonEmpty message",
  isoInputs,
  roundTrip(ISOStr),
  roundTrip(IsoWithoutMessage)
);
probe(
  "Timestamp (ISOStr arbitrary)",
  "seeded samples from the composition",
  [1, 7, 42],
  (seed) => Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(ISOStr), { seed, count: 10 })),
  (seed) => Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(IsoDateTimeString), { seed, count: 10 }))
);
probe(
  "Timestamp (ISOStr field)",
  "S.DateTimeUtcFromString",
  isoInputs,
  roundTrip(ISOStr),
  roundTrip(S.DateTimeUtcFromString)
);
const writerInstants = [0, 1_790_000_000_000, 1_790_000_000_789, -86_400_000];
probe(
  "Timestamp (ISOStr writers)",
  "S.DateTimeUtcFromString on formatIso output",
  writerInstants,
  (ms) => S.encodeSync(ISOStr)(ISOStr.make(DateTime.formatIso(DateTime.makeUnsafe(ms)))),
  (ms) => S.encodeSync(S.DateTimeUtcFromString)(DateTime.makeUnsafe(ms))
);
probe(
  "Timestamp (class, no consumer)",
  "S.DateTimeUtcFromMillis",
  [0, 1_790_000_000_789],
  (ms) => S.encodeSync(Timestamp)(Timestamp.make({ epochMillis: EpochMillis.make(ms) })),
  (ms) => S.encodeSync(S.DateTimeUtcFromMillis)(DateTime.makeUnsafe(ms))
);

// Consumer-local composition over S.DateTimeUtcFromString that keeps the tagged ISO transport.
const TaggedIsoUtc = S.TaggedStruct("string", { value: S.DateTimeUtcFromString }).pipe(
  S.decodeTo(
    S.DateTimeUtc,
    SchemaTransformation.transform({
      decode: (tagged) => tagged.value,
      encode: (value) => ({ _tag: "string" as const, value }),
    })
  )
);
const utcInstants = A.map([0, 1_790_000_000_000, 1_790_000_000_789, -86_400_000], (ms) => DateTime.makeUnsafe(ms));
probe(
  "DateTimeUtcFromValid",
  "TaggedStruct('string', { value: S.DateTimeUtcFromString }) -> S.DateTimeUtc",
  utcInstants,
  S.encodeSync(DateTimeUtcFromValid),
  S.encodeSync(TaggedIsoUtc)
);
probe(
  "DateTimeUtcFromValid (read stored)",
  "same composition decoding today's tagged ISO bytes",
  A.map(utcInstants, (utc) => S.encodeSync(DateTimeUtcFromValid)(utc)),
  (stored) => DateTime.toEpochMillis(S.decodeUnknownSync(DateTimeUtcFromValid)(stored)),
  (stored) => DateTime.toEpochMillis(S.decodeUnknownSync(TaggedIsoUtc)(stored))
);

const durationInputs = ["2 minutes", "15 minutes", "5 hours", "1.5 seconds", "100 millis", "1 week"];
const DurationExpression = S.TemplateLiteral([S.Finite, " ", DurationUnit]);
probe(
  "Duration (Graft timeout field)",
  "TemplateLiteral over S.Literals of Duration.Unit (string stays)",
  durationInputs,
  roundTrip(DurationExpression),
  roundTrip(S.TemplateLiteral([S.Finite, " ", S.Literals(DurationUnit.literals)]))
);
probe(
  "Duration (Graft timeout field)",
  "S.DurationFromString",
  durationInputs,
  roundTrip(DurationExpression),
  roundTrip(S.DurationFromString)
);

probe(
  "Timezone",
  "S.TimeZoneNamedFromString",
  Timezones.TimezoneNameValues,
  roundTrip(Timezone),
  roundTrip(S.TimeZoneNamedFromString)
);

// --- Group E ---------------------------------------------------------------

const byteSamples = [A.empty<number>(), [0, 1, 2, 254, 255], A.map(A.range(0, 63), (n) => (n * 37) % 256)];
probe(
  "ArrayBuffer",
  "S.Uint8ArrayFromBase64",
  byteSamples,
  (bytes) => S.encodeSync(S.toCodecJson(ArrayBuf))(new Uint8Array(bytes).buffer),
  (bytes) => S.encodeSync(S.Uint8ArrayFromBase64)(new Uint8Array(bytes))
);
probe(
  "ArrayBuffer",
  "S.toCodecJson(S.Uint8Array)",
  byteSamples,
  (bytes) => S.encodeSync(S.toCodecJson(ArrayBuf))(new Uint8Array(bytes).buffer),
  (bytes) => S.encodeSync(S.toCodecJson(S.Uint8Array))(new Uint8Array(bytes))
);
probe(
  "Bytes",
  "S.toCodecJson(S.Uint8Array)",
  byteSamples,
  (bytes) => S.encodeSync(S.toCodecJson(Bytes))(Bytes.make(new Uint8Array(bytes))),
  (bytes) => S.encodeSync(S.toCodecJson(S.Uint8Array))(new Uint8Array(bytes))
);

const strings = [A.empty<string>(), ["a"], ["a", "b", "c"]];
const nonEmptyStrings = [["a"], ["a", "b", "c"]];
const numbers = [A.empty<number>(), [0, 1.5, -2]];
const ints = [A.empty<number>(), [0, 1, -2]];
probe("ArrayOf", "S.Array(S.String)", strings, roundTrip(ArrayOf.ArrayOfStrings), roundTrip(S.Array(S.String)));
probe(
  "ArrayOf",
  "S.NonEmptyArray(S.String)",
  nonEmptyStrings,
  roundTrip(ArrayOf.NonEmptyArrayOfStrings),
  roundTrip(S.NonEmptyArray(S.String))
);
probe(
  "ArrayOf",
  "S.Array(S.NonEmptyString)",
  strings,
  roundTrip(ArrayOf.ArrayOfNonEmptyStrings),
  roundTrip(S.Array(S.NonEmptyString))
);
probe(
  "ArrayOf",
  "S.NonEmptyArray(S.NonEmptyString)",
  nonEmptyStrings,
  roundTrip(ArrayOf.NonEmptyArrayOfNonEmptyStrings),
  roundTrip(S.NonEmptyArray(S.NonEmptyString))
);
probe("ArrayOf", "S.Array(S.Finite)", numbers, roundTrip(ArrayOf.ArrayOfNumbers), roundTrip(S.Array(S.Finite)));
probe(
  "ArrayOf",
  "S.NonEmptyArray(S.Finite)",
  [[0, 1.5, -2]],
  roundTrip(ArrayOf.NonEmptyArrayOfNumbers),
  roundTrip(S.NonEmptyArray(S.Finite))
);
probe("ArrayOf", "S.Array(S.Int)", ints, roundTrip(ArrayOf.ArrayOfInts), roundTrip(S.Array(S.Int)));
probe(
  "ArrayOf",
  "S.NonEmptyArray(S.Int)",
  [[0, 1, -2]],
  roundTrip(ArrayOf.NonEmptyArrayOfInts),
  roundTrip(S.NonEmptyArray(S.Int))
);

const Kind = S.Literals(["individual", "organization", "government", "court"]);
type Kind = typeof Kind.Type;
const kindLists: ReadonlyArray<ReadonlyArray<Kind>> = [
  [],
  ["individual"],
  ["organization", "individual", "court"],
  ["court", "government", "organization", "individual"],
];
const sets = A.map(kindLists, (kinds) => HashSet.fromIterable(kinds));
probe(
  "HashSet (law-practice jsonb)",
  "S.toCodecJson(S.HashSet(Item))",
  sets,
  S.encodeSync(StoredHashSet(Kind)),
  S.encodeSync(S.toCodecJson(S.HashSet(Kind)))
);
probe(
  "HashSet (law-practice jsonb)",
  "S.HashSet(Item) without toCodecJson",
  sets,
  S.encodeSync(StoredHashSet(Kind)),
  S.encodeSync(S.HashSet(Kind))
);
probe(
  "HashSet (read stored)",
  "S.toCodecJson(S.HashSet(Item)) decoding today's arrays",
  A.map(sets, (set) => S.encodeSync(StoredHashSet(Kind))(set)),
  (stored) => A.fromIterable(S.decodeUnknownSync(StoredHashSet(Kind))(stored)),
  (stored) => A.fromIterable(S.decodeUnknownSync(S.toCodecJson(S.HashSet(Kind)))(stored))
);
// Three of the four stored fields keep a non-empty check (ActFrame.values.ts, LegalRole.model.ts,
// LegalOppositionCandidateInput.model.ts); the check moves onto the upstream composition unchanged.
const NonEmptyKinds = S.makeFilter((kinds: HashSet.HashSet<Kind>) => !HashSet.isEmpty(kinds), {
  message: "Expected at least one kind.",
});
probe(
  "HashSet (checked field, read stored)",
  "S.toCodecJson(S.HashSet(Item)).check(existing filter)",
  A.map(sets, (set) => S.encodeSync(StoredHashSet(Kind))(set)),
  (stored) => A.fromIterable(S.decodeUnknownSync(StoredHashSet(Kind).check(NonEmptyKinds))(stored)),
  (stored) => A.fromIterable(S.decodeUnknownSync(S.toCodecJson(S.HashSet(Kind)).check(NonEmptyKinds))(stored))
);
probe(
  "HashSet (jsonb column carrier)",
  "encoded AST tag of the field schema",
  [Kind],
  (item) => S.toEncoded(StoredHashSet(item).check(NonEmptyKinds)).ast._tag,
  (item) => S.toEncoded(S.toCodecJson(S.HashSet(item)).check(NonEmptyKinds)).ast._tag
);

const Entries = S.Array(S.Tuple([S.String, S.Number]));
const maps = A.map(
  [
    [["a", 1]],
    [
      ["b", 2],
      ["a", 1],
      ["c", 3],
    ],
  ] as const,
  (entries) => MutableHashMap.fromIterable(entries)
);
probe(
  "MutableHashMap",
  "S.Array(S.Tuple([K, V])) over Array.from(map)",
  maps,
  S.encodeSync(BeepMutableHashMap({ key: S.String, value: S.Number })),
  (map) => S.encodeSync(Entries)(A.fromIterable(map))
);
const mutableSets = A.map([["a"], ["b", "a", "c"]], MutableHashSet.fromIterable);
probe(
  "MutableHashSet",
  "S.Array(Item) over Array.from(set)",
  mutableSets,
  S.encodeSync(BeepMutableHashSet(S.String)),
  (set) => S.encodeSync(S.Array(S.String))(A.fromIterable(set))
);

const graph = Graph.directed<string, number>((mutable) => {
  const a = Graph.addNode(mutable, "a");
  const b = Graph.addNode(mutable, "b");
  Graph.addEdge(mutable, a, b, 1);
});
probe(
  "Graph",
  "S.toCodecJson(S.Graph('directed', N, E))",
  [graph],
  S.encodeSync(DirectedGraph({ node: S.String, edge: S.Number })),
  S.encodeSync(S.toCodecJson(S.Graph("directed", S.String, S.Number)))
);

const patterns = ["a+b", "^\\d{3}$", "([^\\s]|\\r\\n|\\n|\\r|,)", "a/b"];
const RegExpFromSource = S.String.pipe(
  S.decodeTo(
    S.RegExp,
    SchemaTransformation.transform({ decode: (source) => new RegExp(source), encode: (regexp) => regexp.source })
  )
);
const regexpShape = (regexp: RegExp): string => `/${regexp.source}/${regexp.flags}`;
probe(
  "RegExp (decode)",
  "string -> S.RegExp composition",
  patterns,
  (source) => regexpShape(S.decodeUnknownSync(RegExpFromStr)(source)),
  (source) => regexpShape(S.decodeUnknownSync(RegExpFromSource)(source))
);
probe(
  "RegExp (encode)",
  "string -> S.RegExp composition",
  patterns,
  roundTrip(RegExpFromStr),
  roundTrip(RegExpFromSource)
);
probe(
  "RegExp (encode)",
  "S.toCodecJson(S.RegExp)",
  patterns,
  (source) => source,
  (source) => S.encodeSync(S.toCodecJson(S.RegExp))(new RegExp(source))
);

const lines = [
  "| Concept | Candidate upstream codec | Identical / total | First difference |",
  "| --- | --- | ---: | --- |",
  ...A.map(
    rows,
    (row) =>
      `| ${row.concept} | \`${row.candidate}\` | ${row.identical} / ${row.total} | ${row.firstDiff.replaceAll("|", "\\|")} |`
  ),
];
process.stdout.write(`${A.join(lines, "\n")}\n`);
