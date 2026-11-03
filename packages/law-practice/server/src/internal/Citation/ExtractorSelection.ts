/** Source required-string selection using upstream Effect Trie.
 * eyecite 2.7.6 tokenizers.py, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Trie from "effect/Trie";
import { makeCitationPythonLower } from "./PythonCase.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractorSelection");
const maximum = CitationEngineAbsoluteMaxima;
const Index = S.Natural.check(S.isLessThan(maximum.patterns)).pipe(
  $I.annoteSchema("Index", { description: "Stable slot in the trusted source extractor configuration." })
);
const Flags = LiteralKit([0, 2]).pipe(
  $I.annoteSchema("Flags", { description: "Reviewed source selection flag sets." })
);
/** @internal @category models @since 0.0.0 */
export class CitationExtractorSelectionBinding extends S.Opaque<
  CitationExtractorSelectionBinding,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: Index,
    flags: Flags,
    strings: S.Array(CitationPythonUnicodeStorage).check(S.isMaxLength(maximum.patternUtf16)),
  }).pipe(
    $I.annoteSchema("CitationExtractorSelectionBinding", {
      description: "Trusted required native strings for one extractor; not regex execution approval.",
    })
  )
) {}
const Bindings = S.Array(CitationExtractorSelectionBinding)
  .check(S.isMaxLength(maximum.patterns))
  .pipe(
    $I.annoteSchema("Bindings", {
      description: "Bounded source-indexed selector installation, separate from raw requests.",
    })
  );
const Reason = LiteralKit(["invalid-policy", "invalid-bindings", "invalid-input"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed preparation errors without source words or cause payloads." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationExtractorSelectionFailure extends S.TaggedError<
  CitationExtractorSelectionFailure,
  { readonly brand: unique symbol }
>($I`CitationExtractorSelectionFailure`)(
  "CitationExtractorSelectionFailure",
  { reason: Reason },
  $I.annoteError<CitationExtractorSelectionFailure>("CitationExtractorSelectionFailure", {
    description: "Selector installation or native input failed closed.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationExtractorSelection extends S.Opaque<
  CitationExtractorSelection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    indices: S.Array(Index).check(S.isMaxLength(maximum.patterns)),
    prefixQueries: S.Natural,
    matchedKeys: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationExtractorSelection", {
      description: "Membership in index order, plus exact lookup counters; not Python set iteration order.",
    })
  )
) {}
const fail = (reason: typeof Reason.Type) => CitationExtractorSelectionFailure.make({ reason });
const snapshotBindings = Effect.fn("Citation.snapshotSelectionBindings")(function* (
  bindings: ReadonlyArray<CitationExtractorSelectionBinding>,
  maximumBytes: number,
  maximumPoints: number
) {
  let total = 0;
  for (const binding of bindings) {
    for (const storage of binding.strings) {
      total += storage.bytes.length;
      if (storage.bytes.length / storage.width > maximumPoints || total > maximumBytes)
        return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
    }
  }
  return A.map(bindings, (binding) =>
    CitationExtractorSelectionBinding.make({
      id: binding.id,
      flags: binding.flags,
      strings: A.map(binding.strings, (storage) =>
        CitationPythonUnicodeStorage.make({ width: storage.width, bytes: new Uint8Array(storage.bytes) })
      ),
    })
  );
});

// Fixed two-unit words cannot collide with scalar/surrogate projections. The
// first unit is 0..16, so no encoded pair forms an accidental surrogate pair.
const encode = Effect.fn("Citation.encodeSelectionWords")(function* (storage: CitationPythonUnicodeStorage) {
  const { bytes, width } = storage;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result = "";
  for (let index = 0; index < bytes.length; index += width) {
    if (index % (4096 * width) === 0) yield* Effect.yieldNow;
    const point =
      width === 1 ? view.getUint8(index) : width === 2 ? view.getUint16(index, true) : view.getUint32(index, true);
    result += String.fromCharCode(point >>> 16, point & 0xffff);
  }
  return result;
});

/** Capture source metadata, policy and Clock. Select returns membership only;
 * exact source-set order and token construction belong to tokenizer integration.
 * All matching/index operations use Effect Trie and HashSet, never a custom trie.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationExtractorSelection = Effect.fn("Citation.makeExtractorSelection")(function* (
  policy: unknown,
  input: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const timing = yield* makeCitationRegexTiming(limits, true);
  const decodedBindings = yield* S.decodeUnknownEffect(Bindings)(input).pipe(
    Effect.mapError(() => fail("invalid-bindings"))
  );
  if (decodedBindings.length > limits.patterns)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patterns" });
  const bindings = yield* snapshotBindings(
    decodedBindings,
    4 * limits.patterns * limits.patternUtf16,
    limits.patternUtf16
  );
  const unicode = yield* makeCitationPythonUnicode(limits);
  const lowercase = yield* makeCitationPythonLower(limits);
  let exact = Trie.empty<ReadonlyArray<number>>();
  let insensitive = Trie.empty<ReadonlyArray<number>>();
  let ids = HashSet.empty<number>();
  let unfiltered = HashSet.empty<number>();
  let longest = 0;
  const keyFor = Effect.fn("Citation.prepareSelectionKey")(function* (
    storage: CitationPythonUnicodeStorage,
    flags: typeof Flags.Type
  ) {
    if (storage.bytes.length / storage.width > limits.patternUtf16)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
    const value = yield* unicode.fromStorage(storage);
    if (value.utf16Units === 0) return yield* fail("invalid-bindings");
    if (value.utf16Units > limits.patternUtf16)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
    return yield* encode(flags === 2 ? yield* lowercase.lower(value.storage) : value.storage);
  });
  const install = Effect.fn("Citation.installSelectionBinding")(function* (binding: CitationExtractorSelectionBinding) {
    if (HashSet.has(ids, binding.id)) return yield* fail("invalid-bindings");
    ids = HashSet.add(ids, binding.id);
    if (binding.strings.length === 0) unfiltered = HashSet.add(unfiltered, binding.id);
    for (const storage of binding.strings) {
      const key = yield* keyFor(storage, binding.flags).pipe(
        Effect.catchTag("CitationPythonUnicodeFailure", () => Effect.fail(fail("invalid-bindings")))
      );
      const tree = binding.flags === 2 ? insensitive : exact;
      const members = O.getOrElse(Trie.get(tree, key), A.empty<number>);
      const next = Trie.insert(tree, key, A.append(members, binding.id));
      if (binding.flags === 2) insensitive = next;
      else exact = next;
      longest = Num.max(longest, Str.length(key));
    }
  });
  for (const binding of bindings) yield* install(binding);
  const select = Effect.fn("Citation.selectExtractors")(
    function* (source: unknown) {
      const original = yield* unicode.fromStorage(source);
      let selected = unfiltered;
      let prefixQueries = 0;
      let matchedKeys = 0;
      const scan = Effect.fn("Citation.scanSelectionTrie")(function* (
        tree: Trie.Trie<ReadonlyArray<number>>,
        storage: CitationPythonUnicodeStorage
      ) {
        if (Trie.isEmpty(tree)) return;
        const text = yield* encode(storage);
        let seen = HashSet.empty<string>();
        const visitPrefixes = Effect.fn("Citation.visitSelectionPrefixes")(function* (initial: string) {
          let query = initial;
          while (Str.length(query) > 0) {
            prefixQueries++;
            if (prefixQueries % 4096 === 0) yield* Effect.yieldNow;
            const found = Trie.longestPrefixOf(tree, query);
            if (O.isNone(found)) break;
            const [key, members] = found.value;
            if (HashSet.has(seen, key)) break;
            seen = HashSet.add(seen, key);
            matchedKeys++;
            selected = HashSet.union(selected, HashSet.fromIterable(members));
            query = Str.slice(0, Str.length(key) - 1)(key);
          }
        });
        for (let offset = 0; offset < Str.length(text); offset += 2) {
          if (offset % 8192 === 0) yield* Effect.yieldNow;
          yield* visitPrefixes(Str.slice(offset, offset + longest)(text));
        }
      });
      yield* scan(exact, original.storage);
      if (!Trie.isEmpty(insensitive)) yield* scan(insensitive, yield* lowercase.lower(original.storage));
      return CitationExtractorSelection.make({
        indices: A.sort(A.fromIterable(selected), Order.Number),
        prefixQueries,
        matchedKeys,
      });
    },
    timing.timed,
    Effect.catchTag("CitationPythonUnicodeFailure", () => Effect.fail(fail("invalid-input")))
  );
  return { select };
});
