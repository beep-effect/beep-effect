import { RegistryBindings, RegistryDeprecations, RegistryVocab } from "@beep/identity/internal/generated/Registry.data";
import { TermSnapshot } from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import snapshot from "../registry/term-snapshot.json" with { type: "json" };
import type { Curie, Expand } from "@beep/identity/Vocab";

const sorted = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(values, Order.String);

describe("generated registry data", () => {
  it("keeps the VocabShape type helpers working over the generated literals", () => {
    expectTypeOf<"skos:prefLabel" extends Curie<typeof RegistryVocab> ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"doco:Section" extends Curie<typeof RegistryVocab> ? true : false>().toEqualTypeOf<true>();
    expectTypeOf<"skos:prefLabl" extends Curie<typeof RegistryVocab> ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<Expand<"cito:cites", typeof RegistryVocab>>().toEqualTypeOf<"http://purl.org/spar/cito/cites">();
  });

  it("binds the 16 research-library classes and the 7 test-runner identities and deprecates 113 retired IRIs", () => {
    expect(R.keys(RegistryBindings)).toHaveLength(23);
    const boundPrefix = (curie: string) =>
      Str.startsWith("research-library:")(curie) || Str.startsWith("vitest:")(curie);
    expect(A.every(R.values(RegistryBindings), (binding) => boundPrefix(binding.curie))).toBe(true);
    expect(R.keys(RegistryDeprecations)).toHaveLength(113);
  });

  it("publishes the term snapshot at release 2.4.0 with every term and namespace IRI", () => {
    const decoded = Result.getOrThrow(S.decodeUnknownResult(TermSnapshot)(snapshot));
    expect(
      decoded.release,
      "Main publishes 2.0.0, where every binding and deprecation records since 2.0.0. The annotation layer only adds terms, so it is a minor release."
    ).toBe("2.4.0");
    expect(
      A.dedupe(
        A.appendAll(
          A.map(decoded.bindings, (row) => row.since),
          A.map(decoded.deprecations, (row) => row.since)
        )
      )
    ).toStrictEqual(["2.0.0"]);
    expect(
      decoded.terms,
      "schema:Athlete left the schema shard before the first snapshot, so it is neither live nor deprecated."
    ).not.toContain("https://schema.org/Athlete");
    expect(A.map(decoded.deprecations, (row): string => row.term)).not.toContain("https://schema.org/Athlete");
    expect(A.map(decoded.namespaces, (namespace) => namespace.prefix)).toStrictEqual(sorted(R.keys(RegistryVocab)));
    const published = A.flatMap(
      R.values(RegistryVocab),
      (entry): ReadonlyArray<string> => [entry.iri, ...A.map(entry.terms, (term) => `${entry.iri}${term}`)]
    );
    expect(decoded.terms).toStrictEqual(sorted(published));
    expect(A.map(decoded.bindings, (binding) => binding.code)).toStrictEqual(sorted(R.keys(RegistryBindings)));
    expect(A.map(decoded.deprecations, (deprecation) => deprecation.term)).toStrictEqual(
      sorted(R.keys(RegistryDeprecations))
    );
  });
});
