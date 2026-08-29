import { $OntologyId } from "@beep/identity/packages";
import { Ontology, projectMarkdown } from "@beep/ontology";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import * as S from "effect/Schema";

const { Ont, $I } = Ontology.create({
  identity: $OntologyId.create("ontology-dtslint"),
  baseIri: "https://example.org/ontology#",
  preferredPrefix: "ex",
  label: "Example",
});

Ont.dataPredicate({
  range: XSD_STRING,
});

class ExampleConcept extends S.Class<ExampleConcept>($I`ExampleConcept`)(
  {},
  $I.annote(
    "ExampleConcept",
    Ont.class({
      skosProfile: Ont.skosConcept({
        prefLabels: [{ value: "Example", language: "en" }],
      }),
    })
  )
) {}

declare const assembled: Parameters<typeof projectMarkdown>[0];

projectMarkdown(assembled, { linkMode: "obsidian" });
ExampleConcept;
