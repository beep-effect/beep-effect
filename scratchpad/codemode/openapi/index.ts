/**
 * OpenAPI 3.x to Effect AI Toolkit compilation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { A, O, pipe, R, Str, Struct } from "@beep/utils";
import { Effect, HashSet, JsonSchema as JsonSchemaDocument, Result, SchemaRepresentation } from "effect";
import * as S from "effect/Schema";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { HttpClient } from "effect/unstable/http";
import { ToolError } from "../Codemode.tool-error.ts";
import { invoke } from "./OpenAPI.runtime.ts";
import {
  componentDefinitions,
  hasDirectionalSchemas,
  inputSchema,
  isRecord,
  nonEmptyString,
  operationInput,
  operationOutput,
  operationPath,
  operationSecurityRequirements,
  own,
  securityRequirements,
  securitySchemes,
  specServerUrl,
  validateBaseUrl,
} from "./OpenAPI.specification.ts";
import {
  ApiPath,
  type Document,
  FromSpecResult,
  type GeneratedHandlersLayer,
  type GeneratedToolkit,
  HttpMethod,
  InvalidOpenApiOptions,
  type JsonSchema,
  Operation,
  OperationId,
  Options,
  Plan,
  Skipped,
} from "./OpenAPI.types.ts";

export type {
  AuthResolver,
  GeneratedHandlersLayer,
  GeneratedToolkit,
} from "./OpenAPI.types.ts";
export {
  ApiKeyCarrier,
  ApiKeyCookie,
  ApiKeyHeader,
  ApiKeyQuery,
  AppliedAuth,
  AuthConfig,
  AuthContext,
  Body,
  BodyMode,
  Credential,
  CredentialApiKey,
  CredentialBasic,
  CredentialBearer,
  CredentialHeader,
  Document,
  FromSpecResult,
  HttpMethod,
  InputField,
  InputLocation,
  InputStyle,
  InvalidOpenApiOptions,
  JsonSchema,
  Operation,
  OperationId,
  OperationInput,
  Options,
  Plan,
  SecurityRequirement,
  SecurityScheme,
  SecuritySchemeApiKey,
  SecuritySchemeHttp,
  SecuritySchemeOAuth2,
  SecuritySchemeOpenIdConnect,
  Skipped,
} from "./OpenAPI.types.ts";

const $I = $ScratchpadId.create("codemode/openapi");

const UnknownRecord = S.Record(S.String, S.Unknown);

class OperationCandidate extends S.Class<OperationCandidate>($I`OperationCandidate`)(
  {
    sourceMethod: HttpMethod.To,
    method: HttpMethod,
    path: S.String,
    pathItem: UnknownRecord,
    operation: UnknownRecord,
  },
  $I.annote("OperationCandidate", {
    description: "A syntactically supported OpenAPI operation awaiting planning.",
  })
) {
  static readonly new = (
    sourceMethod: typeof HttpMethod.Encoded,
    method: HttpMethod,
    path: string,
    pathItem: Readonly<Record<string, unknown>>,
    operation: Readonly<Record<string, unknown>>
  ): OperationCandidate =>
    OperationCandidate.make({
      sourceMethod,
      method,
      path,
      pathItem,
      operation,
    });
}

const ToolSchema = S.declare((value: unknown): value is Tool.Any => Tool.isDynamic(value));

class GeneratedOperation extends S.Class<GeneratedOperation>($I`GeneratedOperation`)(
  {
    tool: ToolSchema,
    plan: Plan,
  },
  $I.annote("GeneratedOperation", {
    description: "One generated Effect AI tool paired with its HTTP plan.",
  })
) {
  static readonly new = (tool: Tool.Any, plan: Plan): GeneratedOperation => GeneratedOperation.make({ tool, plan });
}

class CompilationState extends S.Class<CompilationState>($I`CompilationState`)(
  {
    used: S.HashSet(S.String),
    namespaces: S.HashSet(S.String),
    generated: S.Array(GeneratedOperation),
    skipped: S.Array(Skipped),
  },
  $I.annote("CompilationState", {
    description: "Immutable state accumulated while compiling OpenAPI operations.",
  })
) {
  static readonly empty = (): CompilationState =>
    CompilationState.make({
      used: HashSet.empty(),
      namespaces: HashSet.empty(),
      generated: A.empty(),
      skipped: A.empty(),
    });

  static readonly skip = (state: CompilationState, candidate: OperationCandidate, reason: string): CompilationState =>
    CompilationState.make({
      ...state,
      skipped: A.append(state.skipped, Skipped.new(candidate.method, candidate.path, reason)),
    });

  static readonly append = (
    state: CompilationState,
    segments: ReadonlyArray<string>,
    generated: GeneratedOperation
  ): CompilationState => {
    const name = pipe(segments, A.join("."));
    const namespaces = pipe(
      A.dropRight(segments, 1),
      A.map((_, index) => pipe(segments, A.take(index + 1), A.join("."))),
      HashSet.fromIterable
    );
    return CompilationState.make({
      used: HashSet.add(state.used, name),
      namespaces: HashSet.union(state.namespaces, namespaces),
      generated: A.append(state.generated, generated),
      skipped: state.skipped,
    });
  };
}

const candidates = (document: Document): ReadonlyArray<OperationCandidate> => {
  const rawPaths = own(document, "paths");
  if (O.isNone(rawPaths) || !isRecord(rawPaths.value)) {
    return A.empty();
  }
  return pipe(
    rawPaths.value,
    R.toEntries,
    A.flatMap(([path, pathValue]) => {
      if (!isRecord(pathValue)) return A.empty();
      return pipe(
        pathValue,
        R.toEntries,
        A.map(([sourceMethod, operationValue]) => {
          const method = HttpMethod.decodeOption(sourceMethod);
          return O.isSome(method) && isRecord(operationValue)
            ? O.some(
                OperationCandidate.new(HttpMethod.To.Enum[method.value], method.value, path, pathValue, operationValue)
              )
            : O.none<OperationCandidate>();
        }),
        A.getSomes
      );
    })
  );
};

const operationFrom = (candidate: OperationCandidate): O.Option<Operation> =>
  pipe(
    ApiPath.decodeOption(candidate.path),
    O.map((path) =>
      Operation.new(
        pipe(own(candidate.operation, "operationId"), O.flatMap(OperationId.decodeOption)),
        candidate.method,
        path,
        pipe(own(candidate.operation, "summary"), O.flatMap(nonEmptyString)),
        pipe(own(candidate.operation, "description"), O.flatMap(nonEmptyString))
      )
    )
  );

const baseUrl = (options: Options, candidate: OperationCandidate): Result.Result<string, string> =>
  pipe(
    options.baseUrl,
    O.match({
      onSome: validateBaseUrl,
      onNone: () =>
        O.isSome(own(candidate.operation, "servers"))
          ? specServerUrl(candidate.operation)
          : O.isSome(own(candidate.pathItem, "servers"))
            ? specServerUrl(candidate.pathItem)
            : specServerUrl(options.spec),
    })
  );

const operationDescription = (operation: Operation): string =>
  pipe(
    operation.description,
    O.orElse(() => operation.summary),
    O.getOrElse(() => `${operation.method} ${operation.path}`)
  );

const compileOutputSchema = (output: O.Option<JsonSchema>): Result.Result<S.Top, string> =>
  O.match(output, {
    onNone: () => Result.succeed(S.Unknown),
    onSome: (schema) =>
      Result.try({
        try: () => SchemaRepresentation.fromJsonSchemaDocument(JsonSchemaDocument.fromSchemaDraft2020_12(schema)),
        catch: () => "response schema could not be imported",
      }),
  });

const compile = (options: Options): CompilationState => {
  const document = options.spec;
  const schemes = securitySchemes(document);
  const defaultSecurity = securityRequirements(pipe(own(document, "security"), O.getOrUndefined));
  const requestDefinitions = componentDefinitions(document, "request");
  const responseDefinitions = hasDirectionalSchemas(document)
    ? componentDefinitions(document, "response")
    : requestDefinitions;

  return A.reduce(candidates(document), CompilationState.empty(), (state, candidate) => {
    const operation = operationFrom(candidate);
    if (O.isNone(operation)) {
      return CompilationState.skip(state, candidate, `path '${candidate.path}' is not a valid OpenAPI path template`);
    }

    const segments = operationPath(
      candidate.sourceMethod,
      candidate.path,
      candidate.operation,
      state.used,
      state.namespaces
    );
    const planned = pipe(
      Result.all({
        baseUrl: baseUrl(options, candidate),
        input: operationInput(document, candidate.pathItem, candidate.operation),
        output: pipe(
          responseDefinitions,
          Result.flatMap((definitions) => operationOutput(document, candidate.operation, definitions)),
          Result.flatMap(compileOutputSchema)
        ),
        requestDefinitions,
        security: operationSecurityRequirements(
          pipe(own(candidate.operation, "security"), O.getOrUndefined),
          defaultSecurity,
          schemes
        ),
      }),
      Result.map(({ baseUrl: resolvedBaseUrl, input, output, requestDefinitions: definitions, security }) => {
        const parameters = inputSchema(input.fields, definitions);
        const plan = Plan.new(
          operation.value,
          `${pipe(resolvedBaseUrl, Str.replace(/\/+$/u, ""))}${candidate.path}`,
          input.fields,
          input.body,
          security,
          schemes,
          options.auth,
          options.headers
        );
        const name = pipe(segments, A.join("."));
        const tool = Tool.dynamic(name, {
          description: operationDescription(operation.value),
          parameters,
          success: output,
          failure: ToolError,
          failureMode: "return",
        });
        return GeneratedOperation.new(tool, plan);
      })
    );

    return Result.match(planned, {
      onFailure: (reason) => CompilationState.skip(state, candidate, reason),
      onSuccess: (generated) => CompilationState.append(state, segments, generated),
    });
  });
};

const makeHandlersLayer = (
  toolkit: GeneratedToolkit,
  generated: ReadonlyArray<GeneratedOperation>
): GeneratedHandlersLayer =>
  toolkit.toLayer(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      return pipe(
        generated,
        A.map(
          ({ plan, tool }) =>
            [
              tool.name,
              (input: unknown) => invoke(plan, input).pipe(Effect.provideService(HttpClient.HttpClient, client)),
            ] as const
        ),
        Struct.fromEntries
      );
    })
  );

/**
 * Decodes raw OpenAPI adapter options, then compiles representable operations
 * into a dynamic Effect AI Toolkit and its handler layer.
 *
 * **Gotchas**
 *
 * A successful Effect still carries {@link FromSpecResult.skipped}: invalid
 * paths, WebSocket/SSE/binary responses, cookie-only security, and bad server
 * URLs are omitted rather than failing compilation. The Effect error channel
 * is only {@link InvalidOpenApiOptions} from options decode. Generated tools
 * use `failureMode: "return"` and surface HTTP failures as {@link ToolError}
 * from {@link invoke}, not as a failed Effect.
 *
 * **Example** (Compile a GET /health document)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromSpec } from "../../../codemode/openapi/index.ts"
 *
 * const result = await Effect.runPromise(
 *   fromSpec({
 *     spec: {
 *       openapi: "3.1.0",
 *       info: { title: "Health", version: "1.0.0" },
 *       paths: {
 *         "/health": {
 *           get: {
 *             operationId: "getHealth",
 *             responses: {
 *               "200": {
 *                 description: "ok",
 *                 content: {
 *                   "application/json": {
 *                     schema: { type: "object", properties: { ok: { type: "boolean" } } },
 *                   },
 *                 },
 *               },
 *             },
 *           },
 *         },
 *       },
 *     },
 *     baseUrl: "https://api.example.test",
 *   })
 * )
 * console.log(Object.keys(result.toolkit.tools))
 * console.log(result.skipped)
 * ```
 *
 * **Example** (Reject invalid adapter options)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { fromSpec } from "../../../codemode/openapi/index.ts"
 *
 * const error = await Effect.runPromise(fromSpec({ spec: null }).pipe(Effect.flip))
 * console.log(error._tag)
 * console.log(error.message)
 * ```
 *
 * @see {@link invoke} for HTTP execution of each generated tool.
 * @see {@link Skipped} for operations omitted from the toolkit.
 * @see {@link Options} for the decoded adapter options including baseUrl.
 * @see {@link InvalidOpenApiOptions} for the only Effect-channel failure.
 * @see {@link operationOutput} for WebSocket/SSE/binary skip reasons.
 * @see {@link FromSpecResult} for toolkit, handlers, and skipped together.
 * @category constructors
 * @since 0.0.0
 */
export const fromSpec = (options: unknown): Effect.Effect<FromSpecResult, InvalidOpenApiOptions> =>
  pipe(
    Options.decodeEffect(options),
    Effect.mapError(InvalidOpenApiOptions.new),
    Effect.map((decoded) => {
      const compiled = compile(decoded);
      const toolkit: GeneratedToolkit = Toolkit.make(
        ...pipe(
          compiled.generated,
          A.map((generated) => generated.tool)
        )
      );
      return FromSpecResult.new(toolkit, makeHandlersLayer(toolkit, compiled.generated), compiled.skipped);
    })
  );
