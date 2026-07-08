// noinspection HttpUrlsUsage

/**
 * Stage 4 of the TTL → Effect Schema codegen pipeline: produce a TS source
 * string for `packages/ontology-store/src/iris.ts` — namespace constants
 * keyed by short prefix (`EI`, `BFO`, `FOAF`, `IAO`, `RDF`, `RDFS`, `OWL`,
 * `SKOS`, `XSD`) whose values are `n3.NamedNode`s.
 *
 * Generated code shape (excerpt):
 *
 *   import { DataFactory } from "n3"
 *   const { namedNode } = DataFactory
 *   export const EI = {
 *     Expert: namedNode("https://w3id.org/energy-intel/Expert"),
 *     ...
 *   } as const
 *
 * Discovery rules:
 * - `EI` includes every class IRI under `https://w3id.org/energy-intel/`
 *   plus every property with that prefix.
 * - `BFO` includes every property under `http://purl.obolibrary.org/obo/BFO_`.
 *   Curated terms (see `BFO_ALIASES`) emit a friendly key (`bearerOf`,
 *   `inheresIn`); other terms fall back to their `BFO_NNNNNNN` segment so
 *   the writer can still reference them by raw ID.
 * - `FOAF` includes every property under `http://xmlns.com/foaf/0.1/` plus
 *   the always-needed `name`, `Person`, `Organization` terms.
 * - `RDF`, `RDFS`, `OWL`, `SKOS`, `XSD` use a fixed common-term set so the
 *   generated module always exports the predicates Task 9's writer needs to
 *   reference.
 *
 * Scope: pure function, returns a string. No file IO (Task 9 writes it).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as MutableHashMap from "effect/MutableHashMap";
import type { ClassTable } from "./parseTtl.ts";
import { R, O, Str, A, flow, pipe } from "@beep/utils";

type IriTerms = MutableHashMap.MutableHashMap<string, string>;

type IriBucket = {
  readonly terms: IriTerms;
  readonly prefix: string;
  readonly keep?: (term: string) => boolean;
  readonly key?: (term: string) => string;
};

const NS_EI = "https://w3id.org/energy-intel/";
const NS_BFO = "http://purl.obolibrary.org/obo/";
const NS_IAO = "http://purl.obolibrary.org/obo/IAO_";
const NS_FOAF = "http://xmlns.com/foaf/0.1/";
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const NS_RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const NS_OWL = "http://www.w3.org/2002/07/owl#";
const NS_SKOS = "http://www.w3.org/2004/02/skos/core#";
const NS_XSD = "http://www.w3.org/2001/XMLSchema#";

/**
 * Curated aliases for BFO terms. Generated TS source emits the mapped
 * key (`bearerOf`) instead of the raw `BFO_NNNNNNN` segment so consumers
 * read more naturally (`BFO.bearerOf` vs. `BFO.BFO_0000053`). Terms not
 * present here keep the `BFO_NNNNNNN` form as a safe fallback. Add new
 * entries as the slice ontology grows.
 */
const BFO_ALIASES: R.ReadonlyRecord<string, string> = {
  BFO_0000023: "role",
  BFO_0000027: "objectAggregate",
  BFO_0000030: "object",
  BFO_0000052: "inheresIn",
  BFO_0000053: "bearerOf"
};

// Imported IAO terms that are used by the energy-intel modules after
// import materialization. Keep these aligned with ontology_skill's
// imports-manifest.yaml / validation/merged-data.ttl; do not patch local
// EI predicates into the vendored TTLs to stand in for them.
const IAO_TERMS: R.ReadonlyRecord<string, string> = {
  document: `${NS_IAO}0000310`,
  image: `${NS_IAO}0000101`,
  informationContentEntity: `${NS_IAO}0000030`,
  isAbout: `${NS_IAO}0000136`,
  mentionedBy: `${NS_IAO}0000143`,
  mentions: `${NS_IAO}0000142`,
  textualEntity: `${NS_IAO}0000300`
};

/**
 * Trailing segment of `iri` after `prefix`, or `Option.none` if `iri` does not
 * begin with `prefix`. Used to bucket each class/property IRI into its
 * namespace below.
 */
const stripPrefix = (iri: string, prefix: string): O.Option<string> =>
  pipe(
    iri,
    O.liftPredicate(Str.startsWith(prefix)),
    O.map(Str.slice(prefix.length))
  );

const TypeScriptIdentifierName = /^[A-Za-z_$][0-9A-Za-z_$]*$/u;

const renderPropertyKey = (term: string): string =>
  TypeScriptIdentifierName.test(term) ? term : JSON.stringify(term);

const renderStringLiteral = (value: string): string => JSON.stringify(value);

const renderEntry = (term: string, fullIri: string): string =>
  `  ${renderPropertyKey(term)}: namedNode(${renderStringLiteral(fullIri)}),`;

const bfoAlias = (term: string): string => pipe(
  R.get(BFO_ALIASES, term),
  O.getOrElse(() => term)
);

const bucketIri =
  (bucket: IriBucket) =>
  (iri: string): void => {
    const keep = bucket.keep ?? (() => true);
    const key = bucket.key ?? ((term: string) => term);
    pipe(
      stripPrefix(iri, bucket.prefix),
      O.filter(keep),
      O.map((tail) => MutableHashMap.set(bucket.terms, key(tail), iri)),
      O.asVoid
    );
  };

const sortedTermKeys: (terms: IriTerms) => ReadonlyArray<string> = flow(
  MutableHashMap.keys,
  A.fromIterable,
  A.sort(Str.Order)
);

const renderConst = (
  name: string,
  prefix: string,
  terms: IriTerms
): string => {
  const body = pipe(
    sortedTermKeys(terms),
    A.map((term) => renderEntry(
      term,
      pipe(
        MutableHashMap.get(terms, term),
        O.getOrElse(() => `${prefix}${term}`)
      )
    )),
    A.join("\n")
  );
  return `export const ${name} = {\n${body}\n} as const;\n`;
};

/**
 * Emit TypeScript source for generated ontology IRI constants.
 *
 * @remarks
 * The returned string is deterministic for a given {@link ClassTable}: terms
 * are sorted by key within each namespace constant, and missing standard
 * namespace terms are injected explicitly.
 *
 * @example
 * ```ts
 * import * as Str from "effect/String"
 * import { emitIrisModule } from "./emitIrisModule.ts"
 * import { ClassTable } from "./parseTtl.ts"
 *
 * const source = emitIrisModule(ClassTable.make({
 *   classes: [],
 *   prefixes: {}
 * }))
 * console.log(Str.includes("export const RDF")(source))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const emitIrisModule = (table: ClassTable): string => {
  // Maps from short term name to full IRI. Using a MutableHashMap preserves the
  // canonical IRI for each term (e.g. for BFO_0000053 the local name is
  // already the full segment) while still letting us de-dup by short name.
  const ei = MutableHashMap.empty<string, string>();
  const bfo = MutableHashMap.empty<string, string>();
  const foaf = MutableHashMap.empty<string, string>();
  const iao = MutableHashMap.fromIterable(R.toEntries(IAO_TERMS));
  const bucketEi = bucketIri({terms: ei, prefix: NS_EI});
  const bucketBfo = bucketIri({
    terms: bfo,
    prefix: NS_BFO,
    keep: Str.startsWith("BFO_"),
    key: bfoAlias,
  });
  const bucketFoaf = bucketIri({terms: foaf, prefix: NS_FOAF});

  for (const propertyIri of table.declaredProperties) {
    pipe(propertyIri, bucketEi);
    pipe(propertyIri, bucketBfo);
    pipe(propertyIri, bucketFoaf);
  }

  for (const cls of table.classes) {
    pipe(cls.iri, bucketEi);

    for (const prop of cls.properties) {
      pipe(prop.iri, bucketEi);

      // Only keep BFO_NNNNNNN form (skip e.g. RO_, IAO_) — the slice ontology
      // only references BFO terms, but the namespace bucket is `purl.obo`
      // shared. Filter by the conventional BFO_ prefix. Apply the curated
      // alias table when present so generated source reads `BFO.bearerOf`
      // instead of `BFO.BFO_0000053`; otherwise keep the raw segment.
      pipe(prop.iri, bucketBfo);
      pipe(prop.iri, bucketFoaf);
    }

    // BFO terms in agent.ttl (and similar TTLs) only appear inside
    // owl:Restriction.onProperty references on owl:equivalentClass — they are
    // not declared as owl:ObjectProperty, so cls.properties[] never sees them.
    // Walk the restrictions to surface those IRIs as well.
    for (const restriction of cls.equivalentClassRestrictions) {
      pipe(restriction.onProperty, bucketBfo);
    }
  }

  // Always-on FOAF terms the writer needs even if the slice ontology didn't
  // surface them as properties.
  for (const term of A.make("name", "Person", "Organization")) {
    if (!MutableHashMap.has(foaf, term)) MutableHashMap.set(foaf, term, `${NS_FOAF}${term}`);
  }

  // Always-on BFO role-pattern terms — needed by every entity module using
  // the BFO role-bearer pattern (Expert, Organization, etc.). parseTtl
  // surfaces these only when they appear as owl:ObjectProperty or in
  // owl:equivalentClass restrictions; rdfs:subClassOf restrictions are
  // not walked, so include the canonical pair unconditionally.
  for (const bfoId of A.make("BFO_0000052", "BFO_0000053")) {
    const key = bfoAlias(bfoId);
    if (!MutableHashMap.has(bfo, key)) MutableHashMap.set(bfo, key, `${NS_BFO}${bfoId}`);
  }

  let lines = A.make(
    "// Generated by packages/ontology-store/scripts/generate-from-ttl.ts.",
    "// Do not edit by hand.",
    "",
    `import { DataFactory } from "n3";`,
    "",
    "const { namedNode } = DataFactory;",
    ""
  );

  lines = A.append(lines, renderConst("EI", NS_EI, ei));
  lines = A.append(lines, renderConst("BFO", NS_BFO, bfo));
  lines = A.append(lines, renderConst("FOAF", NS_FOAF, foaf));
  lines = A.append(lines, renderConst("IAO", NS_IAO, iao));

  // Standard namespaces ship a fixed set of common terms — Task 9's writer
  // only references these few and there's no ontology signal to grow them
  // dynamically.
  const stdRdf = MutableHashMap.make(
    ["type", `${NS_RDF}type`],
    ["first", `${NS_RDF}first`],
    ["rest", `${NS_RDF}rest`],
    ["nil", `${NS_RDF}nil`]
  );
  const stdRdfs = MutableHashMap.make(
    ["label", `${NS_RDFS}label`],
    ["subClassOf", `${NS_RDFS}subClassOf`]
  );
  const stdOwl = MutableHashMap.make(
    ["Class", `${NS_OWL}Class`],
    ["Restriction", `${NS_OWL}Restriction`]
  );
  const stdSkos = MutableHashMap.make(
    ["definition", `${NS_SKOS}definition`]
  );
  const stdXsd = MutableHashMap.make(
    ["string", `${NS_XSD}string`],
    ["integer", `${NS_XSD}integer`],
    ["dateTime", `${NS_XSD}dateTime`]
  );

  lines = A.append(lines, renderConst("RDF", NS_RDF, stdRdf));
  lines = A.append(lines, renderConst("RDFS", NS_RDFS, stdRdfs));
  lines = A.append(lines, renderConst("OWL", NS_OWL, stdOwl));
  lines = A.append(lines, renderConst("SKOS", NS_SKOS, stdSkos));
  lines = A.append(lines, renderConst("XSD", NS_XSD, stdXsd));

  return pipe(lines, A.join("\n"));
};
