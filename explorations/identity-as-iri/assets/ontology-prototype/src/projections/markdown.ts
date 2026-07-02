import { $OntologyId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Effect, flow, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  skosConceptReferences as conceptReferences,
  skosProfileLiterals as profileLiterals,
  skosSchemeReferences as schemeReferences,
} from "./skos.js";
import type {
  AssembledOntology,
  AssembledOntologyClass,
  AssembledOntologyPredicate,
  IRI,
  OntologyLanguageLiteral,
  OntologyReference,
} from "../model.js";

const $I = $OntologyId.create("projections/markdown");

export const OntologyMarkdownLinkMode = LiteralKit(["portable", "obsidian"]).pipe(
  $I.annoteSchema("OntologyMarkdownLinkMode", {
    description: "Link rendering mode for ontology Markdown projection.",
  })
);
export type OntologyMarkdownLinkMode = typeof OntologyMarkdownLinkMode.Type;

export class OntologyMarkdownProjectionOptions extends S.Class<OntologyMarkdownProjectionOptions>(
  $I`OntologyMarkdownProjectionOptions`
)(
  {
    linkMode: OntologyMarkdownLinkMode.pipe(
      S.withConstructorDefault(Effect.succeed(OntologyMarkdownLinkMode.Enum.portable))
    ),
  },
  $I.annote("OntologyMarkdownProjectionOptions", {
    description: "Options for ontology Markdown projection.",
  })
) {}

type MarkdownOptionsInput = Parameters<typeof OntologyMarkdownProjectionOptions.make>[0];

type NormalizedMarkdownOptions = {
  readonly linkMode: OntologyMarkdownLinkMode;
};

const normalizeOptions = (options: MarkdownOptionsInput = {}): NormalizedMarkdownOptions =>
  OntologyMarkdownProjectionOptions.make(options);

const markdownText: (value: string) => string = Str.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");

const obsidianAlias: (value: string) => string = flow(Str.replaceAll("|", "\\|"), Str.replaceAll("]", "\\]"));

const iriSlug = (iri: IRI): string => {
  const slug = pipe(iri, Str.replace(/[^A-Za-z0-9]+/g, "-"), Str.replace(/^-+|-+$/g, ""), Str.toLowerCase);

  return Str.isEmpty(slug) ? "iri" : slug;
};

const markdownLink = (label: string, iri: IRI, options: NormalizedMarkdownOptions): string =>
  options.linkMode === "obsidian"
    ? `[[${iriSlug(iri)}|${obsidianAlias(label)}]]`
    : `[${markdownText(label)}](<${iri}>)`;

const referenceLink = (reference: OntologyReference, options: NormalizedMarkdownOptions): string =>
  markdownLink(reference.iri, reference.iri, options);

const section = (title: string, lines: ReadonlyArray<string>): string =>
  pipe(
    lines,
    A.filter(Str.isNonEmpty),
    A.match({
      onEmpty: () => "",
      onNonEmpty: (body) => `### ${markdownText(title)}\n\n${pipe(body, A.join("\n"))}`,
    })
  );

const bullet = (label: string, value: string): string => `- ${markdownText(label)}: ${value}`;

const optionBullet = (label: string, value: O.Option<string>): ReadonlyArray<string> =>
  pipe(
    value,
    O.map((current) => [bullet(label, markdownText(current))]),
    O.getOrElse(A.empty<string>)
  );

const languageLiteral = (literal: OntologyLanguageLiteral): string =>
  pipe(
    literal.language,
    O.map((language) => `${markdownText(literal.value)} \`${language}\``),
    O.getOrElse(() => markdownText(literal.value))
  );

const languageLiteralList: (values: ReadonlyArray<OntologyLanguageLiteral>) => string = flow(
  A.map(languageLiteral),
  A.join(", ")
);

const stringList: (values: ReadonlyArray<string>) => string = flow(A.map(markdownText), A.join(", "));

const referenceList = (values: ReadonlyArray<OntologyReference>, options: NormalizedMarkdownOptions): string =>
  pipe(
    values,
    A.map((reference) => referenceLink(reference, options)),
    A.join(", ")
  );

const optionalArrayBullet = (label: string, value: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.length(value) === 0 ? A.empty<string>() : [bullet(label, stringList(value))];

const optionalLanguageLiteralBullet = (
  label: string,
  value: ReadonlyArray<OntologyLanguageLiteral>
): ReadonlyArray<string> => (A.length(value) === 0 ? A.empty<string>() : [bullet(label, languageLiteralList(value))]);

const optionalReferenceBullet = (
  label: string,
  value: ReadonlyArray<OntologyReference>,
  options: NormalizedMarkdownOptions
): ReadonlyArray<string> =>
  A.length(value) === 0 ? A.empty<string>() : [bullet(label, referenceList(value, options))];

const classTypes = (ontologyClass: AssembledOntologyClass): string =>
  pipe(
    ontologyClass.skosProfile,
    O.match({
      onNone: () => "`rdfs:Class`",
      onSome: (profile) =>
        profile.kind === "concept" ? "`rdfs:Class`, `skos:Concept`" : "`rdfs:Class`, `skos:ConceptScheme`",
    })
  );

const renderPredicate = (predicate: AssembledOntologyPredicate, options: NormalizedMarkdownOptions): string =>
  predicate.kind === "datatypePredicate"
    ? `- \`${predicate.fieldName}\`: ${markdownLink(predicate.label, predicate.iri, options)} -> \`${predicate.rangeDatatypeIri}\``
    : `- \`${predicate.fieldName}\`: ${markdownLink(predicate.label, predicate.iri, options)} -> ${markdownLink(
        predicate.rangeClassIri,
        predicate.rangeClassIri,
        options
      )}`;

const renderSidecar = (ontologyClass: AssembledOntologyClass): ReadonlyArray<string> =>
  pipe(
    ontologyClass.jsonSchemaSidecar,
    O.map((sidecar) => [
      bullet("JSON Schema sidecar", `\`${sidecar.document.dialect}\` for \`${sidecar.schemaIdentity}\``),
    ]),
    O.getOrElse(A.empty<string>)
  );

const renderProvenance = (ontologyClass: AssembledOntologyClass): ReadonlyArray<string> =>
  pipe(
    ontologyClass.provenance,
    O.map((provenance) => [
      ...pipe(
        provenance.sourceIri,
        O.map((sourceIri) => [bullet("Source IRI", `<${sourceIri}>`)]),
        O.getOrElse(A.empty<string>)
      ),
      ...pipe(
        provenance.sourceUri,
        O.map((sourceUri) => [bullet("Source URI", `<${sourceUri}>`)]),
        O.getOrElse(A.empty<string>)
      ),
      ...optionBullet("Source label", provenance.sourceLabel),
      ...optionBullet("Source citation", provenance.sourceCitation),
      ...optionBullet("Source span", provenance.sourceSpan),
      ...optionBullet("Source selector", provenance.sourceSelector),
      ...optionBullet("Extraction method", provenance.extractionMethod),
      ...optionBullet("Verification status", provenance.verificationStatus),
      ...optionBullet("Updated at", provenance.updatedAt),
    ]),
    O.getOrElse(A.empty<string>)
  );

const renderClass = (ontologyClass: AssembledOntologyClass, options: NormalizedMarkdownOptions): string =>
  pipe(
    [
      section("Identity", [
        bullet("IRI", `<${ontologyClass.iri}>`),
        bullet("Term", `\`${ontologyClass.termName}\``),
        bullet("Schema identity", `\`${ontologyClass.schemaIdentity}\``),
        bullet("Types", classTypes(ontologyClass)),
        ...renderSidecar(ontologyClass),
      ]),
      section("Labels", [
        bullet("Label", markdownText(ontologyClass.label)),
        ...optionalArrayBullet("Alternative labels", ontologyClass.altLabels),
        ...optionalLanguageLiteralBullet(
          "Preferred labels",
          profileLiterals(ontologyClass, (profile) => profile.prefLabels)
        ),
        ...optionalLanguageLiteralBullet(
          "SKOS alternative labels",
          profileLiterals(ontologyClass, (profile) => profile.altLabels)
        ),
        ...optionalLanguageLiteralBullet(
          "Hidden labels",
          profileLiterals(ontologyClass, (profile) => profile.hiddenLabels)
        ),
      ]),
      section("Definitions And Notes", [
        ...optionBullet("Definition", ontologyClass.definition),
        ...optionalLanguageLiteralBullet(
          "SKOS definitions",
          profileLiterals(ontologyClass, (profile) => profile.definitions)
        ),
        ...optionalLanguageLiteralBullet(
          "Scope notes",
          profileLiterals(ontologyClass, (profile) => profile.scopeNotes)
        ),
        ...optionalLanguageLiteralBullet(
          "Editorial notes",
          profileLiterals(ontologyClass, (profile) => profile.editorialNotes)
        ),
        ...optionalLanguageLiteralBullet(
          "History notes",
          profileLiterals(ontologyClass, (profile) => profile.historyNotes)
        ),
        ...optionBullet("Comment", ontologyClass.comment),
      ]),
      section("Scheme Membership", [
        ...optionalReferenceBullet(
          "In schemes",
          conceptReferences(ontologyClass, (profile) => profile.inSchemes),
          options
        ),
        ...optionalReferenceBullet(
          "Top concept of",
          conceptReferences(ontologyClass, (profile) => profile.topConceptOf),
          options
        ),
        ...optionalReferenceBullet(
          "Has top concepts",
          schemeReferences(ontologyClass, (profile) => profile.hasTopConcepts),
          options
        ),
      ]),
      section("Hierarchy", [
        ...optionalReferenceBullet("Parents", ontologyClass.parents, options),
        ...optionalReferenceBullet("Children", ontologyClass.children, options),
        ...optionalReferenceBullet(
          "Broader",
          conceptReferences(ontologyClass, (profile) => profile.broader),
          options
        ),
        ...optionalReferenceBullet(
          "Narrower",
          conceptReferences(ontologyClass, (profile) => profile.narrower),
          options
        ),
        ...optionalReferenceBullet(
          "Related",
          conceptReferences(ontologyClass, (profile) => profile.related),
          options
        ),
      ]),
      section("Mappings", [
        ...optionalReferenceBullet("Equivalent classes", ontologyClass.equivalentClasses, options),
        ...optionalReferenceBullet("Exact matches", ontologyClass.exactMatches, options),
        ...optionalReferenceBullet("Close matches", ontologyClass.closeMatches, options),
        ...optionalReferenceBullet(
          "SKOS exact matches",
          conceptReferences(ontologyClass, (profile) => profile.exactMatches),
          options
        ),
        ...optionalReferenceBullet(
          "SKOS close matches",
          conceptReferences(ontologyClass, (profile) => profile.closeMatches),
          options
        ),
        ...optionalReferenceBullet(
          "Broad matches",
          conceptReferences(ontologyClass, (profile) => profile.broadMatches),
          options
        ),
        ...optionalReferenceBullet(
          "Narrow matches",
          conceptReferences(ontologyClass, (profile) => profile.narrowMatches),
          options
        ),
        ...optionalReferenceBullet(
          "Related matches",
          conceptReferences(ontologyClass, (profile) => profile.relatedMatches),
          options
        ),
        ...optionalReferenceBullet("Same as", ontologyClass.sameAs, options),
      ]),
      section(
        "Predicates",
        pipe(
          ontologyClass.predicates,
          A.map((predicate) => renderPredicate(predicate, options))
        )
      ),
      section("Source And Provenance", [
        ...pipe(
          ontologyClass.source,
          O.map((source) => [bullet("Source", `<${source}>`)]),
          O.getOrElse(A.empty<string>)
        ),
        ...renderProvenance(ontologyClass),
      ]),
    ],
    A.filter(Str.isNonEmpty),
    A.join("\n\n")
  );

const renderValidation = (ontology: AssembledOntology): string =>
  section("Validation", [
    ...pipe(
      ontology.validation.warnings,
      A.map((warning) => `- Warning \`${warning.code}\`: ${markdownText(warning.message)}`)
    ),
    ...pipe(
      ontology.validation.errors,
      A.map((error) => `- Error \`${error.code}\`: ${markdownText(error.message)}`)
    ),
  ]);

/**
 * Projects an assembled ontology into deterministic Markdown documentation.
 *
 * @category projections
 * @since 0.0.0
 */
export const projectMarkdown = (ontology: AssembledOntology, options?: MarkdownOptionsInput): string => {
  const normalizedOptions = normalizeOptions(options);
  const ontologyHeader = [
    `# ${markdownText(ontology.metadata.label)}`,
    "",
    bullet("IRI", `<${ontology.metadata.baseIri}>`),
    bullet("Preferred prefix", `\`${ontology.metadata.preferredPrefix}\``),
    bullet("Schema identity", `\`${ontology.metadata.schemaIdentity}\``),
    ...optionBullet("Comment", ontology.metadata.comment),
  ];

  const classSections = pipe(
    ontology.classes,
    A.map(
      (ontologyClass) => `## ${markdownText(ontologyClass.label)}\n\n${renderClass(ontologyClass, normalizedOptions)}`
    )
  );

  return pipe(
    [...ontologyHeader, "", ...classSections, renderValidation(ontology)],
    A.filter(Str.isNonEmpty),
    A.join("\n")
  );
};
