import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as S from "effect/Schema";
import { BoundedEvidenceProjection } from "../../../packages/foundation/capability/semantic-web/src/evidence.ts";
import { ProvBundle } from "../../../packages/foundation/capability/semantic-web/src/prov.ts";
import {
  Dataset,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  serializeQuad,
  sortDatasetQuads,
} from "../../../packages/foundation/capability/semantic-web/src/rdf.ts";
import { ShaclNodeShape } from "../../../packages/foundation/capability/semantic-web/src/services/shacl-validation.ts";
import { RDF_TYPE } from "../../../packages/foundation/capability/semantic-web/src/vocab/rdf.ts";
import { RDFS_COMMENT, RDFS_LABEL } from "../../../packages/foundation/capability/semantic-web/src/vocab/rdfs.ts";
import { XSD_BOOLEAN, XSD_STRING } from "../../../packages/foundation/capability/semantic-web/src/vocab/xsd.ts";

const generatedAt = new Date().toISOString();
const createdDate = "2026-04-04";
const tboxNamespace = "urn:beep-effect:doc-ontology#";
const seedNamespace = "urn:beep-effect:doc-seed:";
const probeOntologyKey = "beep-effect-doc-ontology-probe-2026-04-04";

const repoRootUrl = new URL("../../../", import.meta.url);
const specRootUrl = new URL("../", import.meta.url);
const outputsUrl = new URL("../history/outputs/", import.meta.url);
const opsUrl = new URL("../ops/", import.meta.url);

const readText = async (relativePath: string) => Bun.file(new URL(relativePath, repoRootUrl)).text();

const writeJson = async (fileName: string, value: unknown) =>
  Bun.write(new URL(fileName, outputsUrl), `${stableStringify(value)}\n`);

const writeOpsJson = async (fileName: string, value: unknown) =>
  Bun.write(new URL(fileName, opsUrl), `${stableStringify(value)}\n`);

const writeText = async (fileName: string, value: string) => Bun.write(new URL(fileName, outputsUrl), `${value}\n`);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stableValue((value as Record<string, unknown>)[key])])
    );
  }

  return value;
};

const stableStringify = (value: unknown) => JSON.stringify(stableValue(value), null, 2);

const extractLiteralKitValues = (text: string, symbolName: string): Array<string> => {
  const match = text.match(
    new RegExp(`export const ${symbolName} = LiteralKit\\(\\[(.*?)\\]\\s*(?:as const)?\\)`, "s")
  );

  if (!match) {
    throw new Error(`Unable to find LiteralKit values for ${symbolName}.`);
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
};

const extractPickedOptions = (text: string, symbolName: string): Array<string> => {
  const match = text.match(
    new RegExp(`const ${symbolName} = TSSyntaxKind\\.pickOptions\\(\\[(.*?)\\]\\s*as const\\)`, "s")
  );

  if (!match) {
    throw new Error(`Unable to find TSSyntaxKind options for ${symbolName}.`);
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
};

const extractTagNames = (text: string): Array<string> =>
  Array.from(text.matchAll(/JSDocTagDefinition\.make\("([^"]+)"/g), (entry) => entry[1]);

const extractRequiredTags = (text: string): Array<string> => {
  const match = text.match(/const [A-Z_]*REQUIRED_TAGS = \[(.*?)\] as const;/s);

  if (!match) {
    throw new Error("Unable to find REQUIRED_TAGS in docgen operations.");
  }

  return Array.from(match[1].matchAll(/"@([^"]+)"/g), (entry) => entry[1]);
};

const tbox = (localId: string) => `${tboxNamespace}${localId}`;
const seed = (localId: string) => `${seedNamespace}${localId}`;

const seedNode = (localId: string) => makeNamedNode(seed(localId));
const tboxNode = (localId: string) => makeNamedNode(tbox(localId));
const objectQuad = (subjectId: string, predicateId: string, objectIri: string) =>
  makeQuad(seedNode(subjectId), tboxNode(predicateId), makeNamedNode(objectIri));
const datatypeQuad = (subjectId: string, predicateId: string, value: string, datatype: string) =>
  makeQuad(seedNode(subjectId), tboxNode(predicateId), makeLiteral(value, datatype));
const labelQuad = (subjectId: string, label: string) =>
  makeQuad(seedNode(subjectId), RDFS_LABEL, makeLiteral(label, XSD_STRING.value));
const commentQuad = (subjectId: string, comment: string) =>
  makeQuad(seedNode(subjectId), RDFS_COMMENT, makeLiteral(comment, XSD_STRING.value));
const typeQuad = (subjectId: string, classId: string) => makeQuad(seedNode(subjectId), RDF_TYPE, tboxNode(classId));
const provenanceQuad = (subjectId: string, stableId: string) =>
  datatypeQuad(subjectId, "stable-provenance-id", stableId, XSD_STRING.value);
const noteQuad = (subjectId: string, note: string) =>
  datatypeQuad(subjectId, "descriptive-notes", note, XSD_STRING.value);
const booleanQuad = (subjectId: string, predicateId: string, value: boolean) =>
  datatypeQuad(subjectId, predicateId, value ? "true" : "false", XSD_BOOLEAN.value);

const formatLiteralObject = (value: string, lang?: string) =>
  lang === undefined
    ? `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
    : `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"@${lang}`;

const formatReference = (value: string) => {
  if (value.includes(":")) {
    return value;
  }

  return `doc:${value}`;
};

const formatOntologyNode = (id: string, node: Record<string, unknown>) => {
  const subject = `doc:${id}`;
  const predicates: Array<string> = [];

  if (typeof node.type === "string") {
    predicates.push(`a ${node.type}`);
  }

  const labels = Array.isArray(node["rdfs:label"]) ? node["rdfs:label"] : [];
  for (const label of labels) {
    if (label && typeof label === "object" && typeof (label as { value?: unknown }).value === "string") {
      predicates.push(
        `rdfs:label ${formatLiteralObject(
          (label as { value: string }).value,
          typeof (label as { lang?: unknown }).lang === "string" ? (label as { lang: string }).lang : undefined
        )}`
      );
    }
  }

  if (typeof node["rdfs:comment"] === "string") {
    predicates.push(`rdfs:comment ${formatLiteralObject(node["rdfs:comment"])}`);
  }

  if (typeof node["rdfs:subClassOf"] === "string") {
    predicates.push(`rdfs:subClassOf ${formatReference(node["rdfs:subClassOf"])}`);
  }

  if (typeof node["rdfs:domain"] === "string") {
    predicates.push(`rdfs:domain ${formatReference(node["rdfs:domain"])}`);
  }

  if (typeof node["rdfs:range"] === "string") {
    predicates.push(`rdfs:range ${formatReference(node["rdfs:range"])}`);
  }

  const [firstPredicate, ...restPredicates] = predicates;

  if (firstPredicate === undefined) {
    return `${subject} .`;
  }

  return [`${subject} ${firstPredicate}`, ...restPredicates.map((predicate) => `  ${predicate}`)].join(" ;\n") + " .";
};

const formatOntologyTurtle = (ontologyValue: {
  metadata: {
    title: string;
    version: string;
    "rdfs:comment": string;
    namespaces: Record<string, string>;
  };
  classes: Record<string, Record<string, unknown>>;
  objectProperties: Record<string, Record<string, unknown>>;
  datatypeProperties: Record<string, Record<string, unknown>>;
}) => {
  const prefixes = Object.entries(ontologyValue.metadata.namespaces)
    .map(([prefix, iri]) => `@prefix ${prefix}: <${iri}> .`)
    .join("\n");

  const classBlocks = Object.entries(ontologyValue.classes)
    .map(([id, node]) => formatOntologyNode(id, node))
    .join("\n\n");
  const objectPropertyBlocks = Object.entries(ontologyValue.objectProperties)
    .map(([id, node]) => formatOntologyNode(id, node))
    .join("\n\n");
  const datatypePropertyBlocks = Object.entries(ontologyValue.datatypeProperties)
    .map(([id, node]) => formatOntologyNode(id, node))
    .join("\n\n");

  return [
    prefixes,
    "",
    `doc:ontology a owl:Ontology ;`,
    `  rdfs:label ${formatLiteralObject(ontologyValue.metadata.title)} ;`,
    `  rdfs:comment ${formatLiteralObject(ontologyValue.metadata["rdfs:comment"])} ;`,
    `  owl:versionInfo ${formatLiteralObject(ontologyValue.metadata.version)} .`,
    "",
    classBlocks,
    "",
    objectPropertyBlocks,
    "",
    datatypePropertyBlocks,
  ].join("\n");
};

const ontology = {
  metadata: {
    "rdfs:comment":
      "Documentation-memory ontology for beep-effect. Native TrustGraph TBox only; companion rule instances and semantic-web seed data live in separate outputs.",
    "rdfs:label": "beep-effect documentation ontology",
    created: createdDate,
    modified: createdDate,
    namespace: tboxNamespace,
    namespaces: {
      doc: tboxNamespace,
      owl: "http://www.w3.org/2002/07/owl#",
      prov: "http://www.w3.org/ns/prov#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
    title: "beep-effect Documentation Ontology",
    version: "0.1.0",
  },
  classes: {
    "documentation-concept": {
      uri: tbox("documentation-concept"),
      type: "owl:Class",
      "rdfs:comment": "Base documentation-domain concept used by the beep-effect documentation ontology.",
      "rdfs:label": [{ value: "documentation concept", lang: "en" }],
    },
    "documentation-standard": {
      uri: tbox("documentation-standard"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Canonical documentation standard or specification that defines a tag or policy surface.",
      "rdfs:label": [{ value: "documentation standard", lang: "en" }],
    },
    "documentation-tag": {
      uri: tbox("documentation-tag"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Documentation tag definition such as @param or @returns.",
      "rdfs:label": [{ value: "documentation tag", lang: "en" }],
    },
    "documentation-rule": {
      uri: tbox("documentation-rule"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Normative documentation rule or policy statement.",
      "rdfs:label": [{ value: "documentation rule", lang: "en" }],
    },
    "documentation-requirement": {
      uri: tbox("documentation-requirement"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-rule",
      "rdfs:comment": "Documentation rule that requires a behavior or artifact.",
      "rdfs:label": [{ value: "documentation requirement", lang: "en" }],
    },
    "documentation-prohibition": {
      uri: tbox("documentation-prohibition"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-rule",
      "rdfs:comment": "Documentation rule that forbids a behavior or artifact.",
      "rdfs:label": [{ value: "documentation prohibition", lang: "en" }],
    },
    "documentation-artifact": {
      uri: tbox("documentation-artifact"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Documentation artifact or output kind used by generation or validation flows.",
      "rdfs:label": [{ value: "documentation artifact", lang: "en" }],
    },
    "documentation-symbol-kind": {
      uri: tbox("documentation-symbol-kind"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment":
        "Normalized bridge kind that connects AST applicability surfaces, docgen entity kinds, and repo symbol kinds.",
      "rdfs:label": [{ value: "documentation symbol kind", lang: "en" }],
    },
    "ast-applicable-kind": {
      uri: tbox("ast-applicable-kind"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Raw AST-level documentation attachment kind from the JSDoc models.",
      "rdfs:label": [{ value: "AST applicable kind", lang: "en" }],
    },
    "docgen-entity-kind": {
      uri: tbox("docgen-entity-kind"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Docgen-facing export or entity kind surfaced by repo tooling.",
      "rdfs:label": [{ value: "docgen entity kind", lang: "en" }],
    },
    "repo-symbol-kind": {
      uri: tbox("repo-symbol-kind"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Deterministic TypeScript symbol kind surfaced by repo-utils indexing.",
      "rdfs:label": [{ value: "repo symbol kind", lang: "en" }],
    },
    "ast-derivability-level": {
      uri: tbox("ast-derivability-level"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "How much of a documentation tag can be derived mechanically from the AST.",
      "rdfs:label": [{ value: "AST derivability level", lang: "en" }],
    },
    "tag-parameter-shape": {
      uri: tbox("tag-parameter-shape"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Structured syntax and boolean acceptance metadata for tag parameters.",
      "rdfs:label": [{ value: "tag parameter shape", lang: "en" }],
    },
    "source-authority": {
      uri: tbox("source-authority"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Source-of-truth authority used to justify seeded facts, mappings, or rules.",
      "rdfs:label": [{ value: "source authority", lang: "en" }],
    },
    "validation-tool": {
      uri: tbox("validation-tool"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment": "Validator or analysis tool that enforces or reports on documentation behavior.",
      "rdfs:label": [{ value: "validation tool", lang: "en" }],
    },
    "validation-support-status": {
      uri: tbox("validation-support-status"),
      type: "owl:Class",
      "rdfs:subClassOf": "documentation-concept",
      "rdfs:comment":
        "Classification of whether a rule is supported today, possible with glue, or not realistic today.",
      "rdfs:label": [{ value: "validation support status", lang: "en" }],
    },
  },
  objectProperties: {
    "defined-by-standard": {
      uri: tbox("defined-by-standard"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "documentation-standard",
      "rdfs:label": [{ value: "defined by standard", lang: "en" }],
    },
    "applies-to-kind": {
      uri: tbox("applies-to-kind"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "ast-applicable-kind",
      "rdfs:label": [{ value: "applies to kind", lang: "en" }],
    },
    "normalizes-to-symbol-kind": {
      uri: tbox("normalizes-to-symbol-kind"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "ast-applicable-kind",
      "rdfs:range": "documentation-symbol-kind",
      "rdfs:label": [{ value: "normalizes to symbol kind", lang: "en" }],
    },
    "docgen-normalizes-to-symbol-kind": {
      uri: tbox("docgen-normalizes-to-symbol-kind"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "docgen-entity-kind",
      "rdfs:range": "documentation-symbol-kind",
      "rdfs:label": [{ value: "docgen normalizes to symbol kind", lang: "en" }],
    },
    "repo-normalizes-to-symbol-kind": {
      uri: tbox("repo-normalizes-to-symbol-kind"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "repo-symbol-kind",
      "rdfs:range": "documentation-symbol-kind",
      "rdfs:label": [{ value: "repo normalizes to symbol kind", lang: "en" }],
    },
    "has-ast-derivability": {
      uri: tbox("has-ast-derivability"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "ast-derivability-level",
      "rdfs:label": [{ value: "has AST derivability", lang: "en" }],
    },
    "has-parameter-shape": {
      uri: tbox("has-parameter-shape"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "tag-parameter-shape",
      "rdfs:label": [{ value: "has parameter shape", lang: "en" }],
    },
    "related-tag": {
      uri: tbox("related-tag"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "documentation-tag",
      "rdfs:label": [{ value: "related tag", lang: "en" }],
    },
    "governed-by-rule": {
      uri: tbox("governed-by-rule"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "documentation-rule",
      "rdfs:label": [{ value: "governed by rule", lang: "en" }],
    },
    "derived-from-source": {
      uri: tbox("derived-from-source"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-concept",
      "rdfs:range": "source-authority",
      "rdfs:label": [{ value: "derived from source", lang: "en" }],
    },
    "validated-by-tool": {
      uri: tbox("validated-by-tool"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-rule",
      "rdfs:range": "validation-tool",
      "rdfs:label": [{ value: "validated by tool", lang: "en" }],
    },
    "produces-artifact-kind": {
      uri: tbox("produces-artifact-kind"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-rule",
      "rdfs:range": "documentation-artifact",
      "rdfs:label": [{ value: "produces artifact kind", lang: "en" }],
    },
    "targets-tag": {
      uri: tbox("targets-tag"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-rule",
      "rdfs:range": "documentation-tag",
      "rdfs:label": [{ value: "targets tag", lang: "en" }],
    },
    "targets-symbol-kind": {
      uri: tbox("targets-symbol-kind"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-rule",
      "rdfs:range": "documentation-symbol-kind",
      "rdfs:label": [{ value: "targets symbol kind", lang: "en" }],
    },
    "has-support-status": {
      uri: tbox("has-support-status"),
      type: "owl:ObjectProperty",
      "rdfs:domain": "documentation-rule",
      "rdfs:range": "validation-support-status",
      "rdfs:label": [{ value: "has support status", lang: "en" }],
    },
  },
  datatypeProperties: {
    "canonical-tag-name": {
      uri: tbox("canonical-tag-name"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "canonical tag name", lang: "en" }],
    },
    "syntax-template": {
      uri: tbox("syntax-template"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "tag-parameter-shape",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "syntax template", lang: "en" }],
    },
    "accepts-type": {
      uri: tbox("accepts-type"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "tag-parameter-shape",
      "rdfs:range": "xsd:boolean",
      "rdfs:label": [{ value: "accepts type", lang: "en" }],
    },
    "accepts-name": {
      uri: tbox("accepts-name"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "tag-parameter-shape",
      "rdfs:range": "xsd:boolean",
      "rdfs:label": [{ value: "accepts name", lang: "en" }],
    },
    "accepts-description": {
      uri: tbox("accepts-description"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "tag-parameter-shape",
      "rdfs:range": "xsd:boolean",
      "rdfs:label": [{ value: "accepts description", lang: "en" }],
    },
    "deprecation-state": {
      uri: tbox("deprecation-state"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "documentation-tag",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "deprecation state", lang: "en" }],
    },
    "descriptive-notes": {
      uri: tbox("descriptive-notes"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "documentation-concept",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "descriptive notes", lang: "en" }],
    },
    "stable-provenance-id": {
      uri: tbox("stable-provenance-id"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "documentation-concept",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "stable provenance id", lang: "en" }],
    },
    "enforcement-notes": {
      uri: tbox("enforcement-notes"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "documentation-rule",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "enforcement notes", lang: "en" }],
    },
    "source-location": {
      uri: tbox("source-location"),
      type: "owl:DatatypeProperty",
      "rdfs:domain": "source-authority",
      "rdfs:range": "xsd:string",
      "rdfs:label": [{ value: "source location", lang: "en" }],
    },
  },
};

const documentationTags = [
  {
    id: "tag:param",
    key: "param",
    label: "@param",
    standards: ["jsdoc3", "tsdocCore", "typescript", "closure", "typedoc"],
    applicableKinds: ["function", "method", "constructor"],
    derivability: "partial",
    parameterShapeId: "tag-parameter-shape:param",
    relatedTags: ["tag:returns"],
    notes:
      "Parameter structure is AST-derivable, but human-authored intent text is still required for high-quality documentation.",
  },
  {
    id: "tag:returns",
    key: "returns",
    label: "@returns",
    standards: ["jsdoc3", "tsdocCore", "typescript", "closure", "typedoc"],
    applicableKinds: ["function", "method"],
    derivability: "partial",
    parameterShapeId: "tag-parameter-shape:returns",
    relatedTags: ["tag:param", "tag:throws"],
    notes: "Return types are AST-derivable, but semantic return descriptions are not deterministic from syntax alone.",
  },
  {
    id: "tag:throws",
    key: "throws",
    label: "@throws",
    standards: ["jsdoc3", "tsdocDiscretionary", "closure", "typedoc"],
    applicableKinds: ["function", "method"],
    derivability: "partial",
    parameterShapeId: "tag-parameter-shape:throws",
    relatedTags: ["tag:returns"],
    notes:
      "Throws metadata is only partially derivable in this repo because Effect error channels and conventional throws require semantic interpretation.",
  },
  {
    id: "tag:since",
    key: "since",
    label: "@since",
    standards: ["jsdoc3", "typedoc"],
    applicableKinds: ["any"],
    derivability: "none",
    parameterShapeId: "tag-parameter-shape:since",
    relatedTags: ["tag:category"],
    notes: "Version provenance is policy-driven and not available from the AST alone.",
  },
  {
    id: "tag:category",
    key: "category",
    label: "@category",
    standards: ["typedoc"],
    applicableKinds: ["any"],
    derivability: "none",
    parameterShapeId: "tag-parameter-shape:category",
    relatedTags: ["tag:example"],
    notes: "Category choices are documentation information architecture rather than code structure.",
  },
  {
    id: "tag:example",
    key: "example",
    label: "@example",
    standards: ["jsdoc3", "tsdocCore", "typedoc"],
    applicableKinds: ["any"],
    derivability: "none",
    parameterShapeId: "tag-parameter-shape:example",
    relatedTags: ["tag:category"],
    notes:
      "Examples require authored or generated code and are validated through docgen execution rather than AST inspection.",
  },
] as const;

const parameterShapes = [
  {
    id: "tag-parameter-shape:param",
    label: "parameter tag shape",
    syntax: "@param name {Type} - description.",
    acceptsType: true,
    acceptsName: true,
    acceptsDescription: true,
  },
  {
    id: "tag-parameter-shape:returns",
    label: "returns tag shape",
    syntax: "@returns {Type} - description.",
    acceptsType: true,
    acceptsName: false,
    acceptsDescription: true,
  },
  {
    id: "tag-parameter-shape:throws",
    label: "throws tag shape",
    syntax: "@throws {ErrorType} - description.",
    acceptsType: true,
    acceptsName: false,
    acceptsDescription: true,
  },
  {
    id: "tag-parameter-shape:since",
    label: "since tag shape",
    syntax: "@since version",
    acceptsType: false,
    acceptsName: false,
    acceptsDescription: true,
  },
  {
    id: "tag-parameter-shape:category",
    label: "category tag shape",
    syntax: "@category CategoryName",
    acceptsType: false,
    acceptsName: true,
    acceptsDescription: false,
  },
  {
    id: "tag-parameter-shape:example",
    label: "example tag shape",
    syntax: "@example [title]\\ncode",
    acceptsType: false,
    acceptsName: false,
    acceptsDescription: true,
  },
] as const;

const sourceAuthorities = [
  {
    id: "source-authority:typed-jsdoc-models",
    label: "Typed JSDoc models",
    location: "packages/tooling/library/repo-utils/src/JSDoc/",
    notes:
      "Primary structural source for canonical tag metadata, specifications, AST applicability, derivability, and parameter shapes.",
  },
  {
    id: "source-authority:repo-policy-pattern",
    label: "Repo JSDoc policy pattern",
    location: ".patterns/jsdoc-documentation.md",
    notes:
      "Primary normative source for repo-specific requirements, prohibitions, example expectations, and Effect-specific @throws guidance.",
  },
  {
    id: "source-authority:docgen-checker",
    label: "Docgen checker",
    location: "packages/tooling/tool/docgen/src/Checker.ts",
    notes: "Current enforcement surface for missing description, examples, and @since in docgen runtime validation.",
  },
  {
    id: "source-authority:docgen-analysis",
    label: "Docgen analysis operations",
    location: "packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts",
    notes:
      "Current enforcement and reporting surface for public-export tag requirements such as @category, @example, and @since.",
  },
  {
    id: "source-authority:docgen-domain",
    label: "Docgen domain models",
    location: "packages/tooling/tool/docgen/src/Domain.ts",
    notes: "Primary source for docgen entities, emitted artifact kinds, and documentation record structure.",
  },
  {
    id: "source-authority:repo-symbol-index",
    label: "Repo utils symbol model",
    location: "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts",
    notes:
      "Primary source for deterministic TypeScript symbol kinds used by repo indexing and documentation grounding.",
  },
] as const;

const validationTools = [
  {
    id: "validation-tool:docgen-checker",
    label: "docgen checker",
    notes: "Runtime checker in packages/tooling/tool/docgen/src/Checker.ts.",
  },
  {
    id: "validation-tool:docgen-analysis",
    label: "docgen analysis",
    notes: "Static export analysis in packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts.",
  },
  {
    id: "validation-tool:docgen-cli",
    label: "docgen CLI",
    notes: "End-to-end bun run docgen execution path used for example compilation and generation.",
  },
  {
    id: "validation-tool:external-rule-engine",
    label: "external rule engine",
    notes: "Proposed future glue layer for semantic and procedural rule enforcement outside TrustGraph.",
  },
] as const;

const supportStatuses = [
  {
    id: "support-status:supported-now",
    label: "supported now",
    notes: "Implemented in current repo tooling without new ontology glue.",
  },
  {
    id: "support-status:possible-with-glue",
    label: "possible with glue",
    notes: "Modelable now, but enforcement requires external rule execution or semantic glue code.",
  },
  {
    id: "support-status:not-supported-today",
    label: "not realistically supported today",
    notes: "Not a realistic target for the current TrustGraph ontology feature alone.",
  },
] as const;

const artifactKinds = [
  {
    id: "artifact:exported-api-doc-block",
    label: "exported API doc block",
    notes: "Symbol-level documentation block for a public API member.",
  },
  {
    id: "artifact:module-fileoverview-doc",
    label: "module fileoverview doc",
    notes: "Module or file-level documentation overview block.",
  },
  {
    id: "artifact:docgen-analysis-record",
    label: "docgen analysis record",
    notes: "Machine-readable docgen analysis record produced by repo CLI tooling.",
  },
  {
    id: "artifact:compiled-example",
    label: "compiled example",
    notes: "Example code fragment validated through bun run docgen.",
  },
] as const;

const ruleSeeds = [
  {
    id: "rule:param-tag-per-declared-parameter",
    label: "Require one @param line per declared parameter",
    classId: "documentation-requirement",
    targetTags: ["tag:param"],
    targetSymbolKinds: ["symbol-kind:function", "symbol-kind:method", "symbol-kind:constructor"],
    supportStatus: "support-status:possible-with-glue",
    tools: ["validation-tool:external-rule-engine"],
    artifacts: ["artifact:exported-api-doc-block"],
    sources: ["source-authority:repo-policy-pattern", "source-authority:typed-jsdoc-models"],
    notes: "Repo policy requires one @param line per declared parameter, but current enforcement needs AST-aware glue.",
  },
  {
    id: "rule:returns-tag-required-for-functions",
    label: "Require @returns for documented functions and methods",
    classId: "documentation-requirement",
    targetTags: ["tag:returns"],
    targetSymbolKinds: ["symbol-kind:function", "symbol-kind:method"],
    supportStatus: "support-status:possible-with-glue",
    tools: ["validation-tool:external-rule-engine"],
    artifacts: ["artifact:exported-api-doc-block"],
    sources: ["source-authority:repo-policy-pattern", "source-authority:typed-jsdoc-models"],
    notes:
      "Repo policy requires @returns for every documented function contract, including void and assertion signatures, but current repo tooling does not enforce it.",
  },
  {
    id: "rule:throws-only-when-function-actually-throws",
    label: "Only use @throws when a function can actually throw",
    classId: "documentation-requirement",
    targetTags: ["tag:throws"],
    targetSymbolKinds: ["symbol-kind:function", "symbol-kind:method"],
    supportStatus: "support-status:possible-with-glue",
    tools: ["validation-tool:external-rule-engine"],
    artifacts: ["artifact:exported-api-doc-block"],
    sources: ["source-authority:repo-policy-pattern", "source-authority:typed-jsdoc-models"],
    notes:
      "Determining whether thrown values are real runtime throws requires semantic or control-flow glue beyond the current ontology feature.",
  },
  {
    id: "rule:no-throws-for-effect-error-channel",
    label: "Do not use @throws for Effect error channels",
    classId: "documentation-prohibition",
    targetTags: ["tag:throws"],
    targetSymbolKinds: ["symbol-kind:function", "symbol-kind:method"],
    supportStatus: "support-status:possible-with-glue",
    tools: ["validation-tool:external-rule-engine"],
    artifacts: ["artifact:exported-api-doc-block"],
    sources: ["source-authority:repo-policy-pattern"],
    notes:
      "This is a repo-specific semantic prohibition tied to Effect<A, E, R> interpretation and needs external rule execution.",
  },
  {
    id: "rule:example-required-on-documented-entries",
    label: "Require @example on documented public entries",
    classId: "documentation-requirement",
    targetTags: ["tag:example"],
    targetSymbolKinds: [
      "symbol-kind:function",
      "symbol-kind:class",
      "symbol-kind:interface",
      "symbol-kind:type-alias",
      "symbol-kind:value",
      "symbol-kind:namespace",
    ],
    supportStatus: "support-status:supported-now",
    tools: ["validation-tool:docgen-checker", "validation-tool:docgen-analysis"],
    artifacts: ["artifact:exported-api-doc-block", "artifact:docgen-analysis-record"],
    sources: ["source-authority:docgen-checker", "source-authority:docgen-analysis"],
    notes: "Current docgen tooling already checks for example presence across public documentation surfaces.",
  },
  {
    id: "rule:example-must-compile-via-docgen",
    label: "Examples must compile via bun run docgen",
    classId: "documentation-requirement",
    targetTags: ["tag:example"],
    targetSymbolKinds: ["symbol-kind:function", "symbol-kind:class", "symbol-kind:interface", "symbol-kind:type-alias"],
    supportStatus: "support-status:supported-now",
    tools: ["validation-tool:docgen-cli"],
    artifacts: ["artifact:compiled-example"],
    sources: ["source-authority:repo-policy-pattern"],
    notes: "The repo's zero-tolerance policy explicitly treats successful docgen example compilation as mandatory.",
  },
  {
    id: "rule:since-required-on-public-exports",
    label: "Require @since on public exports",
    classId: "documentation-requirement",
    targetTags: ["tag:since"],
    targetSymbolKinds: [
      "symbol-kind:function",
      "symbol-kind:class",
      "symbol-kind:interface",
      "symbol-kind:type-alias",
      "symbol-kind:value",
      "symbol-kind:namespace",
      "symbol-kind:re-export",
      "symbol-kind:module-fileoverview",
    ],
    supportStatus: "support-status:supported-now",
    tools: ["validation-tool:docgen-checker", "validation-tool:docgen-analysis"],
    artifacts: ["artifact:exported-api-doc-block", "artifact:docgen-analysis-record"],
    sources: ["source-authority:docgen-checker", "source-authority:docgen-analysis"],
    notes: "Current checker and analysis flows already report missing @since in public documentation paths.",
  },
  {
    id: "rule:category-required-on-public-exports",
    label: "Require @category on public exports",
    classId: "documentation-requirement",
    targetTags: ["tag:category"],
    targetSymbolKinds: [
      "symbol-kind:function",
      "symbol-kind:class",
      "symbol-kind:interface",
      "symbol-kind:type-alias",
      "symbol-kind:value",
      "symbol-kind:namespace",
      "symbol-kind:re-export",
      "symbol-kind:module-fileoverview",
    ],
    supportStatus: "support-status:supported-now",
    tools: ["validation-tool:docgen-analysis"],
    artifacts: ["artifact:docgen-analysis-record"],
    sources: ["source-authority:docgen-analysis", "source-authority:repo-policy-pattern"],
    notes:
      "Current docgen analysis treats @category as a required public-export tag, while checker enforcement lives in the higher-level analysis path.",
  },
  {
    id: "rule:description-required-on-documented-entries",
    label: "Require description text on documented entries",
    classId: "documentation-requirement",
    targetTags: [],
    targetSymbolKinds: [
      "symbol-kind:function",
      "symbol-kind:class",
      "symbol-kind:interface",
      "symbol-kind:type-alias",
      "symbol-kind:value",
      "symbol-kind:namespace",
    ],
    supportStatus: "support-status:supported-now",
    tools: ["validation-tool:docgen-checker"],
    artifacts: ["artifact:exported-api-doc-block"],
    sources: ["source-authority:docgen-checker"],
    notes: "Docgen runtime already reports missing descriptions for documented entries.",
  },
] as const;

const fileUrl = (relativePath: string) => new URL(relativePath, repoRootUrl).href;

const run = async () => {
  await mkdir(fileURLToPath(outputsUrl), { recursive: true });

  const applicableToModel = await readText(
    "packages/tooling/library/repo-utils/src/JSDoc/models/ApplicableTo.model.ts"
  );
  const astDerivabilityModel = await readText(
    "packages/tooling/library/repo-utils/src/JSDoc/models/ASTDerivability.model.ts"
  );
  const specificationModel = await readText(
    "packages/tooling/library/repo-utils/src/JSDoc/models/Specification.model.ts"
  );
  const tagKindModel = await readText("packages/tooling/library/repo-utils/src/JSDoc/models/TagKind.model.ts");
  const jsDocDatabase = await readText("packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts");
  const docgenOperations = await readText("packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts");
  const repoUtilsSymbolModel = await readText("packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts");

  const documentationStandards = extractLiteralKitValues(specificationModel, "Specification");
  const applicableKinds = extractLiteralKitValues(applicableToModel, "ApplicableTo");
  const astDerivabilityLevels = extractLiteralKitValues(astDerivabilityModel, "ASTDerivability");
  const tagKinds = extractLiteralKitValues(tagKindModel, "TagKind");
  const jsDocTagNames = extractTagNames(jsDocDatabase);
  const docgenKinds = extractLiteralKitValues(docgenOperations, "DocgenExportKind");
  const repoSymbolKinds = extractPickedOptions(repoUtilsSymbolModel, "symbolKindOptions");
  const requiredPublicExportTags = extractRequiredTags(docgenOperations);

  const documentationSymbolKinds = [
    "function",
    "method",
    "constructor",
    "class",
    "interface",
    "type-alias",
    "value",
    "property",
    "accessor",
    "namespace",
    "enum",
    "module-fileoverview",
    "re-export",
  ];

  const astNormalizationBridge = [
    { source: "function", target: "function", notes: "Direct function applicability." },
    { source: "method", target: "method", notes: "Method-specific rule targeting is preserved." },
    { source: "constructor", target: "constructor", notes: "Constructor contracts differ from regular functions." },
    { source: "class", target: "class", notes: "Class declarations remain first-class." },
    { source: "interface", target: "interface", notes: "Interface declarations remain first-class." },
    { source: "typeAlias", target: "type-alias", notes: "Docgen's type export kind normalizes here." },
    {
      source: "variable",
      target: "value",
      notes: "Raw value declarations normalize away from docgen's const-specific term.",
    },
    { source: "constant", target: "value", notes: "Constant declarations share the normalized value bridge kind." },
    { source: "property", target: "property", notes: "Property tags stay distinguishable from general values." },
    { source: "accessor", target: "accessor", notes: "Accessor-level tags need distinct rule targeting when present." },
    { source: "namespace", target: "namespace", notes: "Namespace documentation remains explicit." },
    { source: "enum", target: "enum", notes: "Enum documentation stays separate from value docs." },
    {
      source: "module",
      target: "module-fileoverview",
      notes: "Module-level applicability maps to docgen fileoverview docs.",
    },
    {
      source: "file",
      target: "module-fileoverview",
      notes: "File-level comments share the fileoverview normalization target.",
    },
    {
      source: "exportSpecifier",
      target: "re-export",
      notes: "Explicit export specifiers map to re-export documentation.",
    },
  ];

  const docgenNormalizationBridge = [
    { source: "function", target: "function" },
    { source: "const", target: "value" },
    { source: "type", target: "type-alias" },
    { source: "interface", target: "interface" },
    { source: "class", target: "class" },
    { source: "namespace", target: "namespace" },
    { source: "enum", target: "enum" },
    { source: "re-export", target: "re-export" },
    { source: "module-fileoverview", target: "module-fileoverview" },
  ];

  const repoSymbolNormalizationBridge = [
    { source: "FunctionDeclaration", target: "function" },
    { source: "ClassDeclaration", target: "class" },
    { source: "MethodDeclaration", target: "method" },
    { source: "Constructor", target: "constructor" },
    { source: "GetAccessor", target: "accessor" },
    { source: "SetAccessor", target: "accessor" },
    { source: "InterfaceDeclaration", target: "interface" },
    { source: "TypeAliasDeclaration", target: "type-alias" },
    { source: "EnumDeclaration", target: "enum" },
  ];

  const scaffold = {
    schemaVersion: 1,
    generatedAt,
    ontologyNamespace: tboxNamespace,
    seedNamespace,
    probeOntologyKey,
    mechanicalSeed: {
      documentationStandards,
      applicableKinds,
      astDerivabilityLevels,
      tagKinds,
      jsDocTagNames,
      docgenKinds,
      repoSymbolKinds,
      requiredPublicExportTags,
      governingSubset: documentationTags.map((tag) => tag.key),
    },
    bridge: {
      documentationSymbolKinds,
      astNormalizationBridge,
      docgenNormalizationBridge,
      repoSymbolNormalizationBridge,
    },
    sourceFiles: {
      specificationModel: "packages/tooling/library/repo-utils/src/JSDoc/models/Specification.model.ts",
      applicableToModel: "packages/tooling/library/repo-utils/src/JSDoc/models/ApplicableTo.model.ts",
      astDerivabilityModel: "packages/tooling/library/repo-utils/src/JSDoc/models/ASTDerivability.model.ts",
      jsDocDatabase: "packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts",
      docgenDomain: "packages/tooling/tool/docgen/src/Domain.ts",
      docgenAnalysis: "packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts",
      repoUtilsSymbolModel: "packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts",
      policyPattern: ".patterns/jsdoc-documentation.md",
    },
    counts: {
      jsDocTags: jsDocTagNames.length,
      documentationStandards: documentationStandards.length,
      applicableKinds: applicableKinds.length,
      astDerivabilityLevels: astDerivabilityLevels.length,
      docgenKinds: docgenKinds.length,
      repoSymbolKinds: repoSymbolKinds.length,
      documentationSymbolKinds: documentationSymbolKinds.length,
      governingRules: ruleSeeds.length,
    },
  };

  const datasetQuads = [
    ...sourceAuthorities.flatMap((authority) => [
      typeQuad(authority.id, "source-authority"),
      labelQuad(authority.id, authority.label),
      provenanceQuad(authority.id, authority.id.replace("source-authority:", "source-authority:")),
      datatypeQuad(authority.id, "source-location", authority.location, XSD_STRING.value),
      noteQuad(authority.id, authority.notes),
    ]),
    ...documentationStandards.flatMap((standard) => {
      const subjectId = `standard:${standard}`;
      return [
        typeQuad(subjectId, "documentation-standard"),
        labelQuad(subjectId, standard),
        provenanceQuad(subjectId, `documentation-standard:${standard}`),
        noteQuad(subjectId, "Canonical documentation standard extracted from the repo JSDoc specification model."),
        objectQuad(subjectId, "derived-from-source", seed("source-authority:typed-jsdoc-models")),
      ];
    }),
    ...astDerivabilityLevels.flatMap((level) => {
      const subjectId = `ast-derivability:${level}`;
      return [
        typeQuad(subjectId, "ast-derivability-level"),
        labelQuad(subjectId, level),
        provenanceQuad(subjectId, `ast-derivability:${level}`),
        objectQuad(subjectId, "derived-from-source", seed("source-authority:typed-jsdoc-models")),
      ];
    }),
    ...documentationSymbolKinds.flatMap((kind) => {
      const subjectId = `symbol-kind:${kind}`;
      return [
        typeQuad(subjectId, "documentation-symbol-kind"),
        labelQuad(subjectId, kind),
        provenanceQuad(subjectId, `documentation-symbol-kind:${kind}`),
        noteQuad(subjectId, "Normalized bridge kind used across AST, docgen, and repo symbol domains."),
      ];
    }),
    ...astNormalizationBridge.flatMap((mapping) => {
      const subjectId = `ast-kind:${mapping.source}`;
      return [
        typeQuad(subjectId, "ast-applicable-kind"),
        labelQuad(subjectId, mapping.source),
        provenanceQuad(subjectId, `ast-applicable-kind:${mapping.source}`),
        noteQuad(subjectId, mapping.notes),
        objectQuad(subjectId, "normalizes-to-symbol-kind", seed(`symbol-kind:${mapping.target}`)),
        objectQuad(subjectId, "derived-from-source", seed("source-authority:typed-jsdoc-models")),
      ];
    }),
    ...docgenNormalizationBridge.flatMap((mapping) => {
      const subjectId = `docgen-kind:${mapping.source}`;
      return [
        typeQuad(subjectId, "docgen-entity-kind"),
        labelQuad(subjectId, mapping.source),
        provenanceQuad(subjectId, `docgen-entity-kind:${mapping.source}`),
        objectQuad(subjectId, "docgen-normalizes-to-symbol-kind", seed(`symbol-kind:${mapping.target}`)),
        objectQuad(subjectId, "derived-from-source", seed("source-authority:docgen-domain")),
      ];
    }),
    ...repoSymbolNormalizationBridge.flatMap((mapping) => {
      const subjectId = `repo-symbol-kind:${mapping.source}`;
      return [
        typeQuad(subjectId, "repo-symbol-kind"),
        labelQuad(subjectId, mapping.source),
        provenanceQuad(subjectId, `repo-symbol-kind:${mapping.source}`),
        objectQuad(subjectId, "repo-normalizes-to-symbol-kind", seed(`symbol-kind:${mapping.target}`)),
        objectQuad(subjectId, "derived-from-source", seed("source-authority:repo-symbol-index")),
      ];
    }),
    ...parameterShapes.flatMap((shape) => [
      typeQuad(shape.id, "tag-parameter-shape"),
      labelQuad(shape.id, shape.label),
      provenanceQuad(shape.id, shape.id.replace("tag-parameter-shape:", "tag-parameter-shape:")),
      datatypeQuad(shape.id, "syntax-template", shape.syntax, XSD_STRING.value),
      booleanQuad(shape.id, "accepts-type", shape.acceptsType),
      booleanQuad(shape.id, "accepts-name", shape.acceptsName),
      booleanQuad(shape.id, "accepts-description", shape.acceptsDescription),
      objectQuad(shape.id, "derived-from-source", seed("source-authority:typed-jsdoc-models")),
    ]),
    ...documentationTags.flatMap((tag) => [
      typeQuad(tag.id, "documentation-tag"),
      labelQuad(tag.id, tag.label),
      provenanceQuad(tag.id, `documentation-tag:${tag.key}`),
      datatypeQuad(tag.id, "canonical-tag-name", tag.key, XSD_STRING.value),
      datatypeQuad(tag.id, "deprecation-state", "active", XSD_STRING.value),
      noteQuad(tag.id, tag.notes),
      objectQuad(tag.id, "has-parameter-shape", seed(tag.parameterShapeId)),
      objectQuad(tag.id, "has-ast-derivability", seed(`ast-derivability:${tag.derivability}`)),
      objectQuad(tag.id, "derived-from-source", seed("source-authority:typed-jsdoc-models")),
      ...tag.standards.map((standard) => objectQuad(tag.id, "defined-by-standard", seed(`standard:${standard}`))),
      ...tag.applicableKinds.map((kind) => objectQuad(tag.id, "applies-to-kind", seed(`ast-kind:${kind}`))),
      ...tag.relatedTags.map((relatedTagId) => objectQuad(tag.id, "related-tag", seed(relatedTagId))),
    ]),
    ...validationTools.flatMap((tool) => [
      typeQuad(tool.id, "validation-tool"),
      labelQuad(tool.id, tool.label),
      provenanceQuad(tool.id, tool.id.replace("validation-tool:", "validation-tool:")),
      noteQuad(tool.id, tool.notes),
    ]),
    ...supportStatuses.flatMap((status) => [
      typeQuad(status.id, "validation-support-status"),
      labelQuad(status.id, status.label),
      provenanceQuad(status.id, status.id.replace("support-status:", "support-status:")),
      noteQuad(status.id, status.notes),
    ]),
    ...artifactKinds.flatMap((artifact) => [
      typeQuad(artifact.id, "documentation-artifact"),
      labelQuad(artifact.id, artifact.label),
      provenanceQuad(artifact.id, artifact.id.replace("artifact:", "artifact:")),
      noteQuad(artifact.id, artifact.notes),
    ]),
    ...ruleSeeds.flatMap((rule) => [
      typeQuad(rule.id, rule.classId),
      labelQuad(rule.id, rule.label),
      provenanceQuad(rule.id, `documentation-rule:${rule.id.replace("rule:", "")}`),
      datatypeQuad(rule.id, "enforcement-notes", rule.notes, XSD_STRING.value),
      objectQuad(rule.id, "has-support-status", seed(rule.supportStatus)),
      ...rule.targetTags.map((tagId) => objectQuad(rule.id, "targets-tag", seed(tagId))),
      ...rule.targetSymbolKinds.map((symbolKindId) => objectQuad(rule.id, "targets-symbol-kind", seed(symbolKindId))),
      ...rule.tools.map((toolId) => objectQuad(rule.id, "validated-by-tool", seed(toolId))),
      ...rule.artifacts.map((artifactId) => objectQuad(rule.id, "produces-artifact-kind", seed(artifactId))),
      ...rule.sources.map((sourceId) => objectQuad(rule.id, "derived-from-source", seed(sourceId))),
    ]),
    ...documentationTags.flatMap((tag) => {
      const governingRules = ruleSeeds
        .filter((rule) => rule.targetTags.includes(tag.id))
        .map((rule) => objectQuad(tag.id, "governed-by-rule", seed(rule.id)));

      return governingRules;
    }),
  ];

  const seedDataset = makeDataset(datasetQuads);
  const sortedSeedQuads = sortDatasetQuads(seedDataset);

  const shapes = [
    {
      id: tboxNode("shape-documentation-tag"),
      targetClass: tboxNode("documentation-tag"),
      properties: [
        { path: tboxNode("stable-provenance-id"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
        { path: tboxNode("canonical-tag-name"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
      ],
    },
    {
      id: tboxNode("shape-tag-parameter-shape"),
      targetClass: tboxNode("tag-parameter-shape"),
      properties: [
        { path: tboxNode("stable-provenance-id"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
        { path: tboxNode("syntax-template"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
        { path: tboxNode("accepts-type"), minCount: 1, maxCount: 1, datatype: XSD_BOOLEAN },
        { path: tboxNode("accepts-name"), minCount: 1, maxCount: 1, datatype: XSD_BOOLEAN },
        { path: tboxNode("accepts-description"), minCount: 1, maxCount: 1, datatype: XSD_BOOLEAN },
      ],
    },
    {
      id: tboxNode("shape-documentation-rule"),
      targetClass: tboxNode("documentation-rule"),
      properties: [
        { path: tboxNode("stable-provenance-id"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
        { path: tboxNode("enforcement-notes"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
      ],
    },
    {
      id: tboxNode("shape-source-authority"),
      targetClass: tboxNode("source-authority"),
      properties: [
        { path: tboxNode("stable-provenance-id"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
        { path: tboxNode("source-location"), minCount: 1, maxCount: 1, datatype: XSD_STRING },
      ],
    },
  ];

  const provenance = {
    lifecycle: {
      assertedAt: "2026-04-04T00:00:00Z",
      derivedAt: "2026-04-04T00:00:00Z",
    },
    records: [
      {
        provType: "SoftwareAgent",
        id: seed("agent:codex-cli"),
        name: "Codex CLI",
      },
      {
        provType: "Plan",
        id: seed("plan:trustgraph-doc-ontology"),
        name: "TrustGraph documentation ontology plan",
      },
      {
        provType: "Entity",
        id: seed("source:typed-jsdoc-models"),
        hadPrimarySource: [fileUrl("packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts")],
        value: "Typed JSDoc tag database and associated LiteralKit models.",
      },
      {
        provType: "Entity",
        id: seed("source:repo-policy-pattern"),
        hadPrimarySource: [fileUrl(".patterns/jsdoc-documentation.md")],
        value: "Repo documentation policy pattern.",
      },
      {
        provType: "Entity",
        id: seed("source:docgen-analysis"),
        hadPrimarySource: [fileUrl("packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts")],
        value: "Docgen analysis and public-export requirement source.",
      },
      {
        provType: "Activity",
        id: seed("activity:build-artifacts"),
        used: [
          seed("source:typed-jsdoc-models"),
          seed("source:repo-policy-pattern"),
          seed("source:docgen-analysis"),
          seed("plan:trustgraph-doc-ontology"),
        ],
        wasAssociatedWith: [seed("agent:codex-cli")],
        startedAtTime: "2026-04-04T00:00:00Z",
        endedAtTime: "2026-04-04T00:00:00Z",
      },
      {
        entity: seed("artifact:ontology-json"),
        activity: seed("activity:build-artifacts"),
      },
      {
        entity: seed("artifact:seed-dataset"),
        activity: seed("activity:build-artifacts"),
      },
      {
        activity: seed("activity:build-artifacts"),
        agent: seed("agent:codex-cli"),
        hadPlan: seed("plan:trustgraph-doc-ontology"),
      },
      {
        generatedEntity: seed("artifact:ontology-json"),
        usedEntity: seed("source:typed-jsdoc-models"),
      },
      {
        generatedEntity: seed("artifact:seed-dataset"),
        usedEntity: seed("source:repo-policy-pattern"),
      },
      {
        generatedEntity: seed("artifact:seed-dataset"),
        usedEntity: seed("source:docgen-analysis"),
      },
    ],
  };

  const evidence = {
    anchors: [
      {
        id: seed("evidence:policy-effect-throws"),
        target: {
          source: fileUrl(".patterns/jsdoc-documentation.md"),
          selector: {
            kind: "text-quote",
            exact: "FORBIDDEN: Using `@throws` to document `Effect<A, E, R>` error channels",
          },
        },
        note: "Repo policy anchor for the Effect-specific @throws prohibition.",
      },
      {
        id: seed("evidence:typed-jsdoc-param"),
        target: {
          source: fileUrl("packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts"),
          selector: {
            kind: "text-quote",
            exact: 'JSDocTagDefinition.make("param", {',
          },
        },
        note: "Typed JSDoc metadata anchor for @param.",
      },
      {
        id: seed("evidence:docgen-required-tags"),
        target: {
          source: fileUrl("packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts"),
          selector: {
            kind: "text-quote",
            exact: 'const REQUIRED_TAGS = ["@category", "@example", "@since"] as const;',
          },
        },
        note: "Current docgen analysis evidence for required public-export tags.",
      },
    ],
    truncated: false,
  };

  const capabilityAudit = [
    "# Documentation Rule Capability Audit",
    "",
    `Generated: ${generatedAt}`,
    "",
    "| Rule | Classification | Current support surface | Evidence |",
    "| --- | --- | --- | --- |",
    ...ruleSeeds.map((rule) => {
      const status = supportStatuses.find((entry) => entry.id === rule.supportStatus)?.label ?? rule.supportStatus;
      const tools = rule.tools
        .map((toolId) => validationTools.find((entry) => entry.id === toolId)?.label ?? toolId)
        .join(", ");
      const evidenceSummary = rule.sources
        .map((sourceId) => sourceAuthorities.find((entry) => entry.id === sourceId)?.location ?? sourceId)
        .join("<br/>");

      return `| ${rule.label} | ${status} | ${tools} | ${evidenceSummary} |`;
    }),
    "",
    "## Classification Notes",
    "",
    "- `supported now` means the repo already has direct runtime or analysis checks for the rule.",
    "- `possible with glue` means the ontology can model the rule today, but enforcement needs an external validator or semantic rule engine.",
    "- `not realistically supported today` is reserved for semantics that do not fit the current ontology feature without disproportionate custom work.",
  ].join("\n");

  const sourceAuthorityMatrix = [
    "# Source Authority Matrix",
    "",
    `Generated: ${generatedAt}`,
    "",
    "| Source authority | Role | Authoritative for | Not authoritative for | Evidence path |",
    "| --- | --- | --- | --- | --- |",
    "| Typed JSDoc models | Structural source | tag catalog, standards, AST applicability, derivability, parameter shape metadata | repo policy semantics and runtime enforcement | `packages/tooling/library/repo-utils/src/JSDoc/` |",
    "| Repo JSDoc policy pattern | Normative policy source | documentation requirements, prohibitions, Effect-specific guidance, example compilation expectations | raw mechanical tag inventory | `.patterns/jsdoc-documentation.md` |",
    "| Docgen checker | Current runtime validator | missing description, example presence, missing @since | semantic rules like Effect @throws prohibition | `packages/tooling/tool/docgen/src/Checker.ts` |",
    "| Docgen analysis operations | Current report/enforcement surface | required public-export tags such as @category, @example, @since | semantic interpretation of function contracts | `packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts` |",
    "| Docgen domain models | Artifact vocabulary source | docgen entities, doc records, module/fileoverview surfaces | policy semantics and rule precedence | `packages/tooling/tool/docgen/src/Domain.ts` |",
    "| Repo utils symbol model | Retrieval bridge source | deterministic TypeScript symbol kinds for retrieval and grounding | documentation-specific rule semantics | `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts` |",
    "",
    "The seed layer uses split authority intentionally: structural tag facts come from the typed JSDoc models, normative rules come from the repo policy document, and current enforcement claims only come from the existing docgen toolchain.",
  ].join("\n");

  const manifest = {
    spec: "trustgraph-doc-ontology",
    status: "artifact-complete",
    stage: "artifact-complete-research-precedent",
    created: createdDate,
    updated: "2026-07-14",
    generatedAt,
    currentSourceOfTruth: "SPEC.md",
    outputs: [
      "history/outputs/beep-effect-documentation-ontology.json",
      "history/outputs/beep-effect-documentation-ontology.ttl",
      "history/outputs/beep-effect-documentation-tag-scaffold.json",
      "history/outputs/beep-effect-documentation-seed.dataset.json",
      "history/outputs/beep-effect-documentation-seed.nq",
      "history/outputs/beep-effect-documentation-seed.provenance.json",
      "history/outputs/beep-effect-documentation-seed.evidence.json",
      "history/outputs/beep-effect-documentation-shapes.json",
      "history/outputs/beep-effect-documentation-capability-audit.md",
      "history/outputs/source-authority-matrix.md",
    ],
    rerun: {
      build: "bun goals/trustgraph-doc-ontology/scripts/build-artifacts.ts",
      verify: "bun goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts",
    },
    probe: {
      ontologyKey: probeOntologyKey,
      status: "wont-do",
      notes:
        "No TrustGraph instance is running; retain the locally verified artifact set without a live config round-trip.",
    },
    counts: scaffold.counts,
    keyDecisions: [
      "Use TrustGraph native ontology JSON for the TBox artifact.",
      "Use repo-scoped URNs for ontology and seed identifiers.",
      "Keep rule instances outside the ontology JSON and model them in companion seed data.",
      "Use documentation-symbol-kind as an explicit bridge instead of collapsing to AST or docgen raw kinds.",
      "Treat SHACL as structural validation only; semantic and procedural rules stay external.",
    ],
  };

  const ontologyTurtle = formatOntologyTurtle(ontology);

  const decodedShapes = S.decodeUnknownSync(S.Array(ShaclNodeShape))(shapes);
  const decodedProvenance = S.decodeUnknownSync(ProvBundle)(provenance);
  const decodedEvidence = S.decodeUnknownSync(BoundedEvidenceProjection)(evidence);
  const encodedDataset = S.encodeSync(Dataset)(seedDataset);
  const encodedShapes = S.encodeSync(S.Array(ShaclNodeShape))(decodedShapes);
  const encodedProvenance = S.encodeSync(ProvBundle)(decodedProvenance);
  const encodedEvidence = S.encodeSync(BoundedEvidenceProjection)(decodedEvidence);

  await writeJson("beep-effect-documentation-ontology.json", ontology);
  await writeText("beep-effect-documentation-ontology.ttl", ontologyTurtle);
  await writeJson("beep-effect-documentation-tag-scaffold.json", scaffold);
  await writeJson("beep-effect-documentation-seed.dataset.json", encodedDataset);
  await writeText("beep-effect-documentation-seed.nq", sortedSeedQuads.map(serializeQuad).join("\n"));
  await writeJson("beep-effect-documentation-seed.provenance.json", encodedProvenance);
  await writeJson("beep-effect-documentation-seed.evidence.json", encodedEvidence);
  await writeJson("beep-effect-documentation-shapes.json", encodedShapes);
  await writeText("beep-effect-documentation-capability-audit.md", capabilityAudit);
  await writeText("source-authority-matrix.md", sourceAuthorityMatrix);
  await writeOpsJson("manifest.json", manifest);

  console.log(
    [
      "Built TrustGraph documentation ontology artifacts.",
      `- ontology classes: ${Object.keys(ontology.classes).length}`,
      `- object properties: ${Object.keys(ontology.objectProperties).length}`,
      `- datatype properties: ${Object.keys(ontology.datatypeProperties).length}`,
      `- scaffolded tag catalog: ${jsDocTagNames.length}`,
      `- seed quads: ${seedDataset.quads.length}`,
      `- shapes: ${shapes.length}`,
      `- probe ontology key: ${probeOntologyKey}`,
    ].join("\n")
  );
};

await run();
