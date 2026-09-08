/**
 * Canonical core PROV-O projection between provenance bundles and RDF datasets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RdfId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { DateTime, Encoding, flow, Match, pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { IRI } from "./Iri.ts";
import {
  Activity,
  Agent,
  Association,
  Attribution,
  Derivation,
  Entity,
  Generation,
  ObjectRef as ObjectRefSchema,
  PrimarySource,
  ProvBundle,
  ProvDateTime,
  SoftwareAgent,
  Usage,
} from "./Prov.ts";
import { Dataset, DefaultGraph, Literal, NamedNode, Quad, serializeTerm } from "./Rdf.ts";
import {
  PROV_ACTIVITY,
  PROV_ACTIVITY_PROPERTY,
  PROV_AGENT,
  PROV_AGENT_PROPERTY,
  PROV_ASSOCIATION,
  PROV_AT_TIME,
  PROV_ATTRIBUTION,
  PROV_DERIVATION,
  PROV_ENDED_AT_TIME,
  PROV_ENTITY,
  PROV_ENTITY_PROPERTY,
  PROV_GENERATED_AT_TIME,
  PROV_GENERATION,
  PROV_HAD_PLAN,
  PROV_HAD_PRIMARY_SOURCE,
  PROV_INVALIDATED_AT_TIME,
  PROV_NAMESPACE,
  PROV_PRIMARY_SOURCE,
  PROV_QUALIFIED_ASSOCIATION,
  PROV_QUALIFIED_ATTRIBUTION,
  PROV_QUALIFIED_DERIVATION,
  PROV_QUALIFIED_GENERATION,
  PROV_QUALIFIED_PRIMARY_SOURCE,
  PROV_QUALIFIED_USAGE,
  PROV_SOFTWARE_AGENT,
  PROV_STARTED_AT_TIME,
  PROV_USAGE,
  PROV_USED,
  PROV_VALUE,
  PROV_WAS_ASSOCIATED_WITH,
  PROV_WAS_ATTRIBUTED_TO,
  PROV_WAS_DERIVED_FROM,
  PROV_WAS_GENERATED_BY,
  PROV_WAS_QUOTED_FROM,
  PROV_WAS_REVISION_OF,
} from "./Vocab/Prov.ts";
import { RDF_TYPE } from "./Vocab/Rdf.ts";
import { RDFS_LABEL } from "./Vocab/Rdfs.ts";
import { XSD_BOOLEAN, XSD_DATE_TIME, XSD_DOUBLE, XSD_STRING } from "./Vocab/Xsd.ts";
import type { ObjectRef, ProvRecord as ProvRecordType } from "./Prov.ts";
import type { GraphTerm, ObjectTerm, Subject } from "./Rdf.ts";

const $I = $RdfId.create("prov-rdf");
const REF_IRI_PREFIX = "urn:beep:rdf:prov:ref:";
const RECORD_IRI_PREFIX = "urn:beep:rdf:prov:record:";
const RELATION_IRI_PREFIX = "urn:beep:rdf:prov:relation:";
const defaultGraph = DefaultGraph.make({ termType: "DefaultGraph", value: "" });

/**
 * Typed failure returned when a PROV bundle cannot be projected without loss.
 *
 * **Example** (Inspect a codec failure)
 *
 * ```ts import.meta.vitest name="Inspect a codec failure"
 * import { ProvRdfCodecError } from "@beep/rdf/ProvRdf"
 *
 * const error = ProvRdfCodecError.make({ message: "Unsupported PROV record" })
 * error._tag // => "ProvRdfCodecError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProvRdfCodecError extends S.TaggedError<ProvRdfCodecError>($I`ProvRdfCodecError`)(
  "ProvRdfCodecError",
  { message: S.String },
  $I.annoteError<ProvRdfCodecError>("ProvRdfCodecError", {
    description: "Typed failure returned when a PROV bundle cannot be projected without loss.",
  })
) {}

/**
 * Selects the RDF graph that owns the projected provenance quads.
 *
 * **Example** (Select a named audit graph)
 *
 * ```ts import.meta.vitest name="Select a named audit graph"
 * import * as O from "effect/Option"
 * import { ProvRdfCodecOptions } from "@beep/rdf/ProvRdf"
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const options = ProvRdfCodecOptions.make({
 *   graph: O.some(makeNamedNode("urn:example:audit"))
 * })
 * O.isSome(options.graph) // => true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ProvRdfCodecOptions extends S.Class<ProvRdfCodecOptions>($I`ProvRdfCodecOptions`)(
  {
    graph: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ProvRdfCodecOptions", {
    description: "Selects the RDF graph that owns the projected provenance quads.",
  })
) {}

const defaultOptions = ProvRdfCodecOptions.make({});
const codecError = (message: string): ProvRdfCodecError => ProvRdfCodecError.make({ message });
const selectGraph = (options: ProvRdfCodecOptions): GraphTerm => O.getOrElse(options.graph, () => defaultGraph);

const makeNamedNodeResult = (value: string): Result.Result<NamedNode, ProvRdfCodecError> =>
  pipe(
    IRI.decodeUnknownResult(value),
    Result.map((iri) => NamedNode.make({ termType: "NamedNode", value: iri })),
    Result.mapError(() => codecError(`Invalid deterministic PROV IRI: ${value}`))
  );

const refNode = (ref: ObjectRef): Result.Result<NamedNode, ProvRdfCodecError> =>
  pipe(
    [REF_IRI_PREFIX, RECORD_IRI_PREFIX, RELATION_IRI_PREFIX],
    A.some((prefix) => Str.startsWith(prefix)(ref))
  )
    ? makeNamedNodeResult(`${REF_IRI_PREFIX}${Encoding.encodeBase64Url(ref)}`)
    : pipe(
        makeNamedNodeResult(ref),
        Result.orElse(() => makeNamedNodeResult(`${REF_IRI_PREFIX}${Encoding.encodeBase64Url(ref)}`))
      );

const recordNode = (index: number): Result.Result<NamedNode, ProvRdfCodecError> =>
  makeNamedNodeResult(`${RECORD_IRI_PREFIX}${index}`);

const relationNode = (index: number): Result.Result<NamedNode, ProvRdfCodecError> =>
  makeNamedNodeResult(`${RELATION_IRI_PREFIX}${index}`);

const literal = (value: string, datatype: NamedNode): Literal =>
  Literal.make({ termType: "Literal", value, language: O.none(), datatype });

const quad = (subject: Subject, predicate: NamedNode, object: ObjectTerm, graph: GraphTerm): Quad =>
  Quad.make({ subject, predicate, object, graph });

const optionalIdSubject = (id: O.Option<ObjectRef>, index: number): Result.Result<NamedNode, ProvRdfCodecError> =>
  O.match(id, { onNone: () => recordNode(index), onSome: refNode });

const links = (
  subject: Subject,
  predicate: NamedNode,
  refs: ReadonlyArray<ObjectRef>,
  graph: GraphTerm
): Result.Result<ReadonlyArray<Quad>, ProvRdfCodecError> =>
  Result.all(
    A.map(refs, (ref) =>
      pipe(
        refNode(ref),
        Result.map((object) => quad(subject, predicate, object, graph))
      )
    )
  );

const optionalLinks = (
  subject: Subject,
  predicate: NamedNode,
  refs: O.Option<ReadonlyArray<ObjectRef>>,
  graph: GraphTerm
): Result.Result<ReadonlyArray<Quad>, ProvRdfCodecError> =>
  links(subject, predicate, O.getOrElse(refs, A.empty), graph);

const optionalTimestamp = (
  subject: Subject,
  predicate: NamedNode,
  value: O.Option<ProvDateTime>,
  graph: GraphTerm
): ReadonlyArray<Quad> =>
  pipe(
    value,
    O.map((instant) => quad(subject, predicate, literal(DateTime.formatIso(instant), XSD_DATE_TIME), graph)),
    O.match({ onNone: A.empty, onSome: A.of })
  );
const encodeFiniteFromStringResult = S.encodeResult(S.FiniteFromString);
const encodeScalar = (value: string | number | boolean): Result.Result<Literal, ProvRdfCodecError> =>
  Match.type<string | number | boolean>().pipe(
    Match.when(P.isString, (text) => Result.succeed(literal(text, XSD_STRING))),
    Match.when(P.isNumber, (number) =>
      pipe(
        encodeFiniteFromStringResult(number),
        Result.map((encoded) => literal(encoded, XSD_DOUBLE)),
        /* istanbul ignore next -- Entity's schema admits only finite numeric prov:value inputs */
        Result.mapError(() => codecError("Unable to encode a finite prov:value number"))
      )
    ),
    Match.orElse((boolean) => Result.succeed(literal(boolean ? "true" : "false", XSD_BOOLEAN)))
  )(value);

const encodeEntity = (record: Entity, index: number, graph: GraphTerm) =>
  pipe(
    optionalIdSubject(record.id, index),
    Result.flatMap((subject) =>
      pipe(
        Result.all([
          optionalLinks(subject, PROV_WAS_GENERATED_BY, record.wasGeneratedBy, graph),
          optionalLinks(subject, PROV_WAS_ATTRIBUTED_TO, record.wasAttributedTo, graph),
          optionalLinks(subject, PROV_HAD_PRIMARY_SOURCE, record.hadPrimarySource, graph),
          optionalLinks(subject, PROV_WAS_QUOTED_FROM, record.wasQuotedFrom, graph),
          optionalLinks(subject, PROV_WAS_REVISION_OF, record.wasRevisionOf, graph),
          optionalLinks(subject, PROV_WAS_DERIVED_FROM, record.wasDerivedFrom, graph),
          pipe(
            record.value,
            O.match({
              onNone: () => Result.succeed(A.empty<Quad>()),
              onSome: (value) =>
                pipe(
                  encodeScalar(value),
                  Result.map((object) => [quad(subject, PROV_VALUE, object, graph)])
                ),
            })
          ),
        ]),
        Result.map((parts) => [
          quad(subject, RDF_TYPE, PROV_ENTITY, graph),
          ...A.flatten(parts),
          ...optionalTimestamp(subject, PROV_GENERATED_AT_TIME, record.generatedAtTime, graph),
          ...optionalTimestamp(subject, PROV_INVALIDATED_AT_TIME, record.invalidatedAtTime, graph),
        ])
      )
    )
  );

const encodeActivity = (record: Activity, index: number, graph: GraphTerm) =>
  pipe(
    optionalIdSubject(record.id, index),
    Result.flatMap((subject) =>
      pipe(
        Result.all([
          optionalLinks(subject, PROV_USED, record.used, graph),
          optionalLinks(subject, PROV_WAS_ASSOCIATED_WITH, record.wasAssociatedWith, graph),
        ]),
        Result.map((parts) => [
          quad(subject, RDF_TYPE, PROV_ACTIVITY, graph),
          ...A.flatten(parts),
          ...optionalTimestamp(subject, PROV_STARTED_AT_TIME, record.startedAtTime, graph),
          ...optionalTimestamp(subject, PROV_ENDED_AT_TIME, record.endedAtTime, graph),
        ])
      )
    )
  );

const encodeAgent = (record: Agent | SoftwareAgent, index: number, graph: GraphTerm) =>
  pipe(
    optionalIdSubject(record.id, index),
    Result.map((subject) => [
      quad(subject, RDF_TYPE, record.provType === "SoftwareAgent" ? PROV_SOFTWARE_AGENT : PROV_AGENT, graph),
      ...pipe(
        record.name,
        O.map((name) => quad(subject, RDFS_LABEL, literal(name, XSD_STRING), graph)),
        O.match({ onNone: A.empty, onSome: A.of })
      ),
    ])
  );

const encodeQualified = (
  index: number,
  graph: GraphTerm,
  classNode: NamedNode,
  parent: Result.Result<NamedNode, ProvRdfCodecError>,
  qualifiedPredicate: NamedNode,
  directPredicate: NamedNode,
  targetPredicate: NamedNode,
  target: Result.Result<NamedNode, ProvRdfCodecError>,
  extras: (node: NamedNode) => Result.Result<ReadonlyArray<Quad>, ProvRdfCodecError> = () => Result.succeed([])
) =>
  pipe(
    Result.all({ node: relationNode(index), parent, target }),
    Result.flatMap(({ node, parent, target }) =>
      pipe(
        extras(node),
        Result.map((extraQuads) => [
          quad(node, RDF_TYPE, classNode, graph),
          quad(parent, qualifiedPredicate, node, graph),
          quad(parent, directPredicate, target, graph),
          quad(node, targetPredicate, target, graph),
          ...extraQuads,
        ])
      )
    )
  );

const encodeUsage = (record: Usage, index: number, graph: GraphTerm) =>
  encodeQualified(
    index,
    graph,
    PROV_USAGE,
    refNode(record.activity),
    PROV_QUALIFIED_USAGE,
    PROV_USED,
    PROV_ENTITY_PROPERTY,
    refNode(record.entity),
    (node) => Result.succeed(optionalTimestamp(node, PROV_AT_TIME, record.atTime, graph))
  );

const encodeGeneration = (record: Generation, index: number, graph: GraphTerm) =>
  encodeQualified(
    index,
    graph,
    PROV_GENERATION,
    refNode(record.entity),
    PROV_QUALIFIED_GENERATION,
    PROV_WAS_GENERATED_BY,
    PROV_ACTIVITY_PROPERTY,
    refNode(record.activity),
    (node) => Result.succeed(optionalTimestamp(node, PROV_AT_TIME, record.atTime, graph))
  );

const encodeAssociation = (record: Association, index: number, graph: GraphTerm) =>
  encodeQualified(
    index,
    graph,
    PROV_ASSOCIATION,
    refNode(record.activity),
    PROV_QUALIFIED_ASSOCIATION,
    PROV_WAS_ASSOCIATED_WITH,
    PROV_AGENT_PROPERTY,
    refNode(record.agent),
    (node) =>
      pipe(
        record.hadPlan,
        O.match({ onNone: () => Result.succeed([]), onSome: (plan) => links(node, PROV_HAD_PLAN, [plan], graph) })
      )
  );

const encodeAttribution = (record: Attribution, index: number, graph: GraphTerm) =>
  encodeQualified(
    index,
    graph,
    PROV_ATTRIBUTION,
    refNode(record.entity),
    PROV_QUALIFIED_ATTRIBUTION,
    PROV_WAS_ATTRIBUTED_TO,
    PROV_AGENT_PROPERTY,
    refNode(record.agent)
  );

const encodeDerivation = (record: Derivation, index: number, graph: GraphTerm) =>
  encodeQualified(
    index,
    graph,
    PROV_DERIVATION,
    refNode(record.generatedEntity),
    PROV_QUALIFIED_DERIVATION,
    PROV_WAS_DERIVED_FROM,
    PROV_ENTITY_PROPERTY,
    refNode(record.usedEntity)
  );

const encodePrimarySource = (record: PrimarySource, index: number, graph: GraphTerm) =>
  encodeQualified(
    index,
    graph,
    PROV_PRIMARY_SOURCE,
    refNode(record.entity),
    PROV_QUALIFIED_PRIMARY_SOURCE,
    PROV_HAD_PRIMARY_SOURCE,
    PROV_ENTITY_PROPERTY,
    refNode(record.source)
  );

type RecordEncoder = (index: number, graph: GraphTerm) => Result.Result<ReadonlyArray<Quad>, ProvRdfCodecError>;

const encodeRecord = Match.type<ProvRecordType>().pipe(
  Match.when(
    S.is(Entity),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeEntity(record, index, graph)
  ),
  Match.when(
    S.is(Activity),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeActivity(record, index, graph)
  ),
  Match.when(
    S.is(SoftwareAgent),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeAgent(record, index, graph)
  ),
  Match.when(
    S.is(Agent),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeAgent(record, index, graph)
  ),
  Match.when(
    S.is(Usage),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeUsage(record, index, graph)
  ),
  Match.when(
    S.is(Generation),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeGeneration(record, index, graph)
  ),
  Match.when(
    S.is(Association),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeAssociation(record, index, graph)
  ),
  Match.when(
    S.is(Attribution),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeAttribution(record, index, graph)
  ),
  Match.when(
    S.is(Derivation),
    (record): RecordEncoder =>
      (index, graph) =>
        encodeDerivation(record, index, graph)
  ),
  Match.when(
    S.is(PrimarySource),
    (record): RecordEncoder =>
      (index, graph) =>
        encodePrimarySource(record, index, graph)
  ),
  Match.orElse((): RecordEncoder => () => Result.fail(codecError("Unsupported extension-tier PROV record")))
);

const ensureUniqueRecordSubjects = (
  parts: ReadonlyArray<ReadonlyArray<Quad>>
): Result.Result<ReadonlyArray<ReadonlyArray<Quad>>, ProvRdfCodecError> =>
  pipe(
    parts,
    A.map(
      flow(
        A.findFirst((value) => samePredicate(value.predicate, RDF_TYPE)),
        O.match({
          /* istanbul ignore next -- every successful record encoder emits its RDF type quad */
          onNone: () => Result.fail(codecError("Encoded PROV record is missing its RDF type")),
          onSome: (typeQuad) => Result.succeed(serializeTerm(typeQuad.subject)),
        })
      )
    ),
    Result.all,
    Result.flatMap((keys) =>
      A.length(A.dedupe(keys)) === A.length(keys)
        ? Result.succeed(parts)
        : Result.fail(codecError("Multiple PROV records encode to the same RDF subject"))
    )
  );

/*
 * Projects a supported provenance bundle into deterministic PROV-O quads.
 *
 * **Details**
 *
 * Valid IRI references remain direct named nodes; local references use reversible
 * `urn:beep:rdf:prov:ref:*` nodes. Qualified influence records emit both the
 * PROV-O qualified relation and its direct shortcut.
 *
 * **Gotchas**
 *
 * Extension-tier records and non-empty lifecycle adjuncts fail explicitly because
 * the core PROV-O projection has no lossless representation for them.
 *
 * **Example** (Project into a named audit graph)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { ProvBundle } from "@beep/rdf/Prov"
 * import { ProvRdfCodecOptions, provBundleToDataset } from "@beep/rdf/ProvRdf"
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const bundle = ProvBundle.make({ records: [] })
 * const options = ProvRdfCodecOptions.make({ graph: O.some(makeNamedNode("urn:example:audit")) })
 * console.log(Result.isSuccess(provBundleToDataset(bundle, options))) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
const provBundleToDatasetInternal = (
  bundle: ProvBundle,
  options: ProvRdfCodecOptions = defaultOptions
): Result.Result<Dataset, ProvRdfCodecError> =>
  pipe(
    bundle.lifecycle,
    O.match({
      onNone: () =>
        pipe(
          bundle.records,
          A.map((record, index) => encodeRecord(record)(index, selectGraph(options))),
          Result.all,
          Result.flatMap(ensureUniqueRecordSubjects),
          Result.map((parts) => Dataset.make({ quads: A.dedupeWith(A.flatten(parts), sameQuad) }))
        ),
      onSome: () =>
        Result.fail(codecError("ProvBundle lifecycle adjuncts are not part of the core PROV-O RDF projection")),
    })
  );

/** @internal */
const isProvBundleDataFirst = (args: IArguments): boolean => ProvBundle.is(args[0]);

/**
 * Projects a supported provenance bundle into deterministic PROV-O quads.
 *
 * **Details**
 *
 * Valid IRI references remain direct named nodes, while local references use
 * reversible deterministic URNs. Qualified influences also emit their PROV-O
 * direct relation shortcuts.
 *
 * **Gotchas**
 *
 * Unsupported extension records and lifecycle adjuncts return a typed failure.
 *
 * **Example** (Project an empty bundle)
 *
 * ```ts import.meta.vitest name="Project an empty bundle"
 * import * as Result from "effect/Result"
 * import { ProvBundle } from "@beep/rdf/Prov"
 * import { provBundleToDataset } from "@beep/rdf/ProvRdf"
 *
 * const projected = provBundleToDataset(ProvBundle.make({ records: [] }))
 * Result.isSuccess(projected) // => true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const provBundleToDataset: {
  (bundle: ProvBundle): Result.Result<Dataset, ProvRdfCodecError>;
  (bundle: ProvBundle, options: ProvRdfCodecOptions): Result.Result<Dataset, ProvRdfCodecError>;
  (options: ProvRdfCodecOptions): (bundle: ProvBundle) => Result.Result<Dataset, ProvRdfCodecError>;
} = dual(isProvBundleDataFirst, provBundleToDatasetInternal);

const inSelectedGraph =
  (graph: GraphTerm) =>
  (value: Quad): boolean =>
    serializeTerm(value.graph) === serializeTerm(graph);
const sameTerm = (left: Subject | ObjectTerm, right: Subject | ObjectTerm): boolean =>
  serializeTerm(left) === serializeTerm(right);
const samePredicate = (left: NamedNode, right: NamedNode): boolean => left.value === right.value;
const sameQuad = (left: Quad, right: Quad): boolean =>
  serializeTerm(left.subject) === serializeTerm(right.subject) &&
  samePredicate(left.predicate, right.predicate) &&
  sameTerm(left.object, right.object) &&
  serializeTerm(left.graph) === serializeTerm(right.graph);

const objects = (quads: ReadonlyArray<Quad>, subject: Subject, predicate: NamedNode): ReadonlyArray<ObjectTerm> =>
  pipe(
    quads,
    A.filter((value) => sameTerm(value.subject, subject) && samePredicate(value.predicate, predicate)),
    A.map((value) => value.object)
  );

const singleValue = <Value>(
  values: ReadonlyArray<Value>,
  label: string
): Result.Result<O.Option<Value>, ProvRdfCodecError> =>
  A.match(values, {
    onEmpty: () => Result.succeed(O.none()),
    onNonEmpty: (nonEmpty) =>
      A.length(nonEmpty) === 1
        ? Result.succeed(O.some(A.headNonEmpty(nonEmpty)))
        : Result.fail(codecError(`Expected at most one ${label}`)),
  });

const singleObject = (quads: ReadonlyArray<Quad>, subject: Subject, predicate: NamedNode, label: string) =>
  singleValue(objects(quads, subject, predicate), label);

const parentSubjects = (quads: ReadonlyArray<Quad>, predicate: NamedNode, object: ObjectTerm): ReadonlyArray<Subject> =>
  pipe(
    quads,
    A.filter((value) => samePredicate(value.predicate, predicate) && sameTerm(value.object, object)),
    A.map((value) => value.subject)
  );

const decodeRefNode = (term: ObjectTerm | Subject): Result.Result<ObjectRef, ProvRdfCodecError> =>
  NamedNode.is(term)
    ? pipe(
        Str.startsWith(REF_IRI_PREFIX)(term.value)
          ? pipe(
              Str.slice(REF_IRI_PREFIX.length)(term.value),
              Encoding.decodeBase64UrlString,
              Result.mapError(() => codecError(`Invalid encoded PROV object reference: ${term.value}`))
            )
          : Result.succeed(term.value),
        Result.flatMap((value) =>
          pipe(
            ObjectRefSchema.decodeResult(value),
            Result.mapError(() => codecError(`Invalid PROV object reference: ${value}`))
          )
        )
      )
    : Result.fail(codecError("Expected a named node for a PROV object reference"));

const decodeOptionalId = (subject: Subject): Result.Result<O.Option<ObjectRef>, ProvRdfCodecError> =>
  NamedNode.is(subject)
    ? Str.startsWith(RECORD_IRI_PREFIX)(subject.value)
      ? Result.succeed(O.none())
      : pipe(decodeRefNode(subject), Result.map(O.some))
    : Result.fail(codecError("Expected a named-node subject for a PROV record"));

const decodeRefs: (
  values: ReadonlyArray<ObjectTerm>
) => Result.Result<O.Option<ReadonlyArray<ObjectRef>>, ProvRdfCodecError> = flow(
  A.map(decodeRefNode),
  Result.all,
  Result.map(A.dedupe),
  Result.map(A.match({ onEmpty: O.none, onNonEmpty: O.some }))
);
const decodeFiniteFromStringResult = S.decodeResult(S.FiniteFromString);
const decodePlainLiteralScalar = Match.type<Literal>().pipe(
  Match.when(
    (term) => term.datatype.value === XSD_STRING.value,
    (term) => Result.succeed<string | number | boolean>(term.value)
  ),
  Match.when(
    (term) => term.datatype.value === XSD_DOUBLE.value,
    (term) =>
      pipe(
        decodeFiniteFromStringResult(term.value),
        Result.mapError(() => codecError(`Invalid finite prov:value number: ${term.value}`))
      )
  ),
  Match.when(
    (term) => term.datatype.value === XSD_BOOLEAN.value && term.value === "true",
    () => Result.succeed(true)
  ),
  Match.when(
    (term) => term.datatype.value === XSD_BOOLEAN.value && term.value === "false",
    () => Result.succeed(false)
  ),
  Match.orElse((term) => Result.fail(codecError(`Unsupported prov:value datatype: ${term.datatype.value}`)))
);

const decodeLiteralScalar = (term: Literal): Result.Result<string | number | boolean, ProvRdfCodecError> =>
  O.isNone(term.language)
    ? decodePlainLiteralScalar(term)
    : Result.fail(codecError("Language-tagged prov:value literals are not supported"));

const decodeScalar = (
  value: O.Option<ObjectTerm>
): Result.Result<O.Option<string | number | boolean>, ProvRdfCodecError> =>
  O.match(value, {
    onNone: () => Result.succeed(O.none()),
    onSome: (term) =>
      Literal.is(term)
        ? pipe(decodeLiteralScalar(term), Result.map(O.some))
        : Result.fail(codecError("Expected an RDF literal for prov:value")),
  });

const decodeTimestamp = (value: O.Option<ObjectTerm>): Result.Result<O.Option<ProvDateTime>, ProvRdfCodecError> =>
  O.match(value, {
    onNone: () => Result.succeed(O.none()),
    onSome: (term) =>
      Literal.is(term) && term.datatype.value === XSD_DATE_TIME.value && O.isNone(term.language)
        ? pipe(
            ProvDateTime.decodeResult(term.value),
            Result.map(O.some),
            Result.mapError(() => codecError(`Invalid PROV timestamp: ${term.value}`))
          )
        : Result.fail(
            codecError(
              Literal.is(term)
                ? `Expected an xsd:dateTime literal for a PROV timestamp, received ${term.datatype.value}`
                : "Expected an RDF literal for a PROV timestamp"
            )
          ),
  });

const requireValue = <Value>(value: O.Option<Value>, label: string): Result.Result<Value, ProvRdfCodecError> =>
  O.match(value, { onNone: () => Result.fail(codecError(`Missing ${label}`)), onSome: Result.succeed });

const decodeName = (quads: ReadonlyArray<Quad>, subject: Subject): Result.Result<O.Option<string>, ProvRdfCodecError> =>
  pipe(
    singleObject(quads, subject, RDFS_LABEL, "rdfs:label value"),
    Result.flatMap(
      O.match({
        onNone: () => Result.succeed(O.none()),
        onSome: (term) =>
          Literal.is(term) && term.datatype.value === XSD_STRING.value && O.isNone(term.language)
            ? Result.succeed(O.some(term.value))
            : Result.fail(codecError("Expected a plain xsd:string RDF literal for rdfs:label")),
      })
    )
  );

const decodeEntity = (quads: ReadonlyArray<Quad>, subject: Subject): Result.Result<Entity, ProvRdfCodecError> =>
  pipe(
    Result.all({
      id: decodeOptionalId(subject),
      wasGeneratedBy: decodeRefs(objects(quads, subject, PROV_WAS_GENERATED_BY)),
      wasAttributedTo: decodeRefs(objects(quads, subject, PROV_WAS_ATTRIBUTED_TO)),
      hadPrimarySource: decodeRefs(objects(quads, subject, PROV_HAD_PRIMARY_SOURCE)),
      wasQuotedFrom: decodeRefs(objects(quads, subject, PROV_WAS_QUOTED_FROM)),
      wasRevisionOf: decodeRefs(objects(quads, subject, PROV_WAS_REVISION_OF)),
      wasDerivedFrom: decodeRefs(objects(quads, subject, PROV_WAS_DERIVED_FROM)),
      generatedAtTime: pipe(
        singleObject(quads, subject, PROV_GENERATED_AT_TIME, "prov:generatedAtTime value"),
        Result.flatMap(decodeTimestamp)
      ),
      invalidatedAtTime: pipe(
        singleObject(quads, subject, PROV_INVALIDATED_AT_TIME, "prov:invalidatedAtTime value"),
        Result.flatMap(decodeTimestamp)
      ),
      value: pipe(singleObject(quads, subject, PROV_VALUE, "prov:value"), Result.flatMap(decodeScalar)),
    }),
    Result.map((fields) => Entity.make(fields))
  );

const decodeActivity = (quads: ReadonlyArray<Quad>, subject: Subject): Result.Result<Activity, ProvRdfCodecError> =>
  pipe(
    Result.all({
      id: decodeOptionalId(subject),
      used: decodeRefs(objects(quads, subject, PROV_USED)),
      wasAssociatedWith: decodeRefs(objects(quads, subject, PROV_WAS_ASSOCIATED_WITH)),
      startedAtTime: pipe(
        singleObject(quads, subject, PROV_STARTED_AT_TIME, "prov:startedAtTime value"),
        Result.flatMap(decodeTimestamp)
      ),
      endedAtTime: pipe(
        singleObject(quads, subject, PROV_ENDED_AT_TIME, "prov:endedAtTime value"),
        Result.flatMap(decodeTimestamp)
      ),
    }),
    Result.map((fields) => Activity.make(fields))
  );

const decodeAgent = (quads: ReadonlyArray<Quad>, subject: Subject) =>
  pipe(
    Result.all({ id: decodeOptionalId(subject), name: decodeName(quads, subject) }),
    Result.map((fields) => Agent.make(fields))
  );

const decodeSoftwareAgent = (quads: ReadonlyArray<Quad>, subject: Subject) =>
  pipe(
    Result.all({ id: decodeOptionalId(subject), name: decodeName(quads, subject) }),
    Result.map((fields) => SoftwareAgent.make(fields))
  );

const decodeQualifiedRefs = (
  quads: ReadonlyArray<Quad>,
  node: Subject,
  qualified: NamedNode,
  direct: NamedNode,
  target: NamedNode
) =>
  pipe(
    Result.all({
      parentTerm: pipe(
        singleValue(parentSubjects(quads, qualified, node), "qualified relation parent"),
        Result.flatMap((value) => requireValue(value, "qualified relation parent"))
      ),
      targetTerm: pipe(
        singleObject(quads, node, target, "qualified relation target"),
        Result.flatMap((value) => requireValue(value, "qualified relation target"))
      ),
    }),
    Result.flatMap(({ parentTerm, targetTerm }) =>
      pipe(
        objects(quads, parentTerm, direct),
        A.match({
          onEmpty: () => Result.all({ parent: decodeRefNode(parentTerm), target: decodeRefNode(targetTerm) }),
          onNonEmpty: (directTargetTerms) =>
            pipe(
              directTargetTerms,
              A.map(decodeRefNode),
              Result.all,
              Result.flatMap(() =>
                A.some(directTargetTerms, (directTargetTerm) => sameTerm(targetTerm, directTargetTerm))
                  ? Result.all({ parent: decodeRefNode(parentTerm), target: decodeRefNode(targetTerm) })
                  : Result.fail(codecError("Direct relation shortcuts do not contain the qualified target"))
              )
            ),
        })
      )
    )
  );

type RecordDecoder = (quads: ReadonlyArray<Quad>, subject: Subject) => Result.Result<ProvRecordType, ProvRdfCodecError>;

const decodeUsage: RecordDecoder = (quads, subject) =>
  pipe(
    decodeQualifiedRefs(quads, subject, PROV_QUALIFIED_USAGE, PROV_USED, PROV_ENTITY_PROPERTY),
    Result.flatMap(({ parent, target }) =>
      pipe(
        singleObject(quads, subject, PROV_AT_TIME, "prov:atTime value"),
        Result.flatMap(decodeTimestamp),
        Result.map((atTime) => Usage.make({ activity: parent, entity: target, atTime }))
      )
    )
  );

const decodeGeneration: RecordDecoder = (quads, subject) =>
  pipe(
    decodeQualifiedRefs(quads, subject, PROV_QUALIFIED_GENERATION, PROV_WAS_GENERATED_BY, PROV_ACTIVITY_PROPERTY),
    Result.flatMap(({ parent, target }) =>
      pipe(
        singleObject(quads, subject, PROV_AT_TIME, "prov:atTime value"),
        Result.flatMap(decodeTimestamp),
        Result.map((atTime) => Generation.make({ entity: parent, activity: target, atTime }))
      )
    )
  );

const decodeAssociation: RecordDecoder = (quads, subject) =>
  pipe(
    decodeQualifiedRefs(quads, subject, PROV_QUALIFIED_ASSOCIATION, PROV_WAS_ASSOCIATED_WITH, PROV_AGENT_PROPERTY),
    Result.flatMap(({ parent, target }) =>
      pipe(
        singleObject(quads, subject, PROV_HAD_PLAN, "prov:hadPlan value"),
        Result.flatMap(
          O.match({
            onNone: () => Result.succeed(O.none<ObjectRef>()),
            onSome: (plan) => pipe(decodeRefNode(plan), Result.map(O.some)),
          })
        ),
        Result.map((hadPlan) => Association.make({ activity: parent, agent: target, hadPlan }))
      )
    )
  );

const decodeAttribution: RecordDecoder = (quads, subject) =>
  pipe(
    decodeQualifiedRefs(quads, subject, PROV_QUALIFIED_ATTRIBUTION, PROV_WAS_ATTRIBUTED_TO, PROV_AGENT_PROPERTY),
    Result.map(({ parent, target }) => Attribution.make({ entity: parent, agent: target }))
  );

const decodeDerivation: RecordDecoder = (quads, subject) =>
  pipe(
    decodeQualifiedRefs(quads, subject, PROV_QUALIFIED_DERIVATION, PROV_WAS_DERIVED_FROM, PROV_ENTITY_PROPERTY),
    Result.map(({ parent, target }) => Derivation.make({ generatedEntity: parent, usedEntity: target }))
  );

const decodePrimarySource: RecordDecoder = (quads, subject) =>
  pipe(
    decodeQualifiedRefs(quads, subject, PROV_QUALIFIED_PRIMARY_SOURCE, PROV_HAD_PRIMARY_SOURCE, PROV_ENTITY_PROPERTY),
    Result.map(({ parent, target }) => PrimarySource.make({ entity: parent, source: target }))
  );

const decodeRecordByType = Match.type<string>().pipe(
  Match.when(PROV_ENTITY.value, () => decodeEntity),
  Match.when(PROV_ACTIVITY.value, () => decodeActivity),
  Match.when(PROV_SOFTWARE_AGENT.value, () => decodeSoftwareAgent),
  Match.when(PROV_AGENT.value, () => decodeAgent),
  Match.when(PROV_USAGE.value, () => decodeUsage),
  Match.when(PROV_GENERATION.value, () => decodeGeneration),
  Match.when(PROV_ASSOCIATION.value, () => decodeAssociation),
  Match.when(PROV_ATTRIBUTION.value, () => decodeAttribution),
  Match.when(PROV_DERIVATION.value, () => decodeDerivation),
  Match.when(PROV_PRIMARY_SOURCE.value, () => decodePrimarySource),
  Match.orElse(
    (type): RecordDecoder =>
      () =>
        Result.fail(codecError(`Unsupported PROV RDF type: ${type}`))
  )
);

const isProvType = (value: ObjectTerm): value is NamedNode =>
  NamedNode.is(value) && Str.startsWith(PROV_NAMESPACE)(value.value);

const isProvTypeQuad = (value: Quad): value is Quad & { readonly object: NamedNode } =>
  samePredicate(value.predicate, RDF_TYPE) && isProvType(value.object);

const decodeRecord = (
  quads: ReadonlyArray<Quad>,
  typeQuad: Quad & { readonly object: NamedNode }
): Result.Result<ProvRecordType, ProvRdfCodecError> =>
  decodeRecordByType(typeQuad.object.value)(quads, typeQuad.subject);

const ensureUniqueTypeSubjects = <TypeQuad extends Quad>(
  typeQuads: ReadonlyArray<TypeQuad>
): Result.Result<ReadonlyArray<TypeQuad>, ProvRdfCodecError> =>
  A.length(A.dedupe(A.map(typeQuads, (value) => serializeTerm(value.subject)))) === A.length(typeQuads)
    ? Result.succeed(typeQuads)
    : Result.fail(codecError("Multiple supported PROV RDF types share one subject"));

/*
 * Reconstructs a supported provenance bundle from one RDF dataset graph.
 *
 * **Example** (Decode an empty default graph)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { datasetToProvBundle } from "@beep/rdf/ProvRdf"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const decoded = datasetToProvBundle(makeDataset([]))
 * console.log(Result.isSuccess(decoded)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
const datasetToProvBundleInternal = (
  dataset: Dataset,
  options: ProvRdfCodecOptions = defaultOptions
): Result.Result<ProvBundle, ProvRdfCodecError> => {
  const quads = A.filter(dataset.quads, inSelectedGraph(selectGraph(options)));
  const typeQuads = A.filter(quads, isProvTypeQuad);
  return pipe(
    typeQuads,
    ensureUniqueTypeSubjects,
    Result.flatMap(
      flow(
        A.map((value) => decodeRecord(quads, value)),
        Result.all
      )
    ),
    Result.map((records) => ProvBundle.make({ records }))
  );
};

/** @internal */
const isDatasetDataFirst = (args: IArguments): boolean => Dataset.is(args[0]);

/**
 * Reconstructs a supported provenance bundle from one RDF dataset graph.
 *
 * **Example** (Decode an empty dataset)
 *
 * ```ts import.meta.vitest name="Decode an empty dataset"
 * import * as Result from "effect/Result"
 * import { datasetToProvBundle } from "@beep/rdf/ProvRdf"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * Result.isSuccess(datasetToProvBundle(makeDataset([]))) // => true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const datasetToProvBundle: {
  (dataset: Dataset): Result.Result<ProvBundle, ProvRdfCodecError>;
  (dataset: Dataset, options: ProvRdfCodecOptions): Result.Result<ProvBundle, ProvRdfCodecError>;
  (options: ProvRdfCodecOptions): (dataset: Dataset) => Result.Result<ProvBundle, ProvRdfCodecError>;
} = dual(isDatasetDataFirst, datasetToProvBundleInternal);
