/**
 * Tests for the Claude Code plugin marketplace schema.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import {
  GithubPluginSource,
  GitSubdirPluginSource,
  MarketplaceFile,
  NpmPluginSource,
  UrlPluginSource,
} from "../../../claudecode/Plugin/Marketplace.ts";

const decodeMarketplace = S.decodeUnknownEffect(MarketplaceFile);
const encodeMarketplace = S.encodeEffect(MarketplaceFile);

// ---------------------------------------------------------------------------
// MarketplaceFile
// ---------------------------------------------------------------------------

describe("MarketplaceFile", () => {
  it.effect("decodes current metadata, source variants, and entry overrides", () =>
    Effect.gen(function* () {
      const marketplace = yield* decodeMarketplace({
        $schema: "https://code.claude.com/schemas/marketplace.json",
        name: "company-marketplace",
        version: "1.0.0",
        description: "Internal plugin catalog",
        owner: {
          name: "Platform Team",
          email: "platform@example.com",
        },
        metadata: { pluginRoot: "./plugins" },
        allowCrossMarketplaceDependenciesOn: ["trusted-partner"],
        plugins: [
          {
            name: "local-plugin",
            source: "./local-plugin",
            displayName: "Local Plugin",
            category: "productivity",
            tags: ["review", "ci"],
            defaultEnabled: false,
            skills: ["./skills/"],
            hooks: "./hooks/hooks.json",
          },
          {
            name: "github-plugin",
            source: {
              source: "github",
              repo: "acme/plugin",
              sha: "abc123",
            },
          },
          {
            name: "url-plugin",
            source: {
              source: "url",
              url: "https://plugins.example.com/plugin.tar.gz",
              ref: "stable",
              sha: "def456",
            },
          },
          {
            name: "subdir-plugin",
            source: {
              source: "git-subdir",
              url: "https://git.example.com/plugins.git",
              path: "packages/claude-plugin",
              ref: "main",
            },
          },
          {
            name: "npm-plugin",
            source: {
              source: "npm",
              package: "@acme/claude-plugin",
              version: "^1.0.0",
              registry: "https://registry.npmjs.org",
            },
          },
        ],
      });

      expect(marketplace).toMatchObject({
        name: "company-marketplace",
        metadata: O.some({ pluginRoot: O.some("./plugins") }),
        allowCrossMarketplaceDependenciesOn: O.some(["trusted-partner"]),
      });
      expect(marketplace.plugins).toHaveLength(5);
      expect(marketplace.plugins[1]?.source).toBeInstanceOf(GithubPluginSource);
      expect(marketplace.plugins[2]?.source).toBeInstanceOf(UrlPluginSource);
      expect(marketplace.plugins[3]?.source).toBeInstanceOf(GitSubdirPluginSource);
      expect(marketplace.plugins[4]?.source).toBeInstanceOf(NpmPluginSource);
      expect(marketplace.plugins[0]).toMatchObject({
        displayName: O.some("Local Plugin"),
        category: O.some("productivity"),
        tags: O.some(["review", "ci"]),
        defaultEnabled: O.some(false),
        skills: O.some(["./skills/"]),
        hooks: O.some("./hooks/hooks.json"),
      });
      const encoded = yield* encodeMarketplace(marketplace);
      expect(encoded).toMatchObject({
        name: "company-marketplace",
        metadata: { pluginRoot: "./plugins" },
        allowCrossMarketplaceDependenciesOn: ["trusted-partner"],
      });
      expect(encoded.plugins[0]).toEqual({
        name: "local-plugin",
        source: "./local-plugin",
        displayName: "Local Plugin",
        category: "productivity",
        tags: ["review", "ci"],
        defaultEnabled: false,
        skills: ["./skills/"],
        hooks: "./hooks/hooks.json",
      });
    })
  );

  it.effect("requires owner metadata", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeMarketplace({
          name: "invalid-marketplace",
          plugins: [],
        })
      );
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});
