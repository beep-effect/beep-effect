/**
 * Schemas for Next.js custom route configuration objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/Routes.schema");

/**
 * Literal discriminator values supported by Next.js route match predicates.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { RouteHasType } from "@beep/repo-configs/next/models/Routes.schema"
 * const program = S.decodeUnknownEffect(RouteHasType)("header")
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RouteHasType = LiteralKit(["header", "cookie", "query", "host"]).pipe(
  $I.annoteSchema("RouteHasType", {
    description: "Literal discriminator values supported by Next.js route match predicates.",
  })
);

/**
 * Literal discriminator values supported by Next.js route match predicates.
 *
 * @example
 * ```ts
 * import type { RouteHasType } from "@beep/repo-configs/next/models/Routes.schema"
 * const type = "header" satisfies RouteHasType
 * console.log(type)
 * ```
 * @category models
 * @since 0.0.0
 */
export type RouteHasType = typeof RouteHasType.Type;

/**
 * Match predicate used by Next.js rewrites, headers, redirects, and middleware.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { RouteHas } from "@beep/repo-configs/next/models/Routes.schema"
 * const program = S.decodeUnknownEffect(RouteHas)({
 *   type: "header",
 *   key: "x-beep",
 *   value: "1"
 * })
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RouteHas = RouteHasType.toTaggedUnion("type")({
  header: {
    key: S.String,
    value: S.optionalKey(S.String),
  },
  cookie: {
    key: S.String,
    value: S.optionalKey(S.String),
  },
  query: {
    key: S.String,
    value: S.optionalKey(S.String),
  },
  host: {
    key: S.optionalKey(S.Undefined),
    value: S.String,
  },
}).pipe(
  $I.annoteSchema("RouteHas", {
    description: "Match predicate used by Next.js rewrites, headers, redirects, and middleware.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Match predicate used by Next.js rewrites, headers, redirects, and middleware.
 *
 * @example
 * ```ts
 * import type { RouteHas } from "@beep/repo-configs/next/models/Routes.schema"
 * const predicate: RouteHas = { type: "host", value: "example.com" }
 * console.log(predicate)
 * ```
 * @category models
 * @since 0.0.0
 */
export type RouteHas = typeof RouteHas.Type;

const RouteHasList = RouteHas.pipe(S.Array, S.mutable);

const RouteMatchFields = {
  has: S.optionalKey(RouteHasList),
  missing: S.optionalKey(RouteHasList),
};

const RouteBaseFields = {
  source: S.String,
  basePath: S.optionalKey(S.Literal(false)),
  locale: S.optionalKey(S.Literal(false)),
  ...RouteMatchFields,
};

/**
 * HTTP redirect status codes supported by Next.js custom redirects.
 *
 * @example
 * ```ts
 * import { RedirectStatusCodeValue } from "@beep/repo-configs/next/models/Routes.schema"
 * const statusCode = 307 satisfies RedirectStatusCodeValue
 * console.log(statusCode)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const RedirectStatusCodeValue = LiteralKit([301, 302, 303, 307, 308]).pipe(
  $I.annoteSchema("RedirectStatusCodeValue", {
    description: "HTTP redirect status codes supported by Next.js custom redirects.",
  })
);

/**
 * HTTP redirect status codes supported by Next.js custom redirects.
 *
 * @example
 * ```ts
 * import type { RedirectStatusCodeValue } from "@beep/repo-configs/next/models/Routes.schema"
 * const statusCode: RedirectStatusCodeValue = 308
 * console.log(statusCode)
 * ```
 * @category models
 * @since 0.0.0
 */
export type RedirectStatusCodeValue = typeof RedirectStatusCodeValue.Type;

class HeaderEntry extends S.Class<HeaderEntry>($I`HeaderEntry`)(
  {
    key: S.String,
    value: S.String,
  },
  $I.annote("HeaderEntry", {
    description: "Single HTTP response header entry emitted by a Next.js headers route.",
  })
) {}

class RedirectPermanent extends S.Class<RedirectPermanent>($I`RedirectPermanent`)(
  {
    ...RouteBaseFields,
    destination: S.String,
    priority: S.optionalKey(S.Boolean),
    statusCode: S.optionalKey(S.Never),
    permanent: S.Boolean,
  },
  $I.annote("RedirectPermanent", {
    description: "Redirect route configuration that uses the permanent flag.",
  })
) {}

class RedirectStatusCode extends S.Class<RedirectStatusCode>($I`RedirectStatusCode`)(
  {
    ...RouteBaseFields,
    destination: S.String,
    priority: S.optionalKey(S.Boolean),
    statusCode: RedirectStatusCodeValue,
    permanent: S.optionalKey(S.Never),
  },
  $I.annote("RedirectStatusCode", {
    description: "Redirect route configuration that uses an explicit status code.",
  })
) {}

/**
 * Backing class for the exported rewrite route schema.
 *
 * @internal
 */
class RewriteRoute extends S.Class<RewriteRoute>($I`Rewrite`)(
  {
    ...RouteBaseFields,
    destination: S.String,
  },
  $I.annote("Rewrite", {
    description: "User-facing Next.js rewrite route configuration.",
    documentation:
      "Models the public Next.js rewrite fields and omits internal routing fields such as internal and regex.",
  })
) {}

/**
 * Backing class for the exported header route schema.
 *
 * @internal
 */
class HeaderRoute extends S.Class<HeaderRoute>($I`Header`)(
  {
    ...RouteBaseFields,
    headers: HeaderEntry.pipe(S.Array, S.mutable),
  },
  $I.annote("Header", {
    description: "User-facing Next.js response header route configuration.",
    documentation: "Models the public Next.js header fields and omits internal routing fields such as internal.",
  })
) {}

/**
 * Backing class for the exported middleware route schema.
 *
 * @internal
 */
class MiddlewareRoute extends S.Class<MiddlewareRoute>($I`Middleware`)(
  {
    source: S.String,
    locale: S.optionalKey(S.Literal(false)),
    ...RouteMatchFields,
  },
  $I.annote("Middleware", {
    description: "Next.js middleware route matcher configuration.",
  })
) {}

/**
 * User-facing Next.js rewrite route configuration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Rewrite } from "@beep/repo-configs/next/models/Routes.schema"
 * const program = S.decodeUnknownEffect(Rewrite)({
 *   source: "/old",
 *   destination: "/new"
 * })
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Rewrite = RewriteRoute;

/**
 * User-facing Next.js rewrite route configuration.
 *
 * @example
 * ```ts
 * import type { Rewrite } from "@beep/repo-configs/next/models/Routes.schema"
 * const rewrite: Rewrite = { source: "/old", destination: "/new" }
 * console.log(rewrite)
 * ```
 * @category models
 * @since 0.0.0
 */
export type Rewrite = typeof Rewrite.Type;

/**
 * User-facing Next.js response header route configuration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/repo-configs/next/models/Routes.schema"
 * const program = S.decodeUnknownEffect(Header)({
 *   source: "/secure",
 *   headers: [{ key: "x-frame-options", value: "deny" }]
 * })
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Header = HeaderRoute;

/**
 * User-facing Next.js response header route configuration.
 *
 * @example
 * ```ts
 * import type { Header } from "@beep/repo-configs/next/models/Routes.schema"
 * const header: Header = {
 *   source: "/secure",
 *   headers: [{ key: "x-frame-options", value: "deny" }]
 * }
 * console.log(header)
 * ```
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;

/**
 * User-facing Next.js redirect route configuration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Redirect } from "@beep/repo-configs/next/models/Routes.schema"
 * const program = S.decodeUnknownEffect(Redirect)({
 *   source: "/old",
 *   destination: "/new",
 *   permanent: true
 * })
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Redirect = S.Union([RedirectPermanent, RedirectStatusCode]).pipe(
  $I.annoteSchema("Redirect", {
    description: "User-facing Next.js redirect route configuration.",
    documentation: "Models the public Next.js redirect fields and omits internal routing fields such as internal.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * User-facing Next.js redirect route configuration.
 *
 * @example
 * ```ts
 * import type { Redirect } from "@beep/repo-configs/next/models/Routes.schema"
 * const redirect: Redirect = {
 *   source: "/old",
 *   destination: "/new",
 *   statusCode: 307
 * }
 * console.log(redirect)
 * ```
 * @category models
 * @since 0.0.0
 */
export type Redirect = typeof Redirect.Type;

/**
 * Next.js middleware route matcher configuration.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Middleware } from "@beep/repo-configs/next/models/Routes.schema"
 * const program = S.decodeUnknownEffect(Middleware)({
 *   source: "/admin/:path*",
 *   locale: false
 * })
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Middleware = MiddlewareRoute;

/**
 * Next.js middleware route matcher configuration.
 *
 * @example
 * ```ts
 * import type { Middleware } from "@beep/repo-configs/next/models/Routes.schema"
 * const middleware: Middleware = { source: "/admin/:path*", locale: false }
 * console.log(middleware)
 * ```
 * @category models
 * @since 0.0.0
 */
export type Middleware = typeof Middleware.Type;
