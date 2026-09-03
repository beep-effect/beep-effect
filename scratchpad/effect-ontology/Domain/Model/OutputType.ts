/**
 * Extraction-run output artifact taxonomy and metadata.
 *
 * **Details**
 *
 * * The output kind is the source of truth for its stable filename and
 * human-readable description. Consumers use schema-owned statics instead of
 * maintaining parallel filename helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import type { FastCheck } from "effect/testing";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/OutputType");

const OutputTypeDefinition = LiteralKit({
  literals: [
    "knowledge-graph",
    "entity-resolution-graph",
    "rdf-turtle",
    "rdf-jsonld",
    "mermaid-diagram",
    "metadata",
    "entities",
    "relations",
  ],
  enumMapping: [
    ["knowledge-graph", "knowledgeGraph"],
    ["entity-resolution-graph", "entityResolutionGraph"],
    ["rdf-turtle", "rdfTurtle"],
    ["rdf-jsonld", "rdfJsonld"],
    ["mermaid-diagram", "mermaidDiagram"],
    ["metadata", "metadata"],
    ["entities", "entities"],
    ["relations", "relations"],
  ],
})
  .annotate({
    toArbitrary: () => (fc: typeof FastCheck) =>
      fc.constantFrom(
        "knowledge-graph",
        "entity-resolution-graph",
        "rdf-turtle",
        "rdf-jsonld",
        "mermaid-diagram",
        "metadata",
        "entities",
        "relations"
      ),
  })
  .pipe(
    $I.annoteSchema("OutputType", {
      description: "Finite set of artifacts produced by an ontology extraction run.",
    })
  );

type OutputTypeValue = typeof OutputTypeDefinition.Type;

/**
 * Stable persisted filename for an extraction-run artifact.
 *
 * **Example** (Use OutputFilename)
 * ```ts
 * import { OutputFilename } from "@effect-ontology/Model/OutputType"
 *
 * console.log(OutputFilename.is.graphJsonld("graph.jsonld")) // true
 * console.log(OutputFilename.is.graphJsonld("arbitrary.txt")) // false
 * ```
 *
 * @invariant Belongs to the exact filename set assigned by {@link OutputType}.
 * @category value-objects
 * @since 0.0.0
 */
export const OutputFilename = LiteralKit({
  literals: [
    "knowledge-graph.json",
    "entity-resolution-graph.json",
    "graph.ttl",
    "graph.jsonld",
    "erg-diagram.md",
    "metadata.json",
    "entities.json",
    "relations.json",
  ],
  enumMapping: [
    ["knowledge-graph.json", "knowledgeGraph"],
    ["entity-resolution-graph.json", "entityResolutionGraph"],
    ["graph.ttl", "graphTurtle"],
    ["graph.jsonld", "graphJsonld"],
    ["erg-diagram.md", "mermaidDiagram"],
    ["metadata.json", "metadata"],
    ["entities.json", "entities"],
    ["relations.json", "relations"],
  ],
})
  .annotate({
    toArbitrary: () => (fc: typeof FastCheck) =>
      fc.constantFrom(
        "knowledge-graph.json",
        "entity-resolution-graph.json",
        "graph.ttl",
        "graph.jsonld",
        "erg-diagram.md",
        "metadata.json",
        "entities.json",
        "relations.json"
      ),
  })
  .pipe(
    $I.annoteSchema("OutputFilename", {
      description: "Stable persisted filename assigned to an extraction-run output artifact.",
    })
  );

/**
 * Runtime value decoded by {@link OutputFilename}. {@inheritDoc OutputFilename}
 *
 * **Example** (Use OutputFilename)
 * ```ts
 * import { OutputFilename, type OutputFilename as OutputFilenameValue } from "@effect-ontology/Model/OutputType"
 *
 * const filename: OutputFilenameValue = OutputFilename.Enum.graphJsonld
 * console.log(filename) // "graph.jsonld"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OutputFilename = typeof OutputFilename.Type;

const outputTypeRegistry = {
  "knowledge-graph": {
    filename: "knowledge-graph.json",
    description: "Extracted entities and relations in JSON format.",
  },
  "entity-resolution-graph": {
    filename: "entity-resolution-graph.json",
    description: "Entity-resolution graph with canonical mappings and statistics.",
  },
  "rdf-turtle": {
    filename: "graph.ttl",
    description: "RDF graph serialized as Turtle.",
  },
  "rdf-jsonld": {
    filename: "graph.jsonld",
    description: "RDF graph serialized as JSON-LD.",
  },
  "mermaid-diagram": {
    filename: "erg-diagram.md",
    description: "Mermaid visualization of the entity-resolution graph.",
  },
  metadata: {
    filename: "metadata.json",
    description: "Output metadata containing hashes, sizes, and media types.",
  },
  entities: {
    filename: "entities.json",
    description: "Extracted entities in JSON format.",
  },
  relations: {
    filename: "relations.json",
    description: "Extracted relations in JSON format.",
  },
} satisfies Readonly<
  Record<
    OutputTypeValue,
    {
      readonly filename: OutputFilename;
      readonly description: string;
    }
  >
>;

/**
 * Finite kind of artifact produced by an extraction run.
 *
 * **Details**
 *
 * * `filename`, `description`, and `metadata` are total because the registry is
 * checked against the complete literal domain at compile time.
 *
 * **Example** (Use OutputType)
 * ```ts
 * import { OutputType } from "@effect-ontology/Model/OutputType"
 *
 * console.log(OutputType.filename("knowledge-graph")) // "knowledge-graph.json"
 * console.log(OutputType.is.rdfTurtle("rdf-turtle")) // true
 * ```
 *
 * @invariant Every output type has exactly one stable filename and
 * human-readable description.
 * @category value-objects
 * @since 0.0.0
 */
export const OutputType = OutputTypeDefinition.pipe(
  SchemaUtils.withStatics(() => ({
    filename: (type: OutputTypeValue): OutputFilename => outputTypeRegistry[type].filename,
    description: (type: OutputTypeValue) => outputTypeRegistry[type].description,
    metadata: (type: OutputTypeValue) => outputTypeRegistry[type],
  }))
);

/**
 * Runtime value decoded by {@link OutputType}. {@inheritDoc OutputType}
 *
 * **Example** (Use OutputType)
 * ```ts
 * import { OutputType, type OutputType as OutputTypeValue } from "@effect-ontology/Model/OutputType"
 *
 * const output: OutputTypeValue = OutputType.Enum.knowledgeGraph
 * console.log(output) // "knowledge-graph"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OutputType = typeof OutputType.Type;

/**
 * Complete output metadata registry keyed by {@link OutputType}.
 *
 * **Details**
 *
 * * The object is exported for compatibility and enumeration. Point lookups
 * should normally use the schema-owned `OutputType.metadata` static.
 *
 * **Example** (Use OutputTypeRegistry)
 * ```ts
 * import { OutputTypeRegistry } from "@effect-ontology/Model/OutputType"
 *
 * console.log(OutputTypeRegistry["rdf-turtle"].filename) // "graph.ttl"
 * ```
 *
 * @invariant Its keys are exactly the values accepted by {@link OutputType}.
 * @category constants
 * @since 0.0.0
 */
export const OutputTypeRegistry = outputTypeRegistry;
