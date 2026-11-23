import {
  bindingOf,
  iri,
  mint,
  mintEncoded,
  namespace,
  namespaceOf,
  RegistryMintError,
  replacementOf,
  view,
} from "@beep/identity/Registry";
import { RegistryShard, RegistryTable } from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const vitestIri = "https://beep-effect.com/ns/vitest/";

const widenBrandedOptionToString = (value: O.Option<string>): O.Option<string> => value;
const oldHang = "https://beep-effect.com/ns/test-utils/Vitest/TestHang";
const olderHang = "https://beep-effect.com/ns/test-utils/TestHang";
const retired = "https://beep-effect.com/ns/test-utils/Vitest/TestRetired";

const decodeShard = S.decodeResult(RegistryShard);
const viewOf = (...shards: ReadonlyArray<RegistryShard.Encoded>) =>
  view(
    Result.all(A.map(shards, (shard) => decodeShard(shard))).pipe(
      Result.flatMap(RegistryTable.fromShards),
      Result.getOrThrow
    )
  );
const iriOf = (row: { readonly iri: string }): string => row.iri;

const fixture = viewOf(
  {
    namespace: { prefix: "vitest", iri: vitestIri },
    terms: ["TestFailure", "TestHang"],
    bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
    deprecations: [
      { term: olderHang, since: "1.0.0" },
      { term: oldHang, since: "1.0.0", replacement: "TestHang" },
      { term: retired, since: "1.0.0" },
    ],
  },
  {
    namespace: { prefix: "chain", iri: "https://beep-effect.com/ns/chain/" },
    terms: ["c"],
    bindings: [],
    deprecations: [
      { term: "https://beep-effect.com/ns/chain/a", since: "1.0.0", replacement: "b" },
      { term: "https://beep-effect.com/ns/chain/b", since: "1.0.0", replacement: "c" },
    ],
  }
);

describe("Registry view", () => {
  it("looks up namespaces and bound code identities", () => {
    assertSome(widenBrandedOptionToString(O.map(fixture.namespaceOf("vitest"), iriOf)), vitestIri);
    assertNone(fixture.namespaceOf("missing"));
    assertSome(
      widenBrandedOptionToString(O.map(fixture.bindingOf("@beep/test-runner/Vitest/TestHang"), iriOf)),
      `${vitestIri}TestHang`
    );
    assertNone(fixture.bindingOf("@beep/test-runner/Vitest/TestFailure"));
  });

  it("closes deprecated terms and follows the replacement chain", () => {
    assertNone(fixture.contract(oldHang));
    assertSome(widenBrandedOptionToString(fixture.replacementOf(oldHang)), `${vitestIri}TestHang`);
    assertSome(
      widenBrandedOptionToString(fixture.replacementOf("https://beep-effect.com/ns/chain/a")),
      "https://beep-effect.com/ns/chain/c"
    );
    assertNone(fixture.replacementOf(retired));
    assertNone(fixture.replacementOf(`${vitestIri}TestHang`));
  });

  it("keeps a namespace that declares no live term", () => {
    const registry = viewOf({
      namespace: { prefix: "practice-kg", iri: "https://beep-effect.com/ns/practice-kg/" },
      terms: [],
      bindings: [],
      deprecations: [],
    });
    assertSome(
      widenBrandedOptionToString(O.map(registry.namespaceOf("practice-kg"), iriOf)),
      "https://beep-effect.com/ns/practice-kg/"
    );
    assertNone(registry.expand("practice-kg:Matter"));
  });
});

describe("generated Registry", () => {
  it("expands literal CURIEs and namespaces with their literal types", () => {
    const label = iri("rdfs:label");
    expect(label).toBe("http://www.w3.org/2000/01/rdf-schema#label");
    expectTypeOf(label).toEqualTypeOf<"http://www.w3.org/2000/01/rdf-schema#label">();
    const skos = namespace("skos");
    expect(skos).toStrictEqual({ prefix: "skos", iri: "http://www.w3.org/2004/02/skos/core#" });
    expectTypeOf(skos.iri).toEqualTypeOf<"http://www.w3.org/2004/02/skos/core#">();
    assertSome(widenBrandedOptionToString(O.map(namespaceOf("owl"), iriOf)), "http://www.w3.org/2002/07/owl#");
    assertNone(bindingOf("@beep/identity/Registry/Unbound"));
    assertNone(replacementOf("http://www.w3.org/2002/07/owl#Class"));
  });

  it("refuses a CURIE or prefix the registry does not hold when the literal type is bypassed", () => {
    expect(() => Reflect.apply(iri, undefined, ["rdfs:notATerm"])).toThrow();
    expect(() => Reflect.apply(mint, undefined, ["unknown", "x"])).toThrow();
  });

  it("mints with composer segments but refuses spaces and other non-IRI characters", () => {
    expect(mint("skos:Concept", "legal", "patent")).toBe("http://www.w3.org/2004/02/skos/core#Concept/legal/patent");
    expect(mint("dcterms", "agents", "alice")).toBe("http://purl.org/dc/terms/agents/alice");
    expect(mint("skos:Concept", "a/b")).toBe("http://www.w3.org/2004/02/skos/core#Concept/a/b");
    expect(() => mint("skos:Concept", "")).toThrow();
    expect(() => mint("skos:Concept", "/leading")).toThrow();
    expect(() => mint("skos:Concept", "trailing/")).toThrow();
    expect(() => mint("dcterms", "a b")).toThrow("Schema validation failed");
    expect(() => mint("skos:Concept", "legal", "a\u{E0001}")).toThrow("Schema validation failed");
  });

  it("mints instance IRIs from percent-encoded raw keys", () => {
    expect(mintEncoded("skos:Concept", "a b/c")).toBe("http://www.w3.org/2004/02/skos/core#Concept/a%20b%2Fc");
    expect(mintEncoded("dcterms", "x y")).toBe("http://purl.org/dc/terms/x%20y");
    expect(pipe("skos:Concept", mintEncoded("k"))).toBe("http://www.w3.org/2004/02/skos/core#Concept/k");
  });

  it("refuses to mint an IRI the registry publishes or from an empty key", () => {
    const reasonOf = (thunk: () => string) =>
      Result.match(Result.try(thunk), {
        onSuccess: () => "minted",
        onFailure: (error) => (S.is(RegistryMintError)(error) ? error.reason : "other"),
      });
    expect(reasonOf(() => mint("dcterms", "Agent"))).toBe("LiveTerm");
    expect(reasonOf(() => mint("skos", "prefLabel"))).toBe("LiveTerm");
    expect(reasonOf(() => mintEncoded("rdf", "type"))).toBe("LiveTerm");
    expect(reasonOf(() => mintEncoded("dcterms", ""))).toBe("EmptyKey");
    expect(reasonOf(() => mintEncoded("skos:Concept", ""))).toBe("EmptyKey");
    expect(() => mintEncoded("skos:Concept", "\uD800")).toThrow(URIError);
  });
});
