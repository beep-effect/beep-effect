/**
 * Vault filesystem helpers for research knowledge cards.
 *
 * The vault is a plain-markdown, Obsidian-compatible directory tree. Cards are
 * rendered with strict, stable YAML frontmatter but parsed leniently because
 * the owner hand-edits them.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { Config, Effect, FileSystem, Path } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Yaml from "yaml";
import { ResearchCommandError } from "../Research.errors.ts";
import { KnowledgeCardFrontmatter } from "../Research.schemas.ts";

/**
 * Environment variable naming the default vault root.
 *
 * @internal
 * @category utilities
 */
export const VAULT_ENV_VAR = "BEEP_KNOWLEDGE_VAULT";

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

const decodeFrontmatter = S.decodeUnknownEffect(KnowledgeCardFrontmatter);

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
  const fromEnv = (yield* Effect.orDie(Config.string(VAULT_ENV_VAR).pipe(Config.option))).pipe(
    O.filter(Str.isNonEmpty)
  );
  const home = (yield* Effect.orDie(Config.string("HOME").pipe(Config.option))).pipe(O.filter(Str.isNonEmpty));
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
      const params = [...url.searchParams.entries()]
        .filter(([key]) => !key.startsWith("utm_") && key !== "fbclid" && key !== "gclid" && key !== "ref")
        .sort(([a], [b]) => a.localeCompare(b));
      url.search = "";
      params.forEach(([key, value]) => url.searchParams.append(key, value));
      if (url.pathname !== "/" && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
      }
      url.host = url.host.toLowerCase();
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
export const sha256HexOf = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex");

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
export const slugFor: {
  (urlNorm: string): (title: string) => string;
  (title: string, urlNorm: string): string;
} = dual(2, (title: string, urlNorm: string): string => {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  const suffix = sha256HexOf(urlNorm).slice(0, 8);
  return Str.isEmpty(base) ? suffix : `${base}--${suffix}`;
});

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
  (body: string): (frontmatter: KnowledgeCardFrontmatter) => string;
  (frontmatter: KnowledgeCardFrontmatter, body: string): string;
} = dual(2, (frontmatter: KnowledgeCardFrontmatter, body: string): string => {
  const yamlSource: Array<readonly [string, unknown]> = FRONTMATTER_KEYS.flatMap(([prop, key]) => {
    const value = frontmatter[prop];
    return P.isUndefined(value) ? [] : [[key, value] as const];
  });
  const rendered = Yaml.stringify(R.fromEntries(yamlSource), { lineWidth: 0 });
  return `---\n${rendered}---\n\n${body.trimEnd()}\n`;
});

/**
 * Parse a knowledge card leniently: tolerate missing collection fields and
 * unknown keys, but fail on a missing or malformed frontmatter fence.
 *
 * @internal
 * @category utilities
 */
export const parseCard = Effect.fn("ResearchVault.parseCard")(function* (
  cardPath: string,
  content: string
): Effect.fn.Return<{ readonly body: string; readonly frontmatter: KnowledgeCardFrontmatter }, ResearchCommandError> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (P.isNull(match)) {
    return yield* ResearchCommandError.make({ message: `Card "${cardPath}" has no YAML frontmatter fence.` });
  }
  const raw = yield* Effect.try({
    catch: (cause) => ResearchCommandError.new(cause, `Card "${cardPath}" has malformed YAML frontmatter.`),
    try: () => Yaml.parse(match[1] ?? "") as Record<string, unknown>,
  });
  const presentEntries: Array<readonly [string, unknown]> = FRONTMATTER_KEYS.flatMap(([prop, key]) =>
    P.isUndefined(raw[key]) ? [] : [[prop, raw[key]] as const]
  );
  const withDefaults = {
    related: [],
    tags: [],
    ...R.fromEntries(presentEntries),
  };
  const frontmatter = yield* decodeFrontmatter(withDefaults).pipe(
    ResearchCommandError.mapError(`Card "${cardPath}" frontmatter failed schema validation.`)
  );
  return { body: content.slice(match[0].length).replace(/^\n+/, ""), frontmatter };
});

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
