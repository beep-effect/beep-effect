/**
 * The schema idiom hint core: a pure scan of one TypeScript file for schema
 * fields whose name reads as a richer value (an instant, duration, byte size,
 * URL, network address, port or version) while their schema decodes to a
 * primitive.
 *
 * **Details**
 *
 * The file is parsed with `oxc-parser`, so comments and JSDoc examples never
 * produce hints, and a file that does not parse cleanly produces none. A field
 * counts only as a property of the fields argument of `S.Struct`,
 * `S.TaggedStruct`, `S.Class`, `S.TaggedClass`, `S.Error` or `S.TaggedError`
 * called through an `effect/Schema` namespace import. Its value must be a
 * primitive head (`S.Number`, `S.String`, ...) reached only through the
 * optional wrappers, `.check` / `.annotate` / `.annotateKey`, or a `.pipe`
 * whose every argument is a type-preserving combinator (`S.check`,
 * `S.brand`, `S.annotate`, `S.annotateKey`, the constructor and decoding
 * defaults, an optional wrapper, or an `annoteSchema` / `annote` call on a
 * `$`-prefixed identity composer such as `$I`). It may name a top-level
 * `const` once (one hop; an imported identifier is not followed). Anything
 * else, a conversion or collection combinator included, is not a primitive
 * and is never hinted. A namespace alias, identity composer or `const` name
 * bound more than once anywhere in the file is not trusted.
 *
 * A field is hinted only when it is the effective entry of its object: no
 * later spread, no computed key anywhere in the object and no other entry
 * with the same name. A container whose result is rewritten, through a
 * method other than `.check` / `.annotate` / `.annotateKey` or a `.pipe` /
 * `pipe(...)` with an argument outside the allow-list (`.mapFields`,
 * `S.fieldsAssign`, `S.decodeTo`, ...), hints none of its fields.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { constFalse, constTrue, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { parseSync, Visitor } from "oxc-parser";
import { SCHEMA_IDIOM_TELLS, SCHEMA_PRIMITIVE_HEADS, SchemaIdiomHint } from "./SchemaIdiomHints.model.ts";
import type {
  Argument,
  BindingPattern,
  BindingRestElement,
  CallExpression,
  Expression,
  ObjectExpression,
  ObjectProperty,
  ParamPattern,
  Program,
  Statement,
} from "oxc-parser";
import type { SchemaIdiomHintInput, SchemaIdiomTell, SchemaPrimitiveHead } from "./SchemaIdiomHints.model.ts";

const SCHEMA_MODULE = "effect/Schema";

const SOURCE_EXTENSION = /\.(?:ts|tsx|mts|cts)$/;

const EXCLUDED_PATH =
  /(?:^|\/)(?:test|tests|__tests__|_generated)\/|\.(?:test|spec)\.[cm]?tsx?$|\.gen\.[cm]?tsx?$|\.d\.[cm]?ts$/;

const OPTIONAL_WRAPPERS = HashSet.make(
  "optional",
  "optionalKey",
  "mutableKey",
  "NullOr",
  "UndefinedOr",
  "NullishOr",
  "OptionFromNullOr",
  "OptionFromNullishOr",
  "OptionFromUndefinedOr",
  "OptionFromOptional",
  "OptionFromOptionalKey",
  "OptionFromOptionalNullOr"
);

const PIPE_PRESERVING = HashSet.make(
  "check",
  "brand",
  "annotate",
  "annotateKey",
  "withConstructorDefault",
  "withDecodingDefault",
  "withDecodingDefaultKey",
  "withDecodingDefaultType",
  "withDecodingDefaultTypeKey"
);

const METHOD_PRESERVING = HashSet.make("check", "annotate", "annotateKey");

const ANNOTATION_HELPERS = HashSet.make("annoteSchema", "annote");

const DIRECT_CONTAINERS: HashMap.HashMap<string, number> = HashMap.make(["Struct", 0], ["TaggedStruct", 1]);

const CURRIED_CONTAINERS: HashMap.HashMap<string, number> = HashMap.make(
  ["Class", 0],
  ["Error", 0],
  ["TaggedClass", 1],
  ["TaggedError", 1]
);

const PRIMITIVE_HEADS: HashMap.HashMap<string, SchemaPrimitiveHead> = HashMap.fromIterable(
  A.map(SCHEMA_PRIMITIVE_HEADS, (head): readonly [string, SchemaPrimitiveHead] => [head.name, head])
);

const byLine: Order.Order<SchemaIdiomHint> = Order.mapInput(Order.Number, (hint: SchemaIdiomHint) => hint.line);

const IDENTITY_COMPOSER_PREFIX = "$";

type ScanScope = {
  readonly aliases: HashSet.HashSet<string>;
  readonly definitions: HashMap.HashMap<string, Expression>;
  readonly boundOnce: (name: string) => boolean;
};

type Carrier = {
  readonly outer: string;
  readonly preserving: boolean;
};

type Primitive = {
  readonly head: SchemaPrimitiveHead;
  readonly via: O.Option<string>;
};

type TextSpan = {
  readonly start: number;
  readonly end: number;
};

type BindingNode = BindingPattern | BindingRestElement | ParamPattern;

/**
 * Whether a path is a TypeScript source file the hint reads: `.ts`, `.tsx`,
 * `.mts` or `.cts`, and not a declaration, generated or test file.
 *
 * **Example** (Classify paths)
 *
 * ```ts
 * import { isSchemaIdiomHintPath } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * console.log(isSchemaIdiomHintPath("packages/demo/src/Fleet.ts")) // true
 * console.log(isSchemaIdiomHintPath("packages/demo/test/Fleet.test.ts")) // false
 * console.log(isSchemaIdiomHintPath("packages/demo/src/Fleet.gen.ts")) // false
 * ```
 *
 * @param file - Repository-relative or absolute path.
 * @returns `true` when hints may be computed for the file.
 * @category predicates
 * @since 0.0.0
 */
export const isSchemaIdiomHintPath = (file: string): boolean =>
  SOURCE_EXTENSION.test(file) && !EXCLUDED_PATH.test(file);

const unwrap = (expression: Expression): Expression =>
  Match.type<Expression>().pipe(
    Match.discriminators("type")({
      ParenthesizedExpression: (node) => unwrap(node.expression),
      TSAsExpression: (node) => unwrap(node.expression),
      TSSatisfiesExpression: (node) => unwrap(node.expression),
      TSNonNullExpression: (node) => unwrap(node.expression),
    }),
    Match.orElse((node) => node)
  )(expression);

const argumentExpression = (argument: Argument): O.Option<Expression> =>
  argument.type === "SpreadElement" ? O.none() : O.some(argument);

const isObjectExpression = (expression: Expression): expression is ObjectExpression =>
  expression.type === "ObjectExpression";

const isCallExpression = (expression: Expression): expression is CallExpression => expression.type === "CallExpression";

const isAlias = (scope: ScanScope, expression: Expression): boolean => {
  const node = unwrap(expression);
  return node.type === "Identifier" && HashSet.has(scope.aliases, node.name);
};

const isIdentityComposer = (scope: ScanScope, expression: Expression): boolean => {
  const node = unwrap(expression);
  return (
    node.type === "Identifier" && Str.startsWith(IDENTITY_COMPOSER_PREFIX)(node.name) && scope.boundOnce(node.name)
  );
};

const calleeMember = (call: CallExpression): O.Option<readonly [object: Expression, name: string]> => {
  const callee = unwrap(call.callee);
  return callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier"
    ? O.some([callee.object, callee.property.name])
    : O.none();
};

const aliasMember = (scope: ScanScope, expression: Expression): O.Option<string> => {
  const node = unwrap(expression);
  return node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    isAlias(scope, node.object)
    ? O.some(node.property.name)
    : O.none();
};

const preservesType =
  (scope: ScanScope) =>
  (argument: Argument): boolean =>
    O.exists(argumentExpression(argument), (expression) =>
      Match.type<Expression>().pipe(
        Match.discriminators("type")({
          MemberExpression: (node) =>
            O.exists(aliasMember(scope, node), (name) => HashSet.has(OPTIONAL_WRAPPERS, name)),
          CallExpression: (node) =>
            O.exists(calleeMember(node), ([object, name]) =>
              isAlias(scope, object)
                ? HashSet.has(PIPE_PRESERVING, name)
                : HashSet.has(ANNOTATION_HELPERS, name) && isIdentityComposer(scope, object)
            ),
        }),
        Match.orElse(constFalse)
      )(unwrap(expression))
    );

const methodPreserves = (scope: ScanScope, name: string, args: ReadonlyArray<Argument>): boolean =>
  name === "pipe" ? A.every(args, preservesType(scope)) : HashSet.has(METHOD_PRESERVING, name);

const primitiveOf = (scope: ScanScope, expression: Expression, hop: boolean): O.Option<Primitive> =>
  Match.type<Expression>().pipe(
    Match.discriminators("type")({
      Identifier: (node) =>
        hop
          ? pipe(
              HashMap.get(scope.definitions, node.name),
              O.flatMap((definition) => primitiveOf(scope, definition, false)),
              O.map(({ head }): Primitive => ({ head, via: O.some(node.name) }))
            )
          : O.none(),
      MemberExpression: (node) =>
        pipe(
          aliasMember(scope, node),
          O.flatMap((name) => HashMap.get(PRIMITIVE_HEADS, name)),
          O.map((head): Primitive => ({ head, via: O.none() }))
        ),
      CallExpression: (node) =>
        O.flatMap(calleeMember(node), ([object, name]) =>
          isAlias(scope, object)
            ? HashSet.has(OPTIONAL_WRAPPERS, name) && A.length(node.arguments) === 1
              ? pipe(
                  A.head(node.arguments),
                  O.flatMap(argumentExpression),
                  O.flatMap((argument) => primitiveOf(scope, argument, hop))
                )
              : O.none()
            : methodPreserves(scope, name, node.arguments)
              ? primitiveOf(scope, object, hop)
              : O.none()
        ),
    }),
    Match.orElse(() => O.none())
  )(unwrap(expression));

const fieldsOf = (scope: ScanScope, call: CallExpression): O.Option<ObjectExpression> => {
  const callee = unwrap(call.callee);
  const index =
    callee.type === "CallExpression"
      ? O.flatMap(aliasMember(scope, callee.callee), (name) => HashMap.get(CURRIED_CONTAINERS, name))
      : O.flatMap(aliasMember(scope, callee), (name) => HashMap.get(DIRECT_CONTAINERS, name));
  return pipe(
    index,
    O.filter(() => !call.optional),
    O.flatMap((position) => A.get(call.arguments, position)),
    O.flatMap(argumentExpression),
    O.map(unwrap),
    O.filter(isObjectExpression)
  );
};

const isFieldProperty = (property: ObjectExpression["properties"][number]): property is ObjectProperty =>
  property.type === "Property" && property.kind === "init" && !property.method && !property.computed;

const boundNames = (node: BindingNode | null): ReadonlyArray<string> =>
  P.isNull(node)
    ? A.empty()
    : Match.type<BindingNode>().pipe(
        Match.discriminators("type")({
          Identifier: (binding) => A.of(binding.name),
          ObjectPattern: (binding) =>
            A.flatMap(binding.properties, (property) =>
              property.type === "RestElement" ? boundNames(property.argument) : boundNames(property.value)
            ),
          ArrayPattern: (binding) => A.flatMap(binding.elements, boundNames),
          AssignmentPattern: (binding) => boundNames(binding.left),
          RestElement: (binding) => boundNames(binding.argument),
          TSParameterProperty: (binding) => boundNames(binding.parameter),
        }),
        Match.exhaustive
      )(node);

const occurrences = (names: ReadonlyArray<string>): HashMap.HashMap<string, number> =>
  A.reduce(names, HashMap.empty<string, number>(), (counts, name) =>
    HashMap.set(counts, name, O.getOrElse(HashMap.get(counts, name), () => 0) + 1)
  );

const boundOnce =
  (counts: HashMap.HashMap<string, number>) =>
  (name: string): boolean =>
    O.contains(HashMap.get(counts, name), 1);

const schemaAliases = (program: Program): ReadonlyArray<string> =>
  A.flatMap(program.body, (statement) =>
    statement.type === "ImportDeclaration" &&
    statement.source.value === SCHEMA_MODULE &&
    statement.importKind !== "type"
      ? A.flatMap(statement.specifiers, (specifier) =>
          specifier.type === "ImportNamespaceSpecifier" ? A.of(specifier.local.name) : A.empty<string>()
        )
      : A.empty<string>()
  );

type ConstDefinition = readonly [name: string, init: Expression];

const declaredConsts = (statement: Statement): ReadonlyArray<ConstDefinition> => {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  if (declaration === null || declaration.type !== "VariableDeclaration" || declaration.kind !== "const") {
    return A.empty();
  }
  return A.flatMap(
    declaration.declarations,
    (declarator): ReadonlyArray<ConstDefinition> =>
      declarator.id.type === "Identifier" && declarator.init !== null
        ? [[declarator.id.name, declarator.init]]
        : A.empty()
  );
};

const propertyName = (property: ObjectProperty): O.Option<string> =>
  Match.type<ObjectProperty["key"]>().pipe(
    Match.when({ type: "Identifier" }, (key) => O.some(key.name)),
    Match.when({ type: "Literal", value: P.isString }, (key) => O.some(key.value)),
    Match.orElse(() => O.none())
  )(property.key);

const isComputedProperty = (property: ObjectExpression["properties"][number]): boolean =>
  property.type === "Property" && property.computed;

const isSpread = (property: ObjectExpression["properties"][number]): boolean => property.type === "SpreadElement";

const effectiveFields = (fields: ObjectExpression): ReadonlyArray<ObjectProperty> => {
  if (A.some(fields.properties, isComputedProperty)) {
    return A.empty();
  }
  const lastSpread = O.getOrElse(A.findLastIndex(fields.properties, isSpread), () => -1);
  const named = occurrences(
    A.flatMap(fields.properties, (property) =>
      property.type === "Property" ? A.fromOption(propertyName(property)) : A.empty<string>()
    )
  );
  return A.filter(
    A.filter(fields.properties, (_, index) => index > lastSpread),
    (property): property is ObjectProperty =>
      isFieldProperty(property) && O.exists(propertyName(property), boundOnce(named))
  );
};

const spanKey = (node: CallExpression): string => `${node.start}:${node.end}`;

const isPipeCall = (call: CallExpression): boolean => {
  const callee = unwrap(call.callee);
  return (
    (callee.type === "Identifier" && callee.name === "pipe") ||
    O.exists(calleeMember(call), ([, name]) => name === "pipe")
  );
};

const carrierOf =
  (scope: ScanScope) =>
  (call: CallExpression): O.Option<readonly [inner: string, carrier: Carrier]> => {
    const outer = spanKey(call);
    const asReceiver = O.flatMap(calleeMember(call), ([object, name]) =>
      pipe(
        O.some(unwrap(object)),
        O.filter(isCallExpression),
        O.map((receiver): readonly [string, Carrier] => [
          spanKey(receiver),
          { outer, preserving: methodPreserves(scope, name, call.arguments) },
        ])
      )
    );
    return O.orElse(asReceiver, () =>
      isPipeCall(call)
        ? pipe(
            A.head(call.arguments),
            O.flatMap(argumentExpression),
            O.map(unwrap),
            O.filter(isCallExpression),
            O.map((first): readonly [string, Carrier] => [
              spanKey(first),
              { outer, preserving: A.every(A.drop(call.arguments, 1), preservesType(scope)) },
            ])
          )
        : O.none()
    );
  };

const rewrittenBy =
  (carriers: HashMap.HashMap<string, Carrier>) =>
  (key: string): boolean =>
    O.exists(HashMap.get(carriers, key), (carrier) => !carrier.preserving || rewrittenBy(carriers)(carrier.outer));

const lineStartsOf = (text: string): ReadonlyArray<number> =>
  A.scan(Str.split(text, "\n"), 0, (start, line) => start + Str.length(line) + 1);

const lineAt = (starts: ReadonlyArray<number>, offset: number): number =>
  A.length(A.takeWhile(starts, (start) => start <= offset));

const tellFor = (field: string, head: SchemaPrimitiveHead): O.Option<SchemaIdiomTell> =>
  A.findFirst(SCHEMA_IDIOM_TELLS, (tell) => tell.namePattern.test(field) && A.contains(tell.decodes, head.decodes));

const uniqueSpanOf =
  (text: string) =>
  (fragment: string): ReadonlyArray<TextSpan> =>
    pipe(
      O.all([Str.indexOf(fragment)(text), Str.lastIndexOf(fragment)(text)]),
      O.filter(([first, last]) => first === last),
      O.map(([start]): TextSpan => ({ start, end: start + Str.length(fragment) })),
      A.fromOption
    );

const covers =
  (property: ObjectProperty) =>
  (span: TextSpan): boolean =>
    span.start <= property.start && property.end <= span.end;

/**
 * Compute the name-tell hints of one TypeScript file.
 *
 * **Details**
 *
 * Returns no hints for a path {@link isSchemaIdiomHintPath} rejects, a file
 * that does not parse cleanly, or one that does not import `effect/Schema` as
 * a namespace. With `written` fragments, a field is hinted only when its
 * whole `key: value` span lies inside a fragment that occurs exactly once in
 * the text; a fragment that occurs twice or not at all scopes nothing.
 * Resolution still reads the whole file. Hints are sorted by line.
 *
 * **Example** (Hint a byte-size field)
 *
 * ```ts
 * import { SchemaIdiomHintInput, schemaIdiomHints } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const text = [
 *   'import * as S from "effect/Schema"',
 *   "const DiskFreeBytes = S.Natural.pipe(S.brand(\"DiskFreeBytes\"))",
 *   "export const Runner = S.Struct({ diskFreeBytes: DiskFreeBytes })",
 * ].join("\n")
 *
 * const hints = schemaIdiomHints(SchemaIdiomHintInput.make({ file: "src/Runner.ts", text, written: O.none() }))
 * console.log(A.map(hints, (hint) => `${hint.line} ${hint.field} ${hint.kind}`)) // ["3 diskFreeBytes byte-size"]
 * ```
 *
 * @param input - The file path, its full text and the optional just-written fragments.
 * @returns The advisory hints, in line order.
 * @category use-cases
 * @since 0.0.0
 */
export const schemaIdiomHints = (input: SchemaIdiomHintInput): ReadonlyArray<SchemaIdiomHint> => {
  if (!isSchemaIdiomHintPath(input.file)) {
    return A.empty();
  }
  const parsed = parseSync(input.file, input.text, {
    sourceType: "module",
    lang: Str.endsWith(".tsx")(input.file) ? "tsx" : "ts",
  });
  if (A.isReadonlyArrayNonEmpty(parsed.errors)) {
    return A.empty();
  }
  const bound = A.empty<string>();
  const calls = A.empty<CallExpression>();
  const bind = (node: BindingNode | null): void => {
    bound.push(...boundNames(node));
  };
  const bindAll = (nodes: ReadonlyArray<BindingNode>): void => {
    A.forEach(nodes, bind);
  };
  new Visitor({
    VariableDeclarator: (node) => bind(node.id),
    FunctionDeclaration: (node) => {
      bind(node.id);
      bindAll(node.params);
    },
    FunctionExpression: (node) => {
      bind(node.id);
      bindAll(node.params);
    },
    TSDeclareFunction: (node) => {
      bind(node.id);
      bindAll(node.params);
    },
    TSEmptyBodyFunctionExpression: (node) => bindAll(node.params),
    ArrowFunctionExpression: (node) => bindAll(node.params),
    ClassDeclaration: (node) => bind(node.id),
    ClassExpression: (node) => bind(node.id),
    CatchClause: (node) => bind(node.param),
    ImportSpecifier: (node) => bind(node.local),
    ImportDefaultSpecifier: (node) => bind(node.local),
    ImportNamespaceSpecifier: (node) => bind(node.local),
    TSImportEqualsDeclaration: (node) => bind(node.id),
    TSEnumDeclaration: (node) => bind(node.id),
    TSModuleDeclaration: (node) => {
      if (node.id.type === "Identifier") {
        bind(node.id);
      }
    },
    CallExpression: (node) => {
      calls.push(node);
    },
  }).visit(parsed.program);
  const once = boundOnce(occurrences(bound));
  const aliases = HashSet.fromIterable(A.filter(schemaAliases(parsed.program), once));
  if (HashSet.size(aliases) === 0) {
    return A.empty();
  }
  const scope: ScanScope = {
    aliases,
    definitions: HashMap.fromIterable(A.filter(A.flatMap(parsed.program.body, declaredConsts), ([name]) => once(name))),
    boundOnce: once,
  };
  const rewritten = rewrittenBy(HashMap.fromIterable(A.getSomes(A.map(calls, carrierOf(scope)))));
  const starts = lineStartsOf(input.text);
  const spans = O.map(input.written, A.flatMap(uniqueSpanOf(input.text)));
  const containers = A.filter(calls, (call: CallExpression) => !rewritten(spanKey(call)));
  const properties = A.filter(
    A.flatMap(containers, (call) =>
      O.match(fieldsOf(scope, call), {
        onNone: A.empty<ObjectProperty>,
        onSome: effectiveFields,
      })
    ),
    (property) => O.match(spans, { onNone: constTrue, onSome: A.some(covers(property)) })
  );
  const hints = A.getSomes(
    A.map(properties, (property) =>
      pipe(
        O.Do,
        O.bind("field", () => propertyName(property)),
        O.bind("primitive", () => primitiveOf(scope, property.value, true)),
        O.bind("tell", ({ field, primitive }) => tellFor(field, primitive.head)),
        O.map(({ field, primitive, tell }) =>
          SchemaIdiomHint.make({
            line: lineAt(starts, property.key.start),
            field,
            schemaIdentifier: primitive.via,
            kind: tell.kind,
            readsAs: tell.readsAs,
            wire: primitive.head.wire,
            shipped: tell.shipped,
          })
        )
      )
    )
  );
  return A.sort(hints, byLine);
};
