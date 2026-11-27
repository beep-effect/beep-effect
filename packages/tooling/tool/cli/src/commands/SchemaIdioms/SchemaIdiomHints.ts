/**
 * The schema idiom hint core: a pure scan of one TypeScript file for schema
 * fields whose name reads as a richer value (an instant, duration, byte size,
 * URL, network address, port or version) while their schema decodes to a
 * primitive.
 *
 * **Details**
 *
 * The file is parsed with `oxc-parser`, so comments and JSDoc examples never
 * produce hints. A field counts only inside an object literal whose value is
 * an `effect/Schema`-rooted expression, or names a same-file `const` that is
 * one (one hop; an imported identifier is not followed). A schema that
 * already mentions a rich codec for the kind, or converts through
 * `decodeTo` / a transformation, is left alone.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { parseSync, Visitor } from "oxc-parser";
import { SCHEMA_IDIOM_TELLS, SCHEMA_PRIMITIVE_HEADS, SchemaIdiomHint } from "./SchemaIdiomHints.model.ts";
import type { Argument, Expression, ObjectProperty, Program, Statement } from "oxc-parser";
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

const CONVERSION_MARKERS = HashSet.make(
  "decodeTo",
  "encodeTo",
  "decode",
  "encode",
  "transform",
  "transformOrFail",
  "SchemaTransformation",
  "SchemaGetter"
);

const PRIMITIVE_HEADS: HashMap.HashMap<string, SchemaPrimitiveHead> = HashMap.fromIterable(
  A.map(SCHEMA_PRIMITIVE_HEADS, (head): readonly [string, SchemaPrimitiveHead] => [head.name, head])
);

const TELL_PATTERNS = A.map(SCHEMA_IDIOM_TELLS, (tell): readonly [SchemaIdiomTell, RegExp] => [
  tell,
  new RegExp(tell.namePattern),
]);

const byLine: Order.Order<SchemaIdiomHint> = Order.mapInput(Order.Number, (hint: SchemaIdiomHint) => hint.line);

type ScanScope = {
  readonly aliases: HashSet.HashSet<string>;
  readonly definitions: HashMap.HashMap<string, Expression>;
};

type NamedSpan = {
  readonly name: string;
  readonly start: number;
};

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

const rootOf = (expression: Expression): O.Option<string> =>
  Match.type<Expression>().pipe(
    Match.discriminators("type")({
      Identifier: (node) => O.some(node.name),
      MemberExpression: (node) => rootOf(node.object),
      CallExpression: (node) => rootOf(node.callee),
    }),
    Match.orElse(() => O.none())
  )(unwrap(expression));

const isAlias = (scope: ScanScope, expression: Expression): boolean => {
  const node = unwrap(expression);
  return node.type === "Identifier" && HashSet.has(scope.aliases, node.name);
};

const headOf = (scope: ScanScope, expression: Expression, hop: boolean): O.Option<string> =>
  Match.type<Expression>().pipe(
    Match.discriminators("type")({
      Identifier: (node) =>
        hop ? O.flatMap(HashMap.get(scope.definitions, node.name), (def) => headOf(scope, def, false)) : O.none(),
      MemberExpression: (node) =>
        !node.computed && isAlias(scope, node.object) && node.property.type === "Identifier"
          ? O.some(node.property.name)
          : O.none(),
      CallExpression: (node) => {
        const callee = unwrap(node.callee);
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") {
          return O.none();
        }
        if (!isAlias(scope, callee.object)) {
          return headOf(scope, callee.object, hop);
        }
        const name = callee.property.name;
        return HashSet.has(OPTIONAL_WRAPPERS, name)
          ? pipe(
              A.head(node.arguments),
              O.flatMap(argumentExpression),
              O.flatMap((argument) => headOf(scope, argument, hop))
            )
          : O.some(name);
      },
    }),
    Match.orElse(() => O.none())
  )(unwrap(expression));

const schemaAliases = (program: Program): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.flatMap(program.body, (statement) =>
      statement.type === "ImportDeclaration" && statement.source.value === SCHEMA_MODULE
        ? A.flatMap(statement.specifiers, (specifier) =>
            specifier.type === "ImportNamespaceSpecifier" ? [specifier.local.name] : A.empty<string>()
          )
        : A.empty<string>()
    )
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
  property.computed
    ? O.none()
    : Match.type<ObjectProperty["key"]>().pipe(
        Match.when({ type: "Identifier" }, (key) => O.some(key.name)),
        Match.when({ type: "Literal", value: P.isString }, (key) => O.some(key.value)),
        Match.orElse(() => O.none())
      )(property.key);

const lineStartsOf = (text: string): ReadonlyArray<number> =>
  A.scan(Str.split(text, "\n"), 0, (start, line) => start + Str.length(line) + 1);

const lineAt = (starts: ReadonlyArray<number>, offset: number): number =>
  A.length(A.takeWhile(starts, (start) => start <= offset));

const namesWithin = (names: ReadonlyArray<NamedSpan>, start: number, end: number): ReadonlyArray<string> =>
  A.map(
    A.filter(names, (span) => span.start >= start && span.start < end),
    (span) => span.name
  );

const tellFor = (field: string, head: SchemaPrimitiveHead): O.Option<SchemaIdiomTell> =>
  pipe(
    A.findFirst(TELL_PATTERNS, ([tell, pattern]) => pattern.test(field) && A.contains(tell.decodes, head.decodes)),
    O.map(([tell]) => tell)
  );

const alreadyConverted = (tell: SchemaIdiomTell, names: ReadonlyArray<string>): boolean =>
  A.some(
    names,
    (name) => HashSet.has(CONVERSION_MARKERS, name) || A.some(tell.richMarkers, (marker) => Str.includes(marker)(name))
  );

const writtenLinesOf = (written: string): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.filter(A.map(Str.split(written, "\n"), Str.trim), Str.isNonEmpty));

/**
 * Compute the name-tell hints of one TypeScript file.
 *
 * **Details**
 *
 * Returns no hints for a path {@link isSchemaIdiomHintPath} rejects or a file
 * that does not import `effect/Schema` as a namespace. With `written`, only
 * fields whose trimmed line appears among the written text's lines are
 * hinted; resolution still reads the whole file. Hints are sorted by line.
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
 * @param input - The file path, its full text and the optional just-written subset.
 * @returns The advisory hints, in line order.
 * @category use-cases
 * @since 0.0.0
 */
export const schemaIdiomHints = (input: SchemaIdiomHintInput): ReadonlyArray<SchemaIdiomHint> => {
  if (!isSchemaIdiomHintPath(input.file)) {
    return A.empty();
  }
  const { program } = parseSync(input.file, input.text, {
    sourceType: "module",
    lang: Str.endsWith(".tsx")(input.file) ? "tsx" : "ts",
  });
  const aliases = schemaAliases(program);
  if (HashSet.size(aliases) === 0) {
    return A.empty();
  }
  const scope: ScanScope = { aliases, definitions: HashMap.fromIterable(A.flatMap(program.body, declaredConsts)) };
  const names = A.empty<NamedSpan>();
  const properties = A.empty<ObjectProperty>();
  new Visitor({
    Identifier: (node) => {
      names.push({ name: node.name, start: node.start });
    },
    ObjectExpression: (node) => {
      for (const property of node.properties) {
        if (property.type === "Property" && property.kind === "init" && !property.method) {
          properties.push(property);
        }
      }
    },
  }).visit(program);
  const starts = lineStartsOf(input.text);
  const lines = Str.split(input.text, "\n");
  const written = O.map(input.written, writtenLinesOf);
  const hints = A.getSomes(
    A.map(properties, (property) =>
      pipe(
        O.Do,
        O.bind("field", () => propertyName(property)),
        O.bind("value", () => O.some(unwrap(property.value))),
        O.bind("root", ({ value }) => rootOf(value)),
        O.bind("schemaIdentifier", ({ root }) =>
          HashSet.has(aliases, root)
            ? O.some(O.none<string>())
            : pipe(
                HashMap.get(scope.definitions, root),
                O.filter((definition) => O.exists(rootOf(definition), (defRoot) => HashSet.has(aliases, defRoot))),
                O.as(O.some(root))
              )
        ),
        O.let("line", () => lineAt(starts, property.key.start)),
        O.filter(({ line }) =>
          O.match(written, {
            onNone: () => true,
            onSome: (set) => O.exists(A.get(lines, line - 1), (text) => HashSet.has(set, Str.trim(text))),
          })
        ),
        O.bind("head", ({ value }) =>
          O.flatMap(headOf(scope, value, true), (name) => HashMap.get(PRIMITIVE_HEADS, name))
        ),
        O.bind("tell", ({ field, head }) => tellFor(field, head)),
        O.filter(({ value, schemaIdentifier, tell }) => {
          const own = namesWithin(names, value.start, value.end);
          const resolved = pipe(
            schemaIdentifier,
            O.flatMap((identifier) => HashMap.get(scope.definitions, identifier)),
            O.map((definition) => namesWithin(names, definition.start, definition.end)),
            O.getOrElse(A.empty<string>)
          );
          return !alreadyConverted(tell, A.appendAll(own, resolved));
        }),
        O.map(({ field, line, schemaIdentifier, tell, head }) =>
          SchemaIdiomHint.make({
            line,
            field,
            schemaIdentifier,
            kind: tell.kind,
            readsAs: tell.readsAs,
            wire: head.wire,
            shipped: tell.shipped,
          })
        )
      )
    )
  );
  return A.sort(hints, byLine);
};
