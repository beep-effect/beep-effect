import { Firecrawl } from "@beep/firecrawl";
import {
  captureResearchUrl,
  ResearchCaptureOptions,
  ResearchCommandServiceLive,
  ResearchStatusOptions,
  researchStatus,
} from "@beep/repo-cli/commands/Research";
import { decodeYamlTextWith } from "@beep/repo-cli/test/SharedInternals";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { FetchHttpClient } from "effect/http";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const FAKE_MARKDOWN = "Effect schemas keep invariants on the data.\n\n## Why\n\nBecause decode walls rot.";
const FAKE_TITLE = "Schema-First Notes";
const decodeFrontmatter = decodeYamlTextWith(S.decodeUnknownEffect(S.Record(S.String, S.Unknown)));

const fakeFirecrawlClient = {
  scrape: (url: string) =>
    Promise.resolve({
      markdown: FAKE_MARKDOWN,
      metadata: { sourceURL: url, title: FAKE_TITLE },
    }),
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

const makeVault = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "research-vault-" });
});

describe("research capture", () => {
  it.effect("scrapes a URL into a frontmattered card and records catalog rows", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const vaultRoot = yield* makeVault;

        const summary = yield* captureResearchUrl(
          ResearchCaptureOptions.make({
            tags: ["effect", "schema"],
            url: "https://example.com/posts/schema-first/?utm_source=x#section",
            vaultRoot,
          })
        );

        expect(summary.skipped).toBe(false);
        expect(summary.title).toBe(FAKE_TITLE);
        expect(Str.startsWith("sources/articles/")(summary.cardPath)).toBe(true);

        const content = yield* fs.readFileString(path.join(vaultRoot, summary.cardPath));
        expect(Str.startsWith("---\n")(content)).toBe(true);
        expect(content).toContain("source-type: article");
        expect(content).toContain("status: inbox");
        expect(content).toContain(FAKE_MARKDOWN.split("\n")[0]);
        // tracking params stripped, fragment dropped, trailing slash trimmed
        expect(content).toContain("url: https://example.com/posts/schema-first");
        expect(content).not.toContain("utm_source");

        const status = yield* researchStatus(ResearchStatusOptions.make({ vaultRoot }));
        expect(status.totalCards).toBe(1);
        expect(status.inboxCards).toBe(1);
        expect(status.pendingCognify).toBe(1);
        expect(status.seenUrls).toBe(1);
        expect(
          A.findFirst(status.bySourceType, (row) => row.sourceType === "article").pipe(
            O.map((row) => row.cards),
            O.getOrElse(() => 0)
          )
        ).toBe(1);
      })
    )
  );

  it.effect("skips re-capturing an already-seen URL, even with tracking params", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const vaultRoot = yield* makeVault;
        const first = yield* captureResearchUrl(
          ResearchCaptureOptions.make({ tags: [], url: "https://example.com/posts/schema-first", vaultRoot })
        );
        const second = yield* captureResearchUrl(
          ResearchCaptureOptions.make({
            tags: [],
            url: "https://example.com/posts/schema-first?utm_medium=social",
            vaultRoot,
          })
        );
        expect(first.skipped).toBe(false);
        expect(second.skipped).toBe(true);

        const status = yield* researchStatus(ResearchStatusOptions.make({ vaultRoot }));
        expect(status.totalCards).toBe(1);
        expect(status.seenUrls).toBe(1);
      })
    )
  );

  it.effect("reports an empty summary for a vault without a catalog", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const vaultRoot = yield* makeVault;
        const status = yield* researchStatus(ResearchStatusOptions.make({ vaultRoot }));
        expect(status.totalCards).toBe(0);
        expect(status.seenUrls).toBe(0);
        expect(A.length(status.bySourceType)).toBe(0);
      })
    )
  );

  it.effect("renders schema-backed card frontmatter and body", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const vaultRoot = yield* makeVault;
        const summary = yield* captureResearchUrl(
          ResearchCaptureOptions.make({ tags: ["effect"], url: "https://example.com/a", vaultRoot })
        );
        const content = yield* fs.readFileString(path.join(vaultRoot, summary.cardPath));
        const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/);
        expect(frontmatter).not.toBeNull();
        expect(content).toContain(`id: ${summary.id}`);
        const parsed = yield* decodeFrontmatter(frontmatter?.[1] ?? "");
        expect(parsed).toMatchObject({
          id: summary.id,
          title: FAKE_TITLE,
          "source-type": "article",
          status: "inbox",
          tags: ["effect"],
          related: [],
          url: "https://example.com/a",
          via: "capture",
        });
        yield* S.decodeUnknownEffect(S.DateTimeUtcFromString)(parsed["captured-at"]);
        expect(parsed["content-hash"]).toBe("0e8230f942f810dc1a85244c077d2a26e97c4f027f5922bcd0fda44c886d3a49");
        expect(Str.replace(/^---\n[\s\S]*?\n---\n\n/, "")(content)).toBe(`# ${FAKE_TITLE}\n\n${FAKE_MARKDOWN}\n`);
      })
    )
  );
});
