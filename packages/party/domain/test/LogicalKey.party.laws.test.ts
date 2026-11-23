import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const structurallyEqual = S.toEquivalence(Proposition);
const symmetric = Proposition.isAnyOf(["SameParty", "DistinctParty"]);
const fieldsOf: (proposition: Proposition) => ReadonlyArray<unknown> = Proposition.match({
  KeyAssignment: (p) => [p.key],
  IdentifierOf: (p) => [p.identifier, p.party, p.relation],
  AccountIdentifier: (p) => [p.account, p.identifier],
  MailboxKind: (p) => [p.account],
  AccountControl: (p) => [p.account, p.controller, p.relation],
  VoiceAuthor: (p) => [p.voice, p.author],
  SameParty: (p) => [p.left, p.right],
  DistinctParty: (p) => [p.left, p.right],
  PartyName: (p) => [p.party, p.nameKind, p.value],
  Membership: (p) => [p.member, p.organization],
  ReportsTo: (p) => [p.subordinate, p.superior],
  DelegateOf: (p) => [p.delegate, p.principal],
  ContextRole: (p) => [p.party, p.context, p.role],
  External: (p) => [p.subject, p.predicate, p.object],
});

const ownerEquivalent = (left: Proposition, right: Proposition): boolean => {
  if (left._tag !== right._tag) return false;
  if (symmetric(left) && symmetric(right))
    return (
      (Eq.equals(left.left, right.left) && Eq.equals(left.right, right.right)) ||
      (Eq.equals(left.left, right.right) && Eq.equals(left.right, right.left))
    );
  return A.every(A.zip(fieldsOf(left), fieldsOf(right)), ([a, b]) => Eq.equals(a, b));
};

const sameSubject = (left: Proposition, right: Proposition): Proposition =>
  Proposition.match(right, {
    KeyAssignment: () => left,
    IdentifierOf: () => left,
    AccountIdentifier: () => left,
    AccountControl: () => left,
    VoiceAuthor: () => left,
    PartyName: () => left,
    ContextRole: () => left,
    External: () => left,
    SameParty: () => (symmetric(left) ? { ...left, left: left.right, right: left.left } : left),
    DistinctParty: () => (symmetric(left) ? { ...left, left: left.right, right: left.left } : left),
    MailboxKind: (other) => (left._tag === "MailboxKind" ? { ...left, kind: other.kind } : left),
    Membership: (other) => (left._tag === "Membership" ? { ...left, role: other.role, title: other.title } : left),
    ReportsTo: (other) => (left._tag === "ReportsTo" ? { ...left, organization: other.organization } : left),
    DelegateOf: (other) => (left._tag === "DelegateOf" ? { ...left, account: other.account } : left),
  });

describe("party logical keys", () => {
  it.prop(
    "L4-5 party proposition equivalence agrees with logical key equality on generated distinct pairs",
    [S.Tuple([Proposition, Proposition])],
    ([[left, right]]) => {
      expect(ownerEquivalent(left, right)).toBe(logicalKey(left) === logicalKey(right));
      expect(ownerEquivalent(left, left)).toBe(true);
      expect(structurallyEqual(left, left)).toBe(true);
    },
    { arbitrary: { runs: 300, seed: "party-l4-5-distinct" } }
  );

  it.prop(
    "L4-5 party proposition equivalence agrees with logical key equality on generated equivalent pairs",
    [S.Tuple([Proposition, Proposition])],
    ([[left, right]]) => {
      const variant = right._tag === left._tag ? sameSubject(left, right) : left;
      expect(ownerEquivalent(left, variant)).toBe(true);
      expect(logicalKey(variant)).toBe(logicalKey(left));
    },
    { arbitrary: { runs: 300, seed: "party-l4-5-equivalent" } }
  );

  it("L4-5 equivalence ignores non-identity payload and symmetric endpoint order but not identity fields", () => {
    const decode = (input: unknown) => Result.getOrThrow(S.decodeUnknownResult(Proposition)(input));
    const pairs: ReadonlyArray<readonly [unknown, unknown, boolean]> = [
      [{ _tag: "SameParty", left: 1, right: 2 }, { _tag: "SameParty", left: 2, right: 1 }, true],
      [{ _tag: "DistinctParty", left: 1, right: 2 }, { _tag: "SameParty", left: 1, right: 2 }, false],
      [
        { _tag: "MailboxKind", account: "party-acct:a", kind: "shared" },
        { _tag: "MailboxKind", account: "party-acct:a", kind: "role" },
        true,
      ],
      [
        { _tag: "ReportsTo", subordinate: 1, superior: 2, organization: null },
        { _tag: "ReportsTo", subordinate: 1, superior: 2, organization: 3 },
        true,
      ],
      [
        { _tag: "ReportsTo", subordinate: 1, superior: 2, organization: null },
        { _tag: "ReportsTo", subordinate: 2, superior: 1, organization: null },
        false,
      ],
      [
        { _tag: "PartyName", party: 1, nameKind: "legal", value: "a|b:2" },
        { _tag: "PartyName", party: 1, nameKind: "legal", value: "a|b:20" },
        false,
      ],
    ];
    for (const [leftInput, rightInput, equivalent] of pairs) {
      const left = decode(leftInput);
      const right = decode(rightInput);
      expect(ownerEquivalent(left, right)).toBe(equivalent);
      expect(logicalKey(left) === logicalKey(right)).toBe(equivalent);
    }
    expect(structurallyEqual(decode(A.getUnsafe(pairs, 0)[0]), decode(A.getUnsafe(pairs, 0)[1]))).toBe(false);
  });
});
