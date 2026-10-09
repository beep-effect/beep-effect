import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { retryAfterMillisFrom } from "./internal/headers.ts";

/**
 * One entry from a GraphQL response's `errors` array.
 *
 * @public
 */
export class GraphQLErrorEntry extends S.Class<GraphQLErrorEntry>("GraphQLErrorEntry")({
  /** GitHub's prose. */
  message: S.String,
  /** GitHub's own classification, e.g. `"NOT_FOUND"` or `"FORBIDDEN"`. */
  type: S.optionalKey(S.String),
}) {
}

/**
 * A GraphQL call failed.
 *
 * @remarks
 * Separate from `GitHubError` because GraphQL genuinely answers differently:
 * a 200 response can still carry failures, and it carries a **list** of them.
 * `errors` carries every entry GitHub reported, in order.
 *
 * @public
 */
export class GitHubGraphQLError extends S.TaggedError<GitHubGraphQLError>()("GitHubGraphQLError", {
  /**
   * Structural routing, mirroring `GitHubError`'s.
   *
   * @remarks
   * `"alreadyExists"` exists here for the same reason it exists on the REST
   * error: it lets a caller make a create idempotent without lowercasing the
   * message and grepping it.
   */
  kind: S.Literals([
    "alreadyExists",
    "notFound",
    "rejected",
    "unauthorized",
    "rateLimited",
    "transport",
    "decode",
  ]),
  /** The document's name, e.g. `"linkedIssues"` — never the literal `"graphql"`. */
  operation: S.String,
  /** Human-readable cause, for logs. */
  reason: S.String,
  /** Everything GitHub reported, in order. */
  errors: S.Array(GraphQLErrorEntry),
  /** A server-advised delay in milliseconds, read only by the retry schedule. */
  retryAfterMillis: S.optionalKey(S.Int),
  /** The underlying throwable, when one exists. */
  cause: S.optionalKey(S.Defect()),
}) {
  override get message(): string {
    return `${this.operation} failed: ${this.reason}`;
  }

  /** Whether retrying could plausibly succeed. Derived, like the REST error's. */
  get retryable(): boolean {
    return this.kind === "transport" || this.kind === "rateLimited";
  }

  /** A response arrived but did not match the document's declared schema. */
  static decode(operation: string, reason: string, cause?: unknown): GitHubGraphQLError {
    return GitHubGraphQLError.make({
      kind: "decode",
      operation,
      reason,
      errors: [],
      ...(cause !== undefined ? { cause } : {}),
    });
  }

  /**
   * Classify anything the GraphQL transport threw.
   *
   * @remarks
   * octokit surfaces two different failures here: a `GraphqlResponseError`,
   * which is an HTTP 200 whose body carries `errors`, and an ordinary HTTP
   * failure with a `status`. Both arrive as throwables and both are read
   * structurally, for the same reason the REST classifier does it — the error
   * classes live in packages this one does not declare.
   */
  static fromThrowable(operation: string, error: unknown, nowMillis: number): GitHubGraphQLError {
    const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : undefined;
    const status = typeof record?.status === "number" ? record.status : undefined;
    const headers = asRecord(record?.headers) ?? asRecord(asRecord(record?.response)?.headers);
    const entries = readEntries(record?.errors);
    const reason =
      entries.length > 0
        ? entries.map((entry) => entry.message).join("; ")
        : typeof record?.message === "string"
          ? record.message
          : String(error);
    const retryAfterMillis = retryAfterMillisFrom(headers, nowMillis);
    return GitHubGraphQLError.make({
    kind: classify(status, entries, reason, retryAfterMillis),
    operation,
    reason,
    errors: entries,
    ...(retryAfterMillis !== undefined ? { retryAfterMillis } : {}),
    cause: error,
});
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const readEntries = (value: unknown): ReadonlyArray<GraphQLErrorEntry> => {
  if (!Array.isArray(value)) return [];
  const entries: Array<GraphQLErrorEntry> = [];
  for (const raw of value) {
    const record = asRecord(raw);
    if (record === undefined) continue;
    const message = typeof record.message === "string" ? record.message : String(raw);
    const type = typeof record.type === "string" ? record.type : undefined;
    entries.push(GraphQLErrorEntry.make({ message, ...(type !== undefined ? { type } : {}) }));
  }
  return entries;
};

const classify = (
  status: number | undefined,
  entries: ReadonlyArray<GraphQLErrorEntry>,
  reason: string,
  retryAfterMillis: number | undefined,
): GitHubGraphQLError["kind"] => {
  const lowered = reason.toLowerCase();
  if (
    lowered.includes("already exists") ||
    entries.some((entry) => entry.message.toLowerCase().includes("already exists"))
  ) {
    return "alreadyExists";
  }
  if (entries.some((entry) => entry.type === "NOT_FOUND")) return "notFound";
  if (entries.some((entry) => entry.type === "FORBIDDEN" || entry.type === "UNAUTHORIZED")) return "unauthorized";
  if (entries.some((entry) => entry.type === "RATE_LIMITED")) return "rateLimited";
  if (status === undefined) return entries.length > 0 ? "rejected" : "transport";
  if (status === 404) return "notFound";
  if (status === 401) return "unauthorized";
  if (status === 429) return "rateLimited";
  if (status === 403) return retryAfterMillis !== undefined ? "rateLimited" : "unauthorized";
  if (status >= 500) return "transport";
  return "rejected";
};

/**
 * A named GraphQL document, its variables, and how to read its answer.
 *
 * @remarks
 * This is the mechanism that makes `client.graphql` return a **domain value**
 * rather than an `unknown` the caller casts: the response schema ties the
 * query to its decoded type.
 *
 * This package owns the documents its resource services need; a consumer with a
 * domain of its own (GitHub Projects, say) builds its own `GraphQLDocument` and
 * gets the same typing and the same error taxonomy.
 *
 * @example
 * ```ts
 * import { GitHubClient, GraphQLDocument } from "./index.ts";
 * import { Effect, Schema } from "effect";
 *
 * const OwnerLogin = GraphQLDocument.make({
 *   name: "ownerLogin",
 *   document: `query ($owner: String!) { repositoryOwner(login: $owner) { login } }`,
 *   response: Schema.Struct({ repositoryOwner: Schema.NullOr(Schema.Struct({ login: Schema.String })) }),
 * })<{ readonly owner: string }>();
 *
 * const login = Effect.gen(function* () {
 *   const client = yield* GitHubClient;
 *   const data = yield* client.graphql(OwnerLogin, { owner: "effect-ts" });
 *   return data.repositoryOwner?.login;
 * });
 * ```
 *
 * @public
 */
export class GraphQLDocument<A, V extends Record<string, unknown>> {
  /** Names the span and the error's `operation`. */
  readonly name: string;
  /** The document text sent to GitHub. */
  readonly document: string;
  /** Decodes the raw `data` payload into the domain value. */
  readonly decode: (raw: unknown) => Effect.Effect<A, S.SchemaError>;
  /**
   * Turns the caller's variables into the wire object.
   *
   * @remarks
   * Identity by default. It exists so `V` is genuinely load-bearing: without
   * a member mentioning it, TypeScript's structural typing would make
   * documents with different variable shapes interchangeable and the
   * call-site checking would be decorative.
   */
  readonly encodeVariables: (variables: V) => Record<string, unknown>;

  private constructor(
    /** Names the span and the error's `operation`. */
    name: string,
    /** The document text sent to GitHub. */
    document: string,
    /** Decodes the raw `data` payload into the domain value. */
    decode: (raw: unknown) => Effect.Effect<A, S.SchemaError>,
    /**
     * Turns the caller's variables into the wire object.
     *
     * @remarks
     * Identity by default. It exists so `V` is genuinely load-bearing: without
     * a member mentioning it, TypeScript's structural typing would make
     * documents with different variable shapes interchangeable and the
     * call-site checking would be decorative.
     */
    encodeVariables: (variables: V) => Record<string, unknown>,
  ) {
    this.name = name;
    this.document = document;
    this.decode = decode;
    this.encodeVariables = encodeVariables;
  }

  /**
   * Build a document from a response schema.
   *
   * @remarks
   * Curried, because `A` is inferred from `response` while `V` is stated:
   * TypeScript takes explicit type arguments all-or-nothing, so a single call
   * would force the caller to spell out the decoded type as well.
   */
  static make<A, I>(options: {
    readonly name: string;
    readonly document: string;
    readonly response: S.Codec<A, I>;
  }): <V extends Record<string, unknown>>(
    encodeVariables?: (variables: V) => Record<string, unknown>,
  ) => GraphQLDocument<A, V> {
    const decode = S.decodeUnknownEffect(options.response);
    return <V extends Record<string, unknown>>(encodeVariables?: (variables: V) => Record<string, unknown>) =>
      new GraphQLDocument<A, V>(
        options.name,
        options.document,
        (raw) => decode(raw),
        encodeVariables ?? ((variables) => variables),
      );
  }
}
