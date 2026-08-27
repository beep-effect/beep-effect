/**
 * Effect AI Toolkit adapter and plain-data boundary for CodeMode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Unknown } from "@beep/schema/Unknown";
import {$ScratchpadId} from "@beep/identity";
import {
  LiteralKit,
  NonEmptyTrimmedStr,
  NonNegativeInt,
  PosInt,
  SafeObject as SafeObjectSchema,
  SchemaUtils,
} from "@beep/schema";
import {A, O, P, pipe, R, Str, Struct, thunkNull} from "@beep/utils";
import {
  Cause,
  Clock,
  DateTime,
  Effect,
  Exit,
  flow,
  HashMap,
  HashSet,
  Order,
  Ref,
  Result,
  Stream,
} from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as AiError from "effect/unstable/ai/AiError";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import {ToolError} from "./Codemode.tool-error.ts";
import {
  identifierSegment,
  inputProperties,
  inputTypeScript,
  outputTypeScript
} from "./Codemode.tool-schema.ts";
import {
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
  isCodeModeValue,
} from "./Codemode.values.ts";

const $I = $ScratchpadId.create("codemode/Codemode.tool-runtime");

export type {SafeObject} from "@beep/schema/SafeObject";

/**
 * Services required to obtain Toolkit handlers and run their streams.
 *
 * @see {@link make} for the execution-local runtime that requires these services.
 * @category type-level
 * @since 0.0.0
 */
export type Services<ToolkitType extends Toolkit.Any> =
  | (ToolkitType extends Effect.Effect<unknown, never, infer Requirements> ? Requirements : never)
  | Tool.HandlerServices<Toolkit.Tools<ToolkitType>[keyof Toolkit.Tools<ToolkitType>]>;

/**
 * Canonical catalog entry exposed to the CodeMode host.
 *
 * **Example** (Construct a catalog entry)
 *
 * ```ts
 * import { ToolDescription } from "@beep/scratchpad/codemode"
 *
 * const description = ToolDescription.new(
 *   "search.docs",
 *   "Search project documentation",
 *   "tools.search.docs(input: { query: string }): Promise<string>"
 * )
 *
 * console.log(description.path) // "search.docs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolDescription extends S.Class<ToolDescription>($I`ToolDescription`)(
  {
    path: S.String,
    description: S.String,
    signature: S.String,
  },
  $I.annote("ToolDescription", {
    description: "One Toolkit operation rendered for CodeMode discovery.",
  })
) {
  static readonly new = (path: string, description: string, signature: string): ToolDescription =>
    ToolDescription.make({path, description, signature});
}

/**
 * Canonical name of one admitted tool call.
 *
 * **Example** (Record an admitted call)
 *
 * ```ts
 * import { ToolCall } from "@beep/scratchpad/codemode"
 *
 * const call = ToolCall.new("search")
 *
 * console.log(call.name) // "search"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolCall extends S.Class<ToolCall>($I`ToolCall`)(
  {name: NonEmptyTrimmedStr},
  $I.annote("ToolCall", {
    description: "Canonical name of one admitted tool call.",
  })
) {
  static readonly new = (name: string): ToolCall =>
    ToolCall.make({name: NonEmptyTrimmedStr.make(name)});
}

/**
 * Hook payload emitted immediately before handler execution.
 *
 * **Example** (Build a start observation)
 *
 * ```ts
 * import { ToolCall, ToolCallStarted } from "@beep/scratchpad/codemode"
 *
 * const started = ToolCallStarted.new(0, ToolCall.new("search"), { query: "docs" })
 *
 * console.log(started.name) // "search"
 * console.log(started.index) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolCallStarted extends S.Class<ToolCallStarted>($I`ToolCallStarted`)(
  {
    index: NonNegativeInt,
    name: NonEmptyTrimmedStr,
    input: S.Unknown,
  },
  $I.annote("ToolCallStarted", {
    description: "Decoded input and index for an admitted tool call.",
  })
) {
  static readonly new = (index: number, call: ToolCall, input: unknown): ToolCallStarted =>
    ToolCallStarted.make({
      index: NonNegativeInt.make(index),
      name: call.name,
      input,
    });
}

const endedFields = {
  index: NonNegativeInt,
  name: NonEmptyTrimmedStr,
  input: S.Unknown,
  durationMs: NonNegativeInt,
};

/**
 * Successful terminal observation for one admitted tool call.
 *
 * **Gotchas**
 *
 * `message` is `S.optionalKey(S.Never)` so the ended field set is shared with
 * {@link ToolCallFailed}; a success observation cannot carry a message.
 *
 * **Example** (Build a success observation)
 *
 * ```ts
 * import { ToolCall, ToolCallStarted, ToolCallSucceeded } from "@beep/scratchpad/codemode"
 *
 * const started = ToolCallStarted.new(0, ToolCall.new("search"), {})
 * const ended = ToolCallSucceeded.new(started, 5)
 *
 * console.log(ended._tag) // "success"
 * console.log(ended.durationMs) // 5
 * ```
 *
 * @see {@link ToolCallEnded} for the union of success, interruption, and failure.
 * @category models
 * @since 0.0.0
 */
export class ToolCallSucceeded extends S.TaggedClass<ToolCallSucceeded>($I`ToolCallSucceeded`)(
  "success",
  {
    ...endedFields,
    message: S.optionalKey(S.Never),
  },
  $I.annote("ToolCallSucceeded", {
    description: "An admitted tool call completed successfully.",
  })
) {
  static readonly new = (
    call: ToolCallStarted,
    durationMs: number
  ): ToolCallSucceeded =>
    ToolCallSucceeded.make({
      index: call.index,
      name: call.name,
      input: call.input,
      durationMs: NonNegativeInt.make(durationMs),
    });
}

/**
 * Interrupted terminal observation for one admitted tool call.
 *
 * **Gotchas**
 *
 * `message` is uninhabited (`S.Never`) so this observation shares ended fields
 * with {@link ToolCallFailed} without carrying a failure message.
 *
 * **Example** (Build an interruption observation)
 *
 * ```ts
 * import { ToolCall, ToolCallStarted } from "@beep/scratchpad/codemode"
 * import { ToolCallInterrupted } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * const started = ToolCallStarted.new(0, ToolCall.new("search"), {})
 * const ended = ToolCallInterrupted.new(started, 2)
 *
 * console.log(ended._tag) // "interrupted"
 * ```
 *
 * @see {@link ToolCallEnded} for the union of success, interruption, and failure.
 * @category models
 * @since 0.0.0
 */
export class ToolCallInterrupted extends S.TaggedClass<ToolCallInterrupted>($I`ToolCallInterrupted`)(
  "interrupted",
  {
    ...endedFields,
    message: S.optionalKey(S.Never),
  },
  $I.annote("ToolCallInterrupted", {
    description: "An admitted tool call was interrupted.",
  })
) {
  static readonly new = (
    call: ToolCallStarted,
    durationMs: number
  ): ToolCallInterrupted =>
    ToolCallInterrupted.make({
      index: call.index,
      name: call.name,
      input: call.input,
      durationMs: NonNegativeInt.make(durationMs),
    });
}

/**
 * Failed terminal observation for one admitted tool call.
 *
 * **Example** (Build a failure observation)
 *
 * ```ts
 * import { ToolCall, ToolCallStarted } from "@beep/scratchpad/codemode"
 * import { ToolCallFailed } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * const started = ToolCallStarted.new(0, ToolCall.new("search"), {})
 * const ended = ToolCallFailed.new(started, 3, "search is disabled")
 *
 * console.log(ended._tag) // "failure"
 * console.log(ended.message) // "search is disabled"
 * ```
 *
 * @see {@link ToolCallEnded} for the union of success, interruption, and failure.
 * @category models
 * @since 0.0.0
 */
export class ToolCallFailed extends S.TaggedClass<ToolCallFailed>($I`ToolCallFailed`)(
  "failure",
  {
    ...endedFields,
    message: S.String,
  },
  $I.annote("ToolCallFailed", {
    description: "An admitted tool call failed with a hook-safe message.",
  })
) {
  static readonly new = (
    call: ToolCallStarted,
    durationMs: number,
    message: string
  ): ToolCallFailed =>
    ToolCallFailed.make({
      index: call.index,
      name: call.name,
      input: call.input,
      durationMs: NonNegativeInt.make(durationMs),
      message,
    });
}

/**
 * Exhaustive terminal observation for one admitted tool call.
 *
 * **Example** (Recognize a success member)
 *
 * ```ts
 * import { ToolCall, ToolCallEnded, ToolCallStarted, ToolCallSucceeded } from "@beep/scratchpad/codemode"
 *
 * const started = ToolCallStarted.new(0, ToolCall.new("search"), {})
 * const ended = ToolCallSucceeded.new(started, 5)
 *
 * console.log(ToolCallEnded.is(ended)) // true
 * console.log(ended._tag) // "success"
 * ```
 *
 * @see {@link ToolCallSucceeded} for the success member whose `message` is uninhabited.
 * @category models
 * @since 0.0.0
 */
export const ToolCallEnded = S.Union([
  ToolCallSucceeded,
  ToolCallInterrupted,
  ToolCallFailed,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ToolCallEnded", {
    description: "All terminal observations for an admitted tool call.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded terminal observation produced by {@link ToolCallEnded}.
 *
 * @see {@link ToolCallEnded} for the runtime tagged union and membership guard.
 * @category type-level
 * @since 0.0.0
 */
export type ToolCallEnded = typeof ToolCallEnded.Type;

/**
 * Optional observers invoked around admitted tool execution.
 *
 * @see {@link ToolCallStarted} for the start payload passed to `onToolCallStart`.
 * @see {@link ToolCallEnded} for the terminal payload passed to `onToolCallEnd`.
 * @category type-level
 * @since 0.0.0
 */
export type ToolCallHooks<R = never> = {
  readonly onToolCallStart?: (call: ToolCallStarted) => Effect.Effect<void, never, R>;
  readonly onToolCallEnd?: (call: ToolCallEnded) => Effect.Effect<void, never, R>;
};

/**
 * Search query and pagination controls for the built-in discovery function.
 *
 * **Gotchas**
 *
 * Default page size is `limit=10` and `offset=0` when those keys are omitted.
 *
 * **Example** (Use discovery defaults)
 *
 * ```ts
 * import { SearchInput } from "../../../codemode/Codemode.tool-runtime.ts"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(SearchInput)({})
 *
 * console.log(input.limit) // 10
 * console.log(input.offset) // 0
 * console.log(O.isNone(input.query)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchInput extends S.Class<SearchInput>($I`SearchInput`)(
  {
    query: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    namespace: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(10))),
    offset: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("SearchInput", {
    description: "Search query and pagination controls for the built-in discovery function.",
  })
) {
  static readonly new = (
    query?: string,
    namespace?: string,
    limit: number = 10,
    offset: number = 0
  ): SearchInput =>
    SearchInput.make({
      query: O.fromNullishOr(query),
      namespace: O.fromNullishOr(namespace),
      limit: PosInt.make(limit),
      offset: NonNegativeInt.make(offset),
    });
}

/**
 * One tool matched by built-in discovery.
 *
 * **Example** (Construct a discovery hit)
 *
 * ```ts
 * import { SearchItem } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * const item = SearchItem.new(
 *   "tools.search",
 *   "Find tools",
 *   "search(input: { query?: string }): { items: Array<unknown> }"
 * )
 *
 * console.log(item.path) // "tools.search"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchItem extends S.Class<SearchItem>($I`SearchItem`)(
  {
    path: S.String,
    description: S.String,
    signature: S.String,
  },
  $I.annote("SearchItem", {
    description: "One tool matched by built-in discovery.",
  })
) {
  static readonly new = (path: string, description: string, signature: string): SearchItem =>
    SearchItem.make({path, description, signature});
}

/**
 * Paginated tool-discovery results.
 *
 * **Example** (Build a complete page)
 *
 * ```ts
 * import { SearchItem, SearchOutput } from "../../../codemode/Codemode.tool-runtime.ts"
 * import * as O from "effect/Option"
 *
 * const output = SearchOutput.new(
 *   [SearchItem.new("tools.search", "Find tools", "search(...)")],
 *   0
 * )
 *
 * console.log(output.remaining) // 0
 * console.log(O.isNone(output.next)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchOutput extends S.Class<SearchOutput>($I`SearchOutput`)(
  {
    items: S.Array(SearchItem),
    remaining: NonNegativeInt,
    next: S.OptionFromNullOr(S.Struct({offset: NonNegativeInt})).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SearchOutput", {
    description: "Paginated tool-discovery results.",
  })
) {
  static readonly new = (
    items: ReadonlyArray<SearchItem>,
    remaining: number,
    nextOffset?: number
  ): SearchOutput =>
    SearchOutput.make({
      items,
      remaining: NonNegativeInt.make(remaining),
      next: pipe(
        O.fromNullishOr(nextOffset),
        O.map((offset) => ({offset: NonNegativeInt.make(offset)}))
      ),
    });
}

/**
 * Pre-tokenized catalog entry used by the discovery function.
 *
 * **Example** (Index one catalog path)
 *
 * ```ts
 * import { SearchEntry, ToolDescription } from "@beep/scratchpad/codemode"
 *
 * const description = ToolDescription.new("search.docs", "Search docs", "tools.search.docs()")
 * const entry = SearchEntry.new(description, "search", "search.docs\nsearch docs")
 *
 * console.log(entry.namespace) // "search"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchEntry extends S.Class<SearchEntry>($I`SearchEntry`)(
  {
    description: ToolDescription,
    namespace: S.String,
    searchText: S.String,
  },
  $I.annote("SearchEntry", {
    description: "Pre-tokenized catalog entry used by the discovery function.",
  })
) {
  static readonly new = (
    description: ToolDescription,
    namespace: string,
    searchText: string
  ): SearchEntry => SearchEntry.make({description, namespace, searchText});
}

/**
 * Stable catalog and search index for one Toolkit.
 *
 * **Example** (Build an empty plan)
 *
 * ```ts
 * import { DiscoveryPlan } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * const plan = DiscoveryPlan.new([], [])
 *
 * console.log(plan.catalog.length) // 0
 * console.log(plan.searchIndex.length) // 0
 * ```
 *
 * @see {@link prepare} for the function that builds this plan from a Toolkit.
 * @category models
 * @since 0.0.0
 */
export class DiscoveryPlan extends S.Class<DiscoveryPlan>($I`DiscoveryPlan`)(
  {
    catalog: S.Array(ToolDescription),
    searchIndex: S.Array(SearchEntry),
  },
  $I.annote("DiscoveryPlan", {
    description: "Stable catalog and search index for one Toolkit.",
  })
) {
  static readonly new = (
    catalog: ReadonlyArray<ToolDescription>,
    searchIndex: ReadonlyArray<SearchEntry>
  ): DiscoveryPlan => DiscoveryPlan.make({catalog, searchIndex});
}

/**
 * Boundary copy behavior for bare `undefined` at the guest-to-host edge.
 *
 * **Gotchas**
 *
 * Non-finite numbers always become `null` in both modes. `json` drops undefined
 * object keys and nullifies undefined array items; `nullify` preserves object
 * keys while replacing undefined with `null`. {@link ToolReference} objects
 * pass through uncopied.
 *
 * **Example** (Nullify undefined)
 *
 * ```ts
 * import { CopyOutMode } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * console.log(CopyOutMode.is.json("json")) // true
 * console.log(CopyOutMode.is.nullify("nullify")) // true
 * ```
 *
 * @see {@link copyOut} for the copier that interprets these modes.
 * @category schemas
 * @since 0.0.0
 */
export const CopyOutMode = LiteralKit(["json", "nullify"]).pipe(
  $I.annoteSchema("CopyOutMode", {
    description: "Whether a bare undefined is preserved or normalized to null.",
  })
);

/**
 * Decoded copy-out mode produced by {@link CopyOutMode}.
 *
 * @see {@link CopyOutMode} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type CopyOutMode = typeof CopyOutMode.Type;

/**
 * Runtime handle representing a namespace path below `tools`.
 *
 * **Example** (Build a nested tool path)
 *
 * ```ts
 * import { ToolReference } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * const reference = ToolReference.new(["search", "docs"])
 *
 * console.log(ToolReference.is(reference)) // true
 * console.log(reference.path) // ["search", "docs"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolReference extends S.TaggedClass<ToolReference>($I`ToolReference`)(
  "ToolReference",
  {path: S.Array(S.String)},
  $I.annote("ToolReference", {
    description: "A path into the current Toolkit namespace tree.",
  })
) {
  static readonly is = S.is(ToolReference);
  static readonly new = (path: ReadonlyArray<string>): ToolReference => ToolReference.make({path});
}

/**
 * Stable ToolRuntime failure categories owned by the Toolkit adapter.
 *
 * **Example** (Admit UnknownTool)
 *
 * ```ts
 * import { ToolRuntimeErrorKind } from "../../../codemode/Codemode.tool-runtime.ts"
 *
 * console.log(ToolRuntimeErrorKind.is.UnknownTool("UnknownTool")) // true
 * console.log(ToolRuntimeErrorKind.is.UnknownTool("TimeoutExceeded")) // false
 * ```
 *
 * @see {@link ToolRuntimeError} for the tagged error that carries one of these kinds.
 * @category schemas
 * @since 0.0.0
 */
export const ToolRuntimeErrorKind = LiteralKit([
  "UnknownTool",
  "InvalidToolInput",
  "InvalidToolOutput",
  "InvalidDataValue",
  "ToolCallLimitExceeded",
]).pipe(
  $I.annoteSchema("ToolRuntimeErrorKind", {
    description: "Failures owned by the Toolkit adapter and data boundary.",
  })
);

/**
 * Decoded failure kind produced by {@link ToolRuntimeErrorKind}.
 *
 * @see {@link ToolRuntimeErrorKind} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type ToolRuntimeErrorKind = typeof ToolRuntimeErrorKind.Type;

/**
 * Normalized failure at the CodeMode Toolkit or plain-data boundary.
 *
 * **Example** (Construct an unknown-tool failure)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 *
 * const error = ToolRuntime.ToolRuntimeError.new("UnknownTool", "Unknown tool 'search.docs'.")
 *
 * console.log(ToolRuntime.ToolRuntimeError.is(error)) // true
 * console.log(error.kind) // "UnknownTool"
 * ```
 *
 * @see {@link ToolRuntimeErrorKind} for the finite kind domain carried on `kind`.
 * @category errors
 * @since 0.0.0
 */
export class ToolRuntimeError extends S.TaggedError<ToolRuntimeError>($I`ToolRuntimeError`)(
  "ToolRuntimeError",
  {
    kind: ToolRuntimeErrorKind,
    message: S.String,
    suggestions: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
  },
  $I.annote("ToolRuntimeError", {
    description: "A normalized failure at the CodeMode Toolkit or plain-data boundary.",
  })
) {
  static readonly is = S.is(ToolRuntimeError);
  static readonly new = (
    kind: ToolRuntimeErrorKind,
    message: string,
    suggestions: ReadonlyArray<string> = A.empty()
  ): ToolRuntimeError => ToolRuntimeError.make({kind, message, suggestions});
}

const MAX_VALUE_DEPTH = 32;
const blockedMemberNames = HashSet.fromIterable(["__proto__", "constructor", "prototype"]);

/**
 * Returns whether a property name is blocked at the guest object boundary.
 *
 * **Details**
 *
 * Blocked names are exactly `__proto__`, `constructor`, and `prototype`.
 *
 * **Example** (Reject constructor, admit name)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 *
 * console.log(ToolRuntime.isBlockedMember("constructor")) // true
 * console.log(ToolRuntime.isBlockedMember("name")) // false
 * ```
 *
 * @see {@link copyIn} for the copier that throws when a blocked member is present.
 * @category predicates
 * @since 0.0.0
 */
export const isBlockedMember = (name: string): boolean => HashSet.has(blockedMemberNames, name);

const isoFromEpochMillis = (millis: number): string | null =>
  O.match(DateTime.make(millis), {
    onNone: thunkNull,
    onSome: DateTime.formatIso,
  });

/**
 * Copies host data into a bounded guest representation.
 *
 * **Details**
 *
 * Checkpoint mode (`preserveCodeModeValues=true`) preserves guest objects and
 * wraps native Date/Map/Set/URL/URLSearchParams as CodeMode adapters.
 * Boundary mode JSON-normalizes those values (ISO dates, empty objects for
 * Map/Set/RegExp) and rejects un-awaited {@link CodeModePromise} handles.
 *
 * **Gotchas**
 *
 * Depth is capped at 32. Circular values, blocked members (`__proto__`,
 * `constructor`, `prototype`), non-plain prototypes, non-data values, and
 * un-awaited promises throw {@link ToolRuntimeError}. Checkpoint mode copies
 * enumerable named array properties; invalid Date values remain observable.
 *
 * **Example** (Normalize a Date and reject a circular value)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 *
 * const copied = ToolRuntime.copyIn(new Date("2020-01-01T00:00:00.000Z"), "value")
 * console.log(copied) // "2020-01-01T00:00:00.000Z"
 *
 * const circular: { self?: unknown } = {}
 * circular.self = circular
 * try {
 *   ToolRuntime.copyIn(circular, "value")
 * } catch (error) {
 *   console.log(ToolRuntime.ToolRuntimeError.is(error)) // true
 * }
 * ```
 *
 * @param label - Path label included in thrown {@link ToolRuntimeError} messages.
 * @param preserveCodeModeValues - When true, keep guest adapters; when false, JSON-normalize.
 * @throws ToolRuntimeError when depth exceeds 32, a value is circular, a blocked member is present, a prototype is not plain, a non-data value appears, or a CodeModePromise is un-awaited.
 * @see {@link copyOut} for the guest-to-host copier.
 * @see {@link isBlockedMember} for the blocked property-name predicate.
 * @see {@link CopyOutMode} for how the reverse copy treats undefined.
 * @category encoding
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- The required boundary label plus defaulted adapter-preservation flag leave no unambiguous curried arity.
export const copyIn = (value: unknown, label: string, preserveCodeModeValues = false): unknown =>
  copyBounded(value, label, 0, HashSet.empty(), preserveCodeModeValues);

const copyBounded = (
  value: unknown,
  label: string,
  depth: number,
  seen: HashSet.HashSet<object>,
  preserveCodeModeValues: boolean
): unknown => {
  if (depth > MAX_VALUE_DEPTH) {
    throw ToolRuntimeError.new(
      "InvalidDataValue",
      `${label} exceeds the maximum value depth of ${MAX_VALUE_DEPTH}.`
    );
  }
  if (P.isNullish(value) || P.isString(value) || P.isBoolean(value) || P.isNumber(value)) return value;
  if (A.isArray(value)) {
    if (HashSet.has(seen, value)) {
      throw ToolRuntimeError.new("InvalidDataValue", `${label} contains a circular value.`);
    }
    const nextSeen = HashSet.add(seen, value);
    const copied = A.map(value, (item) =>
      copyBounded(item, label, depth + 1, nextSeen, preserveCodeModeValues)
    );
    if (preserveCodeModeValues) {
      // Guest arrays may carry enumerable named properties. Reflect mutation
      // remains isolated to this ECMAScript checkpoint adapter.
      for (const [key, item] of Struct.entries(value)) {
        if (P.hasProperty(copied, key)) continue;
        if (isBlockedMember(key)) {
          throw ToolRuntimeError.new("InvalidDataValue", `${label} contains blocked property '${key}'.`);
        }
        Reflect.set(copied, key, copyBounded(item, label, depth + 1, nextSeen, true));
      }
    }
    return copied;
  }
  if (!P.isObject(value)) {
    throw ToolRuntimeError.new("InvalidDataValue", `${label} must contain data only.`);
  }
  if (CodeModePromise.is(value)) {
    throw ToolRuntimeError.new(
      "InvalidDataValue",
      `${label} contains an un-awaited Promise; await tool calls before using their results.`
    );
  }

  if (preserveCodeModeValues) {
    if (isCodeModeValue(value)) return value;
    // crispen: native values are decoded immediately into guest semantic
    // adapters; invalid Date and mutable identity must remain observable.
    if (value instanceof Date) return CodeModeDate.new(value.getTime());
    if (value instanceof RegExp) return CodeModeRegExp.new(value.source, value.flags);
    if (value instanceof Map) {
      const wrapped = CodeModeMap.new();
      for (const [key, item] of value.entries()) {
        wrapped.map.set(
          copyBounded(key, label, depth + 1, seen, true),
          copyBounded(item, label, depth + 1, seen, true)
        );
      }
      return wrapped;
    }
    if (value instanceof Set) {
      const wrapped = CodeModeSet.new();
      for (const item of value.values()) wrapped.set.add(copyBounded(item, label, depth + 1, seen, true));
      return wrapped;
    }
    if (value instanceof URL) return CodeModeURL.new(new URL(value.href));
    if (value instanceof URLSearchParams) {
      return CodeModeURLSearchParams.new(new URLSearchParams(value));
    }
  }

  if (CodeModeDate.is(value)) return isoFromEpochMillis(value.time);
  if (value instanceof Date) return pipe(DateTime.make(value), O.match({
    onNone: thunkNull,
    onSome: DateTime.formatIso
  }));
  if (CodeModeURL.is(value)) return value.url.href;
  if (value instanceof URL) return value.href;
  if (
    isCodeModeValue(value) ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof URLSearchParams
  ) {
    return SafeObjectSchema.make(Struct.fromEntries(A.empty()));
  }

  if (HashSet.has(seen, value)) {
    throw ToolRuntimeError.new("InvalidDataValue", `${label} contains a circular value.`);
  }
  const nextSeen = HashSet.add(seen, value);

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && !P.isNull(prototype)) {
    throw ToolRuntimeError.new("InvalidDataValue", `${label} must contain plain objects only.`);
  }

  return SafeObjectSchema.make(
    pipe(
      Struct.entries(value),
      A.map(([key, item]) => {
        if (isBlockedMember(key)) {
          throw ToolRuntimeError.new("InvalidDataValue", `${label} contains blocked property '${key}'.`);
        }
        return [key, copyBounded(item, label, depth + 1, nextSeen, preserveCodeModeValues)] as const;
      }),
      Struct.fromEntries
    )
  );
};

/**
 * Copies a guest value out through JSON-compatible boundary semantics.
 *
 * **Gotchas**
 *
 * Arrays longer than 100000 items throw {@link ToolRuntimeError}. Index
 * construction densifies holes. Non-finite numbers always become `null`.
 * `json` drops undefined object keys and nullifies undefined array items;
 * `nullify` replaces bare undefined with `null`. {@link ToolReference} objects
 * pass through uncopied.
 *
 * **Example** (Nullify undefined and densify holes)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 *
 * console.log(ToolRuntime.copyOut(undefined, "nullify")) // null
 * console.log(ToolRuntime.copyOut(Number.NaN, "json")) // null
 *
 * const sparse: Array<number | undefined> = []
 * sparse[1] = 1
 * console.log(ToolRuntime.copyOut(sparse, "json")) // [null, 1]
 * ```
 *
 * @param mode - `json` drops undefined object keys; `nullify` replaces bare undefined with null.
 * @throws ToolRuntimeError when an array exceeds the 100000-item boundary limit.
 * @see {@link copyIn} for the host-to-guest copier.
 * @see {@link CopyOutMode} for the literal kit of copy-out modes.
 * @category serialization
 * @since 0.0.0
 */
export const copyOut: {
  (mode: CopyOutMode): (value: unknown) => unknown;
  (value: unknown, mode: CopyOutMode): unknown;
} = dual(2, (value: unknown, mode: CopyOutMode): unknown => {
  if (P.isUndefined(value) && CopyOutMode.is.nullify(mode)) return null;
  if (P.isNumber(value) && !Number.isFinite(value)) return null;
  if (A.isArray(value)) {
    if (A.length(value) > 100_000) {
      throw ToolRuntimeError.new("InvalidDataValue", "Execution result array exceeds the 100000-item boundary limit.");
    }
    // Index construction densifies holes, matching JSON-compatible boundary semantics.
    if (A.isArrayEmpty(value)) return A.empty();
    return A.map(A.makeBy(A.length(value), (index) => value[index]), (item) => {
      const copied = copyOut(item, mode);
      return P.isUndefined(copied) && CopyOutMode.is.json(mode) ? null : copied;
    });
  }
  if (P.isObject(value) && !P.isNull(value) && !ToolReference.is(value)) {
    return pipe(
      Struct.entries(value),
      A.map(([key, item]) => [key, copyOut(item, mode)] as const),
      A.filter(([, item]) => !(P.isUndefined(item) && CopyOutMode.is.json(mode))),
      Struct.fromEntries
    );
  }
  return value;
});

type ToolNode = {
  readonly tool: O.Option<Tool.Any>;
  readonly children: HashMap.HashMap<string, ToolNode>;
};

const emptyToolNode = (): ToolNode => ({
  tool: O.none(),
  children: HashMap.empty(),
});

const canonicalSegments = (path: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.flatMap(path, Str.split("."));

const insertTool = (node: ToolNode, segments: ReadonlyArray<string>, tool: Tool.Any): ToolNode => {
  const [head, ...tail] = segments;
  if (P.isUndefined(head)) return {...node, tool: O.some(tool)};
  if (Str.isEmpty(head)) {
    throw ToolRuntimeError.new("InvalidDataValue", `Tool name '${tool.name}' contains an empty segment.`);
  }
  const child = pipe(HashMap.get(node.children, head), O.getOrElse(emptyToolNode));
  return {
    ...node,
    children: HashMap.set(node.children, head, insertTool(child, tail, tool)),
  };
};

const toolTrie = (toolkit: Toolkit.Any): Result.Result<ToolNode, ToolRuntimeError> =>
  Result.try({
    try: () =>
      A.reduce(
        R.values(toolkit.tools),
        emptyToolNode(),
        (root, tool) => insertTool(root, Str.split(tool.name, "."), tool)
      ),
    catch: (cause) =>
      ToolRuntimeError.is(cause)
        ? cause
        : ToolRuntimeError.new("InvalidDataValue", "Toolkit names could not be indexed.")
  });

const lookup = (root: ToolNode, path: ReadonlyArray<string>): O.Option<ToolNode> =>
  A.reduce(canonicalSegments(path), O.some(root), (node, segment) =>
    pipe(node, O.flatMap((current) => HashMap.get(current.children, segment)))
  );

const resolve = (root: ToolNode, path: ReadonlyArray<string>): Result.Result<Tool.Any, ToolRuntimeError> => {
  const name = pipe(canonicalSegments(path), A.join("."));
  return pipe(
    lookup(root, path),
    O.flatMap((node) => node.tool),
    O.match({
      onNone: () =>
        Result.fail(
          ToolRuntimeError.new("UnknownTool", `Unknown or non-callable tool '${name}'.`, [
            "The tool may have been removed or renamed. Use search to find available tools.",
          ])
        ),
      onSome: Result.succeed,
    })
  );
};

const namespaceKeys = (
  root: ToolNode,
  path: ReadonlyArray<string>
): Result.Result<ReadonlyArray<string>, ToolRuntimeError> =>
  pipe(
    lookup(root, path),
    O.match({
      onNone: () =>
        Result.fail(
          ToolRuntimeError.new(
            "UnknownTool",
            `Unknown tool namespace '${pipe(canonicalSegments(path), A.join("."))}'.`
          )
        ),
      onSome: (node) => Result.succeed(A.fromIterable(HashMap.keys(node.children))),
    })
  );

const flattenTools = (
  node: ToolNode,
  path: ReadonlyArray<string> = A.empty()
): ReadonlyArray<{ readonly path: string; readonly tool: Tool.Any }> => [
  ...pipe(
    node.tool,
    O.map((tool) => [{path: A.join(path, "."), tool}]),
    O.getOrElse(A.empty)
  ),
  ...pipe(
    HashMap.entries(node.children),
    A.fromIterable,
    A.flatMap(([name, child]) => flattenTools(child, [...path, name]))
  ),
];

const compareText = (left: string, right: string): -1 | 0 | 1 => (left < right ? -1 : left > right ? 1 : 0);
const byPath = Order.make(
  (
    left: { readonly path: string },
    right: { readonly path: string }
  ): -1 | 0 | 1 => compareText(left.path, right.path)
);

/**
 * Renders a canonical Toolkit path as a guest expression.
 *
 * **Example** (Dot-access vs computed segment)
 *
 * ```ts
 * import { toolExpression } from "@beep/scratchpad/codemode"
 *
 * console.log(toolExpression("search.docs")) // "tools.search.docs"
 * console.log(toolExpression("foo-bar")) // "tools[\"foo-bar\"]"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const toolExpression = (path: string): string =>
  `tools${pipe(
    Str.split(path, "."),
    A.map((segment) =>
      identifierSegment(segment)
        ? `.${segment}`
        : `[${Unknown.encodeUnknownSyncFromJsonString(segment)}]`
    ),
    A.join("")
  )}`;

const describeTool = (path: string, tool: Tool.Any): ToolDescription =>
  ToolDescription.new(
    path,
    Tool.getDescription(tool) ?? "",
    `${toolExpression(path)}(input: ${inputTypeScript(tool, true)}): Promise<${outputTypeScript(tool, true)}>`
  );

const visibleTools = (root: ToolNode) =>
  pipe(
    flattenTools(root),
    A.sort(byPath),
    A.map(({path, tool}) => ({
      path,
      tool,
      description: describeTool(path, tool)
    }))
  );

const tokenize: (query: string) => ReadonlyArray<string> = flow(
  Str.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
  Str.toLowerCase,
  Str.split(/[^a-z0-9]+/),
  A.filter((term) => Str.isNonEmpty(term) && term !== "*")
);

const termForms = (term: string): ReadonlyArray<string> => [
  term,
  ...(Str.endsWith(term, "es") && Str.length(term) > 3 ? [pipe(term, Str.slice(0, -2))] : []),
  ...(Str.endsWith(term, "s") && Str.length(term) > 2 ? [pipe(term, Str.slice(0, -1))] : []),
];

const toSearchEntry = (
  path: string,
  tool: Tool.Any,
  description: ToolDescription
): SearchEntry =>
  SearchEntry.new(
    description,
    pipe(Str.split(path, "."), A.head, O.getOrElse(() => "")),
    pipe(
      [
        path,
        Tool.getDescription(tool) ?? "",
        ...A.flatMap(inputProperties(tool), ({name, description}) =>
          pipe(
            description,
            O.match({
              onNone: () => A.of(name),
              onSome: (property) => A.make(name, property),
            })
          )
        ),
      ],
      A.join("\n"),
      Str.toLowerCase
    )
  );

/**
 * Prepares the stable catalog and search index for a Toolkit.
 *
 * **Example** (Prepare the empty toolkit)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 * import { Result } from "effect"
 *
 * const plan = Result.getOrThrow(ToolRuntime.prepare(ToolRuntime.emptyToolkit))
 *
 * console.log(plan.catalog.length) // 0
 * console.log(plan.searchIndex.length) // 0
 * ```
 *
 * @see {@link searchIndex} for the helper that returns only the search index.
 * @see {@link emptyToolkit} for the default Toolkit used when no host tools are provided.
 * @category factories
 * @since 0.0.0
 */
export const prepare = (
  toolkit: Toolkit.Any
): Result.Result<DiscoveryPlan, ToolRuntimeError> =>
  pipe(
    toolTrie(toolkit),
    Result.map((root) => {
      const visible = visibleTools(root);
      return DiscoveryPlan.new(
        A.map(visible, ({description}) => description),
        A.map(visible, ({
                          path,
                          tool,
                          description
                        }) => toSearchEntry(path, tool, description))
      );
    })
  );

/**
 * Builds only the search index for a Toolkit.
 *
 * **Details**
 *
 * This is {@link prepare} then `.searchIndex`. Prefer {@link prepare} when the
 * catalog is needed as well.
 *
 * **Example** (Index the empty toolkit)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 * import { Result } from "effect"
 *
 * const index = Result.getOrThrow(ToolRuntime.searchIndex(ToolRuntime.emptyToolkit))
 *
 * console.log(index.length) // 0
 * ```
 *
 * @see {@link prepare} for the full catalog-and-index constructor.
 * @category factories
 * @since 0.0.0
 */
export const searchIndex = (
  toolkit: Toolkit.Any
): Result.Result<ReadonlyArray<SearchEntry>, ToolRuntimeError> =>
  pipe(prepare(toolkit), Result.map((plan) => plan.searchIndex));

const search = (
  index: ReadonlyArray<SearchEntry>,
  input: SearchInput
): SearchOutput => {
  const scoped = pipe(
    input.namespace,
    O.match({
      onNone: () => index,
      onSome: (namespace) => A.filter(index, (entry) => entry.namespace === namespace),
    })
  );
  const query = O.getOrElse(input.query, () => "");
  const trimmed = Str.trim(query);
  const pathQuery = Str.startsWith(trimmed, "tools.")
    ? pipe(trimmed, Str.slice(Str.length("tools.")))
    : trimmed;
  const exact = Str.isEmpty(pathQuery)
    ? O.none<SearchEntry>()
    : A.findFirst(
      scoped,
      (entry) =>
        entry.description.path === pathQuery ||
        toolExpression(entry.description.path) === trimmed
    );
  const terms = A.map(tokenize(query), termForms);
  const ranked = pipe(
    exact,
    O.match({
      onSome: (entry) => [entry],
      onNone: () =>
        pipe(
          scoped,
          A.map((entry) => {
            const path = Str.toLowerCase(entry.description.path);
            const description = Str.toLowerCase(entry.description.description);
            const score = A.reduce(terms, 0, (total, forms) =>
              total +
              (A.some(forms, (form) => path === form || Str.endsWith(path, `.${form}`)) ? 20 : 0) +
              (A.some(forms, (form) => pipe(path, Str.includes(form))) ? 8 : 0) +
              (A.some(forms, (form) => pipe(description, Str.includes(form))) ? 4 : 0) +
              (A.some(forms, (form) => pipe(entry.searchText, Str.includes(form))) ? 2 : 0)
            );
            return {entry, score};
          }),
          A.filter(({score}) => A.isReadonlyArrayEmpty(terms) || score > 0),
          A.sort(
            Order.make<{ readonly entry: SearchEntry; readonly score: number }>(
              (left, right): -1 | 0 | 1 =>
                left.score === right.score
                  ? compareText(left.entry.description.path, right.entry.description.path)
                  : left.score > right.score
                    ? -1
                    : 1
            )
          ),
          A.map(({entry}) => entry)
        ),
    })
  );
  const page = A.take(A.drop(ranked, input.offset), input.limit);
  const items = A.map(page, ({description}) =>
    SearchItem.new(toolExpression(description.path), description.description, description.signature)
  );
  const remaining = Math.max(0, A.length(ranked) - input.offset - A.length(items));
  return SearchOutput.new(
    items,
    remaining,
    remaining > 0 ? input.offset + A.length(items) : undefined
  );
};

/**
 * Exact callable signature of the built-in discovery function.
 *
 * **Example** (Inspect the printed search signature)
 *
 * ```ts
 * import { searchSignature } from "@beep/scratchpad/codemode"
 *
 * console.log(searchSignature.startsWith("search(")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const searchSignature =
  "search(input: { query?: string; namespace?: string; limit?: number; offset?: number }): { items: Array<{ path: string; description: string; signature: string }>; remaining: number; next: { offset: number } | null }";

type AnyWithHandler = Toolkit.WithHandler<any>;

const handleDynamic = <R>(
  handlers: AnyWithHandler,
  name: string,
  input: unknown
): Effect.Effect<
  Stream.Stream<Tool.HandlerResult<Tool.Any>, unknown, R>,
  AiError.AiError
> =>
  // The name/tool pairing is proven by the trie immediately before this call.
  handlers.handle(name as never, input as never) as unknown as Effect.Effect<
    Stream.Stream<Tool.HandlerResult<Tool.Any>, unknown, R>,
    AiError.AiError
  >;

const normalizeAiError = (name: string, error: AiError.AiError): ToolRuntimeError => {
  const invalidInput = error.reason._tag === "ToolParameterValidationError";
  const kind = invalidInput ? "InvalidToolInput" : "InvalidToolOutput";
  return ToolRuntimeError.new(
    kind,
    `${invalidInput ? "Invalid input for" : "Invalid output from"} tool '${name}': ${error.reason.message}`,
    invalidInput
      ? ["The signature may have changed. Use search to get the current signature."]
      : A.empty()
  );
};

/**
 * Runtime state and operations owned by one execution.
 *
 * **Gotchas**
 *
 * `keys` throws {@link ToolRuntimeError} synchronously via `Result.getOrElse`
 * even though its type is `ReadonlyArray<string>`. `execute` and `search`
 * require exactly one input object. Tool `failureMode "return"` yields
 * `encodedResult` to the guest; `"error"` hits the Stream error path as
 * {@link ToolError}.
 *
 * @see {@link make} for the constructor that returns this runtime.
 * @category type-level
 * @since 0.0.0
 */
export type ToolRuntime<R = never> = {
  readonly root: ToolReference;
  readonly calls: Effect.Effect<ReadonlyArray<ToolCall>>;
  readonly execute: (
    path: ReadonlyArray<string>,
    args: ReadonlyArray<unknown>
  ) => Effect.Effect<unknown, ToolRuntimeError | ToolError, R>;
  readonly search: (
    args: ReadonlyArray<unknown>
  ) => Effect.Effect<unknown, ToolRuntimeError | ToolError, R>;
  readonly keys: (path: ReadonlyArray<string>) => ReadonlyArray<string>;
};

/**
 * Creates execution-local state around a Toolkit with installed handlers.
 *
 * **Gotchas**
 *
 * This constructor is not the public `CodeMode.make` runtime factory. The
 * returned `keys` method throws {@link ToolRuntimeError} for unknown
 * namespaces. `execute` and `search` require exactly one input object.
 * `failureMode "return"` yields encoded failures to the guest; `"error"`
 * surfaces {@link ToolError} on the Stream error path.
 *
 * **Example** (List keys of the empty toolkit)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 * import { Effect, Result } from "effect"
 * import * as O from "effect/Option"
 *
 * Effect.runPromise(
 *   Effect.gen(function* () {
 *     const handlers = yield* ToolRuntime.emptyToolkit
 *     const index = Result.getOrThrow(ToolRuntime.searchIndex(ToolRuntime.emptyToolkit))
 *     const runtime = yield* ToolRuntime.make(
 *       ToolRuntime.emptyToolkit,
 *       handlers,
 *       O.none(),
 *       index
 *     )
 *     return runtime.keys([])
 *   })
 * ).then((keys) => {
 *   console.log(keys) // []
 * })
 * ```
 *
 * @throws ToolRuntimeError from the returned `keys` method when the namespace is unknown.
 * @see {@link prepare} for catalog construction used before this runtime is created.
 * @see {@link searchIndex} for the search-index-only helper used by this constructor.
 * @see {@link emptyToolkit} for the default Toolkit when CodeMode omits host tools.
 * @category factories
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Toolkit, handlers, limits, index, and hooks are co-primary factory inputs rather than a data-first transformation.
export const make = <R>(
  toolkit: Toolkit.Any,
  handlers: AnyWithHandler,
  maxToolCalls: O.Option<NonNegativeInt>,
  index: ReadonlyArray<SearchEntry>,
  hooks: ToolCallHooks<R> = {}
): Effect.Effect<ToolRuntime<R>, ToolRuntimeError> =>
  Effect.gen(function* () {
    const root = yield* Effect.fromResult(toolTrie(toolkit));
    const calls = yield* Ref.make<ReadonlyArray<ToolCall>>(A.empty());

    const admitCall = (
      name: string,
      input: unknown
    ): Effect.Effect<ToolCallStarted, ToolRuntimeError> =>
      Ref.modify(
        calls,
        (
          current
        ): readonly [
          Result.Result<ToolCallStarted, ToolRuntimeError>,
          ReadonlyArray<ToolCall>,
        ] =>
          pipe(
            maxToolCalls,
            O.filter((limit) => A.length(current) >= limit),
            O.match({
              onSome: (limit) => [
                Result.fail(
                  ToolRuntimeError.new(
                    "ToolCallLimitExceeded",
                    `Execution exceeded its tool-call limit of ${limit}.`
                  )
                ),
                current,
              ] as const,
              onNone: () => {
                const call = ToolCall.new(name);
                return [
                  Result.succeed(ToolCallStarted.new(A.length(current), call, input)),
                  [...current, call],
                ] as const;
              },
            })
          )
      ).pipe(Effect.flatMap((admission) => Effect.fromResult(admission)));

    const observeEnd = <Value, Failure>(
      effect: Effect.Effect<Value, Failure, R>,
      call: ToolCallStarted
    ): Effect.Effect<Value, Failure, R> =>
      Effect.gen(function* () {
        const startedAt = yield* Clock.currentTimeMillis;
        return yield* effect.pipe(
          Effect.onExit((exit) =>
            Effect.gen(function* () {
              if (P.isUndefined(hooks.onToolCallEnd)) return;
              const durationMs = Math.max(0, (yield* Clock.currentTimeMillis) - startedAt);
              if (Exit.isSuccess(exit)) {
                return yield* hooks.onToolCallEnd(ToolCallSucceeded.new(call, durationMs));
              }
              if (Cause.hasInterruptsOnly(exit.cause)) {
                return yield* hooks.onToolCallEnd(ToolCallInterrupted.new(call, durationMs));
              }
              const error = Cause.squash(exit.cause);
              const message =
                ToolRuntimeError.is(error) || ToolError.is(error)
                  ? error.message
                  : "Tool execution failed";
              return yield* hooks.onToolCallEnd(ToolCallFailed.new(call, durationMs, message));
            })
          )
        );
      });

    const executeTool = (
      name: string,
      input: unknown
    ): Effect.Effect<unknown, ToolRuntimeError | ToolError, R> =>
      Effect.gen(function* () {
        const started = yield* admitCall(name, input);
        return yield* observeEnd(
          Effect.gen(function* () {
            if (P.isNotUndefined(hooks.onToolCallStart)) yield* hooks.onToolCallStart(started);
            const stream = yield* handleDynamic<R>(handlers, name, input).pipe(
              Effect.mapError((error) => normalizeAiError(name, error))
            );
            const last = yield* stream.pipe(
              Stream.mapError((cause) =>
                ToolError.new(`Tool '${name}' failed.`, cause)
              ),
              Stream.runLast,
            );
            const result = yield* O.match(last, {
              onNone: () =>
                Effect.fail(
                  ToolRuntimeError.new("InvalidToolOutput", `Tool '${name}' produced no final result.`)
                ),
              // failureMode "return" intentionally returns encoded failures
              // to the guest; failureMode "error" reaches the Stream error path.
              onSome: (output) => Effect.succeed(output.encodedResult),
            });
            return yield* Effect.try({
              try: () => copyIn(result, `Result from tool '${name}'`),
              catch: () =>
                ToolRuntimeError.new("InvalidToolOutput", `Invalid output from tool '${name}'.`),
            });
          }),
          started
        );
      });

    const executeSearch = (
      args: ReadonlyArray<unknown>
    ): Effect.Effect<unknown, ToolRuntimeError | ToolError, R> =>
      Effect.gen(function* () {
        if (A.length(args) !== 1) {
          return yield* ToolRuntimeError.new(
            "InvalidToolInput",
            "Tool 'search' expects exactly one input object."
          );
        }
        const external = yield* Effect.try({
          try: () => copyOut(copyIn(args[0], "Arguments for tool 'search'"), "json"),
          catch: (error) =>
            ToolRuntimeError.is(error)
              ? error
              : ToolRuntimeError.new(
                  "InvalidToolInput",
                  "Arguments for tool 'search' could not be copied."
                ),
        });
        const input = yield* S.decodeUnknownEffect(SearchInput)(external).pipe(
          Effect.mapError((cause) =>
            ToolRuntimeError.new("InvalidToolInput", `Invalid input for tool 'search': ${cause.message}`)
          )
        );
        const started = yield* admitCall("search", input);
        return yield* observeEnd(
          Effect.gen(function* () {
            if (P.isNotUndefined(hooks.onToolCallStart)) yield* hooks.onToolCallStart(started);
            return yield* S.encodeUnknownEffect(SearchOutput)(search(index, input)).pipe(
              Effect.mapError((cause) =>
                ToolRuntimeError.new("InvalidToolOutput", `Invalid output from tool 'search': ${cause.message}`)
              )
            );
          }),
          started
        );
      });

    return {
      root: ToolReference.new(A.empty()),
      calls: Ref.get(calls),
      keys: (path) =>
        pipe(
          namespaceKeys(root, path),
          Result.getOrElse((error) => {
            throw error;
          })
        ),
      search: executeSearch,
      execute:
        Effect.fnUntraced(function* (path, args) {
          const name = pipe(canonicalSegments(path), A.join("."));
          if (A.length(args) !== 1) {
            return yield* ToolRuntimeError.new(
              "InvalidToolInput",
              `Tool '${name}' expects exactly one input object.`
            );
          }
          const input = yield* Effect.try({
            try: () => copyOut(copyIn(args[0], `Arguments for tool '${name}'`), "json"),
            catch: (error) =>
              ToolRuntimeError.is(error)
                ? error
                : ToolRuntimeError.new(
                    "InvalidToolInput",
                    `Arguments for tool '${name}' could not be copied.`
                  ),
          });
          yield* Effect.fromResult(resolve(root, path));
          return yield* executeTool(name, input);
        }),
    };
  });

/**
 * Empty default Toolkit used when no host tools are provided.
 *
 * **Example** (Inspect the empty toolkit)
 *
 * ```ts
 * import { ToolRuntime } from "@beep/scratchpad/codemode"
 *
 * console.log(Object.keys(ToolRuntime.emptyToolkit.tools)) // []
 * ```
 *
 * @see {@link make} for the execution-local adapter built around this toolkit.
 * @category constants
 * @since 0.0.0
 */
export const emptyToolkit = Toolkit.empty;
