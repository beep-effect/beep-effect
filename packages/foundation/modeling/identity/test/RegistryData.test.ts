import { RegistryBindings, RegistryDeprecations, RegistryVocab } from "@beep/identity/internal/generated/Registry.data";
import { SparTerms } from "@beep/identity/internal/generated/SparTerms";
import { TermSnapshot } from "@beep/identity/Term";
import { CoreVocab, mergeVocab } from "@beep/identity/Vocab";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import snapshot from "../registry/term-snapshot.json" with { type: "json" };
import type { Curie, Expand } from "@beep/identity/Vocab";

// P1 plan, commits 7 and 9: every namespace of `Vocab.ts` keeps its value in the generated registry,
// which adds the pinned namespaces (prov, oa, nif, xsd, gufo, as) and sh and void, until commit 10
// deletes `CoreVocab` and `SparTerms` and this parity with them.
const legacyVocab = mergeVocab(CoreVocab, SparTerms);
const addedPrefixes = ["as", "gufo", "nif", "oa", "prov", "sh", "void", "xsd"];

const sorted = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(values, Order.String);

describe("generated registry data", () => {
  it("RegistryVocab equals mergeVocab(CoreVocab, SparTerms) on every legacy prefix", () => {
    expect(sorted(R.keys(RegistryVocab))).toStrictEqual(sorted([...R.keys(legacyVocab), ...addedPrefixes]));
    for (const [prefix, entry] of R.toEntries(legacyVocab)) {
      const generated = RegistryVocab[prefix];
      expect(generated.iri, prefix).toBe(entry.iri);
      expect(generated.terms, prefix).toStrictEqual(sorted(entry.terms));
    }
  });

  it("keeps the VocabShape type helpers working over the generated literals", () => {
    expectTypeOf<"skos:prefLabel" extends Curie<typeof RegistryVocab> ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"doco:Section" extends Curie<typeof RegistryVocab> ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"skos:prefLabl" extends Curie<typeof RegistryVocab> ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<Expand<"cito:cites", typeof RegistryVocab>>().toEqualTypeOf<"http://purl.org/spar/cito/cites">();
  });

  it("binds no code identity and deprecates no term before the internal namespaces land", () => {
    expect(R.keys(RegistryBindings)).toStrictEqual([]);
    expect(R.keys(RegistryDeprecations)).toStrictEqual([]);
  });

  it("publishes the term snapshot at release 1.1.0 with every term and namespace IRI", () => {
    const decoded = Result.getOrThrow(S.decodeUnknownResult(TermSnapshot)(snapshot));
    expect(decoded.release).toBe("1.1.0");
    expect(A.map(decoded.namespaces, (namespace) => namespace.prefix)).toStrictEqual(sorted(R.keys(RegistryVocab)));
    const published = A.flatMap(
      R.values(RegistryVocab),
      (entry): ReadonlyArray<string> => [entry.iri, ...A.map(entry.terms, (term) => `${entry.iri}${term}`)]
    );
    expect(decoded.terms).toStrictEqual(sorted(published));
    expect(decoded.bindings).toStrictEqual([]);
    expect(decoded.deprecations).toStrictEqual([]);
  });
});
