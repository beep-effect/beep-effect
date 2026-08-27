/**
 * Schema-owned models used by the OpenAPI-to-Toolkit adapter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import {
  LiteralKit,
  MappedLiteralKit,
  NonEmptyTrimmedStr,
  SchemaUtils,
} from "@beep/schema";
import { O, P, R, pipe } from "@beep/utils";
import {
  HashMap,
  Layer,
  Redacted,
  SchemaGetter,
  type Effect,
} from "effect";
import * as S from "effect/Schema";
import type * as Tool from "effect/unstable/ai/Tool";
import type * as Toolkit from "effect/unstable/ai/Toolkit";
import type * as HttpClient from "effect/unstable/http/HttpClient";
import { ToolError } from "../Codemode.tool-error.ts";

const $I = $ScratchpadId.create("codemode/openapi/OpenAPI.types");

/**
 * An already-decoded OpenAPI 3.x object. YAML and JSON text parsing is the
 * host's job; {@link fromSpec} never accepts a YAML string.
 *
 * **Example** (Decode a minimal document object)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Document } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const document = S.decodeUnknownSync(Document)({
 *   openapi: "3.1.0",
 *   info: { title: "Health", version: "1.0.0" },
 * })
 * console.log(document.openapi)
 * ```
 *
 * @see {@link Options} for the adapter boundary that carries this document.
 * @see {@link fromSpec} for compilation that requires this decoded object.
 * @category schemas
 * @since 0.0.0
 */
export const Document = S.Record(S.String, S.Unknown).pipe(
  S.brand("OpenApiDocument"),
  $I.annoteSchema("Document", {
    description: "A parsed OpenAPI 3.x document. YAML is parsed by the host.",
  })
);

/**
 * Decoded value produced by {@link Document}.
 *
 * @see {@link Document} for the runtime branded record and host-parse contract.
 * @category type-level
 * @since 0.0.0
 */
export type Document = typeof Document.Type;

/**
 * A draft-2020-12 JSON Schema object emitted from OpenAPI and carried on a
 * planned operation.
 *
 * **Example** (Decode a string schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonSchema } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const schema = S.decodeUnknownSync(JsonSchema)({ type: "string" })
 * console.log(schema.type)
 * ```
 *
 * @see {@link InputField} for the field that stores this schema.
 * @category schemas
 * @since 0.0.0
 */
export const JsonSchema = S.Record(S.String, S.Unknown).pipe(
  S.brand("OpenApiJsonSchema"),
  $I.annoteSchema("JsonSchema", {
    description: "A draft-2020-12 JSON Schema object emitted from OpenAPI.",
  })
);

/**
 * Decoded value produced by {@link JsonSchema}.
 *
 * @see {@link JsonSchema} for the runtime branded schema object.
 * @category type-level
 * @since 0.0.0
 */
export type JsonSchema = typeof JsonSchema.Type;

/**
 * A non-empty OpenAPI `operationId` used as a tool-name seed.
 *
 * **Example** (Decode an operationId)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { OperationId } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * console.log(O.getOrThrow(OperationId.decodeOption("getHealth")))
 * console.log(O.isNone(OperationId.decodeOption("")))
 * ```
 *
 * @see {@link Operation} for the operation identity that stores this id.
 * @category schemas
 * @since 0.0.0
 */
export const OperationId = NonEmptyTrimmedStr.pipe(
  S.brand("OpenApiOperationId"),
  SchemaUtils.withCodecStatics,
  $I.annoteSchema("OperationId", {
    description: "A non-empty OpenAPI operationId.",
  })
);

/**
 * Decoded value produced by {@link OperationId}.
 *
 * @see {@link OperationId} for the runtime branded identifier.
 * @category type-level
 * @since 0.0.0
 */
export type OperationId = typeof OperationId.Type;

/**
 * A supported OpenAPI operation method decoded to uppercase HTTP form.
 *
 * **Details**
 *
 * Encoded/OpenAPI spelling is lowercase (`get`). Decoded/HTTP spelling is
 * uppercase (`GET`). {@link fromSpec} uses `HttpMethod.decodeOption` on the
 * path-item key, then `HttpMethod.To.Enum` when synthesizing operationId
 * fallbacks.
 *
 * **Example** (Decode post to POST)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { HttpMethod } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * console.log(O.getOrThrow(HttpMethod.decodeOption("post")))
 * console.log(HttpMethod.To.Enum.POST)
 * ```
 *
 * @see {@link Operation} for where the decoded uppercase spelling is stored.
 * @category schemas
 * @since 0.0.0
 */
export const HttpMethod = MappedLiteralKit([
  ["get", "GET"],
  ["put", "PUT"],
  ["post", "POST"],
  ["delete", "DELETE"],
  ["options", "OPTIONS"],
  ["head", "HEAD"],
  ["patch", "PATCH"],
  ["trace", "TRACE"],
]).pipe(
  SchemaUtils.withStatics((schema) => ({
    decodeOption: S.decodeUnknownOption(schema),
  })),
  $I.annoteSchema("HttpMethod", {
    description: "A supported OpenAPI operation method decoded to uppercase HTTP form.",
  })
);

/**
 * Decoded value produced by {@link HttpMethod}.
 *
 * @see {@link HttpMethod} for the lowercase-to-uppercase codec.
 * @category type-level
 * @since 0.0.0
 */
export type HttpMethod = typeof HttpMethod.Type;

/**
 * An absolute OpenAPI path template beginning with `/`.
 *
 * **Example** (Accept a path template)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ApiPath } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * console.log(O.getOrThrow(ApiPath.decodeOption("/users/{id}")))
 * console.log(O.isNone(ApiPath.decodeOption("users")))
 * ```
 *
 * @see {@link Operation} for the operation that stores this path.
 * @category schemas
 * @since 0.0.0
 */
export const ApiPath = S.String.check(
  S.isPattern(/^\/.*$/u)
).pipe(
  SchemaUtils.withCodecStatics,
  $I.annoteSchema("ApiPath", {
    description: "An absolute OpenAPI path template.",
  })
);

/**
 * Decoded value produced by {@link ApiPath}.
 *
 * @see {@link ApiPath} for the runtime path-template schema.
 * @category type-level
 * @since 0.0.0
 */
export type ApiPath = typeof ApiPath.Type;

/**
 * The operation identity handed to authentication and errors.
 *
 * **Example** (Construct a GET /health operation)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ApiPath, Operation } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const operation = Operation.new(
 *   O.none(),
 *   "GET",
 *   O.getOrThrow(ApiPath.decodeOption("/health")),
 *   O.none(),
 *   O.none(),
 * )
 * console.log(operation.method)
 * console.log(operation.path)
 * ```
 *
 * @see {@link HttpMethod} for the decoded uppercase method stored here.
 * @see {@link Plan} for the execution plan that embeds this operation.
 * @category models
 * @since 0.0.0
 */
export class Operation extends S.Class<Operation>($I`Operation`)(
  {
    operationId: S.OptionFromOptionalKey(OperationId).pipe(
      SchemaUtils.withNoneDefault
    ),
    method: HttpMethod,
    path: ApiPath,
    summary: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault
    ),
    description: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("Operation", {
    description: "The operation identity handed to authentication and errors.",
  })
) {
  static readonly new = (
    operationId: O.Option<OperationId>,
    method: HttpMethod,
    path: ApiPath,
    summary: O.Option<string>,
    description: O.Option<string>
  ): Operation =>
    Operation.make({ operationId, method, path, summary, description });
}

/**
 * An API key carried in an HTTP header. This is the executable header
 * carrier; query and cookie siblings serialize differently.
 *
 * **Example** (Name a header apiKey)
 *
 * ```ts
 * import { ApiKeyHeader } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const carrier = ApiKeyHeader.new("x-api-key")
 * console.log(carrier._tag)
 * console.log(carrier.name)
 * ```
 *
 * @see {@link ApiKeyQuery} for the query-parameter carrier.
 * @see {@link ApiKeyCookie} for the diagnostic-only cookie carrier.
 * @category models
 * @since 0.0.0
 */
export class ApiKeyHeader extends S.TaggedClass<ApiKeyHeader>($I`ApiKeyHeader`)(
  "header",
  { name: NonEmptyTrimmedStr },
  $I.annote("ApiKeyHeader", {
    description: "An API key carried in an HTTP header.",
  })
) {
  static readonly new = (name: string): ApiKeyHeader =>
    ApiKeyHeader.make({ name: NonEmptyTrimmedStr.make(name) });
}

/**
 * An API key carried in a query parameter. Header and cookie siblings use
 * different tags and apply paths.
 *
 * **Example** (Name a query apiKey)
 *
 * ```ts
 * import { ApiKeyQuery } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const carrier = ApiKeyQuery.new("api_key")
 * console.log(carrier._tag)
 * console.log(carrier.name)
 * ```
 *
 * @see {@link ApiKeyHeader} for the executable header carrier.
 * @see {@link ApiKeyCookie} for the diagnostic-only cookie carrier.
 * @category models
 * @since 0.0.0
 */
export class ApiKeyQuery extends S.TaggedClass<ApiKeyQuery>($I`ApiKeyQuery`)(
  "query",
  { name: NonEmptyTrimmedStr },
  $I.annote("ApiKeyQuery", {
    description: "An API key carried in a query parameter.",
  })
) {
  static readonly new = (name: string): ApiKeyQuery =>
    ApiKeyQuery.make({ name: NonEmptyTrimmedStr.make(name) });
}

/**
 * An unsupported cookie-carried API key retained for diagnostics only.
 *
 * **Gotchas**
 *
 * {@link securitySchemes} still constructs this carrier. {@link
 * operationSecurityRequirements} fails with `cookie authentication '…' is not
 * supported` when every alternative needs a cookie. {@link invoke} also fails
 * cookie credentials at apply time. Do not treat this as an executable header.
 *
 * **Example** (Construct a diagnostic cookie carrier)
 *
 * ```ts
 * import { ApiKeyCookie } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const carrier = ApiKeyCookie.new("session")
 * console.log(carrier._tag)
 * console.log(carrier.name)
 * ```
 *
 * @see {@link ApiKeyHeader} for the executable header carrier.
 * @see {@link ApiKeyQuery} for the executable query carrier.
 * @see {@link operationSecurityRequirements} for compile-time cookie rejection.
 * @see {@link invoke} for runtime cookie rejection.
 * @category models
 * @since 0.0.0
 */
export class ApiKeyCookie extends S.TaggedClass<ApiKeyCookie>($I`ApiKeyCookie`)(
  "cookie",
  { name: NonEmptyTrimmedStr },
  $I.annote("ApiKeyCookie", {
    description: "An unsupported cookie-carried API key retained for diagnostics.",
  })
) {
  static readonly new = (name: string): ApiKeyCookie =>
    ApiKeyCookie.make({ name: NonEmptyTrimmedStr.make(name) });
}

/**
 * Tagged union of OpenAPI apiKey carriers, including the diagnostic-only
 * cookie variant.
 *
 * **Example** (Match a header carrier)
 *
 * ```ts
 * import { ApiKeyCarrier, ApiKeyHeader } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const carrier = ApiKeyHeader.new("x-api-key")
 * console.log(ApiKeyCarrier.guards.header(carrier))
 * console.log(carrier._tag)
 * ```
 *
 * @see {@link ApiKeyHeader} for the executable header member.
 * @see {@link ApiKeyCookie} for the diagnostic-only cookie member.
 * @category schemas
 * @since 0.0.0
 */
export const ApiKeyCarrier = S.Union([
  ApiKeyHeader,
  ApiKeyQuery,
  ApiKeyCookie,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ApiKeyCarrier", {
    description: "All OpenAPI apiKey carriers.",
  })
);

/**
 * Decoded value produced by {@link ApiKeyCarrier}.
 *
 * @see {@link ApiKeyCarrier} for the runtime tagged union.
 * @category type-level
 * @since 0.0.0
 */
export type ApiKeyCarrier = typeof ApiKeyCarrier.Type;

/**
 * An OpenAPI apiKey security scheme wrapping one {@link ApiKeyCarrier}.
 *
 * **Example** (Wrap a header carrier)
 *
 * ```ts
 * import { ApiKeyHeader, SecuritySchemeApiKey } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const scheme = SecuritySchemeApiKey.new(ApiKeyHeader.new("x-api-key"))
 * console.log(scheme._tag)
 * console.log(scheme.carrier._tag)
 * ```
 *
 * @see {@link ApiKeyCarrier} for the nested header/query/cookie union.
 * @see {@link SecurityScheme} for the outer scheme union.
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeApiKey extends S.TaggedClass<SecuritySchemeApiKey>(
  $I`SecuritySchemeApiKey`
)(
  "apiKey",
  { carrier: ApiKeyCarrier },
  $I.annote("SecuritySchemeApiKey", {
    description: "An OpenAPI apiKey security scheme.",
  })
) {
  static readonly new = (carrier: ApiKeyCarrier): SecuritySchemeApiKey =>
    SecuritySchemeApiKey.make({ carrier });
}

/**
 * An OpenAPI HTTP authentication scheme such as `bearer` or `basic`.
 *
 * **Example** (Declare a bearer HTTP scheme)
 *
 * ```ts
 * import { SecuritySchemeHttp } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const scheme = SecuritySchemeHttp.new("bearer")
 * console.log(scheme._tag)
 * console.log(scheme.scheme)
 * ```
 *
 * @see {@link CredentialBearer} for the credential resolved for this scheme.
 * @see {@link SecurityScheme} for the outer scheme union.
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeHttp extends S.TaggedClass<SecuritySchemeHttp>(
  $I`SecuritySchemeHttp`
)(
  "http",
  { scheme: NonEmptyTrimmedStr },
  $I.annote("SecuritySchemeHttp", {
    description: "An OpenAPI HTTP authentication scheme.",
  })
) {
  static readonly new = (scheme: string): SecuritySchemeHttp =>
    SecuritySchemeHttp.make({ scheme: NonEmptyTrimmedStr.make(scheme) });
}

/**
 * An OpenAPI OAuth 2 security scheme marker. Flows are not modeled; the host
 * {@link AuthResolver} supplies the credential.
 *
 * **Example** (Construct an OAuth 2 marker)
 *
 * ```ts
 * import { SecuritySchemeOAuth2 } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const scheme = SecuritySchemeOAuth2.new()
 * console.log(scheme._tag)
 * ```
 *
 * @see {@link AuthResolver} for supplying a bearer or header credential at call time.
 * @see {@link SecurityScheme} for the outer scheme union.
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeOAuth2 extends S.TaggedClass<SecuritySchemeOAuth2>(
  $I`SecuritySchemeOAuth2`
)(
  "oauth2",
  {},
  $I.annote("SecuritySchemeOAuth2", {
    description: "An OpenAPI OAuth 2 security scheme.",
  })
) {
  static readonly new = (): SecuritySchemeOAuth2 =>
    SecuritySchemeOAuth2.make({});
}

/**
 * An OpenAPI OpenID Connect security scheme marker. Discovery is not modeled;
 * the host {@link AuthResolver} supplies the credential.
 *
 * **Example** (Construct an OpenID Connect marker)
 *
 * ```ts
 * import { SecuritySchemeOpenIdConnect } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const scheme = SecuritySchemeOpenIdConnect.new()
 * console.log(scheme._tag)
 * ```
 *
 * @see {@link AuthResolver} for supplying a bearer or header credential at call time.
 * @see {@link SecurityScheme} for the outer scheme union.
 * @category models
 * @since 0.0.0
 */
export class SecuritySchemeOpenIdConnect extends S.TaggedClass<SecuritySchemeOpenIdConnect>(
  $I`SecuritySchemeOpenIdConnect`
)(
  "openIdConnect",
  {},
  $I.annote("SecuritySchemeOpenIdConnect", {
    description: "An OpenAPI OpenID Connect security scheme.",
  })
) {
  static readonly new = (): SecuritySchemeOpenIdConnect =>
    SecuritySchemeOpenIdConnect.make({});
}

/**
 * A supported OpenAPI security scheme: apiKey, HTTP, OAuth 2, or OpenID
 * Connect.
 *
 * **Example** (Match an apiKey scheme)
 *
 * ```ts
 * import { ApiKeyHeader, SecurityScheme, SecuritySchemeApiKey } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const scheme = SecuritySchemeApiKey.new(ApiKeyHeader.new("x-api-key"))
 * console.log(SecurityScheme.guards.apiKey(scheme))
 * ```
 *
 * @see {@link SecuritySchemeApiKey} for the apiKey member.
 * @see {@link AuthContext} for the call-time request that carries a scheme.
 * @category schemas
 * @since 0.0.0
 */
export const SecurityScheme = S.Union([
  SecuritySchemeApiKey,
  SecuritySchemeHttp,
  SecuritySchemeOAuth2,
  SecuritySchemeOpenIdConnect,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("SecurityScheme", {
    description: "A supported OpenAPI security scheme.",
  })
);

/**
 * Decoded value produced by {@link SecurityScheme}.
 *
 * @see {@link SecurityScheme} for the runtime tagged union.
 * @category type-level
 * @since 0.0.0
 */
export type SecurityScheme = typeof SecurityScheme.Type;

/**
 * A bearer token credential. The token is {@link Redacted} and applied as an
 * `Authorization: Bearer` header.
 *
 * **Example** (Wrap a bearer token)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import { CredentialBearer } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const credential = CredentialBearer.new("secret-token")
 * console.log(credential._tag)
 * console.log(Redacted.value(credential.token))
 * ```
 *
 * @see {@link Credential} for the union returned by {@link AuthResolver}.
 * @see {@link CredentialBasic} for username/password HTTP Basic.
 * @category models
 * @since 0.0.0
 */
export class CredentialBearer extends S.TaggedClass<CredentialBearer>(
  $I`CredentialBearer`
)(
  "bearer",
  { token: S.Redacted(S.String) },
  $I.annote("CredentialBearer", {
    description: "A bearer token credential.",
  })
) {
  static readonly new = (token: string): CredentialBearer =>
    CredentialBearer.make({ token: Redacted.make(token) });
}

/**
 * A username and password credential applied as `Authorization: Basic`.
 *
 * **Example** (Wrap a basic credential)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import { CredentialBasic } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const credential = CredentialBasic.new("ada", "s3cret")
 * console.log(credential._tag)
 * console.log(Redacted.value(credential.username))
 * ```
 *
 * @see {@link CredentialBearer} for a single redacted bearer token.
 * @see {@link Credential} for the union returned by {@link AuthResolver}.
 * @category models
 * @since 0.0.0
 */
export class CredentialBasic extends S.TaggedClass<CredentialBasic>(
  $I`CredentialBasic`
)(
  "basic",
  {
    username: S.Redacted(S.String),
    password: S.Redacted(S.String),
  },
  $I.annote("CredentialBasic", {
    description: "A username and password credential.",
  })
) {
  static readonly new = (username: string, password: string): CredentialBasic =>
    CredentialBasic.make({
      username: Redacted.make(username),
      password: Redacted.make(password),
    });
}

/**
 * An API key credential applied through the scheme's declared
 * {@link ApiKeyCarrier} (header or query; cookie fails at apply time).
 *
 * **Example** (Wrap an API key value)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import { CredentialApiKey } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const credential = CredentialApiKey.new("key-123")
 * console.log(credential._tag)
 * console.log(Redacted.value(credential.value))
 * ```
 *
 * @see {@link ApiKeyHeader} for the executable header carrier this value is applied to.
 * @see {@link ApiKeyCookie} for the cookie carrier {@link invoke} rejects.
 * @see {@link Credential} for the union returned by {@link AuthResolver}.
 * @category models
 * @since 0.0.0
 */
export class CredentialApiKey extends S.TaggedClass<CredentialApiKey>(
  $I`CredentialApiKey`
)(
  "apiKey",
  { value: S.Redacted(S.String) },
  $I.annote("CredentialApiKey", {
    description: "An API key credential.",
  })
) {
  static readonly new = (value: string): CredentialApiKey =>
    CredentialApiKey.make({ value: Redacted.make(value) });
}

/**
 * A credential carried in an explicit named header, independent of an apiKey
 * scheme's declared carrier.
 *
 * **Example** (Set an explicit header credential)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import { CredentialHeader } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const credential = CredentialHeader.new("x-tenant", "acme")
 * console.log(credential._tag)
 * console.log(credential.name)
 * console.log(Redacted.value(credential.value))
 * ```
 *
 * @see {@link CredentialApiKey} for keys applied through the scheme carrier.
 * @see {@link Credential} for the union returned by {@link AuthResolver}.
 * @category models
 * @since 0.0.0
 */
export class CredentialHeader extends S.TaggedClass<CredentialHeader>(
  $I`CredentialHeader`
)(
  "header",
  {
    name: NonEmptyTrimmedStr,
    value: S.Redacted(S.String),
  },
  $I.annote("CredentialHeader", {
    description: "A credential carried in an explicit header.",
  })
) {
  static readonly new = (name: string, value: string): CredentialHeader =>
    CredentialHeader.make({
      name: NonEmptyTrimmedStr.make(name),
      value: Redacted.make(value),
    });
}

/**
 * Credential material returned by the host {@link AuthResolver}: bearer,
 * basic, apiKey, or an explicit header.
 *
 * **Example** (Match a bearer credential)
 *
 * ```ts
 * import { Credential, CredentialBearer } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const credential = CredentialBearer.new("secret-token")
 * console.log(Credential.guards.bearer(credential))
 * ```
 *
 * @see {@link AuthResolver} for the callback that produces this union.
 * @see {@link CredentialBearer} for the bearer member.
 * @category schemas
 * @since 0.0.0
 */
export const Credential = S.Union([
  CredentialBearer,
  CredentialBasic,
  CredentialApiKey,
  CredentialHeader,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Credential", {
    description: "Credential material returned by the host auth resolver.",
  })
);

/**
 * Decoded value produced by {@link Credential}.
 *
 * @see {@link Credential} for the runtime tagged union.
 * @category type-level
 * @since 0.0.0
 */
export type Credential = typeof Credential.Type;

/**
 * One security scheme requested for an operation, passed to
 * {@link AuthResolver} at call time.
 *
 * **Example** (Build a resolver context)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ApiKeyHeader, ApiPath, AuthContext, Operation, SecuritySchemeApiKey } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const operation = Operation.new(
 *   O.none(),
 *   "GET",
 *   O.getOrThrow(ApiPath.decodeOption("/health")),
 *   O.none(),
 *   O.none(),
 * )
 * const context = AuthContext.new(
 *   "apiKey",
 *   SecuritySchemeApiKey.new(ApiKeyHeader.new("x-api-key")),
 *   [],
 *   operation,
 * )
 * console.log(context.name)
 * ```
 *
 * @see {@link AuthResolver} for the callback that receives this context.
 * @see {@link SecurityScheme} for the definition field.
 * @category models
 * @since 0.0.0
 */
export class AuthContext extends S.Class<AuthContext>($I`AuthContext`)(
  {
    name: NonEmptyTrimmedStr,
    definition: SecurityScheme,
    scopes: S.Array(S.String),
    operation: Operation,
  },
  $I.annote("AuthContext", {
    description: "One security scheme requested for an operation.",
  })
) {
  static readonly new = (
    name: string,
    definition: SecurityScheme,
    scopes: ReadonlyArray<string>,
    operation: Operation
  ): AuthContext =>
    AuthContext.make({
      name: NonEmptyTrimmedStr.make(name),
      definition,
      scopes,
      operation,
    });
}

/**
 * Resolves credentials at call time for one {@link AuthContext}. Returning
 * `Option.none` tries the next OR alternative; failing with {@link ToolError}
 * aborts the call.
 *
 * @see {@link AuthContext} for the scheme, scopes, and operation supplied to the callback.
 * @see {@link AuthConfig} for the options field that stores this resolver.
 * @see {@link invoke} for none-versus-fail handling during execution.
 * @category type-level
 * @since 0.0.0
 */
export type AuthResolver = (
  context: AuthContext
) => Effect.Effect<O.Option<Credential>, ToolError>;

const AuthResolverSchema = S.declare(
  (value: unknown): value is AuthResolver => P.isFunction(value)
);

/**
 * Host-owned credential resolution stored on {@link Options} and {@link Plan}.
 *
 * **Example** (Wrap a resolver that always declines)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { AuthConfig } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const auth = AuthConfig.new(() => Effect.succeed(O.none()))
 * console.log(typeof auth.resolve)
 * ```
 *
 * @see {@link AuthResolver} for the callback type stored in `resolve`.
 * @see {@link Options} for the adapter options that carry this config.
 * @category models
 * @since 0.0.0
 */
export class AuthConfig extends S.Class<AuthConfig>($I`AuthConfig`)(
  { resolve: AuthResolverSchema },
  $I.annote("AuthConfig", {
    description: "Host-owned credential resolution.",
  })
) {
  static readonly new = (resolve: AuthResolver): AuthConfig =>
    AuthConfig.make({ resolve });
}

const StringMap = S.Record(S.String, S.String).pipe(
  S.decodeTo(S.HashMap(S.String, S.String), {
    decode: SchemaGetter.transform(
      (record) => pipe(record, R.toEntries, HashMap.fromIterable)
    ),
    encode: SchemaGetter.transform(
      (map) => pipe(map, HashMap.toEntries, R.fromEntries)
    ),
  }),
  $I.annoteSchema("StringMap", {
    description: "A record boundary transformed into an Effect HashMap.",
  })
);

/**
 * Decoded OpenAPI adapter options with Option and HashMap core values.
 *
 * **Example** (Construct options with a decoded document)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Document, Options } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const spec = S.decodeUnknownSync(Document)({
 *   openapi: "3.1.0",
 *   info: { title: "Health", version: "1.0.0" },
 * })
 * const options = Options.new(spec, "https://api.example.test")
 * console.log(options.baseUrl)
 * ```
 *
 * @see {@link Document} for the already-decoded spec object.
 * @see {@link fromSpec} for the constructor that decodes this at the boundary.
 * @see {@link validateBaseUrl} for the HTTP(S) check applied to `baseUrl`.
 * @category models
 * @since 0.0.0
 */
export class Options extends S.Class<Options>($I`Options`)(
  {
    spec: Document,
    baseUrl: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault
    ),
    auth: S.OptionFromOptionalKey(AuthConfig).pipe(
      SchemaUtils.withNoneDefault
    ),
    headers: StringMap.pipe(
      SchemaUtils.withKeyDefaults(HashMap.empty<string, string>())
    ),
  },
  $I.annote("Options", {
    description: "Decoded OpenAPI adapter options with Option and HashMap core values.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(Options);

  static readonly new = (
    spec: Document,
    baseUrl?: string,
    auth?: AuthConfig,
    headers: Readonly<Record<string, string>> = {}
  ): Options =>
    Options.make({
      spec,
      baseUrl: O.fromNullishOr(baseUrl),
      auth: O.fromNullishOr(auth),
      headers: pipe(headers, R.toEntries, HashMap.fromIterable),
    });
}

/**
 * An operation that could not be represented as a tool and was omitted from
 * the generated Toolkit.
 *
 * **Example** (Record a skipped websocket operation)
 *
 * ```ts
 * import { Skipped } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const skipped = Skipped.new("GET", "/events", "WebSocket operations are not supported")
 * console.log(skipped.method)
 * console.log(skipped.reason)
 * ```
 *
 * @see {@link fromSpec} for the compilation that appends these instead of failing.
 * @see {@link FromSpecResult} for the result field that collects them.
 * @category models
 * @since 0.0.0
 */
export class Skipped extends S.Class<Skipped>($I`Skipped`)(
  {
    method: HttpMethod,
    path: S.String,
    reason: S.String,
  },
  $I.annote("Skipped", {
    description: "An operation that could not be represented as a tool.",
  })
) {
  static readonly new = (
    method: HttpMethod,
    path: string,
    reason: string
  ): Skipped => Skipped.make({ method, path, reason });
}

/**
 * Where one operation input is serialized, including request-body fields.
 *
 * **Example** (Accept body as a location)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InputLocation } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * console.log(S.is(InputLocation)("path"))
 * console.log(S.is(InputLocation)("body"))
 * ```
 *
 * @see {@link ParameterLocation} for the path/query/header subset without body.
 * @see {@link InputField} for the field that stores this location.
 * @see {@link BodyMode} for how a body location is flattened or kept as one value.
 * @category schemas
 * @since 0.0.0
 */
export const InputLocation = LiteralKit([
  "path",
  "query",
  "header",
  "body",
]).pipe(
  $I.annoteSchema("InputLocation", {
    description: "Where one operation input is serialized.",
  })
);

/**
 * Decoded value produced by {@link InputLocation}.
 *
 * @see {@link InputLocation} for the runtime location kit.
 * @category type-level
 * @since 0.0.0
 */
export type InputLocation = typeof InputLocation.Type;

/**
 * Supported OpenAPI parameter serialization styles: `simple`, `form`, and
 * `deepObject`.
 *
 * **Gotchas**
 *
 * OpenAPI `label`, `matrix`, `spaceDelimited`, and `pipeDelimited` are not
 * represented. Specs using those styles will be planned with this subset or
 * skipped without a dedicated reason.
 *
 * **Example** (Accept form and reject matrix)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InputStyle } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * console.log(S.is(InputStyle)("form"))
 * console.log(S.is(InputStyle)("matrix"))
 * ```
 *
 * @see {@link InputLocation} for where a field is serialized.
 * @see {@link ParameterLocation} for path/query/header without body.
 * @see {@link InputField} for the field that stores an optional style.
 * @see {@link BodyMode} for JSON body assembly, which is not a parameter style.
 * @category schemas
 * @since 0.0.0
 */
export const InputStyle = LiteralKit(["simple", "form", "deepObject"]).pipe(
  $I.annoteSchema("InputStyle", {
    description: "Supported OpenAPI parameter serialization styles.",
  })
);

/**
 * Decoded value produced by {@link InputStyle}.
 *
 * @see {@link InputStyle} for the runtime style kit.
 * @category type-level
 * @since 0.0.0
 */
export type InputStyle = typeof InputStyle.Type;

/**
 * One normalized parameter or request-body field, with `inputName` as the
 * model-visible key and `name` as the OpenAPI wire name.
 *
 * **Example** (Construct a required path field)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InputField, JsonSchema } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const field = InputField.new(
 *   "id",
 *   "id",
 *   "path",
 *   true,
 *   S.decodeUnknownSync(JsonSchema)({ type: "string" }),
 *   O.none(),
 *   O.none(),
 * )
 * console.log(field.inputName)
 * console.log(field.location)
 * ```
 *
 * @see {@link operationInput} for how blocked names and collisions rewrite `inputName`.
 * @see {@link InputLocation} for path/query/header/body.
 * @see {@link InputStyle} for the optional serialization style.
 * @category models
 * @since 0.0.0
 */
export class InputField extends S.Class<InputField>($I`InputField`)(
  {
    inputName: NonEmptyTrimmedStr,
    name: NonEmptyTrimmedStr,
    location: InputLocation,
    required: S.Boolean,
    schema: JsonSchema,
    style: S.OptionFromOptionalKey(InputStyle).pipe(
      SchemaUtils.withNoneDefault
    ),
    explode: S.OptionFromOptionalKey(S.Boolean).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("InputField", {
    description: "One normalized parameter or request-body field.",
  })
) {
  static readonly new = (
    inputName: string,
    name: string,
    location: InputLocation,
    required: boolean,
    schema: JsonSchema,
    style: O.Option<InputStyle>,
    explode: O.Option<boolean>
  ): InputField =>
    InputField.make({
      inputName: NonEmptyTrimmedStr.make(inputName),
      name: NonEmptyTrimmedStr.make(name),
      location,
      required,
      schema,
      style,
      explode,
    });
}

/**
 * Whether a JSON body is flattened into fields (`object`) or kept as one
 * value (`value`).
 *
 * **Example** (Select object flattening)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BodyMode } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * console.log(S.is(BodyMode)("object"))
 * console.log(S.is(BodyMode)("value"))
 * ```
 *
 * @see {@link Body} for the plan that stores this mode.
 * @see {@link InputLocation} for the `"body"` field location used with flattening.
 * @see {@link ParameterLocation} for path/query/header, which never use this mode.
 * @category schemas
 * @since 0.0.0
 */
export const BodyMode = LiteralKit(["object", "value"]).pipe(
  $I.annoteSchema("BodyMode", {
    description: "Whether a JSON body is flattened into fields or kept as one value.",
  })
);

/**
 * Decoded value produced by {@link BodyMode}.
 *
 * @see {@link BodyMode} for the runtime object/value kit.
 * @category type-level
 * @since 0.0.0
 */
export type BodyMode = typeof BodyMode.Type;

/**
 * How an operation's JSON request body is assembled, including media type.
 *
 * **Example** (Plan a required JSON object body)
 *
 * ```ts
 * import { Body } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const body = Body.new(true, "object", "application/json")
 * console.log(body.required)
 * console.log(body.mode)
 * ```
 *
 * @see {@link BodyMode} for object versus value assembly.
 * @see {@link OperationInput} for the input that optionally carries this body.
 * @category models
 * @since 0.0.0
 */
export class Body extends S.Class<Body>($I`Body`)(
  {
    required: S.Boolean,
    mode: BodyMode,
    mediaType: NonEmptyTrimmedStr,
  },
  $I.annote("Body", {
    description: "How an operation's JSON request body is assembled.",
  })
) {
  static readonly new = (
    required: boolean,
    mode: BodyMode,
    mediaType: string
  ): Body =>
    Body.make({
      required,
      mode,
      mediaType: NonEmptyTrimmedStr.make(mediaType),
    });
}

/**
 * The normalized model-visible input for one operation: fields plus optional
 * body description.
 *
 * **Example** (Bundle fields without a body)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { InputField, JsonSchema, OperationInput } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const field = InputField.new(
 *   "id",
 *   "id",
 *   "path",
 *   true,
 *   S.decodeUnknownSync(JsonSchema)({ type: "string" }),
 *   O.none(),
 *   O.none(),
 * )
 * const input = OperationInput.new([field], O.none())
 * console.log(input.fields.length)
 * ```
 *
 * @see {@link operationInput} for the planner that produces this model.
 * @see {@link InputField} for each field's `inputName` versus wire `name`.
 * @category models
 * @since 0.0.0
 */
export class OperationInput extends S.Class<OperationInput>(
  $I`OperationInput`
)(
  {
    fields: S.Array(InputField),
    body: S.OptionFromOptionalKey(Body).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OperationInput", {
    description: "The normalized model-visible input for one operation.",
  })
) {
  static readonly new = (
    fields: ReadonlyArray<InputField>,
    body: O.Option<Body>
  ): OperationInput => OperationInput.make({ fields, body });
}

const SecurityScopesMap = S.HashMap(S.String, S.Array(S.String));

/**
 * One AND group inside OpenAPI's OR security alternatives.
 *
 * **Example** (Require a named apiKey scheme)
 *
 * ```ts
 * import { HashMap } from "effect"
 * import { SecurityRequirement } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const requirement = SecurityRequirement.new(HashMap.fromIterable([["apiKey", []]]))
 * console.log(HashMap.has(requirement.schemes, "apiKey"))
 * ```
 *
 * @see {@link securityRequirements} for decoding the OpenAPI array into these groups.
 * @see {@link Plan} for the plan that stores an array of these alternatives.
 * @category models
 * @since 0.0.0
 */
export class SecurityRequirement extends S.Class<SecurityRequirement>(
  $I`SecurityRequirement`
)(
  { schemes: SecurityScopesMap },
  $I.annote("SecurityRequirement", {
    description: "One AND group inside OpenAPI's OR security alternatives.",
  })
) {
  static readonly new = (
    schemes: HashMap.HashMap<string, ReadonlyArray<string>>
  ): SecurityRequirement => SecurityRequirement.make({ schemes });
}

const SecuritySchemeMap = S.HashMap(S.String, SecurityScheme);

/**
 * Everything required to invoke one generated OpenAPI tool through
 * {@link invoke}.
 *
 * **Example** (Plan a GET without authentication)
 *
 * ```ts
 * import { HashMap } from "effect"
 * import * as O from "effect/Option"
 * import { ApiPath, Operation, Plan } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const plan = Plan.new(
 *   Operation.new(O.none(), "GET", O.getOrThrow(ApiPath.decodeOption("/health")), O.none(), O.none()),
 *   "https://api.example.test/health",
 *   [],
 *   O.none(),
 *   [],
 *   HashMap.empty<string, never>(),
 *   O.none(),
 *   HashMap.empty<string, string>(),
 * )
 * console.log(plan.url)
 * console.log(plan.operation.method)
 * ```
 *
 * @see {@link invoke} for HTTP execution of this plan.
 * @see {@link fromSpec} for compilation that builds one plan per generated tool.
 * @see {@link Operation} for the identity embedded here.
 * @category models
 * @since 0.0.0
 */
export class Plan extends S.Class<Plan>($I`Plan`)(
  {
    operation: Operation,
    url: NonEmptyTrimmedStr,
    fields: S.Array(InputField),
    body: S.OptionFromOptionalKey(Body).pipe(SchemaUtils.withNoneDefault),
    security: S.Array(SecurityRequirement),
    schemes: SecuritySchemeMap,
    auth: S.OptionFromOptionalKey(AuthConfig).pipe(
      SchemaUtils.withNoneDefault
    ),
    headers: S.HashMap(S.String, S.String),
  },
  $I.annote("Plan", {
    description: "Everything required to invoke one generated OpenAPI tool.",
  })
) {
  static readonly new = (
    operation: Operation,
    url: string,
    fields: ReadonlyArray<InputField>,
    body: O.Option<Body>,
    security: ReadonlyArray<SecurityRequirement>,
    schemes: HashMap.HashMap<string, SecurityScheme>,
    auth: O.Option<AuthConfig>,
    headers: HashMap.HashMap<string, string>
  ): Plan =>
    Plan.make({
      operation,
      url: NonEmptyTrimmedStr.make(url),
      fields,
      body,
      security,
      schemes,
      auth,
      headers,
    });
}

/**
 * Resolved authentication headers and query parameters ready to attach to a
 * request.
 *
 * **Example** (Start with empty applied auth)
 *
 * ```ts
 * import { HashMap } from "effect"
 * import { AppliedAuth } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const applied = AppliedAuth.new()
 * console.log(HashMap.isEmpty(applied.headers))
 * console.log(HashMap.isEmpty(applied.query))
 * ```
 *
 * @see {@link invoke} for the execution path that produces this from credentials.
 * @see {@link Credential} for the material that fills headers and query.
 * @category models
 * @since 0.0.0
 */
export class AppliedAuth extends S.Class<AppliedAuth>($I`AppliedAuth`)(
  {
    headers: S.HashMap(S.String, S.String),
    query: S.HashMap(S.String, S.String),
  },
  $I.annote("AppliedAuth", {
    description: "Resolved authentication headers and query parameters.",
  })
) {
  static readonly new = (
    headers: HashMap.HashMap<string, string> = HashMap.empty(),
    query: HashMap.HashMap<string, string> = HashMap.empty()
  ): AppliedAuth => AppliedAuth.make({ headers, query });
}

/**
 * The OpenAPI adapter options failed schema decoding. This is the only
 * Effect-channel error from {@link fromSpec}.
 *
 * **Example** (Wrap a decode failure)
 *
 * ```ts
 * import { InvalidOpenApiOptions } from "../../../codemode/openapi/OpenAPI.types.ts"
 *
 * const error = InvalidOpenApiOptions.new({ spec: null })
 * console.log(error._tag)
 * console.log(error.message)
 * ```
 *
 * @see {@link fromSpec} for the constructor that raises this on bad options.
 * @see {@link Options} for the schema whose decode failure is wrapped.
 * @category errors
 * @since 0.0.0
 */
export class InvalidOpenApiOptions extends S.TaggedError<InvalidOpenApiOptions>(
  $I`InvalidOpenApiOptions`
)(
  "InvalidOpenApiOptions",
  {
    message: S.String,
    cause: S.OptionFromOptionalKey(S.Defect()).pipe(
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("InvalidOpenApiOptions", {
    description: "The OpenAPI adapter options failed schema decoding.",
  })
) {
  static readonly new = (cause: unknown): InvalidOpenApiOptions =>
    InvalidOpenApiOptions.make({
      message: "OpenAPI.fromSpec received invalid options.",
      cause: O.some(cause),
    });
}

/**
 * Dynamic Effect AI Toolkit shape emitted by the OpenAPI adapter: a record of
 * generated tools keyed by compiled operation path.
 *
 * @see {@link FromSpecResult} for the result field that carries this toolkit.
 * @see {@link GeneratedHandlersLayer} for the handler layer provided alongside it.
 * @category type-level
 * @since 0.0.0
 */
export type GeneratedToolkit = Toolkit.Toolkit<Record<string, Tool.Any>>;

/**
 * Handler layer emitted alongside {@link GeneratedToolkit}. It requires
 * `HttpClient.HttpClient` and implements each generated tool via {@link invoke}.
 *
 * @see {@link GeneratedToolkit} for the toolkit this layer handles.
 * @see {@link FromSpecResult} for the result field that carries this layer.
 * @see {@link invoke} for the HTTP execution wired into each handler.
 * @category type-level
 * @since 0.0.0
 */
export type GeneratedHandlersLayer = Layer.Layer<
  Tool.HandlersFor<Record<string, Tool.Any>>,
  never,
  HttpClient.HttpClient
>;

const GeneratedToolkitSchema = S.declare(
  (value: unknown): value is GeneratedToolkit =>
    P.isObjectKeyword(value) && P.hasProperty(value, "tools")
);

const GeneratedHandlersLayerSchema = S.declare(
  (value: unknown): value is GeneratedHandlersLayer => Layer.isLayer(value)
);

/**
 * Generated Toolkit, handler Layer, and omitted operations returned by
 * {@link fromSpec}.
 *
 * **Example** (Compile a spec and read skipped operations)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromSpec } from "../../../codemode/openapi/index.ts"
 * import { FromSpecResult } from "../../../codemode/openapi/OpenAPI.types.ts"
 * import * as S from "effect/Schema"
 *
 * const result = await Effect.runPromise(
 *   fromSpec({
 *     spec: {
 *       openapi: "3.1.0",
 *       info: { title: "Health", version: "1.0.0" },
 *       paths: {},
 *     },
 *     baseUrl: "https://api.example.test",
 *   }),
 * )
 * console.log(S.is(FromSpecResult)(result))
 * console.log(result.skipped)
 * ```
 *
 * @see {@link fromSpec} for the constructor that produces this result.
 * @see {@link Skipped} for operations omitted rather than failing the Effect.
 * @see {@link GeneratedToolkit} for the toolkit field type.
 * @category models
 * @since 0.0.0
 */
export class FromSpecResult extends S.Class<FromSpecResult>(
  $I`FromSpecResult`
)(
  {
    toolkit: GeneratedToolkitSchema,
    handlersLayer: GeneratedHandlersLayerSchema,
    skipped: S.Array(Skipped),
  },
  $I.annote("FromSpecResult", {
    description: "Generated Toolkit, handler Layer, and omitted operations.",
  })
) {
  static readonly new = (
    toolkit: GeneratedToolkit,
    handlersLayer: GeneratedHandlersLayer,
    skipped: ReadonlyArray<Skipped>
  ): FromSpecResult =>
    FromSpecResult.make({ toolkit, handlersLayer, skipped });
}
