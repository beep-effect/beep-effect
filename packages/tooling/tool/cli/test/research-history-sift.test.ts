import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { ResearchHistorySiftOptions } from "@beep/repo-cli/commands/Research";
import { discoverProfiles, historySiftImpl, VAULT_DIRS } from "@beep/repo-cli/test/Research";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { FetchHttpClient } from "effect/http";
import * as Str from "effect/String";

const provideTestLayer = provideScopedLayer(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer));

// Per-test configuration is a pure provider value, so HOME is provided as a
// service instead of touching the real one: nothing here may read the
// operator's own browser profiles.
const withHome = (env: Readonly<Record<string, string>>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

const CHROME_CONFIG_DIR = ".config/google-chrome";
const BRAVE_CONFIG_DIR = ".config/BraveSoftware/Brave-Browser";

// One Chromium history row as the `urls` table stores it.
interface HistoryRow {
  readonly lastVisitTime: number;
  readonly title: string;
  readonly url: string;
  readonly visitCount: number;
}

// Chrome-epoch microseconds well inside any sift window measured from the
// suite's test clock.
const VISITED_AT = 13_400_000_000_000_000;

const ROWS: ReadonlyArray<HistoryRow> = [
  // Two pages of one repository collapse to a single repository-root stub, and
  // the later visit wins the title.
  {
    lastVisitTime: VISITED_AT,
    title: "Effect README",
    url: "https://github.com/effect-ts/effect/blob/main/README.md",
    visitCount: 3,
  },
  {
    lastVisitTime: VISITED_AT + 1_000,
    title: "Effect packages",
    url: "https://github.com/effect-ts/effect/tree/main/packages",
    visitCount: 5,
  },
  // Denylisted noise: a search results page never becomes a stub.
  { lastVisitTime: VISITED_AT, title: "effect - search", url: "https://www.google.com/search?q=effect", visitCount: 1 },
  // A blank title falls back to the normalized URL.
  { lastVisitTime: VISITED_AT, title: "   ", url: "https://arxiv.org/abs/2401.00001", visitCount: 2 },
];

// Chromium stores history in SQLite and the sift reads it through DuckDB's
// sqlite scanner; the same scanner writes the fixture, so the test exercises
// the real file format instead of a stand-in.
const seedHistory = Effect.fn("ResearchHistorySiftTest.seedHistory")(function* (
  historyPath: string,
  rows: ReadonlyArray<HistoryRow>
) {
  yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const db = yield* DuckDb;
          yield* db.runMany([
            "INSTALL sqlite",
            "LOAD sqlite",
            `ATTACH '${historyPath}' AS history (TYPE sqlite)`,
            "CREATE TABLE history.urls (url VARCHAR, title VARCHAR, visit_count BIGINT, last_visit_time BIGINT)",
          ]);
          yield* Effect.forEach(
            rows,
            (row) =>
              db.run("INSERT INTO history.urls VALUES (?, ?, ?, ?)", [
                row.url,
                row.title,
                row.visitCount,
                row.lastVisitTime,
              ]),
            { discard: true }
          );
          yield* db.run("DETACH history");
        }).pipe(Effect.provide(context))
      )
    )
  );
});

// A home directory holding the requested Chromium config roots. Each root has
// one profile without a History database and one with it.
const makeHome = Effect.fn("ResearchHistorySiftTest.makeHome")(function* (
  configDirs: ReadonlyArray<string>,
  rows: ReadonlyArray<HistoryRow> = A.empty<HistoryRow>()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "research-home-" });
  yield* Effect.forEach(
    configDirs,
    Effect.fnUntraced(function* (configDir) {
      const root = path.join(home, configDir);
      yield* fs.makeDirectory(path.join(root, "Default"), { recursive: true });
      yield* fs.makeDirectory(path.join(root, "Profile 1"), { recursive: true });
      const historyPath = path.join(root, "Profile 1", "History");
      yield* A.isReadonlyArrayNonEmpty(rows)
        ? seedHistory(historyPath, rows)
        : fs.writeFileString(historyPath, Str.empty);
    }),
    { discard: true }
  );
  return home;
});

describe("discoverProfiles", () => {
  it.effect("fails when HOME is not configured", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const error = yield* Effect.flip(discoverProfiles("all").pipe(withHome({})));
        expect(error.message).toContain("HOME is not set");
      })
    )
  );

  it.effect("keeps only profile directories that carry a History database", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const home = yield* makeHome([CHROME_CONFIG_DIR]);
        const profiles = yield* discoverProfiles("chrome").pipe(withHome({ HOME: home }));

        expect(profiles).toMatchObject([{ browser: "chrome", profile: "Profile 1" }]);
      })
    )
  );

  // "all" walks both families; a browser that was never installed is skipped
  // rather than failing the scan.
  it.effect("skips a browser family whose config root does not exist", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const home = yield* makeHome([BRAVE_CONFIG_DIR]);
        const profiles = yield* discoverProfiles("all").pipe(withHome({ HOME: home }));

        expect(profiles).toMatchObject([{ browser: "brave" }]);
      })
    )
  );

  it.effect("finds nothing when no Chromium family is installed", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const home = yield* makeHome([]);
        expect(A.length(yield* discoverProfiles("all").pipe(withHome({ HOME: home })))).toBe(0);
      })
    )
  );
});

describe("historySiftImpl", () => {
  it.effect("reports an empty sift and writes no stubs when no profile exists", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome([]);
        const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-vault-" });

        const summary = yield* historySiftImpl(
          ResearchHistorySiftOptions.make({ browser: "all", sinceDays: NonNegativeInt.make(7), vaultRoot })
        ).pipe(withHome({ HOME: home }));

        expect(summary.profilesScanned).toBe(0);
        expect(summary.urlsScanned).toBe(0);
        expect(summary.stubsWritten).toBe(0);
        expect(summary.skippedSeen).toBe(0);
        expect(summary.skippedFiltered).toBe(0);
        // The catalog is still created, so the next run reads a real seen-URL set.
        expect(yield* fs.exists(path.join(vaultRoot, VAULT_DIRS.state))).toBe(true);
      })
    )
  );

  it.effect("collapses repository subpages into one stub and drops denylisted noise", () =>
    provideTestLayer(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* makeHome([CHROME_CONFIG_DIR], ROWS);
        const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-vault-" });
        const options = ResearchHistorySiftOptions.make({
          browser: "chrome",
          sinceDays: NonNegativeInt.make(7),
          vaultRoot,
        });

        const summary = yield* historySiftImpl(options).pipe(withHome({ HOME: home }));

        expect(summary.profilesScanned).toBe(1);
        expect(summary.urlsScanned).toBe(4);
        expect(summary.skippedFiltered).toBe(1);
        expect(summary.stubsWritten).toBe(2);
        expect(summary.skippedSeen).toBe(0);

        const inbox = path.join(vaultRoot, VAULT_DIRS.inbox);
        const stubs = yield* Effect.forEach(yield* fs.readDirectory(inbox), (name) =>
          fs.readFileString(path.join(inbox, name))
        );
        expect(A.length(stubs)).toBe(2);
        // The later visit of the same repository supplies the surviving title.
        expect(A.some(stubs, (stub) => Str.includes("title: Effect packages")(stub))).toBe(true);
        expect(A.some(stubs, (stub) => Str.includes("url: https://github.com/effect-ts/effect\n")(stub))).toBe(true);
        // The blank-titled row falls back to its own normalized URL.
        expect(A.some(stubs, (stub) => Str.includes("title: https://arxiv.org/abs/2401.00001")(stub))).toBe(true);
        expect(A.every(stubs, (stub) => Str.includes("via: history-sift")(stub))).toBe(true);

        // A second pass sees every stub URL in the catalog and writes nothing.
        const repeated = yield* historySiftImpl(options).pipe(withHome({ HOME: home }));
        expect(repeated.stubsWritten).toBe(0);
        expect(repeated.skippedSeen).toBe(3);
      })
    )
  );
});
