/**
 * Runtime and boundary models for the confined CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import {
  LiteralKit,
  MutableHashMapFromSelf,
  NonNegativeInt,
  SchemaUtils,
  TaggedErrorClass
} from "@beep/schema";
import {A, N, O, P} from "@beep/utils";
import {Effect, MutableHashMap, Result} from "effect";
import * as S from "effect/Schema";
import type {SafeObject} from "@beep/schema/SafeObject";
import {ToolError} from "../Codemode.tool-error.ts";
import {ToolRuntimeError} from "../Codemode.tool-runtime.ts";
import {
  arrayMethods,
  arrayStatics,
  ConsoleMethod,
  dateMethods,
  dateStatics,
  mapMethods,
  mapStatics,
  mathMethods,
  numberMethods,
  numberStatics,
  objectStatics,
  regexpMethods,
  regexpStatics,
  setMethods,
  stringMethods,
  stringStatics,
  UrlMethod,
  UrlSearchParamsMethod,
  UrlStatic,
} from "../Codemode.method-names.ts";
import {
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
} from "../Codemode.values.ts";

const $I = $ScratchpadId.create("codemode/interpreter/Interpreter.model");

/**
 * One source coordinate reported by Acorn.
 *
 * @category models
 * @since 0.0.0
 */
export class SourcePosition extends S.Class<SourcePosition>($I`SourcePosition`)(
  {
    line: NonNegativeInt,
    column: NonNegativeInt,
  },
  $I.annote("SourcePosition", {
    description: "One zero- or one-based parser source coordinate before CodeMode wrapper adjustment.",
  })
) {
  static readonly new = (line: number, column: number): SourcePosition =>
    SourcePosition.make({
      line: NonNegativeInt.make(line),
      column: NonNegativeInt.make(column),
    });
}

/**
 * Source range attached to a parsed node.
 *
 * @category models
 * @since 0.0.0
 */
export class SourceLocation extends S.Class<SourceLocation>($I`SourceLocation`)(
  {
    start: SourcePosition,
    end: SourcePosition,
  },
  $I.annote("SourceLocation", {
    description: "Start and end coordinates attached to a parsed JavaScript node.",
  })
) {
  static readonly new = (start: SourcePosition, end: SourcePosition): SourceLocation =>
    SourceLocation.make({start, end});
}

const AstNodeType = S.NonEmptyString.check(S.isTrimmed()).pipe(
  $I.annoteSchema("AstNodeType", {
    description: "A non-empty trimmed Acorn node discriminator.",
  })
);

/**
 * Recursively decodes values owned by an Acorn node.
 *
 * The final `S.Unknown` branch deliberately preserves parser-specific opaque
 * values (for example the native `RegExp` stored on a regular-expression
 * literal), while arrays, records, and nested nodes are normalized first.
 */
const AstValue: S.Codec<unknown, unknown> = S.suspend(() =>
  S.Union([
    AstNode,
    S.Array(AstValue),
    S.Record(S.String, AstValue),
    S.Undefined,
    S.Null,
    S.Boolean,
    S.Finite,
    S.String,
    S.Unknown,
  ])
);

/**
 * Open Acorn node boundary. The parser is decoded once before evaluation;
 * supported-node closure is enforced by the evaluator's exhaustive node
 * matcher.
 *
 * @category models
 * @since 0.0.0
 */
export const AstNode = S.StructWithRest(
  S.Struct({
    type: AstNodeType,
    loc: S.optionalKey(SourceLocation),
  }),
  [S.Record(S.String, AstValue)]
).pipe(
  $I.annoteSchema("AstNode", {
    description: "An Acorn syntax node with a required type discriminator and optional source location.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link AstNode}.
 *
 * @category models
 * @since 0.0.0
 */
export type AstNode = typeof AstNode.Type;

/**
 * Parsed program root.
 *
 * @category models
 * @since 0.0.0
 */
export const ProgramNode = S.StructWithRest(
  S.Struct({
    type: S.tag("Program"),
    body: S.Array(AstNode),
    loc: S.optionalKey(SourceLocation),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("ProgramNode", {
    description: "A parsed CodeMode program root containing executable statements.",
  })
);

/**
 * Runtime type for {@link ProgramNode}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProgramNode = typeof ProgramNode.Type;

/** Immutable lexical binding stored in a mutable scope map. */
export class Binding extends S.Class<Binding>($I`Binding`)(
  {
    mutable: S.Boolean,
    value: S.Unknown,
    initialized: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
  },
  $I.annote("Binding", {
    description: "One guest lexical binding; scope updates replace this immutable value.",
  })
) {
  static readonly new = (
    mutable: boolean,
    value: unknown,
    initialized = true
  ): Binding => Binding.make({ mutable, value, initialized });
}

/** Effect collection used for one lexical scope. */
export const Scope = MutableHashMapFromSelf({
  key: S.String,
  value: Binding,
}).pipe(
  $I.annoteSchema("Scope", {
    description: "Mutable Effect hash map containing immutable guest bindings.",
  })
);

/** Runtime type for {@link Scope}. */
export type Scope = typeof Scope.Type;

/** Normal statement completion. */
export class StatementNone extends S.TaggedClass<StatementNone>($I`StatementNone`)(
  "None",
  {},
  $I.annote("StatementNone", {
    description: "A guest statement completed without transferring control.",
  })
) {
  static readonly new = (): StatementNone => StatementNone.make({});
}

/** Return completion carrying the guest value. */
export class StatementReturn extends S.TaggedClass<StatementReturn>($I`StatementReturn`)(
  "Return",
  { value: S.Unknown },
  $I.annote("StatementReturn", {
    description: "A guest return statement completed with a value.",
  })
) {
  static readonly new = (value: unknown): StatementReturn =>
    StatementReturn.make({ value });
}

/** Break completion with an optional label. */
export class StatementBreak extends S.TaggedClass<StatementBreak>($I`StatementBreak`)(
  "Break",
  {
    label: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("StatementBreak", {
    description: "A guest break statement transfers control, optionally to a label.",
  })
) {
  static readonly new = (label?: string): StatementBreak =>
    StatementBreak.make({ label: O.fromNullishOr(label) });
}

/** Continue completion with an optional label. */
export class StatementContinue extends S.TaggedClass<StatementContinue>($I`StatementContinue`)(
  "Continue",
  {
    label: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("StatementContinue", {
    description: "A guest continue statement transfers control, optionally to a label.",
  })
) {
  static readonly new = (label?: string): StatementContinue =>
    StatementContinue.make({ label: O.fromNullishOr(label) });
}

/** Schema-owned statement control-flow result. */
export const StatementResult = S.Union([
  StatementNone,
  StatementReturn,
  StatementBreak,
  StatementContinue,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("StatementResult", {
    description: "All normal and abrupt guest statement completions.",
  })
);

/** Runtime type for {@link StatementResult}. */
export type StatementResult = typeof StatementResult.Type;

type MemberReferenceTarget =
  | SafeObject
  | Array<unknown>
  | CodeModeRegExp
  | CodeModeURL;

const MemberReferenceTarget = S.declare<MemberReferenceTarget>(
  (value: unknown): value is MemberReferenceTarget =>
    A.isArray(value) || P.isObject(value)
);

/** Mutable property reference inside a guest value. */
export class MemberReference extends S.Class<MemberReference>($I`MemberReference`)(
  {
    target: MemberReferenceTarget,
    key: S.PropertyKey,
  },
  $I.annote("MemberReference", {
    description: "Identity-preserving reference to a mutable guest property.",
  })
) {
  static readonly new = (
    target: MemberReferenceTarget,
    key: PropertyKey
  ): MemberReference => MemberReference.make({ target, key });
}

/**
 * Captured scopes are runtime references, not serialized data. Validate the
 * collection kind without rebuilding it so closures retain map identity.
 */
const CapturedScope = S.declare<Scope>(
  (value: unknown): value is Scope =>
    MutableHashMap.isMutableHashMap(value)
);
const CapturedScopes = S.Array(CapturedScope);

const GeneratorRequest = S.declare<
  (
    kind: GeneratorRequestKind,
    value: unknown,
    node: AstNode
  ) => Effect.Effect<unknown, InterpreterFailure>
>((value: unknown): value is (
  kind: GeneratorRequestKind,
  value: unknown,
  node: AstNode
) => Effect.Effect<unknown, InterpreterFailure> => P.isFunction(value));

const SettlePromise = S.declare<(value: unknown) => void>(
  (value: unknown): value is (value: unknown) => void => P.isFunction(value)
);

export class CodeModeFunction extends S.TaggedClass<CodeModeFunction>($I`CodeModeFunction`)(
  "CodeModeFunction",
  {
    parameters: S.Array(AstNode),
    body: AstNode,
    capturedScopes: CapturedScopes,
    async: S.Boolean,
    generator: S.Boolean,
  },
  $I.annote("CodeModeFunction", {
    description: "A guest function with its parsed body and captured lexical scopes.",
  })
) {
  static readonly new = (
    parameters: ReadonlyArray<AstNode>,
    body: AstNode,
    capturedScopes: ReadonlyArray<MutableHashMap.MutableHashMap<string, Binding>>,
    async: boolean,
    generator: boolean
  ): CodeModeFunction => CodeModeFunction.make({
    parameters,
    body,
    capturedScopes,
    async,
    generator
  });
}

/** Supported generator request operations. */
export const GeneratorRequestKind = LiteralKit(["next", "return", "throw"]).pipe(
  $I.annoteSchema("GeneratorRequestKind", {
    description: "Operation requested from a guest generator.",
  })
);

/** Runtime type for {@link GeneratorRequestKind}. */
export type GeneratorRequestKind = typeof GeneratorRequestKind.Type;

/** Guest generator handle. */
export class CodeModeGenerator extends S.TaggedClass<CodeModeGenerator>($I`CodeModeGenerator`)(
  "CodeModeGenerator",
  {
    asynchronous: S.Boolean,
    request: GeneratorRequest,
  },
  $I.annote("CodeModeGenerator", {
    description: "A guest generator backed by an Effect request function.",
  })
) {
  static readonly is = S.is(CodeModeGenerator);

  static readonly new = (
    asynchronous: boolean,
    request: (
      kind: GeneratorRequestKind,
      value: unknown,
      node: AstNode
    ) => Effect.Effect<unknown, InterpreterFailure>
  ): CodeModeGenerator => CodeModeGenerator.make({asynchronous, request});
}

/** Operations exposed by a guest generator reference. */
export const GeneratorMethodKind = LiteralKit([
  ...GeneratorRequestKind.Options,
  "iterator",
]).pipe(
  $I.annoteSchema("GeneratorMethodKind", {
    description: "Operation exposed by a bound guest generator method.",
  })
);

/** Runtime type for {@link GeneratorMethodKind}. */
export type GeneratorMethodKind = typeof GeneratorMethodKind.Type;

/** Bound method of a guest generator. */
export class GeneratorMethodReference extends S.TaggedClass<GeneratorMethodReference>($I`GeneratorMethodReference`)(
  "GeneratorMethodReference",
  {
    generator: CodeModeGenerator,
    kind: GeneratorMethodKind,
  },
  $I.annote("GeneratorMethodReference", {
    description: "A method reference bound to a guest generator.",
  })
) {
  static readonly new = (
    generator: CodeModeGenerator,
    kind: GeneratorMethodKind
  ): GeneratorMethodReference => GeneratorMethodReference.make({generator, kind});
}

const MutableArray = S.declare(
  (value: unknown): value is Array<unknown> => A.isArray(value)
);
const MutableDate = S.declare(
  (value: unknown): value is CodeModeDate => CodeModeDate.is(value)
);
const MutableRegExp = S.declare(
  (value: unknown): value is CodeModeRegExp => CodeModeRegExp.is(value)
);
const MutableMap = S.declare(
  (value: unknown): value is CodeModeMap => CodeModeMap.is(value)
);
const MutableSet = S.declare(
  (value: unknown): value is CodeModeSet => CodeModeSet.is(value)
);
const MutableURL = S.declare(
  (value: unknown): value is CodeModeURL => CodeModeURL.is(value)
);
const MutableURLSearchParams = S.declare(
  (value: unknown): value is CodeModeURLSearchParams => CodeModeURLSearchParams.is(value)
);

export const IntrinsicMethod = S.Union([
  S.Struct({
    receiverKind: S.tag("String"),
    receiver: S.String,
    name: stringMethods,
  }),
  S.Struct({
    receiverKind: S.tag("Number"),
    // Guest JavaScript numbers intentionally include NaN and infinities.
    // @effect-diagnostics-next-line schemaNumber:off
    receiver: S.Number,
    name: numberMethods,
  }),
  S.Struct({
    receiverKind: S.tag("Array"),
    receiver: MutableArray,
    name: arrayMethods,
  }),
  S.Struct({
    receiverKind: S.tag("Date"),
    receiver: MutableDate,
    name: dateMethods,
  }),
  S.Struct({
    receiverKind: S.tag("RegExp"),
    receiver: MutableRegExp,
    name: regexpMethods,
  }),
  S.Struct({
    receiverKind: S.tag("Map"),
    receiver: MutableMap,
    name: mapMethods,
  }),
  S.Struct({
    receiverKind: S.tag("Set"),
    receiver: MutableSet,
    name: setMethods,
  }),
  S.Struct({
    receiverKind: S.tag("URL"),
    receiver: MutableURL,
    name: UrlMethod,
  }),
  S.Struct({
    receiverKind: S.tag("URLSearchParams"),
    receiver: MutableURLSearchParams,
    name: UrlSearchParamsMethod,
  }),
]).pipe(
  S.toTaggedUnion("receiverKind"),
  $I.annoteSchema("IntrinsicMethod", {
    description: "Every legal receiver and intrinsic method-name combination.",
  }),
  SchemaUtils.withCodecStatics
);

export type IntrinsicMethod = typeof IntrinsicMethod.Type;

/** Bound intrinsic operation. */
export class IntrinsicReference extends S.TaggedClass<IntrinsicReference>($I`IntrinsicReference`)(
  "IntrinsicReference",
  {
    method: IntrinsicMethod,
  },
  $I.annote("IntrinsicReference", {
    description: "An intrinsic method bound to its guest receiver.",
  })
) {
  static readonly new = (method: IntrinsicMethod): IntrinsicReference =>
    IntrinsicReference.make({ method });
}

/** Marker preserving a computed value through assignment evaluation. */
export class ComputedValue extends S.TaggedClass<ComputedValue>($I`ComputedValue`)(
  "ComputedValue",
  {
    value: S.Unknown,
  },
  $I.annote("ComputedValue", {
    description: "A computed guest value retained through assignment evaluation.",
  })
) {
  static readonly is = S.is(ComputedValue);

  static readonly new = (value: unknown): ComputedValue => ComputedValue.make({value});
}

/** Guest Promise constructor namespace. */
export class PromiseNamespace extends S.TaggedClass<PromiseNamespace>($I`PromiseNamespace`)(
  "PromiseNamespace",
  {},
  $I.annote("PromiseNamespace", {
    description: "The guest Promise constructor namespace.",
  })
) {
  static readonly new = (): PromiseNamespace => PromiseNamespace.make({});
}

/** Guest Symbol namespace. */
export class SymbolNamespace extends S.TaggedClass<SymbolNamespace>($I`SymbolNamespace`)(
  "SymbolNamespace",
  {},
  $I.annote("SymbolNamespace", {
    description: "The guest Symbol namespace.",
  })
) {
  static readonly new = (): SymbolNamespace => SymbolNamespace.make({});
}

export const AsyncIteratorSymbol: unique symbol = Symbol("codemode.async-iterator");
export const IteratorSymbol: unique symbol = Symbol("codemode.iterator");
export const IteratorSymbols = [AsyncIteratorSymbol, IteratorSymbol] as const;

/** Supported static Promise methods. */
export const PromiseMethodName = LiteralKit(["all", "allSettled", "race", "any", "resolve", "reject"]).pipe(
  $I.annoteSchema("PromiseMethodName", {
    description: "Static Promise method exposed to guest programs.",
  })
);

/** Runtime type for {@link PromiseMethodName}. */
export type PromiseMethodName = typeof PromiseMethodName.Type;

export class PromiseMethodReference extends S.TaggedClass<PromiseMethodReference>($I`PromiseMethodReference`)(
  "PromiseMethodReference",
  {name: PromiseMethodName},
  $I.annote("PromiseMethodReference", {
    description: "A static Promise method exposed to a guest program.",
  })
) {
  static readonly new = (name: PromiseMethodName): PromiseMethodReference =>
    PromiseMethodReference.make({name});
}

/** Supported Promise instance methods. */
export const PromiseInstanceMethodName = LiteralKit(["then", "catch", "finally"]).pipe(
  $I.annoteSchema("PromiseInstanceMethodName", {
    description: "Promise instance method exposed to guest programs.",
  })
);

export type PromiseInstanceMethodName = typeof PromiseInstanceMethodName.Type;

export class PromiseInstanceMethodReference extends S.TaggedClass<PromiseInstanceMethodReference>(
  $I`PromiseInstanceMethodReference`
)(
  "PromiseInstanceMethodReference",
  {
    promise: CodeModePromise,
    name: PromiseInstanceMethodName,
  },
  $I.annote("PromiseInstanceMethodReference", {
    description: "A Promise instance method bound to its guest promise.",
  })
) {
  static readonly new = (
    promise: CodeModePromise,
    name: PromiseInstanceMethodName
  ): PromiseInstanceMethodReference => PromiseInstanceMethodReference.make({promise, name});
}

export class PromiseCapabilityFunction extends S.TaggedClass<PromiseCapabilityFunction>($I`PromiseCapabilityFunction`)(
  "PromiseCapabilityFunction",
  {
    settle: SettlePromise,
  },
  $I.annote("PromiseCapabilityFunction", {
    description: "A guest Promise resolve or reject capability.",
  })
) {
  static readonly new = (settle: (value: unknown) => void): PromiseCapabilityFunction =>
    PromiseCapabilityFunction.make({settle});
}

/** Global constructor namespaces exposed by CodeMode. */
export const GlobalNamespaceName = LiteralKit([
  "Object",
  "Math",
  "JSON",
  "Array",
  "console",
  "Date",
  "RegExp",
  "Map",
  "Set",
  "URL",
  "URLSearchParams",
]).pipe(
  $I.annoteSchema("GlobalNamespaceName", {
    description: "Global namespace or constructor available to guest programs.",
  })
);

export type GlobalNamespaceName = typeof GlobalNamespaceName.Type;

export class GlobalNamespace extends S.TaggedClass<GlobalNamespace>($I`GlobalNamespace`)(
  "GlobalNamespace",
  {name: GlobalNamespaceName},
  $I.annote("GlobalNamespace", {
    description: "A constructor or namespace exposed to guest programs.",
  })
) {
  static readonly new = (name: GlobalNamespaceName): GlobalNamespace =>
    GlobalNamespace.make({name});
}

export const GlobalMethod = S.Union([
  S.Struct({ namespace: S.tag("Object"), name: objectStatics }),
  S.Struct({ namespace: S.tag("Math"), name: mathMethods }),
  S.Struct({ namespace: S.tag("Array"), name: arrayStatics }),
  S.Struct({ namespace: S.tag("console"), name: ConsoleMethod }),
  S.Struct({ namespace: S.tag("Date"), name: dateStatics }),
  S.Struct({ namespace: S.tag("RegExp"), name: regexpStatics }),
  S.Struct({ namespace: S.tag("Map"), name: mapStatics }),
  S.Struct({ namespace: S.tag("URL"), name: UrlStatic }),
  S.Struct({ namespace: S.tag("Number"), name: numberStatics }),
  S.Struct({ namespace: S.tag("String"), name: stringStatics }),
]).pipe(
  S.toTaggedUnion("namespace"),
  $I.annoteSchema("GlobalMethod", {
    description: "Every legal global namespace and static method-name combination.",
  }),
  SchemaUtils.withCodecStatics
);

export type GlobalMethod = typeof GlobalMethod.Type;

export class GlobalMethodReference extends S.TaggedClass<GlobalMethodReference>($I`GlobalMethodReference`)(
  "GlobalMethodReference",
  {
    method: GlobalMethod,
  },
  $I.annote("GlobalMethodReference", {
    description: "A global method bound to its namespace.",
  })
) {
  static readonly new = (method: GlobalMethod): GlobalMethodReference =>
    GlobalMethodReference.make({ method });
}

/** JSON method names exposed to guest programs. */
export const JsonMethodName = LiteralKit(["parse", "stringify"]).pipe(
  $I.annoteSchema("JsonMethodName", {
    description: "JSON operation exposed to guest programs.",
  })
);

export type JsonMethodName = typeof JsonMethodName.Type;

export class JsonMethodReference extends S.TaggedClass<JsonMethodReference>($I`JsonMethodReference`)(
  "JsonMethodReference",
  {name: JsonMethodName},
  $I.annote("JsonMethodReference", {
    description: "A JSON method reference exposed to a guest program.",
  })
) {
  static readonly new = (name: JsonMethodName): JsonMethodReference =>
    JsonMethodReference.make({name});
}

export const CoercionFunctionName = LiteralKit([
  "Number",
  "String",
  "Boolean",
  "parseInt",
  "parseFloat",
  "isFinite",
  "isNaN",
]).pipe(
  $I.annoteSchema("CoercionFunctionName", {
    description: "A primitive coercion function exposed to guest programs.",
  })
);

export type CoercionFunctionName = typeof CoercionFunctionName.Type;

export class CoercionFunction extends S.TaggedClass<CoercionFunction>($I`CoercionFunction`)(
  "CoercionFunction",
  {name: CoercionFunctionName},
  $I.annote("CoercionFunction", {
    description: "A guest primitive coercion function.",
  })
) {
  static readonly new = (name: CoercionFunctionName): CoercionFunction =>
    CoercionFunction.make({name});
}

export const UriFunctionName = LiteralKit([
  "encodeURI",
  "encodeURIComponent",
  "decodeURI",
  "decodeURIComponent",
]).pipe(
  $I.annoteSchema("UriFunctionName", {
    description: "A URI codec function exposed to guest programs.",
  })
);

export type UriFunctionName = typeof UriFunctionName.Type;

export class UriFunction extends S.TaggedClass<UriFunction>($I`UriFunction`)(
  "UriFunction",
  {name: UriFunctionName},
  $I.annote("UriFunction", {
    description: "A guest URI codec function.",
  })
) {
  static readonly new = (name: UriFunctionName): UriFunction =>
    UriFunction.make({name});
}

export class SearchFunction extends S.TaggedClass<SearchFunction>($I`SearchFunction`)(
  "SearchFunction",
  {},
  $I.annote("SearchFunction", {
    description: "The built-in CodeMode tool-discovery function.",
  })
) {
  static readonly new = (): SearchFunction => SearchFunction.make({});
}

export class ProgramThrow extends S.TaggedClass<ProgramThrow>($I`ProgramThrow`)(
  "ProgramThrow",
  {
    value: S.Unknown,
  },
  $I.annote("ProgramThrow", {
    description: "A guest-thrown value propagated through the interpreter.",
  })
) {
  static readonly new = (value: unknown): ProgramThrow => ProgramThrow.make({value});
}

export class GeneratorReturn extends S.TaggedClass<GeneratorReturn>($I`GeneratorReturn`)(
  "GeneratorReturn",
  {
    value: S.Unknown,
  },
  $I.annote("GeneratorReturn", {
    description: "The return value that completes a guest generator.",
  })
) {
  static readonly new = (value: unknown): GeneratorReturn => GeneratorReturn.make({value});
}

/** Error constructors exposed to guest programs. */
export const ErrorConstructorName = LiteralKit([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "EvalError",
  "URIError",
  "AggregateError",
]).pipe(
  $I.annoteSchema("ErrorConstructorName", {
    description: "An Error constructor exposed to guest programs.",
  })
);

/** Runtime type for {@link ErrorConstructorName}. */
export type ErrorConstructorName = typeof ErrorConstructorName.Type;

export class ErrorConstructorReference extends S.TaggedClass<ErrorConstructorReference>(
  $I`ErrorConstructorReference`
)(
  "ErrorConstructorReference",
  {name: ErrorConstructorName},
  $I.annote("ErrorConstructorReference", {
    description: "A guest Error constructor reference.",
  })
) {
  static readonly new = (name: ErrorConstructorName): ErrorConstructorReference =>
    ErrorConstructorReference.make({name});
}

/**
 * Tagged union for all schema-owned runtime references.
 *
 * @category models
 * @since 0.0.0
 */
export const RuntimeReference = S.Union([
  CodeModeFunction,
  CodeModeGenerator,
  GeneratorMethodReference,
  IntrinsicReference,
  ComputedValue,
  PromiseNamespace,
  SymbolNamespace,
  PromiseMethodReference,
  PromiseInstanceMethodReference,
  PromiseCapabilityFunction,
  GlobalNamespace,
  GlobalMethodReference,
  JsonMethodReference,
  CoercionFunction,
  UriFunction,
  SearchFunction,
  ProgramThrow,
  GeneratorReturn,
  ErrorConstructorReference,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("RuntimeReference", {
    description: "All schema-owned interpreter references and control wrappers.",
  }),
  SchemaUtils.withCodecStatics
);

/** Runtime type for {@link RuntimeReference}. */
export type RuntimeReference = typeof RuntimeReference.Type;

/** Stable interpreter diagnostic categories. */
export const DiagnosticKind = LiteralKit([
  "ParseError",
  "UnsupportedSyntax",
  "UnknownTool",
  "InvalidToolInput",
  "InvalidToolOutput",
  "InvalidDataValue",
  "ToolCallLimitExceeded",
  "TimeoutExceeded",
  "ToolFailure",
  "ExecutionFailure",
  "Truncated",
]).pipe(
  $I.annoteSchema("DiagnosticKind", {
    description: "Stable category assigned to an interpreter failure.",
  })
);

export type DiagnosticKind = typeof DiagnosticKind.Type;

export const OptionalShortCircuit: unique symbol = Symbol("codemode.optional-short-circuit");

export const supportedSyntaxMessage =
  "Supported orchestration syntax: tools.* calls (they return promises - resolve them with await), data literals, destructuring, optional chaining, template literals, conditionals, switch, loops (incl. for...of and for...in over object/array/tools keys), arrow functions, spread, try/catch, array methods (map/filter/find/findIndex/some/every/reduce/flatMap/forEach/sort/slice/concat/indexOf/lastIndexOf/at/flat/reverse/includes/join), string methods (incl. match/matchAll/replace/split with regular expressions), Date/RegExp/Map/Set/URL/URLSearchParams, URI encoding helpers, Object/Math/JSON helpers, captured console.log/warn/error/dir/table, Promise.all/allSettled/race/any/resolve/reject over arrays mixing promises and plain values for parallel tool calls, promise chaining with .then/.catch/.finally, and new Promise((resolve, reject) => ...) construction.";

/**
 * Typed interpreter failure before it is normalized to a public diagnostic.
 *
 * @category errors
 * @since 0.0.0
 */
export class InterpreterRuntimeError extends TaggedErrorClass<InterpreterRuntimeError>($I`InterpreterRuntimeError`)(
  "InterpreterRuntimeError",
  {
    message: S.String,
    node: S.OptionFromOptionalKey(AstNode).pipe(SchemaUtils.withNoneDefault),
    kind: DiagnosticKind.pipe(SchemaUtils.withKeyDefaults(DiagnosticKind.Enum.ExecutionFailure)),
    suggestions: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    errorName: ErrorConstructorName.pipe(
      SchemaUtils.withKeyDefaults(ErrorConstructorName.Enum.Error)
    ),
  },
  $I.annote("InterpreterRuntimeError", {
    description: "Typed failure raised while evaluating a guest program.",
  })
) {
  static readonly new = (
    message: string,
    node?: AstNode,
    kind: DiagnosticKind = DiagnosticKind.Enum.ExecutionFailure,
    suggestions?: ReadonlyArray<string>
  ): InterpreterRuntimeError =>
    InterpreterRuntimeError.make({
      message,
      node: O.fromNullishOr(node),
      kind,
      suggestions: O.fromNullishOr(suggestions),
    });

  readonly as = (errorName: ErrorConstructorName): InterpreterRuntimeError =>
    InterpreterRuntimeError.make({
      message: this.message,
      node: this.node,
      kind: this.kind,
      suggestions: this.suggestions,
      errorName,
    });
}

/**
 * Every recoverable failure propagated by the interpreter.
 *
 * Arbitrary guest-thrown values remain data inside {@link ProgramThrow}; the
 * Effect error channel itself is therefore closed and schema-owned.
 *
 * @category errors
 * @since 0.0.0
 */
export const InterpreterFailure = S.Union([
  InterpreterRuntimeError,
  ProgramThrow,
  GeneratorReturn,
  ToolRuntimeError,
  ToolError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("InterpreterFailure", {
    description: "Closed recoverable failure channel for guest evaluation and host tool calls.",
  }),
  SchemaUtils.withCodecStatics
);

/** Runtime type for {@link InterpreterFailure}. */
export type InterpreterFailure = typeof InterpreterFailure.Type;

/** Captures a synchronous interpreter adapter in the closed failure channel. */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const tryInterpreter = <Value>(
  evaluate: () => Value,
  node?: AstNode
): Result.Result<Value, InterpreterFailure> =>
  Result.try({
    try: evaluate,
    catch: (error) =>
      InterpreterFailure.is(error)
        ? error
        : InterpreterRuntimeError.new(
            P.isError(error) ? error.message : globalThis.String(error),
            node
          ),
  });

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const unsupportedSyntax = (kind: string, node: AstNode): InterpreterRuntimeError =>
  InterpreterRuntimeError.new(
    `Syntax '${kind}' is not supported. ${supportedSyntaxMessage}`,
    node,
    DiagnosticKind.Enum.UnsupportedSyntax,
    [supportedSyntaxMessage]
  );

export const isRecord = P.isObject;
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const asNode = (value: unknown, context: string): AstNode => {
  if (!AstNode.is(value)) {
    throw InterpreterRuntimeError.new(`Invalid AST node while reading ${context}.`);
  }
  return value;
};

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const getArray = (node: AstNode, key: string): Array<unknown> => {
  const value = node[key];
  if (!A.isArray(value)) {
    throw InterpreterRuntimeError.new(`Expected '${key}' to be an array.`, node);
  }
  return value;
};

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const getString = (node: AstNode, key: string): string => {
  const value = node[key];
  if (!P.isString(value)) {
    throw InterpreterRuntimeError.new(`Expected '${key}' to be a string.`, node);
  }
  return value;
};

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const getBoolean = (node: AstNode, key: string): boolean => {
  const value = node[key];
  if (!P.isBoolean(value)) {
    throw InterpreterRuntimeError.new(`Expected '${key}' to be a boolean.`, node);
  }
  return value;
};

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const getOptionalNode = (node: AstNode, key: string): AstNode | undefined => {
  const value = node[key];
  return P.isNullish(value) ? undefined : asNode(value, key);
};

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const getNode = (node: AstNode, key: string): AstNode => asNode(node[key], key);

export const sourceLocation = (node: AstNode): {
  readonly line: number;
  readonly column: number
} => ({
  line: N.max(1, (node.loc?.start.line ?? 2) - 1),
  column: N.max(1, (node.loc?.start.column ?? 4) - 3),
});

export const formatLocation = (node?: AstNode): string => {
  if (P.isUndefined(node?.loc)) return "";
  const location = sourceLocation(node);
  return ` (line ${location.line}, col ${location.column})`;
};
