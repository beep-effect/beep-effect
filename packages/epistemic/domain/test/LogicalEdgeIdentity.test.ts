import {
  EdgeEndpoint,
  encodeLogicalEdgeIdentity,
  LogicalEdgeIdentity,
  LogicalEdgeKey,
  logicalEdgeKey,
} from "@beep/epistemic-domain";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";

type LogicalEdgeIdentityInput = typeof LogicalEdgeIdentity.Encoded;

const decodeIdentity = S.decodeUnknownSync(LogicalEdgeIdentity);
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

const keyOf = (overrides: Partial<LogicalEdgeIdentityInput>): LogicalEdgeKey =>
  logicalEdgeKey(decodeIdentity({ ...base, ...overrides }));

describe("LogicalEdgeIdentity (logical key digest)", () => {
  it("pins the canonical encoding the digest is taken over", () => {
    expect(encodeLogicalEdgeIdentity(decodeIdentity(base))).toBe("v1|supports|claim:1|claim:2|org-1|<none>|<none>|");
  });

  it("produces a lowercase 64-character hex digest", () => {
    expect(isLogicalEdgeKey(keyOf({}))).toBe(true);
  });

  it("is deterministic for identical identities", () => {
    expect(keyOf({})).toEqual(keyOf({}));
  });

  it("collapses both endpoint orderings of a symmetric relation to one key", () => {
    const forward = keyOf({ relation: "contradicts" });
    const backward = keyOf({ relation: "contradicts", source: claimB, target: claimA });

    expect(forward).toEqual(backward);
  });

  it("keeps the two orderings of an asymmetric relation distinct", () => {
    expect(keyOf({})).not.toEqual(keyOf({ source: claimB, target: claimA }));
  });

  it("collapses qualifier insertion-order permutations to one key", () => {
    const ab = keyOf({ qualifiers: { claimElement: "claim-1", statute: "35 USC 103" } });
    const ba = keyOf({ qualifiers: { statute: "35 USC 103", claimElement: "claim-1" } });

    expect(ab).toEqual(ba);
  });

  it("partitions distinct qualifier values apart", () => {
    const one = keyOf({ qualifiers: { statute: "35 USC 103" } });
    const other = keyOf({ qualifiers: { statute: "35 USC 102" } });

    expect(one).not.toEqual(other);
  });

  it("partitions matter scope apart, including none vs some", () => {
    const noMatter = keyOf({});
    const matterOne = keyOf({ matterScope: "matter-1" });
    const matterTwo = keyOf({ matterScope: "matter-2" });

    expect(noMatter).not.toEqual(matterOne);
    expect(matterOne).not.toEqual(matterTwo);
  });

  it("partitions evidence scope apart", () => {
    expect(keyOf({ evidenceScope: "evidence-set-1" })).not.toEqual(keyOf({}));
  });

  it("partitions relations and endpoint kinds apart", () => {
    const otherRelation = keyOf({ relation: "refutes" });
    const entityTarget = keyOf({ target: { entityRef: "2", kind: "entity" } });

    expect(otherRelation).not.toEqual(keyOf({}));
    expect(entityTarget).not.toEqual(keyOf({}));
  });

  it("never lets a scope value collide with the absent-scope marker", () => {
    expect(keyOf({ matterScope: "<none>" })).not.toEqual(keyOf({}));
  });

  it("rejects an endpoint kind outside the bounded vocabulary", () => {
    expect(Result.isSuccess(decodeEndpoint({ claimId: 1, kind: "claim" }))).toBe(true);
    expect(Result.isFailure(decodeEndpoint({ claimId: 1, kind: "banana" }))).toBe(true);
  });

  it("keeps qualifier delimiter characters from merging two identities", () => {
    // Without escaping, both encode the qualifier tail as `a=1,b=2`.
    const smuggled = keyOf({ qualifiers: { a: "1,b=2" } });
    const distinct = keyOf({ qualifiers: { a: "1", b: "2" } });

    expect(smuggled).not.toEqual(distinct);
  });

  it("keeps the component delimiter in a scope from forging encoding structure", () => {
    // A literal pipe must never read as a component boundary, and the escaped
    // form of one value must never collide with a value that already looks
    // escaped (`%` escapes first, so `a|b` and `a%7Cb` stay distinct).
    expect(encodeLogicalEdgeIdentity(decodeIdentity({ ...base, matterScope: "a|b" }))).toContain("some:a%7Cb");
    expect(keyOf({ matterScope: "a|b" })).not.toEqual(keyOf({ matterScope: "a%7Cb" }));
  });

  it("keeps a free-form endpoint ref from injecting the component delimiter", () => {
    const piped = decodeIdentity({ ...base, target: { entityRef: "ref|claim:9", kind: "entity" } });

    expect(encodeLogicalEdgeIdentity(piped)).toContain("entity:ref%7Cclaim:9");
    expect(logicalEdgeKey(piped)).not.toEqual(keyOf({ target: { entityRef: "ref%7Cclaim:9", kind: "entity" } }));
  });
});
