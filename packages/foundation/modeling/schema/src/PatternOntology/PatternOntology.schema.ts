/**
 * Pattern Ontology (PO) content-model classification carried as a schema
 * annotation on tagged document-AST constructors.
 *
 * **Details**
 *
 * The Pattern Ontology reduces document markup to a small set of
 * content-model patterns defined by two axes (may the element contain text,
 * may it contain other elements) and by where it may appear (inside the text
 * flow of a block or inline, or only inside a container). This module cites
 * that vocabulary as a type discipline: the pattern is a named literal domain
 * written into the `po` schema annotation of every tagged AST constructor,
 * from which correspondence tables and conservation checks are derived.
 * It is never an RDF vocabulary module.
 *
 * @see {@link http://www.essepuntato.it/2008/12/pattern | Pattern Ontology} for the cited pattern definitions.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { MutableHashSet, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { LiteralKit } from "../LiteralKit/index.ts";
import { visitStructuralChildren } from "../SchemaUtils/collectAnnotationsAt.ts";

const $I = $SchemaId.create("PatternOntology");

/**
 * The Pattern Ontology content-model patterns a tagged constructor may carry.
 *
 * **Details**
 *
 * Eight core patterns come from the two PO axes; `headedContainer`, `record`,
 * and `table` are the container specializations PO defines for containers
 * that open with head blocks, hold heterogeneous children, or hold
 * homogeneous children.
 *
 * **Example** (Guard a pattern literal)
 *
 * ```ts import.meta.vitest name="Guard a pattern literal"
 * import { PoPattern } from "@beep/schema/PatternOntology"
 *
 * PoPattern.is.block("block") // => true
 * PoPattern.is.block("inline") // => false
 * ```
 *
 * @see {@link poPatternAxes} for the axis values each pattern denotes.
 * @category models
 * @since 0.0.0
 */
export const PoPattern = LiteralKit([
  "atom",
  "field",
  "inline",
  "block",
  "milestone",
  "meta",
  "popup",
  "container",
  "headedContainer",
  "record",
  "table",
]).pipe(
  $I.annoteSchema("PoPattern", {
    description: "Pattern Ontology content-model pattern carried by a tagged document-AST constructor.",
  })
);

/**
 * Runtime type for {@link PoPattern}.
 *
 * **Example** (Type a pattern value)
 *
 * ```ts import.meta.vitest name="Type a pattern value"
 * import type { PoPattern } from "@beep/schema/PatternOntology"
 *
 * const pattern: PoPattern = "atom"
 * pattern // => "atom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PoPattern = typeof PoPattern.Type;

/**
 * Where a pattern may appear: inside the text flow or only inside a container.
 *
 * **Example** (Guard a containment literal)
 *
 * ```ts import.meta.vitest name="Guard a containment literal"
 * import { PoContainment } from "@beep/schema/PatternOntology"
 *
 * PoContainment.is.flow("flow") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PoContainment = LiteralKit(["flow", "container"]).pipe(
  $I.annoteSchema("PoContainment", {
    description: "Whether a Pattern Ontology pattern lives in the text flow or only inside a container.",
  })
);

/**
 * Runtime type for {@link PoContainment}.
 *
 * @category models
 * @since 0.0.0
 */
export type PoContainment = typeof PoContainment.Type;

/**
 * The two PO content axes plus containment for one pattern.
 *
 * **Example** (Read the axes of a block)
 *
 * ```ts import.meta.vitest name="Read the axes of a block"
 * import { poPatternAxes } from "@beep/schema/PatternOntology"
 *
 * const axes = poPatternAxes("block")
 * axes.textual // => true
 * axes.structured // => true
 * axes.containedIn // => "container"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PoPatternAxes extends S.Class<PoPatternAxes>($I`PoPatternAxes`)(
  {
    textual: S.Boolean.annotateKey({ description: "Whether the pattern may contain text." }),
    structured: S.Boolean.annotateKey({ description: "Whether the pattern may contain other elements." }),
    containedIn: PoContainment.annotateKey({ description: "Where the pattern may appear." }),
  },
  $I.annote("PoPatternAxes", {
    description: "Pattern Ontology content axes and containment for one pattern.",
  })
) {}

const axes = (textual: boolean, structured: boolean, containedIn: PoContainment) => () =>
  PoPatternAxes.make({ textual, structured, containedIn });

const flat = (textual: boolean, containedIn: PoContainment) => axes(textual, false, containedIn);
const structured = (textual: boolean, containedIn: PoContainment) => axes(textual, true, containedIn);
const containerAxes = structured(false, "container");

/**
 * Resolves the PO axes a pattern denotes.
 *
 * **Example** (Milestones are empty flow markers)
 *
 * ```ts import.meta.vitest name="Milestones are empty flow markers"
 * import { poPatternAxes } from "@beep/schema/PatternOntology"
 *
 * const axes = poPatternAxes("milestone")
 * axes.textual // => false
 * axes.structured // => false
 * axes.containedIn // => "flow"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const poPatternAxes: (pattern: PoPattern) => PoPatternAxes = PoPattern.$match({
  atom: flat(true, "flow"),
  field: flat(true, "container"),
  inline: structured(true, "flow"),
  block: structured(true, "container"),
  milestone: flat(false, "flow"),
  meta: flat(false, "container"),
  popup: structured(false, "flow"),
  container: containerAxes,
  headedContainer: containerAxes,
  record: containerAxes,
  table: containerAxes,
});

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly po?: PoPattern | undefined;
    }
  }
}

const isPoPattern = S.is(PoPattern);

/**
 * Reads the `po` annotation written on a schema's own AST node.
 *
 * **Details**
 *
 * The pattern is read from the schema's root annotations only; use
 * {@link collectPoTaggedConstructors} to inspect every tagged constructor
 * reachable from a root schema.
 *
 * **Example** (Read a stamped pattern)
 *
 * ```ts import.meta.vitest name="Read a stamped pattern"
 * import { getPoPattern } from "@beep/schema/PatternOntology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * O.getOrNull(getPoPattern(S.String.annotate({ po: "atom" }))) // => "atom"
 * O.isNone(getPoPattern(S.String)) // => true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getPoPattern = (schema: S.Top): O.Option<PoPattern> => poPatternAt(schema.ast.annotations);

const poPatternAt = (annotations: S.Annotations.Annotations | undefined): O.Option<PoPattern> =>
  pipe(O.fromUndefinedOr(annotations?.po), O.filter(isPoPattern));

/**
 * One tagged constructor found while walking a schema graph.
 *
 * **Example** (Inspect a collected constructor)
 *
 * ```ts import.meta.vitest name="Inspect a collected constructor"
 * import { collectPoTaggedConstructors } from "@beep/schema/PatternOntology"
 * import * as S from "effect/Schema"
 *
 * const Leaf = S.TaggedStruct("leaf", { value: S.String }).annotate({ po: "atom" })
 * const [row] = collectPoTaggedConstructors(S.Array(Leaf), "_tag")
 * row?.tag // => "leaf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PoTaggedConstructor extends S.Class<PoTaggedConstructor>($I`PoTaggedConstructor`)(
  {
    tag: S.String.annotateKey({ description: "Discriminant literal of the constructor." }),
    identifier: S.Option(S.String).annotateKey({
      description: "Schema identifier annotation when the constructor carries one.",
    }),
    pattern: S.Option(PoPattern).annotateKey({
      description: "The `po` annotation when present and valid.",
    }),
  },
  $I.annote("PoTaggedConstructor", {
    description: "A tagged constructor discovered in a schema graph with its PO annotation.",
  })
) {}

// The discriminant of a struct is a required literal property named `tagKey`;
// a class declaration carries its field struct as its first type parameter.
const objectsTagLiteral = (ast: SchemaAST.Objects, tagKey: PropertyKey): O.Option<string> =>
  pipe(
    A.findFirst(ast.propertySignatures, (property) => property.name === tagKey),
    O.map((property) => property.type),
    O.filter(SchemaAST.isLiteral),
    O.map((literal) => String(literal.literal))
  );

const tagLiteral = (ast: SchemaAST.AST, tagKey: PropertyKey): O.Option<string> =>
  SchemaAST.isObjects(ast)
    ? objectsTagLiteral(ast, tagKey)
    : SchemaAST.isDeclaration(ast)
      ? pipe(
          A.head(ast.typeParameters),
          O.filter(SchemaAST.isObjects),
          O.flatMap((fields) => objectsTagLiteral(fields, tagKey))
        )
      : O.none();

const identifierAt = (annotations: S.Annotations.Annotations | undefined): O.Option<string> =>
  pipe(O.fromUndefinedOr(annotations?.identifier), O.filter(S.is(S.String)));

const collectTagged = (schema: S.Top, tagKey: PropertyKey): ReadonlyArray<PoTaggedConstructor> => {
  const visited = MutableHashSet.empty<SchemaAST.AST>();
  const recorded = MutableHashSet.empty<string>();
  let rows = A.empty<PoTaggedConstructor>();

  // Type-only projections (`S.toType`, checks, brands) clone an AST, so one
  // constructor can surface under several identities. Collapse those copies
  // by identifier, tag, and pattern; a copy whose pattern disagrees stays
  // visible so the inconsistency is reported rather than hidden.
  const record = (ast: SchemaAST.AST): void =>
    O.match(tagLiteral(ast, tagKey), {
      onNone: () => undefined,
      onSome: (tag) => {
        const row = PoTaggedConstructor.make({
          tag,
          identifier: identifierAt(ast.annotations),
          pattern: poPatternAt(ast.annotations),
        });
        const key = `${O.getOrElse(row.identifier, () => "")}|${tag}|${O.getOrElse(row.pattern, () => "")}`;
        if (!MutableHashSet.has(recorded, key)) {
          MutableHashSet.add(recorded, key);
          rows = A.append(rows, row);
        }
      },
    });

  // A class declaration wraps its field struct as its first type parameter and
  // carries the constructor's annotations itself. Mark that struct so it is
  // traversed for its field types without being recorded a second time.
  const fieldStructs = MutableHashSet.empty<SchemaAST.AST>();

  const visit = (ast: SchemaAST.AST): void => {
    if (MutableHashSet.has(visited, ast)) {
      return;
    }
    MutableHashSet.add(visited, ast);

    if (SchemaAST.isDeclaration(ast)) {
      A.forEach(A.filter(ast.typeParameters, SchemaAST.isObjects), (fields) =>
        MutableHashSet.add(fieldStructs, fields)
      );
    }
    if (!MutableHashSet.has(fieldStructs, ast)) {
      record(ast);
    }

    visitStructuralChildren(ast, visit);
  };

  visit(schema.ast);
  return rows;
};

/**
 * Collects every tagged constructor reachable from a schema with its PO annotation.
 *
 * **Details**
 *
 * A constructor is any class declaration or struct whose field named `tagKey`
 * is a literal sentinel. Traversal is deterministic and root-first, follows
 * suspended thunks once per AST identity, and records a class declaration once
 * even though its field struct carries the same sentinel. Exhaustiveness proofs
 * walk a package's root document schema and require `pattern` to be present on
 * every row, so a constructor added anywhere in the reachable graph without a
 * `po` annotation fails the proof.
 *
 * **Example** (Find an unannotated constructor)
 *
 * ```ts import.meta.vitest name="Find an unannotated constructor"
 * import { collectPoTaggedConstructors } from "@beep/schema/PatternOntology"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const Leaf = S.TaggedStruct("leaf", { value: S.String }).annotate({ po: "atom" })
 * const Bare = S.TaggedStruct("bare", {})
 * const rows = collectPoTaggedConstructors(S.Union([Leaf, Bare]), "_tag")
 *
 * A.map(rows, (row) => row.tag) // => ["leaf", "bare"]
 * A.map(rows, (row) => O.isSome(row.pattern)) // => [true, false]
 * ```
 *
 * @param schema - Root schema whose public AST graph is traversed.
 * @param tagKey - Discriminant field name, such as `"_tag"` or `"type"`.
 * @returns Every tagged constructor in root-first order with its `po` annotation.
 * @invariant Each constructor identifier, tag, and pattern triple is recorded at most once.
 * @category getters
 * @since 0.0.0
 */
export const collectPoTaggedConstructors: {
  (tagKey: PropertyKey): (schema: S.Top) => ReadonlyArray<PoTaggedConstructor>;
  (schema: S.Top, tagKey: PropertyKey): ReadonlyArray<PoTaggedConstructor>;
} = dual(2, collectTagged);

/**
 * Outcome of carrying a pattern across a mapping.
 *
 * **Details**
 *
 * The conservation law for every AST mapping is "pattern preserved or
 * explicitly demoted, never silently": a `demoted` transition must coincide
 * with an existing mapping diagnostic or a documented lossiness entry.
 *
 * **Example** (Classify a transition)
 *
 * ```ts import.meta.vitest name="Classify a transition"
 * import { poConservation } from "@beep/schema/PatternOntology"
 *
 * poConservation("block", "block") // => "preserved"
 * poConservation("container", "block") // => "demoted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PoConservation = LiteralKit(["preserved", "demoted"]).pipe(
  $I.annoteSchema("PoConservation", {
    description: "Whether a mapping preserved a constructor's Pattern Ontology pattern or demoted it.",
  })
);

/**
 * Runtime type for {@link PoConservation}.
 *
 * @category models
 * @since 0.0.0
 */
export type PoConservation = typeof PoConservation.Type;

/**
 * Classifies a source-to-target pattern transition.
 *
 * **Example** (Same pattern is preserved)
 *
 * ```ts import.meta.vitest name="Same pattern is preserved"
 * import { poConservation } from "@beep/schema/PatternOntology"
 *
 * poConservation("atom", "atom") // => "preserved"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const poConservation: {
  (target: PoPattern): (source: PoPattern) => PoConservation;
  (source: PoPattern, target: PoPattern): PoConservation;
} = dual(
  2,
  (source: PoPattern, target: PoPattern): PoConservation =>
    source === target ? PoConservation.Enum.preserved : PoConservation.Enum.demoted
);
