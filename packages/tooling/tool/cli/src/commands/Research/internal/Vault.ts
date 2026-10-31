/**
 * Vault filesystem helpers for research knowledge cards.
 *
 * The vault is a plain-markdown, Obsidian-compatible directory tree. Cards are
 * rendered with strict, stable YAML frontmatter for the owner to hand-edit.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { Yaml, YamlStringifyOptions } from "@beep/yaml/Yaml";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.ts";
import type { KnowledgeCardFrontmatter } from "../Research.schemas.ts";

/**
 * Environment variable naming the default vault root.
 *
 * @internal
 * @category utilities
 */
const VAULT_ENV_VAR = "BEEP_KNOWLEDGE_VAULT";

const DEFAULT_VAULT_RELATIVE = "YeeBois/knowledge";

/**
 * Vault subdirectories that ingesters write into.
 *
 * @internal
 * @category utilities
 */
export const VAULT_DIRS = {
  articles: "sources/articles",
  digest: "digest",
  inbox: "inbox",
  repos: "sources/repos",
  state: ".beep",
  xPosts: "sources/x-posts",
} as const;

/** Frontmatter property to YAML key mapping, in render order. */
const FRONTMATTER_KEYS = [
  ["id", "id"],
  ["title", "title"],
  ["url", "url"],
  ["sourceType", "source-type"],
  ["capturedAt", "captured-at"],
  ["via", "via"],
  ["status", "status"],
  ["tags", "tags"],
  ["related", "related"],
  ["cognifiedAt", "cognified-at"],
  ["contentHash", "content-hash"],
] as const satisfies ReadonlyArray<readonly [keyof KnowledgeCardFrontmatter, string]>;

/**
 * Resolve the vault root from a flag, the environment, or the default path.
 *
 * @internal
 * @category utilities
 */
export const resolveVaultRoot = Effect.fn("ResearchVault.resolveVaultRoot")(function* (
  vaultFlag: O.Option<string>
): Effect.fn.Return<string, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fromEnv = (yield* Effect.orDie(Config.String(VAULT_ENV_VAR).pipe(Config.option))).pipe(
    O.filter(Str.isNonEmpty)
  );
  const home = (yield* Effect.orDie(Config.String("HOME").pipe(Config.option))).pipe(O.filter(Str.isNonEmpty));
  const vaultRoot = vaultFlag.pipe(
    O.orElse(() => fromEnv),
    O.orElse(() => O.map(home, (dir) => path.join(dir, DEFAULT_VAULT_RELATIVE)))
  );
  if (O.isNone(vaultRoot)) {
    return yield* ResearchCommandError.make({
      message: `No vault root: pass --vault, set ${VAULT_ENV_VAR}, or ensure HOME is set.`,
    });
  }
  const exists = yield* fs
    .exists(vaultRoot.value)
    .pipe(ResearchCommandError.mapError(`Failed checking vault root "${vaultRoot.value}".`));
  if (!exists) {
    return yield* ResearchCommandError.make({
      message: `Vault root "${vaultRoot.value}" does not exist; create it or pass --vault.`,
    });
  }
  return vaultRoot.value;
});

/**
 * Normalize a URL for dedup: lowercase host, drop fragments and tracking
 * params, sort the remaining query, and trim trailing slashes.
 *
 * @internal
 * @param rawUrl - URL string to normalize.
 * @returns Normalized URL string.
 * @category utilities
 */
export const normalizeUrl = (rawUrl: string): Effect.Effect<string, ResearchCommandError> =>
  Effect.try({
    catch: (cause) => ResearchCommandError.new(cause, `Invalid URL "${rawUrl}".`),
    try: () => {
      const url = new URL(rawUrl);
      url.hash = "";
      const params = A.filter(
        [...url.searchParams.entries()],
        ([key]) => !Str.startsWith("utm_")(key) && key !== "fbclid" && key !== "gclid" && key !== "ref"
      ).sort(([a], [b]) => Str.localeCompare(b)(a));
      url.search = "";
      A.forEach(params, ([key, value]) => url.searchParams.append(key, value));
      if (url.pathname !== "/" && Str.endsWith("/")(url.pathname)) {
        url.pathname = Str.slice(0, -1)(url.pathname);
      }
      url.host = Str.toLowerCase(url.host);
      return url.toString();
    },
  });

/**
 * Hex-encoded SHA-256 of a UTF-8 string.
 *
 * @internal
 * @param content - UTF-8 content to hash.
 * @returns Hex-encoded SHA-256 digest.
 * @category utilities
 */
export const sha256HexOf = Effect.fn("ResearchVault.sha256HexOf")(function* (
  content: string
): Effect.fn.Return<string, ResearchCommandError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  return Hex.encode(
    yield* crypto
      .digest("SHA-256", new TextEncoder().encode(content))
      .pipe(ResearchCommandError.mapError("Failed hashing UTF-8 content."))
  );
});

/**
 * Build a filesystem slug from a card title and its normalized URL: kebab-case
 * title capped at 60 chars, suffixed with the first 8 hash chars for
 * uniqueness.
 *
 * @internal
 * @param title - Card title used for the slug prefix.
 * @param urlNorm - Normalized URL used for the uniqueness suffix.
 * @returns Filesystem-safe card slug.
 * @category utilities
 */
export const slugFor = Effect.fn("ResearchVault.slugFor")(function* (
  title: string,
  urlNorm: string
): Effect.fn.Return<string, ResearchCommandError, Crypto.Crypto> {
  const base = pipe(
    title,
    Str.toLowerCase,
    Str.replace(/[^a-z0-9]+/g, "-"),
    Str.replace(/^-+|-+$/g, ""),
    Str.slice(0, 60),
    Str.replace(/-+$/, "")
  );
  const suffix = Str.slice(0, 8)(yield* sha256HexOf(urlNorm));
  return Str.isEmpty(base) ? suffix : `${base}--${suffix}`;
});

// The `yaml` npm writer's layout the vault cards were written in: sequences
// indented under their key, double quotes when quoting is needed, no folding.
const cardYamlOptions = YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "double" });

/**
 * Render a knowledge card as YAML frontmatter followed by a markdown body.
 *
 * @internal
 * @param frontmatter - Structured frontmatter to render.
 * @param body - Markdown body content.
 * @returns Complete markdown card content.
 * @category utilities
 */
export const renderCard: {
  (body: string): (frontmatter: KnowledgeCardFrontmatter) => Effect.Effect<string, ResearchCommandError>;
  (frontmatter: KnowledgeCardFrontmatter, body: string): Effect.Effect<string, ResearchCommandError>;
} = dual(
  2,
  Effect.fn("ResearchVault.renderCard")(function* (frontmatter: KnowledgeCardFrontmatter, body: string) {
    const yamlSource: Array<readonly [string, unknown]> = A.flatMap(FRONTMATTER_KEYS, ([prop, key]) => {
      const value = frontmatter[prop];
      return P.isUndefined(value) ? [] : [[key, value] as const];
    });
    const rendered = yield* Yaml.stringify(R.fromEntries(yamlSource), cardYamlOptions).pipe(
      ResearchCommandError.mapError("Failed rendering card frontmatter as YAML.")
    );
    return `---\n${rendered}---\n\n${Str.trimEnd(body)}\n`;
  })
);

/**
 * Write a knowledge card beneath the vault root, creating parent directories.
 *
 * @internal
 * @category utilities
 */
export const writeCard = Effect.fn("ResearchVault.writeCard")(function* (
  vaultRoot: string,
  relativePath: string,
  content: string
): Effect.fn.Return<string, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(vaultRoot, relativePath);
  yield* fs
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(ResearchCommandError.mapError(`Failed creating card directory for "${relativePath}".`));
  yield* fs
    .writeFileString(absolutePath, content)
    .pipe(ResearchCommandError.mapError(`Failed writing card "${relativePath}".`));
  return absolutePath;
});
