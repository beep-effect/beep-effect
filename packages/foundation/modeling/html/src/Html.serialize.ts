/**
 * Canonical serialization for the schema-first HTML AST.
 *
 * The serializer escapes text and attributes, expands the modeled `dataset`
 * bag, emits HTML void elements without XML syntax, and rejects AST states
 * whose browser parse would not preserve the modeled tree. Safe output is
 * issued only from a {@link SafeHtmlAst} proof.
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
import { ForeignAttributeName, ForeignElementName } from "./Html.attributes.ts";
import { conform, conformantRoot } from "./Html.conformance.ts";
import { isForeignAttributeNameFixedPoint, isForeignElementNameFixedPoint } from "./Html.foreign.ts";
import { ELEMENT_META, HtmlBooleanAttributeName, HtmlTag } from "./Html.meta.ts";
import { HtmlRoot } from "./Html.model.ts";
import { enforceSafeHtml, SafeHtmlAst, safeHtmlAstRoot } from "./Html.policy.ts";
import type { ConformantHtml } from "./Html.conformance.ts";

const $I = $HtmlId.create("Html.serialize");
const isHtmlTag = S.is(HtmlTag);
const isBooleanAttributeName = S.is(HtmlBooleanAttributeName);
const isForeignAttributeName = S.is(ForeignAttributeName);
const isForeignElementName = S.is(ForeignElementName);
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

type SafeHtmlValue = object;

const isSafeHtmlValue = (value: unknown): value is SafeHtmlValue => P.isObject(value) && safeHtmlIssuer.has(value);

const issueSafeHtml = (html: string): SafeHtmlValue => {
  const value = Object.create(null) as SafeHtmlValue;
  safeHtmlStrings.set(value, html);
  safeHtmlIssuer.add(value);
  return Object.freeze(value);
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

const isRuntimeNode = (value: unknown): value is RuntimeNode => P.isObject(value) && P.isString(value._tag);

const runtimeChildren = (node: RuntimeNode): ReadonlyArray<RuntimeNode> =>
  A.isArray(node.children) ? A.filter(node.children, isRuntimeNode) : A.emptyReadonly();

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
): Effect.Effect<ReadonlyArray<string>, HtmlSerializeError> =>
  P.isObject(value)
    ? Effect.forEach(pipe(Struct.entries(value), A.sort(byEntryName)), ([key, entry]) =>
        serializeAttribute(`data-${key}`, entry, path)
      )
    : Effect.fail(makeError(A.append(path, "dataset"), "invalidAttribute", "The dataset attribute must be an object"));

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
): Effect.Effect<string, HtmlSerializeError> =>
  P.isObject(value)
    ? Effect.forEach(
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
      ).pipe(Effect.map(A.join("")))
    : Effect.fail(makeError(A.append(path, "attributes"), "invalidAttribute", "Foreign attributes must be an object"));

const serializeChildren = Effect.fn("Html.serializeChildren")(function* (
  children: ReadonlyArray<RuntimeNode>,
  path: ReadonlyArray<string>
) {
  const output = yield* Effect.forEach(children, (child, index) =>
    serializeRuntimeNode(child, A.append(path, `children.${index}`))
  );
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

const serializeRuntimeNode = (
  node: RuntimeNode,
  path: ReadonlyArray<string>
): Effect.Effect<string, HtmlSerializeError> => {
  if (node._tag === "#text" && P.isString(node.value)) {
    return validateScalarString(node.value, A.append(path, "value"), "Text node").pipe(Effect.map(escapeText));
  }
  if (node._tag === "#comment" && P.isString(node.value)) {
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
  if (
    node._tag === "#foreign" &&
    P.isString(node.name) &&
    isForeignElementName(node.name) &&
    (node.namespace === "svg" || node.namespace === "mathml") &&
    isForeignElementNameFixedPoint(node.namespace, node.name)
  ) {
    const [prefix] = Str.split(":")(node.name);
    if (
      Str.includes(":")(node.name) &&
      !((node.namespace === "svg" && prefix === "svg") || (node.namespace === "mathml" && prefix === "mathml"))
    ) {
      return Effect.fail(
        makeError(path, "invalidNode", `Foreign name ${node.name} does not match namespace ${node.namespace}`)
      );
    }
    const attributes =
      node.attributes === undefined
        ? Effect.succeed("")
        : serializeForeignAttributes(node.attributes, node.namespace, A.append(path, "attributes"));
    return Effect.all([
      Effect.succeed(`<${node.name}`),
      attributes,
      Effect.succeed(">"),
      serializeChildren(runtimeChildren(node), path),
      Effect.succeed(`</${node.name}>`),
    ]).pipe(Effect.map(A.join("")));
  }
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
