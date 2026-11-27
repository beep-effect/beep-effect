/**
 * Typed GitHub GraphQL: named documents whose response schema decides the
 * decoded type, and the error a failed GraphQL call raises.
 *
 * **Details**
 *
 * GraphQL answers differently from REST: a 200 response can still carry
 * failures, and it carries a list of them. `GitHubGraphQLError` keeps every
 * entry and mirrors `GitHubError`'s structural `kind`, while
 * `GraphQLDocument` ties a query to the schema its answer decodes against.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual, identity, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { retryAfterMillisFrom } from "./internal/headers.ts";
import type * as Effect from "effect/Effect";

const $I = $GithubId.create("GraphQL");

/**
 * **Example** (Retain a GitHub error classification)
 *
 * ```ts
 * import { GraphQLErrorEntry } from "@beep/github/GraphQL";
 *
 * const entry = GraphQLErrorEntry.make({ message: "Missing repository", type: "NOT_FOUND" });
 * console.log(entry.type) // NOT_FOUND
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GraphQLErrorEntry extends S.Opaque<GraphQLErrorEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** GitHub's prose. */
    message: S.String.pipe($I.annoteKey("GraphQLErrorEntry.message", { description: "GitHub's prose." })),
    /** GitHub's own classification, e.g. `"NOT_FOUND"` or `"FORBIDDEN"`. */
    type: S.optionalKey(S.String).pipe(
      $I.annoteKey("GraphQLErrorEntry.type", {
        description: 'GitHub\'s own classification, e.g. `"NOT_FOUND"` or `"FORBIDDEN"`.',
      })
    ),
  }).pipe($I.annoteSchema("GraphQLErrorEntry", { description: "One entry from a GraphQL response's `errors` array." }))
) {}

/**
 * **Details**
 *
 * Separate from `GitHubError` because GraphQL genuinely answers differently:
 * a 200 response can still carry failures, and it carries a **list** of them.
 * `errors` carries every entry GitHub reported, in order.
 *
 * **Example** (Classify a missing GraphQL resource)
 *
 * ```ts
 * import { GitHubGraphQLError } from "@beep/github/GraphQL";
 *
 * const error = GitHubGraphQLError.fromThrowable("ownerLogin", {
 *   errors: [{ message: "Missing owner", type: "NOT_FOUND" }],
 * }, 0);
 * console.log(error.kind) // notFound
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitHubGraphQLError extends S.TaggedError<GitHubGraphQLError, { readonly brand: unique symbol }>(
  $I`GitHubGraphQLError`
)(
  "GitHubGraphQLError",
  {
    /**
     * Structural routing, mirroring `GitHubError`'s.
     *
     * **Details**
     *
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
    ]).pipe($I.annoteKey("GitHubGraphQLError.kind", { description: "Structural routing, mirroring `GitHubError`'s." })),
    /** The document's name, e.g. `"linkedIssues"` — never the literal `"graphql"`. */
    operation: S.String.pipe(
      $I.annoteKey("GitHubGraphQLError.operation", {
        description: 'The document\'s name, e.g. `"linkedIssues"` — never the literal `"graphql"`.',
      })
    ),
    /** Human-readable cause, for logs. */
    reason: S.String.pipe(
      $I.annoteKey("GitHubGraphQLError.reason", { description: "Human-readable cause, for logs." })
    ),
    /** Everything GitHub reported, in order. */
    errors: S.Array(GraphQLErrorEntry).pipe(
      $I.annoteKey("GitHubGraphQLError.errors", { description: "Everything GitHub reported, in order." })
    ),
    /** A server-advised delay in milliseconds, read only by the retry schedule. */
    retryAfterMillis: S.optionalKey(S.Int).pipe(
      $I.annoteKey("GitHubGraphQLError.retryAfterMillis", {
        description: "A server-advised delay in milliseconds, read only by the retry schedule.",
      })
    ),
    /** The underlying throwable, when one exists. */
    cause: S.optionalKey(S.Defect()).pipe(
      $I.annoteKey("GitHubGraphQLError.cause", { description: "The underlying throwable, when one exists." })
    ),
  },
  $I.annoteError<GitHubGraphQLError>("GitHubGraphQLError", { description: "A GraphQL call failed." })
) {
  /**
   * Formats the operation and human-readable cause for logs.
   *
   * **Example** (Read a decode failure message)
   *
   * ```ts
   * import { GitHubGraphQLError } from "@beep/github/GraphQL";
   *
   * const error = GitHubGraphQLError.decode("ownerLogin", "Invalid response");
   * console.log(error.message) // ownerLogin failed: Invalid response
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `${this.operation} failed: ${this.reason}`;
  }

  /**
   * Whether retrying could plausibly succeed. Derived, like the REST error's.
   *
   * **Example** (Check a transport failure for retry)
   *
   * ```ts
   * import { GitHubGraphQLError } from "@beep/github/GraphQL";
   *
   * const error = GitHubGraphQLError.fromThrowable("ownerLogin", new Error("Offline"), 0);
   * console.log(error.retryable) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get retryable(): boolean {
    return this.kind === "transport" || this.kind === "rateLimited";
  }

  /**
   * A response arrived but did not match the document's declared schema.
   *
   * **Example** (Build a response decoding failure)
   *
   * ```ts
   * import { GitHubGraphQLError } from "@beep/github/GraphQL";
   *
   * const error = GitHubGraphQLError.decode("ownerLogin", "Invalid response");
   * console.log(error.kind) // decode
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static decode(operation: string, reason: string, cause?: unknown): GitHubGraphQLError {
    return GitHubGraphQLError.make({
      kind: "decode",
      operation,
      reason,
      errors: [],
      ...O.getSomesStruct({ cause: O.fromUndefinedOr(cause) }),
    });
  }

  /**
   * Classify anything the GraphQL transport threw.
   *
   * **Details**
   *
   * octokit surfaces two different failures here: a `GraphqlResponseError`,
   * which is an HTTP 200 whose body carries `errors`, and an ordinary HTTP
   * failure with a `status`. Both arrive as throwables and both are read
   * structurally, for the same reason the REST classifier does it — the error
   * classes live in packages this one does not declare.
   *
   * **Example** (Classify an unauthorized HTTP response)
   *
   * ```ts
   * import { GitHubGraphQLError } from "@beep/github/GraphQL";
   *
   * const error = GitHubGraphQLError.fromThrowable("ownerLogin", { status: 401, message: "Bad credentials" }, 0);
   * console.log(error.kind) // unauthorized
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly fromThrowable: {
    (operation: string, error: unknown, nowMillis: number): GitHubGraphQLError;
    (error: unknown, nowMillis: number): (operation: string) => GitHubGraphQLError;
  } = dual(3, (operation: string, error: unknown, nowMillis: number): GitHubGraphQLError => {
    const record = asRecord(error);
    const entries = readEntries(record?.errors);
    const reason = reasonOf(entries, record, error);
    const retryAfterMillis = retryAfterMillisFrom(headersOf(record), nowMillis);
    return GitHubGraphQLError.make({
      kind: classify(statusOf(record), entries, reason, retryAfterMillis),
      operation,
      reason,
      errors: entries,
      ...O.getSomesStruct({ retryAfterMillis: O.fromUndefinedOr(retryAfterMillis) }),
      cause: error,
    });
  });
}

type GraphQLErrorKind = GitHubGraphQLError["kind"];

const asRecord = (value: unknown): Record<string, unknown> | undefined => (P.isObject(value) ? value : undefined);

const describeThrowable = (value: unknown): string =>
  Result.getOrElse(
    Result.try(() => String(value)),
    () => "Unable to describe GitHub GraphQL failure"
  );

const statusOf = (record: Record<string, unknown> | undefined): number | undefined =>
  P.isNumber(record?.status) ? record.status : undefined;

const headersOf = (record: Record<string, unknown> | undefined): Record<string, unknown> | undefined =>
  asRecord(record?.headers) ?? asRecord(asRecord(record?.response)?.headers);

const messageOf: {
  (record: Record<string, unknown> | undefined, error: unknown): string;
  (error: unknown): (record: Record<string, unknown> | undefined) => string;
} = dual(2, (record: Record<string, unknown> | undefined, error: unknown): string =>
  P.isString(record?.message) ? record.message : describeThrowable(error)
);

const reasonOf: {
  (entries: ReadonlyArray<GraphQLErrorEntry>, record: Record<string, unknown> | undefined, error: unknown): string;
  (record: Record<string, unknown> | undefined, error: unknown): (entries: ReadonlyArray<GraphQLErrorEntry>) => string;
} = dual(
  3,
  (entries: ReadonlyArray<GraphQLErrorEntry>, record: Record<string, unknown> | undefined, error: unknown): string =>
    A.isReadonlyArrayNonEmpty(entries)
      ? pipe(
          entries,
          A.map((entry) => entry.message),
          A.join("; ")
        )
      : messageOf(record, error)
);

const readEntries = (value: unknown): ReadonlyArray<GraphQLErrorEntry> => {
  if (!A.isArray(value)) return [];
  const entries: Array<GraphQLErrorEntry> = [];
  for (const raw of value) {
    const record = asRecord(raw);
    if (record === undefined) continue;
    const message = P.isString(record.message) ? record.message : describeThrowable(raw);
    const type = P.isString(record.type) ? record.type : undefined;
    entries.push(GraphQLErrorEntry.make({ message, ...O.getSomesStruct({ type: O.fromUndefinedOr(type) }) }));
  }
  return entries;
};

const ENTRY_KINDS_BY_PRECEDENCE: ReadonlyArray<readonly [ReadonlyArray<string>, GraphQLErrorKind]> = [
  [["NOT_FOUND"], "notFound"],
  [["FORBIDDEN", "UNAUTHORIZED"], "unauthorized"],
  [["RATE_LIMITED"], "rateLimited"],
];

const entryKind = (entries: ReadonlyArray<GraphQLErrorEntry>): O.Option<GraphQLErrorKind> =>
  pipe(
    ENTRY_KINDS_BY_PRECEDENCE,
    A.findFirst(([types]) => A.some(entries, (entry) => entry.type !== undefined && A.contains(types, entry.type))),
    O.map(([, kind]) => kind)
  );

const isServerFailure = (status: number): boolean => status >= 500;

const statusKind: {
  (status: number, retryAfterMillis: number | undefined): GraphQLErrorKind;
  (retryAfterMillis: number | undefined): (status: number) => GraphQLErrorKind;
} = dual(
  2,
  (status: number, retryAfterMillis: number | undefined): GraphQLErrorKind =>
    Match.value(status).pipe(
      Match.when(404, (): GraphQLErrorKind => "notFound"),
      Match.when(401, (): GraphQLErrorKind => "unauthorized"),
      Match.when(429, (): GraphQLErrorKind => "rateLimited"),
      Match.when(403, (): GraphQLErrorKind => (retryAfterMillis === undefined ? "unauthorized" : "rateLimited")),
      Match.when(isServerFailure, (): GraphQLErrorKind => "transport"),
      Match.orElse((): GraphQLErrorKind => "rejected")
    )
);

const statuslessKind = (entries: ReadonlyArray<GraphQLErrorEntry>): GraphQLErrorKind =>
  A.isReadonlyArrayNonEmpty(entries) ? "rejected" : "transport";

const classify: {
  (
    status: number | undefined,
    entries: ReadonlyArray<GraphQLErrorEntry>,
    reason: string,
    retryAfterMillis: number | undefined
  ): GraphQLErrorKind;
  (
    entries: ReadonlyArray<GraphQLErrorEntry>,
    reason: string,
    retryAfterMillis: number | undefined
  ): (status: number | undefined) => GraphQLErrorKind;
} = dual(
  4,
  (
    status: number | undefined,
    entries: ReadonlyArray<GraphQLErrorEntry>,
    reason: string,
    retryAfterMillis: number | undefined
  ): GraphQLErrorKind => {
    if (Str.includes("already exists")(Str.toLowerCase(reason))) return "alreadyExists";
    return O.getOrElse(entryKind(entries), () =>
      status === undefined ? statuslessKind(entries) : statusKind(status, retryAfterMillis)
    );
  }
);

/**
 * A named GraphQL document, its variables, and how to read its answer.
 *
 * **Details**
 *
 * This is the mechanism that makes `client.graphql` return a **domain value**
 * rather than an `unknown` the caller casts: the response schema ties the
 * query to its decoded type.
 *
 * This package owns the documents its resource services need; a consumer with a
 * domain of its own (GitHub Projects, say) builds its own `GraphQLDocument` and
 * gets the same typing and the same error taxonomy.
 *
 * **Example** (Query an owner login with a typed GraphQL document)
 *
 * ```ts
 * import { GitHubClient } from "@beep/github/GitHubClient";
 * import { GraphQLDocument } from "@beep/github/GraphQL";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const OwnerLogin = GraphQLDocument.make({
 *   name: "ownerLogin",
 *   document: `query ($owner: String!) { repositoryOwner(login: $owner) { login } }`,
 *   response: S.Struct({ repositoryOwner: S.NullOr(S.Struct({ login: S.String })) }),
 * })<{ readonly owner: string }>();
 *
 * const login = Effect.gen(function* () {
 *   const client = yield* GitHubClient;
 *   const data = yield* client.graphql(OwnerLogin, { owner: "effect-ts" });
 *   return data.repositoryOwner?.login;
 * });
 * console.log(Effect.isEffect(login)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GraphQLDocument<A, V extends Record<string, unknown>> {
  /**
   * Names the span and the error's `operation`.
   *
   * **Example** (Read the operation name)
   *
   * ```ts
   * import { GraphQLDocument } from "@beep/github/GraphQL";
   * import * as S from "effect/Schema";
   *
   * const document = GraphQLDocument.make({
   *   name: "ownerLogin",
   *   document: "query { viewer { login } }",
   *   response: S.Struct({ viewer: S.Struct({ login: S.String }) }),
   * })<{ readonly owner: string }>();
   * console.log(document.name) // ownerLogin
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  readonly name: string;
  /**
   * The document text sent to GitHub.
   *
   * **Example** (Read the query text)
   *
   * ```ts
   * import { GraphQLDocument } from "@beep/github/GraphQL";
   * import * as S from "effect/Schema";
   *
   * const document = GraphQLDocument.make({
   *   name: "ownerLogin",
   *   document: "query { viewer { login } }",
   *   response: S.Struct({ viewer: S.Struct({ login: S.String }) }),
   * })<{ readonly owner: string }>();
   * console.log(document.document) // query { viewer { login } }
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  readonly document: string;
  /**
   * Decodes the raw `data` payload into the domain value.
   *
   * **Example** (Decode a viewer login)
   *
   * ```ts
   * import { GraphQLDocument } from "@beep/github/GraphQL";
   * import * as S from "effect/Schema";
   * import * as Effect from "effect/Effect";
   *
   * const document = GraphQLDocument.make({
   *   name: "ownerLogin",
   *   document: "query { viewer { login } }",
   *   response: S.Struct({ viewer: S.Struct({ login: S.String }) }),
   * })<{ readonly owner: string }>();
   * const value = Effect.runSync(document.decode({ viewer: { login: "octocat" } }));
   * console.log(value.viewer.login) // octocat
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  readonly decode: (raw: unknown) => Effect.Effect<A, S.SchemaError>;
  /**
   * Turns the caller's variables into the wire object.
   *
   * **Details**
   *
   * Identity by default. It exists so `V` is genuinely load-bearing: without
   * a member mentioning it, TypeScript's structural typing would make
   * documents with different variable shapes interchangeable and the
   * call-site checking would be decorative.
   *
   * **Example** (Encode owner variables)
   *
   * ```ts
   * import { GraphQLDocument } from "@beep/github/GraphQL";
   * import * as S from "effect/Schema";
   *
   * const document = GraphQLDocument.make({
   *   name: "ownerLogin",
   *   document: "query { viewer { login } }",
   *   response: S.Struct({ viewer: S.Struct({ login: S.String }) }),
   * })<{ readonly owner: string }>();
   * console.log(document.encodeVariables({ owner: "effect-ts" }).owner) // effect-ts
   * ```
   *
   * @category encoding
   * @since 0.0.0
   */
  readonly encodeVariables: (variables: V) => Record<string, unknown>;

  private constructor(
    name: string,
    document: string,
    decode: (raw: unknown) => Effect.Effect<A, S.SchemaError>,
    encodeVariables: (variables: V) => Record<string, unknown>
  ) {
    this.name = name;
    this.document = document;
    this.decode = decode;
    this.encodeVariables = encodeVariables;
  }

  /**
   * Build a document from a response schema.
   *
   * **Details**
   *
   * Curried, because `A` is inferred from `response` while `V` is stated:
   * TypeScript takes explicit type arguments all-or-nothing, so a single call
   * would force the caller to spell out the decoded type as well.
   *
   * **Example** (Build a document with inferred response typing)
   *
   * ```ts
   * import { GraphQLDocument } from "@beep/github/GraphQL";
   * import * as S from "effect/Schema";
   *
   * const document = GraphQLDocument.make({
   *   name: "ownerLogin",
   *   document: "query { viewer { login } }",
   *   response: S.Struct({ viewer: S.Struct({ login: S.String }) }),
   * })<{ readonly owner: string }>();
   * console.log(document.name) // ownerLogin
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static make<A, I>(options: {
    readonly name: string;
    readonly document: string;
    readonly response: S.Codec<A, I>;
  }): <V extends Record<string, unknown>>(
    encodeVariables?: (variables: V) => Record<string, unknown>
  ) => GraphQLDocument<A, V> {
    const decode = S.decodeUnknownEffect(options.response);
    return <V extends Record<string, unknown>>(encodeVariables?: (variables: V) => Record<string, unknown>) =>
      new GraphQLDocument<A, V>(options.name, options.document, decode, encodeVariables ?? identity);
  }
}
