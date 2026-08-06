/**
 * Effect AI Toolkit adapter and plain-data boundary for CodeMode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import {
  LiteralKit,
  NonEmptyTrimmedStr,
  NonNegativeInt,
  PosInt,
  SafeObject as SafeObjectSchema,
  SchemaUtils,
  TaggedErrorClass,
} from "@beep/schema";
import {A, O, P, pipe, R, Str, Struct, thunkNull} from "@beep/utils";
import {
  Cause,
  Clock,
  DateTime,
  Effect,
  Exit,
  HashMap,
  HashSet,
  Order,
  Ref,
  Result,
  Stream,
} from "effect";
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

/** Services required to obtain Toolkit handlers and run their streams. */
export type Services<ToolkitType extends Toolkit.Any> =
  | (ToolkitType extends Effect.Effect<unknown, never, infer Requirements> ? Requirements : never)
  | Tool.HandlerServices<Toolkit.Tools<ToolkitType>[keyof Toolkit.Tools<ToolkitType>]>;

/** Canonical catalog entry exposed to the CodeMode host. */
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

/** A tool call admitted during one execution. */
export class ToolCall extends S.Class<ToolCall>($I`ToolCall`)(
  {name: NonEmptyTrimmedStr},
  $I.annote("ToolCall", {
    description: "Canonical name of one admitted tool call.",
  })
) {
  static readonly new = (name: string): ToolCall =>
    ToolCall.make({name: NonEmptyTrimmedStr.make(name)});
}

/** Hook payload emitted immediately before handler execution. */
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

/** Successful terminal observation for one admitted tool call. */
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

/** Interrupted terminal observation for one admitted tool call. */
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

/** Failed terminal observation for one admitted tool call. */
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

/** Exhaustive terminal observation for one admitted tool call. */
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

/** Runtime type for {@link ToolCallEnded}. */
export type ToolCallEnded = typeof ToolCallEnded.Type;

/** Optional observers for tool execution. */
export type ToolCallHooks<R = never> = {
  readonly onToolCallStart?: (call: ToolCallStarted) => Effect.Effect<void, never, R>;
  readonly onToolCallEnd?: (call: ToolCallEnded) => Effect.Effect<void, never, R>;
};

/** Built-in discovery request. */
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

/** One discovery response item. */
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

/** Built-in discovery response. */
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

/** Indexed representation of one catalog entry. */
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

/** Prepared immutable discovery data. */
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

/** Boundary copy behavior. */
export const CopyOutMode = LiteralKit(["json", "nullify"]).pipe(
  $I.annoteSchema("CopyOutMode", {
    description: "Whether a bare undefined is preserved or normalized to null.",
  })
);

/** Runtime type for {@link CopyOutMode}. */
export type CopyOutMode = typeof CopyOutMode.Type;

/** Runtime handle representing a namespace path below `tools`. */
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

/** Stable ToolRuntime failure categories. */
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

/** Runtime type for {@link ToolRuntimeErrorKind}. */
export type ToolRuntimeErrorKind = typeof ToolRuntimeErrorKind.Type;

/** Typed Toolkit adapter failure. */
export class ToolRuntimeError extends TaggedErrorClass<ToolRuntimeError>($I`ToolRuntimeError`)(
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

/** Returns whether a property name is blocked at the guest object boundary. */
export const isBlockedMember = (name: string): boolean => HashSet.has(blockedMemberNames, name);

const isoFromEpochMillis = (millis: number): string | null =>
  O.match(DateTime.make(millis), {
    onNone: thunkNull,
    onSome: DateTime.formatIso,
  });

/**
 * Copies host data into a bounded guest representation.
 *
 * Checkpoint mode preserves guest objects; boundary mode JSON-normalizes them.
 */
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
        if (Object.hasOwn(copied, key)) continue;
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

/** Copies a guest value out through JSON-compatible boundary semantics. */
export const copyOut = (value: unknown, mode: CopyOutMode): unknown => {
  if (P.isUndefined(value) && CopyOutMode.is.nullify(mode)) return null;
  if (P.isNumber(value) && !Number.isFinite(value)) return null;
  if (A.isArray(value)) {
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
};

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

/** Renders a canonical Toolkit path as a guest expression. */
export const toolExpression = (path: string): string =>
  `tools${pipe(
    Str.split(path, "."),
    A.map((segment) =>
      identifierSegment(segment)
        ? `.${segment}`
        : `[${S.encodeUnknownSync(S.fromJsonString(S.Unknown))(segment)}]`
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

const tokenize = (query: string): ReadonlyArray<string> =>
  pipe(
    query,
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

/** Prepares the stable catalog and search index for a Toolkit. */
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

/** Builds only the search index for a Toolkit. */
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

/** Exact callable signature of the built-in discovery function. */
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

/** Runtime state and operations owned by one execution. */
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

/** Creates execution-local state around a Toolkit with installed handlers. */
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

/** Empty default Toolkit used when no host tools are provided. */
export const emptyToolkit = Toolkit.empty;
