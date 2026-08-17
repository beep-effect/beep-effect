/**
 * Service: Wikidata Client
 *
 * **Details**
 *
 * Client for Wikidata API integration, specifically for entity reconciliation
 * using the wbsearchentities action.
 *
 * @see {@link https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities} for the wbsearchentities API reference.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import { Clock, Context, Duration, Effect, Layer, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { ErrorMessage, OptionalErrorCause, OptionalHttpStatusCode } from "../Domain/Error/Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/WikidataClient");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error returned when Wikidata API request fails
 *
 * **Example** (Inspect wikidata api error)
 *
 * ```ts
 * import { WikidataApiError } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(WikidataApiError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WikidataApiError extends S.TaggedError<WikidataApiError>($I`WikidataApiError`)(
  "WikidataApiError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable Wikidata API failure diagnostic.",
    }),
    statusCode: OptionalHttpStatusCode.annotateKey({
      description: "Optional HTTP response status associated with the failure.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying HTTP or response-decoding defect.",
    }),
  },
  $I.annote("WikidataApiError", {
    description: "Failure while calling or decoding the Wikidata API.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Error returned when API rate limit is exceeded
 *
 * **Example** (Inspect wikidata rate limit error)
 *
 * ```ts
 * import { WikidataRateLimitError } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(WikidataRateLimitError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WikidataRateLimitError extends S.TaggedError<WikidataRateLimitError>($I`WikidataRateLimitError`)(
  "WikidataRateLimitError",
  {
    retryAfter: S.Duration.annotateKey({
      description: "Duration to wait before retrying the Wikidata request.",
    }),
  },
  $I.annote("WikidataRateLimitError", {
    description: "Wikidata request rejected because the remote API is rate limited or lagged.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Types
// =============================================================================

/**
 * A candidate entity from Wikidata search
 *
 * **Example** (Validate wikidata candidate)
 *
 * ```ts
 * import { WikidataCandidate } from "@effect-ontology/Service/WikidataClient"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(WikidataCandidate)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WikidataCandidate = S.Struct({
  /** Q-ID (e.g., "Q42") */
  qid: S.String,
  /** Human-readable label */
  label: S.String,
  /** Entity description */
  description: S.Option(S.String),
  /** How the search matched (label or alias) */
  matchType: S.Literals(["label", "alias"]),
  /** Language of the match */
  matchLanguage: S.String,
  /** Normalized score (0-100) */
  score: Percentage,
  /** Wikidata concept URI */
  conceptUri: S.String,
});
/**
 * Describes the wikidata candidate data exposed by this module.
 *
 *
 * **Example** (Use the WikidataCandidate contract)
 *
 * ```ts
 * import type { WikidataCandidate } from "@effect-ontology/Service/WikidataClient"
 *
 * const acceptsWikidataCandidate = (_value: WikidataCandidate): void => undefined
 *
 * console.log(acceptsWikidataCandidate)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WikidataCandidate = typeof WikidataCandidate.Type;

/**
 * Options for entity search
 *
 *
 * **Example** (Use the SearchOptions contract)
 *
 * ```ts
 * import type { SearchOptions } from "@effect-ontology/Service/WikidataClient"
 *
 * const acceptsSearchOptions = (_value: SearchOptions): void => undefined
 *
 * console.log(acceptsSearchOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
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

const WikidataSearchMatch = S.Struct({
  type: S.String,
  language: S.String,
  text: S.String,
});

const WikidataSearchResult = S.Struct({
  id: S.String,
  title: S.String,
  pageid: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  concepturi: S.String,
  url: S.String,
  label: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  description: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  match: WikidataSearchMatch,
  aliases: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

const WikidataSearchResponse = S.Struct({
  searchinfo: S.Struct({
    search: S.String,
  }).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  search: S.Array(WikidataSearchResult),
  success: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  "search-continue": NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
});

const WikidataEntityText = S.Struct({
  value: S.String,
});

const WikidataEntity = S.Struct({
  id: S.String,
  labels: S.Record(S.String, WikidataEntityText),
  descriptions: S.Record(S.String, WikidataEntityText),
});

const WikidataEntityResponse = S.Struct({
  entities: S.Record(S.String, WikidataEntity),
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
    } else if (Str.startsWith(queryLower)(labelLower)) {
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
    } else if (Str.startsWith(queryLower)(matchText)) {
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

/**
 * Validates and represents wikidata client values at runtime.
 *
 * **Example** (Inspect wikidata client)
 *
 * ```ts
 * import { WikidataClient } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(WikidataClient)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
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
          Effect.mapError((error) =>
            WikidataApiError.make({
              message: `Failed to search Wikidata: ${error}`,
              cause: O.some(error),
            })
          )
        );

        // Check for rate limiting
        if (res.status === 429) {
          const retryAfter = res.headers["retry-after"];
          const seconds = P.isTruthy(retryAfter) ? parseInt(retryAfter, 10) : 60;
          return yield* WikidataRateLimitError.make({
            retryAfter: Duration.seconds(seconds),
          });
        }

        // Check for maxlag exceeded
        if (res.status === 503) {
          return yield* WikidataRateLimitError.make({
            retryAfter: Duration.seconds(5),
          });
        }

        // Parse JSON from response
        const response = yield* res.json.pipe(
          Effect.mapError((error) =>
            WikidataApiError.make({
              message: `Failed to parse Wikidata response: ${error}`,
              cause: O.some(error),
            })
          )
        );

        // Parse response
        const parsed = yield* S.decodeUnknownEffect(WikidataSearchResponse)(response).pipe(
          Effect.mapError((error) =>
            WikidataApiError.make({
              message: `Failed to parse Wikidata response: ${error}`,
              cause: O.some(error),
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
            matchType: result.match.type === "label" ? "label" : "alias",
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
          Effect.mapError((error) =>
            WikidataApiError.make({
              message: `Failed to get entity ${qid}: ${error}`,
              cause: O.some(error),
            })
          )
        );

        const response = yield* res.json.pipe(
          Effect.mapError((error) =>
            WikidataApiError.make({
              message: `Failed to parse entity response: ${error}`,
              cause: O.some(error),
            })
          )
        );

        const decoded = yield* S.decodeUnknownEffect(WikidataEntityResponse)(response).pipe(
          Effect.mapError((error) =>
            WikidataApiError.make({
              message: "Failed to decode entity response",
              cause: O.some(error),
            })
          )
        );
        const entity = R.get(decoded.entities, qid);
        if (O.isNone(entity)) {
          return null;
        }

        const label = O.getOrElse(
          O.map(R.get(entity.value.labels, language), (text) => text.value),
          () => qid
        );
        const description = O.map(R.get(entity.value.descriptions, language), (text) => text.value);

        return {
          qid: entity.value.id,
          label,
          description,
          matchType: "label",
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
