import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { parseCSTAll } from "../cst-parser.ts";
import { RawDiagnostic } from "../diagnostics.ts";
import { RawDirective } from "../raw-document.ts";
import type { CstNode } from "../cst.ts";
import type { ComposerState, NodeMeta } from "./state.ts";

/**
 * The non-empty prefix a `%TAG` directive maps `handle` to.
 *
 * **Example** (Look up a declared handle)
 *
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as O from "effect/Option"
 * import { tagPrefixFor } from "@beep/yaml/internal/composer/tags"
 *
 * const tagMap = MutableHashMap.make(["!e!", "tag:example.com,2000:"], ["!x!", ""])
 * console.log(O.getOrNull(tagPrefixFor(tagMap, "!e!")), O.isNone(tagPrefixFor(tagMap, "!x!"))) // tag:example.com,2000: true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tagPrefixFor = (
  tagMap: MutableHashMap.MutableHashMap<string, string>,
  ...[handle]: [handle: string]
): O.Option<string> => O.filter(MutableHashMap.get(tagMap, handle), (prefix) => prefix !== "");

/**
 * Split a named-handle tag (`!name!suffix`) into its handle and suffix.
 *
 * **Example** (Split a named handle)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { splitNamedHandle } from "@beep/yaml/internal/composer/tags"
 *
 * console.log(O.getOrNull(splitNamedHandle("!e!widget"))) // ["!e!", "widget"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const splitNamedHandle = (tag: string): O.Option<readonly [handle: string, suffix: string]> => {
  const namedMatch = O.getOrNull(Str.match(/^(![\w-]*!)(.*)$/)(tag));
  return namedMatch === null ? O.none() : O.some([A.getUnsafe(namedMatch, 1), A.getUnsafe(namedMatch, 2)] as const);
};

/**
 * True for a primary-handle tag: `!suffix` with a non-empty suffix (not `!!`).
 *
 * **Example** (Classify primary-handle tags)
 *
 * ```ts
 * import { isPrimaryHandleTag } from "@beep/yaml/internal/composer/tags"
 *
 * console.log(isPrimaryHandleTag("!local"), isPrimaryHandleTag("!!str"), isPrimaryHandleTag("!")) // true false false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPrimaryHandleTag = (tag: string): boolean =>
  Str.startsWith("!")(tag) && tag.length > 1 && !Str.startsWith("!!")(tag);

/**
 * Resolves a tag shorthand using the document's `%TAG` directives.
 *
 * **Details**
 *
 * For example, with `%TAG !! tag:example.com,2000:app/`, the tag `!!int`
 * resolves to `tag:example.com,2000:app/int`.
 *
 * Returns the resolved tag URI, or the original tag if no directive matches.
 *
 * **Example** (Resolve a custom secondary tag)
 *
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import { resolveTagHandle } from "@beep/yaml/internal/composer/tags"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 *
 * const state = createState("", { composeFlowMap, composeFlowSeq })
 * MutableHashMap.set(state.tagMap, "!!", "tag:example.com,2000:app/")
 * console.log(resolveTagHandle("!!int", state)) // tag:example.com,2000:app/int
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function resolveTagHandle(
  ...[tag, state, span]: [tag: string, state: ComposerState, span?: NodeMeta["tagSpan"]]
): string {
  const isVerbatimTag = Str.startsWith("!<")(tag) && Str.endsWith(">")(tag);
  if (isVerbatimTag) {
    return Str.slice(2, -1)(tag);
  }
  if (Str.startsWith("!!")(tag)) {
    const prefix = tagPrefixFor(state.tagMap, "!!");
    return O.getOrElse(prefix, () => defaultSecondaryPrefix) + decodeTagSuffix(Str.slice(2)(tag), tag, state, span);
  }
  const named = splitNamedHandle(tag);
  if (O.isSome(named)) {
    const [handle, suffix] = named.value;
    const prefix = tagPrefixFor(state.tagMap, handle);
    if (O.isSome(prefix)) return prefix.value + decodeTagSuffix(suffix, tag, state, span);
  }
  if (isPrimaryHandleTag(tag)) {
    const primaryPrefix = tagPrefixFor(state.tagMap, "!");
    return O.getOrElse(primaryPrefix, () => localTagPrefix) + decodeTagSuffix(Str.slice(1)(tag), tag, state, span);
  }
  return tag;
}

const tagNodesInDocumentOrder = (text: string): CstNode[] => {
  const tags: CstNode[] = [];
  const stack = A.reverse(parseCSTAll(text));
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.type === "tag") tags.push(node);
    for (const child of A.reverse(node.children ?? [])) stack.push(child);
  }
  return tags;
};

const defaultSecondaryPrefix = "tag:yaml.org,2002:";
const localTagPrefix = "!";

const isUnflaggedTagOccurrence = (node: CstNode, tag: string, state: ComposerState): boolean =>
  node.source === tag &&
  !A.some(state.errors, (error) => error.code === "UnresolvedTag" && error.offset === node.offset);

const standaloneTagSpan: {
  (tag: string, state: ComposerState): NodeMeta["tagSpan"];
  (state: ComposerState): (tag: string) => NodeMeta["tagSpan"];
} = dual(2, (tag: string, state: ComposerState): NodeMeta["tagSpan"] => {
  if (state.tagCstCache === undefined) state.tagCstCache = tagNodesInDocumentOrder(state.text);
  return O.getOrUndefined(A.findFirst(state.tagCstCache, (node) => isUnflaggedTagOccurrence(node, tag, state)));
});

const decodeTagSuffix: {
  (tag: string, state: ComposerState, span?: NodeMeta["tagSpan"]): (suffix: string) => string;
  (suffix: string, tag: string, state: ComposerState, span?: NodeMeta["tagSpan"]): string;
} = dual(
  (args) => P.isString(args[1]),
  (suffix: string, tag: string, state: ComposerState, span?: NodeMeta["tagSpan"]): string =>
    Result.getOrElse(
      Result.try(() => decodeURIComponent(suffix)),
      () => {
        const provenance = span ?? standaloneTagSpan(tag, state);
        if (
          provenance !== undefined &&
          !A.some(
            state.errors,
            (e) =>
              e.code === "UnresolvedTag" &&
              e.offset === provenance.offset &&
              e.length === provenance.length &&
              e.message === `Malformed percent encoding in tag ${tag}`
          )
        ) {
          state.errors.push(
            RawDiagnostic.make({
              code: "UnresolvedTag",
              message: `Malformed percent encoding in tag ${tag}`,
              offset: provenance.offset,
              length: provenance.length,
            })
          );
        }
        return suffix;
      }
    )
);

/**
 * Extracts a directive name and parameters from source text beginning with `%`.
 *
 * **Details**
 *
 * Leading and trailing whitespace is trimmed, and parameters stop at a trailing
 * comment. Source without a directive marker or name returns `None`.
 *
 * **Example** (Read directive parameters before a comment)
 *
 * ```ts
 * import { parseDirective } from "@beep/yaml/internal/composer/tags"
 * import * as O from "effect/Option"
 *
 * const directive = O.getOrUndefined(parseDirective("%YAML 1.2 # version"))
 * console.log(directive?.name) // YAML
 * console.log(directive?.parameters.join(",")) // 1.2
 * console.log(O.isNone(parseDirective("plain scalar"))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function parseDirective(source: string): O.Option<RawDirective> {
  const trimmed = Str.trim(source);
  if (!Str.startsWith("%")(trimmed)) return O.none();
  const parts = Str.split(/\s+/)(Str.slice(1)(trimmed));
  const name = parts[0];
  if (!(name !== undefined && name !== "")) return O.none();
  const parametersBeforeComment: string[] = [];
  for (const p of parts.slice(1)) {
    if (Str.startsWith("#")(p)) break;
    parametersBeforeComment.push(p);
  }
  return RawDirective.makeOption({ name, parameters: parametersBeforeComment });
}

const declaredTagHandle = (child: CstNode): O.Option<string> =>
  child.type !== "directive"
    ? O.none()
    : O.flatMap(parseDirective(child.source), (directive) =>
        directive.name === "TAG" && directive.parameters.length >= 2
          ? O.some(A.getUnsafe(directive.parameters, 0))
          : O.none()
      );

const collectLocalHandles = (children: ReadonlyArray<CstNode>): MutableHashSet.MutableHashSet<string> => {
  const localHandles = MutableHashSet.empty<string>();
  for (const child of children) {
    const handle = declaredTagHandle(child);
    if (O.isSome(handle)) MutableHashSet.add(localHandles, handle.value);
  }
  return localHandles;
};

const namedTagPattern = /^(![\w-]*!)(.*)$/;
const namedHandlePattern = /^(![\w-]*!)/;

const percentEncodedSuffixOf = (src: string): string => {
  if (Str.startsWith("!!")(src)) return Str.slice(2)(src);
  const named = O.getOrNull(Str.match(namedTagPattern)(src));
  return named !== null ? A.getUnsafe(named, 2) : Str.slice(1)(src);
};

const isAlwaysDeclaredTag = (src: string): boolean =>
  Str.startsWith("!<")(src) || Str.startsWith("!!")(src) || src === "!";

const reportUndeclaredHandle = (
  node: CstNode,
  state: ComposerState,
  localHandles: MutableHashSet.MutableHashSet<string>
): void => {
  if (isAlwaysDeclaredTag(node.source)) return;
  const handle = O.getOrNull(Str.match(namedHandlePattern)(node.source))?.[1];
  if (handle === undefined || handle === "" || MutableHashSet.has(localHandles, handle)) return;
  state.errors.push(
    RawDiagnostic.make({
      code: "UnresolvedTag",
      message: `Tag handle ${handle} is not declared in this document`,
      offset: node.offset,
      length: node.length,
    })
  );
};

const isOutsideValidationScope = (
  node: CstNode,
  state: ComposerState,
  mode: "all" | "handles" | "percent" | "properties"
): boolean => (mode === "percent" || mode === "properties") && !MutableHashSet.has(state.tagOffsets, node.offset);

const validateTagNode = (
  node: CstNode,
  state: ComposerState,
  mode: "all" | "handles" | "percent" | "properties",
  localHandles: MutableHashSet.MutableHashSet<string>
): void => {
  if (isOutsideValidationScope(node, state, mode)) return;
  const src = node.source;
  if (mode !== "handles" && !Str.startsWith("!<")(src)) decodeTagSuffix(percentEncodedSuffixOf(src), src, state, node);
  if (mode !== "percent") reportUndeclaredHandle(node, state, localHandles);
};

/**
 * Validates that each `!handle!suffix` tag reference in this document is
 * declared by a `%TAG` directive in the same document (QLJ7).
 *
 * **Details**
 *
 * `%TAG` directives are local to a single document and do not leak across `---`
 * boundaries. The `!!` shorthand and the primary `!` handle are always available.
 * Undeclared handles and malformed percent encoding append diagnostics to `state.errors`.
 *
 * **Example** (Report an undeclared document tag)
 *
 * ```ts
 * import { validateTagHandlesInDocument } from "@beep/yaml/internal/composer/tags"
 * import { createState } from "@beep/yaml/internal/composer/state"
 * import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow"
 * import { parseCSTAll } from "@beep/yaml/internal/cst-parser"
 *
 * const text = "!app!value hello"
 * const state = createState(text, { composeFlowMap, composeFlowSeq })
 * for (const document of parseCSTAll(text)) {
 *   validateTagHandlesInDocument(document, state)
 * }
 * console.log(state.errors[0]?.code) // UnresolvedTag
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function validateTagHandlesInDocument(
  ...[docCst, state, mode = "all"]: [
    docCst: CstNode,
    state: ComposerState,
    mode?: "all" | "handles" | "percent" | "properties",
  ]
): void {
  const localHandles = collectLocalHandles(docCst.children ?? []);
  const stack: CstNode[] = [docCst];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.type === "tag") validateTagNode(node, state, mode, localHandles);
    for (const c of node.children ?? []) stack.push(c);
  }
}
