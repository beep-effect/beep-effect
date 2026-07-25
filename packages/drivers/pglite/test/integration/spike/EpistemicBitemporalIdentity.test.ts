// P0 SPIKE — disposable; superseded by P1.
// goals/epistemic-bitemporal-edge-core, phase P0 (ops/handoffs/p0-spike-contract.md § S2).
// Pure prototype of the logical edge identity digest: the application-side canonicalization
// whose output is the `logical_key` column the DB backstops partition on (S3 suite). Proves
// the partition is safe: equivalent presentations of one fact collapse to one key, and
// distinct facts never merge. P1 lifts this into a schema-first LogicalEdgeIdentity value
// object; the relation's symmetry flag will come from the relation literal domain.
import { createHash } from "node:crypto";
import { A, R } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Order, pipe } from "effect";
import * as O from "effect/Option";

interface EndpointRef {
  readonly kind: "claim" | "evidence" | "entity" | "observation";
  readonly ref: string;
}

interface LogicalEdgeIdentity {
  readonly evidenceScope: O.Option<string>;
  readonly matterScope: O.Option<string>;
  readonly orgScope: string;
  readonly qualifiers: Readonly<Record<string, string>>;
  readonly relation: string;
  readonly source: EndpointRef;
  readonly symmetric: boolean;
  readonly target: EndpointRef;
}

const encodeEndpoint = (endpoint: EndpointRef): string => `${endpoint.kind}:${endpoint.ref}`;

// Absent scopes encode as a dedicated marker so `none` can never collide with a real
// scope value (the DB-side analogue is the NULL-component hole that motivated the digest
// column in the first place: NULL never equals NULL under `WITH =`).
const encodeScope = (scope: O.Option<string>): string =>
  pipe(scope, O.match({ onNone: () => "<none>", onSome: (value) => `some:${value}` }));

const byEntryKey = Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0]);

const encodeQualifiers = (qualifiers: Readonly<Record<string, string>>): string =>
  pipe(
    R.toEntries(qualifiers),
    A.sort(byEntryKey),
    A.map(([key, value]) => `${key}=${value}`),
    A.join(",")
  );

const logicalKey = (identity: LogicalEdgeIdentity): string => {
  const sourceEncoded = encodeEndpoint(identity.source);
  const targetEncoded = encodeEndpoint(identity.target);
  const swap = identity.symmetric && targetEncoded < sourceEncoded;
  const first = swap ? targetEncoded : sourceEncoded;
  const second = swap ? sourceEncoded : targetEncoded;
  const canonical = A.join(
    [
      "v1",
      identity.relation,
      first,
      second,
      identity.orgScope,
      encodeScope(identity.matterScope),
      encodeScope(identity.evidenceScope),
      encodeQualifiers(identity.qualifiers),
    ],
    "|"
  );
  return createHash("sha256").update(canonical).digest("hex");
};

const claimA: EndpointRef = { kind: "claim", ref: "claim-a" };
const claimB: EndpointRef = { kind: "claim", ref: "claim-b" };

const base: LogicalEdgeIdentity = {
  evidenceScope: O.none(),
  matterScope: O.none(),
  orgScope: "org-1",
  qualifiers: {},
  relation: "supports",
  source: claimA,
  symmetric: false,
  target: claimB,
};

describe("EpistemicBitemporalIdentity (logical key digest)", { concurrent: false }, () => {
  it("is deterministic for identical identities", () => {
    expect(logicalKey(base)).toEqual(logicalKey({ ...base }));
  });

  it("collapses both endpoint orderings of a symmetric relation to one key", () => {
    const forward = logicalKey({ ...base, relation: "contradicts", symmetric: true });
    const backward = logicalKey({ ...base, relation: "contradicts", source: claimB, symmetric: true, target: claimA });
    expect(forward).toEqual(backward);
  });

  it("keeps the two orderings of an asymmetric relation distinct", () => {
    const forward = logicalKey(base);
    const backward = logicalKey({ ...base, source: claimB, target: claimA });
    expect(forward).not.toEqual(backward);
  });

  it("collapses qualifier insertion-order permutations to one key", () => {
    const ab = logicalKey({ ...base, qualifiers: { claimElement: "claim-1", statute: "35 USC 103" } });
    const ba = logicalKey({ ...base, qualifiers: { statute: "35 USC 103", claimElement: "claim-1" } });
    expect(ab).toEqual(ba);
  });

  it("partitions distinct qualifier values apart", () => {
    const one = logicalKey({ ...base, qualifiers: { statute: "35 USC 103" } });
    const other = logicalKey({ ...base, qualifiers: { statute: "35 USC 102" } });
    expect(one).not.toEqual(other);
  });

  it("partitions matter scope apart, including none vs some", () => {
    const noMatter = logicalKey(base);
    const matterOne = logicalKey({ ...base, matterScope: O.some("matter-1") });
    const matterTwo = logicalKey({ ...base, matterScope: O.some("matter-2") });
    expect(noMatter).not.toEqual(matterOne);
    expect(matterOne).not.toEqual(matterTwo);
  });

  it("partitions evidence scope apart", () => {
    const scoped = logicalKey({ ...base, evidenceScope: O.some("evidence-set-1") });
    expect(scoped).not.toEqual(logicalKey(base));
  });

  it("partitions relations and endpoint kinds apart", () => {
    const otherRelation = logicalKey({ ...base, relation: "refutes" });
    const entityTarget = logicalKey({ ...base, target: { kind: "entity", ref: "claim-b" } });
    expect(otherRelation).not.toEqual(logicalKey(base));
    expect(entityTarget).not.toEqual(logicalKey(base));
  });

  it("never lets a scope value collide with the absent-scope marker", () => {
    const literalNone = logicalKey({ ...base, matterScope: O.some("<none>") });
    expect(literalNone).not.toEqual(logicalKey(base));
  });
});
