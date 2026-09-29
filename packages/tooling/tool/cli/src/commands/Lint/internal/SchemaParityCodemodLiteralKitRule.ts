/**
 * The `literal-kit-facets` codemod rule: rewrites reads of the LiteralKit
 * facets that upstream `effect/Schema` now covers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { HashSet, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import {
  SchemaParityCodemodEdit,
  SchemaParityCodemodImport,
  SchemaParityCodemodResidue,
  SchemaParityCodemodRule,
  SchemaParityCodemodRulePlan,
  SchemaParityCodemodSite,
} from "./SchemaParityCodemod.schemas.ts";
import { renderSchemaParityCodemodEdits } from "./SchemaParityCodemodEdits.ts";
import { schemaParityCodemodValueImports } from "./SchemaParityCodemodImports.ts";
import type {
  Expression,
  Identifier,
  ImportDeclaration,
  PropertyAccessExpression,
  SourceFile,
  Type,
  VariableDeclaration,
} from "ts-morph";
import type { SchemaParityCodemodRuleContext } from "./SchemaParityCodemod.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemodLiteralKitRule");

const RULE_ID = "literal-kit-facets" as const;

/**
 * LiteralKit facets retired by the P2 trim of `goals/effect-schema-parity`.
 *
 * **Details**
 *
 * `Options` becomes `.literals`, `pickOptions` becomes `.pick(...).literals`,
 * `omitOptions` becomes a `.pick` of the complement, `HashSet` becomes a
 * call-site `HashSet.fromIterable(X.literals)` and `thunk.k` becomes
 * `F.constant(X.Enum.k)`.
 *
 * **Example** (Check a retired facet name)
 *
 * ```ts
 * import { LiteralKitRetiredFacet } from "@beep/repo-cli/test/Lint"
 *
 * console.log(LiteralKitRetiredFacet.is.Options("Options")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LiteralKitRetiredFacet = LiteralKit(["Options", "pickOptions", "omitOptions", "HashSet", "thunk"]).pipe(
  $I.annoteSchema("LiteralKitRetiredFacet", {
    description: "LiteralKit facet retired in favor of an upstream effect/Schema or effect member.",
  })
);

/**
 * LiteralKit facet retired in favor of an upstream effect/Schema or effect member.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LiteralKitRetiredFacet = typeof LiteralKitRetiredFacet.Type;

const isLiteralKitRetiredFacet = S.is(LiteralKitRetiredFacet);

/**
 * Source modules whose declarations own the retired facets.
 *
 * **Details**
 *
 * A property read is rewritten only when the checker resolves the accessed
 * member to a declaration in one of these modules; `withLiteralKitStatics`'s
 * `Pick` maps its members back to the `LiteralKit` declarations. Unrelated
 * members with the same name (`HashSet.HashSet`, an AST node's `thunk`) never
 * match.
 *
 * **Example** (List the owner modules)
 *
 * ```ts
 * import { LiteralKitFacetOwnerModules } from "@beep/repo-cli/test/Lint"
 *
 * console.log(LiteralKitFacetOwnerModules.length) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LiteralKitFacetOwnerModules: ReadonlyArray<string> = [
  "/schema/src/LiteralKit/LiteralKit.schema.ts",
  "/schema/src/MappedLiteralKit/MappedLiteralKit.schema.ts",
  "/schema/src/SchemaUtils/withLiteralKitStatics.ts",
];

type SiteDecision =
  | {
      readonly _tag: "Rewrite";
      readonly siteNode: Node;
      readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
      readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
      readonly consumes: O.Option<Node>;
    }
  | { readonly _tag: "Residue"; readonly siteNode: Node; readonly reason: string };

type ReceiverRewrite = {
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
};

type ModuleReference = {
  readonly reference: string;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
};

const rewrite = (
  siteNode: Node,
  edits: ReadonlyArray<SchemaParityCodemodEdit>,
  imports: ReadonlyArray<SchemaParityCodemodImport> = A.empty(),
  consumes: O.Option<Node> = O.none()
): SiteDecision => ({ _tag: "Rewrite", siteNode, edits, imports, consumes });

const residue = (siteNode: Node, reason: string): SiteDecision => ({ _tag: "Residue", siteNode, reason });

const replaceNode = (node: Node, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getEnd(), text });

const insertAt = (offset: number, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: offset, end: offset, text });

const isOwnerDeclaration = (declaration: Node): boolean => {
  const filePath = declaration.getSourceFile().getFilePath();
  return A.some(LiteralKitFacetOwnerModules, (suffix) => Str.endsWith(suffix)(filePath));
};

const isKitFacetAccess = (access: PropertyAccessExpression): boolean =>
  pipe(
    O.fromNullishOr(access.getNameNode().getSymbol()),
    O.exists((symbol) => A.some(symbol.getDeclarations(), isOwnerDeclaration))
  );

const hasLiteralsMember = (expression: Node): boolean => expression.getType().getProperty("literals") !== undefined;

const importedLocalNames = (sourceFile: SourceFile): ReadonlyArray<string> =>
  A.flatMap(sourceFile.getImportDeclarations(), (declaration) =>
    A.getSomes([
      O.map(O.fromNullishOr(declaration.getDefaultImport()), (node) => node.getText()),
      O.map(O.fromNullishOr(declaration.getNamespaceImport()), (node) => node.getText()),
      ...A.map(declaration.getNamedImports(), (specifier) =>
        O.some(
          pipe(
            O.fromNullishOr(specifier.getAliasNode()),
            O.map((node) => node.getText()),
            O.getOrElse(() => specifier.getName())
          )
        )
      ),
    ])
  );

const declaredLocalNames = (sourceFile: SourceFile): ReadonlyArray<string> =>
  A.getSomes([
    ...A.flatMap(sourceFile.getVariableDeclarations(), (declaration) =>
      A.map(declaration.getNameNode().getDescendantsOfKind(SyntaxKind.Identifier), (node) => O.some(node.getText()))
    ),
    ...A.map(sourceFile.getVariableDeclarations(), (declaration) =>
      Node.isIdentifier(declaration.getNameNode()) ? O.some(declaration.getName()) : O.none()
    ),
    ...A.map(sourceFile.getFunctions(), (declaration) => O.fromNullishOr(declaration.getName())),
    ...A.map(sourceFile.getClasses(), (declaration) => O.fromNullishOr(declaration.getName())),
    ...A.map(sourceFile.getEnums(), (declaration) => O.some(declaration.getName())),
    ...A.map(sourceFile.getInterfaces(), (declaration) => O.some(declaration.getName())),
    ...A.map(sourceFile.getTypeAliases(), (declaration) => O.some(declaration.getName())),
    ...A.map(sourceFile.getModules(), (declaration) => O.some(declaration.getName())),
  ]);

const moduleBindingNames = (sourceFile: SourceFile): HashSet.HashSet<string> =>
  HashSet.fromIterable([...importedLocalNames(sourceFile), ...declaredLocalNames(sourceFile)]);

const namespaceAliasFor = (sourceFile: SourceFile, moduleSpecifier: string): O.Option<string> =>
  A.findFirst(schemaParityCodemodValueImports(sourceFile, moduleSpecifier), (declaration) =>
    O.map(O.fromNullishOr(declaration.getNamespaceImport()), (node) => node.getText())
  );

const namedValueImportLocal = (sourceFile: SourceFile, moduleSpecifier: string, name: string): O.Option<string> =>
  A.findFirst(schemaParityCodemodValueImports(sourceFile, moduleSpecifier), (declaration) =>
    A.findFirst(declaration.getNamedImports(), (specifier) =>
      !specifier.isTypeOnly() && specifier.getName() === name
        ? O.some(
            pipe(
              O.fromNullishOr(specifier.getAliasNode()),
              O.map((node) => node.getText()),
              O.getOrElse(() => name)
            )
          )
        : O.none()
    )
  );

const hasNamedValueImportDeclaration = (sourceFile: SourceFile, moduleSpecifier: string): boolean =>
  A.some(
    schemaParityCodemodValueImports(sourceFile, moduleSpecifier),
    (declaration) =>
      declaration.getNamespaceImport() === undefined && A.isReadonlyArrayNonEmpty(declaration.getNamedImports())
  );

const namespaceImport = (moduleSpecifier: string, alias: string): SchemaParityCodemodImport =>
  SchemaParityCodemodImport.cases.NamespaceImport.make({ moduleSpecifier, alias });

const namedImport = (moduleSpecifier: string, name: string): SchemaParityCodemodImport =>
  SchemaParityCodemodImport.cases.NamedImport.make({ moduleSpecifier, name });

const hashSetReference = (sourceFile: SourceFile): O.Option<ModuleReference> => {
  const existing = O.orElse(namespaceAliasFor(sourceFile, "effect/HashSet"), () =>
    namedValueImportLocal(sourceFile, "effect", "HashSet")
  );
  if (O.isSome(existing)) {
    return O.some({ reference: existing.value, imports: A.empty() });
  }
  if (HashSet.has(moduleBindingNames(sourceFile), "HashSet")) {
    return O.none();
  }
  return O.some({
    reference: "HashSet",
    imports: [
      hasNamedValueImportDeclaration(sourceFile, "effect")
        ? namedImport("effect", "HashSet")
        : namespaceImport("effect/HashSet", "HashSet"),
    ],
  });
};

const constantReference = (sourceFile: SourceFile): O.Option<ModuleReference> => {
  const namespace = namespaceAliasFor(sourceFile, "effect/Function");
  if (O.isSome(namespace)) {
    return O.some({ reference: `${namespace.value}.constant`, imports: A.empty() });
  }
  const named = namedValueImportLocal(sourceFile, "effect/Function", "constant");
  if (O.isSome(named)) {
    return O.some({ reference: named.value, imports: A.empty() });
  }
  const bound = moduleBindingNames(sourceFile);
  if (hasNamedValueImportDeclaration(sourceFile, "effect/Function") && !HashSet.has(bound, "constant")) {
    return O.some({ reference: "constant", imports: [namedImport("effect/Function", "constant")] });
  }
  return HashSet.has(bound, "F")
    ? O.none()
    : O.some({ reference: "F.constant", imports: [namespaceImport("effect/Function", "F")] });
};

const isWithLiteralKitStaticsCall = (node: Node): boolean => {
  if (!Node.isCallExpression(node)) {
    return false;
  }
  const callee = node.getExpression();
  return (
    (Node.isIdentifier(callee) && callee.getText() === "withLiteralKitStatics") ||
    (Node.isPropertyAccessExpression(callee) && callee.getName() === "withLiteralKitStatics")
  );
};

const importSourceFor = (receiver: Node) =>
  pipe(
    O.fromNullishOr(receiver.getSymbol()),
    O.flatMap((symbol) =>
      A.findFirst(symbol.getDeclarations(), (node) => O.liftPredicate(Node.isImportSpecifier)(node))
    ),
    O.map((specifier) => specifier.getImportDeclaration())
  );

const decoratedDeclaration = (receiver: Expression): Result.Result<VariableDeclaration, string> =>
  pipe(
    O.liftPredicate(receiver, Node.isIdentifier),
    O.flatMap((identifier) => {
      const symbol = identifier.getSymbol();
      return O.fromNullishOr((symbol?.getAliasedSymbol() ?? symbol)?.getValueDeclaration());
    }),
    O.filter(Node.isVariableDeclaration),
    Result.fromOption(() => "receiver-without-literals")
  );

const decoratorBase = (declaration: VariableDeclaration): Result.Result<Identifier, string> =>
  pipe(
    O.fromNullishOr(declaration.getInitializer()),
    O.flatMap((node) =>
      A.findFirst([node, ...node.getDescendantsOfKind(SyntaxKind.CallExpression)], isWithLiteralKitStaticsCall)
    ),
    O.filter(Node.isCallExpression),
    Result.fromOption(() => "receiver-without-literals"),
    Result.flatMap((call) =>
      pipe(
        A.head(call.getArguments()),
        O.filter(Node.isIdentifier),
        Result.fromOption(() => "decorated-base-not-identifier")
      )
    ),
    Result.filterOrFail(hasLiteralsMember, () => "decorated-base-without-literals")
  );

const exportsName =
  (name: string) =>
  (importDeclaration: ImportDeclaration): boolean =>
    pipe(
      O.fromNullishOr(importDeclaration.getModuleSpecifierSourceFile()),
      O.exists((module) => module.getExportedDeclarations().has(name))
    );

const importedBaseRewrite = (receiver: Expression, baseName: string): Result.Result<ReceiverRewrite, string> =>
  pipe(
    importSourceFor(receiver),
    Result.fromOption(() => "decorated-base-not-importable"),
    Result.filterOrFail(exportsName(baseName), () => "decorated-base-not-exported"),
    Result.filterOrFail(
      () => !HashSet.has(moduleBindingNames(receiver.getSourceFile()), baseName),
      () => "decorated-base-name-conflict"
    ),
    Result.map((importDeclaration) => ({
      edits: [replaceNode(receiver, baseName)],
      imports: [namedImport(importDeclaration.getModuleSpecifierValue(), baseName)],
    }))
  );

/**
 * Resolve the kit a decorated schema was built from.
 *
 * `Base.pipe(S.brand(...), withLiteralKitStatics(Base))` is not an
 * `S.Literals`, so it has no `.literals`; the rewrite reads the underlying
 * kit instead. Same-module bases are referenced directly; cross-module bases
 * are imported from the module the receiver itself was imported from, when
 * that module exports them.
 */
const resolveDecoratedBase = (receiver: Expression): Result.Result<ReceiverRewrite, string> =>
  pipe(
    decoratedDeclaration(receiver),
    Result.flatMap((declaration) =>
      Result.map(decoratorBase(declaration), (base) => ({ declaration, baseName: base.getText() }))
    ),
    Result.flatMap(({ baseName, declaration }) =>
      declaration.getSourceFile() === receiver.getSourceFile()
        ? Result.succeed({ edits: [replaceNode(receiver, baseName)], imports: A.empty<SchemaParityCodemodImport>() })
        : importedBaseRewrite(receiver, baseName)
    )
  );

const resolveLiteralsReceiver = (receiver: Expression): Result.Result<ReceiverRewrite, string> =>
  hasLiteralsMember(receiver)
    ? Result.succeed({ edits: A.empty(), imports: A.empty() })
    : resolveDecoratedBase(receiver);

const withReceiver =
  (receiver: Expression, siteNode: Node, consumes: O.Option<Node> = O.none()) =>
  (
    build: (
      rewriteReceiver: ReceiverRewrite
    ) => readonly [ReadonlyArray<SchemaParityCodemodEdit>, ReadonlyArray<SchemaParityCodemodImport>]
  ): SiteDecision =>
    Result.match(resolveLiteralsReceiver(receiver), {
      onFailure: (reason) => residue(siteNode, reason),
      onSuccess: (resolved) => {
        const [edits, imports] = build(resolved);
        return rewrite(siteNode, A.appendAll(resolved.edits, edits), A.appendAll(resolved.imports, imports), consumes);
      },
    });

const calledAccess = (access: PropertyAccessExpression) =>
  pipe(
    O.fromNullishOr(access.getParentIfKind(SyntaxKind.CallExpression)),
    O.filter((call) => call.getExpression() === access && A.isReadonlyArrayEmpty(call.getTypeArguments()))
  );

const planOptions = (access: PropertyAccessExpression): SiteDecision =>
  withReceiver(access.getExpression(), access)(() => [[replaceNode(access.getNameNode(), "literals")], A.empty()]);

const planPickOptions = (access: PropertyAccessExpression): SiteDecision => {
  const call = calledAccess(access);
  if (O.isNone(call)) {
    return residue(access, "pickOptions-not-called");
  }
  return withReceiver(
    access.getExpression(),
    call.value
  )(() => [[replaceNode(access.getNameNode(), "pick"), insertAt(call.value.getEnd(), ".literals")], A.empty()]);
};

const isLiteralType = (type: Type): boolean => type.isLiteral() || type.isBooleanLiteral();

const literalTypesOf = (type: Type): ReadonlyArray<Type> =>
  type.isTuple()
    ? type.getTupleElements()
    : pipe(
        O.fromNullishOr(type.getNumberIndexType()),
        O.map((element) => (element.isUnion() ? element.getUnionTypes() : [element])),
        O.getOrElse(A.empty<Type>)
      );

const sameType = (left: Type) => (right: Type) => left.compilerType === right.compilerType;

const planOmitOptions = (access: PropertyAccessExpression): SiteDecision => {
  const call = calledAccess(access);
  if (O.isNone(call)) {
    return residue(access, "omitOptions-not-called");
  }
  const [omitted, ...rest] = call.value.getArguments();
  if (omitted === undefined || A.isReadonlyArrayNonEmpty(rest)) {
    return residue(call.value, "omitOptions-unexpected-arguments");
  }
  const optionsType = O.fromNullishOr(
    access.getExpression().getType().getProperty("Options")?.getTypeAtLocation(access)
  );
  const literals = pipe(
    optionsType,
    O.filter((type) => type.isTuple()),
    O.map((type) => type.getTupleElements()),
    O.filter((elements) => A.every(elements, isLiteralType))
  );
  if (O.isNone(literals)) {
    return residue(call.value, "omitOptions-receiver-not-a-literal-tuple");
  }
  const omittedTypes = literalTypesOf(omitted.getType());
  if (
    A.isReadonlyArrayEmpty(omittedTypes) ||
    !A.every(omittedTypes, (type) => isLiteralType(type) && A.some(literals.value, sameType(type)))
  ) {
    return residue(call.value, "omitOptions-argument-not-literal");
  }
  const complement = A.filter(literals.value, (literal) => !A.some(omittedTypes, sameType(literal)));
  if (A.isReadonlyArrayEmpty(complement)) {
    return residue(call.value, "omitOptions-empty-complement");
  }
  const pickText = `[${A.join(
    A.map(complement, (type) => type.getText()),
    ", "
  )}]`;
  return withReceiver(
    access.getExpression(),
    call.value,
    O.some(omitted)
  )(() => [
    [
      replaceNode(access.getNameNode(), "pick"),
      replaceNode(omitted, pickText),
      insertAt(call.value.getEnd(), ".literals"),
    ],
    A.empty(),
  ]);
};

const planHashSet = (access: PropertyAccessExpression): SiteDecision => {
  const reference = hashSetReference(access.getSourceFile());
  if (O.isNone(reference)) {
    return residue(access, "HashSet-binding-conflict");
  }
  return withReceiver(
    access.getExpression(),
    access
  )(() => [
    [
      insertAt(access.getStart(), `${reference.value.reference}.fromIterable(`),
      replaceNode(access.getNameNode(), "literals"),
      insertAt(access.getEnd(), ")"),
    ],
    reference.value.imports,
  ]);
};

const planThunk = (access: PropertyAccessExpression): SiteDecision => {
  const member = pipe(
    O.fromNullishOr(access.getParent()),
    O.filter(
      (parent) =>
        (Node.isPropertyAccessExpression(parent) || Node.isElementAccessExpression(parent)) &&
        parent.getExpression() === access
    )
  );
  if (O.isNone(member)) {
    return residue(access, "thunk-used-as-value");
  }
  const invoked = pipe(
    O.fromNullishOr(member.value.getParentIfKind(SyntaxKind.CallExpression)),
    O.filter((call) => call.getExpression() === member.value && A.isReadonlyArrayEmpty(call.getArguments()))
  );
  if (O.isSome(invoked)) {
    return rewrite(invoked.value, [
      replaceNode(access.getNameNode(), "Enum"),
      SchemaParityCodemodEdit.make({ start: member.value.getEnd(), end: invoked.value.getEnd(), text: "" }),
    ]);
  }
  const reference = constantReference(access.getSourceFile());
  if (O.isNone(reference)) {
    return residue(member.value, "Function-binding-conflict");
  }
  return rewrite(
    member.value,
    [
      insertAt(member.value.getStart(), `${reference.value.reference}(`),
      replaceNode(access.getNameNode(), "Enum"),
      insertAt(member.value.getEnd(), ")"),
    ],
    reference.value.imports
  );
};

const planFacet = (access: PropertyAccessExpression, facet: LiteralKitRetiredFacet): SiteDecision =>
  LiteralKitRetiredFacet.$match(facet, {
    Options: () => planOptions(access),
    pickOptions: () => planPickOptions(access),
    omitOptions: () => planOmitOptions(access),
    HashSet: () => planHashSet(access),
    thunk: () => planThunk(access),
  });

const planLiteralKitFacets = (
  sourceFile: SourceFile,
  context: SchemaParityCodemodRuleContext
): SchemaParityCodemodRulePlan => {
  const text = sourceFile.getFullText();
  const location = (node: Node) => sourceFile.getLineAndColumnAtPos(node.getStart());
  const planned = A.filterMap(sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression), (access) => {
    const facet = access.getName();
    return isLiteralKitRetiredFacet(facet) && isKitFacetAccess(access)
      ? Result.succeed({ facet, decision: planFacet(access, facet) })
      : Result.failVoid;
  });
  // A rewrite that replaces a whole subexpression (the omitOptions argument)
  // subsumes every site inside it; keeping them would overlap its edit.
  const consumed = A.getSomes(
    A.map(planned, ({ decision }) => (decision._tag === "Rewrite" ? decision.consumes : O.none()))
  );
  const isConsumed = (node: Node): boolean =>
    A.some(consumed, (range) => node.getStart() >= range.getStart() && node.getEnd() <= range.getEnd());
  const decisions = A.filter(planned, ({ decision }) => !isConsumed(decision.siteNode));
  const rewrites = A.filterMap(decisions, ({ decision, facet }) =>
    decision._tag === "Rewrite" ? Result.succeed({ decision, facet }) : Result.failVoid
  );
  return SchemaParityCodemodRulePlan.make({
    edits: A.flatMap(rewrites, ({ decision }) => decision.edits),
    imports: A.flatMap(rewrites, ({ decision }) => decision.imports),
    sites: A.map(rewrites, ({ decision, facet }) =>
      SchemaParityCodemodSite.make({
        ruleId: RULE_ID,
        facet,
        filePath: context.filePath,
        line: location(decision.siteNode).line,
        column: location(decision.siteNode).column,
        before: decision.siteNode.getText(),
        after: renderSchemaParityCodemodEdits(
          text,
          decision.siteNode.getStart(),
          decision.siteNode.getEnd(),
          decision.edits
        ),
      })
    ),
    residue: A.filterMap(decisions, ({ decision, facet }) =>
      decision._tag === "Residue"
        ? Result.succeed(
            SchemaParityCodemodResidue.make({
              ruleId: RULE_ID,
              facet,
              filePath: context.filePath,
              line: location(decision.siteNode).line,
              column: location(decision.siteNode).column,
              text: decision.siteNode.getText(),
              reason: decision.reason,
            })
          )
        : Result.failVoid
    ),
  });
};

/**
 * Rule rewriting reads of the retired LiteralKit facets.
 *
 * **Details**
 *
 * Type-directed: only members the checker resolves to
 * {@link LiteralKitFacetOwnerModules} are rewritten. A read off a schema
 * decorated by `withLiteralKitStatics` (which has no `.literals`) is rewritten
 * against the underlying kit when that kit is in scope or importable;
 * otherwise the site is reported as residue. Whole-object `thunk` reads, empty
 * complements and name conflicts are residue too.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { literalKitFacetsRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(literalKitFacetsRule.id) // "literal-kit-facets"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const literalKitFacetsRule = SchemaParityCodemodRule.make({
  id: RULE_ID,
  description:
    "Rewrite retired LiteralKit facets: Options -> .literals, pickOptions -> .pick(...).literals, omitOptions -> complement pick, HashSet -> HashSet.fromIterable(.literals), thunk.k -> F.constant(.Enum.k).",
  candidatePattern: /\.(?:Options|pickOptions|omitOptions|HashSet|thunk)\b/u,
  plan: planLiteralKitFacets,
});
