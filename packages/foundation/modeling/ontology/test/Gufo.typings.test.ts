import { TermIri } from "@beep/identity/Term";
import { auditStated, GufoTyping, typingsFromDataset } from "@beep/ontology/Gufo";
import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { Quad } from "@beep/rdf/Rdf";

const GUFO = "http://purl.org/nemo/gufo#";
const OWL = "http://www.w3.org/2002/07/owl#";
const SUBCLASS_OF = makeNamedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf");
const named = (local: string) => makeNamedNode(`https://example.test/onto/${local}`);
const gufo = (local: string) => makeNamedNode(`${GUFO}${local}`);
const owl = (local: string) => makeNamedNode(`${OWL}${local}`);
const term = (local: string) => TermIri.make(`https://example.test/onto/${local}`);
const typed = (local: string, classType: string) => makeQuad(named(local), RDF_TYPE, gufo(classType));
const sub = (local: string, supertype: string) => makeQuad(named(local), SUBCLASS_OF, named(supertype));
const subGufo = (local: string, supertype: string) => makeQuad(named(local), SUBCLASS_OF, gufo(supertype));
const sameTyping = S.toEquivalence(GufoTyping);

const tagsOf = (quads: ReadonlyArray<Quad>, local: string) =>
  A.map(auditStated(typingsFromDataset(makeDataset(quads)))(term(local)), (violation) => violation._tag);

const typingOf = (quads: ReadonlyArray<Quad>, local: string) =>
  HashMap.get(typingsFromDataset(makeDataset(quads)).hierarchy.typing, term(local));

const mediation = (relator: string, restriction: string, quads: ReadonlyArray<Quad>) => {
  const node = makeBlankNode(restriction);
  return [
    makeQuad(named(relator), SUBCLASS_OF, node),
    makeQuad(node, owl("onProperty"), gufo("mediates")),
    ...A.map(quads, (quad) => makeQuad(node, quad.predicate, quad.object)),
  ];
};

describe("typingsFromDataset", () => {
  it("reads one gUFO class type and the default Object category", () => {
    expect(
      O.exists(typingOf([typed("Person", "Kind")], "Person"), (typing) =>
        sameTyping(
          typing,
          GufoTyping.make({ classType: "Kind", instanceCategory: "Object", mediates: HashMap.empty() })
        )
      )
    ).toBe(true);
  });

  it("leaves a term with no or several gUFO class types untyped", () => {
    const quads = [typed("Both", "Kind"), typed("Both", "Role"), makeQuad(named("Plain"), RDF_TYPE, owl("Class"))];
    assertNone(typingOf(quads, "Both"));
    assertNone(typingOf(quads, "Plain"));
    expect(tagsOf(quads, "Both")).toEqual([]);
  });

  it("reads the instance category from the subclass closure", () => {
    const quads = [typed("Talk", "Kind"), sub("Talk", "Happening"), subGufo("Happening", "Event")];
    assertSome(
      O.map(typingOf(quads, "Talk"), (typing) => typing.instanceCategory),
      "Event"
    );
    assertSome(
      O.map(typingOf([typed("Mass", "Kind"), subGufo("Mass", "Quality")], "Mass"), (typing) => typing.instanceCategory),
      "Quality"
    );
  });

  it("states only named non-gUFO specializations", () => {
    const stated = typingsFromDataset(
      makeDataset([typed("Student", "Role"), sub("Student", "Person"), subGufo("Student", "Object")])
    );
    assertSome(
      O.map(HashMap.get(stated.hierarchy.specializes, term("Student")), (supertypes) => A.fromIterable(supertypes)),
      [term("Person")]
    );
  });

  it("reports a role without a kind and accepts a role under a kind", () => {
    expect(tagsOf([typed("Student", "Role")], "Student")).toEqual(["RoleWithoutKind"]);
    expect(tagsOf([typed("Student", "Role"), typed("Person", "Kind"), sub("Student", "Person")], "Student")).toEqual(
      []
    );
    expect(tagsOf([typed("Student", "Role"), sub("Student", "Person")], "Student")).toEqual([]);
  });

  it("reports a rigid term under an anti-rigid one", () => {
    expect(tagsOf([typed("Man", "SubKind"), typed("Adult", "Phase"), sub("Man", "Adult")], "Man")).toEqual([
      "RigidSpecializesAntiRigid",
    ]);
  });

  it("reads relator mediations from someValuesFrom and qualified cardinalities", () => {
    const quads = [
      typed("Marriage", "Kind"),
      subGufo("Marriage", "Relator"),
      ...mediation("Marriage", "r1", [makeQuad(named("x"), owl("onClass"), named("Spouse"))]),
      ...mediation("Marriage", "r1", [makeQuad(named("x"), owl("qualifiedCardinality"), makeLiteral("2"))]),
      ...mediation("Marriage", "r2", [makeQuad(named("x"), owl("someValuesFrom"), named("Spouse"))]),
    ];
    assertSome(
      O.flatMap(typingOf(quads, "Marriage"), (typing) => HashMap.get(typing.mediates, term("Spouse"))),
      2
    );
    expect(tagsOf(quads, "Marriage")).toEqual([]);
  });

  it("ignores a qualified cardinality stated as a non-literal", () => {
    const quads = [
      typed("Lease", "Kind"),
      subGufo("Lease", "Relator"),
      ...mediation("Lease", "r", [makeQuad(named("x"), owl("onClass"), named("Tenant"))]),
      ...mediation("Lease", "r", [makeQuad(named("x"), owl("qualifiedCardinality"), named("Two"))]),
    ];
    assertNone(O.flatMap(typingOf(quads, "Lease"), (typing) => HashMap.get(typing.mediates, term("Tenant"))));
  });

  it("inherits mediations through the subclass closure", () => {
    const quads = [
      typed("Employment", "Kind"),
      subGufo("Employment", "Relator"),
      ...mediation("Employment", "r", [makeQuad(named("x"), owl("someValuesFrom"), named("Employee"))]),
      ...mediation("Employment", "s", [makeQuad(named("x"), owl("someValuesFrom"), named("Employer"))]),
      typed("Tenure", "SubKind"),
      sub("Tenure", "Employment"),
    ];
    expect(tagsOf(quads, "Tenure")).toEqual([]);
  });

  it("reports a relator with one mediation and a relator with none", () => {
    const single = [
      typed("Grant", "Kind"),
      subGufo("Grant", "Relator"),
      ...mediation("Grant", "r", [makeQuad(named("x"), owl("someValuesFrom"), named("Grantee"))]),
    ];
    expect(tagsOf(single, "Grant")).toEqual(["RelatorUndermediated"]);
    const none = [
      typed("Bond", "Kind"),
      subGufo("Bond", "Relator"),
      ...mediation("Bond", "r", [makeQuad(named("x"), owl("minQualifiedCardinality"), makeLiteral("zero"))]),
    ];
    const stated = typingsFromDataset(makeDataset(none));
    expect(HashSet.has(stated.unmediated, term("Bond"))).toBe(true);
    expect(tagsOf(none, "Bond")).toEqual(["RelatorUndermediated"]);
  });
});
