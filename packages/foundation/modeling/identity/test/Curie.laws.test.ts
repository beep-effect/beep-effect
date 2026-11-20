import { fcRuns } from "@beep/fc-runs";
import { RegistryVocab } from "@beep/identity/internal/generated/Registry.data";
import { SafePnLocal, SafePnPrefix } from "@beep/identity/PnLocal";
import { CurieFromIri, contract, expand, view } from "@beep/identity/Registry";
import { Namespace, RegistryShard, RegistryTable, TermLocal } from "@beep/identity/Term";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import snapshot from "../registry/term-snapshot.json" with { type: "json" };
import type * as O from "effect/Option";

const runs = { arbitrary: fcRuns(100) };

// Widen a branded result so it compares with a plain string literal.
const widen = (value: O.Option<string>): O.Option<string> => value;

const decodeNamespace = S.decodeResult(Namespace);
const decodeLocal = S.decodeResult(TermLocal);
const decodeShard = S.decodeResult(RegistryShard);
const decodeCurie = S.decodeResult(CurieFromIri);
const encodeCurie = S.encodeResult(CurieFromIri);

// Every registered term of the generated registry, as `[curie, iri]`.
const registeredTerms: ReadonlyArray<readonly [string, string]> = A.flatMap(
  R.toEntries(RegistryVocab),
  ([prefix, entry]) => A.map(entry.terms, (local: string) => [`${prefix}:${local}`, `${entry.iri}${local}`] as const)
);

const namespaceArbitrary = pipe(
  Arbitrary.all({
    prefix: Arbitrary.schema(SafePnPrefix),
    host: Arbitrary.schema(SafePnPrefix),
    separator: Arbitrary.schema(S.Literals(["/", "#"])),
  }),
  Arbitrary.filterMap(({ prefix, host, separator }) =>
    decodeNamespace({ prefix, iri: `https://${host}.example/${prefix}${separator}` })
  )
);

const localArbitrary = pipe(
  Arbitrary.array(Arbitrary.schema(SafePnLocal), { minLength: 1, maxLength: 3 }),
  Arbitrary.filterMap((segments) => decodeLocal(A.join(segments, "/")))
);

const shardSeedArbitrary = Arbitrary.all({
  namespace: namespaceArbitrary,
  locals: Arbitrary.array(localArbitrary, { maxLength: 6 }),
});

// A shard decodes only when every local forms an IRI under its namespace.
const shardOf = (namespace: Namespace, locals: ReadonlyArray<string>) =>
  decodeShard({
    namespace: { prefix: namespace.prefix, iri: namespace.iri },
    terms: A.sort(A.dedupe(locals), Order.String),
    bindings: [],
    deprecations: [],
  });

// A generated registry built with the production constructors: a parent namespace, up to
// three others, and one nested under the parent, whose IRI is the parent IRI followed by a
// segment and "/", so contraction must be exact rather than longest-prefix.
const registryArbitrary = pipe(
  Arbitrary.all({
    parent: shardSeedArbitrary,
    others: Arbitrary.array(shardSeedArbitrary, { maxLength: 3 }),
    nestedPrefix: Arbitrary.schema(SafePnPrefix),
    nestedSegment: Arbitrary.schema(SafePnLocal),
    nestedLocals: Arbitrary.array(localArbitrary, { maxLength: 6 }),
    stranger: localArbitrary,
  }),
  Arbitrary.filterMap(({ parent, others, nestedPrefix, nestedSegment, nestedLocals, stranger }) =>
    Result.all([
      shardOf(parent.namespace, parent.locals),
      ...A.map(others, ({ namespace, locals }) => shardOf(namespace, locals)),
      pipe(
        decodeNamespace({ prefix: nestedPrefix, iri: `${parent.namespace.iri}${nestedSegment}/` }),
        Result.flatMap((nested) => shardOf(nested, nestedLocals))
      ),
    ]).pipe(
      Result.flatMap(RegistryTable.fromShards),
      Result.map((table) => ({ table, stranger }))
    )
  )
);

describe("Curie laws", () => {
  it("L0-1 expand then contract is the identity on every registered term", () => {
    expect(registeredTerms.length).toBe(snapshot.terms.length - snapshot.namespaces.length);
    for (const [curie, iri] of registeredTerms) {
      assertSome(widen(expand(curie)), iri);
      assertSome(widen(contract(iri)), curie);
      const decoded = decodeCurie(curie).pipe(Result.getOrThrow);
      expect(decoded).toBe(iri);
      expect(encodeCurie(decoded).pipe(Result.getOrThrow)).toBe(curie);
    }
  });

  it("L0-1 the registry is a closed world for CURIEs and IRIs", () => {
    assertNone(expand("skos:notATerm"));
    assertNone(expand("unknown:Thing"));
    assertNone(expand("skos"));
    assertNone(contract("http://www.w3.org/2004/02/skos/core#"));
    assertNone(contract("http://www.w3.org/2004/02/skos/core#notATerm"));
    assertTrue(decodeCurie("skos:notATerm").pipe(Result.isFailure));
    assertTrue(S.encodeUnknownResult(CurieFromIri)("http://example.test/notATerm").pipe(Result.isFailure));
  });

  it("L0-1 acceptance terms of the external namespaces expand and contract back", () => {
    const accepted = [
      ["rdf:type", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"],
      ["rdfs:subClassOf", "http://www.w3.org/2000/01/rdf-schema#subClassOf"],
      ["owl:Class", "http://www.w3.org/2002/07/owl#Class"],
      ["skos:prefLabel", "http://www.w3.org/2004/02/skos/core#prefLabel"],
      ["dcterms:ISO639-2", "http://purl.org/dc/terms/ISO639-2"],
      ["dcat:Dataset", "http://www.w3.org/ns/dcat#Dataset"],
      ["doco:Section", "http://purl.org/spar/doco/Section"],
      ["cito:cites", "http://purl.org/spar/cito/cites"],
    ] as const;
    for (const [curie, iri] of accepted) {
      assertSome(widen(expand(curie)), iri);
      assertSome(widen(contract(iri)), curie);
    }
  });

  it("L0-1 a multi-segment local and a nested namespace contract exactly", () => {
    const shards = Result.all([
      decodeShard({
        namespace: { prefix: "qa", iri: "https://beep-effect.com/ns/qa/" },
        terms: ["evidence", "receipts/accepted/v2"],
        bindings: [],
        deprecations: [],
      }),
      decodeShard({
        namespace: { prefix: "receipts", iri: "https://beep-effect.com/ns/qa/receipts/" },
        terms: ["delivered/v2"],
        bindings: [],
        deprecations: [],
      }),
    ]).pipe(Result.getOrThrow);
    const registry = view(RegistryTable.fromShards(shards).pipe(Result.getOrThrow));
    assertSome(widen(registry.expand("qa:receipts/accepted/v2")), "https://beep-effect.com/ns/qa/receipts/accepted/v2");
    assertSome(
      widen(registry.contract("https://beep-effect.com/ns/qa/receipts/accepted/v2")),
      "qa:receipts/accepted/v2"
    );
    assertSome(
      widen(registry.contract("https://beep-effect.com/ns/qa/receipts/delivered/v2")),
      "receipts:delivered/v2"
    );
    assertNone(registry.expand("qa:receipts/delivered/v2"));
    assertNone(registry.contract("https://beep-effect.com/ns/qa/receipts/"));
  });

  it.prop(
    "L0-1 expand then contract is the identity on every term of a generated registry",
    [registryArbitrary],
    ([{ table }]) => {
      const registry = view(table);
      for (const term of table.terms) {
        const curie = `${term.namespace}:${term.local}`;
        assertSome(widen(registry.expand(curie)), term.iri);
        assertSome(widen(registry.contract(term.iri)), curie);
      }
    },
    runs
  );

  it.prop(
    "L0-1 an unregistered local of a registered namespace expands to None",
    [registryArbitrary],
    ([{ table, stranger }]) => {
      const registry = view(table);
      for (const namespace of table.namespaces) {
        const declared = A.some(table.terms, (term) => term.namespace === namespace.prefix && term.local === stranger);
        const expanded = registry.expand(`${namespace.prefix}:${stranger}`);
        if (declared) {
          assertSome(widen(expanded), `${namespace.iri}${stranger}`);
        } else {
          assertNone(expanded);
        }
      }
    },
    runs
  );
});
