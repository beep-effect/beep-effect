import { flow, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { contract } from "./Curie.ts";
import type { AssembledClass, AssembledFact, AssembledOntology, AssembledPredicate, FactObject } from "./Ontology.ts";
import { prefixedNameOrIri } from "./PnLocal.ts";
import { CoreVocab } from "./Vocab.ts";

type JsonLdId = { readonly "@id": string };
type JsonLdValue = { readonly "@value": string | number | boolean; readonly "@type"?: string; readonly "@language"?: string };
type JsonLdNodeValue = JsonLdId | JsonLdValue;
type JsonLdTerm =
  | string
  | {
      readonly "@id"?: string;
      readonly "@reverse"?: string;
      readonly "@type"?: "@id";
      readonly "@prefix"?: true;
    };
type JsonLdContext = R.ReadonlyRecord<string, JsonLdTerm>;
type JsonLdNode = {
  readonly "@id": string;
  readonly "@type"?: string;
  readonly "@reverse"?: R.ReadonlyRecord<string, ReadonlyArray<JsonLdNodeValue>>;
} & R.ReadonlyRecord<string, unknown>;
type CorePrefix = { readonly prefix: string; readonly iri: string };

const RDFS_CLASS = "http://www.w3.org/2000/01/rdf-schema#Class";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain";
const RDFS_RANGE = "http://www.w3.org/2000/01/rdf-schema#range";
const RDFS_LITERAL = "http://www.w3.org/2000/01/rdf-schema#Literal";
const OWL_DATATYPE_PROPERTY = "http://www.w3.org/2002/07/owl#DatatypeProperty";
const OWL_OBJECT_PROPERTY = "http://www.w3.org/2002/07/owl#ObjectProperty";

const corePrefixes: ReadonlyArray<CorePrefix> = [
  { prefix: "dcterms", iri: CoreVocab.dcterms.iri },
  { prefix: "owl", iri: CoreVocab.owl.iri },
  { prefix: "rdf", iri: CoreVocab.rdf.iri },
  { prefix: "rdfs", iri: CoreVocab.rdfs.iri },
  { prefix: "skos", iri: CoreVocab.skos.iri },
];

const withNamespaceSeparator = (iri: string): string =>
  pipe(iri, Str.endsWith("/")) || pipe(iri, Str.endsWith("#")) ? iri : `${iri}/`;

const prefixFromCurie = (curie: string): O.Option<string> =>
  pipe(
    curie,
    Str.indexOf(":"),
    O.map((separator) => pipe(curie, Str.slice(0, separator))),
    O.filter(Str.isNonEmpty)
  );

const ownedPrefix = (ontology: AssembledOntology): string => {
  if (P.isString(ontology.prefix) && Str.isNonEmpty(ontology.prefix)) {
    return ontology.prefix;
  }

  return pipe(
    ontology.classes,
    A.findFirst((ontologyClass) => O.isSome(prefixFromCurie(ontologyClass.curie))),
    O.flatMap((ontologyClass) => prefixFromCurie(ontologyClass.curie)),
    O.getOrElse(() => "beep")
  );
};

const localFromNamespace = (namespace: string, iri: string): O.Option<string> =>
  pipe(iri, Str.startsWith(namespace)) ? O.some(pipe(iri, Str.slice(Str.length(namespace)))) : O.none();

const compactCore = (iri: string): O.Option<string> => O.fromUndefinedOr(contract(iri));

const compactOwned = (ontology: AssembledOntology, iri: string): O.Option<string> =>
  pipe(
    localFromNamespace(withNamespaceSeparator(ontology.baseIri), iri),
    O.map((local) => `${ownedPrefix(ontology)}:${local}`)
  );

const compactJsonLdIri = (ontology: AssembledOntology, iri: string): string =>
  pipe(
    compactCore(iri),
    O.orElse(() => compactOwned(ontology, iri)),
    O.getOrElse(() => iri)
  );

const predicateContextTerm = (predicate: AssembledPredicate): JsonLdTerm => {
  if (predicate.reverse === true) {
    return predicate.kind === "object" ? { "@reverse": predicate.termIri, "@type": "@id" } : { "@reverse": predicate.termIri };
  }

  return predicate.kind === "object" ? { "@id": predicate.termIri, "@type": "@id" } : predicate.termIri;
};

const classContextEntries = (classes: ReadonlyArray<AssembledClass>): ReadonlyArray<readonly [string, JsonLdTerm]> =>
  pipe(
    classes,
    A.map((ontologyClass) => [ontologyClass.name, { "@id": ontologyClass.iri }] as const)
  );

const predicateContextEntries = (classes: ReadonlyArray<AssembledClass>): ReadonlyArray<readonly [string, JsonLdTerm]> =>
  pipe(
    classes,
    A.flatMap((ontologyClass) =>
      pipe(
        ontologyClass.predicates,
        A.map((predicate) => [predicate.key, predicateContextTerm(predicate)] as const)
      )
    )
  );

const prefixTerm = (iri: string): JsonLdTerm => ({ "@id": iri, "@prefix": true });

export const toContext = (ontology: AssembledOntology): JsonLdContext =>
  R.fromEntries([
    ["@vocab", ontology.baseIri],
    [ownedPrefix(ontology), prefixTerm(withNamespaceSeparator(ontology.baseIri))],
    ...pipe(
      corePrefixes,
      A.map(({ prefix, iri }) => [prefix, prefixTerm(iri)] as const)
    ),
    ...classContextEntries(ontology.classes),
    ...predicateContextEntries(ontology.classes),
  ]);

const jsonLdValue = (object: FactObject): JsonLdNodeValue =>
  P.isString(object)
    ? { "@id": object }
    : {
        "@value": object.value,
        ...R.getSomes({
          "@type": O.fromUndefinedOr(object.datatypeIri),
          "@language": O.fromUndefinedOr(object.language),
        }),
      };

const valuesFor = (
  facts: ReadonlyArray<AssembledFact>,
  ontology: AssembledOntology,
  subjectIri: string,
  reverse: boolean
): ReadonlyArray<readonly [string, ReadonlyArray<JsonLdNodeValue>]> =>
  pipe(
    facts,
    A.filter((fact) => fact.subjectIri === subjectIri && (fact.reverse === true) === reverse),
    A.reduce([] as Array<readonly [string, Array<JsonLdNodeValue>]>, (entries, fact) => {
      const key = compactJsonLdIri(ontology, fact.predicateIri);
      const existing = pipe(
        entries,
        A.findFirst(([entryKey]) => entryKey === key)
      );

      if (O.isSome(existing)) {
        existing.value[1].push(jsonLdValue(fact.object));
        return entries;
      }

      entries.push([key, [jsonLdValue(fact.object)]]);
      return entries;
    })
  );

const classNode = (ontology: AssembledOntology, ontologyClass: AssembledClass): JsonLdNode => {
  const facts = valuesFor(ontology.facts, ontology, ontologyClass.iri, false);
  const reverseFacts = valuesFor(ontology.facts, ontology, ontologyClass.iri, true);
  const optionalFields: Record<string, unknown> = {};

  if (ontologyClass.description !== undefined) {
    optionalFields["rdfs:comment"] = ontologyClass.description;
  }

  if (A.length(reverseFacts) > 0) {
    optionalFields["@reverse"] = R.fromEntries(reverseFacts);
  }

  return {
    "@id": ontologyClass.iri,
    "@type": "rdfs:Class",
    "rdfs:label": ontologyClass.name,
    ...optionalFields,
    ...R.fromEntries(facts),
  };
};

const predicateNode = (ontologyClass: AssembledClass, predicate: AssembledPredicate): JsonLdNode => {
  const optionalFields: Record<string, unknown> = {};

  if (predicate.description !== undefined) {
    optionalFields["rdfs:comment"] = predicate.description;
  }

  return {
    "@id": predicate.termIri,
    "@type": predicate.kind === "object" ? "owl:ObjectProperty" : "owl:DatatypeProperty",
    "rdfs:label": predicate.key,
    "rdfs:domain": { "@id": ontologyClass.iri },
    "rdfs:range": { "@id": predicate.kind === "object" ? predicate.rangeIri ?? RDFS_LITERAL : RDFS_LITERAL },
    ...optionalFields,
  };
};

export const toJsonLd = (ontology: AssembledOntology) => ({
  "@context": toContext(ontology),
  "@graph": [
    ...pipe(ontology.classes, A.map((ontologyClass) => classNode(ontology, ontologyClass))),
    ...pipe(
      ontology.classes,
      A.flatMap((ontologyClass) =>
        pipe(
          ontologyClass.predicates,
          A.map((predicate) => predicateNode(ontologyClass, predicate))
        )
      )
    ),
  ],
});

const iriRef = (iri: string): string => `<${iri}>`;

const turtleTerm = (ontology: AssembledOntology, iri: string): string => {
  const ownedNamespace = withNamespaceSeparator(ontology.baseIri);
  const owned = pipe(
    localFromNamespace(ownedNamespace, iri),
    O.map((local) => prefixedNameOrIri(ownedPrefix(ontology), local, iri))
  );

  if (O.isSome(owned)) {
    return owned.value;
  }

  return pipe(
    corePrefixes,
    A.findFirst(({ iri: namespace }) => pipe(iri, Str.startsWith(namespace))),
    O.map(({ prefix, iri: namespace }) => prefixedNameOrIri(prefix, pipe(iri, Str.slice(Str.length(namespace))), iri)),
    O.getOrElse(() => iriRef(iri))
  );
};

const escapeTurtleLiteral: (value: string) => string = flow(
  Str.replaceAll("\\", "\\\\"),
  Str.replaceAll('"', '\\"'),
  Str.replaceAll("\n", "\\n"),
  Str.replaceAll("\t", "\\t"),
  Str.replaceAll("\r", "\\r")
);

const literalValue = (value: string | number | boolean): string =>
  P.isString(value) ? `"${escapeTurtleLiteral(value)}"` : P.isBoolean(value) ? `${value ? "true" : "false"}` : `${value}`;

const turtleObject = (ontology: AssembledOntology, object: FactObject): string => {
  if (P.isString(object)) {
    return turtleTerm(ontology, object);
  }

  const literal = literalValue(object.value);

  if (object.language !== undefined) {
    return `${literal}@${object.language}`;
  }

  return object.datatypeIri === undefined ? literal : `${literal}^^${turtleTerm(ontology, object.datatypeIri)}`;
};

const statementBlock = (subject: string, statements: ReadonlyArray<string>): string =>
  pipe(
    statements,
    A.match({
      onEmpty: () => `${subject} .`,
      onNonEmpty: (items) =>
        `${subject} ${A.headNonEmpty(items)}${pipe(
          A.tailNonEmpty(items),
          A.map((statement) => ` ;\n  ${statement}`),
          A.join("")
        )} .`,
    })
  );

const classBlock = (ontology: AssembledOntology, ontologyClass: AssembledClass): string =>
  statementBlock(turtleTerm(ontology, ontologyClass.iri), [
    `a ${turtleTerm(ontology, RDFS_CLASS)}`,
    `${turtleTerm(ontology, RDFS_LABEL)} ${literalValue(ontologyClass.name)}`,
    ...pipe(
      O.fromUndefinedOr(ontologyClass.description),
      O.map((description) => [`${turtleTerm(ontology, RDFS_COMMENT)} ${literalValue(description)}`]),
      O.getOrElse(() => [])
    ),
  ]);

const predicateBlock = (ontology: AssembledOntology, ontologyClass: AssembledClass, predicate: AssembledPredicate): string =>
  statementBlock(turtleTerm(ontology, predicate.termIri), [
    `a ${turtleTerm(ontology, predicate.kind === "object" ? OWL_OBJECT_PROPERTY : OWL_DATATYPE_PROPERTY)}`,
    `${turtleTerm(ontology, RDFS_LABEL)} ${literalValue(predicate.key)}`,
    `${turtleTerm(ontology, RDFS_DOMAIN)} ${turtleTerm(ontology, ontologyClass.iri)}`,
    `${turtleTerm(ontology, RDFS_RANGE)} ${turtleTerm(ontology, predicate.kind === "object" ? predicate.rangeIri ?? RDFS_LITERAL : RDFS_LITERAL)}`,
    ...pipe(
      O.fromUndefinedOr(predicate.description),
      O.map((description) => [`${turtleTerm(ontology, RDFS_COMMENT)} ${literalValue(description)}`]),
      O.getOrElse(() => [])
    ),
  ]);

const factStatement = (ontology: AssembledOntology, fact: AssembledFact): string => {
  const subject = fact.reverse === true && P.isString(fact.object) ? fact.object : fact.subjectIri;
  const object = fact.reverse === true && P.isString(fact.object) ? fact.subjectIri : fact.object;

  return `${turtleTerm(ontology, subject)} ${turtleTerm(ontology, fact.predicateIri)} ${turtleObject(ontology, object)} .`;
};

const prefixDefinitions = (ontology: AssembledOntology): ReadonlyArray<readonly [string, string]> => {
  const usedIris = [
    RDFS_CLASS,
    RDFS_LABEL,
    RDFS_COMMENT,
    RDFS_DOMAIN,
    RDFS_RANGE,
    RDFS_LITERAL,
    OWL_DATATYPE_PROPERTY,
    OWL_OBJECT_PROPERTY,
    ...pipe(ontology.classes, A.map((ontologyClass) => ontologyClass.iri)),
    ...pipe(
      ontology.classes,
      A.flatMap((ontologyClass) =>
        pipe(
          ontologyClass.predicates,
          A.flatMap((predicate) => [
            predicate.termIri,
            ...(predicate.rangeIri === undefined ? [] : [predicate.rangeIri]),
          ])
        )
      )
    ),
    ...pipe(
      ontology.facts,
      A.flatMap((fact) => [
        fact.subjectIri,
        fact.predicateIri,
        ...(P.isString(fact.object) ? [fact.object] : fact.object.datatypeIri === undefined ? [] : [fact.object.datatypeIri]),
      ])
    ),
  ];

  const entries: ReadonlyArray<readonly [string, string]> = [
      [ownedPrefix(ontology), withNamespaceSeparator(ontology.baseIri)] as const,
      ...pipe(
        corePrefixes,
        A.filter(({ iri }) => pipe(usedIris, A.some((usedIri) => pipe(usedIri, Str.startsWith(iri))))),
        A.map(({ prefix, iri }) => [prefix, iri] as const)
      ),
    ];

  return pipe(entries, A.sort(Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])));
};

export const toTurtle = (ontology: AssembledOntology): string => {
  const prefixes = pipe(
    prefixDefinitions(ontology),
    A.map(([prefix, iri]) => `@prefix ${prefix}: ${iriRef(iri)} .`)
  );
  const classes = pipe(ontology.classes, A.map((ontologyClass) => classBlock(ontology, ontologyClass)));
  const predicates = pipe(
    ontology.classes,
    A.flatMap((ontologyClass) =>
      pipe(
        ontologyClass.predicates,
        A.map((predicate) => predicateBlock(ontology, ontologyClass, predicate))
      )
    )
  );
  const facts = pipe(ontology.facts, A.map((fact) => factStatement(ontology, fact)));

  return pipe([...prefixes, "", ...classes, ...predicates, ...facts], A.join("\n\n"));
};
