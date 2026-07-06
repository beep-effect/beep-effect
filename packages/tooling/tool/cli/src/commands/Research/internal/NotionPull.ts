/**
 * Minimal Notion REST client for research notion-pull.
 *
 * Deliberately small: one search call to locate the saved-links data source
 * and a paginated query over its pages. Graduate this into a full
 * `@beep/notion` driver when vault-to-Notion sync-back lands.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { O as OptionUtils } from "@beep/utils";
import { Config, Effect, FileSystem, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { ResearchCommandError } from "../Research.errors.js";
import { sha256HexOf } from "./Vault.js";

const $I = $RepoCliId.create("commands/Research/internal/NotionPull");

const NOTION_API_URL = "https://api.notion.com";
const NOTION_VERSION = "2022-06-28";

/**
 * One saved link extracted from a Notion database page.
 *
 * @internal
 * @category models
 */
export class NotionSavedLink extends S.Class<NotionSavedLink>($I`NotionSavedLink`)(
  {
    createdIso: S.String,
    pageId: S.String,
    tags: S.Array(S.String),
    title: S.String,
    url: S.OptionFromOptionalKey(S.String),
  },
  $I.annote("NotionSavedLink", {
    title: "Notion Saved Link",
    description: "One saved link extracted from a Notion database page or page block.",
  })
) {}

class SearchResult extends S.Class<SearchResult>($I`SearchResult`)(
  {
    id: S.String,
    object: S.String,
  },
  $I.annote("SearchResult", {
    title: "Search Result",
    description: "Minimal Notion search result used to locate the saved-links database.",
  })
) {}

class SearchResponse extends S.Class<SearchResponse>($I`SearchResponse`)(
  {
    results: S.Array(S.Unknown),
  },
  $I.annote("SearchResponse", {
    title: "Search Response",
    description: "Minimal Notion search response containing raw result payloads.",
  })
) {}

class QueryResponse extends S.Class<QueryResponse>($I`QueryResponse`)(
  {
    has_more: S.Boolean,
    next_cursor: S.NullOr(S.String),
    results: S.Array(S.Unknown),
  },
  $I.annote("QueryResponse", {
    title: "Query Response",
    description: "Minimal Notion paginated query response used by research notion-pull.",
  })
) {}

const decodeQueryResponse = S.decodeUnknownEffect(QueryResponse);
const decodeSearchResponse = S.decodeUnknownEffect(SearchResponse);
const decodeSearchResult = S.decodeUnknownEffect(SearchResult);

const notionRequest = Effect.fn("NotionPull.notionRequest")(function* (
  pathname: string,
  body: O.Option<Record<string, unknown>>
): Effect.fn.Return<unknown, ResearchCommandError, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const apiKey = yield* Config.redacted("NOTION_API_KEY").pipe(
    ResearchCommandError.mapError("NOTION_API_KEY is not set; export it or inject it via op run.")
  );
  const request = O.match(body, {
    onNone: () => HttpClientRequest.get(`${NOTION_API_URL}${pathname}`),
    onSome: (payload) =>
      HttpClientRequest.post(`${NOTION_API_URL}${pathname}`).pipe(HttpClientRequest.bodyJsonUnsafe(payload)),
  }).pipe(
    HttpClientRequest.setHeader("Authorization", `Bearer ${Redacted.value(apiKey)}`),
    HttpClientRequest.setHeader("Notion-Version", NOTION_VERSION)
  );
  const response = yield* client
    .execute(request)
    .pipe(ResearchCommandError.mapError(`Notion request to "${pathname}" failed.`));
  if (response.status >= 400) {
    const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    return yield* ResearchCommandError.make({
      message: `Notion request to "${pathname}" returned ${response.status}: ${Str.slice(0, 300)(text)}`,
    });
  }
  return yield* response.json.pipe(
    ResearchCommandError.mapError(`Notion response from "${pathname}" was not valid JSON.`)
  );
});

/**
 * Find the database id for a saved-links database by title.
 *
 * @internal
 * @category utilities
 */
export const findDatabaseId = Effect.fn("NotionPull.findDatabaseId")(function* (
  databaseTitle: string
): Effect.fn.Return<string, ResearchCommandError, HttpClient.HttpClient> {
  const raw = yield* notionRequest(
    "/v1/search",
    O.some({
      filter: { property: "object", value: "database" },
      query: databaseTitle,
    })
  );
  const response = yield* decodeSearchResponse(raw).pipe(
    ResearchCommandError.mapError("Notion search response failed schema validation.")
  );
  const first = A.head(A.filter(response.results, P.isNotUndefined));
  if (O.isNone(first)) {
    return yield* ResearchCommandError.make({
      message: `No Notion database matched "${databaseTitle}"; is it shared with the integration?`,
    });
  }
  const result = yield* decodeSearchResult(first.value).pipe(
    ResearchCommandError.mapError("Notion search result failed schema validation.")
  );
  return result.id;
});

const asRecord = (value: unknown): O.Option<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value) ? O.some(value as Record<string, unknown>) : O.none();

const plainTextOf = (richText: unknown): string =>
  A.isArray(richText)
    ? A.join(
        A.map(richText, (item) =>
          asRecord(item).pipe(
            O.flatMap((record) => O.fromNullishOr(record.plain_text)),
            O.filter(P.isString),
            O.getOrElse(() => "")
          )
        ),
        ""
      )
    : "";

const extractSavedLink = (page: unknown): O.Option<NotionSavedLink> =>
  asRecord(page).pipe(
    O.flatMap((record) => {
      const pageId = O.fromNullishOr(record.id).pipe(O.filter(P.isString));
      const properties = O.fromNullishOr(record.properties).pipe(O.flatMap(asRecord));
      if (O.isNone(pageId) || O.isNone(properties)) {
        return O.none();
      }
      let title = "";
      let url = O.none<string>();
      const tags: Array<string> = [];
      for (const property of R.values(properties.value)) {
        const record = asRecord(property);
        if (O.isNone(record)) {
          continue;
        }
        const multiSelect = record.value.multi_select;
        const kind = O.fromNullishOr(record.value.type).pipe(
          O.filter(P.isString),
          O.getOrElse(() => "")
        );
        if (kind === "title") {
          title = plainTextOf(record.value.title);
        } else if (kind === "url" && O.isNone(url)) {
          url = O.fromNullishOr(record.value.url).pipe(O.filter(P.isString), O.filter(Str.isNonEmpty));
        } else if (kind === "multi_select" && A.isArray(multiSelect)) {
          for (const option of multiSelect) {
            const name = asRecord(option).pipe(
              O.flatMap((optionRecord) => O.fromNullishOr(optionRecord.name)),
              O.filter(P.isString)
            );
            if (O.isSome(name)) {
              tags.push(name.value);
            }
          }
        }
      }
      const createdIso = O.fromNullishOr(record.created_time).pipe(
        O.filter(P.isString),
        O.getOrElse(() => "")
      );
      return O.some(
        NotionSavedLink.make({
          createdIso,
          pageId: pageId.value,
          tags,
          title: Str.isEmpty(Str.trim(title)) ? pageId.value : Str.trim(title),
          url,
        })
      );
    })
  );

const richTextTitle = (richText: unknown): string => plainTextOf(richText);

const richTextFirstHref = (richText: unknown): O.Option<string> => {
  if (!A.isArray(richText)) {
    return O.none();
  }
  for (const item of richText) {
    const href = asRecord(item).pipe(
      O.flatMap((record) => O.fromNullishOr(record.href)),
      O.filter(P.isString),
      O.filter(Str.isNonEmpty)
    );
    if (O.isSome(href)) {
      return href;
    }
  }
  return O.none();
};

const extractBlockLink = (block: unknown): O.Option<NotionSavedLink> =>
  asRecord(block).pipe(
    O.flatMap((record) => {
      const blockId = O.fromNullishOr(record.id).pipe(O.filter(P.isString));
      const kind = O.fromNullishOr(record.type).pipe(
        O.filter(P.isString),
        O.getOrElse(() => "")
      );
      const payload = O.fromNullishOr(record[kind]).pipe(O.flatMap(asRecord));
      if (O.isNone(blockId) || O.isNone(payload)) {
        return O.none();
      }
      const richText = payload.value.rich_text;
      const url = richTextFirstHref(richText);
      if (O.isNone(url)) {
        return O.none();
      }
      const title = Str.trim(richTextTitle(richText));
      const createdIso = O.fromNullishOr(record.created_time).pipe(
        O.filter(P.isString),
        O.getOrElse(() => "")
      );
      return O.some(
        NotionSavedLink.make({
          createdIso,
          pageId: blockId.value,
          tags: [],
          title: Str.isEmpty(title) ? url.value : title,
          url,
        })
      );
    })
  );

/**
 * Extract saved links from the block children of a plain Notion page (one
 * bulleted list item per link).
 *
 * @internal
 * @category utilities
 */
export const queryPageLinks = Effect.fn("NotionPull.queryPageLinks")(function* (
  pageId: string
): Effect.fn.Return<ReadonlyArray<NotionSavedLink>, ResearchCommandError, HttpClient.HttpClient> {
  const links: Array<NotionSavedLink> = [];
  let cursor: O.Option<string> = O.none();
  let firstPage = true;
  while (firstPage || O.isSome(cursor)) {
    firstPage = false;
    const query = O.match(cursor, {
      onNone: () => "?page_size=100",
      onSome: (value) => `?page_size=100&start_cursor=${encodeURIComponent(value)}`,
    });
    const raw: unknown = yield* notionRequest(`/v1/blocks/${pageId}/children${query}`, O.none());
    const response = yield* decodeQueryResponse(raw).pipe(
      ResearchCommandError.mapError("Notion block-children response failed schema validation.")
    );
    for (const block of response.results) {
      const link = extractBlockLink(block);
      if (O.isSome(link)) {
        links.push(link.value);
      }
    }
    cursor = response.has_more ? O.fromNullishOr(response.next_cursor) : O.none();
  }
  return links;
});

class SavedLinkInput extends S.Class<SavedLinkInput>($I`SavedLinkInput`)(
  {
    createdIso: S.String.pipe(S.optionalKey),
    tags: S.Array(S.String).pipe(S.optionalKey),
    title: S.String,
    url: S.String,
  },
  $I.annote("SavedLinkInput", {
    title: "Saved Link Input",
    description: "Local JSON backfill input row for research notion-pull.",
  })
) {}
const decodeSavedLinkInputsJson = S.decodeEffect(S.fromJsonString(S.Array(SavedLinkInput)));

/**
 * Read saved links from a local JSON file (backfill/testing seam).
 *
 * The file holds an array of `{ title, url, tags?, createdIso? }` objects.
 *
 * @internal
 * @category utilities
 */
export const readLinksFile = Effect.fn("NotionPull.readLinksFile")(function* (
  filePath: string
): Effect.fn.Return<ReadonlyArray<NotionSavedLink>, ResearchCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(ResearchCommandError.mapError(`Failed reading links file "${filePath}".`));
  const inputs = yield* decodeSavedLinkInputsJson(content).pipe(
    ResearchCommandError.mapError(`Links file "${filePath}" failed schema validation.`)
  );
  return A.map(inputs, (input) =>
    NotionSavedLink.make({
      createdIso: input.createdIso ?? "",
      pageId: sha256HexOf(input.url),
      tags: input.tags ?? [],
      title: Str.isEmpty(Str.trim(input.title)) ? input.url : Str.trim(input.title),
      url: O.some(input.url),
    })
  );
});

/**
 * Page through every row of the saved-links database.
 *
 * @internal
 * @category utilities
 */
export const querySavedLinks = Effect.fn("NotionPull.querySavedLinks")(function* (
  databaseId: string
): Effect.fn.Return<ReadonlyArray<NotionSavedLink>, ResearchCommandError, HttpClient.HttpClient> {
  const links: Array<NotionSavedLink> = [];
  let cursor: O.Option<string> = O.none();
  let firstPage = true;
  while (firstPage || O.isSome(cursor)) {
    firstPage = false;
    const raw: unknown = yield* notionRequest(
      `/v1/databases/${databaseId}/query`,
      O.some({
        page_size: 100,
        ...OptionUtils.getSomesStruct({ start_cursor: cursor }),
      })
    );
    const response = yield* decodeQueryResponse(raw).pipe(
      ResearchCommandError.mapError("Notion query response failed schema validation.")
    );
    for (const page of response.results) {
      const link = extractSavedLink(page);
      if (O.isSome(link)) {
        links.push(link.value);
      }
    }
    cursor = response.has_more ? O.fromNullishOr(response.next_cursor) : O.none();
  }
  return links;
});
