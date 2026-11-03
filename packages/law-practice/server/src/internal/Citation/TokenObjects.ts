/** Native source token objects adapted from eyecite 2.7.6 models.py.
 * BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as Equivalence from "effect/Equivalence";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Tuple from "effect/Tuple";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationAssemblyView, CitationTokenAssemblyFailure } from "./TokenAssembly.ts";
import { makeCitationTokenEditions } from "./TokenEditions.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenObjects");
const Kind = LiteralKit([
  "Token",
  "CitationToken",
  "SectionToken",
  "SupraToken",
  "IdToken",
  "ParagraphToken",
  "StopWordToken",
  "PlaceholderCitationToken",
  "CaseReferenceToken",
]);
const Position = S.Int.check(
  S.isBetween({
    minimum: -CitationEngineAbsoluteMaxima.producedTextUtf16,
    maximum: CitationEngineAbsoluteMaxima.producedTextUtf16,
  })
);
const Native = S.NullOr(
  CitationPythonUnicodeStorage.pipe(
    S.overrideToEquivalence(() => Equivalence.Struct({ width: Equivalence.Number, bytes: Bytes.Equivalence }))
  )
);
const Groups = S.Record(S.String.check(S.isMaxLength(256)), Native);
const Editions = S.Array(S.Natural).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates));
/** Normalized constructor fields. The match/extra adapter supplies these fields;
 * this is private state, not the public semantic citation or a request codec.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenSeed extends S.Opaque<CitationTokenSeed, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: Kind,
    data: Native,
    start: Position,
    end: Position,
    groups: Groups,
    exact: Editions,
    variation: Editions,
    short: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationTokenSeed", {
      description:
        "Owned native source token fields; absent/null group keys and literal surrogate words stay distinct.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationTokenConstruction extends S.Opaque<CitationTokenConstruction, { readonly brand: unique symbol }>()(
  S.Struct({ seed: CitationTokenSeed, offset: Position }).pipe(
    $I.annoteSchema("CitationTokenConstruction", {
      description: "Complete owned first-capture fields and source offset, ready for atomic publication.",
    })
  )
) {}
const Seed = S.toType(CitationTokenSeed);
const sameGroups = S.toEquivalence(Groups);
const failure = () => CitationTokenAssemblyFailure.make({ reason: "host-failed" });
const safety = (limit: "candidates" | "producedTextUtf16") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const copyNative = (value: typeof Native.Type) =>
  value === null ? null : CitationPythonUnicodeStorage.make({ width: value.width, bytes: Bytes.concat([value.bytes]) });
const copySeed = (seed: CitationTokenSeed) =>
  CitationTokenSeed.make({
    ...seed,
    data: copyNative(seed.data),
    groups: R.map(seed.groups, copyNative),
    exact: A.map(seed.exact, (id) => id),
    variation: A.map(seed.variation, (id) => id),
  });
const compatible = (a: CitationTokenSeed, b: CitationTokenSeed) =>
  a.start === b.start && a.end === b.end && a.kind === b.kind && sameGroups(a.groups, b.groups);
const nativeBytes = (value: typeof Native.Type) => (value === null ? 0 : value.bytes.length);

/** Immutable native token data/groups plus source-mutated edition lists.
 * Effect HashMap owns local identities and Semaphore serializes compound
 * merges. The frozen edition adapter owns source set iteration; no new
 * collection/hash implementation is introduced. All methods capture R = never.
 * Arbitrary subclass protocols and external field mutation remain open.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenObjects = Effect.fn("Citation.makeTokenObjects")(function* (
  policy: unknown,
  editionBindings: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, failure);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode(limits);
  const editions = yield* makeCitationTokenEditions(limits, editionBindings);
  const mutex = yield* Semaphore.make(1);
  let rows = HashMap.empty<number, CitationTokenSeed>();
  let produced = 0;
  const lookup = Effect.fn("Citation.lookupToken")((id: number) =>
    Effect.fromOption(HashMap.get(rows, id)).pipe(Effect.mapError(failure))
  );
  const ownNative = Effect.fn("Citation.ownTokenNative")(function* (input: typeof Native.Type) {
    if (input === null) return { value: null, units: 0 };
    const result = yield* unicode.fromStorage(input).pipe(Effect.mapError(failure));
    return { value: result.storage, units: result.utf16Units };
  });
  const create = Effect.fn("Citation.createToken")(function* (input: unknown) {
    if (HashMap.size(rows) >= limits.candidates) return yield* safety("candidates");
    const raw = yield* S.decodeUnknownEffect(Seed)(input).pipe(Effect.mapError(failure));
    if (R.size(raw.groups) > 10 || raw.exact.length + raw.variation.length > limits.candidates) return yield* failure();
    const bytes = nativeBytes(raw.data) + A.reduce(R.values(raw.groups), 0, (sum, value) => sum + nativeBytes(value));
    if (bytes > 4 * (limits.producedTextUtf16 - produced)) return yield* safety("producedTextUtf16");
    const owned = copySeed(raw);
    let units = 0;
    const own = Effect.fn("Citation.ownTokenField")(function* (input: typeof Native.Type) {
      const result = yield* ownNative(input);
      units += result.units;
      if (units > limits.producedTextUtf16 - produced) return yield* safety("producedTextUtf16");
      return result.value;
    });
    const data = yield* own(owned.data);
    const groups = yield* Effect.forEach(
      R.toEntries(owned.groups),
      ([key, value]) => own(value).pipe(Effect.map((owned) => Tuple.make(key, owned))),
      { concurrency: 1 }
    );
    const id = HashMap.size(rows);
    rows = HashMap.set(rows, id, CitationTokenSeed.make({ ...owned, data, groups: R.fromEntries(groups) }));
    produced += units;
    return id;
  });
  const fromCapture = Effect.fn("Citation.tokenFromFirstCapture")(function* (input: unknown, offsetInput: unknown) {
    const seed = yield* S.decodeUnknownEffect(Seed)(input).pipe(Effect.mapError(failure));
    const offset = yield* S.decodeUnknownEffect(Position)(offsetInput).pipe(Effect.mapError(failure));
    return yield* create({ ...seed, start: seed.start + offset, end: seed.end + offset });
  });
  const snapshot = Effect.fn("Citation.snapshotToken")(function* (id: number) {
    return copySeed(yield* lookup(id));
  });
  const read = Effect.fn("Citation.tokenAssemblyView")(function* (id: number) {
    const row = yield* lookup(id);
    return CitationAssemblyView.make({
      start: row.start,
      end: row.end,
      hasData: row.data !== null,
      truthy: row.data !== null && row.data.bytes.length > 0,
      citation: row.kind === "CitationToken",
    });
  });
  const merge = Effect.fn("Citation.mergeTokenObjects")(function* (left: number, right: number) {
    const a = yield* lookup(left);
    const b = yield* lookup(right);
    if (!compatible(a, b)) return O.none<number>();
    if (a.kind !== "CitationToken") return O.some(left);
    if (a.data === null) return yield* failure();
    if (a.data.bytes.length === 0 || a.short !== b.short) return O.none<number>();
    if (
      a.exact.length + b.exact.length > limits.candidates ||
      a.variation.length + b.variation.length > limits.candidates
    )
      return yield* safety("candidates");
    const exact = yield* editions.deduplicate(A.appendAll(a.exact, b.exact));
    const variation = yield* editions.deduplicate(A.appendAll(a.variation, b.variation));
    rows = HashMap.set(rows, left, CitationTokenSeed.make({ ...a, exact, variation }));
    return O.some(left);
  });
  const mergeTruthy = Effect.fn("Citation.mergeTokenTruth")(function* (left: number, right: number) {
    const result = yield* merge(left, right);
    if (O.isNone(result)) return false;
    const row = yield* lookup(result.value);
    if (row.data === null) return yield* failure();
    return row.data.bytes.length > 0;
  });
  const nominative = Effect.fn("Citation.tokenObjectIsNominative")(function* (id: number) {
    const row = yield* lookup(id);
    return row.kind === "CitationToken" ? yield* editions.nominative(row.exact, row.variation) : false;
  });
  const constructFrom = Effect.fn("Citation.constructTokenWithCapacity")(function* <E>(
    produce: (remaining: number) => Effect.Effect<CitationTokenConstruction, E>
  ) {
    return yield* timing.timed(
      mutex.withPermit(
        Effect.gen(function* () {
          if (HashMap.size(rows) >= limits.candidates) return yield* safety("candidates");
          const construction = yield* produce(limits.producedTextUtf16 - produced);
          return yield* fromCapture(construction.seed, construction.offset);
        })
      )
    );
  });
  return {
    constructFrom,
    fromCapture: Effect.fn("Citation.serialTokenFromCapture")((input: unknown, offset: unknown) =>
      timing.timed(mutex.withPermit(fromCapture(input, offset)))
    ),
    create: Effect.fn("Citation.serialCreateToken")((input: unknown) => timing.timed(mutex.withPermit(create(input)))),
    snapshot: Effect.fn("Citation.serialSnapshotToken")((id: number) => timing.timed(mutex.withPermit(snapshot(id)))),
    read: Effect.fn("Citation.serialReadToken")((id: number) => timing.timed(mutex.withPermit(read(id)))),
    merge: Effect.fn("Citation.serialMergeToken")((left: number, right: number) =>
      timing.timed(mutex.withPermit(merge(left, right)))
    ),
    mergeTruthy: Effect.fn("Citation.serialMergeTokenTruth")((left: number, right: number) =>
      timing.timed(mutex.withPermit(mergeTruthy(left, right)))
    ),
    nominative: Effect.fn("Citation.serialNominativeToken")((id: number) =>
      timing.timed(mutex.withPermit(nominative(id)))
    ),
  };
});
