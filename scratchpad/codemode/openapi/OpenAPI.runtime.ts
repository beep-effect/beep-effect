/**
 * Effect HTTP execution for schema-planned OpenAPI operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import {
  MappedLiteralKit,
  NonEmptyTrimmedStr,
  NonNegativeInt,
} from "@beep/schema";
import { A, N, O, P, R, Str, Struct, pipe } from "@beep/utils";
import {
  Chunk,
  Effect,
  Encoding,
  HashMap,
  HashSet,
  Redacted,
  Result,
  Stream,
} from "effect";
import * as S from "effect/Schema";
import {
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  Headers,
  type HttpClientResponse,
  type HttpMethod,
} from "effect/unstable/http";
import { ToolError } from "../Codemode.tool-error.ts";
import { isRecord, own } from "./OpenAPI.specification.ts";
import {
  ApiKeyCarrier,
  AppliedAuth,
  AuthContext,
  BodyMode,
  Credential,
  InputStyle,
  type InputField,
  type Plan,
  SecurityScheme,
  type SecurityRequirement,
  type SecurityScheme as SecuritySchemeType,
} from "./OpenAPI.types.ts";

const $I = $ScratchpadId.create("codemode/openapi/OpenAPI.runtime");

const maxErrorBodyChars = 1_024;
const maxResponseBodyBytes = 50 * 1_024 * 1_024;
const decodeJson = S.decodeUnknownOption(S.UnknownFromJsonString);
const encodeJson = S.encodeUnknownOption(S.UnknownFromJsonString);
const decodeNonNegativeInt = S.decodeUnknownOption(NonNegativeInt);

const EncodedPathPunctuation = MappedLiteralKit([
  ["!", "%21"],
  ["'", "%27"],
  ["(", "%28"],
  [")", "%29"],
  ["*", "%2A"],
]);

const encodePathPunctuation = (value: string): string =>
  A.reduce(
    EncodedPathPunctuation.Options,
    value,
    (encoded, punctuation) =>
      pipe(
        encoded,
        Str.replaceAll(
          punctuation,
          EncodedPathPunctuation.Enum[punctuation]
        )
      )
  );

const mediaTypeBase = (mediaType: string): string =>
  pipe(
    mediaType,
    Str.split(";"),
    A.head,
    O.getOrElse(() => ""),
    Str.trim,
    Str.toLowerCase
  );

const isJsonMediaType = (mediaType: string): boolean => {
  const normalized = mediaTypeBase(mediaType);
  return (
    normalized === "application/json" ||
    Str.endsWith(normalized, "+json")
  );
};

const operationLabel = (plan: Plan): string =>
  `${plan.operation.method} ${plan.operation.path}`;

const missingParameter = (
  field: InputField,
  kind: "path" | "required"
): ToolError =>
  ToolError.new(
    kind === "path"
      ? `Missing required path parameter '${field.inputName}'.`
      : `Missing required ${
          field.location === "body"
            ? "body field"
            : `${field.location} parameter`
        } '${field.inputName}'.`
  );

const scalarText = (
  field: InputField,
  value: unknown
): Result.Result<string, ToolError> => {
  if (P.isNull(value)) return Result.succeed("null");
  if (P.isString(value)) return Result.succeed(value);
  if (P.isNumber(value) || P.isBoolean(value)) {
    return Result.succeed(`${value}`);
  }
  return Result.fail(
    ToolError.new(
      `Parameter '${field.inputName}' contains an unsupported nested value.`
    )
  );
};

type StringEncoder = (
  value: string
) => Result.Result<string, ToolError>;

const identityEncoder: StringEncoder = Result.succeed;

const pathEncoder = (
  field: InputField
): StringEncoder =>
  (value) =>
    pipe(
      Result.try({
        try: () => encodeURIComponent(value),
        catch: (cause) =>
          ToolError.new(
            `Path parameter '${field.inputName}' contains malformed text.`,
            cause
          ),
      }),
      Result.map(encodePathPunctuation)
    );

const serializeSimple = (
  field: InputField,
  value: unknown,
  encode: StringEncoder
): Result.Result<string, ToolError> => {
  const scalar = (item: unknown): Result.Result<string, ToolError> =>
    pipe(scalarText(field, item), Result.flatMap(encode));

  if (A.isArray(value)) {
    return pipe(
      value,
      A.map(scalar),
      Result.all,
      Result.map(A.join(","))
    );
  }
  if (!isRecord(value)) return scalar(value);

  return pipe(
    value,
    R.toEntries,
    A.map(([name, item]) =>
      pipe(
        Result.all({
          name: encode(name),
          value: scalar(item),
        }),
        Result.map(({ name: encodedName, value: encodedValue }) =>
          pipe(field.explode, O.contains(true))
            ? A.of(`${encodedName}=${encodedValue}`)
            : A.make(encodedName, encodedValue)
        )
      )
    ),
    Result.all,
    Result.map(A.flatten),
    Result.map(A.join(","))
  );
};

const serializeQuery = (
  field: InputField,
  value: unknown
): Result.Result<ReadonlyArray<readonly [string, string]>, ToolError> => {
  if (
    pipe(
      field.style,
      O.exists((style) =>
        InputStyle.$match(style, {
          deepObject: () => true,
          form: () => false,
          simple: () => false,
        })
      )
    )
  ) {
    if (!isRecord(value)) {
      return Result.fail(
        ToolError.new(
          `Deep-object parameter '${field.inputName}' must be an object.`
        )
      );
    }
    return pipe(
      value,
      R.toEntries,
      A.map(([name, item]) =>
        pipe(
          scalarText(field, item),
          Result.map(
            (rendered) =>
              [`${field.name}[${name}]`, rendered] as const
          )
        )
      ),
      Result.all
    );
  }

  if (A.isArray(value)) {
    if (!pipe(field.explode, O.contains(true))) {
      return pipe(
        serializeSimple(field, value, identityEncoder),
        Result.map((rendered) =>
          A.of([field.name, rendered] as const)
        )
      );
    }
    return pipe(
      value,
      A.map((item) =>
        pipe(
          scalarText(field, item),
          Result.map(
            (rendered) => [field.name, rendered] as const
          )
        )
      ),
      Result.all
    );
  }

  if (isRecord(value) && pipe(field.explode, O.contains(true))) {
    return pipe(
      value,
      R.toEntries,
      A.map(([name, item]) =>
        pipe(
          scalarText(field, item),
          Result.map((rendered) => [name, rendered] as const)
        )
      ),
      Result.all
    );
  }

  return pipe(
    serializeSimple(field, value, identityEncoder),
    Result.map((rendered) =>
      A.of([field.name, rendered] as const)
    )
  );
};

const buildUrl = (
  plan: Plan,
  input: Readonly<Record<string, unknown>>
): Result.Result<string, ToolError> =>
  pipe(
    plan.fields,
    A.filter((field) => field.location === "path"),
    A.reduce(
      Result.succeed(plan.url) as Result.Result<string, ToolError>,
      (url, field) =>
        pipe(
          url,
          Result.flatMap((current) =>
            pipe(
              own(input, field.inputName),
              O.match({
                onNone: () => Result.fail(missingParameter(field, "path")),
                onSome: (value) =>
                  pipe(
                    serializeSimple(field, value, pathEncoder(field)),
                    Result.flatMap((encoded) =>
                      Str.isEmpty(encoded) ||
                      encoded === "." ||
                      encoded === ".."
                        ? Result.fail(
                            ToolError.new(
                              `Invalid path parameter '${field.inputName}'.`
                            )
                          )
                        : Result.succeed(
                            pipe(
                              current,
                              Str.replaceAll(`{${field.name}}`, encoded)
                            )
                          )
                    )
                  ),
              })
            )
          )
        )
    ),
    Result.flatMap((url) =>
      pipe(
        url,
        Str.match(/\{[^{}]+\}/u),
        O.flatMap(A.head),
        O.match({
          onNone: () => Result.succeed(url),
          onSome: (unresolved) =>
            Result.fail(
              ToolError.new(
                `Unresolved path parameter ${unresolved}.`
              )
            ),
        })
      )
    )
  );

const appendQueryFields = (
  plan: Plan,
  input: Readonly<Record<string, unknown>>
): Result.Result<
  ReadonlyArray<readonly [string, string]>,
  ToolError
> =>
  A.reduce(
    plan.fields,
    Result.succeed(
      A.empty<readonly [string, string]>()
    ) as Result.Result<
      ReadonlyArray<readonly [string, string]>,
      ToolError
    >,
    (parameters, field) => {
      if (field.location !== "query") return parameters;
      return pipe(
        parameters,
        Result.flatMap((current) =>
          pipe(
            own(input, field.inputName),
            O.match({
              onNone: () => Result.succeed(current),
              onSome: (value) =>
                pipe(
                  serializeQuery(field, value),
                  Result.map((serialized) =>
                    A.appendAll(current, serialized)
                  )
                ),
            })
          )
        )
      );
    }
  );

const applyHeaderFields = (
  plan: Plan,
  input: Readonly<Record<string, unknown>>,
  request: HttpClientRequest.HttpClientRequest
): Result.Result<HttpClientRequest.HttpClientRequest, ToolError> =>
  A.reduce(
    plan.fields,
    Result.succeed(request) as Result.Result<
      HttpClientRequest.HttpClientRequest,
      ToolError
    >,
    (current, field) => {
      if (field.location !== "header") return current;
      return pipe(
        current,
        Result.flatMap((value) =>
          pipe(
            own(input, field.inputName),
            O.match({
              onNone: () => Result.succeed(value),
              onSome: (item) =>
                pipe(
                  serializeSimple(field, item, identityEncoder),
                  Result.map((serialized) =>
                    HttpClientRequest.setHeader(
                      value,
                      field.name,
                      serialized
                    )
                  )
                ),
            })
          )
        )
      );
    }
  );

const setJsonBody = (
  plan: Plan,
  request: HttpClientRequest.HttpClientRequest,
  value: unknown,
  mediaType: string
): Effect.Effect<HttpClientRequest.HttpClientRequest, ToolError> =>
  HttpClientRequest.bodyJson(request, value).pipe(
    Effect.map((next) =>
      HttpClientRequest.setHeader(next, "content-type", mediaType)
    ),
    Effect.mapError((cause) =>
      ToolError.new(
        `Invalid JSON body for ${operationLabel(plan)}.`,
        cause
      )
    )
  );

const applyBody = (
  plan: Plan,
  input: Readonly<Record<string, unknown>>,
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<HttpClientRequest.HttpClientRequest, ToolError> =>
  O.match(plan.body, {
    onNone: () => Effect.succeed(request),
    onSome: (body) =>
      BodyMode.$match(body.mode, {
        value: () =>
          pipe(
            plan.fields,
            A.findFirst((field) => field.location === "body"),
            O.flatMap((field) => own(input, field.inputName)),
            O.match({
              onNone: () => Effect.succeed(request),
              onSome: (value) =>
                setJsonBody(
                  plan,
                  request,
                  value,
                  body.mediaType
                ),
            })
          ),
        object: () => {
          const entries = pipe(
            plan.fields,
            A.map((field) =>
              field.location === "body"
                ? pipe(
                    own(input, field.inputName),
                    O.map(
                      (value) => [field.name, value] as const
                    )
                  )
                : O.none<readonly [string, unknown]>()
            ),
            A.getSomes
          );
          return !body.required && A.isReadonlyArrayEmpty(entries)
            ? Effect.succeed(request)
            : setJsonBody(
                plan,
                request,
                Struct.fromEntries(entries),
                body.mediaType
              );
        },
      }),
  });

const buildRequest = (
  plan: Plan,
  input: Readonly<Record<string, unknown>>
): Effect.Effect<HttpClientRequest.HttpClientRequest, ToolError> =>
  Effect.gen(function* () {
    const url = yield* Effect.fromResult(buildUrl(plan, input));
    const missing = A.findFirst(
      plan.fields,
      (field) =>
        field.required &&
        field.location !== "path" &&
        O.isNone(own(input, field.inputName))
    );
    if (O.isSome(missing)) {
      return yield* missingParameter(missing.value, "required");
    }

    const method = plan.operation.method as HttpMethod.HttpMethod;
    const initial = HttpClientRequest.make(method)(url);
    const query = yield* Effect.fromResult(
      appendQueryFields(plan, input)
    );
    const withQuery = A.isReadonlyArrayEmpty(query)
      ? initial
      : HttpClientRequest.appendUrlParams(initial, query);
    const withStaticHeaders = HttpClientRequest.setHeaders(
      withQuery,
      pipe(plan.headers, HashMap.toEntries, R.fromEntries)
    );
    const withHeaders = yield* Effect.fromResult(
      applyHeaderFields(plan, input, withStaticHeaders)
    );
    return yield* applyBody(plan, input, withHeaders);
  });

class CredentialBinding extends S.Class<CredentialBinding>(
  $I`CredentialBinding`
)(
  {
    name: NonEmptyTrimmedStr,
    definition: SecurityScheme,
    credential: Credential,
  },
  $I.annote("CredentialBinding", {
    description: "A credential bound to its declared OpenAPI security scheme.",
  })
) {
  static readonly new = (
    name: string,
    definition: SecuritySchemeType,
    credential: Credential
  ): CredentialBinding =>
    CredentialBinding.make({
      name: NonEmptyTrimmedStr.make(name),
      definition,
      credential,
    });
}

class CredentialsAvailable extends S.TaggedClass<CredentialsAvailable>(
  $I`CredentialsAvailable`
)(
  "CredentialsAvailable",
  { bindings: S.Array(CredentialBinding) },
  $I.annote("CredentialsAvailable", {
    description: "Every credential in an AND security requirement resolved.",
  })
) {
  static readonly new = (
    bindings: ReadonlyArray<CredentialBinding>
  ): CredentialsAvailable => CredentialsAvailable.make({ bindings });
}

class CredentialsUnavailable extends S.TaggedClass<CredentialsUnavailable>(
  $I`CredentialsUnavailable`
)(
  "CredentialsUnavailable",
  { names: S.HashSet(S.String) },
  $I.annote("CredentialsUnavailable", {
    description: "One or more credentials in a security requirement were unavailable.",
  })
) {
  static readonly new = (
    names: HashSet.HashSet<string>
  ): CredentialsUnavailable => CredentialsUnavailable.make({ names });
}

const CredentialResolution = S.Union([
  CredentialsAvailable,
  CredentialsUnavailable,
]).pipe(S.toTaggedUnion("_tag"));

type CredentialResolution = typeof CredentialResolution.Type;

const resolveRequirement = (
  plan: Plan,
  requirement: SecurityRequirement
): Effect.Effect<CredentialResolution, ToolError> => {
  const entries = pipe(
    requirement.schemes,
    HashMap.toEntries
  );

  const loop = (
    index: number,
    bindings: ReadonlyArray<CredentialBinding>
  ): Effect.Effect<CredentialResolution, ToolError> => {
    const entry = A.get(entries, index);
    if (O.isNone(entry)) {
      return Effect.succeed(CredentialsAvailable.new(bindings));
    }
    const [name, scopes] = entry.value;
    const definition = HashMap.get(plan.schemes, name);
    if (O.isNone(definition) || O.isNone(plan.auth)) {
      return Effect.succeed(
        CredentialsUnavailable.new(HashSet.make(name))
      );
    }
    return plan.auth.value.resolve(
      AuthContext.new(name, definition.value, scopes, plan.operation)
    ).pipe(
      Effect.mapError((cause) =>
        ToolError.new(
          `${operationLabel(plan)} failed while resolving authentication '${name}'.`,
          cause
        )
      ),
      Effect.flatMap(
        O.match({
          onNone: () =>
            Effect.succeed(
              CredentialsUnavailable.new(HashSet.make(name))
            ),
          onSome: (credential) =>
            loop(
              index + 1,
              A.append(
                bindings,
                CredentialBinding.new(
                  name,
                  definition.value,
                  credential
                )
              )
            ),
        })
      )
    );
  };

  return loop(0, A.empty());
};

const insertCredential = (
  applied: AppliedAuth,
  carrier: "header" | "query",
  name: string,
  value: string
): Result.Result<AppliedAuth, ToolError> => {
  const target =
    carrier === "header" ? applied.headers : applied.query;
  if (HashMap.has(target, name)) {
    return Result.fail(
      ToolError.new(
        `Authentication resolves multiple credentials for ${carrier} '${name}'.`
      )
    );
  }
  return Result.succeed(
    carrier === "header"
      ? AppliedAuth.new(
          HashMap.set(applied.headers, name, value),
          applied.query
        )
      : AppliedAuth.new(
          applied.headers,
          HashMap.set(applied.query, name, value)
        )
  );
};

const applyCredential = (
  applied: AppliedAuth,
  binding: CredentialBinding
): Result.Result<AppliedAuth, ToolError> =>
  Credential.match(binding.credential, {
    bearer: ({ token }) =>
      insertCredential(
        applied,
        "header",
        "authorization",
        `Bearer ${Redacted.value(token)}`
      ),
    basic: ({ username, password }) =>
      insertCredential(
        applied,
        "header",
        "authorization",
        `Basic ${Encoding.encodeBase64(
          `${Redacted.value(username)}:${Redacted.value(password)}`
        )}`
      ),
    header: ({ name, value }) =>
      insertCredential(
        applied,
        "header",
        Str.toLowerCase(name),
        Redacted.value(value)
      ),
    apiKey: ({ value }) =>
      SecurityScheme.match(binding.definition, {
        apiKey: ({ carrier }) =>
          ApiKeyCarrier.match(carrier, {
            header: ({ name }) =>
              insertCredential(
                applied,
                "header",
                Str.toLowerCase(name),
                Redacted.value(value)
              ),
            query: ({ name }) =>
              insertCredential(
                applied,
                "query",
                name,
                Redacted.value(value)
              ),
            cookie: () =>
              Result.fail(
                ToolError.new(
                  `Cookie authentication '${binding.name}' is not supported.`
                )
              ),
          }),
        http: () =>
          Result.fail(
            ToolError.new(
              `Security scheme '${binding.name}' is not an apiKey scheme; resolve a bearer, basic, or header credential for it.`
            )
          ),
        oauth2: () =>
          Result.fail(
            ToolError.new(
              `Security scheme '${binding.name}' is not an apiKey scheme; resolve a bearer, basic, or header credential for it.`
            )
          ),
        openIdConnect: () =>
          Result.fail(
            ToolError.new(
              `Security scheme '${binding.name}' is not an apiKey scheme; resolve a bearer, basic, or header credential for it.`
            )
          ),
      }),
  });

const applyCredentials = (
  bindings: ReadonlyArray<CredentialBinding>
): Result.Result<AppliedAuth, ToolError> =>
  A.reduce(
    bindings,
    Result.succeed(AppliedAuth.new()) as Result.Result<
      AppliedAuth,
      ToolError
    >,
    (applied, binding) =>
      pipe(
        applied,
        Result.flatMap((current) =>
          applyCredential(current, binding)
        )
      )
  );

const resolveAuth = (
  plan: Plan
): Effect.Effect<AppliedAuth, ToolError> => {
  const loop = (
    index: number,
    unavailable: HashSet.HashSet<string>
  ): Effect.Effect<AppliedAuth, ToolError> => {
    const requirement = A.get(plan.security, index);
    if (O.isNone(requirement)) {
      return Effect.fail(
        ToolError.new(
          `${operationLabel(plan)} requires authentication; no credential available for: ${pipe(
            unavailable,
            A.fromIterable,
            A.join(", ")
          )}.`
        )
      );
    }
    if (HashMap.isEmpty(requirement.value.schemes)) {
      return Effect.succeed(AppliedAuth.new());
    }
    return pipe(
      resolveRequirement(plan, requirement.value),
      Effect.flatMap((resolution) =>
        CredentialResolution.match(resolution, {
          CredentialsAvailable: ({ bindings }) =>
            Effect.fromResult(applyCredentials(bindings)),
          CredentialsUnavailable: ({ names }) =>
            loop(
              index + 1,
              HashSet.union(unavailable, names)
            ),
        })
      )
    );
  };

  return A.isReadonlyArrayEmpty(plan.security)
    ? Effect.succeed(AppliedAuth.new())
    : loop(0, HashSet.empty());
};

class ResponseBody extends S.Class<ResponseBody>($I`ResponseBody`)(
  {
    chunks: S.Chunk(S.Uint8Array),
    size: NonNegativeInt,
  },
  $I.annote("ResponseBody", {
    description: "A bounded immutable collection of HTTP response chunks.",
  })
) {
  static readonly empty = (): ResponseBody =>
    ResponseBody.make({
      chunks: Chunk.empty(),
      size: NonNegativeInt.make(0),
    });

  static readonly append = (
    body: ResponseBody,
    chunk: Uint8Array
  ): ResponseBody =>
    ResponseBody.make({
      chunks: Chunk.append(body.chunks, chunk),
      size: NonNegativeInt.make(body.size + chunk.byteLength),
    });
}

const decodeResponseBody = (body: ResponseBody): string => {
  const decoder = new TextDecoder();
  const decoded = Chunk.reduce(
    body.chunks,
    "",
    (text, chunk) =>
      Str.concat(text, decoder.decode(chunk, { stream: true }))
  );
  return Str.concat(decoded, decoder.decode());
};

const readResponseBody = (
  response: HttpClientResponse.HttpClientResponse,
  plan: Plan
): Effect.Effect<string, ToolError> => {
  const declaredSize = pipe(
    Headers.get(response.headers, "content-length"),
    O.flatMap(N.parse),
    O.flatMap(decodeNonNegativeInt)
  );
  if (
    O.isSome(declaredSize) &&
    declaredSize.value > maxResponseBodyBytes
  ) {
    return Effect.fail(
      ToolError.new(
        `${operationLabel(plan)} response exceeds 50 MiB.`
      )
    );
  }

  return response.stream.pipe(
    Stream.runFoldEffect(
      ResponseBody.empty,
      (body, chunk) =>
        body.size + chunk.byteLength > maxResponseBodyBytes
          ? Effect.fail(
              ToolError.new(
                `${operationLabel(plan)} response exceeds 50 MiB.`
              )
            )
          : Effect.succeed(ResponseBody.append(body, chunk))
    ),
    Effect.map(decodeResponseBody),
    Effect.catch((cause) => {
      if (S.is(ToolError)(cause)) return Effect.fail(cause);
      if (
        HttpClientError.isHttpClientError(cause) &&
        P.isTagged("EmptyBodyError")(cause.reason)
      ) {
        return Effect.succeed("");
      }
      return Effect.fail(
        ToolError.new(
          `${operationLabel(plan)} failed while reading the response body.`,
          cause
        )
      );
    })
  );
};

const errorBodySummary = (value: unknown): string => {
  const rendered = P.isString(value)
    ? value
    : pipe(
        encodeJson(value),
        O.getOrElse(() => "")
      );
  if (Str.isEmpty(rendered) || rendered === "null") {
    return "no response body";
  }
  return Str.length(rendered) > maxErrorBodyChars
    ? `${pipe(rendered, Str.slice(0, maxErrorBodyChars))}...`
    : rendered;
};

/**
 * Executes one planned OpenAPI operation through the ambient Effect HTTP
 * client.
 *
 * @category execution
 * @since 0.0.0
 */
export const invoke = (
  plan: Plan,
  input: unknown
): Effect.Effect<unknown, ToolError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const value = isRecord(input)
      ? input
      : R.emptyReadonly<string, unknown>();
    const request = yield* buildRequest(plan, value);
    const auth = yield* resolveAuth(plan);
    const withAuthQuery = HashMap.reduce(
      auth.query,
      request,
      (current, item, name) =>
        HttpClientRequest.setUrlParam(current, name, item)
    );
    const authenticated = HttpClientRequest.setHeaders(
      withAuthQuery,
      pipe(auth.headers, HashMap.toEntries, R.fromEntries)
    );

    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(authenticated).pipe(
      Effect.mapError((cause) =>
        ToolError.new(
          `${operationLabel(plan)} failed: transport error`,
          cause
        )
      )
    );
    const text = yield* readResponseBody(response, plan);
    const contentType = pipe(
      Headers.get(response.headers, "content-type"),
      O.getOrElse(() => "")
    );
    const json = isJsonMediaType(contentType);
    const decoded = Str.isEmpty(text)
      ? O.some<unknown>(null)
      : json
        ? decodeJson(text)
        : O.none();
    const parsed = json
      ? pipe(
          decoded,
          O.getOrElse((): unknown => text)
        )
      : Str.isEmpty(text)
        ? null
        : text;

    if (response.status < 200 || response.status >= 300) {
      return yield* ToolError.new(
        `${operationLabel(plan)} failed with HTTP ${
          response.status
        }: ${errorBodySummary(parsed)}`
      );
    }
    if (json && O.isNone(decoded)) {
      return yield* ToolError.new(
        `${operationLabel(plan)} returned malformed JSON.`
      );
    }
    return parsed;
  });
