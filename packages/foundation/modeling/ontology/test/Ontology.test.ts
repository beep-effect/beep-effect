import { $OntologyId } from "@beep/identity/packages";
import {
  getOntologyKeyMetadata,
  getOntologyMetadata,
  isOntologyClassAnnotationDraft,
  isOntologyPredicateAnnotationDraft,
  Ontology,
  OntologyAssemblyError,
  parseJsonLdOntology,
  projectJsonLdContext,
  projectJsonLdOntology,
  projectMarkdown,
  projectTurtle,
  VERSION,
} from "@beep/ontology";
import { makeNamedNode } from "@beep/rdf/Rdf";
import { XSD_ANY_URI, XSD_BOOLEAN, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const { Ont, $I } = Ontology.create({
  identity: $OntologyId.create("ontology-package-test"),
  baseIri: "https://example.org/test#",
  preferredPrefix: "test",
  label: "Ontology Package Test",
});

const CommentedOntologyScope = Ontology.create({
  identity: $OntologyId.create("ontology-package-commented-test"),
  baseIri: makeNamedNode("https://example.org/commented#"),
  preferredPrefix: "commented",
  label: "Commented Ontology Package Test",
  comment: "Scope-level ontology comment.",
});

class Parent extends S.Class<Parent>($I`Parent`)(
  {
    label: S.NonEmptyString.pipe(
      $I.annoteKey(
        "Parent.label",
        Ont.dataPredicate({
          description: "Parent label.",
          range: XSD_STRING,
        })
      )
    ),
  },
  $I.annote(
    "Parent",
    Ont.class({
      description: "Parent ontology class.",
    })
  )
) {}

class Child extends S.Class<Child>($I`Child`)(
  {
    label: S.NonEmptyString.pipe(
      $I.annoteKey(
        "Child.label",
        Ont.dataPredicate({
          description: "Child label.",
          range: XSD_STRING,
        })
      )
    ),
    parent: Parent.pipe(
      $I.annoteKey(
        "Child.parent",
        Ont.objectPredicate({
          description: "Parent relationship.",
          range: Parent,
        })
      )
    ),
  },
  $I.annote(
    "Child",
    Ont.class({
      description: "Child ontology class.",
      parents: [Parent],
      sameAs: [Ont.sameAs("https://schema.org/Thing")],
    })
  )
) {}

class RichClass extends S.Class<RichClass>($I`RichClass`)(
  {
    title: S.NonEmptyString.pipe(
      $I.annoteKey(
        "RichClass.title",
        Ont.dataPredicate({
          comment: "Title predicate comment.",
          description: "Rich class title.",
          iri: Ont.iri("https://example.org/custom#", "title"),
          label: "Title",
          range: XSD_STRING,
          termName: "title",
        })
      )
    ),
    homepage: S.NonEmptyString.pipe(
      $I.annoteKey(
        "RichClass.homepage",
        Ont.dataPredicate({
          description: "Homepage predicate.",
          range: XSD_ANY_URI,
        })
      )
    ),
    enabled: S.Boolean.pipe(
      $I.annoteKey(
        "RichClass.enabled",
        Ont.dataPredicate({
          description: "Enabled predicate.",
          range: XSD_BOOLEAN,
        })
      )
    ),
    parent: Parent.pipe(
      $I.annoteKey(
        "RichClass.parent",
        Ont.objectPredicate({
          comment: "Parent predicate comment.",
          description: "Parent object predicate.",
          iri: Ont.iri("https://example.org/custom#", "parent"),
          label: "Parent",
          range: Parent,
          termName: "parent",
        })
      )
    ),
  },
  $I.annote(
    "RichClass",
    Ont.class({
      altLabels: ["Rich alternate label"],
      children: [Ont.child(Child)],
      closeMatches: [Ont.closeMatch("https://schema.org/Thing")],
      comment: "Rich class comment.",
      definition: "Rich class definition.",
      deprecated: false,
      description: "Rich class description.",
      equivalentClasses: [Ont.equivalentClass(Parent)],
      exactMatches: [Ont.exact("https://schema.org/CreativeWork")],
      iri: Ont.iri("https://example.org/custom#", "RichClass"),
      isDefinedBy: [Ont.ref(makeNamedNode("https://example.org/defined-by"))],
      label: "Rich Class",
      parents: [Ont.parent("Parent")],
      sameAs: [Ont.sameAs("https://schema.org/Thing")],
      seeAlso: [Ont.ref("https://example.org/see-also")],
      source: Ont.iri("https://example.org/source"),
      termName: Ont.termName("RichClass"),
    })
  )
) {}

class MultilineComment extends S.Class<MultilineComment>($I`MultilineComment`)(
  {},
  $I.annote(
    "MultilineComment",
    Ont.class({
      description: "Line one\nLine two\tTabbed\rCarriage",
    })
  )
) {}

class DeprecatedClass extends S.Class<DeprecatedClass>($I`DeprecatedClass`)(
  {},
  $I.annote(
    "DeprecatedClass",
    Ont.class({
      deprecated: true,
      description: "Deprecated ontology class.",
    })
  )
) {}

class PracticeScheme extends S.Class<PracticeScheme>($I`PracticeScheme`)(
  {},
  $I.annote(
    "PracticeScheme",
    Ont.class({
      description: "Practice-area concept scheme.",
      label: "Practice Scheme",
      skosProfile: Ont.skosConceptScheme({
        definitions: [{ value: "Practice-area concept scheme.", language: "en" }],
        hasTopConcepts: [Ont.ref("PatentConcept")],
        prefLabels: [{ value: "Practice Scheme", language: "en" }],
      }),
    })
  )
) {}

class PatentConcept extends S.Class<PatentConcept>($I`PatentConcept`)(
  {},
  $I.annote(
    "PatentConcept",
    Ont.class({
      altLabels: ["Patent alternate"],
      definition: "Patent concept compatibility definition.",
      description: "Patent taxonomy concept.",
      label: "Patent Concept",
      provenance: Ont.provenance({
        extractionMethod: "curated",
        sourceIri: "https://example.org/source#patent",
        sourceLabel: "Example source",
        sourceSpan: "p. 12",
        verificationStatus: "human-reviewed",
      }),
      skosProfile: Ont.skosConcept({
        altLabels: [{ value: "Patents", language: "en" }],
        broadMatches: [Ont.ref("https://example.org/external#IntellectualProperty")],
        closeMatches: [Ont.closeMatch("https://schema.org/CreativeWork")],
        definitions: [{ value: "A patent-related taxonomy concept.", language: "en" }],
        hiddenLabels: [{ value: "pat.", language: "en" }],
        inSchemes: [PracticeScheme],
        prefLabels: [{ value: "Patent", language: "en" }],
        related: [Ont.ref("https://example.org/external#Inventor")],
        relatedMatches: [Ont.ref("https://example.org/external#PatentDocument")],
        scopeNotes: [{ value: "Used for browsing patent concepts.", language: "en" }],
        topConceptOf: [PracticeScheme],
      }),
    })
  )
) {}

class WarningConcept extends S.Class<WarningConcept>($I`WarningConcept`)(
  {},
  $I.annote(
    "WarningConcept",
    Ont.class({
      description: "Concept with curation warnings.",
      skosProfile: Ont.skosConcept({
        broader: [Parent],
        prefLabels: [{ value: "Warning", language: "en" }],
        related: [Parent],
      }),
    })
  )
) {}

class DuplicatePrefLabelConcept extends S.Class<DuplicatePrefLabelConcept>($I`DuplicatePrefLabelConcept`)(
  {},
  $I.annote(
    "DuplicatePrefLabelConcept",
    Ont.class({
      description: "Concept with duplicate preferred labels.",
      skosProfile: Ont.skosConcept({
        inSchemes: [PracticeScheme],
        prefLabels: [
          { value: "Duplicate One", language: "en" },
          { value: "Duplicate Two", language: "en" },
        ],
      }),
    })
  )
) {}

class ConflictingLabelConcept extends S.Class<ConflictingLabelConcept>($I`ConflictingLabelConcept`)(
  {},
  $I.annote(
    "ConflictingLabelConcept",
    Ont.class({
      description: "Concept with conflicting labels.",
      skosProfile: Ont.skosConcept({
        altLabels: [{ value: "Conflict", language: "en" }],
        inSchemes: [PracticeScheme],
        prefLabels: [{ value: "Conflict", language: "en" }],
      }),
    })
  )
) {}

const MissingIdentityClass = S.String.annotate({
  ontologyMetadata: Ont.class({
    description: "Class metadata without identity annotations.",
  }),
});

const MissingSchemaIdentityClass = S.String.annotate({
  identifier: "MissingSchemaIdentityClass",
  ontologyMetadata: Ont.class({
    description: "Class metadata without schema identity.",
  }),
});

class MissingClassMetadata extends S.Class<MissingClassMetadata>($I`MissingClassMetadata`)(
  {
    value: S.String,
  },
  $I.annote("MissingClassMetadata", {
    description: "Identity annotations without ontology class metadata.",
  })
) {}

const InvalidClassMetadata = S.String.annotate(
  $I.annote("InvalidClassMetadata", {
    ontologyMetadata: Ont.dataPredicate({
      range: XSD_STRING,
    }),
  })
);

const ScalarClass = S.String.annotate(
  $I.annote(
    "ScalarClass",
    Ont.class({
      description: "Scalar metadata cannot assemble as an object class.",
    })
  )
);

const StructBackedClass = S.Struct({
  value: S.String.pipe(
    $I.annoteKey(
      "StructBackedClass.value",
      Ont.dataPredicate({
        description: "Struct-backed value predicate.",
        range: XSD_STRING,
      })
    )
  ),
}).annotate(
  $I.annote(
    "StructBackedClass",
    Ont.class({
      description: "Struct-backed class metadata.",
    })
  )
);

const SymbolFieldName = Symbol.for("ontology-package-test.symbol-field");

const SymbolFieldNameClass = S.Struct({
  [SymbolFieldName]: S.String.pipe(
    $I.annoteKey(
      "SymbolFieldNameClass.value",
      Ont.dataPredicate({
        description: "Symbol-backed value predicate.",
        range: XSD_STRING,
      })
    )
  ),
}).annotate(
  $I.annote(
    "SymbolFieldNameClass",
    Ont.class({
      description: "Class with an unsupported symbol field name.",
    })
  )
);

class MissingPredicateMetadata extends S.Class<MissingPredicateMetadata>($I`MissingPredicateMetadata`)(
  {
    value: S.String,
  },
  $I.annote(
    "MissingPredicateMetadata",
    Ont.class({
      description: "Class with an unannotated field.",
    })
  )
) {}

class MissingPredicateSchemaIdentity extends S.Class<MissingPredicateSchemaIdentity>(
  $I`MissingPredicateSchemaIdentity`
)(
  {
    value: S.String.annotateKey({
      ontologyMetadata: Ont.dataPredicate({
        description: "Predicate metadata without key identity.",
        range: XSD_STRING,
      }),
    }),
  },
  $I.annote(
    "MissingPredicateSchemaIdentity",
    Ont.class({
      description: "Class with predicate metadata missing key identity.",
    })
  )
) {}

class MissingPredicateIdentifier extends S.Class<MissingPredicateIdentifier>($I`MissingPredicateIdentifier`)(
  {
    value: S.String.annotateKey({
      ontologyMetadata: Ont.dataPredicate({
        description: "Predicate metadata without key identifier.",
        range: XSD_STRING,
      }),
      schemaId: Symbol.for("MissingPredicateIdentifier.value"),
    }),
  },
  $I.annote(
    "MissingPredicateIdentifier",
    Ont.class({
      description: "Class with predicate metadata missing key identifier.",
    })
  )
) {}

class InvalidPredicateMetadata extends S.Class<InvalidPredicateMetadata>($I`InvalidPredicateMetadata`)(
  {
    value: S.String.pipe(
      $I.annoteKey("InvalidPredicateMetadata.value", {
        ontologyMetadata: Ont.class({
          description: "Class draft stored where predicate metadata belongs.",
        }),
      })
    ),
  },
  $I.annote(
    "InvalidPredicateMetadata",
    Ont.class({
      description: "Class with invalid field metadata.",
    })
  )
) {}

class ExternalTarget extends S.Class<ExternalTarget>($I`ExternalTarget`)(
  {},
  $I.annote(
    "ExternalTarget",
    Ont.class({
      description: "External class intentionally omitted from an ontology build.",
    })
  )
) {}

class MissingTargetReference extends S.Class<MissingTargetReference>($I`MissingTargetReference`)(
  {
    external: ExternalTarget.pipe(
      $I.annoteKey(
        "MissingTargetReference.external",
        Ont.objectPredicate({
          description: "Relationship to an omitted target class.",
          range: ExternalTarget,
        })
      )
    ),
  },
  $I.annote(
    "MissingTargetReference",
    Ont.class({
      description: "Class with an omitted target relationship.",
    })
  )
) {}

class MissingTargetIdentityReference extends S.Class<MissingTargetIdentityReference>(
  $I`MissingTargetIdentityReference`
)(
  {
    external: S.String.pipe(
      $I.annoteKey(
        "MissingTargetIdentityReference.external",
        Ont.objectPredicate({
          description: "Relationship to a target schema without identity metadata.",
          range: S.String,
        })
      )
    ),
  },
  $I.annote(
    "MissingTargetIdentityReference",
    Ont.class({
      description: "Class with a relationship target missing identity metadata.",
    })
  )
) {}

const isOntologyAssemblyError = S.is(OntologyAssemblyError);

const expectAssemblyFailure = (effect: Effect.Effect<unknown, OntologyAssemblyError>, reason: string): void => {
  const exit = Effect.runSync(Effect.exit(effect));

  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.findErrorOption(exit.cause);
    expect(O.isSome(error)).toBe(true);
    if (O.isSome(error)) {
      expect(isOntologyAssemblyError(error.value)).toBe(true);
      if (isOntologyAssemblyError(error.value)) {
        expect(error.value.reason).toBe(reason);
      }
    }
  }
};

describe("@beep/ontology", () => {
  it("exports the package version and creates commented ontology scopes", () => {
    expect(VERSION).toBe("0.0.0");
    expect(CommentedOntologyScope.metadata.comment).toEqual(O.some("Scope-level ontology comment."));
    expect(CommentedOntologyScope.Ont.iri(makeNamedNode("https://example.org/commented#Term"))).toBe(
      "https://example.org/commented#Term"
    );
    expect(CommentedOntologyScope.Ont.iri("https://example.org/commented#", "Term")).toBe(
      "https://example.org/commented#Term"
    );
    expect(CommentedOntologyScope.Ont.iri("https://example.org/commented/base", "Term")).toBe(
      "https://example.org/commented/base#Term"
    );
    expect(() => Ont.iri("not an iri")).toThrow("Expected a valid RFC 3987 IRI");
  });

  it("normalizes public reference aliases", () => {
    const ontology = Effect.runSync(Ont.build([Parent, Child]));
    const child = pipe(
      ontology.classes,
      A.findFirst((ontologyClass) => ontologyClass.termName === "Child"),
      O.getOrThrow
    );
    const parentReference = pipe(child.parents, A.head, O.getOrThrow);

    expect(Ont.ref(parentReference).kind).toBe("iri");
    expect(Ont.ref(makeNamedNode("https://example.org/reference")).kind).toBe("iri");
    expect(Ont.parent("Parent").kind).toBe("term");
    expect(Ont.child(Child).kind).toBe("schema");
    expect(Ont.equivalentClass(Parent).kind).toBe("schema");
    expect(Ont.exactMatch("https://schema.org/Thing").kind).toBe("iri");
    expect(Ont.exact("https://schema.org/Thing").kind).toBe("iri");
    expect(Ont.closeMatch("https://schema.org/Thing").kind).toBe("iri");
    expect(Ont.sameAs("https://schema.org/Thing").kind).toBe("iri");
  });

  it("stores class and key ontology annotations on Effect schemas", () => {
    const classMetadata = getOntologyMetadata(Parent);
    const keyMetadata = getOntologyKeyMetadata(Child.fields.parent);

    expect(classMetadata?.kind).toBe("classDraft");
    expect(isOntologyClassAnnotationDraft(classMetadata)).toBe(true);
    expect(keyMetadata?.kind).toBe("objectPredicateDraft");
    expect(isOntologyPredicateAnnotationDraft(keyMetadata)).toBe(true);
  });

  it("assembles schema references into ontology metadata", () => {
    const ontology = Effect.runSync(Ont.build([Parent, Child]));
    const child = pipe(
      ontology.classes,
      A.findFirst((ontologyClass) => ontologyClass.termName === "Child"),
      O.getOrThrow
    );
    const parentPredicate = pipe(
      child.predicates,
      A.findFirst((predicate) => predicate.fieldName === "parent"),
      O.getOrThrow
    );

    expect(child.parents[0]?.iri).toBe("https://example.org/test#Parent");
    expect(child.sameAs[0]?.iri).toBe("https://schema.org/Thing");
    expect(parentPredicate.kind).toBe("objectPredicate");
    if (parentPredicate.kind === "objectPredicate") {
      expect(parentPredicate.rangeClassIri).toBe("https://example.org/test#Parent");
    }
  });

  it("assembles plain struct schemas with ontology annotations", () => {
    const ontology = Effect.runSync(Ont.build([StructBackedClass]));
    const ontologyClass = pipe(ontology.classes, A.head, O.getOrThrow);

    expect(ontologyClass.termName).toBe("StructBackedClass");
    expect(ontologyClass.predicates[0]?.fieldName).toBe("value");
  });

  it("assembles opt-in SKOS profiles with provenance and JSON Schema sidecars", () => {
    const ontology = Effect.runSync(Ont.build([PracticeScheme, PatentConcept]));
    const concept = pipe(
      ontology.classes,
      A.findFirst((ontologyClass) => ontologyClass.termName === "PatentConcept"),
      O.getOrThrow
    );
    const scheme = pipe(
      ontology.classes,
      A.findFirst((ontologyClass) => ontologyClass.termName === "PracticeScheme"),
      O.getOrThrow
    );

    expect(A.length(ontology.validation.errors)).toBe(0);
    expect(A.length(ontology.validation.warnings)).toBe(0);
    expect(O.isSome(concept.skosProfile)).toBe(true);
    if (O.isSome(concept.skosProfile)) {
      expect(concept.skosProfile.value.kind).toBe("concept");
      if (concept.skosProfile.value.kind === "concept") {
        expect(concept.skosProfile.value.prefLabels[0]?.value).toBe("Patent");
        expect(concept.skosProfile.value.prefLabels[0]?.language).toEqual(O.some("en"));
        expect(concept.skosProfile.value.inSchemes[0]?.iri).toBe("https://example.org/test#PracticeScheme");
      }
    }
    expect(O.isSome(scheme.skosProfile)).toBe(true);
    if (O.isSome(scheme.skosProfile)) {
      expect(scheme.skosProfile.value.kind).toBe("conceptScheme");
    }
    expect(concept.provenance).toEqual(
      O.some(
        expect.objectContaining({
          extractionMethod: O.some("curated"),
          sourceIri: O.some("https://example.org/source#patent"),
          verificationStatus: O.some("human-reviewed"),
        })
      )
    );
    expect(O.isSome(concept.jsonSchemaSidecar)).toBe(true);
    if (O.isSome(concept.jsonSchemaSidecar)) {
      expect(concept.jsonSchemaSidecar.value.document.dialect).toBe("draft-2020-12");
      expect(concept.jsonSchemaSidecar.value.options.additionalProperties).toBe(false);
      expect(concept.jsonSchemaSidecar.value.options.generateDescriptions).toBe(true);
    }
  });

  it("projects JSON-LD and Turtle", () => {
    const ontology = Effect.runSync(Ont.build([Parent, Child, RichClass]));
    const context = projectJsonLdContext(ontology);
    const jsonLd = projectJsonLdOntology(ontology);
    const turtle = projectTurtle(ontology);

    expect(context["@context"].Child).toEqual({
      "@id": "https://example.org/test#Child",
    });
    expect(context["@context"].title).toEqual({
      "@id": "https://example.org/custom#title",
      "@type": XSD_STRING.value,
    });
    expect(jsonLd.comment).toBeUndefined();
    expect(
      CommentedOntologyScope.Ont.toJsonLD(Effect.runSync(CommentedOntologyScope.Ont.build([Parent]))).comment
    ).toBe("Scope-level ontology comment.");
    expect(jsonLd["@context"].children).toEqual({
      "@reverse": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
      "@type": "@id",
    });
    expect(turtle).toContain("<https://example.org/test#Child> a rdfs:Class");
    expect(turtle).toContain("<https://example.org/test#parent> a owl:ObjectProperty");
    expect(turtle).toContain('skos:altLabel "Rich alternate label"');
    expect(turtle).toContain("dcterms:source <https://example.org/source>");
    expect(turtle).toContain(
      "<https://example.org/test#Child> rdfs:subClassOf <https://example.org/custom#RichClass> ."
    );
    expect(turtle).toContain("<https://example.org/test#homepage> a owl:DatatypeProperty");
  });

  it("projects SKOS profiles to JSON-LD, Turtle, and Markdown link modes", () => {
    const ontology = Effect.runSync(Ont.build([PracticeScheme, PatentConcept]));
    const jsonLd = projectJsonLdOntology(ontology);
    const turtle = projectTurtle(ontology);
    const markdown = projectMarkdown(ontology);
    const obsidianMarkdown = Ont.toMarkdown(ontology, { linkMode: "obsidian" });
    const conceptNode = pipe(
      jsonLd["@graph"],
      A.findFirst((node) => node["@id"] === "https://example.org/test#PatentConcept"),
      O.getOrThrow
    );

    expect(conceptNode["@type"]).toEqual(["rdfs:Class", "skos:Concept"]);
    expect(conceptNode["skos:prefLabel"]).toEqual([{ "@value": "Patent", "@language": "en" }]);
    expect(conceptNode["skos:hiddenLabel"]).toEqual([{ "@value": "pat.", "@language": "en" }]);
    expect(conceptNode["skos:inScheme"]).toEqual([{ "@id": "https://example.org/test#PracticeScheme" }]);
    expect(turtle).toContain("<https://example.org/test#PatentConcept> a rdfs:Class, skos:Concept");
    expect(turtle).toContain('skos:prefLabel "Patent"@en');
    expect(turtle).toContain("skos:inScheme <https://example.org/test#PracticeScheme>");
    expect(markdown).toContain(
      "[https://example\\.org/test\\#PracticeScheme](<https://example.org/test#PracticeScheme>)"
    );
    expect(markdown).toContain("JSON Schema sidecar");
    expect(markdown).toContain("Source IRI");
    expect(obsidianMarkdown).toContain(
      "[[https-example-org-test-practicescheme|https://example.org/test#PracticeScheme]]"
    );
  });

  it("escapes Turtle string literal control characters", () => {
    const ontology = Effect.runSync(Ont.build([MultilineComment]));
    const turtle = projectTurtle(ontology);

    expect(turtle).toContain('rdfs:comment "Line one\\nLine two\\tTabbed\\rCarriage"');
  });

  it("emits canonical Turtle boolean literals", () => {
    const ontology = Effect.runSync(Ont.build([DeprecatedClass]));
    const turtle = projectTurtle(ontology);

    expect(turtle).toContain("owl:deprecated true");
    expect(turtle).not.toContain('"true"^^xsd:boolean');
  });

  it("round-trips projected JSON-LD", () => {
    const ontology = Effect.runSync(Ont.build([Parent, Child, RichClass]));
    const roundTrip = Ont.fromJsonLD(Ont.toJsonLD(ontology));

    expect(Result.isSuccess(roundTrip)).toBe(true);
    if (Result.isSuccess(roundTrip)) {
      expect(A.length(roundTrip.success.classes)).toBe(A.length(ontology.classes));
      expect(roundTrip.success.metadata.baseIri).toBe("https://example.org/test#");
      expect(roundTrip.success.classes[0]?.predicates.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("round-trips SKOS profile fields through bounded JSON-LD import", () => {
    const ontology = Effect.runSync(Ont.build([PracticeScheme, PatentConcept]));
    const roundTrip = Ont.fromJsonLD(Ont.toJsonLD(ontology));

    expect(Result.isSuccess(roundTrip)).toBe(true);
    if (Result.isSuccess(roundTrip)) {
      const concept = pipe(
        roundTrip.success.classes,
        A.findFirst((ontologyClass) => ontologyClass.termName === "PatentConcept"),
        O.getOrThrow
      );

      expect(O.isSome(concept.skosProfile)).toBe(true);
      if (O.isSome(concept.skosProfile) && concept.skosProfile.value.kind === "concept") {
        expect(concept.skosProfile.value.prefLabels[0]?.value).toBe("Patent");
        expect(concept.skosProfile.value.hiddenLabels[0]?.value).toBe("pat.");
        expect(concept.skosProfile.value.inSchemes[0]?.iri).toBe("https://example.org/test#PracticeScheme");
      }
      expect(concept.jsonSchemaSidecar).toEqual(O.none());
    }
  });

  it("returns a typed JSON-LD parse failure for documents with no class nodes", () => {
    const ontology = Effect.runSync(Ont.build([Parent, Child]));
    const result = Ont.fromJsonLD({ ...Ont.toJsonLD(ontology), "@graph": [] });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      const failure = result.failure;
      expect(isOntologyAssemblyError(failure)).toBe(true);
      if (!isOntologyAssemblyError(failure)) {
        throw failure;
      }

      expect(failure.reason).toBe("missingClassMetadata");
    }
  });

  it("returns schema errors for malformed JSON-LD ontology documents", () => {
    const result = parseJsonLdOntology({});

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(isOntologyAssemblyError(result.failure)).toBe(false);
    }
  });

  it("returns typed assembly failures for invalid class metadata", () => {
    expectAssemblyFailure(Ont.build([MissingClassMetadata]), "missingClassMetadata");
    expectAssemblyFailure(Ont.build([MissingIdentityClass]), "invalidClassMetadata");
    expectAssemblyFailure(Ont.build([MissingSchemaIdentityClass]), "invalidClassMetadata");
    expectAssemblyFailure(Ont.build([InvalidClassMetadata]), "invalidClassMetadata");
    expectAssemblyFailure(Ont.build([ScalarClass]), "unsupportedClassAst");
  });

  it("returns typed assembly failures for invalid predicate metadata", () => {
    expectAssemblyFailure(Ont.build([MissingPredicateMetadata]), "missingPredicateMetadata");
    expectAssemblyFailure(Ont.build([SymbolFieldNameClass]), "unsupportedFieldName");
    expectAssemblyFailure(Ont.build([MissingPredicateSchemaIdentity]), "invalidPredicateMetadata");
    expectAssemblyFailure(Ont.build([MissingPredicateIdentifier]), "invalidPredicateMetadata");
    expectAssemblyFailure(Ont.build([InvalidPredicateMetadata]), "invalidPredicateMetadata");
  });

  it("returns typed assembly failures for unresolved relationship targets", () => {
    expectAssemblyFailure(Ont.build([MissingTargetReference]), "unresolvedReferenceTarget");
    expectAssemblyFailure(Ont.build([MissingTargetIdentityReference]), "unresolvedReferenceTarget");
  });

  it("separates SKOS hard validation failures from warnings", () => {
    const warningOntology = Effect.runSync(Ont.build([Parent, WarningConcept]));
    const warningCodes = pipe(
      warningOntology.validation.warnings,
      A.map((issue) => issue.code)
    );

    expect(warningCodes).toContain("missingConceptScheme");
    expect(warningCodes).toContain("relatedDuplicatesHierarchy");
    expectAssemblyFailure(Ont.build([PracticeScheme, DuplicatePrefLabelConcept]), "invalidSkosProfile");
    expectAssemblyFailure(Ont.build([PracticeScheme, ConflictingLabelConcept]), "invalidSkosProfile");
  });
});
