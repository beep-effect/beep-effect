/**
 * Shared ts-morph expression, signature, and type predicates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, pipe, Str } from "@beep/utils";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { Node } from "ts-morph";
import type {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  ParameterDeclaration,
  Signature,
  Type,
} from "ts-morph";

const DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN =
  /\bEffect\.Effect\b|\bEffect<|\bS\.Schema\b|\bSchema\.Schema\b|\bSchema<|\bPromise\b/iu;

/**
 * Function-like declarations that own parameter lists for helper analysis.
 *
 * @example
 * ```ts
 * import type { ParameterOwner } from "@beep/repo-cli/internal/tsmorph"
 *
 * type Owner = ParameterOwner
 * console.log("ParameterOwner")
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ParameterOwner = ArrowFunction | FunctionDeclaration | FunctionExpression | MethodDeclaration;

/**
 * Parse a numeric literal node into an integer option.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, parseNumericLiteral } from "@beep/repo-cli/internal/tsmorph"
 * import * as O from "effect/Option"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "const value = 2")
 * const literal = source.getVariableDeclarationOrThrow("value").getInitializerOrThrow()
 * console.log(O.getOrUndefined(parseNumericLiteral(literal)))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const parseNumericLiteral = (node: Node): O.Option<number> =>
  Node.isNumericLiteral(node) ? O.some(Number.parseInt(node.getText(), 10)) : O.none();

/**
 * Remove syntactic wrappers that do not change the runtime expression.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, unwrapExpression } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "const value = ((1))")
 * const expression = source.getVariableDeclarationOrThrow("value").getInitializerOrThrow()
 * console.log(unwrapExpression(expression).getText())
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const unwrapExpression = (node: Node): Node => {
  let current = node;
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isNonNullExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
};

/**
 * Refine a node to one of the function-like parameter owner declarations.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, isParameterOwner } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "export function f(value: string) {}")
 * console.log(isParameterOwner(source.getFunctionOrThrow("f")))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isParameterOwner = (node: Node): node is ParameterOwner =>
  Node.isArrowFunction(node) ||
  Node.isFunctionDeclaration(node) ||
  Node.isFunctionExpression(node) ||
  Node.isMethodDeclaration(node);

/**
 * Test whether a ts-morph type is primitive or primitive-like.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, isPrimitiveType } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "const value = 1")
 * console.log(isPrimitiveType(source.getVariableDeclarationOrThrow("value").getType()))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isPrimitiveType = (type: Type): boolean =>
  type.isString() ||
  type.isNumber() ||
  type.isBoolean() ||
  type.isBigInt() ||
  type.isStringLiteral() ||
  type.isNumberLiteral() ||
  type.isBooleanLiteral() ||
  type.isNull() ||
  type.isUndefined() ||
  type.isVoid();

const isOptionalTypeMarker = (type: Type): boolean => type.isUndefined() || type.isNull();

/**
 * Test whether a type is a strict object-like options/value shape.
 *
 * @remarks
 * This excludes primitives, arrays, callable values, `Effect`/`Schema`/`Promise`
 * types, and broad unknown-like types. Union and intersection members are
 * inspected recursively after dropping `null`/`undefined` optional markers.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, isStrictObjectLikeType } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "const value: { readonly enabled: boolean } = { enabled: true }")
 * console.log(isStrictObjectLikeType(source.getVariableDeclarationOrThrow("value").getType()))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isStrictObjectLikeType = (type: Type): boolean => {
  if (type.isTypeParameter()) {
    const constraint = type.getConstraint();
    return P.isNotUndefined(constraint) && isStrictObjectLikeType(constraint);
  }

  if (
    type.isAny() ||
    type.isUnknown() ||
    type.isArray() ||
    type.isReadonlyArray() ||
    type.isTuple() ||
    isPrimitiveType(type) ||
    type.getCallSignatures().length > 0
  ) {
    return false;
  }

  const typeText = type.getText();
  if (DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN.test(typeText)) {
    return false;
  }

  if (type.isUnion()) {
    const objectLikeMembers = A.filter(type.getUnionTypes(), (member) => !isOptionalTypeMarker(member));

    return !A.isReadonlyArrayEmpty(objectLikeMembers) && A.every(objectLikeMembers, isStrictObjectLikeType);
  }

  if (type.isIntersection()) {
    return A.some(type.getIntersectionTypes(), isStrictObjectLikeType);
  }

  return (
    type.isObject() ||
    type.isClassOrInterface() ||
    !A.isReadonlyArrayEmpty(type.getProperties()) ||
    P.isNotUndefined(type.getStringIndexType())
  );
};

const getParameterDeclaration = (input: {
  readonly signature: Signature;
  readonly index: number;
}): O.Option<ParameterDeclaration> =>
  pipe(
    A.get(input.signature.getParameters(), input.index),
    O.flatMap((parameter) => O.fromNullishOr(parameter.getValueDeclaration())),
    O.filter(Node.isParameterDeclaration)
  );

/**
 * Test whether a call signature represents a tagged template API.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, isTaggedTemplateSignature } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "interface Tag { (strings: TemplateStringsArray): string }")
 * const signature = source.getInterfaceOrThrow("Tag").getType().getCallSignatures()[0]
 * console.log(signature === undefined ? false : isTaggedTemplateSignature(signature))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isTaggedTemplateSignature = (signature: Signature): boolean => {
  const firstParameter = getParameterDeclaration({ signature, index: 0 });
  const firstParameterTypeText = pipe(
    firstParameter,
    O.map((parameter) => parameter.getType().getText())
  );

  return (
    O.exists(firstParameterTypeText, (typeText) => Str.includes("TemplateStringsArray")(typeText)) &&
    pipe(
      A.drop(signature.getParameters(), 1),
      A.some((parameter) =>
        pipe(
          O.fromNullishOr(parameter.getValueDeclaration()),
          O.filter(Node.isParameterDeclaration),
          O.exists((declaration) => declaration.isRestParameter())
        )
      )
    )
  );
};

/**
 * Return call signatures after excluding tagged template overloads.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, getNonTemplateCallSignatures } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "interface Helper { (value: string): string }")
 * console.log(getNonTemplateCallSignatures(source.getInterfaceOrThrow("Helper").getType()).length)
 * ```
 * @category getters
 * @since 0.0.0
 */
export const getNonTemplateCallSignatures = (type: Type): ReadonlyArray<Signature> =>
  A.filter(type.getCallSignatures(), (signature) => !isTaggedTemplateSignature(signature));
