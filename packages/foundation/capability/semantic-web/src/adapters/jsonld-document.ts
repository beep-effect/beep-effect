/**
 * Local JSON-LD document adapter backing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, flow, Layer, Match, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { IRIReference } from "../iri.ts";
import {
  JsonLdContext,
  JsonLdDocument,
  JsonLdLiteralValue,
  JsonLdNodeIdentifier,
  JsonLdNodeObject,
  JsonLdPropertyValue,
  JsonLdReferenceValue,
} from "../jsonld.ts";
import { BlankNode, DefaultGraph, Literal, makeDataset, NamedNode, Quad } from "../rdf.ts";
import {
  JsonLdDocumentError,
  JsonLdDocumentResult,
  JsonLdDocumentService,
  JsonLdToRdfResult,
} from "../services/jsonld-document.ts";
import { RDF_TYPE } from "../vocab/rdf.ts";
import { XSD_BOOLEAN, XSD_DOUBLE, XSD_INTEGER, XSD_STRING } from "../vocab/xsd.ts";
import type { ObjectTerm, Subject } from "../rdf.ts";
import type {
  JsonLdDocumentLoaderPolicy,
  JsonLdDocumentServiceShape,
  NormalizeJsonLdDocumentRequest,
} from "../services/jsonld-document.ts";

const $I = $SemanticWebId.create("adapters/jsonld-document");

const schemePrefix = /^[A-Za-z][A-Za-z0-9+.-]*:/;

const isReferenceValue = S.is(JsonLdReferenceValue);

class MutableNode extends S.Class<MutableNode>($I`MutableNode`)(
  {
    id: JsonLdNodeIdentifier,
    types: S.Array(IRIReference),
    properties: S.Record(S.String, S.Array(JsonLdPropertyValue)),
  },
  $I.annote("MutableNode", {
    description: "A mutable representation of a JSON-LD node, used during processing and transformation.",
  })
) {}

const byNodeIdentifierAscending: Order.Order<JsonLdNodeObject> = Order.mapInput(Order.String, (node) =>
  O.isSome(node["@id"]) ? node["@id"].value : ""
);

const byMutableNodeIdAscending: Order.Order<MutableNode> = Order.mapInput(Order.String, (node) => node.id);

const bindingIdentifier = (binding: string | { readonly "@id": string }): string =>
  P.isString(binding) ? binding : binding["@id"];

const makeDocumentError = (
  reason: JsonLdDocumentError["reason"],
  message: string,
  subject?: string
): JsonLdDocumentError =>
  JsonLdDocumentError.make({
    reason,
    message,
    subject: O.fromNullishOr(subject),
  });

type ContextOption = O.Option<JsonLdContext>;
type ReferenceObjectTerm = Extract<ObjectTerm, { readonly termType: "NamedNode" | "BlankNode" }>;

const mapOptionEffect = <A, B, E>(
  option: O.Option<A>,
  f: (value: A) => Effect.Effect<B, E>
): Effect.Effect<O.Option<B>, E> =>
  O.match(option, {
    onNone: () => Effect.succeed(O.none<B>()),
    onSome: (value) => Effect.map(f(value), O.some),
  });

const decodeIriReference = (
  value: string,
  reason: JsonLdDocumentError["reason"],
  subject: string = value
): Effect.Effect<IRIReference, JsonLdDocumentError> =>
  S.decodeUnknownEffect(IRIReference)(value).pipe(
    Effect.mapError((cause) =>
      makeDocumentError(reason, `Failed to decode JSON-LD IRI reference "${value}": ${String(cause)}`, subject)
    )
  );

const decodeJsonLdNodeIdentifier = (
  value: string,
  reason: JsonLdDocumentError["reason"],
  subject: string = value
): Effect.Effect<JsonLdNodeIdentifier, JsonLdDocumentError> =>
  S.decodeUnknownEffect(JsonLdNodeIdentifier)(value).pipe(
    Effect.mapError((cause) =>
      makeDocumentError(reason, `Failed to decode JSON-LD node identifier "${value}": ${String(cause)}`, subject)
    )
  );

const makeNamedNodeEffect = (
  value: string,
  reason: JsonLdDocumentError["reason"],
  subject: string = value
): Effect.Effect<NamedNode, JsonLdDocumentError> =>
  S.decodeUnknownEffect(NamedNode)({ termType: "NamedNode", value }).pipe(
    Effect.mapError((cause) =>
      makeDocumentError(reason, `Failed to decode RDF named node "${value}": ${String(cause)}`, subject)
    )
  );

const makeBlankNodeEffect = (
  value: string,
  reason: JsonLdDocumentError["reason"],
  subject: string = value
): Effect.Effect<BlankNode, JsonLdDocumentError> =>
  S.decodeUnknownEffect(BlankNode)({ termType: "BlankNode", value }).pipe(
    Effect.mapError((cause) =>
      makeDocumentError(reason, `Failed to decode RDF blank node "${value}": ${String(cause)}`, subject)
    )
  );

const makeLiteralEffect = (options: {
  readonly datatype: NamedNode;
  readonly language: string | undefined;
  readonly reason: JsonLdDocumentError["reason"];
  readonly subject: string;
  readonly value: string;
}): Effect.Effect<Literal, JsonLdDocumentError> =>
  S.decodeUnknownEffect(Literal)({
    termType: "Literal",
    value: options.value,
    datatype: options.datatype,
    ...O.getSomesStruct({ language: O.fromUndefinedOr(options.language) }),
  }).pipe(
    Effect.mapError((cause) =>
      makeDocumentError(
        options.reason,
        `Failed to decode RDF literal "${options.value}": ${String(cause)}`,
        options.subject
      )
    )
  );

const makeQuadEffect = (
  subject: Subject,
  predicate: NamedNode,
  object: ObjectTerm
): Effect.Effect<Quad, JsonLdDocumentError> =>
  Effect.succeed(
    Quad.make({
      subject,
      predicate,
      object,
      graph: DefaultGraph.make({ termType: "DefaultGraph", value: "" }),
    })
  );

const compactIriReference =
  (context: ContextOption, reason: JsonLdDocumentError["reason"]) =>
  (identifier: string): Effect.Effect<IRIReference, JsonLdDocumentError> =>
    decodeIriReference(compactIdentifier(context, identifier), reason, identifier);

const compactNodeIdentifier =
  (context: ContextOption, reason: JsonLdDocumentError["reason"]) =>
  (identifier: string): Effect.Effect<JsonLdNodeIdentifier, JsonLdDocumentError> =>
    decodeJsonLdNodeIdentifier(compactIdentifier(context, identifier), reason, identifier);

const compactIriReferenceValues =
  (context: ContextOption, reason: JsonLdDocumentError["reason"]) =>
  (values: ReadonlyArray<IRIReference>): Effect.Effect<ReadonlyArray<IRIReference>, JsonLdDocumentError> =>
    Effect.forEach(values, compactIriReference(context, reason));

const expandCompactIdentifier = (context: ContextOption, value: string): string => {
  if (
    pipe(value, Str.startsWith("@")) ||
    pipe(value, Str.startsWith("_:")) ||
    schemePrefix.test(value) ||
    O.isNone(context)
  ) {
    return value;
  }

  const currentContext = context.value;
  const expandedCurie = pipe(
    value,
    Str.split(":"),
    A.match({
      onEmpty: O.none,
      onNonEmpty: ([prefix, ...suffix]) =>
        suffix.length === 1
          ? pipe(
              currentContext.terms,
              R.get(prefix),
              O.map((binding) => `${bindingIdentifier(binding)}${suffix[0]}`)
            )
          : O.none(),
    })
  );

  if (O.isSome(expandedCurie)) {
    return expandedCurie.value;
  }

  const directBinding = pipe(currentContext.terms, R.get(value), O.map(bindingIdentifier));
  if (O.isSome(directBinding)) {
    return directBinding.value;
  }

  if (O.isSome(currentContext["@vocab"])) {
    return `${currentContext["@vocab"].value}${value}`;
  }

  if (O.isSome(currentContext["@base"])) {
    return new URL(value, currentContext["@base"].value).href;
  }

  return value;
};

const compactIdentifier = (context: ContextOption, iri: string): string => {
  if (O.isNone(context) || pipe(iri, Str.startsWith("_:"))) {
    return iri;
  }

  const currentContext = context.value;
  const compactedTerm = pipe(
    currentContext.terms,
    R.toEntries,
    A.findFirst(([_, binding]) => {
      const identifier = bindingIdentifier(binding);
      return identifier === iri || pipe(iri, Str.startsWith(identifier));
    }),
    O.map(([term, binding]) => {
      const identifier = bindingIdentifier(binding);
      return identifier === iri ? term : `${term}:${pipe(iri, Str.slice(identifier.length))}`;
    })
  );

  if (O.isSome(compactedTerm)) {
    return compactedTerm.value;
  }

  if (O.isSome(currentContext["@vocab"]) && pipe(iri, Str.startsWith(currentContext["@vocab"].value))) {
    return pipe(iri, Str.slice(currentContext["@vocab"].value.length));
  }

  return iri;
};

const isReferenceObjectTerm = (object: ObjectTerm): object is ReferenceObjectTerm =>
  object.termType === "NamedNode" || object.termType === "BlankNode";

const referenceValueFromObject: {
  (object: ObjectTerm, context: ContextOption): Effect.Effect<O.Option<JsonLdReferenceValue>, JsonLdDocumentError>;
  (context: ContextOption): (object: ObjectTerm) => Effect.Effect<O.Option<JsonLdReferenceValue>, JsonLdDocumentError>;
} = dual(
  2,
  (object: ObjectTerm, context: ContextOption): Effect.Effect<O.Option<JsonLdReferenceValue>, JsonLdDocumentError> =>
    pipe(
      object,
      O.liftPredicate(isReferenceObjectTerm),
      O.match({
        onNone: () => Effect.succeed(O.none<JsonLdReferenceValue>()),
        onSome: (referenceObject) => {
          const identifier = identifierFromObject(referenceObject);
          return Effect.map(
            decodeJsonLdNodeIdentifier(compactIdentifier(context, identifier), "bridgingFailure", identifier),
            (id) =>
              O.some(
                JsonLdReferenceValue.make({
                  "@id": id,
                })
              )
          );
        },
      })
    )
);

const resolveIdentifier = (value: string, base: O.Option<string>): string => {
  if (pipe(value, Str.startsWith("_:")) || schemePrefix.test(value)) {
    return value;
  }

  return O.isSome(base) ? new URL(value, base.value).href : value;
};

const resolveJsonLdIdentifier = (value: string, context: ContextOption, base: O.Option<string>): string =>
  resolveIdentifier(expandCompactIdentifier(context, value), base);

const subjectFromIdentifier = (value: string): Effect.Effect<Subject, JsonLdDocumentError> =>
  pipe(value, Str.startsWith("_:"))
    ? makeBlankNodeEffect(pipe(value, Str.slice(2)), "invalidNodeReference", value)
    : makeNamedNodeEffect(value, "invalidNodeReference");

const objectFromIdentifier = (value: string): Effect.Effect<ObjectTerm, JsonLdDocumentError> =>
  pipe(value, Str.startsWith("_:"))
    ? makeBlankNodeEffect(pipe(value, Str.slice(2)), "invalidNodeReference", value)
    : makeNamedNodeEffect(value, "invalidNodeReference");

const datatypeFromScalar = (value: string | number | boolean): string =>
  Match.value(value).pipe(
    Match.when(P.isBoolean, () => XSD_BOOLEAN.value),
    Match.when(
      (scalar): scalar is number => P.isNumber(scalar) && Number.isInteger(scalar),
      () => XSD_INTEGER.value
    ),
    Match.when(P.isNumber, () => XSD_DOUBLE.value),
    Match.orElse(() => XSD_STRING.value)
  );

const literalLexicalForm = (value: string | number | boolean): string =>
  Match.value(value).pipe(
    Match.when(P.isString, (scalar) => scalar),
    Match.when(P.isBoolean, (scalar) => (scalar ? "true" : "false")),
    Match.orElse((scalar) => `${scalar}`)
  );

const literalFromValue = Effect.fn("JsonLdDocument.literalFromValue")(function* (
  value: JsonLdLiteralValue,
  context: ContextOption,
  base: O.Option<string>
): Effect.fn.Return<ObjectTerm, JsonLdDocumentError> {
  const scalar = value["@value"];
  const datatype = O.isSome(value["@type"])
    ? resolveJsonLdIdentifier(value["@type"].value, context, base)
    : datatypeFromScalar(scalar);
  const language = O.isSome(value["@language"]) ? value["@language"].value : undefined;
  const datatypeNode = yield* makeNamedNodeEffect(datatype, "invalidNodeReference", datatype);
  return yield* makeLiteralEffect({
    datatype: datatypeNode,
    language,
    reason: "bridgingFailure",
    subject: datatype,
    value: literalLexicalForm(scalar),
  });
});

const compactLiteralValue = Effect.fn("JsonLdDocument.compactLiteralValue")(function* (
  value: JsonLdLiteralValue,
  context: ContextOption
): Effect.fn.Return<JsonLdLiteralValue, JsonLdDocumentError> {
  const type = yield* mapOptionEffect(value["@type"], (identifier) =>
    decodeIriReference(compactIdentifier(context, identifier), "bridgingFailure", identifier)
  );

  return JsonLdLiteralValue.make({
    "@value": value["@value"],
    "@type": type,
    "@language": value["@language"],
  });
});

const compactPropertyValues = (
  values: ReadonlyArray<JsonLdPropertyValue>,
  context: ContextOption
): Effect.Effect<ReadonlyArray<JsonLdPropertyValue>, JsonLdDocumentError> =>
  Effect.forEach(
    values,
    (value): Effect.Effect<JsonLdPropertyValue, JsonLdDocumentError> =>
      isReferenceValue(value)
        ? Effect.map(
            decodeJsonLdNodeIdentifier(compactIdentifier(context, value["@id"]), "bridgingFailure", value["@id"]),
            (id) =>
              JsonLdReferenceValue.make({
                "@id": id,
              })
          )
        : compactLiteralValue(value, context)
  );

const compactPropertyEntry = (
  key: string,
  values: ReadonlyArray<JsonLdPropertyValue>,
  context: JsonLdContext
): Effect.Effect<readonly [string, ReadonlyArray<JsonLdPropertyValue>], JsonLdDocumentError> =>
  Effect.map(
    compactPropertyValues(values, O.some(context)),
    (compactedValues) => [compactIdentifier(O.some(context), key), compactedValues] as const
  );

const compactNode = Effect.fn("JsonLdDocument.compactNode")(function* (
  node: JsonLdNodeObject,
  context: JsonLdContext
): Effect.fn.Return<JsonLdNodeObject, JsonLdDocumentError> {
  const id = yield* mapOptionEffect(node["@id"], compactNodeIdentifier(O.some(context), "bridgingFailure"));
  const type = yield* mapOptionEffect(node["@type"], compactIriReferenceValues(O.some(context), "bridgingFailure"));
  const properties = yield* Effect.forEach(pipe(node.properties, R.toEntries), ([key, values]) =>
    compactPropertyEntry(key, values, context)
  );

  return JsonLdNodeObject.make({
    "@id": id,
    "@type": type,
    properties: R.fromEntries(properties),
  });
});

const byStringAscending: Order.Order<string> = Order.String;
const byRecordEntryKeyAscending = <Value>(): Order.Order<readonly [string, Value]> =>
  Order.mapInput(byStringAscending, (entry) => entry[0]);

const byJsonLdPropertyValueAscending: Order.Order<JsonLdPropertyValue> = Order.mapInput(Order.String, (value) =>
  isReferenceValue(value)
    ? `ref:${value["@id"]}`
    : `lit:${pipe(
        value["@type"],
        O.getOrElse(() => "")
      )}:${pipe(
        value["@language"],
        O.getOrElse(() => "")
      )}:${literalLexicalForm(value["@value"])}`
);

const normalizeJsonLdContext = (context: JsonLdContext): JsonLdContext =>
  JsonLdContext.make({
    "@base": context["@base"],
    "@vocab": context["@vocab"],
    terms: R.fromEntries(pipe(context.terms, R.toEntries, A.sort(byRecordEntryKeyAscending()))),
  });

const normalizeJsonLdLiteralValue = (value: JsonLdLiteralValue): JsonLdLiteralValue =>
  JsonLdLiteralValue.make({
    "@value": value["@value"],
    "@type": value["@type"],
    "@language": pipe(value["@language"], O.map(Str.toLowerCase)),
  });

const sortJsonLdPropertyValues = (values: ReadonlyArray<JsonLdPropertyValue>): ReadonlyArray<JsonLdPropertyValue> =>
  A.sort(
    pipe(
      values,
      A.map((value) => (isReferenceValue(value) ? value : normalizeJsonLdLiteralValue(value)))
    ),
    byJsonLdPropertyValueAscending
  );

const normalizeJsonLdProperties = (
  properties: Record<string, ReadonlyArray<JsonLdPropertyValue>>
): Record<string, ReadonlyArray<JsonLdPropertyValue>> =>
  R.fromEntries(
    pipe(
      properties,
      R.toEntries,
      A.sort(byRecordEntryKeyAscending()),
      A.map(([key, values]) => [key, sortJsonLdPropertyValues(values)] as const)
    )
  );

const normalizeJsonLdNode = (node: JsonLdNodeObject): JsonLdNodeObject =>
  JsonLdNodeObject.make({
    "@id": node["@id"],
    "@type": pipe(
      node["@type"],
      O.map((values) => A.sort(values, byStringAscending))
    ),
    properties: normalizeJsonLdProperties(node.properties),
  });

const normalizeJsonLdDocumentStructure = (document: JsonLdDocument): JsonLdDocument =>
  JsonLdDocument.make({
    "@context": pipe(document["@context"], O.map(normalizeJsonLdContext)),
    "@graph": pipe(document["@graph"], A.map(normalizeJsonLdNode), A.sort(byNodeIdentifierAscending)),
  });

const resolveDocumentBase = (
  loaderPolicy: O.Option<JsonLdDocumentLoaderPolicy>,
  context: ContextOption
): O.Option<string> =>
  pipe(
    loaderPolicy,
    O.flatMap((policy) => policy.baseIri),
    O.orElse(() => (O.isSome(context) ? context.value["@base"] : O.none<string>()))
  );

const validateLoaderPolicy = (
  loaderPolicy: O.Option<JsonLdDocumentLoaderPolicy>
): Effect.Effect<O.Option<JsonLdDocumentLoaderPolicy>, JsonLdDocumentError> =>
  O.isSome(loaderPolicy) && loaderPolicy.value.allowRemoteDocuments
    ? Effect.fail(
        makeDocumentError(
          "loaderPolicyViolation",
          "Remote JSON-LD document loading is outside the bounded v1 document adapter surface."
        )
      )
    : Effect.succeed(loaderPolicy);

const expandLiteralValue = Effect.fn("JsonLdDocument.expandLiteralValue")(function* (
  value: JsonLdLiteralValue,
  context: ContextOption,
  base: O.Option<string>
): Effect.fn.Return<JsonLdLiteralValue, JsonLdDocumentError> {
  const type = yield* mapOptionEffect(value["@type"], (identifier) =>
    decodeIriReference(resolveJsonLdIdentifier(identifier, context, base), "invalidNodeReference", identifier)
  );

  return JsonLdLiteralValue.make({
    "@value": value["@value"],
    "@type": type,
    "@language": value["@language"],
  });
});

const expandJsonLdPropertyValue = (
  value: JsonLdPropertyValue,
  context: ContextOption,
  base: O.Option<string>
): Effect.Effect<JsonLdPropertyValue, JsonLdDocumentError> =>
  isReferenceValue(value)
    ? Effect.map(
        decodeJsonLdNodeIdentifier(
          resolveJsonLdIdentifier(value["@id"], context, base),
          "invalidNodeReference",
          value["@id"]
        ),
        (id) =>
          JsonLdReferenceValue.make({
            "@id": id,
          })
      )
    : expandLiteralValue(value, context, base);

const expandJsonLdNode = Effect.fn("JsonLdDocument.expandJsonLdNode")(function* (
  node: JsonLdNodeObject,
  context: ContextOption,
  base: O.Option<string>
): Effect.fn.Return<JsonLdNodeObject, JsonLdDocumentError> {
  const propertyEntries = pipe(node.properties, R.toEntries, A.sort(byRecordEntryKeyAscending()));
  const expandedProperties = yield* Effect.forEach(
    propertyEntries,
    Effect.fnUntraced(function* ([key, values]) {
      const predicateIri = resolveJsonLdIdentifier(key, context, base);
      if (!schemePrefix.test(predicateIri)) {
        return yield* makeDocumentError("unknownPredicate", `Unable to expand JSON-LD property key: ${key}`, key);
      }

      const expandedValues = yield* Effect.forEach(values, (value) => expandJsonLdPropertyValue(value, context, base));

      return [predicateIri, expandedValues] as const;
    })
  );
  const id = yield* mapOptionEffect(node["@id"], (identifier) =>
    decodeJsonLdNodeIdentifier(resolveJsonLdIdentifier(identifier, context, base), "invalidNodeReference", identifier)
  );
  const type = yield* mapOptionEffect(node["@type"], (values) =>
    Effect.forEach(values, (value) =>
      decodeIriReference(resolveJsonLdIdentifier(value, context, base), "invalidNodeReference", value)
    )
  );

  return JsonLdNodeObject.make({
    "@id": id,
    "@type": type,
    properties: R.fromEntries(expandedProperties),
  });
});

const expandJsonLdDocument = Effect.fn("JsonLdDocument.expandJsonLdDocument")(function* (
  document: JsonLdDocument,
  loaderPolicy: O.Option<JsonLdDocumentLoaderPolicy>
): Effect.fn.Return<JsonLdDocument, JsonLdDocumentError> {
  yield* validateLoaderPolicy(loaderPolicy);
  const context = document["@context"];
  const base = resolveDocumentBase(loaderPolicy, context);
  const graph = yield* Effect.forEach(document["@graph"], (node) => expandJsonLdNode(node, context, base));
  return normalizeJsonLdDocumentStructure(
    JsonLdDocument.make({
      "@context": O.none(),
      "@graph": graph,
    })
  );
});

const hasAnonymousJsonLdNode = (document: JsonLdDocument): boolean =>
  pipe(
    document["@graph"],
    A.some((node) => O.isNone(node["@id"]))
  );

const normalizeJsonLdDocument = Effect.fn("JsonLdDocument.normalizeJsonLdDocument")(function* (
  request: NormalizeJsonLdDocumentRequest
): Effect.fn.Return<JsonLdDocument, JsonLdDocumentError> {
  const safeMode = pipe(
    request.safeMode,
    O.getOrElse(() => false)
  );
  if (safeMode && hasAnonymousJsonLdNode(request.document)) {
    return yield* makeDocumentError(
      "normalizationFailure",
      "Safe-mode normalization requires explicit @id values for every JSON-LD node."
    );
  }

  if (request.profile === "expanded-v1") {
    return yield* expandJsonLdDocument(request.document, request.loaderPolicy);
  }

  yield* validateLoaderPolicy(request.loaderPolicy);
  return normalizeJsonLdDocumentStructure(request.document);
});

const matchesFrameType = (node: JsonLdNodeObject, frameType: string, context: ContextOption): boolean =>
  pipe(
    node["@type"],
    O.exists(flow(A.some((value) => value === frameType || compactIdentifier(context, value) === frameType)))
  );

const filterNodeProperties = (node: JsonLdNodeObject, allowed: ReadonlyArray<string>): JsonLdNodeObject =>
  JsonLdNodeObject.make({
    "@id": node["@id"],
    "@type": node["@type"],
    properties: R.fromEntries(
      pipe(
        node.properties,
        R.toEntries,
        A.filter(([key]) => pipe(allowed, A.contains(key)))
      )
    ),
  });

const ensureNamedNodeIdentifier = (
  value: string,
  reason: JsonLdDocumentError["reason"]
): Effect.Effect<string, JsonLdDocumentError> =>
  pipe(value, Str.startsWith("_:"))
    ? Effect.fail(
        makeDocumentError(reason, "Blank node identifiers are outside the bounded JSON-LD document surface.", value)
      )
    : Effect.succeed(value);

const emptyPropertyValues: ReadonlyArray<JsonLdPropertyValue> = [];

const makeMutableNode = (identifier: string): Effect.Effect<MutableNode, JsonLdDocumentError> =>
  Effect.map(decodeJsonLdNodeIdentifier(identifier, "bridgingFailure"), (id) => ({
    id,
    types: [],
    properties: {},
  }));

const getMutableNode = (
  nodes: Record<string, MutableNode>,
  identifier: string
): Effect.Effect<MutableNode, JsonLdDocumentError> =>
  pipe(
    nodes,
    R.get(identifier),
    O.match({
      onNone: () => makeMutableNode(identifier),
      onSome: Effect.succeed,
    })
  );

const appendMutableNodeType = (node: MutableNode, value: string): Effect.Effect<MutableNode, JsonLdDocumentError> =>
  Effect.map(decodeIriReference(value, "bridgingFailure"), (type) => ({
    ...node,
    types: pipe(node.types, A.append(type)),
  }));

const appendMutableNodePropertyValue = (
  node: MutableNode,
  propertyKey: string,
  value: JsonLdPropertyValue
): MutableNode => ({
  ...node,
  properties: R.set(
    node.properties,
    propertyKey,
    pipe(
      node.properties,
      R.get(propertyKey),
      O.getOrElse(() => emptyPropertyValues),
      A.append(value)
    )
  ),
});

const identifierFromSubject = (subject: Subject): string =>
  subject.termType === "BlankNode" ? `_:${subject.value}` : subject.value;

const identifierFromObject = (object: Extract<ObjectTerm, { readonly termType: "NamedNode" | "BlankNode" }>): string =>
  object.termType === "BlankNode" ? `_:${object.value}` : object.value;

const literalValueFromRdf = Effect.fn("JsonLdDocument.literalValueFromRdf")(function* (
  quad: Quad,
  context: ContextOption
): Effect.fn.Return<JsonLdLiteralValue, JsonLdDocumentError> {
  const object = quad.object;

  if (object.termType !== "Literal") {
    return JsonLdLiteralValue.make({
      "@value": "",
      "@type": O.none(),
      "@language": O.none(),
    });
  }

  const scalar = Match.value(object.datatype.value).pipe(
    Match.when(XSD_BOOLEAN.value, () => object.value === "true"),
    Match.whenOr(XSD_INTEGER.value, XSD_DOUBLE.value, () => Number(object.value)),
    Match.orElse(() => object.value)
  );

  const type =
    object.datatype.value === XSD_STRING.value
      ? O.none<IRIReference>()
      : O.some(
          yield* decodeIriReference(
            compactIdentifier(context, object.datatype.value),
            "bridgingFailure",
            object.datatype.value
          )
        );

  return JsonLdLiteralValue.make({
    "@value": scalar,
    "@type": type,
    "@language": O.isSome(object.language) ? O.some(object.language.value) : O.none(),
  });
});

/**
 * JSON-LD document service live layer.
 *
 * **Example** (Flatten empty JSON-LD)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentServiceLive } from "@beep/semantic-web/adapters/jsonld-document"
 * import {
 *   FlattenJsonLdDocumentRequest,
 *   JsonLdDocumentService
 * } from "@beep/semantic-web/services/jsonld-document"
 *
 * const request = S.decodeUnknownSync(FlattenJsonLdDocumentRequest)({
 *   document: { "@graph": [] }
 * })
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* JsonLdDocumentService
 *     return yield* service.flatten(request)
 *   }).pipe(Effect.provide(JsonLdDocumentServiceLive))
 * )
 * strictEqual(result.document["@graph"].length, 0)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const JsonLdDocumentServiceLive = Layer.succeed(
  JsonLdDocumentService,
  JsonLdDocumentService.of({
    compact: Effect.fn(function* (request) {
      const graph = yield* Effect.forEach(request.document["@graph"], (node) => compactNode(node, request.context));

      return JsonLdDocumentResult.make({
        document: JsonLdDocument.make({
          "@context": O.some(request.context),
          "@graph": graph,
        }),
      });
    }),
    expand: Effect.fn((request) =>
      Effect.map(expandJsonLdDocument(request.document, request.loaderPolicy), (document) =>
        JsonLdDocumentResult.make({
          document,
        })
      )
    ),
    flatten: Effect.fn((request) =>
      Effect.succeed(
        JsonLdDocumentResult.make({
          document: JsonLdDocument.make({
            "@context": request.document["@context"],
            "@graph": A.sort(request.document["@graph"], byNodeIdentifierAscending),
          }),
        })
      )
    ),
    normalize: Effect.fn((request) =>
      Effect.map(normalizeJsonLdDocument(request), (document) =>
        JsonLdDocumentResult.make({
          document,
        })
      )
    ),
    frame: Effect.fn((request) =>
      Effect.succeed(
        JsonLdDocumentResult.make({
          document: JsonLdDocument.make({
            "@context": request.document["@context"],
            "@graph": pipe(
              request.document["@graph"],
              A.filter(
                (node) =>
                  O.isNone(request.frame["@type"]) ||
                  matchesFrameType(node, request.frame["@type"].value, request.document["@context"])
              ),
              A.map((node) =>
                O.isSome(request.frame.includeProperties)
                  ? filterNodeProperties(node, request.frame.includeProperties.value)
                  : node
              )
            ),
          }),
        })
      )
    ),
    toRdf: Effect.fn(function* (request) {
      const context = request.document["@context"];
      const base = O.isSome(context) ? context.value["@base"] : O.none<string>();
      const quads: Array<Quad> = [];
      let anonymousNodeIndex = 0;

      for (const node of request.document["@graph"]) {
        const subject = O.isSome(node["@id"])
          ? yield* subjectFromIdentifier(resolveJsonLdIdentifier(node["@id"].value, context, base))
          : yield* makeBlankNodeEffect(`b${anonymousNodeIndex}`, "invalidNodeReference", `b${anonymousNodeIndex}`);

        anonymousNodeIndex += 1;

        if (O.isSome(node["@type"])) {
          for (const typeValue of node["@type"].value) {
            const typeIri = yield* ensureNamedNodeIdentifier(
              resolveJsonLdIdentifier(typeValue, context, base),
              "invalidNodeReference"
            );
            const object = yield* makeNamedNodeEffect(typeIri, "invalidNodeReference", typeValue);
            A.appendInPlace(quads, yield* makeQuadEffect(subject, RDF_TYPE, object));
          }
        }

        for (const [key, values] of R.toEntries(node.properties)) {
          const predicateIri = resolveJsonLdIdentifier(key, context, base);
          if (!schemePrefix.test(predicateIri)) {
            return yield* makeDocumentError("unknownPredicate", `Unable to expand JSON-LD property key: ${key}`, key);
          }

          const predicate = yield* makeNamedNodeEffect(predicateIri, "unknownPredicate", key);

          for (const value of values) {
            if (isReferenceValue(value)) {
              const objectIdentifier = resolveJsonLdIdentifier(value["@id"], context, base);
              const object = yield* objectFromIdentifier(objectIdentifier);
              A.appendInPlace(quads, yield* makeQuadEffect(subject, predicate, object));
            } else {
              const object = yield* literalFromValue(value, context, base);
              A.appendInPlace(quads, yield* makeQuadEffect(subject, predicate, object));
            }
          }
        }
      }

      return JsonLdToRdfResult.make({
        dataset: makeDataset(quads),
      });
    }),
    fromRdf: Effect.fn(function* (request) {
      let nodes: Record<string, MutableNode> = {};

      for (const quad of request.dataset.quads) {
        const subjectIdentifier = identifierFromSubject(quad.subject);
        const node = yield* getMutableNode(nodes, subjectIdentifier);

        if (quad.predicate.value === RDF_TYPE.value) {
          if (quad.object.termType !== "NamedNode") {
            return yield* makeDocumentError(
              "bridgingFailure",
              "rdf:type objects must be named nodes when bridging to JSON-LD.",
              quad.predicate.value
            );
          }

          nodes = R.set(nodes, subjectIdentifier, yield* appendMutableNodeType(node, quad.object.value));
          continue;
        }

        const propertyKey = compactIdentifier(request.context, quad.predicate.value);
        const referenceValue = yield* referenceValueFromObject(quad.object, request.context);
        const propertyValue = O.isSome(referenceValue)
          ? referenceValue.value
          : yield* literalValueFromRdf(quad, request.context);

        nodes = R.set(nodes, subjectIdentifier, appendMutableNodePropertyValue(node, propertyKey, propertyValue));
      }

      const graph = yield* pipe(
        nodes,
        R.values,
        A.sort(byMutableNodeIdAscending),
        Effect.forEach(
          Effect.fnUntraced(function* (node) {
            const type = yield* pipe(
              node.types,
              A.match({
                onEmpty: () => Effect.succeed(O.none<ReadonlyArray<IRIReference>>()),
                onNonEmpty: (values) =>
                  Effect.map(compactIriReferenceValues(request.context, "bridgingFailure")(values), O.some),
              })
            );

            return JsonLdNodeObject.make({
              "@id": O.some(
                yield* decodeJsonLdNodeIdentifier(
                  compactIdentifier(request.context, node.id),
                  "bridgingFailure",
                  node.id
                )
              ),
              "@type": type,
              properties: node.properties,
            });
          })
        )
      );

      return JsonLdDocumentResult.make({
        document: JsonLdDocument.make({
          "@context": request.context,
          "@graph": graph,
        }),
      });
    }),
  } satisfies JsonLdDocumentServiceShape)
);
