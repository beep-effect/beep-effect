/**
 * Chromium browser-history reading and link heuristics for research
 * history-sift.
 *
 * Chromium locks its `History` sqlite file while the browser runs, so each
 * profile database is copied into a scoped OS temp directory before DuckDB's
 * sqlite scanner reads the copy.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import { Config, DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ResearchCommandError } from "../Research.errors.js";
import type { BrowserKind } from "../Research.schemas.js";

const $I = $RepoCliId.create("commands/Research/internal/BrowserHistory");
type BrowserProfileKind = Exclude<BrowserKind, "all">;

/**
 * Seconds between the Chrome epoch (1601-01-01) and the Unix epoch.
 *
 * @internal
 * @category utilities
 */
export const CHROME_EPOCH_OFFSET_SECONDS = 11_644_473_600;

/**
 * One discovered browser profile history database.
 *
 * @internal
 * @category models
 */
export class BrowserProfile extends S.Class<BrowserProfile>($I`BrowserProfile`)(
  {
    browser: S.Union([S.Literal("brave"), S.Literal("chrome")]),
    historyPath: S.String,
    profile: S.String,
  },
  $I.annote("BrowserProfile", {
    title: "Browser Profile",
    description: "One discovered Chromium-family browser profile history database.",
  })
) {}

/**
 * One history row surviving the time cutoff.
 *
 * @internal
 * @category models
 */
export class HistoryUrlRow extends S.Class<HistoryUrlRow>($I`HistoryUrlRow`)(
  {
    lastVisitChrome: S.Finite,
    title: S.String,
    url: S.String,
    visitCount: S.Finite,
  },
  $I.annote("HistoryUrlRow", {
    title: "History URL Row",
    description: "One browser history URL row surviving the configured time cutoff.",
  })
) {}

const decodeHistoryUrlRows = S.decodeUnknownEffect(S.Array(HistoryUrlRow));

const BROWSER_CONFIG_DIRS: ReadonlyArray<readonly [BrowserProfileKind, string]> = [
  ["brave", ".config/BraveSoftware/Brave-Browser"],
  ["chrome", ".config/google-chrome"],
];

/**
 * Discover profile `History` databases for the requested browser family.
 *
 * @internal
 * @category utilities
 */
export const discoverProfiles = Effect.fn("BrowserHistory.discoverProfiles")(function* (
  browser: BrowserKind
): Effect.fn.Return<ReadonlyArray<BrowserProfile>, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = (yield* Effect.orDie(Config.string("HOME").pipe(Config.option))).pipe(O.filter(Str.isNonEmpty));
  if (O.isNone(home)) {
    return yield* ResearchCommandError.make({ message: "HOME is not set; cannot locate browser profiles." });
  }

  const targets = A.filter(BROWSER_CONFIG_DIRS, ([kind]) => browser === "all" || browser === kind);
  const profiles: Array<BrowserProfile> = [];
  for (const [kind, configDir] of targets) {
    const browserRoot = path.join(home.value, configDir);
    const rootExists = yield* fs
      .exists(browserRoot)
      .pipe(ResearchCommandError.mapError(`Failed checking browser directory "${browserRoot}".`));
    if (!rootExists) {
      continue;
    }
    const entries = yield* fs
      .readDirectory(browserRoot)
      .pipe(ResearchCommandError.mapError(`Failed listing browser directory "${browserRoot}".`));
    for (const entry of entries) {
      const historyPath = path.join(browserRoot, entry, "History");
      const hasHistory = yield* fs.exists(historyPath).pipe(Effect.orElseSucceed(() => false));
      if (hasHistory) {
        profiles.push(BrowserProfile.make({ browser: kind, historyPath, profile: entry }));
      }
    }
  }
  return profiles;
});

/**
 * Copy a locked profile history database and read recent rows through
 * DuckDB's sqlite scanner.
 *
 * @internal
 * @category utilities
 */
export const readProfileHistory = Effect.fn("BrowserHistory.readProfileHistory")(function* (
  profile: BrowserProfile,
  scratchDir: string,
  sinceChromeEpochMicros: number
): Effect.fn.Return<ReadonlyArray<HistoryUrlRow>, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(scratchDir, { recursive: true })
    .pipe(ResearchCommandError.mapError(`Failed creating history scratch directory "${scratchDir}".`));
  const copyPath = path.join(scratchDir, `${profile.browser}-${profile.profile.replaceAll(" ", "_")}-History.sqlite`);
  yield* fs
    .copyFile(profile.historyPath, copyPath)
    .pipe(ResearchCommandError.mapError(`Failed copying locked history database "${profile.historyPath}".`));

  // sqlite_scan requires a literal string argument, so the path cannot be a
  // bound parameter; it is a locally-derived temp path with quotes escaped.
  const escapedPath = copyPath.replaceAll("'", "''");
  const statement = `SELECT
      url AS "url",
      COALESCE(title, '') AS "title",
      CAST(visit_count AS DOUBLE) AS "visitCount",
      CAST(last_visit_time AS DOUBLE) AS "lastVisitChrome"
    FROM sqlite_scan('${escapedPath}', 'urls')
    WHERE last_visit_time > ${Math.floor(sinceChromeEpochMicros)}
    ORDER BY last_visit_time ASC`;

  const rows = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const db = yield* DuckDb;
          yield* db.runMany(["INSTALL sqlite", "LOAD sqlite"]);
          return yield* db.query(statement);
        }).pipe(Effect.provide(context))
      )
    )
  ).pipe(
    ResearchCommandError.mapError(`Failed scanning history copy "${copyPath}".`),
    Effect.ensuring(fs.remove(copyPath).pipe(Effect.ignore))
  );
  return yield* decodeHistoryUrlRows(rows).pipe(
    ResearchCommandError.mapError(`History rows from "${profile.historyPath}" failed schema validation.`)
  );
});

/**
 * Convert a Unix-seconds timestamp to Chrome epoch microseconds.
 *
 * @internal
 * @param unixSeconds - Unix timestamp in seconds.
 * @returns Chrome epoch timestamp in microseconds.
 * @category utilities
 */
export const unixSecondsToChromeMicros = (unixSeconds: number): number =>
  (unixSeconds + CHROME_EPOCH_OFFSET_SECONDS) * 1_000_000;

/**
 * Convert Chrome epoch microseconds to an ISO timestamp.
 *
 * @internal
 * @param chromeMicros - Chrome epoch timestamp in microseconds.
 * @returns ISO timestamp for the same instant.
 * @category utilities
 */
export const chromeMicrosToIso = (chromeMicros: number): string =>
  DateTime.formatIso(DateTime.makeUnsafe(Math.floor((chromeMicros / 1_000_000 - CHROME_EPOCH_OFFSET_SECONDS) * 1000)));

const DENY_PATTERNS: ReadonlyArray<RegExp> = [
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
  /^https?:\/\/[^/]*\.localhost/i,
  /^(chrome|brave|about|file|chrome-extension):/i,
  /^https?:\/\/[^/]*(google|bing|duckduckgo)\.[^/]+\/search/i,
  /^https?:\/\/search\.brave\.com/i,
  /^https?:\/\/[^/]*\b(login|signin|sign-in|auth|sso|oauth|accounts?|logout)\b[^/]*\//i,
  /[?&](code|state|id_token|access_token|session_state)=/i,
  /^https?:\/\/(mail|outlook|calendar|drive|docs|meet|chat)\.(google|live|office)\.com/i,
  /^https?:\/\/outlook\.(live|office)\.com/i,
  /^https?:\/\/(www\.)?(youtube\.com|netflix\.com|twitch\.tv|reddit\.com\/?$)/i,
  /^https?:\/\/(www\.)?github\.com\/?$/i,
  /^https?:\/\/github\.com\/(login|logout|notifications|settings|search)/i,
  /^https?:\/\/(www\.)?x\.com\/(home|notifications|messages|explore|search)/i,
  /^https?:\/\/(www\.)?notion\.(so|com)/i,
  /^https?:\/\/app\.notion\.com/i,
];

const ALLOW_PATTERNS: ReadonlyArray<RegExp> = [
  /^https?:\/\/github\.com\/[^/]+\/[^/]+/i,
  /^https?:\/\/gitlab\.com\/[^/]+\/[^/]+/i,
  /^https?:\/\/(www\.)?arxiv\.org\//i,
  /^https?:\/\/(www\.)?x\.com\/[^/]+\/status\/\d+/i,
  /^https?:\/\/(www\.)?twitter\.com\/[^/]+\/status\/\d+/i,
  /^https?:\/\/[^/]*\b(docs|blog|dev|engineering|research)\b[^/]*\//i,
  /^https?:\/\/[^/]*\.(dev|blog)\//i,
  /^https?:\/\/[^/]*substack\.com\//i,
  /^https?:\/\/(www\.)?medium\.com\/.+/i,
  /^https?:\/\/news\.ycombinator\.com\/item/i,
  /^https?:\/\/(www\.)?npmjs\.com\/package\//i,
  /^https?:\/\/(www\.)?huggingface\.co\/.+/i,
  /^https?:\/\/(www\.)?(effect|effect-ts)\.website/i,
  /^https?:\/\/(www\.)?anthropic\.com\/.+/i,
  /^https?:\/\/[^/]*uspto\.gov\/.+/i,
  /^https?:\/\/(www\.)?courtlistener\.com\/.+/i,
  /^https?:\/\/(www\.)?ecfr\.gov\/.+/i,
  /^https?:\/\/(www\.)?law\.cornell\.edu\/.+/i,
];

/**
 * Decide whether a visited URL is worth a knowledge-inbox stub.
 *
 * Denylisted noise (searches, auth, mail, app chrome) always loses; the
 * remaining URLs must match an interest pattern (repos, papers, posts, docs,
 * law sources) to keep the inbox high-signal.
 *
 * @internal
 * @param url - Visited URL to evaluate.
 * @returns Whether the URL should create a knowledge-inbox stub.
 * @category utilities
 */
export const isInterestingUrl = (url: string): boolean =>
  !A.some(DENY_PATTERNS, (pattern) => pattern.test(url)) && A.some(ALLOW_PATTERNS, (pattern) => pattern.test(url));

/**
 * Collapse repository subpages to their repository root so one browsing
 * session over a repo yields one stub instead of ten.
 *
 * @internal
 * @param url - URL to canonicalize for sift deduplication.
 * @returns Repository root URL for supported git hosts, otherwise the original URL.
 * @category utilities
 */
export const canonicalizeForSift = (url: string): string => {
  const repoMatch = url.match(/^https?:\/\/(github|gitlab)\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (repoMatch !== null) {
    return `https://${Str.toLowerCase(repoMatch[1] ?? "")}.com/${repoMatch[2]}/${repoMatch[3]}`;
  }
  return url;
};
