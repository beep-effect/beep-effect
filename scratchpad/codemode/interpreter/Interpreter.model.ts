/**
 * Runtime and boundary models for the confined CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, MutableHashMapFromSelf, NonNegativeInt, SchemaUtils } from "@beep/schema";
import type { SafeObject } from "@beep/schema/SafeObject";
import { A, N, O, P } from "@beep/utils";
import { type Effect, MutableHashMap, Result } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
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
import { ToolError } from "../Codemode.tool-error.ts";
import { ToolRuntimeError } from "../Codemode.tool-runtime.ts";
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
 * One source coordinate reported by Acorn, before CodeMode wrapper adjustment.
 *
 * **Example** (Construct a parser coordinate)
 *
 * ```ts
 * import { SourcePosition } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const position = SourcePosition.new(2, 4)
 * console.log(position.line, position.column)
 * // 2 4
 * ```
 *
 * @see {@link sourceLocation} for the wrapper-adjusted one-based coordinate published to diagnostics.
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
 * Start and end coordinates attached to a parsed JavaScript node.
 *
 * **Example** (Attach a range to a node)
 *
 * ```ts
 * import {
 *   SourceLocation,
 *   SourcePosition,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const range = SourceLocation.new(SourcePosition.new(2, 4), SourcePosition.new(2, 10))
 * console.log(range.start.column, range.end.column)
 * // 4 10
 * ```
 *
 * @see {@link SourcePosition} for the unadjusted parser coordinate stored in each endpoint.
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
    SourceLocation.make({ start, end });
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
 * Open Acorn node boundary decoded once before evaluation.
 *
 * **Details**
 *
 * Supported-node closure is enforced by the evaluator's exhaustive matcher, not
 * by this schema. The rest record preserves parser-specific opaque values such
 * as a native `RegExp` on a literal.
 *
 * **Example** (Decode a bare identifier node)
 *
 * ```ts
 * import { AstNode } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const node = AstNode.decodeUnknownSync({ type: "Identifier", name: "count" })
 * console.log(node.type, node.name)
 * // Identifier count
 * ```
 *
 * @see {@link asNode} for the throwing reader used while walking a decoded tree.
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
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "is"])
);

/**
 * Decoded Acorn node produced by {@link AstNode}.
 *
 * @see {@link AstNode} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type AstNode = typeof AstNode.Type;

/**
 * Parsed program root containing the executable statement list.
 *
 * **Example** (Decode an empty program)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProgramNode } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const program = S.decodeUnknownSync(ProgramNode)({ type: "Program", body: [] })
 * console.log(program.type, program.body.length)
 * // Program 0
 * ```
 *
 * @see {@link Interpreter} for evaluation of a decoded program.
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
 * Decoded program root produced by {@link ProgramNode}.
 *
 * @see {@link ProgramNode} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type ProgramNode = typeof ProgramNode.Type;

/**
 * Immutable lexical binding stored in a mutable scope map.
 *
 * **Details**
 *
 * Scope updates replace this value rather than mutating it. `initialized` is
 * false after {@link ScopeStack.reserve} and true after initialize/declare.
 *
 * **Example** (Reserve an uninitialized let binding)
 *
 * ```ts
 * import { Binding } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const tdz = Binding.new(true, undefined, false)
 * console.log(tdz.mutable, tdz.initialized)
 * // true false
 * const ready = Binding.new(false, 10)
 * console.log(ready.mutable, ready.initialized, ready.value)
 * // false true 10
 * ```
 *
 * @see {@link ScopeStack} for the reserve/initialize/declare protocol that writes these values.
 * @category models
 * @since 0.0.0
 */
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
  static readonly new = (mutable: boolean, value: unknown, initialized = true): Binding =>
    Binding.make({ mutable, value, initialized });
}

/**
 * Mutable Effect hash map containing immutable guest bindings for one frame.
 *
 * **Example** (Insert a binding into a fresh frame)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Binding, Scope } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const frame = MutableHashMap.empty<string, Binding>()
 * MutableHashMap.set(frame, "count", Binding.new(true, 0))
 * console.log(S.is(Scope)(frame))
 * // true
 * const binding = MutableHashMap.get(frame, "count")
 * console.log(O.isSome(binding) ? binding.value.value : binding)
 * // 0
 * ```
 *
 * @see {@link Binding} for the immutable slot stored at each name.
 * @see {@link ScopeStack} for the stack that owns these maps.
 * @category models
 * @since 0.0.0
 */
export const Scope = MutableHashMapFromSelf({
  key: S.String,
  value: Binding,
}).pipe(
  $I.annoteSchema("Scope", {
    description: "Mutable Effect hash map containing immutable guest bindings.",
  })
);

/**
 * Decoded lexical frame produced by {@link Scope}.
 *
 * @see {@link Scope} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type Scope = typeof Scope.Type;

/**
 * Guest statement completed without transferring control.
 *
 * **Example** (Construct a fall-through completion)
 *
 * ```ts
 * import { StatementNone } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const completion = StatementNone.new()
 * console.log(completion._tag)
 * // None
 * ```
 *
 * @see {@link StatementResult} for the union of completions including this tag.
 * @category models
 * @since 0.0.0
 */
export class StatementNone extends S.TaggedClass<StatementNone>($I`StatementNone`)(
  "None",
  {},
  $I.annote("StatementNone", {
    description: "A guest statement completed without transferring control.",
  })
) {
  static readonly new = (): StatementNone => StatementNone.make({});
}

/**
 * Guest return statement completed with a value.
 *
 * **Example** (Return a guest value)
 *
 * ```ts
 * import { StatementReturn } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const completion = StatementReturn.new(42)
 * console.log(completion._tag, completion.value)
 * // Return 42
 * ```
 *
 * @see {@link StatementResult} for matching this completion against break/continue/none.
 * @category models
 * @since 0.0.0
 */
export class StatementReturn extends S.TaggedClass<StatementReturn>($I`StatementReturn`)(
  "Return",
  { value: S.Unknown },
  $I.annote("StatementReturn", {
    description: "A guest return statement completed with a value.",
  })
) {
  static readonly new = (value: unknown): StatementReturn => StatementReturn.make({ value });
}

/**
 * Guest break statement that transfers control, optionally to a label.
 *
 * **Example** (Break with a label)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { StatementBreak } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const labeled = StatementBreak.new("outer")
 * console.log(labeled._tag, O.getOrUndefined(labeled.label))
 * // Break outer
 * ```
 *
 * @see {@link StatementContinue} for the sibling continue completion.
 * @category models
 * @since 0.0.0
 */
export class StatementBreak extends S.TaggedClass<StatementBreak>($I`StatementBreak`)(
  "Break",
  {
    label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StatementBreak", {
    description: "A guest break statement transfers control, optionally to a label.",
  })
) {
  static readonly new = (label?: string): StatementBreak => StatementBreak.make({ label: O.fromNullishOr(label) });
}

/**
 * Guest continue statement that transfers control, optionally to a label.
 *
 * **Example** (Continue without a label)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { StatementContinue } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const completion = StatementContinue.new()
 * console.log(completion._tag, O.isNone(completion.label))
 * // Continue true
 * ```
 *
 * @see {@link StatementBreak} for the sibling break completion.
 * @category models
 * @since 0.0.0
 */
export class StatementContinue extends S.TaggedClass<StatementContinue>($I`StatementContinue`)(
  "Continue",
  {
    label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StatementContinue", {
    description: "A guest continue statement transfers control, optionally to a label.",
  })
) {
  static readonly new = (label?: string): StatementContinue =>
    StatementContinue.make({ label: O.fromNullishOr(label) });
}

/**
 * All normal and abrupt guest statement completions.
 *
 * **Example** (Match a return completion)
 *
 * ```ts
 * import { StatementResult, StatementReturn } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const completion = StatementReturn.new("done")
 * console.log(StatementResult.guards.Return(completion) ? completion.value : completion)
 * // done
 * ```
 *
 * @see {@link StatementNone} for fall-through completion.
 * @category models
 * @since 0.0.0
 */
export const StatementResult = S.Union([StatementNone, StatementReturn, StatementBreak, StatementContinue]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("StatementResult", {
    description: "All normal and abrupt guest statement completions.",
  })
);

/**
 * Decoded statement completion produced by {@link StatementResult}.
 *
 * @see {@link StatementResult} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type StatementResult = typeof StatementResult.Type;

type MemberReferenceTarget = SafeObject | Array<unknown> | CodeModeRegExp | CodeModeURL;

const MemberReferenceTarget = S.declare<MemberReferenceTarget>(
  (value: unknown): value is MemberReferenceTarget => A.isArray(value) || P.isObject(value)
);

/**
 * Identity-preserving reference to a mutable guest property.
 *
 * **Example** (Point at an object field)
 *
 * ```ts
 * import { SafeObject } from "@beep/schema"
 * import { MemberReference } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const target = SafeObject.make({ count: 1 })
 * const reference = MemberReference.new(target, "count")
 * console.log(reference.key, Reflect.get(reference.target, reference.key))
 * // count 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemberReference extends S.Class<MemberReference>($I`MemberReference`)(
  {
    target: MemberReferenceTarget,
    key: S.PropertyKey,
  },
  $I.annote("MemberReference", {
    description: "Identity-preserving reference to a mutable guest property.",
  })
) {
  static readonly new = (target: MemberReferenceTarget, key: PropertyKey): MemberReference =>
    MemberReference.make({ target, key });
}

/**
 * Captured scopes are runtime references, not serialized data. Validate the
 * collection kind without rebuilding it so closures retain map identity.
 */
const CapturedScope = S.declare<Scope>((value: unknown): value is Scope => MutableHashMap.isMutableHashMap(value));
const CapturedScopes = S.Array(CapturedScope);

const GeneratorRequest = S.declare<
  (kind: GeneratorRequestKind, value: unknown, node: AstNode) => Effect.Effect<unknown, InterpreterFailure>
>(
  (
    value: unknown
  ): value is (
    kind: GeneratorRequestKind,
    value: unknown,
    node: AstNode
  ) => Effect.Effect<unknown, InterpreterFailure> => P.isFunction(value)
);

const SettlePromise = S.declare<(value: unknown) => void>((value: unknown): value is (value: unknown) => void =>
  P.isFunction(value)
);

/**
 * Guest function with its parsed body and captured lexical scopes.
 *
 * **Gotchas**
 *
 * Captured scopes are runtime references, not serialized data. The schema
 * validates the collection kind without rebuilding the maps so closures retain
 * `MutableHashMap` identity. Reconstructing captured scopes as new maps breaks
 * assignment visibility across nested functions.
 *
 * **Example** (Preserve captured map identity)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import {
 *   type Binding,
 *   CodeModeFunction,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const scopes = [MutableHashMap.empty<string, Binding>()]
 * const fn = CodeModeFunction.new(
 *   [],
 *   { type: "BlockStatement", body: [] },
 *   scopes,
 *   false,
 *   false,
 * )
 * console.log(fn._tag, fn.async, fn.capturedScopes[0] === scopes[0])
 * // CodeModeFunction false true
 * ```
 *
 * @see {@link Scope} for the captured frame type.
 * @category models
 * @since 0.0.0
 */
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
  ): CodeModeFunction =>
    CodeModeFunction.make({
      parameters,
      body,
      capturedScopes,
      async,
      generator,
    });
}

/**
 * Operation requested from a guest generator (`next`, `return`, or `throw`).
 *
 * **Example** (Match a next request)
 *
 * ```ts
 * import { GeneratorRequestKind } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(GeneratorRequestKind.is.next("next"))
 * // true
 * console.log(GeneratorRequestKind.Enum.throw)
 * // throw
 * ```
 *
 * @see {@link CodeModeGenerator} for the handle that consumes these operations.
 * @category models
 * @since 0.0.0
 */
export const GeneratorRequestKind = LiteralKit(["next", "return", "throw"]).pipe(
  $I.annoteSchema("GeneratorRequestKind", {
    description: "Operation requested from a guest generator.",
  })
);

/**
 * Decoded generator request kind produced by {@link GeneratorRequestKind}.
 *
 * @see {@link GeneratorRequestKind} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type GeneratorRequestKind = typeof GeneratorRequestKind.Type;

/**
 * Guest generator backed by an Effect request function.
 *
 * **Example** (Construct a finished generator)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CodeModeGenerator } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const generator = CodeModeGenerator.new(false, () =>
 *   Effect.succeed({ value: undefined, done: true }),
 * )
 * console.log(generator._tag, generator.asynchronous, CodeModeGenerator.is(generator))
 * // CodeModeGenerator false true
 * ```
 *
 * @see {@link GeneratorMethodReference} for bound `.next` / `.return` / `.throw` / iterator methods.
 * @category models
 * @since 0.0.0
 */
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
    request: (kind: GeneratorRequestKind, value: unknown, node: AstNode) => Effect.Effect<unknown, InterpreterFailure>
  ): CodeModeGenerator => CodeModeGenerator.make({ asynchronous, request });
}

/**
 * Operation exposed by a bound guest generator method, including `iterator`.
 *
 * **Example** (Include iterator beside next/return/throw)
 *
 * ```ts
 * import { GeneratorMethodKind } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(GeneratorMethodKind.Options.includes("iterator"))
 * // true
 * console.log(GeneratorMethodKind.is.iterator("iterator"))
 * // true
 * ```
 *
 * @see {@link GeneratorRequestKind} for the subset that actually drives the generator.
 * @category models
 * @since 0.0.0
 */
export const GeneratorMethodKind = LiteralKit([...GeneratorRequestKind.Options, "iterator"]).pipe(
  $I.annoteSchema("GeneratorMethodKind", {
    description: "Operation exposed by a bound guest generator method.",
  })
);

/**
 * Decoded generator method kind produced by {@link GeneratorMethodKind}.
 *
 * @see {@link GeneratorMethodKind} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type GeneratorMethodKind = typeof GeneratorMethodKind.Type;

/**
 * Method reference bound to a guest generator.
 *
 * **Example** (Bind next on a generator)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   CodeModeGenerator,
 *   GeneratorMethodReference,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const generator = CodeModeGenerator.new(false, () =>
 *   Effect.succeed({ value: 1, done: false }),
 * )
 * const next = GeneratorMethodReference.new(generator, "next")
 * console.log(next._tag, next.kind)
 * // GeneratorMethodReference next
 * ```
 *
 * @see {@link CodeModeGenerator} for the handle this method is bound to.
 * @category models
 * @since 0.0.0
 */
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
  static readonly new = (generator: CodeModeGenerator, kind: GeneratorMethodKind): GeneratorMethodReference =>
    GeneratorMethodReference.make({ generator, kind });
}

const MutableArray = S.declare((value: unknown): value is Array<unknown> => A.isArray(value));
const MutableDate = S.declare((value: unknown): value is CodeModeDate => CodeModeDate.is(value));
const MutableRegExp = S.declare((value: unknown): value is CodeModeRegExp => CodeModeRegExp.is(value));
const MutableMap = S.declare((value: unknown): value is CodeModeMap => CodeModeMap.is(value));
const MutableSet = S.declare((value: unknown): value is CodeModeSet => CodeModeSet.is(value));
const MutableURL = S.declare((value: unknown): value is CodeModeURL => CodeModeURL.is(value));
const MutableURLSearchParams = S.declare((value: unknown): value is CodeModeURLSearchParams =>
  CodeModeURLSearchParams.is(value)
);

/**
 * Every legal receiver and intrinsic method-name combination.
 *
 * **Example** (Bind String.toUpperCase on a receiver)
 *
 * ```ts
 * import { IntrinsicMethod } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const method = IntrinsicMethod.cases.String.make({
 *   receiver: "Ada",
 *   name: "toUpperCase",
 * })
 * console.log(method.receiverKind, method.name)
 * // String toUpperCase
 * ```
 *
 * @see {@link IntrinsicReference} for the bound handle dispatched by {@link invokeIntrinsic}.
 * @category models
 * @since 0.0.0
 */
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
  })
);

/**
 * Decoded intrinsic method produced by {@link IntrinsicMethod}.
 *
 * @see {@link IntrinsicMethod} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type IntrinsicMethod = typeof IntrinsicMethod.Type;

/**
 * Intrinsic method bound to its guest receiver.
 *
 * **Example** (Wrap a String method)
 *
 * ```ts
 * import {
 *   IntrinsicMethod,
 *   IntrinsicReference,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const reference = IntrinsicReference.new(
 *   IntrinsicMethod.cases.String.make({ receiver: "Ada", name: "trim" }),
 * )
 * console.log(reference._tag, reference.method.name)
 * // IntrinsicReference trim
 * ```
 *
 * @see {@link invokeIntrinsic} for Effect dispatch over this handle.
 * @category models
 * @since 0.0.0
 */
export class IntrinsicReference extends S.TaggedClass<IntrinsicReference>($I`IntrinsicReference`)(
  "IntrinsicReference",
  {
    method: IntrinsicMethod,
  },
  $I.annote("IntrinsicReference", {
    description: "An intrinsic method bound to its guest receiver.",
  })
) {
  static readonly new = (method: IntrinsicMethod): IntrinsicReference => IntrinsicReference.make({ method });
}

/**
 * Computed guest value retained through assignment evaluation.
 *
 * **Example** (Wrap a computed right-hand side)
 *
 * ```ts
 * import { ComputedValue } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const computed = ComputedValue.new(3)
 * console.log(ComputedValue.is(computed), computed.value)
 * // true 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
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

  static readonly new = (value: unknown): ComputedValue => ComputedValue.make({ value });
}

/**
 * Guest Promise constructor namespace installed as the `Promise` builtin.
 *
 * **Example** (Construct the namespace)
 *
 * ```ts
 * import { PromiseNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const ns = PromiseNamespace.new()
 * console.log(ns._tag)
 * // PromiseNamespace
 * ```
 *
 * @see {@link PromiseMethodReference} for static methods read off this namespace.
 * @category models
 * @since 0.0.0
 */
export class PromiseNamespace extends S.TaggedClass<PromiseNamespace>($I`PromiseNamespace`)(
  "PromiseNamespace",
  {},
  $I.annote("PromiseNamespace", {
    description: "The guest Promise constructor namespace.",
  })
) {
  static readonly new = (): PromiseNamespace => PromiseNamespace.make({});
}

/**
 * Guest Symbol namespace installed as the `Symbol` builtin.
 *
 * **Example** (Construct the namespace)
 *
 * ```ts
 * import { SymbolNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(SymbolNamespace.new()._tag)
 * // SymbolNamespace
 * ```
 *
 * @see {@link IteratorSymbol} for the iterator well-known symbols this namespace exposes.
 * @category models
 * @since 0.0.0
 */
export class SymbolNamespace extends S.TaggedClass<SymbolNamespace>($I`SymbolNamespace`)(
  "SymbolNamespace",
  {},
  $I.annote("SymbolNamespace", {
    description: "The guest Symbol namespace.",
  })
) {
  static readonly new = (): SymbolNamespace => SymbolNamespace.make({});
}

/**
 * Well-known async-iterator symbol installed on guest async iterables.
 *
 * **Example** (Compare with the sync iterator symbol)
 *
 * ```ts
 * import {
 *   AsyncIteratorSymbol,
 *   IteratorSymbol,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(String(AsyncIteratorSymbol))
 * // false
 * console.log(typeof AsyncIteratorSymbol)
 * // symbol
 * ```
 *
 * @see {@link IteratorSymbols} for the pair used when copying iterator brands.
 * @category symbols
 * @since 0.0.0
 */
export const AsyncIteratorSymbol: unique symbol = Symbol("codemode.async-iterator");

/**
 * Well-known iterator symbol installed on guest synchronous iterables.
 *
 * **Example** (Identify the sync iterator brand)
 *
 * ```ts
 * import { IteratorSymbol, IteratorSymbols } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(IteratorSymbols.includes(IteratorSymbol))
 * // true
 * ```
 *
 * @see {@link AsyncIteratorSymbol} for the async counterpart.
 * @category symbols
 * @since 0.0.0
 */
export const IteratorSymbol: unique symbol = Symbol("codemode.iterator");

/**
 * Pair of well-known iterator symbols copied onto guest iterables.
 *
 * **Example** (Both brands are distinct symbols)
 *
 * ```ts
 * import { IteratorSymbols } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(IteratorSymbols.map(String))
 * // 2 false
 * ```
 *
 * @see {@link IteratorSymbol} for the sync member.
 * @see {@link AsyncIteratorSymbol} for the async member.
 * @category symbols
 * @since 0.0.0
 */
export const IteratorSymbols = [AsyncIteratorSymbol, IteratorSymbol] as const;

/**
 * Static Promise method name exposed to guest programs.
 *
 * **Example** (Match Promise.race)
 *
 * ```ts
 * import { PromiseMethodName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(PromiseMethodName.is.race("race"), PromiseMethodName.Enum.all)
 * // true all
 * ```
 *
 * @see {@link PromiseMethodReference} for the bound static-method handle.
 * @category models
 * @since 0.0.0
 */
export const PromiseMethodName = LiteralKit(["all", "allSettled", "race", "any", "resolve", "reject"]).pipe(
  $I.annoteSchema("PromiseMethodName", {
    description: "Static Promise method exposed to guest programs.",
  })
);

/**
 * Decoded static Promise method name produced by {@link PromiseMethodName}.
 *
 * @see {@link PromiseMethodName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type PromiseMethodName = typeof PromiseMethodName.Type;

/**
 * Static Promise method exposed to a guest program.
 *
 * **Example** (Bind Promise.all)
 *
 * ```ts
 * import { PromiseMethodReference } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const all = PromiseMethodReference.new("all")
 * console.log(all._tag, all.name)
 * // PromiseMethodReference all
 * ```
 *
 * @see {@link invokePromiseMethod} for Effect dispatch over this handle.
 * @category models
 * @since 0.0.0
 */
export class PromiseMethodReference extends S.TaggedClass<PromiseMethodReference>($I`PromiseMethodReference`)(
  "PromiseMethodReference",
  { name: PromiseMethodName },
  $I.annote("PromiseMethodReference", {
    description: "A static Promise method exposed to a guest program.",
  })
) {
  static readonly new = (name: PromiseMethodName): PromiseMethodReference => PromiseMethodReference.make({ name });
}

/**
 * Promise instance method name exposed to guest programs.
 *
 * **Example** (List instance methods)
 *
 * ```ts
 * import { PromiseInstanceMethodName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(PromiseInstanceMethodName.Options)
 * // [ "then", "catch", "finally" ]
 * ```
 *
 * @see {@link PromiseInstanceMethodReference} for the bound instance-method handle.
 * @category models
 * @since 0.0.0
 */
export const PromiseInstanceMethodName = LiteralKit(["then", "catch", "finally"]).pipe(
  $I.annoteSchema("PromiseInstanceMethodName", {
    description: "Promise instance method exposed to guest programs.",
  })
);

/**
 * Decoded Promise instance method name produced by {@link PromiseInstanceMethodName}.
 *
 * @see {@link PromiseInstanceMethodName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type PromiseInstanceMethodName = typeof PromiseInstanceMethodName.Type;

/**
 * Promise instance method bound to its guest promise.
 *
 * **Example** (Bind catch on a forked promise)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CodeModePromise } from "../../../codemode/Codemode.values.ts"
 * import { PromiseInstanceMethodReference } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const fiber = Effect.runFork(Effect.succeed(1))
 * const reference = PromiseInstanceMethodReference.new(
 *   CodeModePromise.new(fiber),
 *   "catch",
 * )
 * console.log(reference._tag, reference.name)
 * // PromiseInstanceMethodReference catch
 * ```
 *
 * @see {@link invokePromiseInstanceMethod} for Effect dispatch over this handle.
 * @category models
 * @since 0.0.0
 */
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
  static readonly new = (promise: CodeModePromise, name: PromiseInstanceMethodName): PromiseInstanceMethodReference =>
    PromiseInstanceMethodReference.make({ promise, name });
}

/**
 * Guest Promise resolve or reject capability passed to an executor.
 *
 * **Example** (Settle through the capability)
 *
 * ```ts
 * import { PromiseCapabilityFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * let settled: unknown
 * const resolve = PromiseCapabilityFunction.new((value) => {
 *   settled = value
 * })
 * resolve.settle(1)
 * console.log(resolve._tag, settled)
 * // PromiseCapabilityFunction 1
 * ```
 *
 * @see {@link constructPromise} for the executor that receives these capabilities.
 * @category models
 * @since 0.0.0
 */
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
    PromiseCapabilityFunction.make({ settle });
}

/**
 * Global namespace or constructor name available to guest programs.
 *
 * **Example** (Pick the Math namespace)
 *
 * ```ts
 * import { GlobalNamespaceName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(GlobalNamespaceName.Enum.Math, GlobalNamespaceName.is.console("console"))
 * // Math true
 * ```
 *
 * @see {@link GlobalNamespace} for the runtime handle that carries this name.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Decoded global namespace name produced by {@link GlobalNamespaceName}.
 *
 * @see {@link GlobalNamespaceName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type GlobalNamespaceName = typeof GlobalNamespaceName.Type;

/**
 * Constructor or namespace exposed to guest programs.
 *
 * **Example** (Construct Array vs Math)
 *
 * ```ts
 * import { GlobalNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { typeofValue } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * console.log(typeofValue(GlobalNamespace.new("Array")))
 * // function
 * console.log(typeofValue(GlobalNamespace.new("Math")))
 * // object
 * ```
 *
 * @see {@link typeofValue} for constructor-vs-namespace typeof.
 * @see {@link GlobalMethodReference} for static methods read off this namespace.
 * @category models
 * @since 0.0.0
 */
export class GlobalNamespace extends S.TaggedClass<GlobalNamespace>($I`GlobalNamespace`)(
  "GlobalNamespace",
  { name: GlobalNamespaceName },
  $I.annote("GlobalNamespace", {
    description: "A constructor or namespace exposed to guest programs.",
  })
) {
  static readonly new = (name: GlobalNamespaceName): GlobalNamespace => GlobalNamespace.make({ name });
}

/**
 * Every legal global namespace and static method-name combination.
 *
 * **Example** (Bind Math.abs)
 *
 * ```ts
 * import { GlobalMethod } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const method = GlobalMethod.cases.Math.make({ name: "abs" })
 * console.log(method.namespace, method.name)
 * // Math abs
 * ```
 *
 * @see {@link GlobalMethodReference} for the bound handle dispatched by {@link invokeGlobalMethod}.
 * @category models
 * @since 0.0.0
 */
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
  })
);

/**
 * Decoded global method produced by {@link GlobalMethod}.
 *
 * @see {@link GlobalMethod} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type GlobalMethod = typeof GlobalMethod.Type;

/**
 * Global method bound to its namespace.
 *
 * **Example** (Bind Array.isArray)
 *
 * ```ts
 * import {
 *   GlobalMethod,
 *   GlobalMethodReference,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const reference = GlobalMethodReference.new(
 *   GlobalMethod.cases.Array.make({ name: "isArray" }),
 * )
 * console.log(reference._tag, reference.method.name)
 * // GlobalMethodReference isArray
 * ```
 *
 * @see {@link invokeGlobalMethod} for synchronous dispatch over this handle.
 * @category models
 * @since 0.0.0
 */
export class GlobalMethodReference extends S.TaggedClass<GlobalMethodReference>($I`GlobalMethodReference`)(
  "GlobalMethodReference",
  {
    method: GlobalMethod,
  },
  $I.annote("GlobalMethodReference", {
    description: "A global method bound to its namespace.",
  })
) {
  static readonly new = (method: GlobalMethod): GlobalMethodReference => GlobalMethodReference.make({ method });
}

/**
 * JSON operation name exposed to guest programs.
 *
 * **Example** (Select stringify)
 *
 * ```ts
 * import { JsonMethodName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(JsonMethodName.Enum.stringify, JsonMethodName.is.parse("parse"))
 * // stringify true
 * ```
 *
 * @see {@link JsonMethodReference} for the bound JSON method handle.
 * @category models
 * @since 0.0.0
 */
export const JsonMethodName = LiteralKit(["parse", "stringify"]).pipe(
  $I.annoteSchema("JsonMethodName", {
    description: "JSON operation exposed to guest programs.",
  })
);

/**
 * Decoded JSON method name produced by {@link JsonMethodName}.
 *
 * @see {@link JsonMethodName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type JsonMethodName = typeof JsonMethodName.Type;

/**
 * JSON method reference exposed to a guest program.
 *
 * **Example** (Bind JSON.parse)
 *
 * ```ts
 * import { JsonMethodReference } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const parse = JsonMethodReference.new("parse")
 * console.log(parse._tag, parse.name)
 * // JsonMethodReference parse
 * ```
 *
 * @see {@link JsonMethodName} for the closed name domain.
 * @category models
 * @since 0.0.0
 */
export class JsonMethodReference extends S.TaggedClass<JsonMethodReference>($I`JsonMethodReference`)(
  "JsonMethodReference",
  { name: JsonMethodName },
  $I.annote("JsonMethodReference", {
    description: "A JSON method reference exposed to a guest program.",
  })
) {
  static readonly new = (name: JsonMethodName): JsonMethodReference => JsonMethodReference.make({ name });
}

/**
 * Primitive coercion function name exposed to guest programs.
 *
 * **Example** (Select Number)
 *
 * ```ts
 * import { CoercionFunctionName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(CoercionFunctionName.Enum.Number, CoercionFunctionName.is.parseInt("parseInt"))
 * // Number true
 * ```
 *
 * @see {@link CoercionFunction} for the runtime handle that carries this name.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Decoded coercion function name produced by {@link CoercionFunctionName}.
 *
 * @see {@link CoercionFunctionName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type CoercionFunctionName = typeof CoercionFunctionName.Type;

/**
 * Guest primitive coercion function such as `Number` or `parseInt`.
 *
 * **Example** (Construct Boolean)
 *
 * ```ts
 * import { CoercionFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const coerce = CoercionFunction.new("Boolean")
 * console.log(coerce._tag, coerce.name)
 * // CoercionFunction Boolean
 * ```
 *
 * @see {@link isSupportedCallback} — coercion functions are admitted collection callbacks.
 * @category models
 * @since 0.0.0
 */
export class CoercionFunction extends S.TaggedClass<CoercionFunction>($I`CoercionFunction`)(
  "CoercionFunction",
  { name: CoercionFunctionName },
  $I.annote("CoercionFunction", {
    description: "A guest primitive coercion function.",
  })
) {
  static readonly new = (name: CoercionFunctionName): CoercionFunction => CoercionFunction.make({ name });
}

/**
 * URI codec function name exposed to guest programs.
 *
 * **Example** (Select encodeURIComponent)
 *
 * ```ts
 * import { UriFunctionName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(UriFunctionName.Enum.encodeURIComponent)
 * // encodeURIComponent
 * ```
 *
 * @see {@link UriFunction} for the runtime handle that carries this name.
 * @category models
 * @since 0.0.0
 */
export const UriFunctionName = LiteralKit(["encodeURI", "encodeURIComponent", "decodeURI", "decodeURIComponent"]).pipe(
  $I.annoteSchema("UriFunctionName", {
    description: "A URI codec function exposed to guest programs.",
  })
);

/**
 * Decoded URI codec name produced by {@link UriFunctionName}.
 *
 * @see {@link UriFunctionName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type UriFunctionName = typeof UriFunctionName.Type;

/**
 * Guest URI codec function such as `encodeURIComponent`.
 *
 * **Example** (Construct decodeURI)
 *
 * ```ts
 * import { UriFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const decode = UriFunction.new("decodeURI")
 * console.log(decode._tag, decode.name)
 * // UriFunction decodeURI
 * ```
 *
 * @see {@link UriFunctionName} for the closed name domain.
 * @category models
 * @since 0.0.0
 */
export class UriFunction extends S.TaggedClass<UriFunction>($I`UriFunction`)(
  "UriFunction",
  { name: UriFunctionName },
  $I.annote("UriFunction", {
    description: "A guest URI codec function.",
  })
) {
  static readonly new = (name: UriFunctionName): UriFunction => UriFunction.make({ name });
}

/**
 * Built-in CodeMode tool-discovery function installed as `search`.
 *
 * **Example** (Construct the search builtin)
 *
 * ```ts
 * import { SearchFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(SearchFunction.new()._tag)
 * // SearchFunction
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchFunction extends S.TaggedClass<SearchFunction>($I`SearchFunction`)(
  "SearchFunction",
  {},
  $I.annote("SearchFunction", {
    description: "The built-in CodeMode tool-discovery function.",
  })
) {
  static readonly new = (): SearchFunction => SearchFunction.make({});
}

/**
 * Guest-thrown value propagated through the interpreter as data.
 *
 * **Example** (Wrap a thrown string)
 *
 * ```ts
 * import { ProgramThrow } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const thrown = ProgramThrow.new("boom")
 * console.log(thrown._tag, thrown.value)
 * // ProgramThrow boom
 * ```
 *
 * @see {@link InterpreterFailure} for the closed channel that includes this tag.
 * @see {@link caughtErrorValue} for unwrapping this value into a guest catch binding.
 * @category errors
 * @since 0.0.0
 */
export class ProgramThrow extends S.TaggedClass<ProgramThrow>($I`ProgramThrow`)(
  "ProgramThrow",
  {
    value: S.Unknown,
  },
  $I.annote("ProgramThrow", {
    description: "A guest-thrown value propagated through the interpreter.",
  })
) {
  static readonly new = (value: unknown): ProgramThrow => ProgramThrow.make({ value });
}

/**
 * Return value that completes a guest generator.
 *
 * **Example** (Complete a generator with a value)
 *
 * ```ts
 * import { GeneratorReturn } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const done = GeneratorReturn.new(1)
 * console.log(done._tag, done.value)
 * // GeneratorReturn 1
 * ```
 *
 * @see {@link InterpreterFailure} for the closed channel that includes this tag.
 * @category errors
 * @since 0.0.0
 */
export class GeneratorReturn extends S.TaggedClass<GeneratorReturn>($I`GeneratorReturn`)(
  "GeneratorReturn",
  {
    value: S.Unknown,
  },
  $I.annote("GeneratorReturn", {
    description: "The return value that completes a guest generator.",
  })
) {
  static readonly new = (value: unknown): GeneratorReturn => GeneratorReturn.make({ value });
}

/**
 * Error constructor name exposed to guest programs.
 *
 * **Example** (Select TypeError)
 *
 * ```ts
 * import { ErrorConstructorName } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(ErrorConstructorName.Enum.TypeError, ErrorConstructorName.is.RangeError("RangeError"))
 * // TypeError true
 * ```
 *
 * @see {@link ErrorConstructorReference} for the runtime handle that carries this name.
 * @see {@link constructErrorValue} for constructing a branded guest Error of this name.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Decoded Error constructor name produced by {@link ErrorConstructorName}.
 *
 * @see {@link ErrorConstructorName} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type ErrorConstructorName = typeof ErrorConstructorName.Type;

/**
 * Guest Error constructor reference such as `TypeError`.
 *
 * **Example** (Bind AggregateError)
 *
 * ```ts
 * import { ErrorConstructorReference } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const ctor = ErrorConstructorReference.new("AggregateError")
 * console.log(ctor._tag, ctor.name)
 * // ErrorConstructorReference AggregateError
 * ```
 *
 * @see {@link constructAggregateErrorValue} for `new AggregateError` dispatch.
 * @category models
 * @since 0.0.0
 */
export class ErrorConstructorReference extends S.TaggedClass<ErrorConstructorReference>($I`ErrorConstructorReference`)(
  "ErrorConstructorReference",
  { name: ErrorConstructorName },
  $I.annote("ErrorConstructorReference", {
    description: "A guest Error constructor reference.",
  })
) {
  static readonly new = (name: ErrorConstructorName): ErrorConstructorReference =>
    ErrorConstructorReference.make({ name });
}

/**
 * Tagged union of every schema-owned interpreter reference and control wrapper.
 *
 * **Example** (Identify a GlobalNamespace as a runtime reference)
 *
 * ```ts
 * import {
 *   GlobalNamespace,
 *   RuntimeReference,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const ns = GlobalNamespace.new("JSON")
 * console.log(RuntimeReference.is(ns), RuntimeReference.guards.GlobalNamespace(ns))
 * // true true
 * ```
 *
 * @see {@link RuntimeReferenceValue} for the broader union that also includes tools and CodeMode collections.
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
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Decoded runtime reference produced by {@link RuntimeReference}.
 *
 * @see {@link RuntimeReference} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type RuntimeReference = typeof RuntimeReference.Type;

/**
 * Stable category assigned to an interpreter failure or public diagnostic.
 *
 * **Example** (Select UnsupportedSyntax)
 *
 * ```ts
 * import { DiagnosticKind } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(DiagnosticKind.Enum.UnsupportedSyntax)
 * // UnsupportedSyntax
 * console.log(DiagnosticKind.is.ParseError("ParseError"))
 * // true
 * ```
 *
 * @see {@link InterpreterRuntimeError} for the failure that carries this kind.
 * @category models
 * @since 0.0.0
 */
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

/**
 * Decoded diagnostic kind produced by {@link DiagnosticKind}.
 *
 * @see {@link DiagnosticKind} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type DiagnosticKind = typeof DiagnosticKind.Type;

/**
 * Sentinel returned by optional chaining when the base is nullish.
 *
 * **Example** (The sentinel is a unique symbol)
 *
 * ```ts
 * import { OptionalShortCircuit } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(typeof OptionalShortCircuit)
 * // symbol
 * console.log(OptionalShortCircuit === Symbol("codemode.optional-short-circuit"))
 * // false
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const OptionalShortCircuit: unique symbol = Symbol("codemode.optional-short-circuit");

/**
 * Human-readable summary of orchestration syntax the evaluator accepts.
 *
 * **Details**
 *
 * Embedded both as the suffix of {@link unsupportedSyntax} messages and as the
 * suggestions array on those failures.
 *
 * **Example** (The message lists tools.* and Promise combinators)
 *
 * ```ts
 * import { supportedSyntaxMessage } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(supportedSyntaxMessage.includes("tools.*"))
 * // true
 * console.log(supportedSyntaxMessage.includes("Promise.all"))
 * // true
 * ```
 *
 * @see {@link unsupportedSyntax} for the failure constructor that embeds this text.
 * @category constants
 * @since 0.0.0
 */
export const supportedSyntaxMessage =
  "Supported orchestration syntax: tools.* calls (they return promises - resolve them with await), data literals, destructuring, optional chaining, template literals, conditionals, switch, loops (incl. for...of and for...in over object/array/tools keys), arrow functions, spread, try/catch, array methods (map/filter/find/findIndex/some/every/reduce/flatMap/forEach/sort/slice/concat/indexOf/lastIndexOf/at/flat/reverse/includes/join), string methods (incl. match/matchAll/replace/split with regular expressions), Date/RegExp/Map/Set/URL/URLSearchParams, URI encoding helpers, Object/Math/JSON helpers, captured console.log/warn/error/dir/table, Promise.all/allSettled/race/any/resolve/reject over arrays mixing promises and plain values for parallel tool calls, promise chaining with .then/.catch/.finally, and new Promise((resolve, reject) => ...) construction.";

/**
 * Typed failure raised while evaluating a guest program, before public diagnostics.
 *
 * **Example** (Brand a TypeError and keep the execution kind)
 *
 * ```ts
 * import { InterpreterRuntimeError } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const error = InterpreterRuntimeError.new("Unknown identifier 'x'.").as("TypeError")
 * console.log(error._tag, error.errorName, error.kind)
 * // InterpreterRuntimeError TypeError ExecutionFailure
 * ```
 *
 * @see {@link normalizeError} for the public diagnostic projection.
 * @see {@link tryInterpreter} for capturing this throw into {@link InterpreterFailure}.
 * @category errors
 * @since 0.0.0
 */
export class InterpreterRuntimeError extends S.TaggedError<InterpreterRuntimeError>($I`InterpreterRuntimeError`)(
  "InterpreterRuntimeError",
  {
    message: S.String,
    node: S.OptionFromOptionalKey(AstNode).pipe(SchemaUtils.withNoneDefault),
    kind: DiagnosticKind.pipe(SchemaUtils.withKeyDefaults(DiagnosticKind.Enum.ExecutionFailure)),
    suggestions: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    errorName: ErrorConstructorName.pipe(SchemaUtils.withKeyDefaults(ErrorConstructorName.Enum.Error)),
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

  /**
   * Returns a copy of this failure branded with a different guest `errorName`.
   *
   * **Example** (Brand a TypeError)
   *
   * ```ts
   * import { InterpreterRuntimeError } from "../../../codemode/interpreter/Interpreter.model.ts"
   *
   * const error = InterpreterRuntimeError.new("Unknown identifier 'x'.").as("TypeError")
   * console.log(error.errorName)
   * // TypeError
   * ```
   *
   * @since 0.0.0
   */
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
 * Closed recoverable failure channel for guest evaluation and host tool calls.
 *
 * **Details**
 *
 * Arbitrary guest-thrown values remain data inside {@link ProgramThrow}; the
 * Effect error channel itself is therefore closed and schema-owned. Do not wrap
 * {@link asNode} in this union by catching raw throws — use {@link tryInterpreter}.
 *
 * **Example** (A runtime error is an InterpreterFailure, a string is not)
 *
 * ```ts
 * import {
 *   InterpreterFailure,
 *   InterpreterRuntimeError,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const error = InterpreterRuntimeError.new("boom")
 * console.log(InterpreterFailure.is(error), InterpreterFailure.guards.ProgramThrow(error))
 * // true false
 * ```
 *
 * @see {@link normalizeError} for the public diagnostic projection of this channel.
 * @see {@link ProgramThrow} for guest-thrown values that stay data.
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
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Decoded recoverable failure produced by {@link InterpreterFailure}.
 *
 * @see {@link InterpreterFailure} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type InterpreterFailure = typeof InterpreterFailure.Type;

/**
 * Captures a synchronous interpreter adapter into the closed failure channel.
 *
 * **Details**
 *
 * AST readers such as {@link asNode} throw {@link InterpreterRuntimeError}
 * outside Effect. This helper is the capture hatch: it returns `Result` so the
 * failure stays on {@link InterpreterFailure} instead of becoming a defect.
 *
 * **Example** (Capture a throwing AST read)
 *
 * ```ts
 * import { Result } from "effect"
 * import {
 *   asNode,
 *   tryInterpreter,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const ok = tryInterpreter(() => asNode({ type: "Identifier", name: "x" }, "id"))
 * console.log(Result.isSuccess(ok))
 * // true
 *
 * const failed = tryInterpreter(() => asNode(1, "body"))
 * console.log(Result.isFailure(failed))
 * // true
 * ```
 *
 * @see {@link asNode} for a throwing reader that should always be captured this way.
 * @category error-handling
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- The optional AST context makes a one-argument evaluation call indistinguishable from a curried overload.
export const tryInterpreter = <Value>(
  evaluate: () => Value,
  node?: AstNode
): Result.Result<Value, InterpreterFailure> =>
  Result.try({
    try: evaluate,
    catch: (error) =>
      InterpreterFailure.is(error)
        ? error
        : InterpreterRuntimeError.new(P.isError(error) ? error.message : globalThis.String(error), node),
  });

/**
 * Builds an `UnsupportedSyntax` runtime error that embeds {@link supportedSyntaxMessage}.
 *
 * **Example** (Reject a class declaration)
 *
 * ```ts
 * import { unsupportedSyntax } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const error = unsupportedSyntax("ClassDeclaration", { type: "ClassDeclaration" })
 * console.log(error.kind)
 * // UnsupportedSyntax
 * console.log(error.message.includes("ClassDeclaration"))
 * // true
 * ```
 *
 * @see {@link supportedSyntaxMessage} for the text reused as message suffix and suggestions.
 * @category error-handling
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Syntax kind and offending AST node are co-primary inputs for a newly allocated diagnostic.
export const unsupportedSyntax = (kind: string, node: AstNode): InterpreterRuntimeError =>
  InterpreterRuntimeError.new(
    `Syntax '${kind}' is not supported. ${supportedSyntaxMessage}`,
    node,
    DiagnosticKind.Enum.UnsupportedSyntax,
    [supportedSyntaxMessage]
  );

/**
 * Narrows a value to a non-null object record.
 *
 * **Example** (Reject null, accept a node-like object)
 *
 * ```ts
 * import { isRecord } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(isRecord({ type: "Identifier" }), isRecord(null), isRecord("x"))
 * // true false false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isRecord = P.isObject;

/**
 * Throws unless `value` is a decoded {@link AstNode}.
 *
 * **Example** (Read a node or capture the throw)
 *
 * ```ts
 * import { Result } from "effect"
 * import { asNode, tryInterpreter } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const node = asNode({ type: "Identifier", name: "x" }, "id")
 * console.log(node.type)
 * // Identifier
 *
 * console.log(Result.isFailure(tryInterpreter(() => asNode(1, "body"))))
 * // true
 * ```
 *
 * @see {@link tryInterpreter} for the capture hatch that keeps this throw on {@link InterpreterFailure}.
 * @throws InterpreterRuntimeError when `value` is not an {@link AstNode}.
 * @category parsing
 * @since 0.0.0
 */
export const asNode: {
  (context: string): (value: unknown) => AstNode;
  (value: unknown, context: string): AstNode;
} = dual(2, (value: unknown, context: string): AstNode => {
  if (!AstNode.is(value)) {
    throw InterpreterRuntimeError.new(`Invalid AST node while reading ${context}.`);
  }
  return value;
});

/**
 * Reads `node[key]` as an array, throwing if the property is missing or not an array.
 *
 * **Example** (Read a statement list)
 *
 * ```ts
 * import { getArray } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(getArray({ type: "Program", body: [1, 2] }, "body"))
 * // [ 1, 2 ]
 * ```
 *
 * @see {@link tryInterpreter} for capturing the throw inside Effect/Result.
 * @throws InterpreterRuntimeError when the property is not an array.
 * @category parsing
 * @since 0.0.0
 */
export const getArray: {
  (key: string): (node: AstNode) => Array<unknown>;
  (node: AstNode, key: string): Array<unknown>;
} = dual(2, (node: AstNode, key: string): Array<unknown> => {
  const value = node[key];
  if (!A.isArray(value)) {
    throw InterpreterRuntimeError.new(`Expected '${key}' to be an array.`, node);
  }
  return value;
});

/**
 * Reads `node[key]` as a string, throwing if the property is not a string.
 *
 * **Example** (Read an identifier name)
 *
 * ```ts
 * import { getString } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(getString({ type: "Identifier", name: "count" }, "name"))
 * // count
 * ```
 *
 * @see {@link tryInterpreter} for capturing the throw inside Effect/Result.
 * @throws InterpreterRuntimeError when the property is not a string.
 * @category parsing
 * @since 0.0.0
 */
export const getString: {
  (key: string): (node: AstNode) => string;
  (node: AstNode, key: string): string;
} = dual(2, (node: AstNode, key: string): string => {
  const value = node[key];
  if (!P.isString(value)) {
    throw InterpreterRuntimeError.new(`Expected '${key}' to be a string.`, node);
  }
  return value;
});

/**
 * Reads `node[key]` as a boolean, throwing if the property is not a boolean.
 *
 * **Example** (Read an async flag)
 *
 * ```ts
 * import { getBoolean } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(getBoolean({ type: "FunctionExpression", async: true }, "async"))
 * // true
 * ```
 *
 * @see {@link tryInterpreter} for capturing the throw inside Effect/Result.
 * @throws InterpreterRuntimeError when the property is not a boolean.
 * @category parsing
 * @since 0.0.0
 */
export const getBoolean: {
  (key: string): (node: AstNode) => boolean;
  (node: AstNode, key: string): boolean;
} = dual(2, (node: AstNode, key: string): boolean => {
  const value = node[key];
  if (!P.isBoolean(value)) {
    throw InterpreterRuntimeError.new(`Expected '${key}' to be a boolean.`, node);
  }
  return value;
});

/**
 * Reads `node[key]` as an {@link AstNode}, returning `undefined` when the property is nullish.
 *
 * **Example** (Absent alternate on an IfStatement)
 *
 * ```ts
 * import { getOptionalNode } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * console.log(getOptionalNode({ type: "IfStatement" }, "alternate"))
 * // undefined
 * ```
 *
 * @see {@link asNode} for the throwing conversion used when the property is present.
 * @throws InterpreterRuntimeError when the property is present but not an {@link AstNode}.
 * @category parsing
 * @since 0.0.0
 */
export const getOptionalNode: {
  (key: string): (node: AstNode) => AstNode | undefined;
  (node: AstNode, key: string): AstNode | undefined;
} = dual(2, (node: AstNode, key: string): AstNode | undefined => {
  const value = node[key];
  return P.isNullish(value) ? undefined : asNode(value, key);
});

/**
 * Reads `node[key]` as a required {@link AstNode}.
 *
 * **Example** (Read an expression child)
 *
 * ```ts
 * import { getNode } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const expression = getNode(
 *   { type: "ExpressionStatement", expression: { type: "Literal", value: 1 } },
 *   "expression",
 * )
 * console.log(expression.type)
 * // Literal
 * ```
 *
 * @see {@link asNode} for the throwing conversion this helper delegates to.
 * @see {@link tryInterpreter} for capturing the throw inside Effect/Result.
 * @throws InterpreterRuntimeError when the property is not an {@link AstNode}.
 * @category parsing
 * @since 0.0.0
 */
export const getNode: {
  (key: string): (node: AstNode) => AstNode;
  (node: AstNode, key: string): AstNode;
} = dual(2, (node: AstNode, key: string): AstNode => asNode(node[key], key));

/**
 * Converts a node's Acorn `loc` into one-based user coordinates.
 *
 * **Gotchas**
 *
 * Coordinates undo the `async function __codemode__() {\n` wrapper inserted by
 * {@link executeWithLimits}: `line` is `max(1, (start.line ?? 2) - 1)` and
 * `column` is `max(1, (start.column ?? 4) - 3)`. Printing raw Acorn `loc` is
 * off-by-one relative to the user source. Missing `loc` still returns `(1, 1)`.
 *
 * **Example** (Undo the wrapper offset)
 *
 * ```ts
 * import {
 *   SourceLocation,
 *   SourcePosition,
 *   sourceLocation,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const location = sourceLocation({
 *   type: "Identifier",
 *   loc: SourceLocation.new(SourcePosition.new(2, 4), SourcePosition.new(2, 10)),
 * })
 * console.log(location.line, location.column)
 * // 1 1
 * ```
 *
 * @see {@link SourcePosition} for the unadjusted parser coordinates stored on the node.
 * @see {@link formatLocation} for the diagnostic suffix built from this pair.
 * @category formatting
 * @since 0.0.0
 */
export const sourceLocation = (
  node: AstNode
): {
  readonly line: number;
  readonly column: number;
} => ({
  line: N.max(1, (node.loc?.start.line ?? 2) - 1),
  column: N.max(1, (node.loc?.start.column ?? 4) - 3),
});

/**
 * Formats a wrapper-adjusted `(line, col)` suffix for diagnostic messages.
 *
 * **Gotchas**
 *
 * Returns `""` when `node` or `node.loc` is missing. Uses {@link sourceLocation},
 * so the printed coordinates already undo the CodeMode async wrapper.
 *
 * **Example** (Format a located node and a missing loc)
 *
 * ```ts
 * import {
 *   SourceLocation,
 *   SourcePosition,
 *   formatLocation,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 *
 * const located = {
 *   type: "Identifier",
 *   loc: SourceLocation.new(SourcePosition.new(2, 4), SourcePosition.new(2, 10)),
 * }
 * console.log(formatLocation(located))
 * //  (line 1, col 1)
 * console.log(formatLocation({ type: "Identifier" }))
 * //
 * ```
 *
 * @see {@link sourceLocation} for the wrapper-adjusted pair this helper stringifies.
 * @category formatting
 * @since 0.0.0
 */
export const formatLocation = (node?: AstNode): string => {
  if (P.isUndefined(node?.loc)) return "";
  const location = sourceLocation(node);
  return ` (line ${location.line}, col ${location.column})`;
};
