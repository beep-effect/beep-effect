/**
 * Fail-closed vector search gateway.
 *
 * Vector hits are never returned directly. Every hit hydrates against the
 * authoritative memory and passes projection freshness and access checks.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Model, optionalNull, pg, UtcTimestamp } from "./Kit.ts";
import { MemoryAccessPolicy, MemoryItem, isArchiveAccessEligible, isDefaultAccessEligible } from "./ProductMemory.ts";

const $I = $ScratchpadId.create("beep/MemorySearchGateway");

/**
 * Default read versus an explicit archive query.
 *
 * **Example** (Read archive mode)
 *
 * ```ts
 * import { SearchMode } from "./MemorySearchGateway.ts"
 *
 * console.log(SearchMode.literals.includes("archive_explicit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SearchMode = LiteralKit(["default", "archive_explicit"]).pipe(
  $I.annoteSchema("SearchMode", { description: "Default read versus an explicit archive query." }),
);
/** @category type-level @since 0.0.0 */
export type SearchMode = typeof SearchMode.Type;

/**
 * Gateway decision for one memory id. The last processed hit wins.
 *
 * **Example** (Read allowed)
 *
 * ```ts
 * import { SearchDecision } from "./MemorySearchGateway.ts"
 *
 * console.log(SearchDecision.literals.includes("allowed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SearchDecision = LiteralKit([
  "allowed",
  "missing_authoritative_item",
  "stale_projection",
  "stale_vector",
  "access_denied",
]).pipe($I.annoteSchema("SearchDecision", { description: "Gateway decision for one memory id." }));
/** @category type-level @since 0.0.0 */
export type SearchDecision = typeof SearchDecision.Type;

/**
 * Why a vector id should be repaired or purged.
 *
 * **Example** (Read a stale hash)
 *
 * ```ts
 * import { VectorRepairPurgeReason } from "./MemorySearchGateway.ts"
 *
 * console.log(VectorRepairPurgeReason.literals.includes("stale_content_hash")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VectorRepairPurgeReason = LiteralKit([
  "missing_authoritative_item",
  "stale_projection_commit",
  "missing_vector_freshness_metadata",
  "stale_account_generation",
  "cross_user_vector_metadata",
  "stale_item_revision",
  "stale_source_commit",
  "stale_content_hash",
  "stale_vector_updated_at",
]).pipe($I.annoteSchema("VectorRepairPurgeReason", { description: "Why a vector id should be repaired or purged." }));
/** @category type-level @since 0.0.0 */
export type VectorRepairPurgeReason = typeof VectorRepairPurgeReason.Type;

/**
 * One vector hit before authoritative hydration.
 *
 * **Example** (Score a hit)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { SearchVectorHit } from "./MemorySearchGateway.ts"
 *
 * const hit = SearchVectorHit.make({
 *   memoryId: "mem-1",
 *   score: 0.5,
 *   projectionCommitId: "commit-1",
 *   vectorUpdatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(hit.score) // 0.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchVectorHit extends Model<SearchVectorHit>("SearchVectorHit")(
  {
    vectorId: optionalNull(S.String)
      .annotateKey({ description: "Vector id. Empty falls back to the memory id in a purge candidate." })
      .pipe(pg.text(), pg.columnName("vector_id")),
    memoryId: S.String.annotateKey({ description: "Authoritative memory id." }).pipe(pg.text(), pg.columnName("memory_id")),
    score: S.Finite.annotateKey({ description: "Vector score. Higher scores are visited first." }).pipe(
      pg.doublePrecision(),
      pg.columnName("score"),
    ),
    projectionCommitId: S.String.annotateKey({ description: "Projection commit observed on the vector." }).pipe(
      pg.text(),
      pg.columnName("projection_commit_id"),
    ),
    vectorUpdatedAt: UtcTimestamp.annotateKey({ description: "Vector update instant." }).pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("vector_updated_at"),
    ),
    uid: optionalNull(S.String).annotateKey({ description: "Vector uid. Missing freshness is a stale vector." }).pipe(
      pg.text(),
      pg.columnName("uid"),
    ),
    accountGeneration: optionalNull(S.Int)
      .annotateKey({ description: "Vector account generation." })
      .pipe(pg.integer(), pg.columnName("account_generation")),
    itemRevision: optionalNull(S.Int)
      .annotateKey({ description: "Vector item revision." })
      .pipe(pg.integer(), pg.columnName("item_revision")),
    sourceCommitId: optionalNull(S.String)
      .annotateKey({ description: "Vector source commit." })
      .pipe(pg.text(), pg.columnName("source_commit_id")),
    contentHash: optionalNull(S.String)
      .annotateKey({ description: "Vector content hash." })
      .pipe(pg.text(), pg.columnName("content_hash")),
  },
  $I.annote("SearchVectorHit", { description: "One vector hit before authoritative hydration." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace SearchVectorHit {
  /** Encoded form of {@link SearchVectorHit}. */
  export type Encoded = S.Codec.Encoded<typeof SearchVectorHit>;
}

/**
 * Authoritative memory that passed the gateway.
 *
 * **Example** (Keep the observed projection)
 *
 * ```ts
 * import { HydratedSearchResult } from "./MemorySearchGateway.ts"
 *
 * console.log(HydratedSearchResult.sql.tableName) // "hydrated_search_result"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HydratedSearchResult extends Model<HydratedSearchResult>("HydratedSearchResult")(
  {
    item: MemoryItem.annotateKey({ description: "Authoritative memory item." }).pipe(pg.jsonb(), pg.columnName("item")),
    score: S.Finite.annotateKey({ description: "Vector score." }).pipe(pg.doublePrecision(), pg.columnName("score")),
    projectionCommitId: S.String.annotateKey({ description: "Projection commit observed on the vector." }).pipe(
      pg.text(),
      pg.columnName("projection_commit_id"),
    ),
  },
  $I.annote("HydratedSearchResult", { description: "Authoritative memory that passed the gateway." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace HydratedSearchResult {
  /** Encoded form of {@link HydratedSearchResult}. */
  export type Encoded = S.Codec.Encoded<typeof HydratedSearchResult>;
}

/**
 * Repair candidate for a stale or missing vector. Access denials are not candidates.
 *
 * **Example** (Name a missing item)
 *
 * ```ts
 * import { VectorRepairPurgeCandidate } from "./MemorySearchGateway.ts"
 *
 * console.log(VectorRepairPurgeCandidate.sql.tableName) // "vector_repair_purge_candidate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VectorRepairPurgeCandidate extends Model<VectorRepairPurgeCandidate>("VectorRepairPurgeCandidate")(
  {
    vectorId: S.String.annotateKey({ description: "Vector id, or the memory id when the vector id is blank." }).pipe(
      pg.text(),
      pg.columnName("vector_id"),
    ),
    memoryId: S.String.annotateKey({ description: "Memory id." }).pipe(pg.text(), pg.columnName("memory_id")),
    reason: VectorRepairPurgeReason.annotateKey({ description: "Purge reason." }).pipe(pg.text(), pg.columnName("reason")),
    decision: SearchDecision.annotateKey({ description: "Decision derived from the purge reason." }).pipe(
      pg.text(),
      pg.columnName("decision"),
    ),
    requiredProjectionCommitId: S.String.annotateKey({
      description: "Authoritative projection commit, else the required commit.",
    }).pipe(pg.text(), pg.columnName("required_projection_commit_id")),
    observedProjectionCommitId: S.String.annotateKey({ description: "Projection commit on the hit." }).pipe(
      pg.text(),
      pg.columnName("observed_projection_commit_id"),
    ),
    requiredAccountGeneration: S.Int.annotateKey({ description: "Account generation the query required." }).pipe(
      pg.integer(),
      pg.columnName("required_account_generation"),
    ),
    observedAccountGeneration: optionalNull(S.Int)
      .annotateKey({ description: "Account generation on the hit." })
      .pipe(pg.integer(), pg.columnName("observed_account_generation")),
    authoritativeAccountGeneration: optionalNull(S.Int)
      .annotateKey({ description: "Account generation on the authoritative item." })
      .pipe(pg.integer(), pg.columnName("authoritative_account_generation")),
    observedItemRevision: optionalNull(S.Int)
      .annotateKey({ description: "Item revision on the hit." })
      .pipe(pg.integer(), pg.columnName("observed_item_revision")),
    authoritativeItemRevision: optionalNull(S.Int)
      .annotateKey({ description: "Item revision on the authoritative item." })
      .pipe(pg.integer(), pg.columnName("authoritative_item_revision")),
    observedSourceCommitId: optionalNull(S.String)
      .annotateKey({ description: "Source commit on the hit." })
      .pipe(pg.text(), pg.columnName("observed_source_commit_id")),
    authoritativeSourceCommitId: optionalNull(S.String)
      .annotateKey({ description: "Source commit on the authoritative item." })
      .pipe(pg.text(), pg.columnName("authoritative_source_commit_id")),
    observedContentHash: optionalNull(S.String)
      .annotateKey({ description: "Content hash on the hit." })
      .pipe(pg.text(), pg.columnName("observed_content_hash")),
    authoritativeContentHash: optionalNull(S.String)
      .annotateKey({ description: "Content hash on the authoritative item." })
      .pipe(pg.text(), pg.columnName("authoritative_content_hash")),
  },
  $I.annote("VectorRepairPurgeCandidate", {
    description: "Repair candidate for a stale or missing vector.",
  }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace VectorRepairPurgeCandidate {
  /** Encoded form of {@link VectorRepairPurgeCandidate}. */
  export type Encoded = S.Codec.Encoded<typeof VectorRepairPurgeCandidate>;
}

/**
 * Hydrated results, per-memory decisions, and purge candidates.
 *
 * **Gotchas**
 *
 * Hits are visited from highest score to lowest. A later hit for the same
 * memory id overwrites the decision. Allowed results are not deduped.
 * Access denials do not create purge candidates.
 *
 * **Example** (Start empty)
 *
 * ```ts
 * import { SearchGatewayResult } from "./MemorySearchGateway.ts"
 *
 * console.log(SearchGatewayResult.make({}).results.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchGatewayResult extends Model<SearchGatewayResult>("SearchGatewayResult")(
  {
    results: S.Array(HydratedSearchResult)
      .annotateKey({ description: "Allowed hydrated hits, highest score first." })
      .pipe(S.withConstructorDefault(Effect.succeed(A.empty<HydratedSearchResult>())), pg.jsonb(), pg.columnName("results")),
    decisions: S.Record(S.String, SearchDecision)
      .annotateKey({ description: "Last decision for each memory id." })
      .pipe(S.withConstructorDefault(Effect.succeed({})), pg.jsonb(), pg.columnName("decisions")),
    repairPurgeCandidates: S.Array(VectorRepairPurgeCandidate)
      .annotateKey({ description: "Stale-vector repair candidates. Access denials are excluded." })
      .pipe(
        S.withConstructorDefault(Effect.succeed(A.empty<VectorRepairPurgeCandidate>())),
        pg.jsonb(),
        pg.columnName("repair_purge_candidates"),
      ),
  },
  $I.annote("SearchGatewayResult", { description: "Hydrated results, decisions, and purge candidates." }),
) {}

/** @category type-level @since 0.0.0 */
export declare namespace SearchGatewayResult {
  /** Encoded form of {@link SearchGatewayResult}. */
  export type Encoded = S.Codec.Encoded<typeof SearchGatewayResult>;
}

const trimmed = (value: O.Option<string>): O.Option<string> =>
  O.filter(O.map(value, Str.trim), Str.isNonEmpty);

const projectionOf = (item: MemoryItem | undefined, required: string): string =>
  item === undefined ? required : O.getOrElse(trimmed(item.ledgerCommitId), () => required);

const vectorIdentity = (hit: SearchVectorHit): string => O.getOrElse(trimmed(hit.vectorId), () => hit.memoryId);

const decisionFor = (reason: VectorRepairPurgeReason): SearchDecision => {
  if (reason === "missing_authoritative_item") return "missing_authoritative_item";
  if (reason === "stale_projection_commit") return "stale_projection";
  return "stale_vector";
};

const sameText = (left: O.Option<string>, right: O.Option<string>): boolean =>
  O.isNone(left) ? O.isNone(right) : O.isSome(right) && left.value === right.value;

const candidateFor = (
  hit: SearchVectorHit,
  reason: VectorRepairPurgeReason,
  requiredProjectionCommitId: string,
  requiredAccountGeneration: number,
  item: MemoryItem | undefined,
): VectorRepairPurgeCandidate =>
  VectorRepairPurgeCandidate.make({
    vectorId: vectorIdentity(hit),
    memoryId: hit.memoryId,
    reason,
    decision: decisionFor(reason),
    requiredProjectionCommitId: projectionOf(item, requiredProjectionCommitId),
    observedProjectionCommitId: hit.projectionCommitId,
    requiredAccountGeneration,
    observedAccountGeneration: hit.accountGeneration,
    authoritativeAccountGeneration: item === undefined ? O.none() : O.some(item.accountGeneration),
    observedItemRevision: hit.itemRevision,
    authoritativeItemRevision: item === undefined ? O.none() : O.some(item.itemRevision),
    observedSourceCommitId: hit.sourceCommitId,
    authoritativeSourceCommitId: item === undefined ? O.none() : item.sourceCommitId,
    observedContentHash: hit.contentHash,
    authoritativeContentHash: item === undefined ? O.none() : item.contentHash,
  });

interface Fold {
  readonly results: ReadonlyArray<HydratedSearchResult>;
  readonly decisions: { readonly [key: string]: SearchDecision };
  readonly repairPurgeCandidates: ReadonlyArray<VectorRepairPurgeCandidate>;
}

const reject = (
  state: Fold,
  hit: SearchVectorHit,
  decision: SearchDecision,
  reason: VectorRepairPurgeReason,
  requiredProjectionCommitId: string,
  requiredAccountGeneration: number,
  item: MemoryItem | undefined,
): Fold => ({
  results: state.results,
  decisions: { ...state.decisions, [hit.memoryId]: decision },
  repairPurgeCandidates: A.append(
    state.repairPurgeCandidates,
    candidateFor(hit, reason, requiredProjectionCommitId, requiredAccountGeneration, item),
  ),
});

/**
 * Hydrate vector hits against authoritative memories and drop anything stale or unreadable.
 *
 * **Details**
 *
 * Missing items, stale projections, missing freshness, account or user
 * mismatches, revision mismatches, source or content mismatches, and older
 * vector clocks become purge candidates. Access denials are decisions only.
 * Archive mode uses explicit archive eligibility. The default mode uses default
 * eligibility, including expired short-term rows that are still pending
 * adjudication.
 *
 * **Example** (Drop a missing item)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { SearchVectorHit, hydrateAndFilterVectorHits, memoryAccessPolicyForOmiChat } from "./MemorySearchGateway.ts"
 *
 * const result = hydrateAndFilterVectorHits({
 *   hits: [
 *     SearchVectorHit.make({
 *       memoryId: "mem-1",
 *       score: 1,
 *       projectionCommitId: "commit-1",
 *       vectorUpdatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *     }),
 *   ],
 *   authoritativeItems: {},
 *   policy: memoryAccessPolicyForOmiChat(),
 *   mode: "default",
 *   requiredProjectionCommitId: "commit-1",
 *   requiredAccountGeneration: 0,
 * })
 * console.log(result.decisions["mem-1"]) // "missing_authoritative_item"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const hydrateAndFilterVectorHits = (input: {
  readonly hits: ReadonlyArray<SearchVectorHit>;
  readonly authoritativeItems: { readonly [key: string]: MemoryItem };
  readonly policy: MemoryAccessPolicy;
  readonly mode: SearchMode;
  readonly requiredProjectionCommitId: string;
  readonly requiredAccountGeneration: number;
  readonly now?: DateTime.Utc;
}): SearchGatewayResult => {
  const ranked = A.sort(
    A.map(input.hits, (hit, index) => ({ hit, index })),
    Order.combine(
      Order.mapInput(Order.Number, (item: { readonly hit: SearchVectorHit; readonly index: number }) => -item.hit.score),
      Order.mapInput(Order.Number, (item: { readonly hit: SearchVectorHit; readonly index: number }) => item.index),
    ),
  );
  const folded = A.reduce(
    ranked,
    { results: A.empty<HydratedSearchResult>(), decisions: {}, repairPurgeCandidates: A.empty<VectorRepairPurgeCandidate>() },
    (state, rankedHit): Fold => {
      const hit = rankedHit.hit;
      const item = input.authoritativeItems[hit.memoryId];
      if (item === undefined) {
        return reject(state, hit, "missing_authoritative_item", "missing_authoritative_item", input.requiredProjectionCommitId, input.requiredAccountGeneration, undefined);
      }
      const projection = projectionOf(item, input.requiredProjectionCommitId);
      if (hit.projectionCommitId !== projection) {
        return reject(state, hit, "stale_projection", "stale_projection_commit", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (O.isNone(hit.uid) || O.isNone(hit.accountGeneration) || O.isNone(hit.itemRevision)) {
        return reject(state, hit, "stale_vector", "missing_vector_freshness_metadata", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (O.isSome(item.sourceCommitId) && O.isNone(hit.sourceCommitId)) {
        return reject(state, hit, "stale_vector", "missing_vector_freshness_metadata", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (O.isSome(item.contentHash) && O.isNone(hit.contentHash)) {
        return reject(state, hit, "stale_vector", "missing_vector_freshness_metadata", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (item.accountGeneration !== input.requiredAccountGeneration) {
        return reject(state, hit, "stale_vector", "stale_account_generation", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (hit.uid.value !== item.uid) {
        return reject(state, hit, "stale_vector", "cross_user_vector_metadata", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (hit.accountGeneration.value !== item.accountGeneration) {
        return reject(state, hit, "stale_vector", "stale_account_generation", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (hit.itemRevision.value !== item.itemRevision) {
        return reject(state, hit, "stale_vector", "stale_item_revision", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (!sameText(hit.sourceCommitId, item.sourceCommitId)) {
        return reject(state, hit, "stale_vector", "stale_source_commit", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (!sameText(hit.contentHash, item.contentHash)) {
        return reject(state, hit, "stale_vector", "stale_content_hash", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      if (DateTime.toEpochMillis(hit.vectorUpdatedAt) < DateTime.toEpochMillis(item.updatedAt)) {
        return reject(state, hit, "stale_vector", "stale_vector_updated_at", input.requiredProjectionCommitId, input.requiredAccountGeneration, item);
      }
      const access =
        input.mode === "archive_explicit"
          ? isArchiveAccessEligible(item, input.policy, input.now)
          : isDefaultAccessEligible(item, input.policy, input.now);
      if (!access.allowed) {
        return { ...state, decisions: { ...state.decisions, [hit.memoryId]: "access_denied" } };
      }
      return {
        decisions: { ...state.decisions, [hit.memoryId]: "allowed" },
        repairPurgeCandidates: state.repairPurgeCandidates,
        results: A.append(
          state.results,
          HydratedSearchResult.make({ item, score: hit.score, projectionCommitId: hit.projectionCommitId }),
        ),
      };
    },
  );
  return SearchGatewayResult.make(folded);
};
