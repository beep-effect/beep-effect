/**
 * Typed hosted URLs on the public origin and the lab route helper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PublicSiteId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { PublicOrigin } from "./PublicOrigin.schema.ts";
import { PathRoute, SiteRoute } from "./SiteRoute.schema.ts";

const $I = $PublicSiteId.create("HostedUrl");

const LAB_HOST_SUFFIX = /\.labs\.beep(?:\.localhost)?$/u;

/**
 * **Details**
 *
 * The path is relative to the route: one or more non-empty `/`-separated
 * segments with no whitespace, no backslash, no `?` or `#`, and no `.` or `..`
 * segment, percent-encoded (`%2e`, any case) or not, so a decoded path cannot
 * leave its route after URL parsing or add a query or fragment.
 *
 * **Example** (Validate a nested path)
 *
 * ```ts import.meta.vitest name="Validate a nested path"
 * import { SitePath } from "@beep/public-site/HostedUrl.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(SitePath)("identity/Id") // => true
 * S.is(SitePath)("/identity") // => false
 * S.is(SitePath)("../escape") // => false
 * S.is(SitePath)("page?query") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SitePath = S.String.pipe(
  S.check(S.isPattern(/^(?!(?:\.|%2e){1,2}(?:\/|$))(?!.*\/(?:\.|%2e){1,2}(?:\/|$))[^/\\\s?#]+(?:\/[^/\\\s?#]+)*$/iu)),
  $I.annoteSchema("SitePath", {
    description:
      "A relative path below a reserved route: non-empty segments, no whitespace or backslash, no query or fragment, no plain or percent-encoded dot segments.",
  })
);

/**
 * Relative path string decoded by {@link SitePath}.
 *
 * @category models
 * @since 0.0.0
 */
export type SitePath = typeof SitePath.Type;

/**
 * Schema for any URL on the public origin that `hostedUrl` or `labRoute` can
 * produce.
 *
 * **Example** (Recognize a hosted URL)
 *
 * ```ts import.meta.vitest name="Recognize a hosted URL"
 * import { HostedUrl } from "@beep/public-site/HostedUrl.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(HostedUrl)("https://beep-effect.com/docs") // => true
 * S.is(HostedUrl)("https://beep-effect.com/labs/semantica") // => true
 * S.is(HostedUrl)("https://beep-effect.com/llms.txt/extra") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HostedUrl = S.Union([
  S.TemplateLiteral([PublicOrigin, "/", SiteRoute]),
  S.TemplateLiteral([PublicOrigin, "/", PathRoute, "/", S.String]),
  S.TemplateLiteral([PublicOrigin, "/labs/", S.String]),
]).pipe(
  $I.annoteSchema("HostedUrl", {
    description: "A URL on the public origin under one of the reserved routes.",
  })
);

/**
 * URL string decoded by {@link HostedUrl}.
 *
 * @category models
 * @since 0.0.0
 */
export type HostedUrl = typeof HostedUrl.Type;

/**
 * Schema for a lab label: a lowercase DNS label, branded once validated.
 *
 * **Details**
 *
 * One to 63 characters of `a-z`, `0-9`, and `-`, neither starting nor ending
 * with `-`. Decode dynamic lab names through this schema or
 * {@link LabPortlessName} before passing them to `labRoute`.
 *
 * **Example** (Validate a lab label)
 *
 * ```ts import.meta.vitest name="Validate a lab label"
 * import { LabLabel } from "@beep/public-site/HostedUrl.schema"
 * import * as S from "effect/Schema"
 *
 * S.is(LabLabel)("api-docs") // => true
 * S.is(LabLabel)("-api") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabLabel = S.String.pipe(
  S.check(S.isPattern(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u)),
  S.brand("LabLabel"),
  $I.annoteSchema("LabLabel", {
    description: "A lab name as a lowercase DNS label, the leftmost label of its portless host.",
  })
);

/**
 * Branded label string decoded by {@link LabLabel}.
 *
 * @category models
 * @since 0.0.0
 */
export type LabLabel = typeof LabLabel.Type;

/**
 * **Details**
 *
 * Accepts the portless host `<label>.labs.beep.localhost`, the portless name
 * `<label>.labs.beep` used by lab `dev` scripts, or the bare label. Encoding
 * yields the bare label.
 *
 * **Example** (Strip the portless host suffix)
 *
 * ```ts import.meta.vitest name="Strip the portless host suffix"
 * import { LabPortlessName } from "@beep/public-site/HostedUrl.schema"
 * import * as S from "effect/Schema"
 *
 * S.decodeSync(LabPortlessName)("semantica.labs.beep.localhost") // => "semantica"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabPortlessName = S.String.pipe(
  S.decodeTo(
    LabLabel,
    SchemaTransformation.transform({
      decode: Str.replace(LAB_HOST_SUFFIX, ""),
      encode: identity,
    })
  ),
  $I.annoteSchema("LabPortlessName", {
    description: "A portless lab host or bare lab label, decoded to the lab label.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type LabPortlessName = typeof LabPortlessName.Type;

/**
 * Lab label left after stripping the portless suffix from `Name`.
 *
 * **Example** (Compute a lab label type)
 *
 * ```ts
 * import type { LabLabelOf } from "@beep/public-site/HostedUrl.schema"
 *
 * const label: LabLabelOf<"semantica.labs.beep.localhost"> = "semantica"
 * void label
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LabLabelOf<Name extends string> = Name extends `${infer Label}.labs.beep.localhost`
  ? Label
  : Name extends `${infer Label}.labs.beep`
    ? Label
    : Name;

type CharsOf<Value extends string> = Value extends `${infer Head}${infer Tail}` ? Head | CharsOf<Tail> : never;

type DnsLabelChar = CharsOf<"abcdefghijklmnopqrstuvwxyz0123456789-">;

type DnsLabelChars<Value extends string, Seen extends ReadonlyArray<unknown> = []> = Value extends ""
  ? Seen["length"] extends 0
    ? false
    : true
  : Seen["length"] extends 63
    ? false
    : Value extends `${infer Head}${infer Tail}`
      ? Head extends DnsLabelChar
        ? DnsLabelChars<Tail, [...Seen, Head]>
        : false
      : false;

/**
 * Type-level mirror of {@link LabLabel}: `true` when `Value` is a literal
 * lowercase DNS label.
 *
 * **Details**
 *
 * A non-literal `string` is never a known DNS label; decode it through
 * {@link LabLabel} or {@link LabPortlessName} instead.
 *
 * **Example** (Check a label type)
 *
 * ```ts
 * import type { IsDnsLabel } from "@beep/public-site/HostedUrl.schema"
 *
 * const valid: IsDnsLabel<"api-docs"> = true
 * const invalid: IsDnsLabel<"Api"> = false
 * void [valid, invalid]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IsDnsLabel<Value extends string> = string extends Value
  ? false
  : Value extends `-${string}` | `${string}-`
    ? false
    : DnsLabelChars<Value>;

/**
 * Portless lab names `labRoute` accepts: a branded {@link LabLabel}, or a
 * literal whose stripped label is a DNS label. Anything else is `never`.
 *
 * **Example** (Check a portless name type)
 *
 * ```ts
 * import type { LabPortlessNameInput } from "@beep/public-site/HostedUrl.schema"
 *
 * const name: LabPortlessNameInput<"semantica.labs.beep.localhost"> = "semantica.labs.beep.localhost"
 * void name
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LabPortlessNameInput<Name extends string> = Name extends LabLabel
  ? Name
  : IsDnsLabel<LabLabelOf<Name>> extends true
    ? Name
    : never;

/**
 * Relative path inputs `hostedUrl` accepts: anything except the empty string
 * or a path with a leading `/`.
 *
 * **Example** (Check a nested path type)
 *
 * ```ts
 * import type { SitePathInput } from "@beep/public-site/HostedUrl.schema"
 *
 * const path: SitePathInput<"identity/Id"> = "identity/Id"
 * void path
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SitePathInput<Path extends string> = Path extends "" | `/${string}` ? never : Path;

/**
 * Exact URL type `hostedUrl` returns for `Route` and an optional `Path`.
 *
 * **Example** (Name a hosted URL type)
 *
 * ```ts
 * import type { HostedUrlOf } from "@beep/public-site/HostedUrl.schema"
 *
 * const url: HostedUrlOf<"docs", "identity"> = "https://beep-effect.com/docs/identity"
 * void url
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HostedUrlOf<Route extends SiteRoute, Path extends string | undefined = undefined> = Path extends string
  ? `${PublicOrigin}/${Route}/${Path}`
  : `${PublicOrigin}/${Route}`;

/**
 * Exact URL type `labRoute` returns for a portless lab name.
 *
 * **Example** (Name a lab URL type)
 *
 * ```ts
 * import type { LabUrlOf } from "@beep/public-site/HostedUrl.schema"
 *
 * const url: LabUrlOf<"semantica.labs.beep"> = "https://beep-effect.com/labs/semantica"
 * void url
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LabUrlOf<Name extends string> = `${PublicOrigin}/labs/${LabLabelOf<Name>}`;

/**
 * Build the hosted URL of a reserved route, optionally with a nested path.
 *
 * **Details**
 *
 * The return type is the exact URL template. File routes (`llms.txt`,
 * `sitemap.xml`) and `labs` take no path; use `labRoute` for lab URLs. A
 * literal path may not be empty or start with `/`; decode a dynamic path
 * through {@link SitePath} first. The path is joined verbatim; an explicit
 * `undefined` path yields the bare route URL.
 *
 * **Example** (Build hosted URLs)
 *
 * ```ts import.meta.vitest name="Build hosted URLs"
 * import { hostedUrl } from "@beep/public-site/HostedUrl.schema"
 *
 * hostedUrl("docs") // => "https://beep-effect.com/docs"
 * hostedUrl("docs", "identity/Id") // => "https://beep-effect.com/docs/identity/Id"
 * hostedUrl("llms.txt") // => "https://beep-effect.com/llms.txt"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const hostedUrl = <const Route extends SiteRoute, const Path extends string | undefined = undefined>(
  route: Route,
  ...path: [Route] extends [PathRoute] ? [path?: Path & SitePathInput<Path & string>] : []
): HostedUrlOf<Route, Path> =>
  O.match(O.flatMap(A.head(path), O.fromUndefinedOr), {
    onNone: () => `${PublicOrigin.literal}/${route}`,
    onSome: (nested) => `${PublicOrigin.literal}/${route}/${nested}`,
  }) as HostedUrlOf<Route, Path>;

/**
 * Build the hosted URL of a lab from its portless name.
 *
 * **Details**
 *
 * Strips `.labs.beep.localhost` (or `.labs.beep`). A literal name must leave a
 * lowercase DNS label, checked at the type level; a dynamic name must be
 * decoded through {@link LabPortlessName} (or {@link LabLabel}) first, which
 * validates it by schema and brands the label.
 *
 * **Example** (Route a lab)
 *
 * ```ts import.meta.vitest name="Route a lab"
 * import { labRoute } from "@beep/public-site/HostedUrl.schema"
 *
 * labRoute("api-docs.labs.beep.localhost") // => "https://beep-effect.com/labs/api-docs"
 * labRoute("semantica") // => "https://beep-effect.com/labs/semantica"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const labRoute = <const Name extends string>(portlessName: LabPortlessNameInput<Name>): LabUrlOf<Name> =>
  `${PublicOrigin.literal}/labs/${Str.replace(LAB_HOST_SUFFIX, "")(portlessName)}` as LabUrlOf<Name>;
