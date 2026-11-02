import {
  KnowledgeCardFrontmatter,
  pullResearchNotionLinks,
  ResearchCommandServiceLive,
  ResearchNotionPullOptions,
  ResearchStatusOptions,
  researchStatus,
} from "@beep/repo-cli/commands/Research";
import { CardPersistRow, catalogDbPath, persistCards, sha256HexOf } from "@beep/repo-cli/test/Research";
import { decodeYamlTextWith } from "@beep/repo-cli/test/SharedInternals";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CardStatus } from "@beep/repo-cli/commands/Research";

const FAKE_MARKDOWN = "Effect schemas keep invariants on the data.\n\n## Why\n\nBecause decode walls rot.";
const FAKE_TITLE = "Schema-First Notes";
const FAKE_BODY = `# ${FAKE_TITLE}\n\n${FAKE_MARKDOWN}`;
// SHA-256 of FAKE_BODY; pinned so a change to the card hashing input shows up here.
const FAKE_BODY_SHA256 = "0e8230f942f810dc1a85244c077d2a26e97c4f027f5922bcd0fda44c886d3a49";
const CAPTURED_AT = "2026-10-21T00:00:00.000Z";
const decodeFrontmatter = decodeYamlTextWith(S.decodeUnknownEffect(S.Record(S.String, S.Unknown)));
const encodeLinksFile = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeCardFrontmatter = S.decodeUnknownEffect(KnowledgeCardFrontmatter);
const encodeCardFrontmatter = S.encodeEffect(KnowledgeCardFrontmatter);

// Nothing in this suite reaches the network: cards come from the local
// notion-pull links-file seam or from the catalog writer directly.
const testLayer = Layer.mergeAll(
  ResearchCommandServiceLive.pipe(
    Layer.provideMerge(
      FetchHttpClient.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
    )
  ),
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)
);

const makeVault = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "research-vault-" });
});

const articleCard = Effect.fn("ResearchCommandTest.articleCard")(function* (status: CardStatus) {
  return CardPersistRow.make({
    body: FAKE_BODY,
    frontmatter: KnowledgeCardFrontmatter.make({
      capturedAt: CAPTURED_AT,
      contentHash: yield* sha256HexOf(FAKE_BODY),
      id: "kb-article-schema-first-notes",
      related: [],
      sourceType: "article",
      status,
      tags: ["effect", "schema"],
      title: FAKE_TITLE,
      url: "https://example.com/posts/schema-first",
      via: "manual",
    }),
    relativePath: "sources/articles/schema-first-notes.md",
  });
});

it.layer(testLayer, { timeout: "30 seconds" })("research status", (it) => {
  it.effect("reports an empty summary for a vault without a catalog", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* makeVault;
      const status = yield* researchStatus(ResearchStatusOptions.make({ vaultRoot }));
      expect(status.totalCards).toBe(0);
      expect(status.seenUrls).toBe(0);
      expect(A.length(status.bySourceType)).toBe(0);
    })
  );

  it.effect("counts cards, inbox, pending cognify, seen URLs and source types in a populated catalog", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const vaultRoot = yield* makeVault;
      const linksRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-links-" });
      const linksFile = path.join(linksRoot, "links.json");
      yield* fs.writeFileString(
        linksFile,
        yield* encodeLinksFile([
          { title: "First Post", url: "https://example.com/first" },
          { title: "Second Post", url: "https://example.com/second" },
        ])
      );
      const pulled = yield* pullResearchNotionLinks(
        ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot })
      );
      expect(pulled.cardsWritten).toBe(2);
      yield* persistCards(vaultRoot, yield* catalogDbPath(vaultRoot), "manual", [yield* articleCard("triaged")]);

      const status = yield* researchStatus(ResearchStatusOptions.make({ vaultRoot }));
      expect(status.totalCards).toBe(3);
      expect(status.inboxCards).toBe(2);
      expect(status.pendingCognify).toBe(3);
      expect(status.seenUrls).toBe(3);
      expect(A.map(status.bySourceType, (row) => [row.sourceType, row.cards])).toEqual([
        ["article", 1],
        ["x-post", 2],
      ]);
    })
  );
});

describe("research card frontmatter", () => {
  it.effect.prop(
    "property: schema-generated frontmatter survives an encode/decode round trip",
    { frontmatter: Arbitrary.schema(KnowledgeCardFrontmatter) },
    ({ frontmatter }) =>
      Effect.gen(function* () {
        const decoded = yield* decodeCardFrontmatter(yield* encodeCardFrontmatter(frontmatter));
        expect(decoded).toEqual(frontmatter);
      }),
    { arbitrary: fcRuns(32) }
  );
});

it.layer(testLayer, { timeout: "30 seconds" })("research card output", (it) => {
  it.effect("renders schema-backed card frontmatter and body", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const vaultRoot = yield* makeVault;
      const card = yield* articleCard("inbox");
      yield* persistCards(vaultRoot, yield* catalogDbPath(vaultRoot), "manual", [card]);

      const content = yield* fs.readFileString(path.join(vaultRoot, card.relativePath));
      const frontmatter = O.getOrNull(Str.match(/^---\n([\s\S]*?)\n---\n/)(content));
      expect(frontmatter).not.toBeNull();
      const parsed = yield* decodeFrontmatter(frontmatter?.[1] ?? "");
      expect(parsed).toMatchObject({
        id: "kb-article-schema-first-notes",
        title: FAKE_TITLE,
        "source-type": "article",
        status: "inbox",
        tags: ["effect", "schema"],
        related: [],
        url: "https://example.com/posts/schema-first",
        via: "manual",
      });
      yield* S.decodeUnknownEffect(S.DateTimeUtcFromString)(parsed["captured-at"]);
      expect(parsed["content-hash"]).toBe(FAKE_BODY_SHA256);
      expect(Str.replace(/^---\n[\s\S]*?\n---\n\n/, "")(content)).toBe(`${FAKE_BODY}\n`);

      const status = yield* researchStatus(ResearchStatusOptions.make({ vaultRoot }));
      expect(status.totalCards).toBe(1);
      expect(status.inboxCards).toBe(1);
      expect(status.seenUrls).toBe(1);
    })
  );
});
