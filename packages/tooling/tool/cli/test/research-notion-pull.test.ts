import { Firecrawl } from "@beep/firecrawl";
import {
  pullResearchNotionLinks,
  ResearchCommandServiceLive,
  ResearchNotionPullOptions,
} from "@beep/repo-cli/commands/Research";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { FetchHttpClient } from "effect/http";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Nothing in this suite reaches Notion: every run reads the local links-file
// backfill seam, which is the same code path minus the HTTP request.
const fakeFirecrawlClient = {
  scrape: () => Promise.resolve({ markdown: "", metadata: {} }),
} as never;

const testLayer = Layer.mergeAll(
  ResearchCommandServiceLive.pipe(
    Layer.provideMerge(
      Layer.mergeAll(Firecrawl.makeLayerFromClient(fakeFirecrawlClient), FetchHttpClient.layer).pipe(
        Layer.provideMerge(NodeServices.layer)
      )
    )
  ),
  NodeServices.layer
);

const provideTestLayer = provideScopedLayer(testLayer);
const encodeLinksFile = S.encodeEffect(UnknownFromJsonString);

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

describe("research notion-pull", () => {
  it.effect("writes one x-post card per usable saved link and skips the rest", () =>
    provideTestLayer(
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
    )
  );

  it.effect("skips a link the catalog has already seen on a second pull", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const { linksFile, vaultRoot } = yield* makeFixture(A.take(LINKS, 1));
        const options = ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot });

        const first = yield* pullResearchNotionLinks(options);
        const second = yield* pullResearchNotionLinks(options);

        expect(first.cardsWritten).toBe(1);
        expect(second.cardsWritten).toBe(0);
        expect(second.skippedSeen).toBe(1);
      })
    )
  );

  it.effect("fails with the links-file path when the file is not valid JSON", () =>
    provideTestLayer(
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
    )
  );

  it.effect("fails with the links-file path when the file is missing", () =>
    provideTestLayer(
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
    )
  );
});
