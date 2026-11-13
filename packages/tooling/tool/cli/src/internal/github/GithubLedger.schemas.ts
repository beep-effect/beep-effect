/**
 * Schemas of the GitHub budget ledger: labels, persisted rows, readings, the
 * reserve signal, configured identities, rollups and the ledger error.
 *
 * **Details**
 *
 * Every time field that reaches disk or JSON output is
 * `S.DateTimeUtcFromString`, so each `fromJsonString` codec here round-trips.
 * Labels never carry a token, a path or a machine id: an identity label names
 * the bucket owner (`user:<login>`, `app:<id>/<installation>`), and a degraded
 * `token:` label is a 12-hex prefix of the token's SHA-256.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubRateLimitResource, RateLimitOutcome, RateLimitRequestKind } from "@beep/github/Resilience";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { defectDiagnostics, optionalDefectMessage } from "@beep/schema/SchemaUtils/defectDiagnostics";
import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  GithubAppId,
  GithubInstallationId,
  GithubLogin,
  GithubPrivateKeyRef,
  GithubTokenRef,
} from "./GithubIdentity.fields.ts";

const $I = $RepoCliId.create("internal/github/GithubLedger.schemas");

/**
 * The bucket owner a request draws on, never a token.
 *
 * **Details**
 *
 * - `user:<login>`: a user bucket (gh login, configured login or resolved alias).
 * - `app:<appId>/<installationId>`: a GitHub App installation token.
 * - `app:<appId>/<installationId>/jwt`: the App JWT (installation-token mints).
 * - `token:<12 hex>`: a token whose owner is not yet known (degraded).
 * - `anonymous` and `unresolved`.
 *
 * **Example** (Check identity labels)
 *
 * ```ts
 * import { GithubIdentityLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubIdentityLabel)("user:octocat")) // true
 * console.log(S.is(GithubIdentityLabel)("ghp_secret")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubIdentityLabel = S.String.check(
  S.isPattern(
    /^(?:user:[A-Za-z0-9][A-Za-z0-9-]{0,38}|app:\d{1,12}\/\d{1,12}(?:\/jwt)?|token:[0-9a-f]{12}|anonymous|unresolved)$/,
    {
      identifier: "GithubIdentityLabelPattern",
      title: "GitHub identity label",
      description: "user:<login>, app:<id>/<installation>[/jwt], token:<12 hex>, anonymous or unresolved.",
      message: "must be a GitHub identity label",
    }
  )
).pipe(
  S.brand("GithubIdentityLabel"),
  $I.annoteSchema("GithubIdentityLabel", { description: "A non-secret GitHub bucket-owner label." })
);

/**
 * Type of {@link GithubIdentityLabel}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubIdentityLabel = typeof GithubIdentityLabel.Type;

/**
 * The `unresolved` identity label.
 *
 * **Example** (Read the fallback label)
 *
 * ```ts
 * import { UNRESOLVED_IDENTITY } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(UNRESOLVED_IDENTITY) // "unresolved"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const UNRESOLVED_IDENTITY: GithubIdentityLabel = GithubIdentityLabel.make("unresolved");

/**
 * The `anonymous` identity label.
 *
 * **Example** (Read the anonymous label)
 *
 * ```ts
 * import { ANONYMOUS_IDENTITY } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(ANONYMOUS_IDENTITY) // "anonymous"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ANONYMOUS_IDENTITY: GithubIdentityLabel = GithubIdentityLabel.make("anonymous");

/**
 * A short hostname (before the first dot), lowercased. A host label, never a machine id.
 *
 * **Example** (Check a host label)
 *
 * ```ts
 * import { HostLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HostLabel)("host-a")) // true
 * console.log(S.is(HostLabel)("Host.example.com")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HostLabel = S.String.check(
  S.isPattern(/^[a-z0-9][a-z0-9-]{0,62}$/, {
    identifier: "HostLabelPattern",
    title: "Host label",
    description: "A lowercased short hostname.",
    message: "must be a lowercased short hostname",
  })
).pipe(S.brand("HostLabel"), $I.annoteSchema("HostLabel", { description: "A lowercased short hostname." }));

/**
 * Type of {@link HostLabel}.
 *
 * @category models
 * @since 0.0.0
 */
export type HostLabel = typeof HostLabel.Type;

/**
 * Derive the host label from a raw hostname: cut at the first dot and lowercase,
 * or `unknown-host` when the result is not a valid label.
 *
 * **Example** (Shorten a hostname)
 *
 * ```ts
 * import { hostLabelOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(hostLabelOf("Worker-1.tail.example")) // "worker-1"
 * console.log(hostLabelOf("")) // "unknown-host"
 * ```
 *
 * @param hostname - The raw hostname.
 * @returns The host label.
 * @category constructors
 * @since 0.0.0
 */
export const hostLabelOf = (hostname: string): HostLabel =>
  pipe(
    Str.split(Str.trim(hostname), "."),
    A.head,
    O.map(Str.toLowerCase),
    O.flatMap((short) => HostLabel.makeOption(short)),
    O.getOrElse(() => HostLabel.make("unknown-host"))
  );

/**
 * One to three command-tree names of a beep invocation, e.g. `yeet monitor`, or `beep` when none.
 *
 * **Example** (Check command labels)
 *
 * ```ts
 * import { GithubLedgerCommandLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubLedgerCommandLabel)("yeet job wait")) // true
 * console.log(S.is(GithubLedgerCommandLabel)("yeet --until-ready")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubLedgerCommandLabel = S.String.check(
  S.isPattern(/^(?:beep|[a-z][a-z0-9-]{0,31}(?: [a-z][a-z0-9-]{0,31}){0,2})$/, {
    identifier: "GithubLedgerCommandLabelPattern",
    title: "Command label",
    description: "One to three beep command-tree names, or beep.",
    message: "must be one to three command names",
  })
).pipe(
  S.brand("GithubLedgerCommandLabel"),
  $I.annoteSchema("GithubLedgerCommandLabel", { description: "The beep command a GitHub request ran under." })
);

/**
 * Type of {@link GithubLedgerCommandLabel}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubLedgerCommandLabel = typeof GithubLedgerCommandLabel.Type;

/**
 * The `beep` command label, used when no command name is known.
 *
 * **Example** (Read the default command label)
 *
 * ```ts
 * import { DEFAULT_COMMAND_LABEL } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(DEFAULT_COMMAND_LABEL) // "beep"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_COMMAND_LABEL: GithubLedgerCommandLabel = GithubLedgerCommandLabel.make("beep");

/**
 * The first one or two `gh` argv words, e.g. `pr view`, `api graphql`, `api rest`.
 *
 * **Example** (Check a gh subcommand)
 *
 * ```ts
 * import { GhSubcommand } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GhSubcommand)("pr view")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GhSubcommand = S.String.check(
  S.isPattern(/^[a-z][a-z-]{0,31}(?: [a-z][a-z-]{0,31})?$/, {
    identifier: "GhSubcommandPattern",
    title: "gh subcommand",
    description: "The first one or two gh argv words.",
    message: "must be one or two gh command words",
  })
).pipe($I.annoteSchema("GhSubcommand", { description: "The first one or two gh argv words." }));

/**
 * Type of {@link GhSubcommand}.
 *
 * @category models
 * @since 0.0.0
 */
export type GhSubcommand = typeof GhSubcommand.Type;

/**
 * A parameter-free route or GraphQL operation name, after {@link normalizeOperation}.
 *
 * **Example** (Check an operation)
 *
 * ```ts
 * import { GithubOperation } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubOperation)("GET /repos/{owner}/{repo}/pulls")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubOperation = S.String.check(S.isMaxLength(120)).pipe(
  $I.annoteSchema("GithubOperation", { description: "A parameter-free GitHub route or GraphQL operation name." })
);

/**
 * Type of {@link GithubOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubOperation = typeof GithubOperation.Type;

const MAX_OPERATION_SEGMENTS = 8;
const NAMED_SEGMENT_PARENTS: ReadonlyArray<string> = [
  "branches",
  "refs",
  "heads",
  "tags",
  "environments",
  "secrets",
  "variables",
  "labels",
];
const isPlaceholder = (segment: string): boolean => Str.startsWith("{")(segment) && Str.endsWith("}")(segment);
const isDigits = (segment: string): boolean => /^\d+$/.test(segment);
const isSha = (segment: string): boolean => /^[0-9a-f]{7,40}$/.test(segment);

type SegmentRule = readonly [
  matches: (segment: string, previous: string, beforePrevious: string) => boolean,
  placeholder: string,
];

// First match wins; a segment no rule matches stays as it is.
const SEGMENT_RULES: ReadonlyArray<SegmentRule> = [
  [(_, previous) => previous === "repos", "{owner}"],
  [(_, __, beforePrevious) => beforePrevious === "repos", "{repo}"],
  [(_, previous) => previous === "users", "{user}"],
  [(_, previous) => previous === "orgs", "{org}"],
  [(_, previous) => A.contains(NAMED_SEGMENT_PARENTS, previous), "{name}"],
  [isDigits, "{id}"],
  [isSha, "{sha}"],
];

const normalizeSegment = (segments: ReadonlyArray<string>) => (segment: string, index: number) => {
  if (isPlaceholder(segment)) return segment;
  const previous = O.getOrElse(A.get(segments, index - 1), () => "");
  const beforePrevious = O.getOrElse(A.get(segments, index - 2), () => "");
  return O.match(
    A.findFirst(SEGMENT_RULES, ([matches]) => matches(segment, previous, beforePrevious)),
    { onNone: () => segment, onSome: ([, placeholder]) => placeholder }
  );
};

/**
 * Remove parameters from a route so the operation dimension stays bounded.
 *
 * **Details**
 *
 * `METHOD /path?query` drops the query; owner/repo, user and org segments,
 * numeric ids, 7–40 hex SHAs and the segment after `branches`, `refs`, `heads`,
 * `tags`, `environments`, `secrets`, `variables` or `labels` become
 * placeholders. Past eight segments the rest becomes `…`, and the result is cut
 * to 120 characters. Anything that is not `METHOD /path` (a GraphQL operation
 * name) passes through, cut to 120 characters.
 *
 * **Example** (Normalise a concrete route)
 *
 * ```ts
 * import { normalizeOperation } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(normalizeOperation("GET /repos/o/r/actions/runs/123456/jobs?page=2"))
 * // "GET /repos/{owner}/{repo}/actions/runs/{id}/jobs"
 * ```
 *
 * @param raw - The operation as the caller passed it.
 * @returns The normalised operation.
 * @category utilities
 * @since 0.0.0
 */
export const normalizeOperation = (raw: string): GithubOperation => {
  const trimmed = Str.trim(raw);
  const routed = Str.match(/^[A-Z]+ \/\S*$/)(trimmed);
  const normalized = O.match(routed, {
    onNone: () => trimmed,
    // The route pattern admits exactly one space, so the split is `[method, path]`.
    onSome: () => {
      const [method, ...route] = Str.split(trimmed, " ");
      const path = A.headNonEmpty(Str.split(A.join(route, " "), "?"));
      const segments = A.filter(Str.split(path, "/"), Str.isNonEmpty);
      const mapped = A.map(segments, normalizeSegment(segments));
      const bounded =
        A.length(mapped) > MAX_OPERATION_SEGMENTS ? A.append(A.take(mapped, MAX_OPERATION_SEGMENTS), "…") : mapped;
      return `${method} /${A.join(bounded, "/")}`;
    },
  });
  return Str.slice(0, 120)(normalized);
};

/**
 * One rate-limit bucket: an identity and the resource it spends.
 *
 * **Example** (Build a bucket key)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, bucketKeyString } from "@beep/repo-cli/test/SharedInternals"
 *
 * const key = BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "graphql" })
 * console.log(bucketKeyString(key)) // "user:octocat|graphql"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BucketKey extends S.Opaque<BucketKey, { readonly brand: unique symbol }>()(
  S.Struct({ identity: GithubIdentityLabel, resource: GitHubRateLimitResource }).pipe(
    $I.annoteSchema("BucketKey", { description: "One GitHub rate-limit bucket: an identity and its resource." })
  )
) {}

/**
 * The `HashMap` key of a bucket.
 *
 * **Example** (Key a bucket)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, bucketKeyString } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(bucketKeyString(BucketKey.make({ identity: GithubIdentityLabel.make("anonymous"), resource: "core" })))
 * // "anonymous|core"
 * ```
 *
 * @param key - The bucket.
 * @returns `identity|resource`.
 * @category utilities
 * @since 0.0.0
 */
export const bucketKeyString = (key: BucketKey): string => `${key.identity}|${key.resource}`;

/**
 * The file-name form of a label: `:` and `/` become `_`.
 *
 * **Example** (Key a file by identity)
 *
 * ```ts
 * import { fileKeyOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(fileKeyOf("app:1/2/jwt")) // "app_1_2_jwt"
 * ```
 *
 * @param label - A label.
 * @returns The label, safe in a file name.
 * @category utilities
 * @since 0.0.0
 */
export const fileKeyOf = (label: string): string => Str.replaceAll(/[:/]/g, "_")(label);

/**
 * Where a ledger row came from: the kebab-case of its `_tag`.
 *
 * **Example** (List the row sources)
 *
 * ```ts
 * import { GithubLedgerSource } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubLedgerSource.literals) // ["transport", "gh-spawn", "sample", "calibration"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubLedgerSource = LiteralKit(["transport", "gh-spawn", "sample", "calibration"]).pipe(
  $I.annoteSchema("GithubLedgerSource", { description: "Where a ledger row came from." })
);

/**
 * Type of {@link GithubLedgerSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubLedgerSource = typeof GithubLedgerSource.Type;

/**
 * What triggered a `/rate_limit` sample.
 *
 * **Example** (List the triggers)
 *
 * ```ts
 * import { SampleTrigger } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(SampleTrigger.literals) // ["timer", "manual", "monitor", "monitor-pause"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SampleTrigger = LiteralKit(["timer", "manual", "monitor", "monitor-pause"]).pipe(
  $I.annoteSchema("SampleTrigger", { description: "What triggered a /rate_limit sample." })
);

/**
 * Type of {@link SampleTrigger}.
 *
 * @category models
 * @since 0.0.0
 */
export type SampleTrigger = typeof SampleTrigger.Type;

/**
 * Whether a sample pair showed that the sample itself cost nothing.
 *
 * **Example** (List the self-cost states)
 *
 * ```ts
 * import { SelfCost } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(SelfCost.literals) // ["confirmed-free", "unconfirmed"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SelfCost = LiteralKit(["confirmed-free", "unconfirmed"]).pipe(
  $I.annoteSchema("SelfCost", { description: "Whether a sample pair confirmed the sample was free." })
);

/**
 * Type of {@link SelfCost}.
 *
 * @category models
 * @since 0.0.0
 */
export type SelfCost = typeof SelfCost.Type;

/**
 * One bucket of a `/rate_limit` body.
 *
 * **Example** (Build a sample bucket)
 *
 * ```ts
 * import { SampleBucket } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const bucket = SampleBucket.make({ resource: "core", limit: 5000, used: 10, remaining: 4990, resetAt: DateTime.makeUnsafe(0) })
 * console.log(bucket.remaining) // 4990
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SampleBucket extends S.Opaque<SampleBucket, { readonly brand: unique symbol }>()(
  S.Struct({
    resource: GitHubRateLimitResource,
    limit: S.Int,
    used: S.Int,
    remaining: S.Int,
    resetAt: S.DateTimeUtcFromString,
  }).pipe($I.annoteSchema("SampleBucket", { description: "One bucket of a /rate_limit body." }))
) {}

/**
 * One persisted GitHub budget ledger line.
 *
 * **Details**
 *
 * - `Transport`: one in-process HTTP attempt, from its `x-ratelimit-*` headers.
 * - `GhSpawn`: one `gh` child process spawned through the repo's capture helpers.
 * - `Sample`: one `GET /rate_limit` read, the fleet-wide truth for one identity's REST buckets.
 * - `Calibration`: one REST-vs-GraphQL pairing of the `graphql` bucket.
 *
 * Headers report the bucket after a response, not that request's cost, so a
 * `Transport` row keeps the raw header values plus a `nominalCost` floor.
 *
 * **Example** (Match a row's source)
 *
 * ```ts
 * import { GithubLedgerRow, sourceOfRow } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(GithubLedgerRow.cases.Sample.fields.trigger === undefined) // false
 * console.log(typeof sourceOfRow) // "function"
 * console.log(S.isSchema(GithubLedgerRow)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubLedgerRow = S.TaggedUnion({
  Transport: {
    at: S.DateTimeUtcFromString,
    host: HostLabel,
    command: GithubLedgerCommandLabel,
    identity: GithubIdentityLabel,
    resource: GitHubRateLimitResource,
    kind: RateLimitRequestKind,
    operation: GithubOperation,
    status: S.Int,
    outcome: RateLimitOutcome,
    limit: S.Int,
    remaining: S.Int,
    used: S.OptionFromNullOr(S.Int),
    resetAt: S.DateTimeUtcFromString,
    nominalCost: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    pid: S.Int,
  },
  GhSpawn: {
    at: S.DateTimeUtcFromString,
    host: HostLabel,
    command: GithubLedgerCommandLabel,
    identity: GithubIdentityLabel,
    subcommand: GhSubcommand,
    resource: GitHubRateLimitResource,
    exitCode: S.Int,
    durationMillis: S.Int,
  },
  Sample: {
    at: S.DateTimeUtcFromString,
    host: HostLabel,
    command: GithubLedgerCommandLabel,
    identity: GithubIdentityLabel,
    trigger: SampleTrigger,
    selfCost: SelfCost,
    buckets: S.NonEmptyArray(SampleBucket),
  },
  Calibration: {
    at: S.DateTimeUtcFromString,
    host: HostLabel,
    identity: GithubIdentityLabel,
    restUsed: S.Int,
    restRemaining: S.Int,
    restResetAt: S.DateTimeUtcFromString,
    graphqlUsed: S.Int,
    graphqlRemaining: S.Int,
    graphqlResetAt: S.DateTimeUtcFromString,
    graphqlCost: S.Int,
    spanMillis: S.Int,
  },
}).pipe($I.annoteSchema("GithubLedgerRow", { description: "One persisted GitHub budget ledger line." }));

/**
 * Type of {@link GithubLedgerRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubLedgerRow = typeof GithubLedgerRow.Type;

/**
 * The `Transport` case of {@link GithubLedgerRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type TransportRow = typeof GithubLedgerRow.cases.Transport.Type;

/**
 * The `GhSpawn` case of {@link GithubLedgerRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type GhSpawnRow = typeof GithubLedgerRow.cases.GhSpawn.Type;

/**
 * The `Sample` case of {@link GithubLedgerRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type SampleRow = typeof GithubLedgerRow.cases.Sample.Type;

/**
 * The `Calibration` case of {@link GithubLedgerRow}.
 *
 * @category models
 * @since 0.0.0
 */
export type CalibrationRow = typeof GithubLedgerRow.cases.Calibration.Type;

/**
 * The source of a row: the kebab-case of its `_tag`.
 *
 * **Example** (Name a row's source)
 *
 * ```ts
 * import { sourceOfRow } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(sourceOfRow.length) // 1
 * ```
 *
 * @param row - A ledger row.
 * @returns Its source.
 * @category utilities
 * @since 0.0.0
 */
export const sourceOfRow = (row: GithubLedgerRow): GithubLedgerSource =>
  GithubLedgerRow.match(row, {
    Transport: () => "transport" as const,
    GhSpawn: () => "gh-spawn" as const,
    Sample: () => "sample" as const,
    Calibration: () => "calibration" as const,
  });

/**
 * A ledger row as one JSON line.
 *
 * **Example** (Decode a row line)
 *
 * ```ts
 * import { GithubLedgerRowJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(GithubLedgerRowJson)("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GithubLedgerRowJson = S.fromJsonString(GithubLedgerRow);

/**
 * A `Sample` row as a JSON document (`latest/sample-*.json`).
 *
 * **Example** (Reject a non-sample document)
 *
 * ```ts
 * import { SampleRowJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(SampleRowJson)("{\"_tag\":\"Transport\"}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SampleRowJson = S.fromJsonString(GithubLedgerRow.cases.Sample);

/**
 * The longest encoded row line the ledger appends, in bytes.
 *
 * **Example** (Read the line cap)
 *
 * ```ts
 * import { GITHUB_LEDGER_MAX_LINE_BYTES } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GITHUB_LEDGER_MAX_LINE_BYTES) // 4096
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_LEDGER_MAX_LINE_BYTES = 4096;

/**
 * One bucket of the `/rate_limit` wire body.
 *
 * **Example** (Build a wire bucket)
 *
 * ```ts
 * import { GithubRateLimitWireBucket } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubRateLimitWireBucket.make({ limit: 5000, used: 1, remaining: 4999, reset: 1 }).used) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubRateLimitWireBucket extends S.Opaque<GithubRateLimitWireBucket, { readonly brand: unique symbol }>()(
  S.Struct({ limit: S.Int, used: S.Int, remaining: S.Int, reset: S.Int }).pipe(
    $I.annoteSchema("GithubRateLimitWireBucket", { description: "One bucket of the /rate_limit body." })
  )
) {}

/**
 * The `/rate_limit` wire body.
 *
 * **Details**
 *
 * `core` and `graphql` are required. Every other bucket is kept as unknown and
 * decoded one by one in {@link sampleBucketsOf}, so one malformed or new bucket
 * never fails the read.
 *
 * **Example** (Decode a minimal body)
 *
 * ```ts
 * import { GithubRateLimitWire } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const bucket = { limit: 5000, used: 0, remaining: 5000, reset: 1 }
 * const body = { resources: { core: bucket, graphql: bucket, search: "oops" } }
 * console.log(O.isSome(S.decodeUnknownOption(GithubRateLimitWire)(body))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubRateLimitWire = S.Struct({
  resources: S.StructWithRest(S.Struct({ core: GithubRateLimitWireBucket, graphql: GithubRateLimitWireBucket }), [
    S.Record(S.String, S.Unknown),
  ]),
}).pipe($I.annoteSchema("GithubRateLimitWire", { description: "The GET /rate_limit response body." }));

/**
 * Type of {@link GithubRateLimitWire}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubRateLimitWire = typeof GithubRateLimitWire.Type;

const sampleBucketOf = (resource: GitHubRateLimitResource, wire: GithubRateLimitWireBucket): SampleBucket =>
  SampleBucket.make({
    resource,
    limit: wire.limit,
    used: wire.used,
    remaining: wire.remaining,
    resetAt: DateTime.makeUnsafe(wire.reset * 1000),
  });

const isNamedResource = (key: string): key is GitHubRateLimitResource =>
  S.is(GitHubRateLimitResource)(key) && key !== "unknown" && key !== "core" && key !== "graphql";

/**
 * The named buckets of a wire body: `core`, `graphql`, then every other key that
 * is a known resource and decodes. Everything else is dropped.
 *
 * **Example** (Keep known buckets)
 *
 * ```ts
 * import { GithubRateLimitWire, sampleBucketsOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const bucket = { limit: 5000, used: 0, remaining: 5000, reset: 1 }
 * const wire = Effect.runSync(S.decodeUnknownEffect(GithubRateLimitWire)({
 *   resources: { core: bucket, graphql: bucket, search: bucket, novel: bucket }
 * }))
 * console.log(sampleBucketsOf(wire).map((b) => b.resource)) // ["core", "graphql", "search"]
 * ```
 *
 * @param wire - A decoded body.
 * @returns Its named buckets, `core` first.
 * @category utilities
 * @since 0.0.0
 */
export const sampleBucketsOf = (wire: GithubRateLimitWire): A.NonEmptyReadonlyArray<SampleBucket> => {
  const rest = pipe(
    R.toEntries(wire.resources),
    A.map(([key, value]) =>
      isNamedResource(key)
        ? O.map(S.decodeUnknownOption(GithubRateLimitWireBucket)(value), (bucket) => sampleBucketOf(key, bucket))
        : O.none()
    ),
    A.getSomes
  );
  return A.prependAll(rest, [
    sampleBucketOf("core", wire.resources.core),
    sampleBucketOf("graphql", wire.resources.graphql),
  ]);
};

/**
 * Where a bucket reading came from: response headers or a `/rate_limit` sample.
 *
 * **Example** (List the bases)
 *
 * ```ts
 * import { ReadingBasis } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(ReadingBasis.literals) // ["transport", "sample"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReadingBasis = LiteralKit(["transport", "sample"]).pipe(
  $I.annoteSchema("ReadingBasis", { description: "Where a bucket reading came from." })
);

/**
 * Type of {@link ReadingBasis}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReadingBasis = typeof ReadingBasis.Type;

/**
 * The freshest known state of one bucket. Also the shape of `latest/transport-*.json`.
 *
 * **Example** (Build a reading)
 *
 * ```ts
 * import { BucketKey, BucketReading, GithubIdentityLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const reading = BucketReading.make({
 *   key: BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" }),
 *   limit: 5000, remaining: 4000, used: O.some(1000),
 *   resetAt: DateTime.makeUnsafe(3_600_000), asOf: DateTime.makeUnsafe(0), basis: "transport"
 * })
 * console.log(reading.basis) // "transport"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BucketReading extends S.Opaque<BucketReading, { readonly brand: unique symbol }>()(
  S.Struct({
    key: BucketKey,
    limit: S.Int,
    remaining: S.Int,
    used: S.OptionFromNullOr(S.Int),
    resetAt: S.DateTimeUtcFromString,
    asOf: S.DateTimeUtcFromString,
    basis: ReadingBasis,
  }).pipe($I.annoteSchema("BucketReading", { description: "The freshest known state of one bucket." }))
) {}

/**
 * A {@link BucketReading} as a JSON document.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { BucketReadingJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(BucketReadingJson)("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const BucketReadingJson = S.fromJsonString(BucketReading);

/**
 * The share of a bucket held back for interactive and merge-critical work.
 *
 * **Example** (Read the reserve fraction)
 *
 * ```ts
 * import { GITHUB_RESERVE_FRACTION } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GITHUB_RESERVE_FRACTION) // 0.15
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_RESERVE_FRACTION = 0.15;

/**
 * The reserve floor of a bucket: `ceil(limit × 0.15)`.
 *
 * **Example** (Compute a floor)
 *
 * ```ts
 * import { reserveFloor } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(reserveFloor(5000)) // 750
 * ```
 *
 * @param limit - The bucket's limit.
 * @returns The lowest `remaining` that is still clear of the reserve.
 * @category utilities
 * @since 0.0.0
 */
export const reserveFloor = (limit: number): number => Math.ceil(limit * GITHUB_RESERVE_FRACTION);

/**
 * How long a reading counts for the reserve signal.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { RESERVE_READING_BOUND } from "@beep/repo-cli/test/SharedInternals"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(RESERVE_READING_BOUND)) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RESERVE_READING_BOUND = Duration.minutes(10);

/**
 * How urgent a GitHub call is, for the reserve signal.
 *
 * **Example** (List the priorities)
 *
 * ```ts
 * import { GithubCallPriority } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubCallPriority.literals) // ["background", "interactive", "merge-critical"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubCallPriority = LiteralKit(["background", "interactive", "merge-critical"]).pipe(
  $I.annoteSchema("GithubCallPriority", { description: "How urgent a GitHub call is." })
);

/**
 * Type of {@link GithubCallPriority}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubCallPriority = typeof GithubCallPriority.Type;

/**
 * Why a reserve state is unknown.
 *
 * **Example** (List the reasons)
 *
 * ```ts
 * import { ReserveUnknownReason } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(ReserveUnknownReason.literals) // ["no-reading", "stale", "window-reset", "uncalibrated"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReserveUnknownReason = LiteralKit(["no-reading", "stale", "window-reset", "uncalibrated"]).pipe(
  $I.annoteSchema("ReserveUnknownReason", { description: "Why a reserve state is unknown." })
);

/**
 * Type of {@link ReserveUnknownReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReserveUnknownReason = typeof ReserveUnknownReason.Type;

/**
 * A bucket's position against its reserve floor.
 *
 * **Example** (Build an unknown state)
 *
 * ```ts
 * import { ReserveState } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * console.log(ReserveState.cases.Unknown.make({ reason: "no-reading", asOf: O.none() })._tag) // "Unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReserveState = S.TaggedUnion({
  Clear: {
    remaining: S.Int,
    limit: S.Int,
    floor: S.Int,
    resetAt: S.DateTimeUtcFromString,
    asOf: S.DateTimeUtcFromString,
    basis: ReadingBasis,
  },
  Below: {
    remaining: S.Int,
    limit: S.Int,
    floor: S.Int,
    resetAt: S.DateTimeUtcFromString,
    asOf: S.DateTimeUtcFromString,
    basis: ReadingBasis,
  },
  Unknown: { reason: ReserveUnknownReason, asOf: S.OptionFromNullOr(S.DateTimeUtcFromString) },
}).pipe($I.annoteSchema("ReserveState", { description: "A bucket's position against its reserve floor." }));

/**
 * Type of {@link ReserveState}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReserveState = typeof ReserveState.Type;

/**
 * The reserve signal of one bucket.
 *
 * **Details**
 *
 * The bucket is below its reserve while `state` is `Below`. Background callers
 * back off then; interactive and merge-critical callers are never refused here.
 * `Unknown` admits everyone.
 *
 * **Example** (Read an unknown reserve)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, ReserveSignal, ReserveState } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const signal = ReserveSignal.make({
 *   key: BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "graphql" }),
 *   state: ReserveState.cases.Unknown.make({ reason: "no-reading", asOf: O.none() })
 * })
 * console.log(signal.state._tag) // "Unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReserveSignal extends S.Opaque<ReserveSignal, { readonly brand: unique symbol }>()(
  S.Struct({ key: BucketKey, state: ReserveState }).pipe(
    $I.annoteSchema("ReserveSignal", { description: "The reserve signal of one GitHub bucket." })
  )
) {}

/**
 * One configured identity of `identities.json`.
 *
 * **Details**
 *
 * `GhCli` is this host's `gh` login. `OpRef` needs `login`, so its label is
 * known without a secret read. Reference fields must be `op://` references.
 *
 * **Example** (Build a configured op-ref)
 *
 * ```ts
 * import { ConfiguredGithubIdentity } from "@beep/repo-cli/test/SharedInternals"
 *
 * const entry = ConfiguredGithubIdentity.cases.OpRef.make({ tokenRef: "op://vault/bot/token", login: "beep-bot" })
 * console.log(entry._tag) // "OpRef"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConfiguredGithubIdentity = S.TaggedUnion({
  GhCli: {},
  OpRef: { tokenRef: GithubTokenRef, login: GithubLogin },
  GithubApp: { appId: GithubAppId, installationId: GithubInstallationId, privateKeyRef: GithubPrivateKeyRef },
}).pipe($I.annoteSchema("ConfiguredGithubIdentity", { description: "One configured GitHub identity." }));

/**
 * Type of {@link ConfiguredGithubIdentity}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConfiguredGithubIdentity = typeof ConfiguredGithubIdentity.Type;

/**
 * The `identities.json` document.
 *
 * **Example** (Build a configuration)
 *
 * ```ts
 * import { ConfiguredGithubIdentity, GithubIdentityConfig } from "@beep/repo-cli/test/SharedInternals"
 *
 * const config = GithubIdentityConfig.make({ identities: [ConfiguredGithubIdentity.cases.GhCli.make({})] })
 * console.log(config.schemaVersion) // "github-identities/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubIdentityConfig extends S.Opaque<GithubIdentityConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("github-identities/v1"),
    identities: S.NonEmptyArray(ConfiguredGithubIdentity),
  }).pipe($I.annoteSchema("GithubIdentityConfig", { description: "The configured GitHub identities." }))
) {}

/**
 * {@link GithubIdentityConfig} as a JSON document.
 *
 * **Example** (Reject a raw token)
 *
 * ```ts
 * import { GithubIdentityConfigJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const text = "{\"schemaVersion\":\"github-identities/v1\",\"identities\":[{\"_tag\":\"OpRef\",\"tokenRef\":\"raw\",\"login\":\"bot\"}]}"
 * console.log(O.isNone(S.decodeUnknownOption(GithubIdentityConfigJson)(text))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const GithubIdentityConfigJson = S.fromJsonString(GithubIdentityConfig);

/**
 * The label a configured entry samples under, when it is known without a spawn or a secret read.
 *
 * **Example** (Label a configured App)
 *
 * ```ts
 * import { ConfiguredGithubIdentity, configuredLabelOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const app = ConfiguredGithubIdentity.cases.GithubApp.make({ appId: "1", installationId: 2, privateKeyRef: "op://v/i/k" })
 * console.log(O.getOrNull(configuredLabelOf(app))) // "app:1/2"
 * ```
 *
 * @param entry - A configured identity.
 * @returns `user:<login>` for `OpRef`, `app:<id>/<installation>` for `GithubApp`, none for `GhCli`.
 * @category utilities
 * @since 0.0.0
 */
export const configuredLabelOf = (entry: ConfiguredGithubIdentity): O.Option<GithubIdentityLabel> =>
  ConfiguredGithubIdentity.match(entry, {
    GhCli: O.none<GithubIdentityLabel>,
    OpRef: ({ login }) => GithubIdentityLabel.makeOption(`user:${login}`),
    GithubApp: ({ appId, installationId }) => GithubIdentityLabel.makeOption(`app:${appId}/${installationId}`),
  });

/**
 * A `token:<12 hex>` identity label.
 *
 * **Example** (Check a token label)
 *
 * ```ts
 * import { TokenIdentityLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TokenIdentityLabel)("token:aaaaaaaaaaaa")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TokenIdentityLabel = S.String.check(
  S.isPattern(/^token:[0-9a-f]{12}$/, {
    identifier: "TokenIdentityLabelPattern",
    title: "Token identity label",
    description: "A token: label carrying a 12-hex SHA-256 prefix.",
    message: "must be token:<12 hex>",
  })
).pipe($I.annoteSchema("TokenIdentityLabel", { description: "A degraded token-hash identity label." }));

/**
 * Token-hash labels mapped to the user labels that own them (`aliases.json`).
 *
 * **Example** (Build an alias map)
 *
 * ```ts
 * import { GithubIdentityLabel, IdentityAliases } from "@beep/repo-cli/test/SharedInternals"
 *
 * const aliases = IdentityAliases.make({ aliases: { "token:aaaaaaaaaaaa": GithubIdentityLabel.make("user:octocat") } })
 * console.log(aliases.schemaVersion) // "github-identity-aliases/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdentityAliases extends S.Opaque<IdentityAliases, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("github-identity-aliases/v1"),
    aliases: S.Record(TokenIdentityLabel, GithubIdentityLabel),
  }).pipe($I.annoteSchema("IdentityAliases", { description: "Token-hash labels mapped to their owners." }))
) {}

/**
 * {@link IdentityAliases} as a JSON document.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { IdentityAliasesJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(IdentityAliasesJson)("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const IdentityAliasesJson = S.fromJsonString(IdentityAliases);

/**
 * An empty alias map.
 *
 * **Example** (Start without aliases)
 *
 * ```ts
 * import { emptyIdentityAliases } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(Object.keys(emptyIdentityAliases.aliases).length) // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const emptyIdentityAliases: IdentityAliases = IdentityAliases.make({ aliases: {} });

/**
 * Map a label through the alias map: a known `token:` label becomes its owner.
 *
 * **Example** (Resolve an alias)
 *
 * ```ts
 * import { GithubIdentityLabel, IdentityAliases, canonicalIdentity } from "@beep/repo-cli/test/SharedInternals"
 *
 * const aliases = IdentityAliases.make({ aliases: { "token:aaaaaaaaaaaa": GithubIdentityLabel.make("user:octocat") } })
 * console.log(canonicalIdentity(aliases)(GithubIdentityLabel.make("token:aaaaaaaaaaaa"))) // "user:octocat"
 * ```
 *
 * @param aliases - The alias map.
 * @returns A function from a label to its canonical label.
 * @category utilities
 * @since 0.0.0
 */
export const canonicalIdentity =
  (aliases: IdentityAliases) =>
  (label: GithubIdentityLabel): GithubIdentityLabel =>
    O.getOrElse(R.get(aliases.aliases, label), () => label);

/**
 * A time range `(from, to]`.
 *
 * **Example** (Build a range)
 *
 * ```ts
 * import { LedgerRange } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const range = LedgerRange.make({ from: DateTime.makeUnsafe(0), to: DateTime.makeUnsafe(3_600_000) })
 * console.log(DateTime.toEpochMillis(range.to)) // 3600000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerRange extends S.Opaque<LedgerRange, { readonly brand: unique symbol }>()(
  S.Struct({ from: S.DateTimeUtcFromString, to: S.DateTimeUtcFromString }).pipe(
    $I.annoteSchema("LedgerRange", { description: "A time range, exclusive of from and inclusive of to." })
  )
) {}

/**
 * What retention removes: raw hours before `rowsBefore`, rollups before
 * `rollupsBefore`, the oldest raw hours before `rowsKeepAfter` while the
 * raw total exceeds `rowsMaxBytes`, `latest/` transport and sample readings
 * taken before `latestBefore`, and calibration pairs before
 * `calibrationsBefore`.
 *
 * **Example** (Build cutoffs)
 *
 * ```ts
 * import { RetentionCutoffs } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const at = DateTime.makeUnsafe(0)
 * const cutoffs = RetentionCutoffs.make({
 *   rowsBefore: at,
 *   rollupsBefore: at,
 *   rowsMaxBytes: 1,
 *   rowsKeepAfter: at,
 *   latestBefore: at,
 *   calibrationsBefore: at
 * })
 * console.log(cutoffs.rowsMaxBytes) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetentionCutoffs extends S.Opaque<RetentionCutoffs, { readonly brand: unique symbol }>()(
  S.Struct({
    rowsBefore: S.DateTimeUtcFromString,
    rollupsBefore: S.DateTimeUtcFromString,
    rowsMaxBytes: S.Int,
    rowsKeepAfter: S.DateTimeUtcFromString,
    latestBefore: S.DateTimeUtcFromString,
    calibrationsBefore: S.DateTimeUtcFromString,
  }).pipe($I.annoteSchema("RetentionCutoffs", { description: "What ledger retention removes." }))
) {}

/**
 * What the two ends of a window are.
 *
 * **Example** (List the anchors)
 *
 * ```ts
 * import { WindowAnchor } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(WindowAnchor.literals) // ["sample", "transport"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WindowAnchor = LiteralKit(["sample", "transport"]).pipe(
  $I.annoteSchema("WindowAnchor", { description: "What the two ends of a ledger window are." })
);

/**
 * Type of {@link WindowAnchor}.
 *
 * @category models
 * @since 0.0.0
 */
export type WindowAnchor = typeof WindowAnchor.Type;

/**
 * One reading of a bucket's fleet-wide `used` and reset.
 *
 * **Example** (Build an anchor)
 *
 * ```ts
 * import { LedgerAnchor } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(LedgerAnchor.make({ at: DateTime.makeUnsafe(0), used: 3, resetAt: DateTime.makeUnsafe(1), anchor: "sample" }).used) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerAnchor extends S.Opaque<LedgerAnchor, { readonly brand: unique symbol }>()(
  S.Struct({
    at: S.DateTimeUtcFromString,
    used: S.Int,
    resetAt: S.DateTimeUtcFromString,
    anchor: WindowAnchor,
  }).pipe($I.annoteSchema("LedgerAnchor", { description: "One reading of a bucket's fleet-wide used count." }))
) {}

/**
 * The span between two consecutive anchors of one lane of a bucket.
 *
 * **Details**
 *
 * A lane is one physical bucket. One key can hold several concurrent lanes,
 * such as two credentials of one login that the alias map folds together.
 * `lane` numbers them from 0 in order of first appearance within the key.
 *
 * **Example** (Build a window)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, LedgerWindow } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const window = LedgerWindow.make({
 *   key: BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" }), lane: 0,
 *   from: DateTime.makeUnsafe(0), to: DateTime.makeUnsafe(300_000), anchor: "sample",
 *   sameEpoch: true, delta: 12, crossesReset: false, resetLowerBound: 0, attributedNominal: 9, ghSpawns: 1
 * })
 * console.log(window.delta) // 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerWindow extends S.Opaque<LedgerWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    key: BucketKey,
    lane: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    from: S.DateTimeUtcFromString,
    to: S.DateTimeUtcFromString,
    anchor: WindowAnchor,
    sameEpoch: S.Boolean,
    delta: S.Int,
    crossesReset: S.Boolean,
    resetLowerBound: S.Int,
    attributedNominal: S.Int,
    ghSpawns: S.Int,
  }).pipe($I.annoteSchema("LedgerWindow", { description: "The span between two anchors of one lane of a bucket." }))
) {}

/**
 * {@link LedgerWindow} as a JSON document.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { LedgerWindowJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(LedgerWindowJson)("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LedgerWindowJson = S.fromJsonString(LedgerWindow);

/**
 * What one command spent.
 *
 * **Example** (Build a spend)
 *
 * ```ts
 * import { CommandSpend, GithubLedgerCommandLabel } from "@beep/repo-cli/test/SharedInternals"
 *
 * const spend = CommandSpend.make({ command: GithubLedgerCommandLabel.make("yeet monitor"), requests: 3, nominal: 3, estimatedPoints: 5, ghSpawns: 0 })
 * console.log(spend.estimatedPoints) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommandSpend extends S.Opaque<CommandSpend, { readonly brand: unique symbol }>()(
  S.Struct({
    command: GithubLedgerCommandLabel,
    requests: S.Int,
    nominal: S.Int,
    estimatedPoints: S.Int,
    ghSpawns: S.Int,
  }).pipe($I.annoteSchema("CommandSpend", { description: "What one beep command spent." }))
) {}

/**
 * One bucket's usage and attribution in one hour.
 *
 * **Example** (Build an hour key)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, LedgerHourKey } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const hour = LedgerHourKey.make({
 *   key: BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" }),
 *   fleetUsed: O.some(40), fleetUsedIsLowerBound: false, anchor: "sample", attributedNominal: 30,
 *   estimatedPoints: 30, ghSpawns: 2, ghEstimated: 2, unattributed: O.some(8), overAttributed: false, byCommand: []
 * })
 * console.log(hour.unattributed) // { _id: "Option", _tag: "Some", value: 8 }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerHourKey extends S.Opaque<LedgerHourKey, { readonly brand: unique symbol }>()(
  S.Struct({
    key: BucketKey,
    fleetUsed: S.OptionFromNullOr(S.Int),
    fleetUsedIsLowerBound: S.Boolean,
    anchor: WindowAnchor,
    attributedNominal: S.Int,
    estimatedPoints: S.Int,
    ghSpawns: S.Int,
    ghEstimated: S.Int,
    unattributed: S.OptionFromNullOr(S.Int),
    overAttributed: S.Boolean,
    byCommand: S.Array(CommandSpend),
  }).pipe($I.annoteSchema("LedgerHourKey", { description: "One bucket's usage and attribution in one hour." }))
) {}

/**
 * Request counts for one identity, resource, command and source in one hour.
 *
 * **Example** (Build a cell)
 *
 * ```ts
 * import { GithubIdentityLabel, GithubLedgerCommandLabel, LedgerHourCell } from "@beep/repo-cli/test/SharedInternals"
 *
 * const cell = LedgerHourCell.make({
 *   identity: GithubIdentityLabel.make("user:octocat"), resource: "core", command: GithubLedgerCommandLabel.make("beep"),
 *   source: "transport", requests: 2, nominal: 2, rateLimited: 0
 * })
 * console.log(cell.requests) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerHourCell extends S.Opaque<LedgerHourCell, { readonly brand: unique symbol }>()(
  S.Struct({
    identity: GithubIdentityLabel,
    resource: GitHubRateLimitResource,
    command: GithubLedgerCommandLabel,
    source: GithubLedgerSource,
    requests: S.Int,
    nominal: S.Int,
    rateLimited: S.Int,
  }).pipe($I.annoteSchema("LedgerHourCell", { description: "Request counts for one cell of an hour." }))
) {}

/**
 * The estimated point cost of one operation.
 *
 * **Example** (Build an operation cost)
 *
 * ```ts
 * import { OperationCost } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(OperationCost.make({ operation: "PullRequestThreads", points: 5, observations: 3 }).points) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OperationCost extends S.Opaque<OperationCost, { readonly brand: unique symbol }>()(
  S.Struct({ operation: GithubOperation, points: S.Int, observations: S.Int }).pipe(
    $I.annoteSchema("OperationCost", { description: "The estimated point cost of one operation." })
  )
) {}

/**
 * One hour of one host's ledger, rolled up.
 *
 * **Details**
 *
 * Version 2 computes windows per lane, so concurrent buckets of one key no
 * longer read as resets, and each window carries its `lane`. A rollup file of
 * any other version does not decode, so the store reads it as absent and the
 * hour is recomputed from its rows.
 *
 * **Example** (Build an empty rollup)
 *
 * ```ts
 * import { HostLabel, LedgerHourRollup } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const rollup = LedgerHourRollup.make({
 *   hour: DateTime.makeUnsafe(0), host: HostLabel.make("hub"), complete: false,
 *   cells: [], keys: [], operationCosts: [], windows: []
 * })
 * console.log(rollup.schemaVersion) // "github-ledger-rollup/v2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerHourRollup extends S.Opaque<LedgerHourRollup, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("github-ledger-rollup/v2"),
    hour: S.DateTimeUtcFromString,
    host: HostLabel,
    complete: S.Boolean,
    cells: S.Array(LedgerHourCell),
    keys: S.Array(LedgerHourKey),
    operationCosts: S.Array(OperationCost),
    windows: S.Array(LedgerWindow),
  }).pipe($I.annoteSchema("LedgerHourRollup", { description: "One hour of one host's GitHub ledger." }))
) {}

/**
 * {@link LedgerHourRollup} as a JSON document.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { LedgerHourRollupJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(LedgerHourRollupJson)("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LedgerHourRollupJson = S.fromJsonString(LedgerHourRollup);

/**
 * One bucket's unattributed points in the last complete hour.
 *
 * **Example** (Build an unattributed entry)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, UnattributedSpend } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const entry = UnattributedSpend.make({ key: BucketKey.make({ identity: GithubIdentityLabel.make("anonymous"), resource: "core" }), unattributed: O.none() })
 * console.log(entry.key.resource) // "core"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnattributedSpend extends S.Opaque<UnattributedSpend, { readonly brand: unique symbol }>()(
  S.Struct({ key: BucketKey, unattributed: S.OptionFromNullOr(S.Int) }).pipe(
    $I.annoteSchema("UnattributedSpend", { description: "One bucket's unattributed points in an hour." })
  )
) {}

/**
 * The precomputed summary the hot parcel reads (`latest/summary.json`).
 *
 * **Example** (Build an empty summary)
 *
 * ```ts
 * import { LedgerSummary } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const summary = LedgerSummary.make({ generatedAt: DateTime.makeUnsafe(0), spenders: [], unattributedLastHour: [], lastRowAt: O.none() })
 * console.log(summary.schemaVersion) // "github-ledger-summary/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LedgerSummary extends S.Opaque<LedgerSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("github-ledger-summary/v1"),
    generatedAt: S.DateTimeUtcFromString,
    spenders: S.Array(CommandSpend),
    unattributedLastHour: S.Array(UnattributedSpend),
    lastRowAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  }).pipe($I.annoteSchema("LedgerSummary", { description: "The GitHub ledger summary for the hot parcel." }))
) {}

/**
 * {@link LedgerSummary} as a JSON document.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { LedgerSummaryJson } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(S.decodeUnknownOption(LedgerSummaryJson)("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const LedgerSummaryJson = S.fromJsonString(LedgerSummary);

/**
 * Why a sampler skipped an identity.
 *
 * **Example** (List the skip reasons)
 *
 * ```ts
 * import { SampleSkipReason } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(SampleSkipReason.literals) // ["not-due", "lease-held", "app-needs-live-client"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SampleSkipReason = LiteralKit(["not-due", "lease-held", "app-needs-live-client"]).pipe(
  $I.annoteSchema("SampleSkipReason", { description: "Why a sampler skipped an identity." })
);

/**
 * Type of {@link SampleSkipReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type SampleSkipReason = typeof SampleSkipReason.Type;

/**
 * What one sampling attempt did for one identity.
 *
 * **Example** (Build a skipped outcome)
 *
 * ```ts
 * import { GithubIdentityLabel, SampleOutcome } from "@beep/repo-cli/test/SharedInternals"
 *
 * const outcome = SampleOutcome.cases.Skipped.make({ identity: GithubIdentityLabel.make("user:octocat"), reason: "not-due" })
 * console.log(outcome.reason) // "not-due"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SampleOutcome = S.TaggedUnion({
  Sampled: { identity: GithubIdentityLabel, at: S.DateTimeUtcFromString, selfCost: SelfCost },
  Skipped: { identity: GithubIdentityLabel, reason: SampleSkipReason },
  Failed: {
    entry: S.Literals(["GhCli", "OpRef", "GithubApp"]),
    identity: S.OptionFromNullOr(GithubIdentityLabel),
    detail: S.String,
  },
}).pipe($I.annoteSchema("SampleOutcome", { description: "What one sampling attempt did for one identity." }));

/**
 * Type of {@link SampleOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type SampleOutcome = typeof SampleOutcome.Type;

/**
 * Which ledger step failed.
 *
 * **Example** (List the reasons)
 *
 * ```ts
 * import { GithubLedgerErrorReason } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubLedgerErrorReason.literals) // ["state-dir", "read", "write", "decode", "config"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubLedgerErrorReason = LiteralKit(["state-dir", "read", "write", "decode", "config"]).pipe(
  $I.annoteSchema("GithubLedgerErrorReason", { description: "Which GitHub ledger step failed." })
);

/**
 * Type of {@link GithubLedgerErrorReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubLedgerErrorReason = typeof GithubLedgerErrorReason.Type;

/**
 * A ledger read, write or configuration failed. `detail` names what the ledger
 * was doing and never carries a token.
 *
 * **Example** (Wrap a write failure)
 *
 * ```ts
 * import { GithubLedgerError } from "@beep/repo-cli/test/SharedInternals"
 *
 * const error = GithubLedgerError.fromUnknown("write", "append a row")(new Error("disk full"))
 * console.log(error.reason) // "write"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GithubLedgerError extends S.TaggedError<GithubLedgerError, { readonly brand: unique symbol }>(
  $I`GithubLedgerError`
)(
  "GithubLedgerError",
  {
    reason: GithubLedgerErrorReason,
    detail: S.String,
    cause: optionalDefect("PlatformError, ConfigError or SchemaError that caused this, when one was available."),
    message: optionalDefectMessage("Non-empty message of the underlying failure."),
  },
  $I.annoteError<GithubLedgerError>("GithubLedgerError", {
    description: "A GitHub ledger read, write or configuration failed.",
  })
) {
  /**
   * Build a {@link GithubLedgerError} from whatever the underlying step failed with.
   *
   * **Example** (Wrap a read failure)
   *
   * ```ts
   * import { GithubLedgerError } from "@beep/repo-cli/test/SharedInternals"
   *
   * console.log(GithubLedgerError.fromUnknown("read", "read rows")(undefined).detail) // "read rows"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromUnknown =
    (reason: GithubLedgerErrorReason, detail: string) =>
    (cause: unknown): GithubLedgerError =>
      GithubLedgerError.make({ reason, detail, ...defectDiagnostics(cause) });
}
