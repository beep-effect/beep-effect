/**
 * Pure JSON-LD, JSON-LD context, and Turtle projections over an assembled
 * ontology.
 *
 * Projections are catamorphisms over the assembled value: they never fail,
 * and repeated projection of the same assembly is byte-identical.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CoreVocab, contractOption, prefixedNameOrIri } from "@beep/identity";
import { O as OU } from "@beep/utils";
import { flow, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type {
  AssembledClass,
  AssembledFact,
  AssembledOntology,
  AssembledPredicate,
  FactLiteral,
  FactObject,
} from "./Fold.models.ts";

/**
 * JSON-LD term binding emitted into projected contexts.
 *
 * **Example** (Typed term binding)
 *
 * ```ts
 * import type { JsonLdTerm } from "@beep/ontology"
 *
 * const term: JsonLdTerm = { "@id": "http://www.w3.org/2004/02/skos/core#related", "@type": "@id" }
 * console.log(term)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonLdTerm =
  | string
  | {
      readonly "@id"?: string;
      readonly "@reverse"?: string;
      readonly "@type"?: "@id";
      readonly "@prefix"?: true;
    };

/**
 * JSON-LD context record emitted by {@link toContext}.
 *
 * **Example** (Vocab context record)
 *
 * ```ts
 * import type { JsonLdContext } from "@beep/ontology"
 *
 * const context: JsonLdContext = { "@vocab": "https://ns.beep.sh/patent" }
 * console.log(context)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonLdContext = R.ReadonlyRecord<string, JsonLdTerm>;

/**
 * JSON-LD node value: an `@id` reference or a typed `@value` literal.
 *
 * **Example** (Id reference value)
 *
 * ```ts
 * import type { JsonLdNodeValue } from "@beep/ontology"
 *
 * const value: JsonLdNodeValue = { "@id": "https://schema.org/CreativeWork" }
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonLdNodeValue =
  | { readonly "@id": string }
  | {
      readonly "@value": string | number | boolean;
      readonly "@type"?: string;
      readonly "@language"?: string;
    };

/**
 * JSON-LD graph node emitted by {@link toJsonLd}.
 *
 * **Example** (Graph node shape)
 *
 * ```ts
 * import type { JsonLdNode } from "@beep/ontology"
 *
 * const node: JsonLdNode = { "@id": "https://ns.beep.sh/patent/Claim" }
 * console.log(node["@id"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonLdNode = {
  readonly "@id": string;
  readonly "@type"?: string | ReadonlyArray<string>;
  readonly "@reverse"?: R.ReadonlyRecord<string, ReadonlyArray<JsonLdNodeValue>>;
} & R.ReadonlyRecord<string, unknown>;

/**
 * JSON-LD document emitted by {@link toJsonLd}.
 *
 * **Example** (Empty document shell)
 *
 * ```ts
 * import type { JsonLdDocument } from "@beep/ontology"
 *
 * const document: JsonLdDocument = { "@context": {}, "@graph": [] }
 * console.log(document["@graph"].length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonLdDocument = {
  readonly "@context": JsonLdContext;
  readonly "@graph": ReadonlyArray<JsonLdNode>;
};

const RDFS_CLASS = "http://www.w3.org/2000/01/rdf-schema#Class";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain";
const RDFS_RANGE = "http://www.w3.org/2000/01/rdf-schema#range";
const RDFS_LITERAL = "http://www.w3.org/2000/01/rdf-schema#Literal";
const OWL_DATATYPE_PROPERTY = "http://www.w3.org/2002/07/owl#DatatypeProperty";
const OWL_OBJECT_PROPERTY = "http://www.w3.org/2002/07/owl#ObjectProperty";
const SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept";
const SKOS_CONCEPT_SCHEME = "http://www.w3.org/2004/02/skos/core#ConceptScheme";

type CorePrefix = { readonly prefix: string; readonly iri: string };

const corePrefixes: ReadonlyArray<CorePrefix> = [
  { prefix: "dcterms", iri: CoreVocab.dcterms.iri },
  { prefix: "owl", iri: CoreVocab.owl.iri },
  { prefix: "rdf", iri: CoreVocab.rdf.iri },
  { prefix: "rdfs", iri: CoreVocab.rdfs.iri },
  { prefix: "skos", iri: CoreVocab.skos.iri },
];

const withNamespaceSeparator = (iri: string): string =>
  pipe(iri, Str.endsWith("/")) || pipe(iri, Str.endsWith("#")) ? iri : `${iri}/`;

const localFromNamespace = (namespace: string, iri: string): O.Option<string> =>
  pipe(iri, Str.startsWith(namespace)) ? O.some(pipe(iri, Str.slice(Str.length(namespace)))) : O.none();

const compactCore = (iri: string): O.Option<string> => contractOption(iri, CoreVocab);

const compactOwned = (ontology: AssembledOntology, iri: string): O.Option<string> =>
  pipe(
    localFromNamespace(withNamespaceSeparator(ontology.baseIri), iri),
    O.map((local) => `${ontology.prefix}:${local}`)
  );

const compactIri = (ontology: AssembledOntology, iri: string): string =>
  pipe(
    compactCore(iri),
    O.orElse(() => compactOwned(ontology, iri)),
    O.getOrElse(() => iri)
  );

const isOwnedPredicate = (ontology: AssembledOntology, predicate: AssembledPredicate): boolean =>
  O.isSome(localFromNamespace(withNamespaceSeparator(ontology.baseIri), predicate.termIri));

const predicateContextTerm = (predicate: AssembledPredicate): JsonLdTerm => {
  if (predicate.reverse) {
    return predicate.kind === "object"
      ? { "@reverse": predicate.termIri, "@type": "@id" }
      : { "@reverse": predicate.termIri };
  }

  return predicate.kind === "object" ? { "@id": predicate.termIri, "@type": "@id" } : predicate.termIri;
};

const classContextEntries: (classes: ReadonlyArray<AssembledClass>) => ReadonlyArray<readonly [string, JsonLdTerm]> =
  A.map((assembled) => [assembled.name, { "@id": assembled.iri }] as const);

const predicateContextEntries: (
  classes: ReadonlyArray<AssembledClass>
) => ReadonlyArray<readonly [string, JsonLdTerm]> = A.flatMap((assembled) =>
  pipe(
    assembled.predicates,
    A.map((predicate) => [predicate.key, predicateContextTerm(predicate)] as const)
  )
);

const prefixTerm = (iri: string): JsonLdTerm => ({ "@id": iri, "@prefix": true });

/**
 * Project the JSON-LD `@context` for an assembled ontology.
 *
 * **Details**
 *
 * The context derives entirely from assembled annotations: every class name
 * and predicate key becomes a term entry, and core prefixes are always bound.
 *
 * **Example** (Context from folded ontology)
 *
 * ```ts
 * import { make } from "@beep/identity"
 * import { fold, toContext } from "@beep/ontology"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)(
 *   { prefLabel: S.String.pipe($I.key("skos:prefLabel")) },
 *   $I.class("Claim", { description: "A patent claim." })
 * ) {}
 *
 * const context = toContext(
 *   Effect.runSync(fold($I, { label: "Patent Core", schemas: [Claim], triples: [] }))
 * )
 * console.log(context.prefLabel) // "http://www.w3.org/2004/02/skos/core#prefLabel"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const toContext = (ontology: AssembledOntology): JsonLdContext =>
  R.fromEntries([
    ["@vocab", ontology.baseIri],
    [ontology.prefix, prefixTerm(withNamespaceSeparator(ontology.baseIri))],
    ...pipe(
      corePrefixes,
      A.map(({ iri, prefix }) => [prefix, prefixTerm(iri)] as const)
    ),
    ...classContextEntries(ontology.classes),
    ...predicateContextEntries(ontology.classes),
  ]);

const literalNodeValue = (literal: FactLiteral): JsonLdNodeValue => ({
  "@value": literal.value,
  ...OU.getSomesStruct({ "@type": literal.datatypeIri, "@language": literal.language }),
});

const jsonLdValue = (object: FactObject): JsonLdNodeValue =>
  P.isString(object) ? { "@id": object } : literalNodeValue(object);

const valuesFor = (
  ontology: AssembledOntology,
  subjectIri: string,
  reverse: boolean
): ReadonlyArray<readonly [string, ReadonlyArray<JsonLdNodeValue>]> =>
  pipe(
    ontology.facts,
    A.filter((fact) => fact.subjectIri === subjectIri && fact.reverse === reverse),
    A.reduce([] as Array<readonly [string, Array<JsonLdNodeValue>]>, (entries, fact) => {
      const key = compactIri(ontology, fact.predicateIri);
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

const classTypes = (assembled: AssembledClass): string | ReadonlyArray<string> =>
  pipe(
    assembled.skos,
    O.match({
      onNone: () => "rdfs:Class",
      onSome: (marker) => ["rdfs:Class", marker === "concept" ? "skos:Concept" : "skos:ConceptScheme"],
    })
  );

const classNode = (ontology: AssembledOntology, assembled: AssembledClass): JsonLdNode => {
  const facts = valuesFor(ontology, assembled.iri, false);
  const reverseFacts = valuesFor(ontology, assembled.iri, true);
  const factProperties: R.ReadonlyRecord<string, ReadonlyArray<JsonLdNodeValue>> = R.fromEntries(facts);
  const label = pipe(
    R.get(factProperties, "rdfs:label"),
    O.match({
      onNone: () => assembled.name,
      onSome: (values) => [assembled.name, ...values],
    })
  );
  const comment = pipe(
    assembled.description,
    O.map((description) =>
      pipe(
        R.get(factProperties, "rdfs:comment"),
        O.match({
          onNone: () => description,
          onSome: (values) => [description, ...values],
        })
      )
    )
  );

  return {
    "@id": assembled.iri,
    "@type": classTypes(assembled),
    ...factProperties,
    "rdfs:label": label,
    ...OU.getSomesStruct({ "rdfs:comment": comment }),
    ...(A.isReadonlyArrayNonEmpty(reverseFacts) ? { "@reverse": R.fromEntries(reverseFacts) } : {}),
  };
};

const factSubjectNode = (ontology: AssembledOntology, subjectIri: string): JsonLdNode => {
  const facts = valuesFor(ontology, subjectIri, false);
  const reverseFacts = valuesFor(ontology, subjectIri, true);

  return {
    "@id": subjectIri,
    ...R.fromEntries(facts),
    ...(A.isReadonlyArrayNonEmpty(reverseFacts) ? { "@reverse": R.fromEntries(reverseFacts) } : {}),
  };
};

const externalFactSubjects = (ontology: AssembledOntology): ReadonlyArray<string> =>
  pipe(
    ontology.facts,
    A.map((fact) => fact.subjectIri),
    A.dedupe,
    A.filter((subjectIri) => !pipe(ontology.classes, A.some(P.Struct({ iri: Eq.equals(subjectIri) }))))
  );

const predicateNode = (assembled: AssembledClass, predicate: AssembledPredicate): JsonLdNode => ({
  "@id": predicate.termIri,
  "@type": predicate.kind === "object" ? "owl:ObjectProperty" : "owl:DatatypeProperty",
  "rdfs:label": predicate.key,
  "rdfs:domain": { "@id": assembled.iri },
  "rdfs:range": {
    "@id": pipe(
      predicate.rangeIri,
      O.getOrElse(() => RDFS_LITERAL)
    ),
  },
  ...OU.getSomesStruct({ "rdfs:comment": predicate.description }),
});

/**
 * Project an assembled ontology into a bounded JSON-LD document.
 *
 * **Details**
 *
 * Reverse-marked predicates emit under `@reverse`; class nodes carry their
 * SKOS classification beside `rdfs:Class` when marked.
 *
 * **Example** (Document from folded ontology)
 *
 * ```ts
 * import { make } from "@beep/identity"
 * import { fold, toJsonLd } from "@beep/ontology"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)(
 *   { text: S.String },
 *   $I.class("Claim", { description: "A patent claim." })
 * ) {}
 *
 * const document = toJsonLd(
 *   Effect.runSync(fold($I, { label: "Patent Core", schemas: [Claim], triples: [] }))
 * )
 * console.log(document["@graph"][0]?.["@id"]) // "https://ns.beep.sh/patent/Claim"
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const toJsonLd = (ontology: AssembledOntology): JsonLdDocument => ({
  "@context": toContext(ontology),
  "@graph": [
    ...pipe(
      ontology.classes,
      A.map((assembled) => classNode(ontology, assembled))
    ),
    ...pipe(
      ontology.classes,
      A.flatMap((assembled) =>
        pipe(
          assembled.predicates,
          A.filter((predicate) => isOwnedPredicate(ontology, predicate)),
          A.map((predicate) => predicateNode(assembled, predicate))
        )
      )
    ),
    ...pipe(
      externalFactSubjects(ontology),
      A.map((subjectIri) => factSubjectNode(ontology, subjectIri))
    ),
  ],
});

const iriRef = (iri: string): string => `<${iri}>`;

const turtleTerm = (ontology: AssembledOntology, iri: string): string => {
  const ownedNamespace = withNamespaceSeparator(ontology.baseIri);
  const owned = pipe(
    localFromNamespace(ownedNamespace, iri),
    O.map(prefixedNameOrIri({ prefix: ontology.prefix, fullIri: iri }))
  );

  if (O.isSome(owned)) {
    return owned.value;
  }

  return pipe(
    corePrefixes,
    A.findFirst(({ iri: namespace }) => pipe(iri, Str.startsWith(namespace))),
    O.map(({ iri: namespace, prefix }) =>
      prefixedNameOrIri(pipe(iri, Str.slice(Str.length(namespace))), { prefix, fullIri: iri })
    ),
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
  P.isString(value)
    ? `"${escapeTurtleLiteral(value)}"`
    : P.isBoolean(value)
      ? `${value ? "true" : "false"}`
      : `${value}`;

const turtleObject = (ontology: AssembledOntology, object: FactObject): string => {
  if (P.isString(object)) {
    return turtleTerm(ontology, object);
  }

  const literal = literalValue(object.value);

  return pipe(
    O.map(object.language, (language) => `${literal}@${language}`),
    O.orElse(() => O.map(object.datatypeIri, (datatypeIri) => `${literal}^^${turtleTerm(ontology, datatypeIri)}`)),
    O.getOrElse(() => literal)
  );
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

const classTypeStatement = (ontology: AssembledOntology, assembled: AssembledClass): string =>
  pipe(
    assembled.skos,
    O.match({
      onNone: () => `a ${turtleTerm(ontology, RDFS_CLASS)}`,
      onSome: (marker) =>
        `a ${turtleTerm(ontology, RDFS_CLASS)}, ${turtleTerm(
          ontology,
          marker === "concept" ? SKOS_CONCEPT : SKOS_CONCEPT_SCHEME
        )}`,
    })
  );

const classBlock = (ontology: AssembledOntology, assembled: AssembledClass): string =>
  statementBlock(turtleTerm(ontology, assembled.iri), [
    classTypeStatement(ontology, assembled),
    `${turtleTerm(ontology, RDFS_LABEL)} ${literalValue(assembled.name)}`,
    ...pipe(
      assembled.description,
      O.match({
        onNone: A.empty,
        onSome: (description) => [`${turtleTerm(ontology, RDFS_COMMENT)} ${literalValue(description)}`],
      })
    ),
  ]);

const predicateBlock = (
  ontology: AssembledOntology,
  assembled: AssembledClass,
  predicate: AssembledPredicate
): string =>
  statementBlock(turtleTerm(ontology, predicate.termIri), [
    `a ${turtleTerm(ontology, predicate.kind === "object" ? OWL_OBJECT_PROPERTY : OWL_DATATYPE_PROPERTY)}`,
    `${turtleTerm(ontology, RDFS_LABEL)} ${literalValue(predicate.key)}`,
    `${turtleTerm(ontology, RDFS_DOMAIN)} ${turtleTerm(ontology, assembled.iri)}`,
    `${turtleTerm(ontology, RDFS_RANGE)} ${turtleTerm(
      ontology,
      pipe(
        predicate.rangeIri,
        O.getOrElse(() => RDFS_LITERAL)
      )
    )}`,
    ...pipe(
      predicate.description,
      O.match({
        onNone: () => [],
        onSome: (description) => [`${turtleTerm(ontology, RDFS_COMMENT)} ${literalValue(description)}`],
      })
    ),
  ]);

const factStatement = (ontology: AssembledOntology, fact: AssembledFact): string => {
  const swap = fact.reverse && P.isString(fact.object);
  const subject = swap && P.isString(fact.object) ? fact.object : fact.subjectIri;
  const object: FactObject = swap ? fact.subjectIri : fact.object;

  return `${turtleTerm(ontology, subject)} ${turtleTerm(ontology, fact.predicateIri)} ${turtleObject(
    ontology,
    object
  )} .`;
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
    ...pipe(
      ontology.classes,
      A.flatMap((assembled) => [
        assembled.iri,
        ...pipe(
          assembled.skos,
          O.match({
            onNone: () => [],
            onSome: (marker) => [marker === "concept" ? SKOS_CONCEPT : SKOS_CONCEPT_SCHEME],
          })
        ),
      ])
    ),
    ...pipe(
      ontology.classes,
      A.flatMap((assembled) =>
        pipe(
          assembled.predicates,
          A.flatMap((predicate) => [
            predicate.termIri,
            ...pipe(predicate.rangeIri, O.match({ onNone: () => [], onSome: (rangeIri) => [rangeIri] })),
          ])
        )
      )
    ),
    ...pipe(
      ontology.facts,
      A.flatMap((fact) => [
        fact.subjectIri,
        fact.predicateIri,
        ...(P.isString(fact.object)
          ? [fact.object]
          : pipe(fact.object.datatypeIri, O.match({ onNone: A.empty, onSome: (datatypeIri) => [datatypeIri] }))),
      ])
    ),
  ];

  const entries: ReadonlyArray<readonly [string, string]> = [
    [ontology.prefix, withNamespaceSeparator(ontology.baseIri)] as const,
    ...pipe(
      corePrefixes,
      A.filter(({ iri }) => pipe(usedIris, A.some(Str.startsWith(iri)))),
      A.map(({ iri, prefix }) => [prefix, iri] as const)
    ),
  ];

  return pipe(entries, A.sort(Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])));
};

/**
 * Project an assembled ontology into deterministic Turtle.
 *
 * **Details**
 *
 * Owned locals emit as prefixed names only when PN_LOCAL-safe, otherwise the
 * writer falls back to full IRI references; literals are escaped.
 *
 * **Example** (Turtle from folded ontology)
 *
 * ```ts
 * import { make } from "@beep/identity"
 * import { fold, toTurtle } from "@beep/ontology"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)(
 *   { text: S.String },
 *   $I.class("Claim", { description: "A patent claim." })
 * ) {}
 *
 * const turtle = toTurtle(
 *   Effect.runSync(fold($I, { label: "Patent Core", schemas: [Claim], triples: [] }))
 * )
 * console.log(turtle.includes("beep:Claim")) // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const toTurtle = (ontology: AssembledOntology): string => {
  const prefixes = pipe(
    prefixDefinitions(ontology),
    A.map(([prefix, iri]) => `@prefix ${prefix}: ${iriRef(iri)} .`)
  );
  const classes = pipe(
    ontology.classes,
    A.map((assembled) => classBlock(ontology, assembled))
  );
  const predicates = pipe(
    ontology.classes,
    A.flatMap((assembled) =>
      pipe(
        assembled.predicates,
        A.filter((predicate) => isOwnedPredicate(ontology, predicate)),
        A.map((predicate) => predicateBlock(ontology, assembled, predicate))
      )
    )
  );
  const facts = pipe(
    ontology.facts,
    A.map((fact) => factStatement(ontology, fact))
  );

  return pipe([...prefixes, "", ...classes, ...predicates, ...facts], A.join("\n\n"));
};
