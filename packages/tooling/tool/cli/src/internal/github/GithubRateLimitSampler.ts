/**
 * The `/rate_limit` sampler: free fleet-wide readings of each identity's
 * buckets, for the GitHub budget ledger.
 *
 * **Details**
 *
 * One sample is two back-to-back `GET /rate_limit` reads on the same client;
 * the second body is kept and the pair says whether the read itself was free.
 * Nothing that costs a request, a token mint or a secret read happens before
 * the due check and the per-identity lease, so a timer that fires every five
 * minutes and a monitor that polls every ninety seconds sample each identity
 * at most once per interval per host. GitHub App identities are sampled only
 * through a client a long-lived process already holds: building one mints an
 * installation token and revokes it on release, which is billed.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeOS from "node:os";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GraphQLDocument } from "@beep/github/GraphQL";
import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { graphqlErrorToGitHubError } from "./GithubGraphql.ts";
import {
  fromGithubIdentity,
  GithubBudgetIdentity,
  GithubClientRequest,
  GithubIdentityError,
  layerGithubClientFor,
  selectGithubIdentity,
  toGithubIdentity,
} from "./GithubIdentity.ts";
import { readGhCliLogin, readGithubIdentityConfig } from "./GithubIdentityConfig.ts";
import {
  ConfiguredGithubIdentity,
  configuredLabelOf,
  GithubLedgerRow,
  GithubRateLimitWire,
  HostLabel,
  hostLabelOf,
  SampleOutcome,
  sampleBucketsOf,
} from "./GithubLedger.schemas.ts";
import { GithubBudgetLedger, GithubLedgerCommand } from "./GithubLedger.service.ts";
import { GithubLedgerStore } from "./GithubLedger.store.ts";
import type { GitHubError } from "@beep/github/GitHubError";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubIdentity } from "./GithubIdentity.ts";
import type {
  CalibrationRow,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  SampleRow,
  SampleTrigger,
  SelfCost,
} from "./GithubLedger.schemas.ts";

const $I = $RepoCliId.create("internal/github/GithubRateLimitSampler");

/**
 * How often an identity is sampled per host.
 *
 * @category constants
 * @since 0.0.0
 */
export const GITHUB_SAMPLE_INTERVAL: Duration.Duration = Duration.minutes(5);

// A sample younger than the interval less this slack is still fresh, so a timer
// that fires a few seconds early does not skip a whole cycle.
const SAMPLE_DUE_SLACK = Duration.seconds(30);

/**
 * Read `GET /rate_limit` through the provided client. The endpoint is free on
 * the primary limit.
 *
 * **Example** (Reference the read)
 *
 * ```ts
 * import { readGithubRateLimit } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readGithubRateLimit)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const readGithubRateLimit: Effect.Effect<GithubRateLimitWire, GitHubError, GitHubClient> = GitHubClient.use(
  (client) => client.requestDecoded("GET /rate_limit", {}, GithubRateLimitWire)
).pipe(Effect.withSpan("GithubRateLimitSampler.read"));

/**
 * Whether a `/rate_limit` read pair confirms the read was free: both bodies
 * agree on `core.used` and the `core` reset.
 *
 * **Example** (Compare two identical reads)
 *
 * ```ts
 * import { GithubRateLimitWire, selfCostOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * const bucket = { limit: 5000, used: 7, remaining: 4993, reset: 1 }
 * const wire = S.decodeUnknownSync(GithubRateLimitWire)({ resources: { core: bucket, graphql: bucket } })
 * console.log(selfCostOf(wire, wire)) // "confirmed-free"
 * ```
 *
 * @param first - The first body.
 * @param second - The second body.
 * @returns `confirmed-free` or `unconfirmed`.
 * @category utilities
 * @since 0.0.0
 */
export const selfCostOf: {
  (second: GithubRateLimitWire): (first: GithubRateLimitWire) => SelfCost;
  (first: GithubRateLimitWire, second: GithubRateLimitWire): SelfCost;
} = dual(
  2,
  (first: GithubRateLimitWire, second: GithubRateLimitWire): SelfCost =>
    first.resources.core.used === second.resources.core.used &&
    first.resources.core.reset === second.resources.core.reset
      ? "confirmed-free"
      : "unconfirmed"
);

/**
 * Build the `Sample` row of a `/rate_limit` body.
 *
 * **Example** (Build a sample row)
 *
 * ```ts
 * import { GithubIdentityLabel, GithubLedgerCommandLabel, GithubRateLimitWire, HostLabel, sampleRowOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 *
 * const bucket = { limit: 5000, used: 7, remaining: 4993, reset: 1 }
 * const row = sampleRowOf({
 *   at: DateTime.makeUnsafe(0),
 *   host: HostLabel.make("hub"),
 *   command: GithubLedgerCommandLabel.make("beep"),
 *   identity: GithubIdentityLabel.make("user:octocat"),
 *   trigger: "manual",
 *   selfCost: "confirmed-free",
 *   wire: S.decodeUnknownSync(GithubRateLimitWire)({ resources: { core: bucket, graphql: bucket } })
 * })
 * console.log(row.buckets.length) // 2
 * ```
 *
 * @param input - When, where, for whom and what was read.
 * @returns The row.
 * @category constructors
 * @since 0.0.0
 */
export const sampleRowOf = (input: {
  readonly at: DateTime.Utc;
  readonly command: GithubLedgerCommandLabel;
  readonly host: HostLabel;
  readonly identity: GithubIdentityLabel;
  readonly selfCost: SelfCost;
  readonly trigger: SampleTrigger;
  readonly wire: GithubRateLimitWire;
}): SampleRow =>
  GithubLedgerRow.cases.Sample.make({
    at: input.at,
    host: input.host,
    command: input.command,
    identity: input.identity,
    trigger: input.trigger,
    selfCost: input.selfCost,
    buckets: sampleBucketsOf(input.wire),
  });

/**
 * Record a `/rate_limit` body the caller already read as a sample with an
 * unconfirmed self-cost, when a ledger and the client's budget label are in
 * context. Never fails.
 *
 * **Details**
 *
 * The Yeet monitor reads `/rate_limit` after every failed poll to time its
 * pause; this turns each of those reads into a free extra sample.
 *
 * **Example** (Record nothing without a ledger)
 *
 * ```ts
 * import { GithubRateLimitWire, recordRateLimitRead } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const bucket = { limit: 5000, used: 7, remaining: 4993, reset: 1 }
 * const wire = S.decodeUnknownSync(GithubRateLimitWire)({ resources: { core: bucket, graphql: bucket } })
 * Effect.runSync(recordRateLimitRead(wire, "monitor-pause"))
 * ```
 *
 * @param wire - The body that was read.
 * @param trigger - Why it was read.
 * @returns An effect that records the sample.
 * @category utilities
 * @since 0.0.0
 */
export const recordRateLimitRead = Effect.fnUntraced(function* (wire: GithubRateLimitWire, trigger: SampleTrigger) {
  const ledger = yield* Effect.serviceOption(GithubBudgetLedger);
  const identity = yield* GithubBudgetIdentity;
  if (O.isNone(ledger) || O.isNone(identity)) return;
  const at = yield* DateTime.now;
  const command = yield* GithubLedgerCommand;
  yield* ledger.value.recordSample(
    sampleRowOf({
      at,
      host: hostLabelOf(NodeOS.hostname()),
      command,
      identity: identity.value,
      trigger,
      selfCost: "unconfirmed",
      wire,
    })
  );
});

/**
 * The configured identity list, how to label an entry, and how to build a
 * client for it.
 *
 * @category services
 * @since 0.0.0
 */
export interface GithubIdentityRegistryShape {
  /** A client layer for an entry; building it reads the entry's token or mints an App token. */
  readonly clientFor: (entry: ConfiguredGithubIdentity) => Layer.Layer<GitHubClient, GithubIdentityError>;
  /** `identities.json` ∪ the env-selected identity ∪ `GhCli`, deduplicated by label. */
  readonly configured: Effect.Effect<A.NonEmptyReadonlyArray<ConfiguredGithubIdentity>, GithubLedgerError>;
  /** The label an entry samples under, with no request when the label is known without one. */
  readonly labelOf: (entry: ConfiguredGithubIdentity) => Effect.Effect<GithubIdentityLabel, GithubIdentityError>;
}

/**
 * The identities the sampler may sample.
 *
 * **Example** (Provide a stub registry)
 *
 * ```ts
 * import { ConfiguredGithubIdentity, GithubIdentityLabel, GithubIdentityRegistry } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const stub = Layer.succeed(GithubIdentityRegistry, GithubIdentityRegistry.of({
 *   configured: Effect.succeed([ConfiguredGithubIdentity.cases.GhCli.make({})]),
 *   labelOf: () => Effect.succeed(GithubIdentityLabel.make("user:octocat")),
 *   clientFor: () => Layer.empty as never,
 * }))
 * console.log(Layer.isLayer(stub)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GithubIdentityRegistry extends Context.Service<GithubIdentityRegistry, GithubIdentityRegistryShape>()(
  $I`GithubIdentityRegistry`
) {}

const GH_CLI_ENTRY: ConfiguredGithubIdentity = ConfiguredGithubIdentity.cases.GhCli.make({});

const missingLabel = (what: string) =>
  GithubIdentityError.make({ reason: "token-unavailable", message: `no budget label for ${what}` });

/**
 * Build the live registry: entries from `identities.json`, the identity a
 * command in this environment would select, and this host's `gh` login.
 *
 * **Details**
 *
 * A `GhCli` entry is labelled from `gh`'s local configuration when no
 * `GH_TOKEN`/`GITHUB_TOKEN` overrides it; otherwise, as for an env-selected
 * `op-ref` with no configured login, the label comes from building the client
 * (one token read, then the alias map). An env-selected `op-ref` whose token
 * resolves only to a `token:` label is dropped, because a configured `OpRef`
 * needs a login.
 *
 * **Example** (Build the registry)
 *
 * ```ts
 * import { makeGithubIdentityRegistryLive } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeGithubIdentityRegistryLive(process.cwd()))) // true
 * ```
 *
 * @param cwd - The working directory for `gh` and `op`.
 * @returns The registry.
 * @category constructors
 * @since 0.0.0
 */
export const makeGithubIdentityRegistryLive = Effect.fn("GithubIdentityRegistry.make")(function* (cwd: string) {
  const services = yield* Effect.context<
    ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path | GithubBudgetLedger
  >();

  const clientForIdentity = (identity: GithubIdentity): Layer.Layer<GitHubClient, GithubIdentityError> =>
    layerGithubClientFor(GithubClientRequest.make({ identity, cwd })).pipe(
      Layer.provide(Layer.succeedContext(services))
    );

  const clientFor = flow(toGithubIdentity, clientForIdentity);

  // The label the client seam itself assigns: one token read, then the alias map.
  const clientLabelOf = (identity: GithubIdentity) =>
    Layer.build(clientForIdentity(identity)).pipe(
      Effect.map((context) => Context.get(context, GithubBudgetIdentity)),
      Effect.flatMap((label) => Effect.fromOption(label, () => missingLabel(identity.kind))),
      Effect.scoped
    );

  const ghCliLabel = Effect.gen(function* () {
    const ghToken = yield* configStringOption("GH_TOKEN");
    const githubToken = yield* configStringOption("GITHUB_TOKEN");
    const overridden = O.isSome(O.filter(ghToken, Str.isNonEmpty)) || O.isSome(O.filter(githubToken, Str.isNonEmpty));
    const local = overridden
      ? O.none<GithubIdentityLabel>()
      : yield* readGhCliLogin(cwd).pipe(Effect.provideContext(services));
    return yield* O.match(local, {
      onSome: Effect.succeed,
      onNone: () => clientLabelOf(toGithubIdentity(GH_CLI_ENTRY)),
    });
  });

  const labelOf = (entry: ConfiguredGithubIdentity): Effect.Effect<GithubIdentityLabel, GithubIdentityError> =>
    O.match(configuredLabelOf(entry), { onSome: Effect.succeed, onNone: () => ghCliLabel });

  const envEntry = Effect.fnUntraced(function* (fileEntries: ReadonlyArray<ConfiguredGithubIdentity>) {
    const selected = yield* selectGithubIdentity(O.none()).pipe(Effect.option);
    if (O.isNone(selected)) return O.none<ConfiguredGithubIdentity>();
    const identity = selected.value;
    if (identity.kind !== "op-ref") return fromGithubIdentity(identity, O.none());
    const login = A.findFirst(fileEntries, (entry) =>
      ConfiguredGithubIdentity.guards.OpRef(entry) && O.contains(identity.tokenRef, entry.tokenRef)
        ? O.some(entry.login)
        : O.none()
    );
    if (O.isSome(login)) return fromGithubIdentity(identity, login);
    const label = yield* clientLabelOf(identity).pipe(Effect.option);
    const resolved = pipe(label, O.flatMap(Str.match(/^user:(.+)$/)), O.flatMap(A.get(1)));
    if (O.isNone(resolved)) {
      yield* Effect.logDebug("github.sampler.envIdentityUnlabelled");
      return O.none<ConfiguredGithubIdentity>();
    }
    return fromGithubIdentity(identity, resolved);
  });

  const configured = Effect.gen(function* () {
    const fileEntries = yield* readGithubIdentityConfig.pipe(Effect.provideContext(services));
    const env = yield* envEntry(fileEntries);
    const all = A.append(A.appendAll(fileEntries, O.toArray(env)), GH_CLI_ENTRY);
    const keyed = yield* Effect.forEach(all, (entry, index) =>
      labelOf(entry).pipe(
        Effect.map((label): string => label),
        Effect.orElseSucceed(() => `unlabelled:${index}`),
        Effect.map((key) => [key, entry] as const)
      )
    );
    const unique = pipe(
      A.dedupeWith(keyed, ([self], [that]) => self === that),
      A.map(([, entry]) => entry)
    );
    return A.isReadonlyArrayNonEmpty(unique) ? unique : A.of(GH_CLI_ENTRY);
  });

  return GithubIdentityRegistry.of({ configured, labelOf, clientFor });
});

/**
 * {@link GithubIdentityRegistry} over the live configuration.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { layerGithubIdentityRegistryLive } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubIdentityRegistryLive("."))) // true
 * ```
 *
 * @param cwd - The working directory for `gh` and `op`.
 * @returns The registry layer.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubIdentityRegistryLive = (
  cwd: string
): Layer.Layer<
  GithubIdentityRegistry,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path | GithubBudgetLedger
> => Layer.effect(GithubIdentityRegistry, makeGithubIdentityRegistryLive(cwd));

/**
 * How calibration runs: how many pairs, and how far apart.
 *
 * **Example** (Two pairs, ten seconds apart)
 *
 * ```ts
 * import { GithubCalibrationOptions } from "@beep/repo-cli/test/SharedInternals"
 * import * as Duration from "effect/Duration"
 *
 * const options = GithubCalibrationOptions.make({ pairs: 2, spacing: Duration.seconds(10) })
 * console.log(options.pairs) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCalibrationOptions extends S.Opaque<GithubCalibrationOptions, { readonly brand: unique symbol }>()(
  S.Struct({ pairs: S.Int.check(S.isGreaterThan(0)), spacing: S.Duration }).pipe(
    $I.annoteSchema("GithubCalibrationOptions", {
      description: "How many REST/GraphQL calibration pairs to read, and the pause between them.",
    })
  )
) {}

/**
 * The sampler's operations.
 *
 * @category services
 * @since 0.0.0
 */
export interface GithubRateLimitSamplerShape {
  /**
   * Pair the gh-cli identity's REST `/rate_limit` graphql bucket with GraphQL
   * `rateLimit`, `pairs` times; each pair costs one GraphQL point.
   */
  readonly calibrate: (
    options: GithubCalibrationOptions
  ) => Effect.Effect<ReadonlyArray<CalibrationRow>, GithubIdentityError | GitHubError>;
  /** One sample per configured non-App identity. Never fails; each identity has its own outcome. */
  readonly sampleAll: (trigger: SampleTrigger) => Effect.Effect<ReadonlyArray<SampleOutcome>>;
  /** Sample the provided client's identity when its last sample is older than the interval. Never fails. */
  readonly sampleIfDue: (trigger: SampleTrigger) => Effect.Effect<SampleOutcome, never, GitHubClient>;
}

/**
 * The `/rate_limit` sampler.
 *
 * **Example** (Sample when a sampler is bound)
 *
 * ```ts
 * import { GithubRateLimitSampler } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.flatMap(Effect.serviceOption(GithubRateLimitSampler), O.match({
 *   onNone: () => Effect.succeed([]),
 *   onSome: (sampler) => sampler.sampleAll("manual"),
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GithubRateLimitSampler extends Context.Service<GithubRateLimitSampler, GithubRateLimitSamplerShape>()(
  $I`GithubRateLimitSampler`
) {}

/**
 * How a sampler instance labels its rows: the host label, defaulting to the
 * short hostname.
 *
 * **Example** (Pin the host label)
 *
 * ```ts
 * import { GithubRateLimitSamplerOptions, HostLabel } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubRateLimitSamplerOptions.make({ host: HostLabel.make("hub") }).host) // "hub"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubRateLimitSamplerOptions extends S.Opaque<
  GithubRateLimitSamplerOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({ host: S.optionalKey(HostLabel) }).pipe(
    $I.annoteSchema("GithubRateLimitSamplerOptions", { description: "How a sampler instance labels its rows." })
  )
) {}

const CalibrationData = S.Struct({
  rateLimit: S.Struct({
    limit: S.Int,
    used: S.Int,
    remaining: S.Int,
    resetAt: S.DateTimeUtcFromString,
    cost: S.Int,
  }),
});

/**
 * The calibration query: the GraphQL view of the `graphql` bucket, with its cost.
 *
 * @category documents
 * @since 0.0.0
 */
export const githubLedgerCalibrateDocument = GraphQLDocument.make({
  name: "GithubLedgerCalibrate",
  document: "query GithubLedgerCalibrate { rateLimit { limit used remaining resetAt cost } }",
  response: CalibrationData,
})<Record<string, never>>();

type SampleFailure = GithubIdentityError | GitHubError | GithubLedgerError;

// What a failed outcome says: the failing step's kind, never response bodies or tokens.
const failureDetail = (error: SampleFailure): string =>
  Match.valueTags(error, {
    GithubIdentityError: (identity) => `identity ${identity.reason}: ${identity.message}`,
    GitHubError: (github) =>
      `github ${github.kind} on ${github.operation}${github.status === undefined ? "" : ` (${github.status})`}`,
    GithubLedgerError: (ledger) => `ledger ${ledger.reason}: ${ledger.detail}`,
  });

const entryOfLabel = (label: O.Option<GithubIdentityLabel>): ConfiguredGithubIdentity["_tag"] =>
  O.exists(label, Str.startsWith("app:")) ? "GithubApp" : "GhCli";

interface SamplePair {
  readonly selfCost: SelfCost;
  readonly wire: GithubRateLimitWire;
}

const samplePair: Effect.Effect<SamplePair, GitHubError, GitHubClient> = Effect.gen(function* () {
  const first = yield* readGithubRateLimit;
  const second = yield* readGithubRateLimit;
  return { wire: second, selfCost: selfCostOf(first, second) };
}).pipe(Effect.withSpan("GithubRateLimitSampler.pair"));

/**
 * Build a sampler over the provided ledger, store and registry.
 *
 * **Example** (Build the effect)
 *
 * ```ts
 * import { makeGithubRateLimitSampler } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeGithubRateLimitSampler())) // true
 * ```
 *
 * @param options - The host label.
 * @returns The sampler.
 * @category constructors
 * @since 0.0.0
 */
export const makeGithubRateLimitSampler = Effect.fn("GithubRateLimitSampler.make")(function* (
  options: GithubRateLimitSamplerOptions = GithubRateLimitSamplerOptions.make({})
) {
  const ledger = yield* GithubBudgetLedger;
  const store = yield* GithubLedgerStore;
  const registry = yield* GithubIdentityRegistry;
  const host = options.host ?? hostLabelOf(NodeOS.hostname());
  const freshFor = Duration.toMillis(Duration.subtract(GITHUB_SAMPLE_INTERVAL, SAMPLE_DUE_SLACK));

  const isFresh = Effect.fnUntraced(function* (identity: GithubIdentityLabel) {
    const last = yield* ledger.lastSampleAt(identity).pipe(Effect.orElseSucceed(O.none<DateTime.Utc>));
    const now = yield* DateTime.now;
    return O.exists(last, (at) => DateTime.toEpochMillis(now) - DateTime.toEpochMillis(at) < freshFor);
  });

  // Steps 2–5 of one sample: due check, lease, due re-check, then the pair.
  const sampleLabel = <R>(
    identity: GithubIdentityLabel,
    trigger: SampleTrigger,
    pair: Effect.Effect<SamplePair, GithubIdentityError | GitHubError, R>
  ): Effect.Effect<SampleOutcome, SampleFailure, R> =>
    Effect.gen(function* () {
      if (yield* isFresh(identity)) return SampleOutcome.cases.Skipped.make({ identity, reason: "not-due" });
      const leased = yield* store.acquireSamplerLease(identity);
      if (!leased) return SampleOutcome.cases.Skipped.make({ identity, reason: "lease-held" });
      if (yield* isFresh(identity)) return SampleOutcome.cases.Skipped.make({ identity, reason: "not-due" });
      const read = yield* pair;
      const at = yield* DateTime.now;
      const command = yield* GithubLedgerCommand;
      yield* ledger.recordSample(
        sampleRowOf({ at, host, command, identity, trigger, selfCost: read.selfCost, wire: read.wire })
      );
      return SampleOutcome.cases.Sampled.make({ identity, at, selfCost: read.selfCost });
    }).pipe(Effect.scoped);

  const settle =
    (entry: ConfiguredGithubIdentity["_tag"], identity: O.Option<GithubIdentityLabel>) =>
    <R>(effect: Effect.Effect<SampleOutcome, SampleFailure, R>): Effect.Effect<SampleOutcome, never, R> =>
      effect.pipe(
        Effect.catch((error) =>
          Effect.succeed(SampleOutcome.cases.Failed.make({ entry, identity, detail: failureDetail(error) }))
        ),
        Effect.catchCause((cause) =>
          Effect.as(
            Effect.logDebug("github.sampler.defect", cause),
            SampleOutcome.cases.Failed.make({ entry, identity, detail: "the sample died" })
          )
        )
      );

  const sampleEntry = (entry: ConfiguredGithubIdentity, trigger: SampleTrigger): Effect.Effect<SampleOutcome> =>
    ConfiguredGithubIdentity.match(entry, {
      // Building an App client mints a token and revokes it on release, a billed request.
      GithubApp: (app) =>
        Effect.succeed(
          O.match(configuredLabelOf(app), {
            onSome: (identity) => SampleOutcome.cases.Skipped.make({ identity, reason: "app-needs-live-client" }),
            onNone: () =>
              SampleOutcome.cases.Failed.make({
                entry: "GithubApp",
                identity: O.none(),
                detail: "the App entry has no label",
              }),
          })
        ),
      GhCli: () => sampleBuilt(entry, trigger),
      OpRef: () => sampleBuilt(entry, trigger),
    });

  const sampleBuilt = (entry: ConfiguredGithubIdentity, trigger: SampleTrigger): Effect.Effect<SampleOutcome> =>
    Effect.gen(function* () {
      const identity = yield* registry
        .labelOf(entry)
        .pipe(
          Effect.mapError((error) =>
            SampleOutcome.cases.Failed.make({ entry: entry._tag, identity: O.none(), detail: failureDetail(error) })
          )
        );
      const pair = Layer.build(registry.clientFor(entry)).pipe(
        Effect.flatMap((context) => Effect.provideContext(samplePair, context)),
        Effect.provideService(GithubBudgetLedger, ledger),
        Effect.scoped
      );
      return yield* sampleLabel(identity, trigger, pair).pipe(settle(entry._tag, O.some(identity)));
    }).pipe(Effect.catch(Effect.succeed));

  const sampleAll = (trigger: SampleTrigger): Effect.Effect<ReadonlyArray<SampleOutcome>> =>
    Effect.gen(function* () {
      const entries = yield* registry.configured.pipe(
        Effect.catch((error) =>
          Effect.as(Effect.logWarning(`github ledger: ${error.detail}; sampling the gh login only`), A.of(GH_CLI_ENTRY))
        )
      );
      return yield* Effect.forEach(entries, (entry) => sampleEntry(entry, trigger));
    }).pipe(Effect.withSpan("GithubRateLimitSampler.sampleAll"));

  const sampleIfDue = (trigger: SampleTrigger): Effect.Effect<SampleOutcome, never, GitHubClient> =>
    Effect.gen(function* () {
      const label = yield* GithubBudgetIdentity;
      if (O.isNone(label)) {
        return SampleOutcome.cases.Failed.make({
          entry: "GhCli",
          identity: O.none(),
          detail: "the client carries no budget label",
        });
      }
      return yield* sampleLabel(label.value, trigger, samplePair).pipe(settle(entryOfLabel(label), label));
    }).pipe(Effect.withSpan("GithubRateLimitSampler.sampleIfDue"));

  const calibrationPair = Effect.fnUntraced(function* (identity: GithubIdentityLabel) {
    const client = yield* GitHubClient;
    const started = yield* DateTime.now;
    const rest = yield* readGithubRateLimit;
    const graphql = yield* client
      .graphql(githubLedgerCalibrateDocument, {})
      .pipe(Effect.catchTag("GitHubGraphQLError", (error) => error.pipe(graphqlErrorToGitHubError, Effect.fail)));
    const ended = yield* DateTime.now;
    const row = GithubLedgerRow.cases.Calibration.make({
      at: ended,
      host,
      identity,
      restUsed: rest.resources.graphql.used,
      restRemaining: rest.resources.graphql.remaining,
      restResetAt: DateTime.makeUnsafe(rest.resources.graphql.reset * 1000),
      graphqlUsed: graphql.rateLimit.used,
      graphqlRemaining: graphql.rateLimit.remaining,
      graphqlResetAt: graphql.rateLimit.resetAt,
      graphqlCost: graphql.rateLimit.cost,
      spanMillis: DateTime.toEpochMillis(ended) - DateTime.toEpochMillis(started),
    });
    yield* ledger.recordCalibration(row);
    return row;
  });

  const calibrate = Effect.fn("GithubRateLimitSampler.calibrate")(function* (calibration: GithubCalibrationOptions) {
    const identity = yield* registry.labelOf(GH_CLI_ENTRY);
    const context = yield* Layer.build(registry.clientFor(GH_CLI_ENTRY)).pipe(
      Effect.provideService(GithubBudgetLedger, ledger)
    );
    return yield* Effect.forEach(A.range(1, Math.max(1, calibration.pairs)), (index) =>
      (index === 1 ? Effect.void : Effect.sleep(calibration.spacing)).pipe(
        Effect.andThen(calibrationPair(identity)),
        Effect.provideContext(context)
      )
    );
  }, Effect.scoped);

  return GithubRateLimitSampler.of({ sampleAll, sampleIfDue, calibrate });
});

/**
 * {@link GithubRateLimitSampler} over the provided ledger, store and registry.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { layerGithubRateLimitSampler } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubRateLimitSampler())) // true
 * ```
 *
 * @param options - The host label.
 * @returns The sampler layer.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubRateLimitSampler = (
  options: GithubRateLimitSamplerOptions = GithubRateLimitSamplerOptions.make({})
): Layer.Layer<GithubRateLimitSampler, never, GithubBudgetLedger | GithubLedgerStore | GithubIdentityRegistry> =>
  Layer.effect(GithubRateLimitSampler, makeGithubRateLimitSampler(options));
