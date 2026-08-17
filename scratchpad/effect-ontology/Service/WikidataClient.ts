/**
 * Service: Wikidata Client
 *
 * Client for Wikidata API integration, specifically for entity reconciliation
 * using the wbsearchentities action.
 *
 * @see https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities
 * @since 2.0.0
 * @module Service/WikidataClient
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import { Context, Data, Duration, Effect, Layer, Schema } from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

const $I = $ScratchpadId.create("effect-ontology/Service/WikidataClient");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error returned when Wikidata API request fails
 */
export class WikidataApiError extends Data.TaggedError("WikidataApiError")<{
  readonly message: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}> {}

/**
 * Error returned when API rate limit is exceeded
 */
export class WikidataRateLimitError extends Data.TaggedError("WikidataRateLimitError")<{
  readonly retryAfter: Duration.Duration;
}> {}

// =============================================================================
// Types
// =============================================================================

/**
 * A candidate entity from Wikidata search
 */
export const WikidataCandidate = Schema.Struct({
  /** Q-ID (e.g., "Q42") */
  qid: Schema.String,
  /** Human-readable label */
  label: Schema.String,
  /** Entity description */
  description: Schema.Option(Schema.String),
  /** How the search matched (label or alias) */
  matchType: Schema.Literals(["label", "alias"]),
  /** Language of the match */
  matchLanguage: Schema.String,
  /** Normalized score (0-100) */
  score: Percentage,
  /** Wikidata concept URI */
  conceptUri: Schema.String,
});
export type WikidataCandidate = typeof WikidataCandidate.Type;

/**
 * Options for entity search
 */
export interface SearchOptions {
  /** Language code for search (default: "en") */
  readonly language?: string;
  /** Maximum results to return (default: 10, max: 50) */
  readonly limit?: number;
  /** Entity type to search for */
  readonly type?: "item" | "property" | "lexeme";
  /** Strict language matching */
  readonly strictLanguage?: boolean;
}

// =============================================================================
// API Response Schemas
// =============================================================================

const WikidataSearchMatch = Schema.Struct({
  type: Schema.String,
  language: Schema.String,
  text: Schema.String,
});

const WikidataSearchResult = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  pageid: PosInt.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  concepturi: Schema.String,
  url: Schema.String,
  label: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  description: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  match: WikidataSearchMatch,
  aliases: Schema.Array(Schema.String).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

const WikidataSearchResponse = Schema.Struct({
  searchinfo: Schema.Struct({
    search: Schema.String,
  }).pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  search: Schema.Array(WikidataSearchResult),
  success: NonNegativeInt.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  "search-continue": NonNegativeInt.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

type WikidataSearchResultType = typeof WikidataSearchResult.Type;

// =============================================================================
// Scoring
// =============================================================================

/**
 * Calculate match score based on match type and string similarity
 */
const calculateScore = (
  query: string,
  result: WikidataSearchResultType,
  position: number,
  _totalResults: number
): number => {
  const queryLower = Str.trim(Str.toLowerCase(query));
  const labelLower = Str.trim(Str.toLowerCase(O.getOrElse(result.label, () => result.title)));
  const matchText = Str.trim(Str.toLowerCase(result.match.text));

  // Base score from match type
  let baseScore: number;
  if (result.match.type === "label") {
    if (labelLower === queryLower) {
      baseScore = 100; // Exact label match
    } else if (labelLower.startsWith(queryLower)) {
      baseScore = 90; // Label prefix match
    } else if (labelLower.includes(queryLower)) {
      baseScore = 80; // Label contains query
    } else {
      baseScore = 70; // Other label match
    }
  } else {
    // Alias match
    if (matchText === queryLower) {
      baseScore = 85; // Exact alias match
    } else if (matchText.startsWith(queryLower)) {
      baseScore = 75; // Alias prefix match
    } else {
      baseScore = 65; // Other alias match
    }
  }

  // Position penalty (higher positions are better)
  // Deduct up to 10 points based on position
  const positionPenalty = Math.min(10, position * 2);

  // Normalize to 0-100
  return Math.max(0, Math.min(100, baseScore - positionPenalty));
};

// =============================================================================
// Service
// =============================================================================

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";

export class WikidataClient extends Context.Service<WikidataClient>()($I`WikidataClient`, {
  make: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    // Rate limiting state
    let lastRequestTime = 0;
    const minRequestInterval = 100; // 100ms between requests

    /**
     * Search for entities matching the query
     */
    const searchEntities = (
      query: string,
      options: SearchOptions = {}
    ): Effect.Effect<ReadonlyArray<WikidataCandidate>, WikidataApiError | WikidataRateLimitError> =>
      Effect.gen(function* () {
        const { language = "en", limit = 10, strictLanguage = false, type = "item" } = options;

        // Simple rate limiting
        const now = yield* Clock.currentTimeMillis;
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < minRequestInterval) {
          yield* Effect.sleep(Duration.millis(minRequestInterval - timeSinceLastRequest));
        }
        lastRequestTime = yield* Clock.currentTimeMillis;

        // Build request
        const params = new URLSearchParams({
          action: "wbsearchentities",
          format: "json",
          search: query,
          language,
          uselang: language,
          type,
          limit: String(Math.min(limit, 50)),
          strictlanguage: strictLanguage ? "1" : "0",
          // Respect server load with maxlag
          maxlag: "5",
        });

        const request = HttpClientRequest.get(`${WIKIDATA_API_URL}?${params.toString()}`);

        const res = yield* httpClient.execute(request).pipe(
          Effect.mapError(
            (error) =>
              new WikidataApiError({
                message: `Failed to search Wikidata: ${error}`,
                cause: error,
              })
          )
        );

        // Check for rate limiting
        if (res.status === 429) {
          const retryAfter = res.headers["retry-after"];
          const seconds = P.isTruthy(retryAfter) ? parseInt(retryAfter, 10) : 60;
          return yield* new WikidataRateLimitError({
            retryAfter: Duration.seconds(seconds),
          });
        }

        // Check for maxlag exceeded
        if (res.status === 503) {
          return yield* new WikidataRateLimitError({
            retryAfter: Duration.seconds(5),
          });
        }

        // Parse JSON from response
        const response = yield* res.json.pipe(
          Effect.mapError(
            (error) =>
              new WikidataApiError({
                message: `Failed to parse Wikidata response: ${error}`,
                cause: error,
              })
          )
        );

        // Parse response
        const parsed = yield* Schema.decodeUnknownEffect(WikidataSearchResponse)(response).pipe(
          Effect.mapError(
            (error) =>
              new WikidataApiError({
                message: `Failed to parse Wikidata response: ${error}`,
                cause: error,
              })
          )
        );

        // Convert to candidates with scores
        const candidates = A.map(
          parsed.search,
          (result, index): WikidataCandidate => ({
            qid: result.id,
            label: O.getOrElse(result.label, () => result.title),
            description: result.description,
            matchType: result.match.type === "label" ? ("label" as const) : ("alias" as const),
            matchLanguage: result.match.language,
            score: Percentage.make(calculateScore(query, result, index, parsed.search.length)),
            conceptUri: result.concepturi,
          })
        );

        // Sort by score descending
        return A.sort(
          candidates,
          Order.mapInput(Order.flip(Order.Number), (candidate: WikidataCandidate) => candidate.score)
        );
      });

    /**
     * Get entity details by Q-ID
     */
    const getEntity = (
      qid: string,
      language: string = "en"
    ): Effect.Effect<WikidataCandidate | null, WikidataApiError> =>
      Effect.gen(function* () {
        const params = new URLSearchParams({
          action: "wbgetentities",
          format: "json",
          ids: qid,
          languages: language,
          props: "labels|descriptions|aliases",
        });

        const request = HttpClientRequest.get(`${WIKIDATA_API_URL}?${params.toString()}`);

        const res = yield* httpClient.execute(request).pipe(
          Effect.mapError(
            (error) =>
              new WikidataApiError({
                message: `Failed to get entity ${qid}: ${error}`,
                cause: error,
              })
          )
        );

        const response = yield* res.json.pipe(
          Effect.mapError(
            (error) =>
              new WikidataApiError({
                message: `Failed to parse entity response: ${error}`,
                cause: error,
              })
          )
        );

        // Basic parsing - the response structure is complex
        const entities = (response as { entities?: Record<string, unknown> }).entities;
        if (P.isUndefined(entities) || P.not(P.isTruthy)(entities[qid])) {
          return null;
        }

        const entity = entities[qid] as {
          id: string;
          labels?: Record<string, { value: string }>;
          descriptions?: Record<string, { value: string }>;
          concepturi?: string;
        };

        const label = entity.labels?.[language]?.value ?? qid;
        const description = entity.descriptions?.[language]?.value;

        return {
          qid: entity.id,
          label,
          description: O.fromUndefinedOr(description),
          matchType: "label" as const,
          matchLanguage: language,
          score: Percentage.make(100), // Direct lookup
          conceptUri: `http://www.wikidata.org/entity/${qid}`,
        };
      });

    /**
     * Validate Q-ID format
     */
    const validateQid = (qid: string): boolean => /^Q\d+$/.test(qid);

    return {
      searchEntities,
      getEntity,
      validateQid,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([FetchHttpClient.layer]));
}
