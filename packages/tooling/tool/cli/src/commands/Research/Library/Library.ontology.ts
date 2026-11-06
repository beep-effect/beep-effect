/**
 * Generated research library ontology and validation constraints.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec } from "@beep/n3";
import { fold, toTurtle } from "@beep/ontology";
import * as Rdf from "@beep/rdf/Rdf";
import { CITO_NAMESPACE } from "@beep/rdf/Vocab/Cito";
import { DCAT_DATASET } from "@beep/rdf/Vocab/Dcat";
import { FABIO_NAMESPACE } from "@beep/rdf/Vocab/Fabio";
import * as Prov from "@beep/rdf/Vocab/Prov";
import { RDF_NAMESPACE, RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_BOOLEAN, XSD_INTEGER, XSD_NAMESPACE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { ShaclNodeShape, ShaclPropertyShape } from "@beep/semantic-web/services/shacl-validation";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as AST from "effect/SchemaAST";
import * as Str from "effect/String";
import { LibraryError } from "./Library.errors.ts";
import { LIBRARY_SHAPES_FILE, LIBRARY_TBOX_FILE } from "./Library.paths.ts";
import * as M from "./Library.schemas.ts";
import type { AssembledOntology, Triple } from "@beep/ontology";

const $I = $RepoCliId.create("commands/Research/Library/Library.schemas");
const sh = (name: string) => Rdf.makeNamedNode(`http://www.w3.org/ns/shacl#${name}`);
const nn = Rdf.makeNamedNode;

/**
 * Catalog classes admitted by the foundational audit, excluding command options.
 * **Example** (Count admitted models)
 * ```ts
 * import { libraryOntologySchemas } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(libraryOntologySchemas.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export const libraryOntologySchemas = [
  M.LibrarySource,
  M.LibrarySourceVersion,
  M.LibraryCapture,
  M.LibraryArtifact,
  M.LibraryDocument,
  M.LibraryOccurrence,
  M.LibraryFinding,
  M.LibraryDerivation,
  M.LibraryModelRun,
  M.LibraryCatalog,
  M.LibraryQualification,
  M.LibraryIntake,
  M.LibraryIntakeFile,
  M.LibraryIntakeRoot,
  M.LibraryReference,
  M.LibraryManifest,
];

/**
 * Conservative external superclass commitments from the binding audit.
 * **Example** (Inspect commitments)
 * ```ts
 * import { libraryAlignmentTriples } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(libraryAlignmentTriples.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export const libraryAlignmentTriples: ReadonlyArray<Triple> = [
  ...A.map(
    [
      M.LibrarySource,
      M.LibrarySourceVersion,
      M.LibraryCapture,
      M.LibraryArtifact,
      M.LibraryDocument,
      M.LibraryFinding,
      M.LibraryQualification,
      M.LibraryIntake,
      M.LibraryIntakeFile,
      M.LibraryIntakeRoot,
      M.LibraryReference,
      M.LibraryManifest,
    ],
    (schema): Triple => [schema, "rdfs:subClassOf", Prov.PROV_ENTITY.value]
  ),
  [M.LibraryModelRun, "rdfs:subClassOf", Prov.PROV_ACTIVITY.value],
  [M.LibraryDerivation, "rdfs:subClassOf", Prov.PROV_DERIVATION.value],
  [M.LibraryOccurrence, "rdfs:subClassOf", `${CITO_NAMESPACE}Citation`],
  [M.LibraryCatalog, "rdfs:subClassOf", DCAT_DATASET.value],
];

/**
 * Assemble class and field identities using the schema file's composer.
 * **Example** (Prepare assembly)
 * ```ts
 * import { assembleLibraryOntology } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(assembleLibraryOntology().pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const assembleLibraryOntology = Effect.fn("Library.assembleOntology")(function* () {
  return yield* fold($I, {
    label: "Research Library",
    schemas: libraryOntologySchemas,
    triples: libraryAlignmentTriples,
  });
});

const models: ReadonlyArray<S.Top & { readonly name: string; readonly fields: Readonly<Record<string, S.Top>> }> =
  libraryOntologySchemas;
const fields = A.flatMap(models, (schema) =>
  A.map(R.toEntries(schema.fields), ([key, field]) => ({ schema, key, field }))
);

const fieldAst = (name: string, key: string): AST.AST => {
  const schema = A.findFirst(
    models,
    (model) => R.has(model.fields, key) && model.name === `Library${name === "Report" ? "Document" : name}`
  );
  const field = O.flatMap(schema, (model) =>
    A.findFirst(fields, (entry) => entry.schema === model && entry.key === key)
  );
  return AST.toType(O.getOrThrow(field).field.ast);
};
const leaves = (ast: AST.AST): ReadonlyArray<AST.AST> =>
  AST.isUnion(ast) ? A.flatMap(ast.types, leaves) : AST.isArrays(ast) ? A.flatMap(ast.rest, leaves) : [ast];
const literals = (ast: AST.AST): ReadonlyArray<Rdf.Literal> =>
  A.flatMap(leaves(ast), (leaf) =>
    AST.isLiteral(leaf) && P.isString(leaf.literal) ? [Rdf.makeLiteral(leaf.literal, XSD_STRING.value)] : []
  );
const referenceClass = (name: string, key: string): O.Option<string> => {
  if (key === "sourceId") return O.some("Source");
  if (key === "documentId") return O.some("Report");
  if (key === "occurrenceId") return O.some("Occurrence");
  if (key === "findingId") return O.some("Finding");
  if (key === "modelRunId") return O.some("ModelRun");
  if (name === "Derivation" && key === "derivedId") return O.none();
  return O.none();
};

/**
 * Resolve explicit foreign keys consistently in shapes and projection.
 * **Example** (Resolve a source reference)
 * ```ts
 * import { libraryReferenceClass } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(libraryReferenceClass("Capture", "sourceId"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const libraryReferenceClass: {
  (name: string, key: string): O.Option<string>;
  (key: string): (name: string) => O.Option<string>;
} = dual(2, referenceClass);

/**
 * Derive typed shapes from decoded field ASTs and assembled predicate identities.
 * **Details**
 * Empty arrays represent zero RDF edges, so array cardinalities allow zero.
 * String foreign keys use node references; optional empty handles remain literals.
 * **Example** (Prepare shape derivation)
 * ```ts
 * import { libraryShapes } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(libraryShapes)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const libraryShapes = (assembled: AssembledOntology): ReadonlyArray<ShaclNodeShape> =>
  A.map(assembled.classes, (cls) =>
    ShaclNodeShape.make({
      id: O.some(nn(`${cls.iri}/Shape`)),
      targetClass: O.some(nn(cls.iri)),
      properties: A.map(cls.predicates, (predicate) => {
        const ast = fieldAst(cls.name, predicate.key);
        const scalar = A.head(leaves(ast));
        const ref = referenceClass(cls.name, predicate.key);
        const flexible = A.contains(
          ["findingId", "occurrenceId", "modelRunId", "intakeId", "derivedId"],
          predicate.key
        );
        return ShaclPropertyShape.make({
          path: nn(predicate.termIri),
          minCount: AST.isOptional(ast) || AST.isArrays(ast) ? O.none() : O.some(1),
          maxCount: AST.isArrays(ast) ? O.none() : O.some(1),
          class:
            predicate.kind === "object"
              ? O.map(predicate.rangeIri, nn)
              : flexible
                ? O.none()
                : O.flatMap(ref, (name) =>
                    O.map(
                      A.findFirst(assembled.classes, (c) => c.name === name),
                      (c) => nn(c.iri)
                    )
                  ),
          datatype:
            predicate.kind === "object" || O.isSome(ref) || flexible
              ? O.none()
              : O.some(
                  O.isSome(scalar) && AST.isNumber(scalar.value)
                    ? XSD_INTEGER
                    : O.isSome(scalar) && AST.isBoolean(scalar.value)
                      ? XSD_BOOLEAN
                      : XSD_STRING
                ),
        });
      }),
    })
  );

/**
 * Emit full SHACL constraints, including literal membership RDF lists.
 * **Example** (Inspect serializer)
 * ```ts
 * import { libraryShapesDataset } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(libraryShapesDataset)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const libraryShapesDataset = (shapes: ReadonlyArray<ShaclNodeShape>): Rdf.Dataset => {
  const quads: Array<Rdf.Quad> = [];
  for (const shape of shapes) {
    const node = O.getOrThrow(shape.id);
    const target = O.getOrThrow(shape.targetClass);
    quads.push(Rdf.makeQuad(node, RDF_TYPE, sh("NodeShape")), Rdf.makeQuad(node, sh("targetClass"), target));
    const name = O.getOrThrow(A.last(Str.split(target.value, "/")));
    for (const [index, property] of A.map(
      shape.properties,
      (v, i) => [i, v] satisfies readonly [number, ShaclPropertyShape]
    )) {
      const p = nn(`${node.value}/property/${index}`);
      quads.push(Rdf.makeQuad(node, sh("property"), p), Rdf.makeQuad(p, sh("path"), property.path));
      for (const [key, value] of [
        ["minCount", property.minCount],
        ["maxCount", property.maxCount],
      ] satisfies ReadonlyArray<readonly [string, O.Option<number>]>) {
        if (O.isSome(value)) quads.push(Rdf.makeQuad(p, sh(key), Rdf.makeLiteral(`${value.value}`, XSD_INTEGER.value)));
      }
      for (const [key, value] of [
        ["datatype", property.datatype],
        ["class", property.class],
      ] satisfies ReadonlyArray<readonly [string, O.Option<Rdf.NamedNode>]>) {
        if (O.isSome(value)) quads.push(Rdf.makeQuad(p, sh(key), value.value));
      }
      // The property order is the deterministic fold order, not source declaration order.
      const entry = A.findFirst(
        fields,
        (f) =>
          f.schema.name === `Library${name === "Report" ? "Document" : name}` &&
          property.path.value === `${$I.iri}/${f.key}`
      );
      if (O.isSome(entry)) {
        const members = literals(AST.toType(entry.value.field.ast));
        if (A.isReadonlyArrayNonEmpty(members)) {
          quads.push(Rdf.makeQuad(p, sh("in"), nn(`${p.value}/list/0`)));
          for (const [i, member] of A.map(members, (v, i) => [i, v] satisfies readonly [number, Rdf.Literal])) {
            const item = nn(`${p.value}/list/${i}`);
            quads.push(
              Rdf.makeQuad(item, nn(`${RDF_NAMESPACE}first`), member),
              Rdf.makeQuad(
                item,
                nn(`${RDF_NAMESPACE}rest`),
                i + 1 === members.length ? nn(`${RDF_NAMESPACE}nil`) : nn(`${p.value}/list/${i + 1}`)
              )
            );
          }
        }
      }
    }
  }
  return Rdf.makeDataset(Rdf.sortDatasetQuads(Rdf.makeDataset(quads)));
};

/**
 * Serialize deterministic shapes with the N3 codec.
 * **Example** (Inspect Turtle projection)
 * ```ts
 * import { libraryShapesTurtle } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(libraryShapesTurtle)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const libraryShapesTurtle = Effect.fn("Library.shapesTurtle")(function* (shapes: ReadonlyArray<ShaclNodeShape>) {
  const codec = yield* N3TurtleCodec;
  const prefixes = yield* S.decodeEffect(Rdf.PrefixMap)({
    sh: "http://www.w3.org/ns/shacl#",
    xsd: XSD_NAMESPACE,
    rdf: RDF_NAMESPACE,
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    prov: Prov.PROV_NAMESPACE,
    cito: CITO_NAMESPACE,
    fabio: FABIO_NAMESPACE,
    dcat: "http://www.w3.org/ns/dcat#",
    skos: "http://www.w3.org/2004/02/skos/core#",
    library: `${$I.iri}/`,
  });
  return (yield* codec.serialize(N3SerializeTurtleRequest.make({ dataset: libraryShapesDataset(shapes), prefixes })))
    .source;
});

/**
 * Atomically publish both generated ontology files and reparse the saved bytes.
 * **Example** (Prepare rendering)
 * ```ts
 * import { renderLibraryOntology } from "@beep/repo-cli/commands/Research/Library/Library.ontology"
 * console.log(renderLibraryOntology("/library").pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const renderLibraryOntology = Effect.fn("Library.renderOntology")(
  function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const codec = yield* N3TurtleCodec;
    const assembled = yield* assembleLibraryOntology();
    const shapes = yield* libraryShapesTurtle(libraryShapes(assembled));
    const tbox = toTurtle(assembled);
    const write = Effect.fn("Library.writeOntology")(function* (target: string, source: string) {
      const absolute = path.join(root, target);
      const realRoot = yield* fs.realPath(root);
      let ancestor = path.dirname(absolute);
      while (!(yield* fs.exists(ancestor))) ancestor = path.dirname(ancestor);
      const resolved = yield* fs.realPath(ancestor);
      const relative = path.relative(realRoot, resolved);
      if (path.isAbsolute(relative) || relative === ".." || Str.startsWith(`..${path.sep}`)(relative))
        return yield* LibraryError.make({ message: "Ontology directory escapes library", cause: target });
      yield* fs.makeDirectory(path.dirname(absolute), { recursive: true });
      const publish = Effect.fnUntraced(function* () {
        const temporary = yield* fs.makeTempFileScoped({
          directory: path.dirname(absolute),
          prefix: ".library-ontology-",
        });
        yield* fs.writeFileString(temporary, source);
        yield* fs.rename(temporary, absolute);
      });
      yield* Effect.scoped(publish());
      const saved = yield* fs.readFileString(absolute);
      return (yield* codec.parse(N3ParseTurtleRequest.make({ source: saved }))).dataset.quads.length;
    });
    const tboxCount = yield* write(LIBRARY_TBOX_FILE, tbox);
    const shapesCount = yield* write(LIBRARY_SHAPES_FILE, shapes);
    yield* Console.log(`ontology: tbox=${tboxCount} shapes=${shapesCount} triples`);
    return { tboxCount, shapesCount };
  },
  Effect.mapError((cause) => LibraryError.make({ message: "Cannot render library ontology", cause }))
);
