/**
 * Repo-local schema tag idiom law.
 *
 * **Details**
 *
 * PR #1943 moved the repository to the idiomatic Effect v4 tag forms. This
 * law keeps the old forms from coming back, with no allowlist:
 *
 * - `struct-tag`: `S.Struct({ _tag: S.tag(v) | S.Literal(v), ... })` must be
 *   `S.TaggedStruct(v, { ... })`.
 * - `class-tag`: `S.Class<X>(id)({ _tag: ... })`,
 *   `S.Class<X>(id)(S.Struct({ _tag: ... }))` and `S.Error<X>(id)({ _tag: ... })`
 *   must be `S.TaggedClass` or `S.TaggedError`.
 * - `single-literal-field`: a required schema field whose value is one
 *   `S.Literal(v)` must be `S.tag(v)`.
 * - `unreadable-markdown`: a Markdown file or JSDoc block that may bind
 *   `effect/Schema` but that the CommonMark parser refused, so its fences
 *   could not be checked; the law fails closed rather than passing it.
 *
 * A field is fixed when its value is `S.Literal(v)` (or `S.tag(v)` for a
 * `_tag`), optionally followed by annotation steps, `S.mutableKey`, and
 * `S.withConstructorDefault(Effect.succeed(v))`. A decoding default is allowed
 * only next to that constructor default, and never on a `_tag` that would move
 * into a tagged constructor. The value may also be a private const used only
 * as field values (`typeof` queries aside). A `_tag` that names a same-file
 * const holding a fixed tag counts as that tag, so the struct-tag and
 * class-tag rules see through it.
 *
 * Fields objects are the inline or same-file const objects passed to
 * `Struct`, `TaggedStruct`, `Class`, `Error`, `TaggedClass`, `TaggedError` and
 * `Class.extend` (a const object passed straight to one is judged like an
 * inline one), the cases of `S.TaggedUnion` and of `LiteralKit`'s
 * `toTaggedUnion`, the objects spread into any of those, and the objects a
 * `mapFields` callback returns.
 *
 * The exclusions are PR #1943's: optional keys, `S.tagDefaultOmit`,
 * `S.Literals`, `LiteralKit`, brand chains and literals behind `S.suspend`
 * are other shapes, so they never match. `Class.extend` has no tagged form,
 * so its `_tag` only needs `S.tag`. A `_tag` replaced in a `mapFields` body is
 * left alone, `_generated/` files are skipped, and Markdown under `goals/`,
 * `explorations/` and `research/` is history.
 *
 * The law scans every git-tracked TypeScript file with its JSDoc fences, plus
 * the TypeScript fences of git-tracked Markdown.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import { ts } from "ts-morph";
import { runGitRawOutput } from "../../internal/repo-run/GitExec.ts";
import { typescriptFences as sharedTypeScriptFences } from "./internal/TypeScriptFences.ts";
import { SchemaTagIdiomsExecutionError } from "./Laws.errors.ts";
import { SchemaTagIdiomFinding, SchemaTagIdiomsSummary } from "./SchemaTagIdioms.model.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";
import type { SchemaTagIdiomRule, SchemaTagIdiomsOptions } from "./SchemaTagIdioms.model.ts";

const SCHEMA_MODULE = "effect/Schema";
const EFFECT_MODULE = "effect/Effect";
const EFFECT_ROOT_MODULE = "effect";
const TAG_KEY = "_tag";
const MATCH_MAX_LENGTH = 120;
const READ_CONCURRENCY = 32;

/** Source that cannot bind `effect/Schema` is skipped before parsing. */
const SCHEMA_IMPORT_PATTERN = /["']effect(?:\/Schema)?["']/u;

const JSDOC_BLOCK_PATTERN = /\/\*\*[\s\S]*?\*\//gu;

const TYPESCRIPT_PATHSPECS = ["*.ts", "*.tsx", "*.mts", "*.cts"] as const;
const MARKDOWN_PATHSPECS = ["*.md", "*.mdx"] as const;
const MARKDOWN_HISTORY_PREFIXES = ["goals/", "explorations/", "research/"] as const;
const GENERATED_SEGMENT = "_generated/";

/** `S.annotate(...)` / `S.annotateKey(...)` steps and the `.annotate(...)` / `.annotateKey(...)` methods. */
const ANNOTATION_NAMES = HashSet.make("annotate", "annotateKey");

/** `$I.<method>` identity helpers that only annotate. */
const IDENTITY_ANNOTATION_METHODS = HashSet.make("annote", "annoteSchema", "annoteKey");

const DECODING_DEFAULT_MEMBERS = HashSet.make(
  "withDecodingDefault",
  "withDecodingDefaultKey",
  "withDecodingDefaultType",
  "withDecodingDefaultTypeKey"
);

/** Schema constructors called directly with a fields object, keyed to that argument's index. */
const DIRECT_FIELD_ARGUMENT = HashMap.make(["Struct", 0], ["TaggedStruct", 1]);

/** Curried schema class factories, keyed to the fields argument index of the second call. */
const FACTORY_FIELD_ARGUMENT = HashMap.make(["Class", 0], ["Error", 0], ["TaggedClass", 1], ["TaggedError", 1]);

/** Owners whose inline fixed `_tag` has a tagged constructor (`TaggedStruct`, `TaggedClass`, `TaggedError`). */
const TAGGABLE_OWNERS = HashSet.make("Struct", "Class", "Error");

const EXTEND_METHOD = "extend";
const MAP_FIELDS_METHOD = "mapFields";
const TO_TAGGED_UNION_METHOD = "toTaggedUnion";
const TAGGED_UNION_MEMBER = "TaggedUnion";
const MUTABLE_KEY_MEMBER = "mutableKey";
const CONSTRUCTOR_DEFAULT_MEMBER = "withConstructorDefault";
const CASES_OWNER = "cases";
const SPREAD_OWNER = "fields";

type SchemaBindings = {
  readonly namespaces: HashSet.HashSet<string>;
  readonly members: HashMap.HashMap<string, string>;
  readonly effects: HashSet.HashSet<string>;
};

type ScanContext = {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly bindings: SchemaBindings;
  readonly lineOffset: number;
};

type FixedTag = {
  readonly constructor: string;
  readonly namespace: string;
  readonly literal: ts.Expression;
  readonly constructorDefault: boolean;
  readonly decodingDefault: boolean;
  readonly otherSteps: boolean;
};

const StepKind = LiteralKit(["annotation", "mutable-key", "constructor-default", "decoding-default", "other"]);
type StepKind = typeof StepKind.Type;

type FieldObject = {
  readonly owner: string;
  readonly namespace: string;
  readonly anchor: ts.Node;
  readonly object: ts.ObjectLiteralExpression;
};

type FieldsSite = {
  readonly owner: string;
  readonly namespace: string;
  readonly call: ts.CallExpression;
  readonly argument: ts.Expression;
};

type SourceScan = {
  readonly fences: number;
  readonly findings: ReadonlyArray<SchemaTagIdiomFinding>;
};

type Fence = {
  readonly code: string;
  readonly lineOffset: number;
  readonly scriptKind: ts.ScriptKind;
};

const emptyBindings: SchemaBindings = {
  namespaces: HashSet.empty(),
  members: HashMap.empty(),
  effects: HashSet.empty(),
};

const addNamespaceImport = (bindings: SchemaBindings, module: string, local: string): SchemaBindings => {
  if (module === SCHEMA_MODULE) {
    return { ...bindings, namespaces: HashSet.add(bindings.namespaces, local) };
  }
  return module === EFFECT_MODULE ? { ...bindings, effects: HashSet.add(bindings.effects, local) } : bindings;
};

const addNamedImport = (bindings: SchemaBindings, module: string, specifier: ts.ImportSpecifier): SchemaBindings => {
  const imported = (specifier.propertyName ?? specifier.name).text;
  const local = specifier.name.text;
  if (specifier.isTypeOnly) {
    return bindings;
  }
  if (module === SCHEMA_MODULE) {
    return { ...bindings, members: HashMap.set(bindings.members, local, imported) };
  }
  if (module !== EFFECT_ROOT_MODULE) {
    return bindings;
  }
  if (imported === "Schema") {
    return { ...bindings, namespaces: HashSet.add(bindings.namespaces, local) };
  }
  return imported === "Effect" ? { ...bindings, effects: HashSet.add(bindings.effects, local) } : bindings;
};

const addImportBindings = (bindings: SchemaBindings, statement: ts.Statement): SchemaBindings => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return bindings;
  }
  const module = statement.moduleSpecifier.text;
  const namedBindings = statement.importClause?.namedBindings;
  if (statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword || P.isUndefined(namedBindings)) {
    return bindings;
  }
  return ts.isNamespaceImport(namedBindings)
    ? addNamespaceImport(bindings, module, namedBindings.name.text)
    : A.reduce(namedBindings.elements, bindings, (current, specifier) => addNamedImport(current, module, specifier));
};

const collectBindings = (sourceFile: ts.SourceFile): SchemaBindings =>
  A.reduce(sourceFile.statements, emptyBindings, addImportBindings);

// Strip parentheses, `as` / `satisfies` and angle-bracket assertions.
const unwrap = (expression: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expression) ||
  ts.isAsExpression(expression) ||
  ts.isSatisfiesExpression(expression) ||
  ts.isTypeAssertionExpression(expression)
    ? unwrap(expression.expression)
    : expression;

const schemaMember = (bindings: SchemaBindings, expression: ts.Expression): O.Option<string> => {
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    return HashSet.has(bindings.namespaces, expression.expression.text) ? O.some(expression.name.text) : O.none();
  }
  return ts.isIdentifier(expression) ? HashMap.get(bindings.members, expression.text) : O.none();
};

const isSchemaMemberIn = (
  bindings: SchemaBindings,
  expression: ts.Expression,
  names: HashSet.HashSet<string>
): boolean => O.exists(schemaMember(bindings, expression), (name) => HashSet.has(names, name));

const namespaceOf = (expression: ts.Expression): string =>
  ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
    ? expression.expression.text
    : "S";

const methodName = (expression: ts.Expression): O.Option<string> =>
  ts.isPropertyAccessExpression(expression) ? O.some(expression.name.text) : O.none();

const singleArgument = (call: ts.CallExpression): O.Option<ts.Expression> =>
  call.arguments.length === 1 ? pipe(A.get(call.arguments, 0), O.filter(P.not(ts.isSpreadElement))) : O.none();

const sameValue = (context: ScanContext, left: ts.Expression, right: ts.Expression): boolean =>
  unwrap(left).getText(context.sourceFile) === unwrap(right).getText(context.sourceFile);

const isAnnotationStep = (context: ScanContext, step: ts.Expression): boolean =>
  ts.isCallExpression(step) &&
  (isSchemaMemberIn(context.bindings, step.expression, ANNOTATION_NAMES) ||
    O.exists(methodName(step.expression), (method) => HashSet.has(IDENTITY_ANNOTATION_METHODS, method)));

// `S.mutableKey` only changes the key's mutability, so the field stays fixed to its tag.
const isMutableKeyStep = (context: ScanContext, step: ts.Expression): boolean =>
  O.exists(schemaMember(context.bindings, step), (name) => name === MUTABLE_KEY_MEMBER);

const isEffectSucceedOf = (context: ScanContext, literal: ts.Expression, expression: ts.Expression): boolean => {
  const call = unwrap(expression);
  return (
    ts.isCallExpression(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === "succeed" &&
    ts.isIdentifier(call.expression.expression) &&
    HashSet.has(context.bindings.effects, call.expression.expression.text) &&
    O.exists(singleArgument(call), (value) => sameValue(context, value, literal))
  );
};

const isLiteralConstructorDefault = (context: ScanContext, literal: ts.Expression, step: ts.Expression): boolean =>
  ts.isCallExpression(step) &&
  O.exists(schemaMember(context.bindings, step.expression), (name) => name === CONSTRUCTOR_DEFAULT_MEMBER) &&
  O.exists(singleArgument(step), (value) => isEffectSucceedOf(context, literal, value));

const isDecodingDefaultStep = (context: ScanContext, step: ts.Expression): boolean =>
  ts.isCallExpression(step) && isSchemaMemberIn(context.bindings, step.expression, DECODING_DEFAULT_MEMBERS);

const stepKind = (context: ScanContext, literal: ts.Expression, step: ts.Expression): StepKind => {
  if (isAnnotationStep(context, step)) {
    return "annotation";
  }
  if (isMutableKeyStep(context, step)) {
    return "mutable-key";
  }
  if (isLiteralConstructorDefault(context, literal, step)) {
    return "constructor-default";
  }
  return isDecodingDefaultStep(context, step) ? "decoding-default" : "other";
};

// Apply one `.pipe(...)` call's steps; a decoding default keeps the tag fixed only beside a constructor default.
const withPipeSteps = (
  context: ScanContext,
  tag: FixedTag,
  steps: ReadonlyArray<ts.Expression>
): O.Option<FixedTag> => {
  const kinds = A.map(steps, (step) => stepKind(context, tag.literal, step));
  const constructorDefault = tag.constructorDefault || A.contains(kinds, "constructor-default");
  const decodingDefault = tag.decodingDefault || A.contains(kinds, "decoding-default");
  const keepsTag = !A.contains(kinds, "other") && (constructorDefault || !decodingDefault);
  return keepsTag
    ? O.some({
        ...tag,
        constructorDefault,
        decodingDefault,
        otherSteps: tag.otherSteps || A.some(kinds, (kind) => kind !== "constructor-default"),
      })
    : O.none();
};

const fixedTagCall = (context: ScanContext, call: ts.CallExpression): O.Option<FixedTag> =>
  pipe(
    schemaMember(context.bindings, call.expression),
    O.filter((constructor) => constructor === "Literal" || constructor === "tag"),
    O.flatMap((constructor) =>
      O.map(
        singleArgument(call),
        (literal): FixedTag => ({
          constructor,
          namespace: namespaceOf(call.expression),
          literal,
          constructorDefault: constructor === "tag",
          decodingDefault: false,
          otherSteps: false,
        })
      )
    )
  );

// The fixed tag a value spells: `S.Literal(v)` or `S.tag(v)` plus tag-preserving steps.
const fixedTag = (context: ScanContext, node: ts.Expression): O.Option<FixedTag> => {
  const expression = unwrap(node);
  if (!ts.isCallExpression(expression)) {
    return O.none();
  }
  const direct = fixedTagCall(context, expression);
  const callee = expression.expression;
  if (O.isSome(direct) || !ts.isPropertyAccessExpression(callee)) {
    return direct;
  }
  const method = callee.name.text;
  if (HashSet.has(ANNOTATION_NAMES, method)) {
    return O.map(fixedTag(context, callee.expression), (tag) => ({ ...tag, otherSteps: true }));
  }
  return method === "pipe"
    ? O.flatMap(fixedTag(context, callee.expression), (tag) => withPipeSteps(context, tag, expression.arguments))
    : O.none();
};

const bindsName = (name: ts.BindingName, target: string): boolean => {
  if (ts.isIdentifier(name)) {
    return name.text === target;
  }
  return A.some(name.elements, (element) => !ts.isOmittedExpression(element) && bindsName(element.name, target));
};

const constInitializerIn = (statements: ReadonlyArray<ts.Statement>, name: string): O.Option<ts.Expression> =>
  pipe(
    statements,
    A.flatMap((statement) =>
      ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
        ? statement.declarationList.declarations
        : A.empty<ts.VariableDeclaration>()
    ),
    A.findFirst((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name),
    O.flatMap((declaration) => O.fromNullishOr(declaration.initializer)),
    O.map(unwrap)
  );

// Resolve an identifier to the initializer of the const it names in an enclosing scope of this file.
const resolveConstInitializer = (identifier: ts.Identifier): O.Option<ts.Expression> => {
  const visit = (node: ts.Node | undefined): O.Option<ts.Expression> => {
    if (P.isUndefined(node)) {
      return O.none();
    }
    if (ts.isFunctionLike(node) && A.some(node.parameters, (parameter) => bindsName(parameter.name, identifier.text))) {
      return O.none();
    }
    const declared =
      ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)
        ? constInitializerIn(node.statements, identifier.text)
        : O.none();
    return O.isSome(declared) ? declared : visit(node.parent);
  };
  return visit(identifier.parent);
};

// An inline fields object, or the object of a same-file const.
const resolveFields = (expression: ts.Expression): O.Option<ts.ObjectLiteralExpression> => {
  const value = unwrap(expression);
  if (ts.isObjectLiteralExpression(value)) {
    return O.some(value);
  }
  return ts.isIdentifier(value) ? O.filter(resolveConstInitializer(value), ts.isObjectLiteralExpression) : O.none();
};

const argumentSite = (
  owner: string,
  namespace: string,
  call: ts.CallExpression,
  index: number
): ReadonlyArray<FieldsSite> =>
  pipe(
    A.get(call.arguments, index),
    O.map((argument): FieldsSite => ({ owner, namespace, call, argument })),
    O.toArray
  );

const directSites = (context: ScanContext, call: ts.CallExpression): ReadonlyArray<FieldsSite> =>
  pipe(
    schemaMember(context.bindings, call.expression),
    O.flatMap((owner) =>
      O.map(HashMap.get(DIRECT_FIELD_ARGUMENT, owner), (index) =>
        argumentSite(owner, namespaceOf(call.expression), call, index)
      )
    ),
    O.getOrElse(A.empty<FieldsSite>)
  );

const factorySites = (context: ScanContext, call: ts.CallExpression): ReadonlyArray<FieldsSite> => {
  const factory = unwrap(call.expression);
  if (!ts.isCallExpression(factory)) {
    return A.empty();
  }
  const member = schemaMember(context.bindings, factory.expression);
  if (O.isSome(member)) {
    return pipe(
      HashMap.get(FACTORY_FIELD_ARGUMENT, member.value),
      O.map((index) => argumentSite(member.value, namespaceOf(factory.expression), call, index)),
      O.getOrElse(A.empty<FieldsSite>)
    );
  }
  return O.exists(methodName(factory.expression), (method) => method === EXTEND_METHOD)
    ? argumentSite(EXTEND_METHOD, "S", call, 0)
    : A.empty();
};

// The cases object of `S.TaggedUnion({ ... })` or `LiteralKit(...).toTaggedUnion(tag)({ ... })`.
const casesArgument = (context: ScanContext, call: ts.CallExpression): O.Option<ts.Expression> => {
  if (O.exists(schemaMember(context.bindings, call.expression), (member) => member === TAGGED_UNION_MEMBER)) {
    return A.get(call.arguments, 0);
  }
  const factory = unwrap(call.expression);
  const isCasesCall =
    ts.isCallExpression(factory) &&
    O.exists(methodName(factory.expression), (method) => method === TO_TAGGED_UNION_METHOD) &&
    O.isNone(schemaMember(context.bindings, factory.expression));
  return isCasesCall ? A.get(call.arguments, 0) : O.none();
};

const caseSites = (context: ScanContext, call: ts.CallExpression): ReadonlyArray<FieldsSite> =>
  pipe(
    casesArgument(context, call),
    O.flatMap(resolveFields),
    O.map((cases) =>
      A.flatMap(cases.properties, (property) =>
        ts.isPropertyAssignment(property)
          ? A.of<FieldsSite>({ owner: CASES_OWNER, namespace: "S", call, argument: property.initializer })
          : A.empty<FieldsSite>()
      )
    ),
    O.getOrElse(A.empty<FieldsSite>)
  );

const returnedObjects = (body: ts.ConciseBody): ReadonlyArray<ts.Expression> =>
  ts.isBlock(body)
    ? A.flatMap(body.statements, (statement) =>
        ts.isReturnStatement(statement) && P.isNotUndefined(statement.expression)
          ? A.of(statement.expression)
          : A.empty<ts.Expression>()
      )
    : A.of(body);

// The objects a `mapFields(fields => ({ ... }))` callback returns.
const mapFieldsSites = (call: ts.CallExpression): ReadonlyArray<FieldsSite> => {
  const callback = pipe(A.get(call.arguments, 0), O.map(unwrap));
  const isMapFields = O.exists(methodName(call.expression), (method) => method === MAP_FIELDS_METHOD);
  return isMapFields &&
    O.isSome(callback) &&
    (ts.isArrowFunction(callback.value) || ts.isFunctionExpression(callback.value))
    ? A.map(
        returnedObjects(callback.value.body),
        (argument): FieldsSite => ({ owner: MAP_FIELDS_METHOD, namespace: "S", call, argument })
      )
    : A.empty();
};

const callSites = (context: ScanContext, call: ts.CallExpression): ReadonlyArray<FieldsSite> =>
  A.flatten([directSites(context, call), factorySites(context, call), caseSites(context, call), mapFieldsSites(call)]);

// A same-file const fields object passed straight to a constructor keeps that owner, so its `_tag` is judged
// exactly like an inline one.
const siteFieldObject = (site: FieldsSite): O.Option<FieldObject> =>
  O.map(
    resolveFields(site.argument),
    (object): FieldObject => ({ owner: site.owner, namespace: site.namespace, anchor: site.call, object })
  );

const spreadFieldObjects = (fields: FieldObject): ReadonlyArray<FieldObject> =>
  A.flatMap(fields.object.properties, (property) =>
    ts.isSpreadAssignment(property)
      ? pipe(
          resolveFields(property.expression),
          O.map(
            (object): FieldObject => ({ owner: SPREAD_OWNER, namespace: fields.namespace, anchor: object, object })
          ),
          O.toArray
        )
      : A.empty<FieldObject>()
  );

const sameObject = (left: FieldObject, right: FieldObject): boolean => left.object === right.object;

// Add every fields object reached by spreading a known fields object, until none is new.
const closeOverSpreads = (initial: ReadonlyArray<FieldObject>): ReadonlyArray<FieldObject> => {
  let known = A.dedupeWith(initial, sameObject);
  let frontier = known;
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    const reached = A.dedupeWith(A.flatMap(frontier, spreadFieldObjects), sameObject);
    frontier = A.filter(reached, (candidate) => !A.some(known, (fields) => sameObject(fields, candidate)));
    known = A.appendAll(known, frontier);
  }
  return known;
};

const isTagProperty = (property: ts.ObjectLiteralElementLike): property is ts.PropertyAssignment =>
  ts.isPropertyAssignment(property) &&
  (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
  property.name.text === TAG_KEY;

const compact = (text: string): string => {
  const single = pipe(text, Str.replace(/\s+/gu, " "), Str.trim);
  return Str.length(single) > MATCH_MAX_LENGTH ? `${Str.slice(0, MATCH_MAX_LENGTH - 1)(single)}…` : single;
};

const makeFinding = (
  context: ScanContext,
  node: ts.Node,
  rule: SchemaTagIdiomRule,
  match: string,
  suggestion: string
): SchemaTagIdiomFinding => {
  const position = context.sourceFile.getLineAndCharacterOfPosition(node.getStart(context.sourceFile));
  return SchemaTagIdiomFinding.make({
    file: context.file,
    line: context.lineOffset + position.line + 1,
    column: position.character + 1,
    rule,
    match: compact(match),
    suggestion,
  });
};

// A `_tag` value, through the same-file const it names when it is an identifier.
const tagValue = (property: ts.PropertyAssignment): ts.Expression => {
  const value = unwrap(property.initializer);
  return ts.isIdentifier(value) ? O.getOrElse(resolveConstInitializer(value), () => value) : value;
};

// A fixed `_tag` the struct-tag or class-tag rule moves into a tagged constructor.
const movableTag = (context: ScanContext, property: ts.PropertyAssignment): O.Option<FixedTag> =>
  O.filter(fixedTag(context, tagValue(property)), (tag) => !tag.decodingDefault);

const movableTagProperty = (
  context: ScanContext,
  fields: FieldObject
): O.Option<readonly [ts.PropertyAssignment, FixedTag]> =>
  HashSet.has(TAGGABLE_OWNERS, fields.owner)
    ? pipe(
        A.findFirst(fields.object.properties, isTagProperty),
        O.flatMap((property) => O.map(movableTag(context, property), (tag) => [property, tag] as const))
      )
    : O.none();

// The `S.Class` / `S.Error` call whose fields argument is this inline `S.Struct(...)` call.
const enclosingClassCall = (context: ScanContext, fields: FieldObject): O.Option<FieldObject> => {
  const struct = fields.anchor;
  const parent = struct.parent;
  if (
    !ts.isCallExpression(parent) ||
    !O.exists(A.get(parent.arguments, 0), (argument) => unwrap(argument) === struct)
  ) {
    return O.none();
  }
  const factory = unwrap(parent.expression);
  return ts.isCallExpression(factory)
    ? pipe(
        schemaMember(context.bindings, factory.expression),
        O.filter((owner) => owner === "Class" || owner === "Error"),
        O.map(
          (owner): FieldObject => ({
            owner,
            namespace: namespaceOf(factory.expression),
            anchor: parent,
            object: fields.object,
          })
        )
      )
    : O.none();
};

const tagFinding = (
  context: ScanContext,
  fields: FieldObject,
  property: ts.PropertyAssignment,
  tag: FixedTag
): SchemaTagIdiomFinding => {
  const owner = fields.owner === "Struct" ? O.getOrElse(enclosingClassCall(context, fields), () => fields) : fields;
  const literal = tag.literal.getText(context.sourceFile);
  const tagText = property.getText(context.sourceFile);
  return owner.owner === "Struct"
    ? makeFinding(
        context,
        owner.anchor,
        "struct-tag",
        `${owner.namespace}.Struct({ ${tagText}, … })`,
        `${owner.namespace}.TaggedStruct(${literal}, { … })`
      )
    : makeFinding(
        context,
        owner.anchor,
        "class-tag",
        `${owner.namespace}.${owner.owner}<Self>(identifier)({ ${tagText}, … })`,
        `${owner.namespace}.Tagged${owner.owner}<Self>(identifier)(${literal}, { … })`
      );
};

const tagSuggestion = (context: ScanContext, tag: FixedTag): string =>
  `${tag.namespace}.tag(${tag.literal.getText(context.sourceFile)})${tag.otherSteps ? "…" : ""}`;

// Whether the struct-tag / class-tag rule owns this property, or a `mapFields` body replaces `_tag`.
const isTagHandledElsewhere = (context: ScanContext, fields: FieldObject, property: ts.PropertyAssignment): boolean =>
  isTagProperty(property) &&
  (fields.owner === MAP_FIELDS_METHOD ||
    (HashSet.has(TAGGABLE_OWNERS, fields.owner) && O.isSome(movableTag(context, property))));

const literalFieldFinding = (
  context: ScanContext,
  fields: FieldObject,
  property: ts.ObjectLiteralElementLike
): O.Option<SchemaTagIdiomFinding> =>
  ts.isPropertyAssignment(property) && !isTagHandledElsewhere(context, fields, property)
    ? pipe(
        fixedTag(context, property.initializer),
        O.filter((tag) => tag.constructor === "Literal"),
        O.map((tag) =>
          makeFinding(
            context,
            property,
            "single-literal-field",
            property.getText(context.sourceFile),
            `${property.name.getText(context.sourceFile)}: ${tagSuggestion(context, tag)}`
          )
        )
      )
    : O.none();

const fieldFindings = (context: ScanContext, fields: FieldObject): ReadonlyArray<SchemaTagIdiomFinding> =>
  A.appendAll(
    pipe(
      movableTagProperty(context, fields),
      O.map(([property, tag]) => tagFinding(context, fields, property, tag)),
      O.toArray
    ),
    A.getSomes(A.map(fields.object.properties, (property) => literalFieldFinding(context, fields, property)))
  );

const collectNodes = (sourceFile: ts.SourceFile): ReadonlyArray<ts.Node> => {
  const nodes = A.empty<ts.Node>();
  const visit = (node: ts.Node): void => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodes;
};

// A same-named identifier in a name slot (a property, key, member or declaration name) does not read the const.
// A shorthand property and an export list entry are both a name and a read.
const isNamePosition = (identifier: ts.Identifier): boolean => {
  const parent = identifier.parent;
  return (
    "name" in parent &&
    parent.name === identifier &&
    !ts.isShorthandPropertyAssignment(parent) &&
    !ts.isExportSpecifier(parent)
  );
};

// Whether an identifier reads the binding; `typeof` queries only follow its type, so they are not reads.
const isValueReference = (identifier: ts.Identifier): boolean =>
  !(isNamePosition(identifier) || ts.isQualifiedName(identifier.parent) || ts.isTypeQueryNode(identifier.parent));

// The outermost expression that only wraps `node` in annotation or `S.mutableKey` steps.
const annotatedReference = (context: ScanContext, node: ts.Expression): ts.Expression => {
  const access = node.parent;
  if (!ts.isPropertyAccessExpression(access) || !ts.isCallExpression(access.parent)) {
    return node;
  }
  const call = access.parent;
  const method = access.name.text;
  const isAnnotation =
    HashSet.has(ANNOTATION_NAMES, method) ||
    (method === "pipe" &&
      A.every(call.arguments, (step) => isAnnotationStep(context, step) || isMutableKeyStep(context, step)));
  return isAnnotation && call.expression === access ? annotatedReference(context, call) : node;
};

// Whether a reference is the whole value of a property in a scanned fields object.
const isFieldValueReference = (
  context: ScanContext,
  fieldObjects: ReadonlyArray<FieldObject>,
  identifier: ts.Identifier
): boolean => {
  if (ts.isShorthandPropertyAssignment(identifier.parent)) {
    return A.some(fieldObjects, (fields) => fields.object === identifier.parent.parent);
  }
  const value = annotatedReference(context, identifier);
  const property = value.parent;
  return (
    ts.isPropertyAssignment(property) &&
    property.initializer === value &&
    A.some(
      fieldObjects,
      (fields) => fields.object === property.parent && !isTagHandledElsewhere(context, fields, property)
    )
  );
};

type PrivateConst = ts.VariableDeclaration & { readonly name: ts.Identifier; readonly initializer: ts.Expression };

const isPrivateConst = (declaration: ts.VariableDeclaration): declaration is PrivateConst =>
  ts.isIdentifier(declaration.name) &&
  P.isNotUndefined(declaration.initializer) &&
  ts.isVariableDeclarationList(declaration.parent) &&
  (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
  ts.isVariableStatement(declaration.parent.parent) &&
  (ts.getCombinedModifierFlags(declaration) & (ts.ModifierFlags.Export | ts.ModifierFlags.Ambient)) === 0;

const privateConstFinding = (
  context: ScanContext,
  identifiers: ReadonlyArray<ts.Identifier>,
  fieldObjects: ReadonlyArray<FieldObject>,
  declaration: ts.VariableDeclaration
): O.Option<SchemaTagIdiomFinding> => {
  if (!isPrivateConst(declaration)) {
    return O.none();
  }
  const name = declaration.name.text;
  const references = A.filter(
    identifiers,
    (identifier) => identifier !== declaration.name && identifier.text === name && isValueReference(identifier)
  );
  const onlyFieldValues =
    A.isReadonlyArrayNonEmpty(references) &&
    A.every(references, (reference) => isFieldValueReference(context, fieldObjects, reference));
  return onlyFieldValues
    ? pipe(
        fixedTag(context, declaration.initializer),
        O.filter((tag) => tag.constructor === "Literal"),
        O.map((tag) =>
          makeFinding(
            context,
            declaration,
            "single-literal-field",
            `const ${declaration.getText(context.sourceFile)}`,
            `const ${name} = ${tagSuggestion(context, tag)}`
          )
        )
      )
    : O.none();
};

const byPosition = Order.combine(
  Order.mapInput(Order.Number, (finding: SchemaTagIdiomFinding) => finding.line),
  Order.mapInput(Order.Number, (finding: SchemaTagIdiomFinding) => finding.column)
);

const scanParsedSource = (context: ScanContext): ReadonlyArray<SchemaTagIdiomFinding> => {
  const nodes = collectNodes(context.sourceFile);
  const calls: ReadonlyArray<ts.CallExpression> = A.filter(nodes, ts.isCallExpression);
  const sites = A.flatMap(calls, (call) => callSites(context, call));
  const fieldObjects = closeOverSpreads(A.getSomes(A.map(sites, siteFieldObject)));
  const identifiers = A.filter(nodes, ts.isIdentifier);
  const constFindings = A.getSomes(
    A.map(A.filter(nodes, ts.isVariableDeclaration), (declaration) =>
      privateConstFinding(context, identifiers, fieldObjects, declaration)
    )
  );
  return A.sort(
    A.appendAll(
      A.flatMap(fieldObjects, (fields) => fieldFindings(context, fields)),
      constFindings
    ),
    byPosition
  );
};

const scriptKindOf = (file: string): ts.ScriptKind =>
  Str.endsWith(".tsx")(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

const scanCode = (
  file: string,
  code: string,
  lineOffset: number,
  scriptKind: ts.ScriptKind
): ReadonlyArray<SchemaTagIdiomFinding> => {
  if (!SCHEMA_IMPORT_PATTERN.test(code)) {
    return A.empty();
  }
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKind);
  return scanParsedSource({ file, sourceFile, bindings: collectBindings(sourceFile), lineOffset });
};

const emptyText = constant("");
const zero = constant(0);

// A capture group the pattern always matches; the fallback only satisfies the type.
const groupText = (match: RegExpMatchArray, group: number): string => O.getOrElse(A.get(match, group), emptyText);
const matchIndex = (match: RegExpMatchArray): number => O.getOrElse(O.fromNullishOr(match.index), zero);

const lineIndexAt = (text: string, index: number): number => A.length(Str.split("\n")(Str.slice(0, index)(text))) - 1;

type FenceRead = {
  readonly fences: ReadonlyArray<Fence>;
  readonly unreadable: ReadonlyArray<SchemaTagIdiomFinding>;
};

// The TypeScript fences of a Markdown or JSDoc text starting at line `lineOffset`, and an
// `unreadable-markdown` finding when the parser refused a text that may bind `effect/Schema`.
const typescriptFences = (file: string, content: string, lineOffset = 0): FenceRead => {
  const [fences, warnings] = sharedTypeScriptFences(content);
  return {
    fences: A.map(
      fences,
      (fence): Fence => ({
        code: fence.code,
        lineOffset: lineOffset + fence.codeLineIndex,
        scriptKind: fence.language === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      })
    ),
    unreadable: SCHEMA_IMPORT_PATTERN.test(content)
      ? A.map(warnings, (warning) =>
          SchemaTagIdiomFinding.make({
            file,
            line: lineOffset + 1,
            column: 1,
            rule: "unreadable-markdown",
            match: compact(warning),
            suggestion: "Flatten the blockquote or list nesting so the CommonMark parser can read the fences.",
          })
        )
      : A.empty(),
  };
};

const jsDocLine = (line: string): string =>
  pipe(line, Str.replace(/^\s*\/\*\*/u, ""), Str.replace(/\*\/\s*$/u, ""), Str.replace(/^\s*\* ?/u, ""));

// TypeScript fences inside the JSDoc blocks of a source file; lines map one to one.
const jsDocFences = (file: string, text: string): FenceRead => {
  const reads = pipe(
    Str.matchAll(JSDOC_BLOCK_PATTERN)(text),
    A.fromIterable,
    A.filter((block) => SCHEMA_IMPORT_PATTERN.test(groupText(block, 0))),
    A.map((block) =>
      typescriptFences(
        file,
        pipe(groupText(block, 0), Str.split("\n"), A.map(jsDocLine), A.join("\n")),
        lineIndexAt(text, matchIndex(block))
      )
    )
  );
  return {
    fences: A.flatMap(reads, (read) => read.fences),
    unreadable: A.flatMap(reads, (read) => read.unreadable),
  };
};

// Scan the fences that can bind `effect/Schema`; the count is of those fences. A text the parser
// refused contributes its `unreadable-markdown` finding first.
const scanFences = (file: string, read: FenceRead): SourceScan => {
  const schemaFences = A.filter(read.fences, (fence) => SCHEMA_IMPORT_PATTERN.test(fence.code));
  return {
    fences: A.length(schemaFences),
    findings: A.appendAll(
      read.unreadable,
      A.flatMap(schemaFences, (fence) => scanCode(file, fence.code, fence.lineOffset, fence.scriptKind))
    ),
  };
};

const scanTypeScriptText = (file: string, text: string): SourceScan => {
  const fences = scanFences(file, jsDocFences(file, text));
  return { fences: fences.fences, findings: A.appendAll(scanCode(file, text, 0, scriptKindOf(file)), fences.findings) };
};

/**
 * Scan one TypeScript source text, JSDoc examples included, for non-idiomatic schema tag forms.
 *
 * **Example** (Find a single-literal field)
 *
 * ```ts
 * import { scanSchemaTagIdioms } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms"
 *
 * const source = [
 *   'import * as S from "effect/Schema"',
 *   'export const Demo = S.Struct({ kind: S.Literal("demo") })',
 * ].join("\n")
 *
 * for (const finding of scanSchemaTagIdioms("Demo.ts", source)) {
 *   console.log(finding.suggestion) // 'kind: S.tag("demo")'
 * }
 * ```
 *
 * @param file - Repo-relative path reported on each finding.
 * @param text - TypeScript source text.
 * @returns Code findings by position, then JSDoc example findings by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanSchemaTagIdioms: {
  (text: string): (file: string) => ReadonlyArray<SchemaTagIdiomFinding>;
  (file: string, text: string): ReadonlyArray<SchemaTagIdiomFinding>;
} = dual(
  2,
  (file: string, text: string): ReadonlyArray<SchemaTagIdiomFinding> => scanTypeScriptText(file, text).findings
);

/**
 * Scan the TypeScript fences of one Markdown text for non-idiomatic schema tag forms.
 *
 * **Details**
 *
 * Each fence parses on its own, so a fence only matches when it imports
 * `effect/Schema` itself. Reported lines are lines of the Markdown file.
 *
 * **Example** (Find a fenced struct tag)
 *
 * ```ts
 * import { scanSchemaTagIdiomsMarkdown } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms"
 *
 * const fence = "`".repeat(3)
 * const markdown = [
 *   `${fence}ts`,
 *   'import * as S from "effect/Schema"',
 *   'const Demo = S.Struct({ _tag: S.Literal("Demo") })',
 *   fence,
 * ].join("\n")
 *
 * console.log(scanSchemaTagIdiomsMarkdown("README.md", markdown).map((finding) => finding.rule)) // ["struct-tag"]
 * ```
 *
 * @param file - Repo-relative Markdown path reported on each finding.
 * @param content - Markdown text.
 * @returns Findings by fence, each fence's by position.
 * @category utilities
 * @since 0.0.0
 */
export const scanSchemaTagIdiomsMarkdown: {
  (content: string): (file: string) => ReadonlyArray<SchemaTagIdiomFinding>;
  (file: string, content: string): ReadonlyArray<SchemaTagIdiomFinding>;
} = dual(
  2,
  (file: string, content: string): ReadonlyArray<SchemaTagIdiomFinding> =>
    scanFences(file, typescriptFences(file, content)).findings
);

/**
 * Reports whether a git-tracked TypeScript path is in the law's scope.
 *
 * **Example** (Skip generated files)
 *
 * ```ts
 * import { isSchemaTagIdiomsTypeScriptPath } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms"
 *
 * console.log(isSchemaTagIdiomsTypeScriptPath("packages/demo/src/Demo.ts")) // true
 * console.log(isSchemaTagIdiomsTypeScriptPath("packages/demo/src/_generated/Demo.ts")) // false
 * ```
 *
 * @param file - Repo-relative path.
 * @returns `false` for files under a `_generated/` directory.
 * @category predicates
 * @since 0.0.0
 */
export const isSchemaTagIdiomsTypeScriptPath = (file: string): boolean =>
  !(Str.startsWith(GENERATED_SEGMENT)(file) || Str.includes(`/${GENERATED_SEGMENT}`)(file));

/**
 * Reports whether a git-tracked Markdown path is in the law's scope.
 *
 * **Example** (Skip Markdown history)
 *
 * ```ts
 * import { isSchemaTagIdiomsMarkdownPath } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms"
 *
 * console.log(isSchemaTagIdiomsMarkdownPath(".patterns/schema.md")) // true
 * console.log(isSchemaTagIdiomsMarkdownPath("goals/demo/SPEC.md")) // false
 * ```
 *
 * @param file - Repo-relative path.
 * @returns `false` under `goals/`, `explorations/`, `research/` or a `_generated/` directory.
 * @category predicates
 * @since 0.0.0
 */
export const isSchemaTagIdiomsMarkdownPath = (file: string): boolean =>
  isSchemaTagIdiomsTypeScriptPath(file) && !A.some(MARKDOWN_HISTORY_PREFIXES, (prefix) => Str.startsWith(prefix)(file));

/**
 * Render one finding as a `file:line:col  [rule] match  →  suggestion` report line.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { formatSchemaTagIdiomFinding, scanSchemaTagIdioms } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms"
 *
 * const source = 'import * as S from "effect/Schema"\nconst Demo = S.Struct({ kind: S.Literal("demo") })\n'
 * for (const finding of scanSchemaTagIdioms("Demo.ts", source)) {
 *   console.log(formatSchemaTagIdiomFinding(finding))
 * }
 * ```
 *
 * @param finding - The finding to render.
 * @returns One human-readable report line.
 * @category utilities
 * @since 0.0.0
 */
export const formatSchemaTagIdiomFinding = (finding: SchemaTagIdiomFinding): string =>
  `${finding.file}:${finding.line}:${finding.column}  [${finding.rule}] ${finding.match}  →  ${finding.suggestion}`;

const gitErrorAdapter: GitCommandErrorAdapter<SchemaTagIdiomsExecutionError> = {
  onSpawnFailure: (commandLine) => () => SchemaTagIdiomsExecutionError.new(`Failed to spawn ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    SchemaTagIdiomsExecutionError.new(`${commandLine} failed with exit code ${exitCode}.`),
  onTruncated: O.none(),
};

/** Unbounded NUL-separated listing: the tracked Markdown paths alone exceed the bounded readers' 512 KiB. */
const listTracked = Effect.fnUntraced(function* (repoRoot: string, pathspecs: ReadonlyArray<string>) {
  const output = yield* runGitRawOutput(repoRoot, ["ls-files", "-z", "--", ...pathspecs], gitErrorAdapter);
  return A.filter(Str.split("\0")(output), Str.isNonEmpty);
});

const scanTrackedFile = Effect.fnUntraced(function* (repoRoot: string, file: string, markdown: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const content = yield* fs.readFileString(path.join(repoRoot, file)).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeedNone
    ),
    SchemaTagIdiomsExecutionError.mapError(`Failed to read ${file}`)
  );
  return O.map(content, (text) =>
    markdown ? scanFences(file, typescriptFences(file, text)) : scanTypeScriptText(file, text)
  );
});

/**
 * Run the schema tag idiom law over the git-tracked TypeScript and Markdown files.
 *
 * **Details**
 *
 * Lists TypeScript and Markdown files with `git ls-files`, drops
 * `_generated/` files and the Markdown history trees, and scans the
 * working-tree text. Index entries deleted from the working tree are skipped.
 *
 * **Example** (Count findings in the repository)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { SchemaTagIdiomsOptions } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms.model"
 * import { runSchemaTagIdioms } from "@beep/repo-cli/commands/Laws/SchemaTagIdioms"
 *
 * const program = Effect.map(
 *   runSchemaTagIdioms(SchemaTagIdiomsOptions.make({ cwd: process.cwd(), strictCheck: true })),
 *   (summary) => summary.findings.length
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location and strictness.
 * @returns Effect that scans the tracked files and summarizes every finding.
 * @category utilities
 * @since 0.0.0
 */
export const runSchemaTagIdioms = Effect.fn("SchemaTagIdioms.runSchemaTagIdioms")(function* (
  options: SchemaTagIdiomsOptions
): Effect.fn.Return<
  SchemaTagIdiomsSummary,
  SchemaTagIdiomsExecutionError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    SchemaTagIdiomsExecutionError.mapError("Failed to locate the repository root")
  );
  const typescript = A.filter(yield* listTracked(repoRoot, TYPESCRIPT_PATHSPECS), isSchemaTagIdiomsTypeScriptPath);
  const markdown = A.filter(yield* listTracked(repoRoot, MARKDOWN_PATHSPECS), isSchemaTagIdiomsMarkdownPath);
  const scans = yield* Effect.forEach(
    A.appendAll(
      A.map(typescript, (file) => [file, false] as const),
      A.map(markdown, (file) => [file, true] as const)
    ),
    ([file, isMarkdown]) => scanTrackedFile(repoRoot, file, isMarkdown),
    { concurrency: READ_CONCURRENCY }
  );
  const present = A.getSomes(scans);
  const findings = A.flatMap(present, (scan) => scan.findings);

  return SchemaTagIdiomsSummary.make({
    scannedFiles: A.length(present),
    scannedFences: A.reduce(present, 0, (total, scan) => total + scan.fences),
    strictFailure: options.strictCheck && A.isReadonlyArrayNonEmpty(findings),
    findings,
  });
});
