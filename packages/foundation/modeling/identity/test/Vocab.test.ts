import { IdentityAuthority } from "@beep/identity/Authority";
import { RegistryVocab } from "@beep/identity/Registry";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { Curie, Expand, Predicate } from "@beep/identity/Vocab";

type RegistryCurie = Curie<typeof RegistryVocab>;
type RegistryPredicate = Predicate<typeof RegistryVocab>;

describe("Vocab literal types over the generated registry", () => {
  it("derives CURIE literals from the registry data", () => {
    expectTypeOf<"skos:prefLabel" extends RegistryCurie ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"skos:prefLabl" extends RegistryCurie ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<"dcterms:creator" extends RegistryCurie ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"doco:Section" extends RegistryCurie ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"cito:unknown" extends RegistryCurie ? true : false>().toEqualTypeOf<false>();
  });

  it("expands CURIE literals to exact namespace IRIs", () => {
    expectTypeOf<
      Expand<"skos:prefLabel", typeof RegistryVocab>
    >().toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#prefLabel">();
    expectTypeOf<Expand<"fabio:Report", typeof RegistryVocab>>().toEqualTypeOf<"http://purl.org/spar/fabio/Report">();
    expectTypeOf<Expand<"skos:prefLabl", typeof RegistryVocab>>().toEqualTypeOf<never>();
  });

  it("accepts inverse predicates only for known CURIEs", () => {
    expectTypeOf<"^rdfs:subClassOf" extends RegistryPredicate ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"^rdfs:subClasOf" extends RegistryPredicate ? true : false>().toEqualTypeOf<false>();
  });

  it("derives the union of a vocabulary extension", () => {
    const extension = { ex: { iri: "https://example.test/ns#", terms: ["Thing"] } } as const;

    expectTypeOf<Curie<typeof extension>>().toEqualTypeOf<"ex:Thing">();
    expectTypeOf<Curie<typeof RegistryVocab & typeof extension>>().toEqualTypeOf<RegistryCurie | "ex:Thing">();
  });
});

describe("generated registry vocabulary invariants", () => {
  it("uses namespace IRIs ending in # or /", () => {
    for (const [prefix, entry] of R.toEntries(RegistryVocab)) {
      expect(Str.endsWith("#")(entry.iri) || Str.endsWith("/")(entry.iri), prefix).toBe(true);
    }
  });

  it("lists every namespace's terms strictly ascending, so no term repeats", () => {
    for (const [prefix, entry] of R.toEntries(RegistryVocab)) {
      const terms: ReadonlyArray<string> = entry.terms;
      // An internal namespace may declare no term: instances are minted under it (semantica, lejeune).
      const internal = Str.startsWith(IdentityAuthority)(entry.iri);

      expect(internal || terms.length > 0, prefix).toBe(true);
      expect(A.dedupe(A.sort(terms, Order.String)), prefix).toStrictEqual(terms);
    }
  });

  it("keeps the curated SPAR inventories", () => {
    expect(RegistryVocab.doco.iri).toBe("http://purl.org/spar/doco/");
    expect(RegistryVocab.deo.terms).toEqual(["Introduction", "Methods"]);
    expect(RegistryVocab.cito.terms).toEqual(["cites", "citesAsEvidence"]);
  });
});
