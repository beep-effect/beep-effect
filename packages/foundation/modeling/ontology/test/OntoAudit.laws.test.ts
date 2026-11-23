import { TermIri } from "@beep/identity/Term";
import {
  audit,
  GufoClassType,
  GufoTyping,
  GufoTypings,
  OntoViolation,
  RelatorUndermediated,
  RigidSpecializesAntiRigid,
  RoleWithoutKind,
  TypedHierarchy,
} from "@beep/ontology/Gufo";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { typedHierarchyArbitrary } from "./support/TypedHierarchy.arbitrary.ts";
import type { GufoInstanceCategory } from "@beep/ontology/Gufo";

const sameViolation = S.toEquivalence(OntoViolation);
const term = (local: string) => TermIri.make(`https://example.test/onto/${local}`);

const typing = (
  classType: GufoClassType,
  instanceCategory: GufoInstanceCategory = "Object",
  mediates = HashMap.empty<TermIri, number>()
) => GufoTyping.make({ classType, instanceCategory, mediates });

const hierarchy = (
  typed: ReadonlyArray<readonly [string, GufoTyping]>,
  edges: ReadonlyArray<readonly [string, ReadonlyArray<string>]>
) =>
  TypedHierarchy.make({
    typing: HashMap.fromIterable(A.map(typed, ([local, value]) => [term(local), value])),
    specializes: HashMap.fromIterable(
      A.map(edges, ([local, supertypes]) => [term(local), HashSet.fromIterable(A.map(supertypes, term))])
    ),
  });

const auditOf = (typed: TypedHierarchy, local: string) => audit(typed)(term(local));

describe("gUFO audit", () => {
  it.prop(
    "L3-3 the audit is sound on typed terms and silent on untyped ones",
    [typedHierarchyArbitrary],
    ([sample]) => {
      for (const candidate of sample.terms) {
        const partial = audit(sample.hierarchy)(candidate);
        const complete = audit(sample.completion)(candidate);
        pipe(HashMap.has(sample.hierarchy.typing, candidate) || A.isReadonlyArrayEmpty(partial), assertTrue);
        pipe(
          A.every(partial, (violation) => A.some(complete, (other) => sameViolation(violation, other))),
          assertTrue
        );
      }
    },
    { arbitrary: fcRuns() }
  );

  it("plants a role without a kind and stays silent when a supertype is a kind, untyped or the role a mixin", () => {
    const agent = ["Agent", typing("Category")] as const;
    const kinded = hierarchy(
      [agent, ["Person", typing("Kind")], ["Student", typing("Role")], ["Member", typing("Phase")]],
      [
        ["Student", ["Agent"]],
        ["Member", ["Agent", "Person"]],
      ]
    );
    expect(auditOf(kinded, "Student")).toEqual([RoleWithoutKind.make({ term: term("Student") })]);
    expect(auditOf(kinded, "Member")).toEqual([]);
    const open = hierarchy([agent, ["Student", typing("Role")]], [["Student", ["Agent", "Unknown"]]]);
    expect(auditOf(open, "Student")).toEqual([]);
    const mixin = hierarchy([agent, ["Customer", typing("RoleMixin")]], [["Customer", ["Agent"]]]);
    expect(auditOf(mixin, "Customer")).toEqual([]);
    const lone = hierarchy([["Student", typing("Role")]], []);
    expect(auditOf(lone, "Student")).toEqual([RoleWithoutKind.make({ term: term("Student") })]);
  });

  it("plants a rigid term under an anti-rigid one, transitively, and exempts mixins", () => {
    const typed = hierarchy(
      [
        ["Person", typing("Kind")],
        ["Student", typing("Role")],
        ["Adult", typing("Phase")],
        ["Thing", typing("Mixin")],
      ],
      [
        ["Person", ["Middle", "Thing"]],
        ["Middle", ["Student", "Adult"]],
      ]
    );
    expect(auditOf(typed, "Person")).toEqual([
      RigidSpecializesAntiRigid.make({ term: term("Person"), supertype: term("Adult") }),
      RigidSpecializesAntiRigid.make({ term: term("Person"), supertype: term("Student") }),
    ]);
    expect(auditOf(typed, "Middle")).toEqual([]);
  });

  it("plants an undermediated relator and accepts a marriage mediating two spouses of one role", () => {
    const spouse = term("Spouse");
    const typed = hierarchy(
      [
        ["Person", typing("Kind")],
        ["Spouse", typing("Role")],
        ["Marriage", typing("Kind", "Relator", HashMap.make([spouse, 2]))],
        ["Enrollment", typing("Kind", "Relator", HashMap.make([spouse, 1]))],
      ],
      [["Spouse", ["Person"]]]
    );
    expect(auditOf(typed, "Marriage")).toEqual([]);
    expect(auditOf(typed, "Enrollment")).toEqual([RelatorUndermediated.make({ term: term("Enrollment") })]);
    expect(auditOf(typed, "Spouse")).toEqual([]);
    expect(auditOf(typed, "Untyped")).toEqual([]);
  });

  it("audits every class type under a role that specializes a kind", () => {
    const outcomes = A.map(GufoClassType.literals, (classType) => {
      const typed = hierarchy(
        [
          ["Kind", typing("Kind")],
          ["Role", typing("Role")],
          ["Subject", typing(classType)],
        ],
        [
          ["Subject", ["Role"]],
          ["Role", ["Kind"]],
        ]
      );
      return [classType, A.map(auditOf(typed, "Subject"), (violation) => violation._tag)] as const;
    });
    expect(outcomes).toEqual([
      ["Kind", ["RigidSpecializesAntiRigid"]],
      ["SubKind", ["RigidSpecializesAntiRigid"]],
      ["Category", ["RigidSpecializesAntiRigid"]],
      ["Role", []],
      ["Phase", []],
      ["RoleMixin", []],
      ["PhaseMixin", []],
      ["Mixin", []],
    ]);
  });

  it.effect("encodes typings and hierarchies in IRI order and refuses mediation outside relators", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GufoTypings)(
        HashMap.make([term("b"), typing("Category")], [term("a"), typing("Kind")])
      );
      expect(A.map(encoded, ([iri]) => iri)).toEqual([term("a"), term("b")]);
      const typed = hierarchy([], [["c", ["b", "a"]]]);
      const encodedHierarchy = yield* S.encodeEffect(TypedHierarchy)(typed);
      expect(encodedHierarchy.specializes).toEqual([[term("c"), [term("a"), term("b")]]]);
      const decode = S.decodeUnknownOption(GufoTyping);
      expect(O.isNone(decode({ classType: "Kind", instanceCategory: "Relator", mediates: [] }))).toBe(true);
      expect(O.isNone(decode({ classType: "Kind", instanceCategory: "Object", mediates: [[term("a"), 1]] }))).toBe(
        true
      );
      expect(O.isNone(decode({ classType: "Kind", instanceCategory: "Relator", mediates: [[term("a"), 0]] }))).toBe(
        true
      );
      expect(
        O.map(decode({ classType: "Kind", instanceCategory: "Relator", mediates: [[term("a"), 2]] }), (value) =>
          HashMap.get(value.mediates, term("a"))
        )
      ).toEqual(O.some(O.some(2)));
    })
  );
});
