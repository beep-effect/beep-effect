/**
 * Content Security Policy schemas and response-header constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { A, Str, Struct } from "@beep/utils";
import { Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import { wrapArray } from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { CspError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("Csp");

/**
 * Source expression accepted by a Content-Security-Policy directive.
 *
 * **Example** (Decode self source)
 *
 * ```ts import.meta.vitest name="Decode self source"
 * import * as S from "effect/Schema"
 * import { DirectiveSource } from "@beep/schema/Csp"
 *
 * const source = S.decodeUnknownSync(DirectiveSource)("'self'")
 * console.log(source)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DirectiveSource = S.Union([...internal.ArrayOfStrOrStr.members, S.Undefined]).pipe(
  $I.annoteSchema("DirectiveSource", {
    description: "A CSP directive source expression, source list, or explicit undefined directive value.",
  })
);

/**
 * Runtime type for {@link DirectiveSource}.
 *
 * **Example** (Annotate self source)
 *
 * ```ts import.meta.vitest name="Annotate self source"
 * import type { DirectiveSource } from "@beep/schema/Csp"
 *
 * const source: DirectiveSource = "'self'"
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DirectiveSource = typeof DirectiveSource.Type;

const headerName = "Content-Security-Policy";
const reportOnlyHeaderName = "Content-Security-Policy-Report-Only";
const directiveValueSeparator = "; ";

const ContentSecurityPolicyHeaderNameBase = LiteralKit([headerName, reportOnlyHeaderName]);

/**
 * Header names used for enforcing or report-only CSP directives.
 *
 * **Example** (Decode CSP header name)
 *
 * ```ts import.meta.vitest name="Decode CSP header name"
 * import * as S from "effect/Schema"
 * import { ContentSecurityPolicyHeaderName } from "@beep/schema/Csp"
 *
 * const name = S.decodeUnknownSync(ContentSecurityPolicyHeaderName)("Content-Security-Policy")
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentSecurityPolicyHeaderName = ContentSecurityPolicyHeaderNameBase.pipe(
  $I.annoteSchema("ContentSecurityPolicyHeaderName", {
    description: "The valid `Content-Security-Policy` response header names.",
  }),
  SchemaUtils.withLiteralKitStatics(ContentSecurityPolicyHeaderNameBase)
);

/**
 * Runtime type for {@link ContentSecurityPolicyHeaderName}.
 *
 * **Example** (Annotate CSP header name)
 *
 * ```ts import.meta.vitest name="Annotate CSP header name"
 * import type { ContentSecurityPolicyHeaderName } from "@beep/schema/Csp"
 *
 * const name: ContentSecurityPolicyHeaderName = "Content-Security-Policy"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContentSecurityPolicyHeaderName = typeof ContentSecurityPolicyHeaderName.Type;

type DirectiveInput<T extends object> = Partial<{
  readonly [K in keyof T]: T[K] | O.Option<T[K]>;
}>;

const unwrapDirectiveValue = <T>(value: undefined | T | O.Option<T>): T | undefined =>
  O.isOption(value) ? O.getOrUndefined(value) : value;

/**
 * Select the enforcing or report-only CSP response-header name.
 *
 * **Example** (Select enforcing or report-only)
 *
 * ```ts import.meta.vitest name="Select enforcing or report-only"
 * import { getProperHeaderName } from "@beep/schema/Csp"
 *
 * const standardHeader = getProperHeaderName()
 * const reportOnlyHeader = getProperHeaderName(true)
 *
 * standardHeader // => "Content-Security-Policy"
 * reportOnlyHeader // => "Content-Security-Policy-Report-Only"
 * ```
 *
 * @param reportOnly - Whether to return the report-only header name.
 * @returns The matching content security policy header name.
 * @category utilities
 * @since 0.0.0
 */
export const getProperHeaderName = (reportOnly = false): ContentSecurityPolicyHeaderName =>
  reportOnly ? reportOnlyHeaderName : headerName;

/**
 * Options for directive serialization.
 */
type DirectiveValueOptions = {
  readonly arrayWrapper?: <T>(value: ReadonlyArray<T> | T) => readonly T[];
};

/**
 * Creates a serialized directive value from a directive name and value list.
 *
 * **Details**
 *
 * The helper is dual-call: pass `(directiveName, value)` directly or pass the
 * value first to obtain a pipe-friendly directive-name formatter. Values are
 * joined with a single space, matching CSP directive-list syntax.
 *
 * **Example** (Dual-call directive formatting)
 *
 * ```ts import.meta.vitest name="Dual-call directive formatting"
 * import { createDirectiveValue } from "@beep/schema/Csp"
 *
 * const value = createDirectiveValue("default-src", ["'self'", "https://cdn.example.com"])
 * const style = createDirectiveValue(["'self'"])("style-src")
 *
 * value // => "default-src 'self' https://cdn.example.com"
 * style // => "style-src 'self'"
 * ```
 *
 * @typeParam T - Literal directive source value preserved in the output template string.
 * @category utilities
 * @since 0.0.0
 */
export const createDirectiveValue: {
  <const T extends string>(directiveName: string, value: T | readonly T[]): `${string} ${string}`;
  <const T extends string>(
    directiveName: string,
    value: T | readonly T[],
    options: DirectiveValueOptions
  ): `${string} ${string}`;
  <const T extends string>(value: T | readonly T[]): (directiveName: string) => `${string} ${string}`;
  <const T extends string>(
    value: T | readonly T[],
    options: DirectiveValueOptions
  ): (directiveName: string) => `${string} ${string}`;
} = dual(
  (args) => args.length >= 2,
  <const T extends string>(
    directiveName: string,
    value: T | readonly T[],
    options: DirectiveValueOptions = {}
  ): `${string} ${string}` => {
    const values = (options.arrayWrapper ?? wrapArray)(value);

    return `${directiveName} ${A.join(" ")(values)}` as const;
  }
);

/**
 * Values accepted by the CSP `plugin-types` directive.
 *
 * **Example** (Decode plugin MIME types)
 *
 * ```ts import.meta.vitest name="Decode plugin MIME types"
 * import * as S from "effect/Schema"
 * import { PluginTypes } from "@beep/schema/Csp"
 *
 * const pluginTypes = S.decodeUnknownSync(PluginTypes)(["application/pdf"])
 * console.log(pluginTypes[0])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PluginTypes = internal.ArrayOfStrOrStr.pipe(
  $I.annoteSchema("PluginTypes", {
    description: "A MIME type or list of MIME types accepted by the CSP plugin-types directive.",
  })
);

/**
 * Runtime type for {@link PluginTypes}.
 *
 * **Example** (Annotate plugin MIME types)
 *
 * ```ts import.meta.vitest name="Annotate plugin MIME types"
 * import type { PluginTypes } from "@beep/schema/Csp"
 *
 * const pluginTypes: PluginTypes = ["application/pdf"]
 * console.log(pluginTypes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PluginTypes = typeof PluginTypes.Type;

const SandboxBase = LiteralKit([
  true,
  "allow-downloads-without-user-activation",
  "allow-forms",
  "allow-modals",
  "allow-orientation-lock",
  "allow-pointer-lock",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-presentation",
  "allow-same-origin",
  "allow-scripts",
  "allow-storage-access-by-user-activation",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
]);

/**
 * Values accepted by the CSP `sandbox` directive.
 *
 * **Example** (Decode sandbox token)
 *
 * ```ts import.meta.vitest name="Decode sandbox token"
 * import * as S from "effect/Schema"
 * import { Sandbox } from "@beep/schema/Csp"
 *
 * const directive = S.decodeUnknownSync(Sandbox)("allow-scripts")
 * console.log(directive)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Sandbox = SandboxBase.pipe(
  $I.annoteSchema("Sandbox", {
    description: "A boolean sandbox directive flag or a supported CSP sandbox token.",
  }),
  SchemaUtils.withLiteralKitStatics(SandboxBase)
);

/**
 * Runtime type for {@link Sandbox}.
 *
 * **Example** (Annotate sandbox token)
 *
 * ```ts import.meta.vitest name="Annotate sandbox token"
 * import type { Sandbox } from "@beep/schema/Csp"
 *
 * const sandbox: Sandbox = "allow-scripts"
 * console.log(sandbox)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Sandbox = typeof Sandbox.Type;

const fetchDirectiveNamesByKey = {
  childSrc: "child-src",
  "child-src": "child-src",
  connectSrc: "connect-src",
  "connect-src": "connect-src",
  defaultSrc: "default-src",
  "default-src": "default-src",
  fontSrc: "font-src",
  "font-src": "font-src",
  frameSrc: "frame-src",
  "frame-src": "frame-src",
  imgSrc: "img-src",
  "img-src": "img-src",
  manifestSrc: "manifest-src",
  "manifest-src": "manifest-src",
  mediaSrc: "media-src",
  "media-src": "media-src",
  prefetchSrc: "prefetch-src",
  "prefetch-src": "prefetch-src",
  objectSrc: "object-src",
  "object-src": "object-src",
  scriptSrc: "script-src",
  "script-src": "script-src",
  scriptSrcElem: "script-src-elem",
  "script-src-elem": "script-src-elem",
  scriptSrcAttr: "script-src-attr",
  "script-src-attr": "script-src-attr",
  styleSrc: "style-src",
  "style-src": "style-src",
  styleSrcElem: "style-src-elem",
  "style-src-elem": "style-src-elem",
  styleSrcAttr: "style-src-attr",
  "style-src-attr": "style-src-attr",
  workerSrc: "worker-src",
  "worker-src": "worker-src",
} as const;

/**
 * Fetch directive fields accepted by Content-Security-Policy.
 *
 * **Details**
 *
 * The serializer accepts both camelCase keys (`defaultSrc`) and CSP wire keys
 * (`default-src`). `Option.none()` and `undefined` values are omitted so
 * partially configured policy objects can be composed before rendering.
 *
 * **Example** (Serialize mixed fetch keys)
 *
 * ```ts import.meta.vitest name="Serialize mixed fetch keys"
 * import * as O from "effect/Option"
 * import { FetchDirective } from "@beep/schema/Csp"
 *
 * const value = FetchDirective.convertToString({
 *   defaultSrc: O.some("'self'"),
 *   "img-src": ["https:"],
 *   scriptSrc: O.none()
 * })
 *
 * value // => "default-src 'self'; img-src https:"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FetchDirective extends S.Class<FetchDirective>($I`FetchDirective`)(
  {
    childSrc: DirectiveSource,
    "child-src": DirectiveSource,
    connectSrc: DirectiveSource,
    "connect-src": DirectiveSource,
    defaultSrc: DirectiveSource,
    "default-src": DirectiveSource,
    fontSrc: DirectiveSource,
    "font-src": DirectiveSource,
    frameSrc: DirectiveSource,
    "frame-src": DirectiveSource,
    imgSrc: DirectiveSource,
    "img-src": DirectiveSource,
    manifestSrc: DirectiveSource,
    "manifest-src": DirectiveSource,
    mediaSrc: DirectiveSource,
    "media-src": DirectiveSource,
    prefetchSrc: DirectiveSource,
    "prefetch-src": DirectiveSource,
    objectSrc: DirectiveSource,
    "object-src": DirectiveSource,
    scriptSrc: DirectiveSource,
    "script-src": DirectiveSource,
    scriptSrcElem: DirectiveSource,
    "script-src-elem": DirectiveSource,
    scriptSrcAttr: DirectiveSource,
    "script-src-attr": DirectiveSource,
    styleSrc: DirectiveSource,
    "style-src": DirectiveSource,
    styleSrcElem: DirectiveSource,
    "style-src-elem": DirectiveSource,
    styleSrcAttr: DirectiveSource,
    "style-src-attr": DirectiveSource,
    workerSrc: DirectiveSource,
    "worker-src": DirectiveSource,
  },
  $I.annote("FetchDirective", {
    description: "CSP fetch directive fields and serialization helpers.",
  })
) {
  static readonly convertToString = (directive?: undefined | DirectiveInput<FetchDirective>) => {
    if (P.isUndefined(directive)) {
      return Str.empty;
    }

    let strings = A.empty<string>();
    A.forEach(Struct.entries(directive), ([key, value]) => {
      const directiveValue = unwrapDirectiveValue(value);
      if (P.isUndefined(directiveValue)) {
        return;
      }

      const directiveName = fetchDirectiveNamesByKey[key];
      if (P.isUndefined(directiveName)) {
        return;
      }

      strings = A.append(strings, createDirectiveValue(directiveName, wrapArray(directiveValue)));
    });

    return A.join(strings, directiveValueSeparator);
  };
}

/**
 * Document directive fields accepted by Content-Security-Policy.
 *
 * **Details**
 *
 * `sandbox: true` renders the bare `sandbox` directive, while string tokens
 * render as `sandbox <token>`. CamelCase and wire-format keys are normalized
 * to the wire-format directive names when serialized.
 *
 * **Example** (Serialize bare sandbox flag)
 *
 * ```ts import.meta.vitest name="Serialize bare sandbox flag"
 * import { DocumentDirective } from "@beep/schema/Csp"
 *
 * const value = DocumentDirective.convertToString({
 *   "base-uri": "'self'",
 *   "plugin-types": ["application/pdf"],
 *   sandbox: true
 * })
 *
 * value // => "base-uri 'self'; plugin-types application/pdf; sandbox"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentDirective extends S.Class<DocumentDirective>($I`DocumentDirective`)(
  {
    baseURI: DirectiveSource,
    "base-uri": DirectiveSource,
    pluginTypes: PluginTypes,
    "plugin-types": PluginTypes,
    sandbox: Sandbox,
  },
  $I.annote("DocumentDirective", {
    description: "CSP document directive fields and serialization helpers.",
  })
) {
  static readonly convertToString = (directive?: undefined | DirectiveInput<DocumentDirective>) => {
    if (P.isUndefined(directive)) {
      return Str.empty;
    }

    let strings = A.empty<string>();

    const baseURI = unwrapDirectiveValue(directive.baseURI) ?? unwrapDirectiveValue(directive["base-uri"]);
    if (baseURI != undefined) {
      strings = A.append(strings, createDirectiveValue("base-uri", wrapArray(baseURI)));
    }

    const pluginTypes = unwrapDirectiveValue(directive.pluginTypes) ?? unwrapDirectiveValue(directive["plugin-types"]);
    if (P.isNotUndefined(pluginTypes)) {
      strings = A.append(strings, createDirectiveValue("plugin-types", wrapArray(pluginTypes)));
    }

    const sandbox = unwrapDirectiveValue(directive.sandbox);
    if (P.isNotUndefined(sandbox)) {
      const directiveName = "sandbox";
      const value = sandbox === true ? directiveName : createDirectiveValue(directiveName, sandbox);
      strings = A.append(strings, value);
    }

    return pipe(strings, A.join(directiveValueSeparator));
  };
}

/**
 * Navigation directive fields accepted by Content-Security-Policy.
 *
 * **Details**
 *
 * The serializer normalizes `formAction`, `frameAncestors`, and `navigateTo`
 * to their CSP wire names and omits absent values.
 *
 * **Example** (Serialize navigation directives)
 *
 * ```ts import.meta.vitest name="Serialize navigation directives"
 * import { NavigationDirective } from "@beep/schema/Csp"
 *
 * const value = NavigationDirective.convertToString({
 *   formAction: "'self'",
 *   frameAncestors: ["'none'"],
 *   "navigate-to": "https://example.com"
 * })
 *
 * value // => "form-action 'self'; frame-ancestors 'none'; navigate-to https://example.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NavigationDirective extends S.Class<NavigationDirective>($I`NavigationDirective`)(
  {
    formAction: DirectiveSource,
    "form-action": DirectiveSource,
    frameAncestors: DirectiveSource,
    "frame-ancestors": DirectiveSource,
    navigateTo: DirectiveSource,
    "navigate-to": DirectiveSource,
  },
  $I.annote("NavigationDirective", {
    description: "CSP navigation directive fields and serialization helpers.",
  })
) {
  static readonly convertToString = (directive?: undefined | DirectiveInput<NavigationDirective>) => {
    if (directive == undefined) {
      return Str.empty;
    }

    let strings = A.empty<string>();

    const formAction = unwrapDirectiveValue(directive.formAction) ?? unwrapDirectiveValue(directive["form-action"]);
    if (formAction != undefined) {
      strings = A.append(strings, createDirectiveValue("form-action", wrapArray(formAction)));
    }

    const frameAncestors =
      unwrapDirectiveValue(directive.frameAncestors) ?? unwrapDirectiveValue(directive["frame-ancestors"]);
    if (frameAncestors != undefined) {
      strings = A.append(strings, createDirectiveValue("frame-ancestors", wrapArray(frameAncestors)));
    }

    const navigateTo = unwrapDirectiveValue(directive.navigateTo) ?? unwrapDirectiveValue(directive["navigate-to"]);
    if (navigateTo != undefined) {
      strings = A.append(strings, createDirectiveValue("navigate-to", wrapArray(navigateTo)));
    }

    return pipe(strings, A.join(directiveValueSeparator));
  };
}

/**
 * Values accepted by the CSP `report-uri` directive.
 *
 * **Example** (Decode report URI path)
 *
 * ```ts import.meta.vitest name="Decode report URI path"
 * import * as S from "effect/Schema"
 * import { ReportURI } from "@beep/schema/Csp"
 *
 * const uri = S.decodeUnknownSync(ReportURI)("/csp-report")
 * console.log(uri)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReportURI = S.Union([...internal.StringOrUrl.members, S.Array(internal.StringOrUrl)]).pipe(
  $I.annoteSchema("ReportURI", {
    description: "A CSP report-uri target, URL target, or list of reporting targets.",
  })
);

/**
 * Type-level representation of {@link ReportURI}.
 *
 * **Example** (Annotate report URI path)
 *
 * ```ts import.meta.vitest name="Annotate report URI path"
 * import type { ReportURI } from "@beep/schema/Csp"
 *
 * const uri: ReportURI = "/csp-report"
 * console.log(uri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReportURI = typeof ReportURI.Type;

/**
 * Reporting directive fields accepted by Content-Security-Policy.
 *
 * **Details**
 *
 * `report-uri` values are normalized through the shared strict URI encoder
 * before joining, while `report-to` is rendered as the named reporting group.
 *
 * **Example** (Serialize report-uri and report-to)
 *
 * ```ts import.meta.vitest name="Serialize report-uri and report-to"
 * import { ReportingDirective } from "@beep/schema/Csp"
 *
 * const value = ReportingDirective.convertToString({
 *   "report-uri": [new URL("https://example.com/csp"), "https://example.com/local-report"],
 *   reportTo: "default-endpoint"
 * })
 *
 * value // => "report-uri https://example.com/csp https://example.com/local-report; report-to default-endpoint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReportingDirective extends S.Class<ReportingDirective>($I`ReportingDirective`)(
  {
    reportURI: ReportURI,
    "report-uri": ReportURI,
    reportTo: S.String,
    "report-to": S.String,
  },
  $I.annote("ReportingDirective", {
    description: "CSP reporting directive fields and serialization helpers.",
  })
) {
  static readonly convertToString = (directive?: undefined | DirectiveInput<ReportingDirective>) => {
    if (directive == undefined) {
      return Str.empty;
    }

    let strings = A.empty<string>();

    const reportURIValue = unwrapDirectiveValue(directive.reportURI) ?? unwrapDirectiveValue(directive["report-uri"]);
    if (reportURIValue != undefined) {
      const reportURI = A.map(wrapArray(reportURIValue), (i) => internal.encodeStrictURI(i));
      strings = A.append(strings, createDirectiveValue("report-uri", reportURI));
    }
    const reportTo = unwrapDirectiveValue(directive.reportTo) ?? unwrapDirectiveValue(directive["report-to"]);
    if (reportTo != undefined) {
      strings = A.append(strings, createDirectiveValue("report-to", reportTo));
    }

    return pipe(strings, A.join(directiveValueSeparator));
  };
}

/**
 * Complete normalized CSP directive field schema.
 *
 * **Details**
 *
 * This schema describes the full directive field set produced by composing the
 * directive classes. It is stricter than the user-facing option object: partial
 * policy input belongs in {@link ContentSecurityPolicyOptionStruct}, whose
 * `directives` field makes each directive key optional before rendering.
 *
 * **Example** (Reject partial directive object)
 *
 * ```ts import.meta.vitest name="Reject partial directive object"
 * import * as S from "effect/Schema"
 * import { CspDirectives } from "@beep/schema/Csp"
 *
 * const result = S.decodeUnknownResult(CspDirectives)({ defaultSrc: "'self'" })
 *
 * result._tag // => "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CspDirectives extends S.Class<CspDirectives>($I`CspDirectives`)(
  {
    ...FetchDirective.fields,
    ...DocumentDirective.fields,
    ...NavigationDirective.fields,
    ...ReportingDirective.fields,
  },
  $I.annote("CspDirectives", {
    description: "The complete normalized field set for all supported CSP directives.",
  })
) {}

/**
 * Structured CSP option object accepted before header serialization.
 *
 * **Details**
 *
 * Unlike {@link CspDirectives}, every directive key is optional here. This is
 * the object shape callers should use when constructing a CSP policy from the
 * subset of directives they actually want to emit.
 *
 * **Example** (Decode partial directives option)
 *
 * ```ts import.meta.vitest name="Decode partial directives option"
 * import * as S from "effect/Schema"
 * import { ContentSecurityPolicyOptionStruct } from "@beep/schema/Csp"
 *
 * const option = S.decodeUnknownSync(ContentSecurityPolicyOptionStruct)({
 *   directives: { defaultSrc: "'self'" }
 * })
 * console.log(option.directives.defaultSrc)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContentSecurityPolicyOptionStruct extends S.Class<ContentSecurityPolicyOptionStruct>(
  $I`ContentSecurityPolicyOptionStruct`
)(
  {
    directives: CspDirectives.mapFields((fields) => {
      const evolve = pipe(
        Struct.entries(fields),
        A.reduce(
          {} as {
            readonly [K in keyof typeof fields]: (field: (typeof fields)[K]) => S.optionalKey<(typeof fields)[K]>;
          },
          (acc, [key]) =>
            ({
              ...acc,
              [key]: S.optionalKey,
            }) as const
        )
      );

      return pipe(fields, Struct.evolve(evolve));
    }),
    reportOnly: S.optionalKey(S.Boolean),
  },
  $I.annote("ContentSecurityPolicyOptionStruct", {
    description: "Structured CSP option input with optional directive fields and optional report-only mode.",
  })
) {}

/**
 * CSP option schema accepting a disabled `false` value or structured directives.
 *
 * **Example** (Decode disabled false option)
 *
 * ```ts import.meta.vitest name="Decode disabled false option"
 * import * as S from "effect/Schema"
 * import { ContentSecurityPolicyOption } from "@beep/schema/Csp"
 *
 * const option = S.decodeUnknownSync(ContentSecurityPolicyOption)(false)
 * console.log(option)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentSecurityPolicyOption = S.Union([S.Literal(false), ContentSecurityPolicyOptionStruct]).pipe(
  $I.annoteSchema("ContentSecurityPolicyOption", {
    description: "CSP option input, either disabled with false or enabled with structured directives.",
  })
);

/**
 * Runtime type for {@link ContentSecurityPolicyOption}.
 *
 * **Example** (Annotate disabled false option)
 *
 * ```ts import.meta.vitest name="Annotate disabled false option"
 * import type { ContentSecurityPolicyOption } from "@beep/schema/Csp"
 *
 * const option: ContentSecurityPolicyOption = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContentSecurityPolicyOption = typeof ContentSecurityPolicyOption.Type;

/**
 * Concise alias for {@link ContentSecurityPolicyOption}.
 *
 * **Example** (Decode alias false option)
 *
 * ```ts import.meta.vitest name="Decode alias false option"
 * import * as S from "effect/Schema"
 * import { Option } from "@beep/schema/Csp"
 *
 * const option = S.decodeUnknownSync(Option)(false)
 * console.log(option)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Option = ContentSecurityPolicyOption;

/**
 * Type-level representation of {@link Option}.
 *
 * **Example** (Annotate alias false option)
 *
 * ```ts import.meta.vitest name="Annotate alias false option"
 * import type { Option } from "@beep/schema/Csp"
 *
 * const option: Option = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Option = typeof Option.Type;

/**
 * Serialized Content-Security-Policy response-header model.
 *
 * **Example** (Construct response header model)
 *
 * ```ts import.meta.vitest name="Construct response header model"
 * import * as O from "effect/Option"
 * import { ContentSecurityPolicyResponseHeader } from "@beep/schema/Csp"
 *
 * const header = new ContentSecurityPolicyResponseHeader({
 *   name: "Content-Security-Policy",
 *   value: O.some("default-src 'self'")
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContentSecurityPolicyResponseHeader extends S.Class<ContentSecurityPolicyResponseHeader>(
  $I`ContentSecurityPolicyResponseHeader`
)(
  {
    name: ContentSecurityPolicyHeaderName,
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ContentSecurityPolicyResponseHeader", {
    description: "A rendered Content-Security-Policy response header name and optional serialized value.",
  })
) {}

type ContentSecurityPolicyResponseHeaderEncoded = typeof ContentSecurityPolicyResponseHeader.Encoded;

const createContentSecurityPolicyValue = (
  option: ContentSecurityPolicyOptionStruct
): Effect.Effect<O.Option<string>, CspError> =>
  Effect.try({
    try: () => createContentSecurityPolicyOptionHeaderValue(option),
    catch: (cause) =>
      CspError.make({
        message: P.isError(cause) ? cause.message : `Invalid value for ${headerName}`,
        cause: O.none(),
      }),
  });

const decodeContentSecurityPolicyHeader = Effect.fn("Csp.decodeContentSecurityPolicyHeader")(function* (
  input: ContentSecurityPolicyOption | undefined
): Effect.fn.Return<ContentSecurityPolicyResponseHeaderEncoded, SchemaIssue.Issue> {
  if (P.isUndefined(input) || input === false) {
    return {
      name: headerName,
      value: undefined,
    } as const;
  }

  const value = yield* createContentSecurityPolicyValue(input).pipe(
    Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }))
  );

  if (O.isNone(value)) {
    return yield* Effect.fail(
      new SchemaIssue.InvalidValue({
        message: "Invalid Content-Security-Policy configuration",
      })
    );
  }

  return {
    name: getProperHeaderName(Boolean(input.reportOnly)),
    value: value.value,
  } as const;
});

/**
 * Format a structured CSP option into the serialized header value.
 *
 * **Details**
 *
 * `undefined` and `false` disable output and return `None`. Enabled
 * options concatenate fetch, document, navigation, and reporting directive
 * groups in that order, omitting empty groups.
 *
 * **Example** (Format option or disable)
 *
 * ```ts import.meta.vitest name="Format option or disable"
 * import { ContentSecurityPolicyOptionStruct, createContentSecurityPolicyOptionHeaderValue } from "@beep/schema/Csp"
 *
 * const option = ContentSecurityPolicyOptionStruct.make({
 *   directives: { defaultSrc: "'self'", sandbox: true }
 * })
 *
 * createContentSecurityPolicyOptionHeaderValue(option)._tag // => "Some"
 * createContentSecurityPolicyOptionHeaderValue(false)._tag // => "None"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const createContentSecurityPolicyOptionHeaderValue = (
  option?: undefined | ContentSecurityPolicyOption
): O.Option<string> => {
  if (P.isUndefined(option)) return O.none();
  if (option === false) return O.none();

  const value = pipe(
    A.make(
      FetchDirective.convertToString(option.directives),
      DocumentDirective.convertToString(option.directives),
      NavigationDirective.convertToString(option.directives),
      ReportingDirective.convertToString(option.directives)
    ),
    A.filter(Str.isNonEmpty),
    A.join(directiveValueSeparator)
  );

  return Str.isEmpty(value) ? O.none() : O.some(value);
};

/**
 * One-way schema that decodes CSP options into a response header.
 *
 * **Gotchas**
 *
 * This schema is intentionally one-way: it renders policy options into a
 * response-header model, but encoding a rendered header back into the original
 * option object is forbidden.
 *
 * **Example** (Create report-only response header)
 *
 * ```ts import.meta.vitest name="Create report-only response header"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { ContentSecurityPolicyHeader } from "@beep/schema/Csp"
 *
 * const header = Effect.runSync(ContentSecurityPolicyHeader.create({
 *   directives: { defaultSrc: "'self'" },
 *   reportOnly: true
 * }))
 * const response = O.getOrThrow(header)
 *
 * response.name // => "Content-Security-Policy-Report-Only"
 * O.getOrUndefined(response.value) // => "default-src 'self'"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentSecurityPolicyHeader = S.Union([ContentSecurityPolicyOption, S.Undefined]).pipe(
  S.decodeTo(
    ContentSecurityPolicyResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: decodeContentSecurityPolicyHeader,
      encode: internal.makeHeaderEncodeForbidden("ContentSecurityPolicyHeader"),
    })
  ),
  $I.annoteSchema("ContentSecurityPolicyHeader", {
    description: "A one-way schema that renders Content-Security-Policy options into a response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | ContentSecurityPolicyOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ContentSecurityPolicyOption
    ) {
      if (P.isUndefined(option) || option === false) {
        return O.none<string>();
      }

      const decodedOption = yield* S.decodeEffect(ContentSecurityPolicyOptionStruct)(option).pipe(
        Effect.mapError((cause) =>
          CspError.make({
            message: cause.message,
            cause: O.none(),
          })
        )
      );

      return yield* createContentSecurityPolicyValue(decodedOption);
    });

    const create: (
      option?: undefined | ContentSecurityPolicyOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ContentSecurityPolicyOption,
      headerValueCreator: typeof createValue = createValue
    ) {
      if (P.isUndefined(option) || option === false) {
        return O.none<internal.ResponseHeader>();
      }

      const value = yield* headerValueCreator(option);

      return O.map(value, (headerValue) =>
        internal.ResponseHeader.make({
          name: getProperHeaderName(Boolean(option.reportOnly)),
          value: O.some(headerValue),
        })
      );
    });

    return {
      createValue,
      create,
    };
  })
);

/**
 * Runtime type for {@link ContentSecurityPolicyHeader}.
 *
 * **Example** (Annotate response header type)
 *
 * ```ts import.meta.vitest name="Annotate response header type"
 * import * as O from "effect/Option"
 * import { ContentSecurityPolicyResponseHeader, type ContentSecurityPolicyHeader } from "@beep/schema/Csp"
 *
 * const header: ContentSecurityPolicyHeader = new ContentSecurityPolicyResponseHeader({
 *   name: "Content-Security-Policy",
 *   value: O.some("default-src 'self'")
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContentSecurityPolicyHeader = typeof ContentSecurityPolicyHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { ContentSecurityPolicyResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link ContentSecurityPolicyHeader}.
 *
 * **Example** (Create header via alias)
 *
 * ```ts import.meta.vitest name="Create header via alias"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Header } from "@beep/schema/Csp"
 *
 * const header = Effect.runSync(Header.create({ directives: { scriptSrc: "'self'" } }))
 *
 * O.isSome(header) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = ContentSecurityPolicyHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Annotate header alias type)
 *
 * ```ts import.meta.vitest name="Annotate header alias type"
 * import * as O from "effect/Option"
 * import { ContentSecurityPolicyResponseHeader, type Header } from "@beep/schema/Csp"
 *
 * const header: Header = new ContentSecurityPolicyResponseHeader({
 *   name: "Content-Security-Policy",
 *   value: O.some("default-src 'self'")
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
