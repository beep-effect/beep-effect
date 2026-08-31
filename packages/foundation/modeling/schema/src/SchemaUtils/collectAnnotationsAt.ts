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

    visitStructuralChildren(ast, visit);

    const constructorDefault = ast.context?.constructorDefault;
    if (constructorDefault !== undefined) {
      visit(constructorDefault.to);
    }

    if (ast.encoding !== undefined) {
      A.forEach(ast.encoding, (link) => visit(link.to));
    }
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

const visitStructuralChildren = (ast: SchemaAST.AST, visit: (ast: SchemaAST.AST) => void): void =>
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

/**
 * Collect every defined value for an annotation key across a schema AST.
 *
 * **Details**
 *
 * Traversal is deterministic and root-first. At each AST node, ordinary,
 * check-level, and property-key annotations are collected in that order.
 * Structural children retain their declaration order, followed by
 * constructor-default and encoding targets. Recursive schemas terminate
 * because each AST identity is visited once.
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
