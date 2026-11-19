// L0-2 of the text-knowledge stack rebuild law catalogue: equivalent records
// hash alike under key order and set order. Canonical JSON (RFC 8785) sorts
// object keys only, so the set order half rests on the preimage schema, which
// encodes every set-valued field with CanonicalHashSet.
//
// Leaves come from Arbitrary.schema over the production schemas; every
// dependent hash is minted through the production minting function. The
// golden-vector tests pin the bytes of each preimage the package declares.
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { IRI } from "@beep/identity/Iri";
import { ActivityPin, ActivityPreimage, mintActivityId, mintActivityIdResult } from "@beep/jsonc/ActivityStart";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import {
  DuplicateDomainTag,
  definePreimage,
  mintContentHashResult,
  PreimageGoldenMismatch,
  PreimageGoldenNotCanonical,
  PreimageRegistry,
} from "@beep/jsonc/Mint";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { WellFormedText } from "@beep/schema/WellFormedText";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { sha256 } from "./support/Sha256.ts";

const runs = { arbitrary: fcRuns(100) };

// A record with two set-valued fields, one of them nested.
const Probe = S.Struct({
  label: WellFormedText,
  count: S.Int,
  tags: CanonicalHashSet(WellFormedText),
  nested: S.Struct({ note: WellFormedText, flags: CanonicalHashSet(WellFormedText) }),
});
type Probe = typeof Probe.Type;

const ProbeDomainTag = DomainTag.make("probe/v1");

const ProbePreimage = definePreimage({
  domainTag: ProbeDomainTag,
  schema: S.Tuple([Probe]),
  golden: {
    preimage: [{ label: "a", count: 1, tags: ["x", "y"], nested: { note: "n", flags: [] } }],
    hash: ContentHash.make("sha256:ddd15834784fbd86fd5a4e93aac42aa69ed0e398046cdda2f7c899faf8af7c5d"),
  },
});

const encodeProbe = S.encodeResult(Probe);
const decodeProbe = S.decodeUnknownResult(Probe);
const mint = mintContentHashResult(sha256);
const mintProbe = ProbePreimage.mintResult(sha256);
const sameProbe = S.toEquivalence(Probe);
const isContentHash = S.is(ContentHash);

// The weights that scramble one encoded probe: the key order of each object
// level, and the order and the repeats of each set-valued array.
const Scramble = S.Struct({
  outerKeys: S.Tuple([S.Int, S.Int, S.Int, S.Int]),
  nestedKeys: S.Tuple([S.Int, S.Int]),
  tags: S.Array(S.Int),
  flags: S.Array(S.Int),
});
type Scramble = typeof Scramble.Type;

const weightAt = (weights: ReadonlyArray<number>, index: number): number =>
  A.isReadonlyArrayNonEmpty(weights) ? A.getUnsafe(weights, index % weights.length) : 0;

const byWeight = <Item>(items: ReadonlyArray<Item>, weights: ReadonlyArray<number>): Array<Item> =>
  pipe(
    A.zip(
      items,
      A.map(items, (_, index) => weightAt(weights, index))
    ),
    A.sort(Order.mapInput(Order.Number, ([, weight]: readonly [Item, number]) => weight)),
    A.map(([item]) => item)
  );

// Re-insert the object's keys in the weighted order, keeping every value.
const reorderKeys = (record: R.ReadonlyRecord<string, unknown>, weights: ReadonlyArray<number>) =>
  R.fromEntries(byWeight(R.toEntries(record), weights));

// Shuffle the members by weight and repeat every member whose weight is even.
const scrambleMembers = (members: ReadonlyArray<string>, weights: ReadonlyArray<number>): Array<string> =>
  A.appendAll(
    byWeight(members, weights),
    A.filter(members, (_, index) => N.remainder(weightAt(weights, index), 2) === 0)
  );

const scrambleKeys = (encoded: typeof Probe.Encoded, scramble: Scramble) =>
  reorderKeys({ ...encoded, nested: reorderKeys(encoded.nested, scramble.nestedKeys) }, scramble.outerKeys);

const scrambleAll = (encoded: typeof Probe.Encoded, scramble: Scramble) =>
  scrambleKeys(
    {
      ...encoded,
      tags: scrambleMembers(encoded.tags, scramble.tags),
      nested: { ...encoded.nested, flags: scrambleMembers(encoded.nested.flags, scramble.flags) },
    },
    scramble
  );

// A probe, two independent scrambles of its encoding decoded back, and the
// hashes the production minting function gives each of the three.
const Equivalents = Arbitrary.all([
  Arbitrary.schema(Probe),
  Arbitrary.schema(Scramble),
  Arbitrary.schema(Scramble),
]).pipe(
  Arbitrary.map(([probe, first, second]) => {
    const encoded = Result.getOrThrow(encodeProbe(probe));
    const left = Result.getOrThrow(decodeProbe(scrambleAll(encoded, first)));
    const right = Result.getOrThrow(decodeProbe(scrambleAll(encoded, second)));
    return {
      probe,
      left,
      right,
      hashes: A.map([probe, left, right], (value: Probe) => Result.getOrThrow(mintProbe([value]))),
    };
  })
);

// An encoded probe and the same encoding with its keys re-inserted in a
// generated order at every level, both minted as plain JSON.
const KeyOrders = Arbitrary.all([Arbitrary.schema(Probe), Arbitrary.schema(Scramble)]).pipe(
  Arbitrary.map(([probe, scramble]) => {
    const encoded = Result.getOrThrow(encodeProbe(probe));
    return {
      inOrder: mint(ProbeDomainTag, [encoded]),
      reordered: mint(ProbeDomainTag, [scrambleKeys(encoded, scramble)]),
    };
  })
);

const goldenStart = {
  operation: IRI.make("https://example.org/ops/extract"),
  pin: ActivityPin.cases.Model.make({ model: "claude-opus-5-5", version: "2026-11-01" }),
  promptDigest: Sha256PrefixedDigest.makeOption(
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  ),
  // The two members in descending order with a repeat: the id must not see it.
  used: HashSet.make(
    ContentHash.make("sha256:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"),
    ContentHash.make("sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"),
    ContentHash.make("sha256:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9")
  ),
  started: DateTime.makeUnsafe(1_763_510_400_000),
};

describe("ContentHash laws", () => {
  it.prop(
    "L0-2 equivalent records hash alike under key order and under two orderings and duplications of one set",
    [Equivalents],
    ([{ probe, left, right, hashes }]) => {
      assertTrue(sameProbe(probe, left));
      assertTrue(sameProbe(probe, right));
      const [first, ...rest] = hashes;
      assertTrue(isContentHash(first));
      assert.deepStrictEqual(rest, [first, first]);
    },
    runs
  );

  it.prop(
    "L0-2 object key order never changes the minted hash",
    [KeyOrders],
    ([{ inOrder, reordered }]) => {
      assertTrue(inOrder.pipe(Result.isSuccess));
      assert.deepStrictEqual(reordered, inOrder);
    },
    runs
  );

  it.prop(
    "L0-2 another domain or another version of one domain hashes the same preimage apart",
    [Probe],
    ([probe]) => {
      const encoded = Result.getOrThrow(encodeProbe(probe));
      const hashes = A.map(["probe/v1", "probe/v2", "other/v1"], (tag) =>
        Result.getOrThrow(mint(DomainTag.make(tag), [encoded]))
      );
      assert.strictEqual(HashSet.size(HashSet.fromIterable(hashes)), 3);
    },
    runs
  );

  it.layer(Digest.layerWebCrypto)("through the Digest service", (it) => {
    it.effect.prop(
      "L0-2 the Digest-service minting function equals its Result twin",
      [Probe],
      ([probe]) => ProbePreimage.mint([probe]).pipe(Effect.map((hash) => assertSuccess(mintProbe([probe]), hash))),
      runs
    );

    it.effect("L0-2 the golden vectors hold through the Digest service", () =>
      Effect.fromResult(PreimageRegistry.make([ActivityPreimage, ProbePreimage])).pipe(
        Effect.flatMap((registry) => registry.verifyGoldens())
      )
    );

    it.effect("L0-2 the activity id minted through the Digest service is the golden", () =>
      mintActivityId(goldenStart).pipe(Effect.map((id) => assert.strictEqual(id, ActivityPreimage.golden.hash)))
    );
  });

  describe("golden vectors", () => {
    it("L0-2 every declared preimage mints its committed golden hash", () => {
      const registry = PreimageRegistry.make([ActivityPreimage, ProbePreimage]);
      assertTrue(registry.pipe(Result.isSuccess));
      assertSuccess(registry.pipe(Result.flatMap((declared) => declared.verifyGoldensResult(sha256))), undefined);
    });

    it("L0-2 the activity/v1 golden hashes these canonical bytes", () => {
      assertSuccess(
        JsoncFingerprint.canonicalizeResult(A.prepend(ActivityPreimage.golden.preimage, ActivityPreimage.domainTag)),
        '["activity/v1","https://example.org/ops/extract",{"_tag":"Model","model":"claude-opus-5-5","version":"2026-11-01"},"sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",["sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae","sha256:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"],1763510400000]'
      );
    });

    it("L0-2 an activity id ignores the order and the repeats of its used set", () => {
      assertSuccess(mintActivityIdResult(sha256)(goldenStart), ActivityPreimage.golden.hash);
    });

    it("L0-2 a duplicate domain tag is refused", () => {
      assertFailure(
        PreimageRegistry.make([ActivityPreimage, ProbePreimage, ActivityPreimage]),
        DuplicateDomainTag.make({ domainTag: ActivityPreimage.domainTag })
      );
    });

    it("L0-2 a golden that records another hash is refused", () => {
      const stale = definePreimage({
        ...ProbePreimage,
        golden: { ...ProbePreimage.golden, hash: ActivityPreimage.golden.hash },
      });
      assertFailure(
        stale.verifyGoldenResult(sha256),
        PreimageGoldenMismatch.make({
          domainTag: ProbeDomainTag,
          expected: ActivityPreimage.golden.hash,
          actual: ProbePreimage.golden.hash,
        })
      );
    });

    it("L0-2 a golden whose recorded set is unsorted or repeats a member is refused", () => {
      const canonical = ProbePreimage.golden.preimage[0];
      const recordedTags = [
        ["y", "x"],
        ["x", "x", "y"],
      ] as const;
      A.forEach(recordedTags, (tags) => {
        const loose = definePreimage({
          ...ProbePreimage,
          golden: { ...ProbePreimage.golden, preimage: [{ ...canonical, tags }] },
        });
        const expected = PreimageGoldenNotCanonical.make({
          domainTag: ProbeDomainTag,
          recorded: Result.getOrThrow(JsoncFingerprint.canonicalizeResult(loose.golden.preimage)),
          canonical: Result.getOrThrow(JsoncFingerprint.canonicalizeResult(ProbePreimage.golden.preimage)),
        });
        assertFailure(loose.verifyGoldenResult(sha256), expected);
      });
    });
  });

  it.layer(Digest.layerWebCrypto)("a non-canonical golden through the Digest service", (it) => {
    it.effect("L0-2 the Digest-service golden check refuses an unsorted recorded set", () =>
      definePreimage({
        ...ProbePreimage,
        golden: {
          ...ProbePreimage.golden,
          preimage: [{ ...ProbePreimage.golden.preimage[0], tags: ["y", "x"] }],
        },
      })
        .verifyGolden()
        .pipe(
          Effect.flip,
          Effect.map((error) => assert.strictEqual(error._tag, "PreimageGoldenNotCanonical"))
        )
    );
  });
});
