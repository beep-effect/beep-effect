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
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { Percentage } from "@beep/schema/Percentage";
import { Clock, Context, Duration, Effect, Layer, Order, Ref, Semaphore } from "effect";
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
 * Fields through which a Wikidata entity search can match.
 *
 * **Example** (Inspect Wikidata match types)
 *
 * ```ts
 * import { WikidataMatchType } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(WikidataMatchType.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WikidataMatchType = LiteralKit(["label", "alias"]).pipe(
  $I.annoteSchema("WikidataMatchType", {
    description: "Wikidata search fields that can match an entity query.",
  })
);

/**
 * Runtime value accepted by {@link WikidataMatchType}.
 *
 * **Example** (Use a Wikidata match type)
 *
 * ```ts
 * import type { WikidataMatchType } from "@effect-ontology/Service/WikidataClient"
 *
 * const matchType: WikidataMatchType = "label"
 * console.log(matchType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WikidataMatchType = typeof WikidataMatchType.Type;

/**
 * Scored Wikidata entity candidate normalized from API responses.
 *
 * **Example** (Inspect the candidate schema)
 *
 * ```ts
 * import { WikidataCandidate } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(WikidataCandidate)
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
  matchType: WikidataMatchType,
  /** Language of the match */
  matchLanguage: S.String,
  /** Normalized score (0-100) */
  score: Percentage,
  /** Wikidata concept URI */
  conceptUri: S.String,
}).pipe(
  $I.annoteSchema("WikidataCandidate", {
    description: "Scored Wikidata entity candidate normalized from a search or direct lookup response.",
  })
);
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
 * Wikidata entity families accepted by entity search.
 *
 *
 * **Example** (Inspect Wikidata entity types)
 *
 * ```ts
 * import { WikidataEntityType } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(WikidataEntityType.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WikidataEntityType = LiteralKit(["item", "property", "lexeme"]).pipe(
  $I.annoteSchema("WikidataEntityType", {
    description: "Wikidata entity families accepted by wbsearchentities.",
  })
);

/**
 * Runtime value accepted by {@link WikidataEntityType}.
 *
 * **Example** (Use a Wikidata entity type)
 *
 * ```ts
 * import type { WikidataEntityType } from "@effect-ontology/Service/WikidataClient"
 *
 * const type: WikidataEntityType = "item"
 * console.log(type)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type WikidataEntityType = typeof WikidataEntityType.Type;

const WikidataSearchLimit = PosInt.check(
  S.isLessThanOrEqualTo(50, { message: "Expected at most 50 Wikidata search results" })
);

/**
 * Validated options for a Wikidata entity search.
 *
 * **Example** (Use default search options)
 *
 * ```ts
 * import { SearchOptions } from "@effect-ontology/Service/WikidataClient"
 *
 * console.log(SearchOptions.make({}).limit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchOptions extends S.Class<SearchOptions>($I`SearchOptions`)(
  {
    language: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults("en")),
    limit: WikidataSearchLimit.pipe(SchemaUtils.withKeyDefaults(PosInt.make(10))),
    type: WikidataEntityType.pipe(SchemaUtils.withKeyDefaults(WikidataEntityType.Enum.item)),
    strictLanguage: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("SearchOptions", {
    description: "Language, bounded result count, entity family, and language-matching policy for Wikidata search.",
  })
) {}

/**
 * Constructor input accepted by {@link SearchOptions}.
 *
 * **Example** (Configure a Wikidata search)
 *
 * ```ts
 * import type { SearchOptionsInput } from "@effect-ontology/Service/WikidataClient"
 *
 * const options: SearchOptionsInput = { limit: 5 }
 * console.log(options)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SearchOptionsInput = (typeof SearchOptions)["~type.make.in"];

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

    const lastRequestTime = yield* Ref.make(0);
    const rateLimitGate = yield* Semaphore.make(1);
    const minRequestInterval = Duration.millis(100);
    const awaitRateLimit = rateLimitGate.withPermits(1)(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const previous = yield* Ref.get(lastRequestTime);
        const remaining = Duration.toMillis(minRequestInterval) - (now - previous);
        if (remaining > 0) {
          yield* Effect.sleep(Duration.millis(remaining));
        }
        yield* Ref.set(lastRequestTime, yield* Clock.currentTimeMillis);
      })
    );

    /**
     * Search for entities matching the query
     */
    const searchEntities = (
      query: string,
      input: SearchOptionsInput = {}
    ): Effect.Effect<ReadonlyArray<WikidataCandidate>, WikidataApiError | WikidataRateLimitError> =>
      Effect.gen(function* () {
        const { language, limit, strictLanguage, type } = SearchOptions.make(input);
        yield* awaitRateLimit;

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
        yield* awaitRateLimit;
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
          conceptUri: `https://www.wikidata.org/entity/${qid}`,
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
