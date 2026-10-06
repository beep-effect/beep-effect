/**
 * Collect custom annotations across an Effect Schema AST.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Equivalence, Match } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import type * as S from "effect/Schema";
import type * as SchemaAST from "effect/SchemaAST";

type AnnotationBag = {
  readonly [key: string]: unknown;
};

const collect = (schema: S.Top, key: string): ReadonlyArray<unknown> => {
  const containsAst = A.containsWith(Equivalence.strictEqual<SchemaAST.AST>());
  const containsCheck = A.containsWith(Equivalence.strictEqual<SchemaAST.Check<unknown>>());
  let visited = A.empty<SchemaAST.AST>();
  let annotations = A.empty<unknown>();

  const collectFrom = (bag: AnnotationBag | undefined): void => {
    const annotation = bag?.[key];
    if (annotation !== undefined) {
      annotations = A.append(annotations, annotation);
    }
  };

  const visitChecks = (checks: ReadonlyArray<SchemaAST.Check<unknown>>): void => {
    let visitedChecks = A.empty<SchemaAST.Check<unknown>>();

    const visitCheck = (check: SchemaAST.Check<unknown>): void => {
      if (containsCheck(visitedChecks, check)) {
        return;
      }

      visitedChecks = A.append(visitedChecks, check);
      collectFrom(check.annotations);
      if (check._tag === "FilterGroup") {
        A.forEach(check.checks, visitCheck);
      }
    };

    A.forEach(checks, visitCheck);
  };

  const visit = (ast: SchemaAST.AST): void => {
    if (containsAst(visited, ast)) {
      return;
    }

    visited = A.append(visited, ast);

    collectFrom(ast.annotations);
    visitChecks(ast.checks ?? A.empty());
    collectFrom(ast.context?.annotations);

    visitChildren(ast, visit);
  };

  visit(schema.ast);
  return annotations;
};

const pipeAstArrays = (ast: SchemaAST.Arrays, visit: (ast: SchemaAST.AST) => void): void => {
  A.forEach(ast.elements, visit);
  A.forEach(ast.rest, visit);
};

const pipeAstObjects = (ast: SchemaAST.Objects, visit: (ast: SchemaAST.AST) => void): void => {
  A.forEach(ast.propertySignatures, (property) => visit(property.type));
  A.forEach(ast.indexSignatures, (index) => {
    visit(index.parameter);
    visit(index.type);
  });
};

const visitStructure = (ast: SchemaAST.AST, visit: (ast: SchemaAST.AST) => void): void =>
  Match.typeTags<SchemaAST.AST, void>()({
    Declaration: ({ typeParameters }) => A.forEach(typeParameters, visit),
    Null: () => undefined,
    Undefined: () => undefined,
    Void: () => undefined,
    Never: () => undefined,
    Unknown: () => undefined,
    Any: () => undefined,
    String: () => undefined,
    Number: () => undefined,
    Boolean: () => undefined,
    BigInt: () => undefined,
    Symbol: () => undefined,
    Literal: () => undefined,
    UniqueSymbol: () => undefined,
    ObjectKeyword: () => undefined,
    Enum: () => undefined,
    TemplateLiteral: ({ parts }) => A.forEach(parts, visit),
    Arrays: (arrays) => pipeAstArrays(arrays, visit),
    Objects: (objects) => pipeAstObjects(objects, visit),
    Union: ({ types }) => A.forEach(types, visit),
    Suspend: ({ thunk }) => visit(thunk()),
  })(ast);

// Structural children first, then the targets of every encoding link.
const visitChildren = (ast: SchemaAST.AST, visit: (ast: SchemaAST.AST) => void): void => {
  visitStructure(ast, visit);
  if (ast.encoding !== undefined) {
    A.forEach(ast.encoding, (link) => visit(link.to));
  }
};

/**
 * Visits the direct structural children and encoding targets of one schema AST node.
 *
 * **Details**
 *
 * Children are visited in declaration order: declaration type parameters,
 * template parts, tuple elements then rest elements, property types then index
 * signatures, union members, and the evaluated thunk of a suspended schema,
 * followed by the target of each encoding link.
 * Leaf nodes have no children. The traversal does not recurse and tracks no
 * visited set, so recursive schemas need the caller's own identity guard.
 *
 * **Example** (Collect the direct children of a struct)
 *
 * ```ts import.meta.vitest name="Collect the direct children of a struct"
 * import { visitStructuralChildren } from "@beep/schema/SchemaUtils/collectAnnotationsAt"
 * import * as S from "effect/Schema"
 * import type * as SchemaAST from "effect/SchemaAST"
 *
 * const tags: Array<SchemaAST.AST["_tag"]> = []
 * visitStructuralChildren(S.Struct({ name: S.String, age: S.Number }).ast, (child) => {
 *   tags.push(child._tag)
 * })
 *
 * tags // => ["String", "Number"]
 * ```
 *
 * Supports both call styles: `visitStructuralChildren(ast, visit)` and
 * `visitStructuralChildren(visit)(ast)`.
 *
 * @param ast - Node whose direct children are visited.
 * @param visit - Callback invoked once per direct child.
 * @throws When evaluation of a user-supplied `Suspend` thunk throws.
 * @category getters
 * @since 0.0.0
 */
export const visitStructuralChildren: {
  (visit: (ast: SchemaAST.AST) => void): (ast: SchemaAST.AST) => void;
  (ast: SchemaAST.AST, visit: (ast: SchemaAST.AST) => void): void;
} = dual(2, visitChildren);

/**
 * Collect every defined value for an annotation key across a schema AST.
 *
 * **Details**
 *
 * Traversal is deterministic and root-first. At each AST node, ordinary,
 * check-level, and property-key annotations are collected in that order.
 * Structural children retain their declaration order, followed by encoding
 * targets. A constructor default is a bare Effect rather than a schema link,
 * so it carries no AST to traverse. Recursive schemas terminate because each
 * AST identity is visited once.
 *
 * Supports both call styles:
 * - Data-last: `collectAnnotationsAt("profile")(schema)`
 * - Data-first: `collectAnnotationsAt(schema, "profile")`
 *
 * **Example** (Collect nested profile annotations)
 *
 * ```ts import.meta.vitest name="Collect nested profile annotations"
 * import { collectAnnotationsAt } from "@beep/schema/SchemaUtils/collectAnnotationsAt"
 * import * as S from "effect/Schema"
 *
 * const Child = S.String.annotate({ profile: "child" })
 * const Root = S.Array(Child).annotate({ profile: "root" })
 *
 * collectAnnotationsAt(Root, "profile") // => ["root", "child"]
 * ```
 *
 * @param schema - Schema whose public AST graph is traversed.
 * @param key - Annotation key resolved at each AST node.
 * @returns Unchecked annotation values in stable root-first traversal order.
 * @throws When evaluation of a user-supplied `Suspend` thunk throws.
 * @invariant Each AST identity and each nested check identity is traversed at most once per owning location.
 * @category getters
 * @since 0.0.0
 */
export const collectAnnotationsAt: {
  (key: string): (schema: S.Top) => ReadonlyArray<unknown>;
  (schema: S.Top, key: string): ReadonlyArray<unknown>;
} = dual(2, collect);
