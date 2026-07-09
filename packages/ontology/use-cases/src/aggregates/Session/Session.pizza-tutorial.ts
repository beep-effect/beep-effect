/**
 * Ported pizza tutorial seed as typed ontology change operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS, OWL_NAMESPACE, OWL_OBJECT_PROPERTY } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL, RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { A } from "@beep/utils";
import { pipe } from "effect";

const PIZZA_NS = "https://beep.example/ontology/tutorial/pizza#" as const;
const RDFS_SUB_CLASS_OF = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
const RDFS_DOMAIN = makeNamedNode(`${RDFS_NAMESPACE}domain`);
const RDFS_RANGE = makeNamedNode(`${RDFS_NAMESPACE}range`);
const OWL_NAMED_INDIVIDUAL = makeNamedNode(`${OWL_NAMESPACE}NamedIndividual`);

type TutorialResourceSeed = {
  readonly iri: string;
  readonly label: string;
  readonly type: "class" | "objectProperty" | "individual";
  readonly subClassOf?: readonly string[];
  readonly instanceOf?: readonly string[];
  readonly domain?: readonly string[];
  readonly range?: readonly string[];
};

const pizza = (local: string): string => `${PIZZA_NS}${local}`;

const tutorialSeed: ReadonlyArray<TutorialResourceSeed> = [
  { iri: pizza("Pizza"), label: "Pizza", type: "class" },
  { iri: pizza("PizzaTopping"), label: "Pizza topping", type: "class" },
  { iri: pizza("PizzaBase"), label: "Pizza base", type: "class" },
  { iri: pizza("NamedPizza"), label: "Named pizza", type: "class", subClassOf: [pizza("Pizza")] },
  { iri: pizza("VegetarianPizza"), label: "Vegetarian pizza", type: "class", subClassOf: [pizza("Pizza")] },
  { iri: pizza("TomatoTopping"), label: "Tomato topping", type: "class", subClassOf: [pizza("PizzaTopping")] },
  { iri: pizza("MozzarellaTopping"), label: "Mozzarella topping", type: "class", subClassOf: [pizza("PizzaTopping")] },
  { iri: pizza("ThinAndCrispyBase"), label: "Thin and crispy base", type: "class", subClassOf: [pizza("PizzaBase")] },
  {
    iri: pizza("hasTopping"),
    label: "has topping",
    type: "objectProperty",
    domain: [pizza("Pizza")],
    range: [pizza("PizzaTopping")],
  },
  {
    iri: pizza("hasBase"),
    label: "has base",
    type: "objectProperty",
    domain: [pizza("Pizza")],
    range: [pizza("PizzaBase")],
  },
  { iri: pizza("margherita"), label: "Margherita", type: "individual", instanceOf: [pizza("NamedPizza")] },
];

const typeNodeFor = (type: TutorialResourceSeed["type"]) =>
  type === "class" ? OWL_CLASS : type === "objectProperty" ? OWL_OBJECT_PROPERTY : OWL_NAMED_INDIVIDUAL;

const addAssertedQuad = (subject: string, predicate: string, object: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(makeNamedNode(subject), makeNamedNode(predicate), makeNamedNode(object)),
  });

const labelOperation = (resource: TutorialResourceSeed) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(makeNamedNode(resource.iri), RDFS_LABEL, makeLiteral(resource.label, XSD_STRING.value)),
  });

const resourceOperations = (resource: TutorialResourceSeed): ReadonlyArray<ChangeOperation> => [
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(makeNamedNode(resource.iri), RDF_TYPE, typeNodeFor(resource.type)),
  }),
  labelOperation(resource),
  ...pipe(
    resource.subClassOf ?? [],
    A.map((parent) => addAssertedQuad(resource.iri, RDFS_SUB_CLASS_OF.value, parent))
  ),
  ...pipe(
    resource.instanceOf ?? [],
    A.map((parent) => addAssertedQuad(resource.iri, RDF_TYPE.value, parent))
  ),
  ...pipe(
    resource.domain ?? [],
    A.map((domain) => addAssertedQuad(resource.iri, RDFS_DOMAIN.value, domain))
  ),
  ...pipe(
    resource.range ?? [],
    A.map((range) => addAssertedQuad(resource.iri, RDFS_RANGE.value, range))
  ),
];

/**
 * Generate typed ontology change operations for the ported pizza tutorial.
 *
 * @example
 * ```ts
 * import { pizzaTutorialChangeOperations } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const operations = pizzaTutorialChangeOperations()
 *
 * console.log(operations.length)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pizzaTutorialChangeOperations = (): ReadonlyArray<ChangeOperation> =>
  pipe(tutorialSeed, A.flatMap(resourceOperations));
