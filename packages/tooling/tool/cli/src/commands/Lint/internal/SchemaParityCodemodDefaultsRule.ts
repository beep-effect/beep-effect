/**
 * The `schema-default-helpers` codemod rule: rewrites the retired
 * `SchemaUtils` default helpers onto upstream `effect/Schema` defaults.
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
import { Node, SyntaxKind, ts } from "ts-morph";
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
import type { CallExpression, Identifier, ImportDeclaration, SourceFile, Type } from "ts-morph";
import type { SchemaParityCodemodRuleContext } from "./SchemaParityCodemod.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemodDefaultsRule");

const RULE_ID = "schema-default-helpers" as const;

/**
 * `SchemaUtils` default helpers retired by P3 PR 3b of `goals/effect-schema-parity`.
 *
 * **Example** (Check a retired default helper)
 *
 * ```ts
 * import { RetiredDefaultHelper } from "@beep/repo-cli/test/Lint"
 *
 * console.log(RetiredDefaultHelper.is.withNoneDefault("withNoneDefault")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RetiredDefaultHelper = LiteralKit([
  "withNoneDefault",
  "withConstantDefault",
  "withKeyDefaults",
  "withEmptyArrayDefaults",
]).pipe(
  $I.annoteSchema("RetiredDefaultHelper", {
    description: "SchemaUtils default helper retired in favor of upstream effect/Schema defaults.",
  })
);

/**
 * `SchemaUtils` default helper retired in favor of upstream `effect/Schema` defaults.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RetiredDefaultHelper = typeof RetiredDefaultHelper.Type;

const isRetiredDefaultHelper = S.is(RetiredDefaultHelper);

const HELPER_MODULE_SUFFIXES = [
  "/schema/src/SchemaUtils/withConstructorDefaults.ts",
  "/schema/src/SchemaUtils/withKeyDefaults.ts",
] as const;

type Decision =
  | {
      readonly _tag: "Rewrite";
      readonly siteNode: Node;
      readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
      readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
    }
  | { readonly _tag: "Residue"; readonly siteNode: Node; readonly reason: string };

type Reference = {
  readonly text: string;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
};

type Hoist = {
  readonly name: string;
  readonly edit: SchemaParityCodemodEdit;
};

const rewrite = (
  siteNode: Node,
  edits: ReadonlyArray<SchemaParityCodemodEdit>,
  imports: ReadonlyArray<SchemaParityCodemodImport>
): Decision => ({ _tag: "Rewrite", siteNode, edits, imports });

const residue = (siteNode: Node, reason: string): Decision => ({ _tag: "Residue", siteNode, reason });

const replaceNode = (node: Node, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getEnd(), text });

const insertAt = (offset: number, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: offset, end: offset, text });

// ---------------------------------------------------------------------------
// Scope-checked references
// ---------------------------------------------------------------------------

const resolveAt = (site: Node, name: string): O.Option<ts.Symbol> =>
  O.fromNullishOr(
    site.getProject().getTypeChecker().compilerObject.resolveName(name, site.compilerNode, ts.SymbolFlags.All, false)
  );

const isFreeAt = (site: Node, name: string): boolean => O.isNone(resolveAt(site, name));

const resolvesTo = (site: Node, name: string, declaration: Node): boolean =>
  pipe(
    resolveAt(site, name),
    O.exists((symbol) => A.some(symbol.declarations ?? A.empty(), (node) => node === declaration.compilerNode))
  );

const reuse = (site: Node, local: string, declaration: Node): O.Option<Reference> =>
  resolvesTo(site, local, declaration) ? O.some({ text: local, imports: A.empty(), edits: A.empty() }) : O.none();

const namespaceReference = (site: Node, moduleSpecifier: string): O.Option<O.Option<Reference>> =>
  A.findFirst(schemaParityCodemodValueImports(site.getSourceFile(), moduleSpecifier), (declaration) =>
    pipe(
      O.fromNullishOr(declaration.getNamespaceImport()),
      O.flatMap((name) => O.map(O.fromNullishOr(name.getParent()), (node) => reuse(site, name.getText(), node)))
    )
  );

const namedReference = (site: Node, moduleSpecifier: string, name: string): O.Option<O.Option<Reference>> =>
  A.findFirst(schemaParityCodemodValueImports(site.getSourceFile(), moduleSpecifier), (declaration) =>
    A.findFirst(declaration.getNamedImports(), (specifier) =>
      !specifier.isTypeOnly() && specifier.getName() === name
        ? O.some(reuse(site, specifier.getAliasNode()?.getText() ?? name, specifier))
        : O.none()
    )
  );

const fresh = (site: Node, name: string, requirement: SchemaParityCodemodImport): O.Option<Reference> =>
  isFreeAt(site, name) ? O.some({ text: name, imports: [requirement], edits: A.empty() }) : O.none();

type Promotion = {
  readonly binding: Node;
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
};

const replacePrefix = (node: Node, prefix: RegExp, text: string): O.Option<SchemaParityCodemodEdit> =>
  O.map(O.fromNullishOr(prefix.exec(node.getText())), ([match]) =>
    SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getStart() + match.length, text })
  );

const IMPORT_TYPE_PREFIX = /^import\s+type\s+/u;

const namespaceEffectPromotion = (declaration: ImportDeclaration): O.Option<Promotion> =>
  pipe(
    O.fromNullishOr(declaration.getNamespaceImport()?.getParent()),
    O.flatMap((binding) =>
      O.map(replacePrefix(declaration, IMPORT_TYPE_PREFIX, "import "), (edit) => ({ binding, edits: [edit] }))
    )
  );

// `import type { Duration, Effect }` becomes `import { type Duration, Effect }`;
// an inline `type Effect` specifier loses its modifier.
const namedEffectPromotion = (declaration: ImportDeclaration): O.Option<Promotion> =>
  pipe(
    A.findFirst(
      declaration.getNamedImports(),
      (specifier) => specifier.getName() === "Effect" && specifier.getAliasNode() === undefined
    ),
    O.flatMap((binding) =>
      declaration.isTypeOnly()
        ? O.map(replacePrefix(declaration, IMPORT_TYPE_PREFIX, "import "), (edit) => ({
            binding,
            edits: [
              edit,
              ...A.map(
                A.filter(declaration.getNamedImports(), (specifier) => specifier !== binding),
                (specifier) => insertAt(specifier.getStart(), "type ")
              ),
            ],
          }))
        : binding.isTypeOnly()
          ? O.map(replacePrefix(binding, /^type\s+/u, ""), (edit) => ({ binding, edits: [edit] }))
          : O.none()
    )
  );

const effectPromotion = (declaration: ImportDeclaration): O.Option<Promotion> => {
  const specifier = declaration.getModuleSpecifierValue();
  return specifier === "effect/Effect" && declaration.isTypeOnly()
    ? namespaceEffectPromotion(declaration)
    : specifier === "effect"
      ? namedEffectPromotion(declaration)
      : O.none();
};

// A type-only `Effect` binding that resolves at the site is promoted to a value
// binding; sibling specifiers keep their type-only meaning.
const promotedTypeOnlyEffect = (site: Node): O.Option<Reference> =>
  A.findFirst(site.getSourceFile().getImportDeclarations(), (declaration) =>
    pipe(
      effectPromotion(declaration),
      O.filter(({ binding }) => resolvesTo(site, "Effect", binding)),
      O.map(({ edits }) => ({ text: "Effect", imports: A.empty(), edits }))
    )
  );

const firstExisting = (
  candidates: ReadonlyArray<() => O.Option<O.Option<Reference>>>,
  otherwise: () => O.Option<Reference>
): O.Option<Reference> =>
  pipe(
    A.findFirst(candidates, (candidate) => candidate()),
    O.getOrElse(otherwise)
  );

const schemaReference = (site: Node): O.Option<Reference> =>
  firstExisting([() => namespaceReference(site, "effect/Schema"), () => namedReference(site, "effect", "Schema")], () =>
    fresh(
      site,
      "S",
      SchemaParityCodemodImport.cases.NamespaceImport.make({ moduleSpecifier: "effect/Schema", alias: "S" })
    )
  );

const effectReference = (site: Node): O.Option<Reference> =>
  firstExisting([() => namespaceReference(site, "effect/Effect"), () => namedReference(site, "effect", "Effect")], () =>
    O.orElse(promotedTypeOnlyEffect(site), () =>
      fresh(
        site,
        "Effect",
        SchemaParityCodemodImport.cases.NamedImport.make({ moduleSpecifier: "effect", name: "Effect" })
      )
    )
  );

const arrayReference = (site: Node): O.Option<Reference> =>
  firstExisting(
    [
      () => namespaceReference(site, "effect/Array"),
      () => namespaceReference(site, "@beep/utils/Array"),
      () => namedReference(site, "@beep/utils", "A"),
    ],
    () =>
      fresh(
        site,
        "A",
        SchemaParityCodemodImport.cases.NamespaceImport.make({ moduleSpecifier: "effect/Array", alias: "A" })
      )
  );

type References = {
  readonly schema: string;
  readonly effect: string;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
};

const references = (site: Node): Result.Result<References, string> =>
  pipe(
    O.all({ schema: schemaReference(site), effect: effectReference(site) }),
    O.map(({ effect, schema }) => ({
      schema: schema.text,
      effect: effect.text,
      imports: A.appendAll(schema.imports, effect.imports),
      edits: A.appendAll(schema.edits, effect.edits),
    })),
    Result.fromOption(() => "effect-binding-conflict")
  );

// ---------------------------------------------------------------------------
// Binding a constructed default once
// ---------------------------------------------------------------------------

const unwrap = (expression: Node): Node =>
  Node.isParenthesizedExpression(expression) ||
  Node.isAsExpression(expression) ||
  Node.isSatisfiesExpression(expression)
    ? unwrap(expression.getExpression())
    : expression;

const isConstructed = (expression: Node): boolean => {
  const inner = unwrap(expression);
  return (
    Node.isCallExpression(inner) ||
    Node.isNewExpression(inner) ||
    Node.isArrayLiteralExpression(inner) ||
    Node.isObjectLiteralExpression(inner) ||
    Node.isTaggedTemplateExpression(inner)
  );
};

const isStatementContainer = (node: Node): boolean =>
  Node.isSourceFile(node) || Node.isBlock(node) || Node.isModuleBlock(node);

// The statement a bound default is inserted before. A default inside a
// function body stays per-call in the helper; hoisting it out of the function
// would evaluate it once, so that site is residue instead.
const enclosingStatement = (node: Node): Result.Result<Node, string> =>
  pipe(
    O.fromNullishOr(node.getParentWhile((parent) => !isStatementContainer(parent))),
    Result.fromOption(() => "default-without-enclosing-statement"),
    Result.filterOrFail(
      (statement) =>
        !A.some(
          node.getAncestors(),
          (ancestor) =>
            Node.isFunctionLikeDeclaration(ancestor) &&
            statement.containsRange(ancestor.getPos(), ancestor.getEnd()) &&
            ancestor !== statement
        ),
      () => "constructed-default-inside-function"
    )
  );

const identifierWords = (text: string): ReadonlyArray<string> =>
  A.filter(Str.split(/[^A-Za-z0-9]+/u)(text), Str.isNonEmpty);

const capitalize = (word: string): string => `${Str.toUpperCase(Str.slice(0, 1)(word))}${Str.slice(1)(word)}`;

const camel = (words: ReadonlyArray<string>): string =>
  A.join(
    A.map(words, (word, index) =>
      index === 0 ? `${Str.toLowerCase(Str.slice(0, 1)(word))}${Str.slice(1)(word)}` : capitalize(word)
    ),
    ""
  );

const fieldWords = (node: Node): ReadonlyArray<string> =>
  pipe(
    O.fromNullishOr(node.getFirstAncestorByKind(SyntaxKind.PropertyAssignment)),
    O.map((property) => identifierWords(property.getName())),
    O.getOrElse(A.empty<string>)
  );

const containerWords = (node: Node): ReadonlyArray<string> =>
  pipe(
    O.orElse(
      O.flatMap(O.fromNullishOr(node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)), (declaration) =>
        O.fromNullishOr(declaration.getName())
      ),
      () =>
        O.map(O.fromNullishOr(node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)), (declaration) =>
          declaration.getName()
        )
    ),
    O.map(identifierWords),
    O.getOrElse(A.empty<string>)
  );

const hoistName = (site: Node, taken: HashSet.HashSet<string>): string => {
  const base = camel([...containerWords(site), ...fieldWords(site), "Default"]);
  const candidate = (index: number): string => (index === 0 ? base : `${base}${index + 1}`);
  return pipe(
    A.findFirst(A.range(0, 50), (index) =>
      O.liftPredicate(candidate(index), (name) => !HashSet.has(taken, name) && isFreeAt(site, name))
    ),
    O.getOrElse(() => candidate(51))
  );
};

const hoist = (site: Node, valueText: string, taken: HashSet.HashSet<string>): Result.Result<Hoist, string> =>
  Result.map(enclosingStatement(site), (statement) => {
    const name = hoistName(site, taken);
    return {
      name,
      edit: insertAt(statement.getStart(true), `const ${name} = ${valueText};\n${statement.getIndentationText()}`),
    };
  });

// ---------------------------------------------------------------------------
// Call shapes
// ---------------------------------------------------------------------------

const isPipeArgument = (node: Node): boolean =>
  pipe(
    O.fromNullishOr(node.getParentIfKind(SyntaxKind.CallExpression)),
    O.exists((outer) => {
      const callee = outer.getExpression();
      const isPipe =
        (Node.isPropertyAccessExpression(callee) && callee.getName() === "pipe") ||
        (Node.isIdentifier(callee) && callee.getText() === "pipe");
      return isPipe && A.some(outer.getArguments(), (argument) => argument === node);
    })
  );

const needsParentheses = (expression: Node): boolean =>
  !(
    Node.isIdentifier(expression) ||
    Node.isPropertyAccessExpression(expression) ||
    Node.isCallExpression(expression) ||
    Node.isElementAccessExpression(expression) ||
    Node.isParenthesizedExpression(expression)
  );

const argumentTexts = (call: CallExpression): ReadonlyArray<string> =>
  A.map(call.getArguments(), (argument) => argument.getText());

// `target.pipe(...)`: the call `target` is the receiver of.
const outerPipeCall = (target: Node): O.Option<CallExpression> => {
  const access = target.getParentIfKind(SyntaxKind.PropertyAccessExpression);
  const call = access?.getParentIfKind(SyntaxKind.CallExpression);
  return access !== undefined && call !== undefined && access.getName() === "pipe" && call.getExpression() === access
    ? O.some(call)
    : O.none();
};

// `head.pipe(...args)` when the schema argument is itself a `.pipe` call.
const innerPipeCall = (schema: Node): O.Option<{ readonly head: Node; readonly call: CallExpression }> => {
  const access = Node.isCallExpression(schema)
    ? schema.getExpressionIfKind(SyntaxKind.PropertyAccessExpression)
    : undefined;
  return Node.isCallExpression(schema) && access !== undefined && access.getName() === "pipe"
    ? O.some({ head: access.getExpression(), call: schema })
    : O.none();
};

// Data-first `helper(schema, ...)` becomes `schema.pipe(steps)`, flattened into
// a `.pipe` the schema already is and a `.pipe` the call is the receiver of, so
// no chained pipes are emitted. The engine rejects overlapping edits, so a
// flattened outer pipe cannot swallow another rewritten site.
const pipeOnto = (target: Node, schema: Node, steps: string): SchemaParityCodemodEdit => {
  const inner = innerPipeCall(schema);
  const outer = outerPipeCall(target);
  const head = O.match(inner, { onNone: () => schema, onSome: (value) => value.head });
  const args = [
    ...O.match(inner, { onNone: A.empty<string>, onSome: (value) => argumentTexts(value.call) }),
    steps,
    ...O.match(outer, { onNone: A.empty<string>, onSome: argumentTexts }),
  ];
  const headText = needsParentheses(head) ? `(${head.getText()})` : head.getText();
  return replaceNode(
    O.getOrElse(outer, (): Node => target),
    `${headText}.pipe(${A.join(args, ", ")})`
  );
};

type Shape = {
  readonly site: Node;
  readonly call: O.Option<CallExpression>;
};

type Item = Decision | Hoist;

type Planner = (shape: Shape, taken: HashSet.HashSet<string>) => ReadonlyArray<Item>;

type DefaultValue = {
  readonly text: string;
  readonly constructed: boolean;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly typeArgument: string;
};

const withReferences = (site: Node, build: (refs: References) => ReadonlyArray<Item>): ReadonlyArray<Item> =>
  Result.match(references(site), {
    onFailure: (reason) => [residue(site, reason)],
    onSuccess: build,
  });

const planNone: Planner = ({ call, site }) =>
  withReferences(site, (refs) => {
    const step = `${refs.schema}.withConstructorDefault(${refs.effect}.succeedNone)`;
    if (O.isNone(call)) {
      return [rewrite(site, A.append(refs.edits, replaceNode(site, step)), refs.imports)];
    }
    const [schema, ...rest] = call.value.getArguments();
    return schema === undefined || A.isReadonlyArrayNonEmpty(rest)
      ? [residue(call.value, "withNoneDefault-unexpected-arguments")]
      : [rewrite(call.value, A.append(refs.edits, pipeOnto(call.value, schema, step)), refs.imports)];
  });

const typeArgumentsText = (call: CallExpression): string =>
  pipe(
    call.getTypeArguments(),
    A.map((node) => node.getText()),
    O.liftPredicate(A.isReadonlyArrayNonEmpty),
    O.match({ onNone: () => "", onSome: (names) => `<${A.join(names, ", ")}>` })
  );

const planConstant: Planner = ({ call, site }) =>
  pipe(
    call,
    O.flatMap((value) =>
      pipe(
        A.head(value.getArguments()),
        O.filter(() => value.getArguments().length === 1),
        O.map((argument) => ({ value, argument }))
      )
    ),
    O.match({
      onNone: () => [residue(site, "withConstantDefault-not-curried")],
      onSome: ({ argument, value }) =>
        withReferences(value, (refs) => [
          rewrite(
            value,
            A.append(
              refs.edits,
              replaceNode(
                value,
                `${refs.schema}.withConstructorDefault(${refs.effect}.succeed${typeArgumentsText(value)}(${argument.getText()}))`
              )
            ),
            refs.imports
          ),
        ]),
    })
  );

const twoSteps = (refs: References, decodingDefault: string, valueText: string, typeArgument: string): string =>
  `${refs.schema}.withConstructorDefault(${refs.effect}.succeed${typeArgument}(${valueText})), ${refs.schema}.${decodingDefault}(${refs.effect}.succeed${typeArgument}(${valueText}))`;

const boundValue = (
  target: Node,
  value: DefaultValue,
  taken: HashSet.HashSet<string>
): Result.Result<
  {
    readonly reference: string;
    readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
    readonly hoists: ReadonlyArray<Hoist>;
  },
  string
> =>
  value.constructed
    ? Result.map(hoist(target, value.text, taken), (hoisted) => ({
        reference: hoisted.name,
        edits: [hoisted.edit],
        hoists: [hoisted],
      }))
    : Result.succeed({ reference: value.text, edits: A.empty(), hoists: A.empty() });

// `withKeyDefaults` / `withEmptyArrayDefaults`: two upstream steps. Data-last
// they replace one pipe argument with two; data-first the schema is piped.
const planTwoStep = (
  target: Node,
  schema: O.Option<Node>,
  value: Result.Result<DefaultValue, string>,
  decodingDefault: string,
  taken: HashSet.HashSet<string>
): ReadonlyArray<Item> =>
  withReferences(target, (refs) =>
    pipe(
      value,
      Result.flatMap((resolved) =>
        Result.map(boundValue(target, resolved, taken), (bound) => ({
          bound,
          typeArgument: resolved.typeArgument,
          imports: A.appendAll(refs.imports, resolved.imports),
        }))
      ),
      Result.flatMap(({ bound, imports, typeArgument }) => {
        const steps = twoSteps(refs, decodingDefault, bound.reference, typeArgument);
        return pipe(
          O.match(schema, {
            onNone: () => (isPipeArgument(target) ? O.some(replaceNode(target, steps)) : O.none()),
            onSome: (node) => O.some(pipeOnto(target, node, steps)),
          }),
          Result.fromOption(() => `${decodingDefault}-outside-pipe`),
          Result.map(
            (edit): ReadonlyArray<Item> => [
              ...bound.hoists,
              rewrite(target, A.appendAll(refs.edits, A.append(bound.edits, edit)), imports),
            ]
          )
        );
      }),
      Result.getOrElse((reason): ReadonlyArray<Item> => [residue(target, reason)])
    )
  );

// A literal default for a literal-typed schema: upstream `Effect.succeed`
// widens it (`"fail"` to `string`) where the helper's parameter kept it, so the
// value takes `as const` (or `typeof` for a const binding).
const hasLiteralLeaf = (type: Type, site: Node, depth: number): boolean =>
  depth > 3 || type.isBoolean()
    ? false
    : type.isLiteral() ||
      type.isBooleanLiteral() ||
      A.some([...type.getUnionTypes(), ...type.getIntersectionTypes()], (part) =>
        hasLiteralLeaf(part, site, depth + 1)
      ) ||
      A.some(type.getTupleElements(), (element) => hasLiteralLeaf(element, site, depth + 1)) ||
      pipe(
        O.fromNullishOr(type.getArrayElementType()),
        O.exists((element) => hasLiteralLeaf(element, site, depth + 1))
      ) ||
      (type.isObject() &&
        !type.isArray() &&
        A.some(type.getProperties(), (property) => hasLiteralLeaf(property.getTypeAtLocation(site), site, depth + 1)));

const isLiteralExpression = (node: Node): boolean =>
  Node.isStringLiteral(node) ||
  Node.isNumericLiteral(node) ||
  Node.isBigIntLiteral(node) ||
  Node.isTrueLiteral(node) ||
  Node.isFalseLiteral(node) ||
  Node.isNoSubstitutionTemplateLiteral(node) ||
  (Node.isPrefixUnaryExpression(node) && Node.isNumericLiteral(node.getOperand())) ||
  Node.isArrayLiteralExpression(node) ||
  Node.isObjectLiteralExpression(node);

const inLiteralContext = (node: Node): boolean =>
  Node.isExpression(node) &&
  pipe(
    O.fromNullishOr(node.getContextualType()),
    O.exists((type) => hasLiteralLeaf(type, node, 0))
  );

const keyDefaultValue = (node: Node): DefaultValue => {
  const literalContext = inLiteralContext(node);
  const constText = literalContext && isLiteralExpression(node) ? `${node.getText()} as const` : node.getText();
  const typeofBinding =
    literalContext && Node.isIdentifier(node) && (node.getType().isLiteral() || node.getType().isBooleanLiteral());
  return {
    text: constText,
    constructed: isConstructed(node),
    imports: A.empty(),
    typeArgument: typeofBinding ? `<typeof ${node.getText()}>` : "",
  };
};

const planKeyDefaults: Planner = ({ call, site }, taken) =>
  O.match(call, {
    onNone: () => [residue(site, "withKeyDefaults-not-called")],
    onSome: (value) => {
      const [first, second, ...rest] = value.getArguments();
      if (first === undefined || A.isReadonlyArrayNonEmpty(rest)) {
        return [residue(value, "withKeyDefaults-unexpected-arguments")];
      }
      const defaultNode = second ?? first;
      return planTwoStep(
        value,
        second === undefined ? O.none() : O.some(first),
        Node.isArrayLiteralExpression(defaultNode) && A.isReadonlyArrayEmpty(defaultNode.getElements())
          ? emptyArrayValue(value, O.none())
          : Result.succeed(keyDefaultValue(defaultNode)),
        "withDecodingDefaultTypeKey",
        taken
      );
    },
  });

const emptyArrayValue = (site: Node, typeArgument: O.Option<Node>): Result.Result<DefaultValue, string> =>
  pipe(
    arrayReference(site),
    Result.fromOption(() => "array-binding-conflict"),
    Result.map((reference) => ({
      text: `${reference.text}.empty${O.match(typeArgument, { onNone: () => "", onSome: (node) => `<${node.getText()}>` })}()`,
      constructed: true,
      imports: reference.imports,
      typeArgument: "",
    }))
  );

// `withEmptyArrayDefaults<T>()`, `withEmptyArrayDefaults(schema)` and the
// point-free `.pipe(SchemaUtils.withEmptyArrayDefaults)`.
const planEmptyArray: Planner = ({ call, site }, taken) =>
  O.match(call, {
    onNone: () => planTwoStep(site, O.none(), emptyArrayValue(site, O.none()), "withDecodingDefaultType", taken),
    onSome: (value) => {
      const [schema, ...rest] = value.getArguments();
      return A.isReadonlyArrayNonEmpty(rest)
        ? [residue(value, "withEmptyArrayDefaults-unexpected-arguments")]
        : planTwoStep(
            value,
            O.fromNullishOr(schema),
            emptyArrayValue(value, O.fromNullishOr(value.getTypeArguments()[0])),
            "withDecodingDefaultType",
            taken
          );
    },
  });

const PLANNERS: Record<RetiredDefaultHelper, Planner> = {
  withNoneDefault: planNone,
  withConstantDefault: planConstant,
  withKeyDefaults: planKeyDefaults,
  withEmptyArrayDefaults: planEmptyArray,
};

// ---------------------------------------------------------------------------
// Site discovery
// ---------------------------------------------------------------------------

const isHelperDeclaration = (declaration: Node): boolean =>
  A.some(HELPER_MODULE_SUFFIXES, (suffix) => Str.endsWith(suffix)(declaration.getSourceFile().getFilePath()));

const referencesHelper = (identifier: Identifier): boolean =>
  pipe(
    O.fromNullishOr(identifier.getSymbol()),
    O.map((symbol) => symbol.getAliasedSymbol() ?? symbol),
    O.exists((symbol) => A.some(symbol.getDeclarations(), isHelperDeclaration))
  );

const isDeclarationName = (identifier: Identifier): boolean => {
  const parent = identifier.getParent();
  return (
    Node.isImportSpecifier(parent) ||
    Node.isExportSpecifier(parent) ||
    ((Node.isVariableDeclaration(parent) || Node.isFunctionDeclaration(parent)) && parent.getNameNode() === identifier)
  );
};

const useNode = (identifier: Identifier): Node =>
  pipe(
    O.fromNullishOr(identifier.getParentIfKind(SyntaxKind.PropertyAccessExpression)),
    O.filter((access) => access.getNameNode() === identifier),
    O.getOrElse((): Node => identifier)
  );

const calledBy = (site: Node): O.Option<CallExpression> =>
  pipe(
    O.fromNullishOr(site.getParentIfKind(SyntaxKind.CallExpression)),
    O.filter((call) => call.getExpression() === site)
  );

const isHoist = (item: Decision | Hoist): item is Hoist => "name" in item;

const planDefaultHelpers = (
  sourceFile: SourceFile,
  context: SchemaParityCodemodRuleContext
): SchemaParityCodemodRulePlan => {
  const text = sourceFile.getFullText();
  const location = (node: Node) => sourceFile.getLineAndColumnAtPos(node.getStart());
  const candidates = A.filter(
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier),
    (identifier) =>
      isRetiredDefaultHelper(identifier.getText()) && !isDeclarationName(identifier) && referencesHelper(identifier)
  );
  const planned = A.reduce(
    candidates,
    {
      taken: HashSet.empty<string>(),
      decisions: A.empty<{ readonly helper: RetiredDefaultHelper; readonly decision: Decision }>(),
    },
    (state, identifier) => {
      const helper = identifier.getText();
      if (!isRetiredDefaultHelper(helper)) {
        return state;
      }
      const site = useNode(identifier);
      const items = PLANNERS[helper]({ site, call: calledBy(site) }, state.taken);
      const hoists = A.filter(items, isHoist);
      const decisions = A.filterMap(items, (item) =>
        isHoist(item) ? Result.failVoid : Result.succeed({ helper, decision: item })
      );
      return {
        taken: A.reduce(hoists, state.taken, (taken, hoisted) => HashSet.add(taken, hoisted.name)),
        decisions: A.appendAll(state.decisions, decisions),
      };
    }
  ).decisions;
  const rewrites = A.filterMap(planned, ({ decision, helper }) =>
    decision._tag === "Rewrite" ? Result.succeed({ decision, helper }) : Result.failVoid
  );
  return SchemaParityCodemodRulePlan.make({
    edits: A.dedupeWith(
      A.flatMap(rewrites, ({ decision }) => decision.edits),
      (left, right) => left.start === right.start && left.end === right.end && left.text === right.text
    ),
    imports: A.flatMap(rewrites, ({ decision }) => decision.imports),
    sites: A.map(rewrites, ({ decision, helper }) =>
      SchemaParityCodemodSite.make({
        ruleId: RULE_ID,
        facet: helper,
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
    residue: A.filterMap(planned, ({ decision, helper }) =>
      decision._tag === "Residue"
        ? Result.succeed(
            SchemaParityCodemodResidue.make({
              ruleId: RULE_ID,
              facet: helper,
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
 * Rule rewriting the retired `SchemaUtils` default helpers onto upstream
 * `effect/Schema` defaults.
 *
 * **Details**
 *
 * `withNoneDefault` becomes `S.withConstructorDefault(Effect.succeedNone)`,
 * `withConstantDefault(v)` becomes `S.withConstructorDefault(Effect.succeed(v))`,
 * `withKeyDefaults(v)` becomes the `withConstructorDefault` +
 * `withDecodingDefaultTypeKey` pair and `withEmptyArrayDefaults<T>()` the
 * `withConstructorDefault` + `withDecodingDefaultType` pair. Data-first calls
 * become `schema.pipe(...)`. A constructed default (and every empty array) is
 * bound once to a const before the enclosing statement, because the helpers
 * share one value between the constructor and decoding defaults. Every
 * emitted name is resolved at its use site; a shadowed name is residue.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { schemaDefaultHelpersRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(schemaDefaultHelpersRule.id) // "schema-default-helpers"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const schemaDefaultHelpersRule = SchemaParityCodemodRule.make({
  id: RULE_ID,
  description:
    "Rewrite retired SchemaUtils default helpers onto S.withConstructorDefault / S.withDecodingDefaultTypeKey / S.withDecodingDefaultType.",
  candidatePattern: /\b(?:withNoneDefault|withConstantDefault|withKeyDefaults|withEmptyArrayDefaults)\b/u,
  plan: planDefaultHelpers,
});
