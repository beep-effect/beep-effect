import {
  pullResearchNotionLinks,
  ResearchCommandServiceLive,
  ResearchNotionPullOptions,
} from "@beep/repo-cli/commands/Research";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Nothing in this suite reaches Notion: every run reads the local links-file
// backfill seam, which is the same code path minus the HTTP request.
const testLayer = Layer.mergeAll(
  ResearchCommandServiceLive.pipe(
    Layer.provideMerge(
      FetchHttpClient.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
    )
  ),
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)
);

const encodeLinksFile = S.encodeEffect(S.fromJsonString(S.Unknown));

const LINKS = [
  { createdIso: "2026-07-08T12:00:00.000Z", tags: ["effect"], title: "Schema First", url: "https://example.com/a/" },
  // No title and no createdIso: the URL stands in for both.
  { title: "  ", url: "https://example.com/b?utm_source=x#frag" },
  // Not a URL at all: the row is skipped instead of failing the pull.
  { title: "Broken", url: "not-a-url" },
];

const makeFixture = Effect.fn("ResearchNotionPullTest.makeFixture")(function* (links: ReadonlyArray<unknown>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-notion-" });
  const linksFile = path.join(vaultRoot, "links.json");
  yield* fs.writeFileString(linksFile, yield* encodeLinksFile(links));
  return { linksFile, vaultRoot };
});

// A Notion block-children page: one bulleted link, one non-object entry and one
// paragraph with no href. Only the first is a saved link; the other two exercise
// the rejection paths of the record narrowing the API parser relies on.
const BLOCK_CHILDREN = {
  object: "list",
  has_more: false,
  next_cursor: null,
  results: [
    {
      id: "block-link",
      type: "bulleted_list_item",
      created_time: "2026-07-08T12:00:00.000Z",
      bulleted_list_item: {
        rich_text: [{ plain_text: "Schema First", href: "https://example.com/a/" }],
      },
    },
    "not-a-block",
    { id: "block-text", type: "paragraph", paragraph: { rich_text: [{ plain_text: "no link" }] } },
  ],
};

const stubNotionLayer = Layer.mergeAll(
  ResearchCommandServiceLive.pipe(
    Layer.provideMerge(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          encodeLinksFile(BLOCK_CHILDREN).pipe(
            Effect.map((body) =>
              HttpClientResponse.fromWeb(
                request,
                new Response(body, { status: 200, headers: { "content-type": "application/json" } })
              )
            ),
            Effect.orDie
          )
        )
      ).pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
    )
  ),
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)
);

it.layer(testLayer, { timeout: "30 seconds" })("research notion-pull", (it) => {
  it.effect("writes one x-post card per usable saved link and skips the rest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { linksFile, vaultRoot } = yield* makeFixture(LINKS);

      const summary = yield* pullResearchNotionLinks(
        ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot })
      );

      expect(summary.pagesSeen).toBe(3);
      expect(summary.cardsWritten).toBe(2);
      expect(summary.skippedSeen).toBe(1);

      const xPosts = path.join(vaultRoot, "sources/x-posts");
      const written = yield* fs.readDirectory(xPosts);
      expect(A.length(written)).toBe(2);
      const cards = yield* Effect.forEach(written, (name) => fs.readFileString(path.join(xPosts, name)));
      expect(A.every(cards, (card) => Str.includes("source-type: x-post")(card))).toBe(true);
      expect(A.some(cards, (card) => Str.includes('Saved to Notion ("Reading List")')(card))).toBe(true);
      expect(A.some(cards, (card) => Str.includes("title: Schema First")(card))).toBe(true);
    })
  );

  it.effect("skips a link the catalog has already seen on a second pull", () =>
    Effect.gen(function* () {
      const { linksFile, vaultRoot } = yield* makeFixture(A.take(LINKS, 1));
      const options = ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot });

      const first = yield* pullResearchNotionLinks(options);
      const second = yield* pullResearchNotionLinks(options);

      expect(first.cardsWritten).toBe(1);
      expect(second.cardsWritten).toBe(0);
      expect(second.skippedSeen).toBe(1);
    })
  );

  it.effect("fails with the links-file path when the file is not valid JSON", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-notion-" });
      const linksFile = path.join(vaultRoot, "links.json");
      yield* fs.writeFileString(linksFile, "{ not json");

      const error = yield* Effect.flip(
        pullResearchNotionLinks(ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot }))
      );
      expect(error.message).toContain("failed schema validation");
    })
  );

  it.effect("fails with the links-file path when the file is missing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-notion-" });
      const linksFile = path.join(vaultRoot, "absent.json");

      const error = yield* Effect.flip(
        pullResearchNotionLinks(ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot }))
      );
      expect(error.message).toContain("Failed reading links file");
    })
  );
});

layer(stubNotionLayer, { timeout: "10 seconds" })("research notion-pull over the Notion API", (it) => {
  it.effect("pulls saved links from a Notion page's block children", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-notion-api-" });

      const summary = yield* pullResearchNotionLinks(
        ResearchNotionPullOptions.make({ database: "Reading List", pageId: "page-1", vaultRoot })
      );

      expect(summary.pagesSeen).toBe(1);
      expect(summary.cardsWritten).toBe(1);
    }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ NOTION_API_KEY: "test-key" }))
    )
  );
});
