import { $OntologyId } from "@beep/identity";
import { LanguageTag } from "@beep/rdf/Rdf";
import { A, O, Str } from "@beep/utils";
import { flow, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  isOntologyClassAnnotationDraft,
  isOntologyPredicateAnnotationDraft,
  makeUri,
  OntologyClassAnnotationDraft,
  OntologyDatatypePredicateAnnotationDraft,
  OntologyLanguageLiteral,
  OntologyObjectPredicateAnnotationDraft,
  OntologyProvenanceMetadata,
  OntologyProvenanceVerificationStatus,
  OntologySkosConceptProfileDraft,
  OntologySkosConceptSchemeProfileDraft,
  OntologySkosProfileDraft,
  schemaIssueToError,
} from "./model.js";
import {
  makeReferenceTarget,
  normalizeIriInput,
  normalizeTermNameInput,
  OntologyIriInput,
  OntologyReferenceTargetInput,
  OntologyTermNameInput,
  optionalReferenceTargets,
  optionalReferenceTargetsOption,
} from "./references.js";
import type { IdentityAnyAnnotationExtras, IdentityComposer, KeyAnnotationExtras } from "@beep/identity";
import type { OntologyMetadataAnnotationPayload, OntologyPredicateAnnotationDraft, OntologyTermName } from "./model.js";

const $I = $OntologyId.create("annotations");

const decodeLanguageTagResult = S.decodeUnknownResult(LanguageTag);

const makeLanguageTag = (value: string): LanguageTag =>
  pipe(decodeLanguageTagResult(value), Result.getOrThrowWith(schemaIssueToError));

export class OntologyLanguageLiteralInputObject extends S.Class<OntologyLanguageLiteralInputObject>(
  $I`OntologyLanguageLiteralInputObject`
)(
  {
    value: S.String,
    language: S.optionalKey(S.String),
  },
  $I.annote("OntologyLanguageLiteralInputObject", {
    description: "Input object for a language-aware ontology literal.",
  })
) {}

export const OntologyLanguageLiteralInput = S.Union([S.String, OntologyLanguageLiteralInputObject]).pipe(
  $I.annoteSchema("OntologyLanguageLiteralInput", {
    description: "Input value for a SKOS label or note, either plain text or text plus language.",
  })
);
export type OntologyLanguageLiteralInput = typeof OntologyLanguageLiteralInput.Type;

const isPlainLiteralInput = S.is(S.String);

export class OntologySkosConceptProfileInputFields extends S.Class<OntologySkosConceptProfileInputFields>(
  $I`OntologySkosConceptProfileInputFields`
)(
  {
    prefLabels: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    altLabels: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    hiddenLabels: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    definitions: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    scopeNotes: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    editorialNotes: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    historyNotes: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    broader: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    narrower: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    related: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    exactMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    closeMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    broadMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    narrowMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    relatedMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    inSchemes: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    topConceptOf: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
  },
  $I.annote("OntologySkosConceptProfileInputFields", {
    description: "Input fields for an opt-in SKOS concept profile.",
  })
) {}

export const OntologySkosConceptProfileInput = S.StructWithRest(
  S.Struct(OntologySkosConceptProfileInputFields.fields),
  [S.Record(S.PropertyKey, S.Any)]
).pipe(
  $I.annoteSchema("OntologySkosConceptProfileInput", {
    description: "Input type for an opt-in SKOS concept profile.",
  })
);
export type OntologySkosConceptProfileInput = typeof OntologySkosConceptProfileInput.Type;

export class OntologySkosConceptSchemeProfileInputFields extends S.Class<OntologySkosConceptSchemeProfileInputFields>(
  $I`OntologySkosConceptSchemeProfileInputFields`
)(
  {
    prefLabels: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    altLabels: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    hiddenLabels: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    definitions: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    scopeNotes: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    editorialNotes: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    historyNotes: OntologyLanguageLiteralInput.pipe(S.Array, S.optionalKey),
    hasTopConcepts: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
  },
  $I.annote("OntologySkosConceptSchemeProfileInputFields", {
    description: "Input fields for an opt-in SKOS concept scheme profile.",
  })
) {}

export const OntologySkosConceptSchemeProfileInput = S.StructWithRest(
  S.Struct(OntologySkosConceptSchemeProfileInputFields.fields),
  [S.Record(S.PropertyKey, S.Any)]
).pipe(
  $I.annoteSchema("OntologySkosConceptSchemeProfileInput", {
    description: "Input type for an opt-in SKOS concept scheme profile.",
  })
);
export type OntologySkosConceptSchemeProfileInput = typeof OntologySkosConceptSchemeProfileInput.Type;

export class OntologyProvenanceMetadataInputFields extends S.Class<OntologyProvenanceMetadataInputFields>(
  $I`OntologyProvenanceMetadataInputFields`
)(
  {
    sourceIri: S.optionalKey(OntologyIriInput),
    sourceUri: S.optionalKey(S.String),
    sourceLabel: S.optionalKey(S.String),
    sourceCitation: S.optionalKey(S.String),
    sourceSpan: S.optionalKey(S.String),
    sourceSelector: S.optionalKey(S.String),
    extractionMethod: S.optionalKey(S.String),
    verificationStatus: S.optionalKey(OntologyProvenanceVerificationStatus),
    updatedAt: S.optionalKey(S.String),
  },
  $I.annote("OntologyProvenanceMetadataInputFields", {
    description: "Input fields for optional domain-agnostic provenance metadata.",
  })
) {}

export const OntologyProvenanceMetadataInput = S.StructWithRest(
  S.Struct(OntologyProvenanceMetadataInputFields.fields),
  [S.Record(S.PropertyKey, S.Any)]
).pipe(
  $I.annoteSchema("OntologyProvenanceMetadataInput", {
    description: "Input type for optional domain-agnostic provenance metadata.",
  })
);
export type OntologyProvenanceMetadataInput = typeof OntologyProvenanceMetadataInput.Type;

class OntologyClassAnnotationInputFields extends S.Class<OntologyClassAnnotationInputFields>(
  $I`OntologyClassAnnotationInputFields`
)(
  {
    termName: S.optionalKey(OntologyTermNameInput),
    iri: S.optionalKey(OntologyIriInput),
    label: S.optionalKey(S.String),
    description: S.optionalKey(S.String),
    comment: S.optionalKey(S.String),
    altLabels: S.String.pipe(S.Array, S.optionalKey),
    definition: S.optionalKey(S.String),
    deprecated: S.optionalKey(S.Boolean),
    source: S.optionalKey(OntologyIriInput),
    parents: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    children: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    seeAlso: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    isDefinedBy: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    equivalentClasses: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    exactMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    closeMatches: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    sameAs: OntologyReferenceTargetInput.pipe(S.Array, S.optionalKey),
    skosProfile: S.optionalKey(OntologySkosProfileDraft),
    provenance: S.optionalKey(OntologyProvenanceMetadata),
  },
  $I.annote("OntologyClassAnnotationInputFields", {
    description:
      "Input fields for ontology class annotations, including term name, IRI, label, description, comment, alternative labels, definition, deprecation status, and source IRI.",
  })
) {}

export const OntologyClassAnnotationInput = S.StructWithRest(S.Struct(OntologyClassAnnotationInputFields.fields), [
  S.Record(S.PropertyKey, S.Any),
]).pipe(
  $I.annoteSchema("OntologyClassAnnotationInput", {
    description:
      "Input type for ontology class annotations, including term name, IRI, label, description, comment, alternative labels, definition, deprecation status, and source IRI.",
  })
);

export type OntologyClassAnnotationInput = typeof OntologyClassAnnotationInput.Type;

export class OntologyPredicateAnnotationInputFields extends S.Class<OntologyPredicateAnnotationInputFields>(
  $I`OntologyPredicateAnnotationInputFields`
)(
  {
    termName: S.optionalKey(OntologyTermNameInput),
    iri: S.optionalKey(OntologyIriInput),
    label: S.optionalKey(S.String),
    description: S.optionalKey(S.String),
    comment: S.optionalKey(S.String),
  },
  $I.annote("OntologyPredicateAnnotationInputFields", {
    description:
      "Fields for ontology predicate annotations, including term name, IRI, label, description, comment, alternative labels, definition, deprecation status, and source IRI.",
  })
) {}

export const OntologyPredicateAnnotationInput = S.StructWithRest(
  S.Struct(OntologyPredicateAnnotationInputFields.fields),
  [S.Record(S.PropertyKey, S.Any)]
).pipe(
  $I.annoteSchema("OntologyPredicateAnnotationInput", {
    description:
      "Input type for ontology predicate annotations, including term name, IRI, label, description, comment, alternative labels, definition, deprecation status, and source IRI.",
  })
);
export type OntologyPredicateAnnotationInput = typeof OntologyPredicateAnnotationInput.Type;

export const OntologyDatatypePredicateAnnotationInput = S.StructWithRest(
  S.Struct({
    ...OntologyPredicateAnnotationInputFields.fields,
    range: OntologyIriInput,
  }),
  [S.Record(S.PropertyKey, S.Any)]
).pipe(
  $I.annoteSchema("OntologyDatatypePredicateAnnotationInput", {
    description:
      "Input type for ontology datatype predicate annotations, including term name, IRI, label, description, comment, alternative labels, definition, deprecation status, source IRI, and range (datatype IRI).",
  })
);

export type OntologyDatatypePredicateAnnotationInput = typeof OntologyDatatypePredicateAnnotationInput.Type;

export const OntologyObjectPredicateAnnotationInput = S.StructWithRest(
  S.Struct({
    ...OntologyPredicateAnnotationInputFields.fields,
    range: OntologyReferenceTargetInput,
  }),
  [S.Record(S.PropertyKey, S.Any)]
).pipe(
  $I.annoteSchema("OntologyObjectPredicateAnnotationInput", {
    description:
      "Input type for ontology object predicate annotations, including term name, IRI, label, description, comment, alternative labels, definition, deprecation status, source IRI, and range (reference target IRI).",
  })
);
export type OntologyObjectPredicateAnnotationInput = typeof OntologyObjectPredicateAnnotationInput.Type;

export class OntologyCreateInputFields extends S.Class<OntologyCreateInputFields>($I`OntologyCreateInputFields`)(
  {
    identity: S.declare(
      /* istanbul ignore next -- create input identity is typed by callers and not decoded through this internal schema */
      (u: unknown): u is IdentityComposer<string> => S.is(S.String)(u)
    ),
    baseIri: OntologyIriInput,
    preferredPrefix: S.String,
    label: S.String,
    comment: S.optionalKey(S.String),
  },
  $I.annote("OntologyCreateInputFields", {
    description:
      "Fields for creating an ontology, including identity, base IRI, preferred prefix, label, and optional comment.",
  })
) {}

export type OntologyCreateInput = OntologyCreateInputFields & {};

export const optionalString = (value: string | undefined): O.Option<string> => O.fromUndefinedOr(value);

export const optionalArray = <Value>(value: ReadonlyArray<Value> | undefined): ReadonlyArray<Value> =>
  pipe(O.fromUndefinedOr(value), O.getOrElse(A.empty<Value>));

export const optionalTermName = (value: OntologyTermNameInput | undefined): O.Option<OntologyTermName> =>
  pipe(O.fromUndefinedOr(value), O.map(normalizeTermNameInput));

export const optionalIri = (value: OntologyIriInput | undefined) =>
  pipe(O.fromUndefinedOr(value), O.map(normalizeIriInput));

export const optionalUri = (value: string | undefined) => pipe(O.fromUndefinedOr(value), O.map(makeUri));

export const makeLanguageLiteral = (input: OntologyLanguageLiteralInput): OntologyLanguageLiteral => {
  if (isPlainLiteralInput(input)) {
    return OntologyLanguageLiteral.make({ value: input, language: O.none() });
  }

  return OntologyLanguageLiteral.make({
    value: input.value,
    language: pipe(O.fromUndefinedOr(input.language), O.map(makeLanguageTag)),
  });
};

export const optionalLanguageLiterals = (
  value: ReadonlyArray<OntologyLanguageLiteralInput> | undefined
): ReadonlyArray<OntologyLanguageLiteral> =>
  pipe(O.fromUndefinedOr(value), O.getOrElse(A.empty<OntologyLanguageLiteralInput>), A.map(makeLanguageLiteral));

const firstStringOption = (first: O.Option<string>, second: O.Option<string>): O.Option<string> =>
  pipe([first, second], O.firstSomeOf);

export const humanizedTermName: (termName: OntologyTermName) => string = flow(
  Str.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
  Str.replace(/[._-]+/g, " "),
  Str.replace(/\s+/g, " "),
  Str.trim
);

export const classLabel = (termName: OntologyTermName): string =>
  pipe(humanizedTermName(termName), (label) => `${Str.toUpperCase(Str.slice(0, 1)(label))}${Str.slice(1)(label)}`);

export const predicateLabel = flow(humanizedTermName, Str.toLowerCase);

export const keyLeafTermName = (identifier: string): OntologyTermName =>
  pipe(
    identifier,
    Str.split("."),
    A.last,
    O.getOrElse(
      /* istanbul ignore next -- splitting a string always yields at least one segment */
      () => identifier
    ),
    normalizeTermNameInput
  );

export const draftMetadataComment: {
  (comment: O.Option<string>): (description: O.Option<string>) => O.Option<string>;
  (description: O.Option<string>, comment: O.Option<string>): O.Option<string>;
} = dual(
  2,
  (description: O.Option<string>, comment: O.Option<string>): O.Option<string> =>
    firstStringOption(comment, description)
);

const draftAnnotationExtras = (
  description: O.Option<string>,
  comment: O.Option<string>,
  ontologyMetadata: OntologyMetadataAnnotationPayload
): IdentityAnyAnnotationExtras<unknown> => ({
  ...R.getSomes({ description: firstStringOption(description, comment) }),
  ontologyMetadata,
});

export const makeSkosConceptProfileDraft = (input: OntologySkosConceptProfileInput): OntologySkosConceptProfileDraft =>
  OntologySkosConceptProfileDraft.make({
    kind: "concept",
    prefLabels: optionalLanguageLiterals(input.prefLabels),
    altLabels: optionalLanguageLiterals(input.altLabels),
    hiddenLabels: optionalLanguageLiterals(input.hiddenLabels),
    definitions: optionalLanguageLiterals(input.definitions),
    scopeNotes: optionalLanguageLiterals(input.scopeNotes),
    editorialNotes: optionalLanguageLiterals(input.editorialNotes),
    historyNotes: optionalLanguageLiterals(input.historyNotes),
    broader: optionalReferenceTargets(input.broader),
    narrower: optionalReferenceTargets(input.narrower),
    related: optionalReferenceTargets(input.related),
    exactMatches: optionalReferenceTargets(input.exactMatches),
    closeMatches: optionalReferenceTargets(input.closeMatches),
    broadMatches: optionalReferenceTargets(input.broadMatches),
    narrowMatches: optionalReferenceTargets(input.narrowMatches),
    relatedMatches: optionalReferenceTargets(input.relatedMatches),
    inSchemes: optionalReferenceTargets(input.inSchemes),
    topConceptOf: optionalReferenceTargets(input.topConceptOf),
  });

export const makeSkosConceptSchemeProfileDraft = (
  input: OntologySkosConceptSchemeProfileInput
): OntologySkosConceptSchemeProfileDraft =>
  OntologySkosConceptSchemeProfileDraft.make({
    kind: "conceptScheme",
    prefLabels: optionalLanguageLiterals(input.prefLabels),
    altLabels: optionalLanguageLiterals(input.altLabels),
    hiddenLabels: optionalLanguageLiterals(input.hiddenLabels),
    definitions: optionalLanguageLiterals(input.definitions),
    scopeNotes: optionalLanguageLiterals(input.scopeNotes),
    editorialNotes: optionalLanguageLiterals(input.editorialNotes),
    historyNotes: optionalLanguageLiterals(input.historyNotes),
    hasTopConcepts: optionalReferenceTargets(input.hasTopConcepts),
  });

export const makeProvenanceMetadata = (input: OntologyProvenanceMetadataInput): OntologyProvenanceMetadata =>
  OntologyProvenanceMetadata.make({
    sourceIri: optionalIri(input.sourceIri),
    sourceUri: optionalUri(input.sourceUri),
    sourceLabel: optionalString(input.sourceLabel),
    sourceCitation: optionalString(input.sourceCitation),
    sourceSpan: optionalString(input.sourceSpan),
    sourceSelector: optionalString(input.sourceSelector),
    extractionMethod: optionalString(input.extractionMethod),
    verificationStatus: O.fromUndefinedOr(input.verificationStatus),
    updatedAt: optionalString(input.updatedAt),
  });

export const makeClassDraft = (input: OntologyClassAnnotationInput): OntologyClassAnnotationDraft =>
  OntologyClassAnnotationDraft.make({
    kind: "classDraft",
    termName: optionalTermName(input.termName),
    iri: optionalIri(input.iri),
    label: optionalString(input.label),
    description: optionalString(input.description),
    comment: optionalString(input.comment),
    altLabels: optionalArray(input.altLabels),
    definition: optionalString(input.definition),
    deprecated: pipe(
      O.fromUndefinedOr(input.deprecated),
      O.getOrElse(() => false)
    ),
    source: optionalIri(input.source),
    parents: optionalReferenceTargets(input.parents),
    children: optionalReferenceTargets(input.children),
    seeAlso: optionalReferenceTargets(input.seeAlso),
    isDefinedBy: optionalReferenceTargetsOption(input.isDefinedBy),
    equivalentClasses: optionalReferenceTargets(input.equivalentClasses),
    exactMatches: optionalReferenceTargets(input.exactMatches),
    closeMatches: optionalReferenceTargets(input.closeMatches),
    sameAs: optionalReferenceTargets(input.sameAs),
    skosProfile: O.fromUndefinedOr(input.skosProfile),
    provenance: O.fromUndefinedOr(input.provenance),
  });

export const makeDatatypePredicateDraft = (
  input: OntologyDatatypePredicateAnnotationInput
): OntologyDatatypePredicateAnnotationDraft =>
  OntologyDatatypePredicateAnnotationDraft.make({
    kind: "datatypePredicateDraft",
    termName: optionalTermName(input.termName),
    iri: optionalIri(input.iri),
    label: optionalString(input.label),
    description: optionalString(input.description),
    comment: optionalString(input.comment),
    rangeDatatypeIri: normalizeIriInput(input.range),
  });

export const makeObjectPredicateDraft = (
  input: OntologyObjectPredicateAnnotationInput
): OntologyObjectPredicateAnnotationDraft =>
  OntologyObjectPredicateAnnotationDraft.make({
    kind: "objectPredicateDraft",
    termName: optionalTermName(input.termName),
    iri: optionalIri(input.iri),
    label: optionalString(input.label),
    description: optionalString(input.description),
    comment: optionalString(input.comment),
    rangeClass: makeReferenceTarget(input.range),
  });

export const createOntologyIdentity = (identity: IdentityComposer<string>) => {
  function annote(identifier: string, draft: OntologyClassAnnotationDraft): S.Annotations.Annotations;
  function annote(
    identifier: string,
    extras?: undefined | IdentityAnyAnnotationExtras<unknown>
  ): S.Annotations.Annotations;
  function annote(
    identifier: string,
    extras?: undefined | IdentityAnyAnnotationExtras<unknown> | OntologyClassAnnotationDraft
  ): S.Annotations.Annotations {
    if (extras !== undefined && isOntologyClassAnnotationDraft(extras)) {
      return identity.annote(identifier, draftAnnotationExtras(extras.description, extras.comment, extras));
    }

    return identity.annote(identifier, extras);
  }

  function annoteKey(
    identifier: string,
    draft: OntologyPredicateAnnotationDraft
  ): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"];
  function annoteKey(
    identifier: string,
    extras?: undefined | KeyAnnotationExtras<unknown>
  ): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"];
  function annoteKey(
    identifier: string,
    extras?: undefined | KeyAnnotationExtras<unknown> | OntologyPredicateAnnotationDraft
  ): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"] {
    if (extras !== undefined && isOntologyPredicateAnnotationDraft(extras)) {
      return identity.annoteKey(identifier, draftAnnotationExtras(extras.description, extras.comment, extras));
    }

    return identity.annoteKey(identifier, extras);
  }

  const tag = (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) => identity(strings, ...values);

  return Object.defineProperties(tag, {
    value: {
      value: identity.value,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    identifier: {
      value: identity.identifier,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    compose: {
      value: identity.compose,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    create: {
      value: identity.create,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    make: {
      value: identity.make,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    string: {
      value: identity.string,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    symbol: {
      value: identity.symbol,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annote: {
      value: annote,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteSchema: {
      value: identity.annoteSchema,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteKey: {
      value: annoteKey,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteHttp: {
      value: identity.annoteHttp,
      enumerable: true,
      writable: true,
      configurable: true,
    },
  }) as typeof identity & {
    readonly annote: typeof annote;
    readonly annoteKey: typeof annoteKey;
  };
};
