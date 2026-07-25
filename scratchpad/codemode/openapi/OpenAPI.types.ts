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
  TaggedErrorClass,
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

/** A raw OpenAPI 3.x object after boundary decoding. */
export const Document = S.Record(S.String, S.Unknown).pipe(
  S.brand("OpenApiDocument"),
  $I.annoteSchema("Document", {
    description: "A parsed OpenAPI 3.x document. YAML is parsed by the host.",
  })
);

/** Runtime type for {@link Document}. */
export type Document = typeof Document.Type;

/** A normalized JSON Schema object carried by an operation plan. */
export const JsonSchema = S.Record(S.String, S.Unknown).pipe(
  S.brand("OpenApiJsonSchema"),
  $I.annoteSchema("JsonSchema", {
    description: "A draft-2020-12 JSON Schema object emitted from OpenAPI.",
  })
);

/** Runtime type for {@link JsonSchema}. */
export type JsonSchema = typeof JsonSchema.Type;

/** Optional OpenAPI operation identifier. */
export const OperationId = NonEmptyTrimmedStr.pipe(
  S.brand("OpenApiOperationId"),
  SchemaUtils.withCodecStatics,
  $I.annoteSchema("OperationId", {
    description: "A non-empty OpenAPI operationId.",
  })
);

/** Runtime type for {@link OperationId}. */
export type OperationId = typeof OperationId.Type;

/** OpenAPI method spelling transformed to the HTTP spelling used at runtime. */
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

/** Runtime type for {@link HttpMethod}. */
export type HttpMethod = typeof HttpMethod.Type;

/** API path template beginning with `/`. */
export const ApiPath = S.String.check(
  S.isPattern(/^\/.*$/u)
).pipe(
  SchemaUtils.withCodecStatics,
  $I.annoteSchema("ApiPath", {
    description: "An absolute OpenAPI path template.",
  })
);

/** Runtime type for {@link ApiPath}. */
export type ApiPath = typeof ApiPath.Type;

/** Identity and documentation for one operation. */
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

/** OpenAPI apiKey carrier. */
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

/** OpenAPI apiKey carrier. */
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

/** OpenAPI apiKey carrier. */
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

/** Nested apiKey carrier union. */
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

/** Runtime type for {@link ApiKeyCarrier}. */
export type ApiKeyCarrier = typeof ApiKeyCarrier.Type;

/** OpenAPI apiKey security scheme. */
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

/** OpenAPI HTTP security scheme. */
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

/** OpenAPI OAuth 2 security scheme marker. */
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

/** OpenAPI OpenID Connect security scheme marker. */
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

/** Resolved OpenAPI security scheme. */
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

/** Runtime type for {@link SecurityScheme}. */
export type SecurityScheme = typeof SecurityScheme.Type;

/** Bearer credential. */
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

/** HTTP Basic credential. */
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

/** apiKey credential using the scheme's declared carrier. */
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

/** Explicit nonstandard header credential. */
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

/** Credential returned by the host resolver. */
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

/** Runtime type for {@link Credential}. */
export type Credential = typeof Credential.Type;

/** Input to the host credential resolver. */
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
 * Resolves credentials at call time. `Option.none` tries the next OR
 * alternative; failure aborts the call.
 */
export type AuthResolver = (
  context: AuthContext
) => Effect.Effect<O.Option<Credential>, ToolError>;

const AuthResolverSchema = S.declare(
  (value: unknown): value is AuthResolver => P.isFunction(value)
);

/** Host authentication callback configuration. */
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

/** Raw boundary options accepted by `OpenAPI.fromSpec`. */
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

/** An operation omitted from the generated Toolkit. */
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

/** Supported operation input locations. */
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

/** Runtime type for {@link InputLocation}. */
export type InputLocation = typeof InputLocation.Type;

/** Supported OpenAPI serialization styles. */
export const InputStyle = LiteralKit(["simple", "form", "deepObject"]).pipe(
  $I.annoteSchema("InputStyle", {
    description: "Supported OpenAPI parameter serialization styles.",
  })
);

/** Runtime type for {@link InputStyle}. */
export type InputStyle = typeof InputStyle.Type;

/** One normalized operation input. */
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

/** Request-body projection mode. */
export const BodyMode = LiteralKit(["object", "value"]).pipe(
  $I.annoteSchema("BodyMode", {
    description: "Whether a JSON body is flattened into fields or kept as one value.",
  })
);

/** Runtime type for {@link BodyMode}. */
export type BodyMode = typeof BodyMode.Type;

/** Normalized request-body plan. */
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

/** Normalized fields and optional body description for an operation. */
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

/** One AND-composed OpenAPI security requirement. */
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

/** Execution plan captured by one generated tool handler. */
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

/** Authentication material already assigned to HTTP carriers. */
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

/** Invalid `fromSpec` boundary input. */
export class InvalidOpenApiOptions extends TaggedErrorClass<InvalidOpenApiOptions>(
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

/** Dynamic Toolkit shape emitted by the OpenAPI adapter. */
export type GeneratedToolkit = Toolkit.Toolkit<Record<string, Tool.Any>>;

/** Handler layer emitted alongside {@link GeneratedToolkit}. */
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

/** Result of compiling an OpenAPI document into Effect AI tools. */
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
