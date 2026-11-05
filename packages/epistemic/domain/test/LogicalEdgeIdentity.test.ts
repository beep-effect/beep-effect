import {
  EdgeEndpoint,
  encodeLogicalEdgeIdentity,
  LogicalEdgeIdentity,
  LogicalEdgeKey,
  logicalEdgeKey,
} from "@beep/epistemic-domain";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

type LogicalEdgeIdentityInput = typeof LogicalEdgeIdentity.Encoded;

const decodeIdentity = S.decodeUnknownEffect(LogicalEdgeIdentity);
const decodeEndpoint = S.decodeUnknownResult(EdgeEndpoint);
const isLogicalEdgeKey = S.is(LogicalEdgeKey);

const claimA = { claimId: 1, kind: "claim" } as const;
const claimB = { claimId: 2, kind: "claim" } as const;

const base: LogicalEdgeIdentityInput = {
  evidenceScope: null,
  matterScope: null,
  orgScope: "org-1",
  qualifiers: {},
  relation: "supports",
  source: claimA,
  target: claimB,
};

const identityOf = (overrides: Partial<LogicalEdgeIdentityInput> = {}) => decodeIdentity({ ...base, ...overrides });

const keyOf = (overrides: Partial<LogicalEdgeIdentityInput> = {}) => Effect.map(identityOf(overrides), logicalEdgeKey);

describe("LogicalEdgeIdentity (logical key digest)", () => {
  it.effect("pins the canonical encoding the digest is taken over", () =>
    Effect.gen(function* () {
      const identityOf1 = yield* identityOf();
      expect(encodeLogicalEdgeIdentity(identityOf1)).toBe("v1|supports|claim:1|claim:2|org-1|<none>|<none>|");
    })
  );

  it.effect("produces a lowercase 64-character hex digest", () =>
    Effect.gen(function* () {
      const keyOf2 = yield* keyOf();
      expect(isLogicalEdgeKey(keyOf2)).toBe(true);
    })
  );

  it.effect("is deterministic for identical identities", () =>
    Effect.gen(function* () {
      const keyOf3 = yield* keyOf();
      const expectation = expect(keyOf3);
      const keyOf1 = yield* keyOf();
      expectation.toEqual(keyOf1);
    })
  );

  it.effect("collapses both endpoint orderings of a symmetric relation to one key", () =>
    Effect.gen(function* () {
      const forward = yield* keyOf({ relation: "contradicts" });
      const backward = yield* keyOf({ relation: "contradicts", source: claimB, target: claimA });

      expect(forward).toEqual(backward);
    })
  );

  it.effect("keeps the two orderings of an asymmetric relation distinct", () =>
    Effect.gen(function* () {
      const keyOf4 = yield* keyOf();
      const argument = expect(keyOf4).not;
      const keyOf7 = yield* keyOf({ source: claimB, target: claimA });
      argument.toEqual(keyOf7);
    })
  );

  it.effect("collapses qualifier insertion-order permutations to one key", () =>
    Effect.gen(function* () {
      const ab = yield* keyOf({ qualifiers: { claimElement: "claim-1", statute: "35 USC 103" } });
      const ba = yield* keyOf({ qualifiers: { statute: "35 USC 103", claimElement: "claim-1" } });

      expect(ab).toEqual(ba);
    })
  );

  it.effect("partitions distinct qualifier values apart", () =>
    Effect.gen(function* () {
      const one = yield* keyOf({ qualifiers: { statute: "35 USC 103" } });
      const other = yield* keyOf({ qualifiers: { statute: "35 USC 102" } });

      expect(one).not.toEqual(other);
    })
  );

  it.effect("partitions matter scope apart, including none vs some", () =>
    Effect.gen(function* () {
      const noMatter = yield* keyOf();
      const matterOne = yield* keyOf({ matterScope: "matter-1" });
      const matterTwo = yield* keyOf({ matterScope: "matter-2" });

      expect(noMatter).not.toEqual(matterOne);
      expect(matterOne).not.toEqual(matterTwo);
    })
  );

  it.effect("partitions evidence scope apart", () =>
    Effect.gen(function* () {
      const keyOf5 = yield* keyOf({ evidenceScope: "evidence-set-1" });
      const argument1 = expect(keyOf5).not;
      const keyOf9 = yield* keyOf();
      argument1.toEqual(keyOf9);
    })
  );

  it.effect("partitions relations and endpoint kinds apart", () =>
    Effect.gen(function* () {
      const otherRelation = yield* keyOf({ relation: "refutes" });
      const entityTarget = yield* keyOf({ target: { entityRef: "2", kind: "entity" } });

      const argument2 = expect(otherRelation).not;
      const keyOf10 = yield* keyOf();
      argument2.toEqual(keyOf10);
      const argument3 = expect(entityTarget).not;
      const keyOf11 = yield* keyOf();
      argument3.toEqual(keyOf11);
    })
  );

  it.effect("never lets a scope value collide with the absent-scope marker", () =>
    Effect.gen(function* () {
      const keyOf6 = yield* keyOf({ matterScope: "<none>" });
      const argument4 = expect(keyOf6).not;
      const keyOf12 = yield* keyOf();
      argument4.toEqual(keyOf12);
    })
  );

  it("rejects an endpoint kind outside the bounded vocabulary", () => {
    pipe(decodeEndpoint({ claimId: 1, kind: "claim" }), Result.isSuccess, assertTrue);
    pipe(decodeEndpoint({ claimId: 1, kind: "banana" }), Result.isFailure, assertTrue);
  });

  it.effect("keeps qualifier delimiter characters from merging two identities", () =>
    Effect.gen(function* () {
      // Without escaping, both encode the qualifier tail as `a=1,b=2`.
      const smuggled = yield* keyOf({ qualifiers: { a: "1,b=2" } });
      const distinct = yield* keyOf({ qualifiers: { a: "1", b: "2" } });

      expect(smuggled).not.toEqual(distinct);
    })
  );

  it.effect("keeps the component delimiter in a scope from forging encoding structure", () =>
    Effect.gen(function* () {
      // A literal pipe must never read as a component boundary, and the escaped
      // form of one value must never collide with a value that already looks
      // escaped (`%` escapes first, so `a|b` and `a%7Cb` stay distinct).
      const identityOf7 = yield* identityOf({ matterScope: "a|b" });
      expect(encodeLogicalEdgeIdentity(identityOf7)).toContain("some:a%7Cb");
      const keyOf8 = yield* keyOf({ matterScope: "a|b" });
      const argument5 = expect(keyOf8).not;
      const keyOf13 = yield* keyOf({ matterScope: "a%7Cb" });
      argument5.toEqual(keyOf13);
    })
  );

  it.effect("keeps a free-form endpoint ref from injecting the component delimiter", () =>
    Effect.gen(function* () {
      const piped = yield* identityOf({ target: { entityRef: "ref|claim:9", kind: "entity" } });

      expect(encodeLogicalEdgeIdentity(piped)).toContain("entity:ref%7Cclaim:9");
      const argument6 = expect(logicalEdgeKey(piped)).not;
      const keyOf14 = yield* keyOf({ target: { entityRef: "ref%7Cclaim:9", kind: "entity" } });
      argument6.toEqual(keyOf14);
    })
  );
});
