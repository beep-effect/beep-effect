/**
 * Canonical serialization for the schema-first HTML AST.
 *
 * The serializer escapes text and attributes, expands the modeled `dataset`
 * bag, emits HTML void elements without XML syntax, and rejects local
 * serialization hazards. It does not enforce the general HTML content model
 * or promise that every raw AST reparses identically; use {@link conform} and
 * {@link serializeConformant} when structural conformance is required. Safe
 * output is issued only from a {@link SafeHtmlAst} proof.
 *
 * @packageDocumentation \@beep/html/Html.serialize
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Struct } from "@beep/utils";
import { Effect, flow, Match, Order, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ForeignAttributeName } from "./Html.attributes.ts";
import { conform, conformantRoot } from "./Html.conformance.ts";
import {
  isForeignAttributeNameFixedPoint,
  isForeignChildAtForeignBoundary,
  isForeignElementNameFixedPoint,
  isHtmlChildAtForeignBoundary,
} from "./Html.foreign.ts";
import { ELEMENT_META, HtmlBooleanAttributeName, HtmlTag } from "./Html.meta.ts";
import { HtmlRoot } from "./Html.model.ts";
import { enforceSafeHtml, SafeHtmlAst, safeHtmlAstRoot } from "./Html.policy.ts";
import type { ForeignElementName } from "./Html.attributes.ts";
import type { ConformantHtml } from "./Html.conformance.ts";

const $I = $HtmlId.create("Html.serialize");
const isHtmlTag = S.is(HtmlTag);
const isBooleanAttributeName = S.is(HtmlBooleanAttributeName);
const isForeignAttributeName = S.is(ForeignAttributeName);
const isSafeHtmlAst = S.is(SafeHtmlAst);
const invalidScalarPattern = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const byEntryName = Order.mapInput(Str.Order, ([name]: readonly [string, unknown]) => name);

/**
 * Serialized HTML that has not passed the safe-output policy.
 *
 * The brand distinguishes well-formed serialization from a browser-safe value;
 * it is not a trust marker.
 *
 * @example
 * ```ts
 * import { UntrustedHtml } from "@beep/html/Html.serialize"
 *
 * console.log(UntrustedHtml.make("<p>hello</p>"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UntrustedHtml = S.String.pipe(
  S.brand("UntrustedHtml"),
  $I.annoteSchema("UntrustedHtml", {
    description: "Canonical HTML serialization without a safe-output proof.",
  })
);

/**
 * Decoded type of {@link UntrustedHtml}.
 *
 * @example
 * ```ts
 * import { UntrustedHtml } from "@beep/html/Html.serialize"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(UntrustedHtml)("<p>hello</p>")
 * if (Result.isSuccess(decoded)) {
 *   const html: UntrustedHtml = decoded.success
 *   console.log(html)
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UntrustedHtml = typeof UntrustedHtml.Type;

const safeHtmlIssuer = new WeakSet<SafeHtmlValue>();
const safeHtmlStrings = new WeakMap<SafeHtmlValue, string>();

declare const safeHtmlProof: unique symbol;

declare class SafeHtmlValue {
  private readonly [safeHtmlProof]: true;
}

const isSafeHtmlValue = (value: unknown): value is SafeHtmlValue =>
  P.isObject(value) && safeHtmlIssuer.has(value as unknown as SafeHtmlValue);

const issueSafeHtml = (html: string): SafeHtmlValue => {
  const value = Object.create(null) as SafeHtmlValue;
  safeHtmlStrings.set(value, html);
  safeHtmlIssuer.add(value);
  Object.freeze(value);
  return value;
};

/**
 * Opaque, runtime-issued HTML string accepted by the safe-output policy.
 *
 * Unlike a structural brand, callers cannot manufacture this value from an
 * arbitrary string through a public constructor or schema decode.
 *
 * @example
 * ```ts
 * import { safeHtmlValue } from "@beep/html/Html.serialize"
 *
 * const unwrap = (value: Parameters<typeof safeHtmlValue>[0]) => safeHtmlValue(value)
 * console.log(typeof unwrap) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SafeHtml = S.declare(isSafeHtmlValue).pipe(
  $I.annoteSchema("SafeHtml", {
    description: "Opaque HTML string issued only after conformance and safe-policy validation.",
  })
);

/**
 * Decoded type of {@link SafeHtml}.
 *
 * @example
 * ```ts
 * import {
 *   conform,
 *   enforceSafeHtml,
 *   Fragment,
 *   safeHtmlValue,
 *   serializeSafe
 * } from "@beep/html"
 * import type { SafeHtml } from "@beep/html/Html.serialize"
 * import { Effect } from "effect"
 *
 * const html: SafeHtml = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(
 *     Effect.flatMap(enforceSafeHtml),
 *     Effect.flatMap(serializeSafe)
 *   )
 * )
 * console.log(safeHtmlValue(html)) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeHtml = typeof SafeHtml.Type;

/**
 * Rules reported when canonical serialization cannot preserve an AST.
 *
 * @example
 * ```ts
 * import { HtmlSerializeRule } from "@beep/html/Html.serialize"
 *
 * console.log(HtmlSerializeRule.is.rawTextEndTag("rawTextEndTag")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlSerializeRule = LiteralKit([
  "encodingFailure",
  "invalidProof",
  "invalidNode",
  "invalidAttribute",
  "nonCanonicalDoctype",
  "rawTextEndTag",
  "plaintextElement",
]).pipe(
  $I.annoteSchema("HtmlSerializeRule", {
    description: "Rule identifier emitted by canonical HTML serialization.",
  })
);

/**
 * Decoded type of {@link HtmlSerializeRule}.
 *
 * @example
 * ```ts
 * import { HtmlSerializeRule } from "@beep/html/Html.serialize"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlSerializeRule)("rawTextEndTag")
 * if (Result.isSuccess(decoded)) {
 *   const rule: HtmlSerializeRule = decoded.success
 *   console.log(rule) // "rawTextEndTag"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlSerializeRule = typeof HtmlSerializeRule.Type;

/**
 * Typed canonical-serialization failure.
 *
 * @example
 * ```ts
 * import { HtmlSerializeError } from "@beep/html/Html.serialize"
 *
 * const error = HtmlSerializeError.make({
 *   path: [],
 *   rule: "invalidNode",
 *   message: "Invalid node"
 * })
 * console.log(error._tag) // "HtmlSerializeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HtmlSerializeError extends TaggedErrorClass<HtmlSerializeError>($I`HtmlSerializeError`)(
  "HtmlSerializeError",
  {
    path: S.Array(S.String),
    rule: HtmlSerializeRule,
    message: S.String,
  },
  $I.annote("HtmlSerializeError", {
    description: "Canonical HTML serialization could not preserve the modeled AST.",
  })
) {}

type RuntimeNode = {
  readonly [key: PropertyKey]: unknown;
  readonly _tag: string;
};

type RuntimeForeignNode = RuntimeNode & {
  readonly name: ForeignElementName;
  readonly namespace: "svg" | "mathml";
};

type RuntimeStringNode = RuntimeNode & {
  readonly value: string;
};

const isRuntimeNode = (value: unknown): value is RuntimeNode => P.isObject(value) && P.isString(value._tag);

const isRuntimeStringNode = (node: RuntimeNode, tag: "#comment" | "#text"): node is RuntimeStringNode =>
  node._tag === tag && P.isString(node.value);

const isRuntimeForeignNode = (node: RuntimeNode): node is RuntimeForeignNode =>
  node._tag === "#foreign" &&
  P.isString(node.name) &&
  (node.namespace === "svg" || node.namespace === "mathml") &&
  isForeignElementNameFixedPoint(node.namespace, node.name);

const runtimeChildren = (node: RuntimeNode): ReadonlyArray<RuntimeNode> => {
  /* istanbul ignore else -- every encoded container node has a generated array-valued children field */
  if (A.isArray(node.children)) return A.filter(node.children, isRuntimeNode);
  return A.emptyReadonly();
};

const runtimeForeignAttributeEntries = (node: RuntimeNode): ReadonlyArray<readonly [string, unknown]> =>
  P.isObject(node.attributes) ? Struct.entries(node.attributes) : A.emptyReadonly();

const isStructuralElementField = (tag: HtmlTag, name: string): boolean =>
  name === "_tag" || name === "children" || (name === "content" && ELEMENT_META[tag].textMode !== "normal");

const escapeText: (value: string) => string = flow(
  Str.replaceAll("&", "&amp;"),
  Str.replaceAll("<", "&lt;"),
  Str.replaceAll(">", "&gt;")
);

const escapeAttribute: (value: string) => string = flow(
  Str.replaceAll("&", "&amp;"),
  Str.replaceAll('"', "&quot;"),
  Str.replaceAll("<", "&lt;"),
  Str.replaceAll(">", "&gt;")
);

const makeError = (path: ReadonlyArray<string>, rule: HtmlSerializeRule, message: string): HtmlSerializeError =>
  HtmlSerializeError.make({ path, rule, message });

const validateScalarString = (
  value: string,
  path: ReadonlyArray<string>,
  description: string
): Effect.Effect<string, HtmlSerializeError> =>
  invalidScalarPattern.test(value)
    ? Effect.fail(makeError(path, "invalidNode", `${description} contains a NUL code point or lone UTF-16 surrogate`))
    : Effect.succeed(value);

const serializeAttribute = (
  name: string,
  value: unknown,
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> => {
  if (value === true || (value === "" && isBooleanAttributeName(name))) {
    return Effect.succeed(` ${name}`);
  }
  if (P.isString(value)) {
    return validateScalarString(value, A.append(path, name), `Attribute ${name}`).pipe(
      Effect.map((scalar) => ` ${name}="${escapeAttribute(scalar)}"`)
    );
  }
  /* istanbul ignore else -- encoded scalar attributes are presence booleans, strings, or numbers */
  if (P.isNumber(value)) {
    return Effect.succeed(` ${name}="${value}"`);
  }
  return Effect.fail(
    makeError(A.append(path, name), "invalidAttribute", `Attribute ${name} has no serializable scalar value`)
  );
};

const serializeDataset = (
  value: unknown,
  path: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<string>, HtmlSerializeError> => {
  /* istanbul ignore else -- HtmlRoot encoding emits dataset only from its generated record schema */
  if (P.isObject(value)) {
    return Effect.forEach(pipe(Struct.entries(value), A.sort(byEntryName)), ([key, entry]) =>
      serializeAttribute(`data-${key}`, entry, path)
    );
  }
  return Effect.fail(
    makeError(A.append(path, "dataset"), "invalidAttribute", "The dataset attribute must be an object")
  );
};

const serializeAttributes = Effect.fn("Html.serializeAttributes")(function* (
  node: RuntimeNode,
  tag: HtmlTag,
  path: ReadonlyArray<string>
) {
  const chunks = yield* Effect.forEach(
    pipe(
      Struct.entries(node),
      A.filter(([name]) => !isStructuralElementField(tag, name)),
      A.sort(byEntryName)
    ),
    ([name, value]) =>
      name === "dataset" ? serializeDataset(value, path) : serializeAttribute(name, value, path).pipe(Effect.map(A.of))
  );
  return pipe(chunks, A.flatten, A.join(""));
});

const serializeForeignAttributes = (
  value: unknown,
  namespace: "svg" | "mathml",
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> => {
  /* istanbul ignore else -- HtmlRoot encoding emits foreign attributes only from its generated record schema */
  if (P.isObject(value)) {
    return Effect.forEach(
      pipe(Struct.entries(value), A.sort(byEntryName)),
      ([name, entry]) =>
        !isForeignAttributeName(name) || !isForeignAttributeNameFixedPoint(namespace, name)
          ? Effect.fail(
              makeError(
                A.append(path, name),
                "invalidAttribute",
                `Foreign attribute ${name} is not a browser-fixed XML-style attribute name`
              )
            )
          : serializeAttribute(name, entry, path),
      { discard: false }
    ).pipe(Effect.map(A.join("")));
  }
  return Effect.fail(
    makeError(A.append(path, "attributes"), "invalidAttribute", "Foreign attributes must be an object")
  );
};

const serializeChildren = Effect.fn("Html.serializeChildren")(function* (
  children: ReadonlyArray<RuntimeNode>,
  path: ReadonlyArray<string>
) {
  const output = yield* Effect.forEach(children, (child, index) =>
    serializeRuntimeNode(child, A.append(path, `children.${index}`))
  );
  return pipe(output, A.join(""));
});

const serializeForeignChildren = Effect.fn("Html.serializeForeignChildren")(function* (
  parent: RuntimeForeignNode,
  path: ReadonlyArray<string>
) {
  const parentAttributes = runtimeForeignAttributeEntries(parent);
  const output = yield* Effect.forEach(runtimeChildren(parent), (child, index) => {
    const childPath = A.append(path, `children.${index}`);
    if (child._tag === "#text" || child._tag === "#comment") {
      return serializeRuntimeNode(child, childPath);
    }
    if (isRuntimeForeignNode(child)) {
      return isForeignChildAtForeignBoundary(
        { attributes: parentAttributes, name: parent.name, namespace: parent.namespace },
        { attributes: runtimeForeignAttributeEntries(child), name: child.name, namespace: child.namespace }
      )
        ? serializeRuntimeNode(child, childPath)
        : Effect.fail(
            makeError(
              childPath,
              "invalidNode",
              "The foreign child would change namespace or escape its opaque parent during HTML parsing"
            )
          );
    }
    return isHtmlTag(child._tag) &&
      isHtmlChildAtForeignBoundary({ attributes: parentAttributes, name: parent.name, namespace: parent.namespace })
      ? serializeRuntimeNode(child, childPath)
      : Effect.fail(
          makeError(
            childPath,
            "invalidNode",
            "HTML elements can occur inside opaque foreign content only at a modeled integration point"
          )
        );
  });
  return pipe(output, A.join(""));
});

const serializeCanonicalDoctype = (
  value: unknown,
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> =>
  isRuntimeNode(value) &&
  value._tag === "#doctype" &&
  value.name === "html" &&
  value.publicId === undefined &&
  value.systemId === undefined
    ? Effect.succeed("<!doctype html>")
    : Effect.fail(
        makeError(
          A.append(path, "doctype"),
          "nonCanonicalDoctype",
          "Only the canonical <!doctype html> declaration is serializable"
        )
      );

const serializeTextContent = (
  tag: HtmlTag,
  content: string,
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> =>
  validateScalarString(content, A.append(path, "content"), `Text content for <${tag}>`).pipe(
    Effect.flatMap((scalar) =>
      Match.value(ELEMENT_META[tag].textMode).pipe(
        Match.when("normal", () => Effect.succeed(escapeText(scalar))),
        Match.when("rcdata", () => Effect.succeed(escapeText(scalar))),
        Match.when("raw-text", () =>
          Str.includes(`</${Str.toLowerCase(tag)}`)(Str.toLowerCase(scalar))
            ? Effect.fail(
                makeError(
                  A.append(path, "content"),
                  "rawTextEndTag",
                  `Raw text for <${tag}> contains its own end-tag opener`
                )
              )
            : Effect.succeed(scalar)
        ),
        Match.when("plaintext", () =>
          Effect.fail(
            makeError(
              path,
              "plaintextElement",
              "The <plaintext> element cannot be serialized without consuming the remainder of the document"
            )
          )
        ),
        Match.exhaustive
      )
    )
  );

const serializeElement = Effect.fn("Html.serializeElement")(function* (
  node: RuntimeNode,
  tag: HtmlTag,
  path: ReadonlyArray<string>
) {
  const attributes = yield* serializeAttributes(node, tag, A.append(path, "attributes"));
  const opening = `<${tag}${attributes}>`;
  if (ELEMENT_META[tag].void) return opening;

  const content = P.isString(node.content)
    ? yield* serializeTextContent(tag, node.content, path)
    : yield* serializeChildren(runtimeChildren(node), path);

  return `${opening}${content}</${tag}>`;
});

const serializeForeignNode = (
  node: RuntimeForeignNode,
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> => {
  const attributes =
    node.attributes === undefined
      ? Effect.succeed("")
      : serializeForeignAttributes(node.attributes, node.namespace, A.append(path, "attributes"));
  return Effect.all([
    Effect.succeed(`<${node.name}`),
    attributes,
    Effect.succeed(">"),
    serializeForeignChildren(node, path),
    Effect.succeed(`</${node.name}>`),
  ]).pipe(Effect.map(A.join("")));
};

const serializeRuntimeNode = (
  node: RuntimeNode,
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> => {
  if (isRuntimeStringNode(node, "#text")) {
    return validateScalarString(node.value, A.append(path, "value"), "Text node").pipe(Effect.map(escapeText));
  }
  if (isRuntimeStringNode(node, "#comment")) {
    return validateScalarString(node.value, A.append(path, "value"), "Comment node").pipe(
      Effect.map((value) => `<!--${value}-->`)
    );
  }
  if (node._tag === "#fragment") {
    return serializeChildren(runtimeChildren(node), path);
  }
  if (node._tag === "#document") {
    const doctype = node.doctype === undefined ? Effect.succeed("") : serializeCanonicalDoctype(node.doctype, path);
    return Effect.all([doctype, serializeChildren(runtimeChildren(node), path)]).pipe(Effect.map(A.join("")));
  }
  if (isRuntimeForeignNode(node)) return serializeForeignNode(node, path);
  return isHtmlTag(node._tag)
    ? serializeElement(node, node._tag, path)
    : Effect.fail(makeError(path, "invalidNode", `Unknown HTML AST node ${node._tag}`));
};

const serializeRoot = Effect.fn("Html.serializeRoot")(function* (root: HtmlRoot.Type) {
  const encoded = yield* Result.match(S.encodeResult(HtmlRoot)(root), {
    onFailure: () =>
      Effect.fail(makeError([], "encodingFailure", "The HTML root did not satisfy its generated schema")),
    onSuccess: Effect.succeed,
  });
  /* istanbul ignore next -- a successful HtmlRoot encoding always yields an object with a string discriminator */
  if (!isRuntimeNode(encoded)) {
    return yield* makeError([], "encodingFailure", "The encoded HTML root was not an object node");
  }
  return yield* serializeRuntimeNode(encoded, []);
});

/**
 * Canonically serializes an arbitrary modeled HTML root.
 *
 * The result is deliberately marked untrusted. Use {@link serializeSafe} when
 * the output is intended for an HTML injection sink.
 *
 * @example
 * ```ts
 * import { Fragment, serialize, untrustedHtmlValue } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const html = Effect.runSync(serialize(Fragment.make({ children: [] })))
 * console.log(untrustedHtmlValue(html)) // ""
 * ```
 *
 * @effects Fails with {@link HtmlSerializeError} when the modeled root
 * contains a value that cannot be emitted safely in its HTML serialization
 * context.
 * @category serialization
 * @since 0.0.0
 */
export const serialize: (root: HtmlRoot.Type) => Effect.Effect<UntrustedHtml, HtmlSerializeError> = (root) =>
  serializeRoot(root).pipe(Effect.map(UntrustedHtml.make));

/**
 * Canonically serializes a conformance proof as untrusted HTML.
 *
 * @example
 * ```ts
 * import { conform, Fragment, serializeConformant, untrustedHtmlValue } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const html = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(Effect.flatMap(serializeConformant))
 * )
 * console.log(untrustedHtmlValue(html)) // ""
 * ```
 *
 * @effects Reads the module-issued conformance proof and fails with
 * {@link HtmlSerializeError} when contextual serialization rejects a modeled
 * value.
 * @category serialization
 * @since 0.0.0
 */
export const serializeConformant: (value: ConformantHtml) => Effect.Effect<UntrustedHtml, HtmlSerializeError> = (
  value
) => serialize(conformantRoot(value));

const revalidateSafeHtmlAst = (value: SafeHtmlAst): Effect.Effect<HtmlRoot.Type, HtmlSerializeError> =>
  isSafeHtmlAst(value)
    ? conform(safeHtmlAstRoot(value)).pipe(
        Effect.flatMap(enforceSafeHtml),
        Effect.map(safeHtmlAstRoot),
        Effect.mapError(() =>
          makeError(
            [],
            "invalidProof",
            "The safe-HTML proof failed defense-in-depth conformance or policy revalidation"
          )
        )
      )
    : Effect.fail(makeError([], "invalidProof", "The safe-HTML value was not issued by this module"));

/**
 * Canonically serializes a safe-AST proof and issues opaque {@link SafeHtml}.
 *
 * @example
 * ```ts
 * import {
 *   conform,
 *   enforceSafeHtml,
 *   Fragment,
 *   safeHtmlValue,
 *   serializeSafe,
 * } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const html = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(
 *     Effect.flatMap(enforceSafeHtml),
 *     Effect.flatMap(serializeSafe)
 *   )
 * )
 * console.log(safeHtmlValue(html)) // ""
 * ```
 *
 * @effects Revalidates conformance and safe-output policy before
 * serialization, failing with {@link HtmlSerializeError} for an invalid proof
 * or rejected modeled value.
 * @category serialization
 * @since 0.0.0
 */
export const serializeSafe: (value: SafeHtmlAst) => Effect.Effect<SafeHtml, HtmlSerializeError> = (value) =>
  revalidateSafeHtmlAst(value).pipe(Effect.flatMap(serializeRoot), Effect.map(issueSafeHtml));

/**
 * Extracts the string from an untrusted canonical serialization.
 *
 * @example
 * ```ts
 * import { Fragment, serialize, untrustedHtmlValue } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const html = Effect.runSync(serialize(Fragment.make({ children: [] })))
 * console.log(untrustedHtmlValue(html)) // ""
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const untrustedHtmlValue = (value: UntrustedHtml): string => value;

/**
 * Extracts the string from opaque, policy-proven HTML.
 *
 * Keep the {@link SafeHtml} wrapper until the final browser or framework sink
 * so trust provenance remains visible in intermediate APIs.
 *
 * @example
 * ```ts
 * import {
 *   conform,
 *   enforceSafeHtml,
 *   Fragment,
 *   safeHtmlValue,
 *   serializeSafe,
 * } from "@beep/html"
 * import { Effect } from "effect"
 *
 * const html = Effect.runSync(
 *   conform(Fragment.make({ children: [] })).pipe(
 *     Effect.flatMap(enforceSafeHtml),
 *     Effect.flatMap(serializeSafe)
 *   )
 * )
 * console.log(safeHtmlValue(html)) // ""
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const safeHtmlValue = (value: SafeHtml): string =>
  pipe(
    safeHtmlStrings.get(value),
    O.fromUndefinedOr,
    O.getOrThrowWith(() => makeError([], "invalidProof", "Invalid SafeHtml issuer proof"))
  );
